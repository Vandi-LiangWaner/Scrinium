const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("literatureBox", {
  loadCards: () => ipcRenderer.invoke("cards:load"),
  saveCards: (cards) => ipcRenderer.invoke("cards:save", cards),
  patchCard: (patch) => ipcRenderer.invoke("cards:patch", patch),
  onCloseRequested: (save) => {
    const listener = async () => {
      let saved = false;
      try {
        saved = await save();
      } finally {
        ipcRenderer.send("cards:close-saved", saved);
      }
    };
    ipcRenderer.on("cards:flush-before-close", listener);
    ipcRenderer.send("cards:watch-close");
    return () => ipcRenderer.removeListener("cards:flush-before-close", listener);
  },
  exportFile: (kind, body) => ipcRenderer.invoke("cards:export", { kind, body }),
  importFile: () => ipcRenderer.invoke("cards:import"),
  dataLocation: () => ipcRenderer.invoke("app:data-location"),
});
