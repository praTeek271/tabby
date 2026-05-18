const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readWorkspaceData: (filename) => ipcRenderer.invoke('read-workspace-data', filename),
  writeWorkspaceData: (data) => ipcRenderer.invoke('write-workspace-data', data),
  deleteWorkspaceData: (filename) => ipcRenderer.invoke('delete-workspace-data', filename),
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
  startLogin: () => ipcRenderer.invoke('start-login'),
  onLoginSuccess: (callback) => ipcRenderer.on('login-success', (event, data) => callback(data)),
  onOpenFile: (callback) => ipcRenderer.on('open-file', callback)
});
