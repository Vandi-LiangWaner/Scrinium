const { app, BrowserWindow, dialog, ipcMain, shell, utilityProcess } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { displayName } = require("../package.json");

app.setName(displayName);

const databasePath = () => path.join(app.getPath("documents"), "Literature Box Library", "literature-box.sqlite");
let database;
let failure;
let requestSequence = 0;
const pending = new Map();

function startDatabase() {
  const file = databasePath();
  const paths = {
    file,
    backupFile: path.join(path.dirname(file), "Backups", "literature-box-latest.sqlite"),
    legacyFiles: ["The Literature Box", "Literature Box Stacks"].map(name =>
      path.join(app.getPath("documents"), name, "literature-box.sqlite")),
  };
  database = utilityProcess.fork(path.join(__dirname, "database.cjs"), [JSON.stringify(paths)], {
    serviceName: displayName + " database",
  });
  const fail = error => {
    failure = error;
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };
  database.on("error", fail);
  database.on("exit", code => fail(new Error("Literature Box database worker exited: " + code)));
  database.on("message", ({ requestId, value, error }) => {
    const request = pending.get(requestId);
    if (!request) return;
    pending.delete(requestId);
    if (error) request.reject(new Error(error));
    else request.resolve(value);
  });
}

function requestDatabase(method, payload) {
  if (failure) return Promise.reject(failure);
  return new Promise((resolve, reject) => {
    const requestId = ++requestSequence;
    pending.set(requestId, { resolve, reject });
    try { database.postMessage({ requestId, method, payload }); }
    catch (error) { pending.delete(requestId); reject(error); }
  });
}

function createWindow(){
  const win=new BrowserWindow({width:1400,height:900,minWidth:900,minHeight:650,title:displayName,backgroundColor:"#e4dccb",webPreferences:{preload:path.join(__dirname,"preload.cjs"),contextIsolation:true,nodeIntegration:false}});
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
        message: displayName + " could not save your latest changes.",
        detail: "Your edits are still open. Use Retry save in the app before closing again.",
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
app.whenReady().then(()=>{startDatabase();createWindow();app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()})});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit()});
app.on("will-quit", () => { if (database) database.kill(); });

ipcMain.handle("cards:load", (_, revision) => requestDatabase("load", revision));
ipcMain.handle("cards:save", (_, payload) => requestDatabase("save", payload));
ipcMain.handle("cards:export",async(_,{kind,body})=>{const result=await dialog.showSaveDialog({defaultPath:`literature-box.${kind}`,filters:[{name:kind.toUpperCase(),extensions:[kind]}]});if(!result.canceled&&result.filePath)await fs.promises.writeFile(result.filePath,body);return !result.canceled});
ipcMain.handle("cards:import",async()=>{const result=await dialog.showOpenDialog({properties:["openFile"],filters:[{name:"JSON backup",extensions:["json"]}]});if(result.canceled)return null;return JSON.parse(await fs.promises.readFile(result.filePaths[0],"utf8"))});
ipcMain.handle("app:data-location",()=>databasePath());
