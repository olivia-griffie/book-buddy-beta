const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getAllProjects: () => ipcRenderer.invoke('projects:getAll'),
  saveProject: (project) => ipcRenderer.invoke('projects:save', project),
  deleteProject: (id) => ipcRenderer.invoke('projects:delete', id),
  exportProjectManuscript: (project) => ipcRenderer.invoke('projects:exportManuscript', project),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
});
