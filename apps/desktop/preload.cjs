const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("debabufy", {
  listWorkflows: () => ipcRenderer.invoke("app:list-workflows"),
  chooseStatement: () => ipcRenderer.invoke("file:choose-statement"),
  chooseCertificate: () => ipcRenderer.invoke("file:choose-certificate"),
  inspectWorkflow: (request) => ipcRenderer.invoke("workflow:inspect", request),
  launchChrome: () => ipcRenderer.invoke("chrome:launch"),
  prepareWorkflow: (request) => ipcRenderer.invoke("workflow:prepare", request),
  runWorkflow: (request) => ipcRenderer.invoke("workflow:run", request),
  openDiagnostics: () => ipcRenderer.invoke("diagnostics:open"),
  onProgress(callback) {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("workflow:progress", listener);
    return () => ipcRenderer.removeListener("workflow:progress", listener);
  }
});
