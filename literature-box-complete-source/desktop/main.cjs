const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const Database = require("better-sqlite3");

let db;
let loadState;
let saveState;
let backupTimer=null;
let backupInFlight=false;
let backupQueued=false;
function databasePath(){ return path.join(app.getPath("documents"), "The Literature Box", "literature-box.sqlite"); }
function backupPath(){ return path.join(app.getPath("documents"), "The Literature Box", "Backups", "literature-box-latest.sqlite"); }
function openDatabase(){
  const file=databasePath(); fs.mkdirSync(path.dirname(file),{recursive:true});
  db=new Database(file); db.pragma("journal_mode = WAL");db.pragma("synchronous = NORMAL");
  db.exec("CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), cards_json TEXT NOT NULL, updated_at TEXT NOT NULL)");
  loadState=db.prepare("SELECT cards_json FROM app_state WHERE id=1");
  saveState=db.prepare("INSERT INTO app_state(id,cards_json,updated_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET cards_json=excluded.cards_json,updated_at=excluded.updated_at");
}
function backup(){
  const target=backupPath(); fs.mkdirSync(path.dirname(target),{recursive:true});
  return db.backup(target);
}
function queueBackup(){
  backupQueued=true;
  if(backupTimer||backupInFlight)return;
  backupTimer=setTimeout(async()=>{backupTimer=null;if(!backupQueued||!db)return;backupQueued=false;backupInFlight=true;try{await backup()}catch(error){console.error("Literature Box backup failed",error)}finally{backupInFlight=false;if(backupQueued)queueBackup()}},60_000);
}
function createWindow(){
  const win=new BrowserWindow({width:1400,height:900,minWidth:900,minHeight:650,title:"The Literature Box",backgroundColor:"#e4dccb",webPreferences:{preload:path.join(__dirname,"preload.cjs"),contextIsolation:true,nodeIntegration:false}});
  if(!app.isPackaged) win.loadURL("http://127.0.0.1:5174"); else win.loadFile(path.join(__dirname,"../desktop-dist/index.html"));
  win.webContents.setWindowOpenHandler(({url})=>{shell.openExternal(url);return{action:"deny"}});
  let watchesClose = false;
  let awaitingSave = false;
  let mayClose = false;
  const watchClose = (event) => {
    if (event.sender === win.webContents) watchesClose = true;
  };
  const finishClose = (event, saved) => {
    if (event.sender !== win.webContents || !awaitingSave) return;
    awaitingSave = false;
    if (saved === true) {
      mayClose = true;
      win.close();
    } else {
      void dialog.showMessageBox(win, {
        type: "error",
        message: "The Literature Box could not save your latest changes.",
        detail: "Your edits are still open. Use Save now to try again before closing.",
      });
    }
  };
  ipcMain.on("cards:watch-close", watchClose);
  ipcMain.on("cards:close-saved", finishClose);
  win.on("close", event => {
    if (mayClose || !watchesClose || win.webContents.isCrashed()) return;
    event.preventDefault();
    if (awaitingSave) return;
    awaitingSave = true;
    win.webContents.send("cards:flush-before-close");
  });
  win.once("closed", () => {
    ipcMain.removeListener("cards:watch-close", watchClose);
    ipcMain.removeListener("cards:close-saved", finishClose);
  });
}
app.whenReady().then(()=>{openDatabase();createWindow();app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()})});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit()});
app.on("will-quit",()=>{if(backupTimer)clearTimeout(backupTimer);if(db)db.close()});

ipcMain.handle("cards:load",()=>{const row=loadState.get();return row?JSON.parse(row.cards_json):null});
ipcMain.handle("cards:save",(_,payload)=>{const json=typeof payload==="string"?payload:JSON.stringify(payload);saveState.run(json,new Date().toISOString());queueBackup();return true});
ipcMain.handle("cards:patch", (_, { index, id, fields }) => {
  const entries = Object.entries(fields);
  if (!Number.isSafeInteger(index) || index < 0 || !Number.isFinite(id) ||
      !entries.length || entries.length > 24 ||
      entries.some(([key]) => key === "id" || !/^[a-zA-Z]+$/.test(key))) return false;
  const cardPath = `$.cards[${index}]`;
  const values = entries.flatMap(([key, value]) => [`${cardPath}.${key}`, JSON.stringify(value)]);
  const args = entries.map(() => "?, json(?)").join(", ");
  const result = db.prepare(`
    UPDATE app_state SET cards_json=json_set(cards_json, ${args}), updated_at=?
    WHERE id=1 AND json_extract(cards_json, ?) = ?
  `).run(...values, new Date().toISOString(), `${cardPath}.id`, id);
  if (result.changes) queueBackup();
  return result.changes === 1;
});
ipcMain.handle("cards:export",async(_,{kind,body})=>{const result=await dialog.showSaveDialog({defaultPath:`literature-box.${kind}`,filters:[{name:kind.toUpperCase(),extensions:[kind]}]});if(!result.canceled&&result.filePath)await fs.promises.writeFile(result.filePath,body);return !result.canceled});
ipcMain.handle("cards:import",async()=>{const result=await dialog.showOpenDialog({properties:["openFile"],filters:[{name:"JSON backup",extensions:["json"]}]});if(result.canceled)return null;return JSON.parse(await fs.promises.readFile(result.filePaths[0],"utf8"))});
ipcMain.handle("app:data-location",()=>databasePath());
