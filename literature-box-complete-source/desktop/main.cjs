const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const Database = require("better-sqlite3");

let db;
function databasePath(){ return path.join(app.getPath("documents"), "The Literature Box", "literature-box.sqlite"); }
function backupPath(){ return path.join(app.getPath("documents"), "The Literature Box", "Backups", "literature-box-latest.sqlite"); }
function openDatabase(){
  const file=databasePath(); fs.mkdirSync(path.dirname(file),{recursive:true});
  db=new Database(file); db.pragma("journal_mode = WAL");
  db.exec("CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), cards_json TEXT NOT NULL, updated_at TEXT NOT NULL)");
}
function backup(){
  const target=backupPath(); fs.mkdirSync(path.dirname(target),{recursive:true});
  return db.backup(target);
}
function createWindow(){
  const win=new BrowserWindow({width:1400,height:900,minWidth:900,minHeight:650,title:"The Literature Box",backgroundColor:"#e4dccb",webPreferences:{preload:path.join(__dirname,"preload.cjs"),contextIsolation:true,nodeIntegration:false}});
  if(!app.isPackaged) win.loadURL("http://127.0.0.1:5174"); else win.loadFile(path.join(__dirname,"../desktop-dist/index.html"));
  win.webContents.setWindowOpenHandler(({url})=>{shell.openExternal(url);return{action:"deny"}});
}
app.whenReady().then(()=>{openDatabase();createWindow();app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()})});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit()});
app.on("before-quit",()=>{if(db)db.close()});

ipcMain.handle("cards:load",()=>{const row=db.prepare("SELECT cards_json FROM app_state WHERE id=1").get();return row?JSON.parse(row.cards_json):null});
ipcMain.handle("cards:save",async(_,cards)=>{db.prepare("INSERT INTO app_state(id,cards_json,updated_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET cards_json=excluded.cards_json,updated_at=excluded.updated_at").run(JSON.stringify(cards),new Date().toISOString());await backup();return true});
ipcMain.handle("cards:export",async(_,{kind,body})=>{const result=await dialog.showSaveDialog({defaultPath:`literature-box.${kind}`,filters:[{name:kind.toUpperCase(),extensions:[kind]}]});if(!result.canceled&&result.filePath)fs.writeFileSync(result.filePath,body);return !result.canceled});
ipcMain.handle("cards:import",async()=>{const result=await dialog.showOpenDialog({properties:["openFile"],filters:[{name:"JSON backup",extensions:["json"]}]});if(result.canceled)return null;return JSON.parse(fs.readFileSync(result.filePaths[0],"utf8"))});
ipcMain.handle("app:data-location",()=>databasePath());
