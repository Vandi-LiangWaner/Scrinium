const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("literatureBox", {
  loadCards: () => ipcRenderer.invoke("cards:load"),
  saveCards: (cards) => ipcRenderer.invoke("cards:save", cards),
  exportFile: (kind, body) => ipcRenderer.invoke("cards:export", { kind, body }),
  importFile: () => ipcRenderer.invoke("cards:import"),
  dataLocation: () => ipcRenderer.invoke("app:data-location"),
});
