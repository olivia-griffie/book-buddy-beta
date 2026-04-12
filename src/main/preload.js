const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getAllProjects: () => ipcRenderer.invoke('projects:getAll'),
  saveProject: (project, options = {}) => ipcRenderer.invoke('projects:save', { project, options }),
  deleteProject: (id) => ipcRenderer.invoke('projects:delete', id),
  exportProjectManuscript: (project) => ipcRenderer.invoke('projects:exportManuscript', project),
  getPromptData: () => ipcRenderer.invoke('data:getPromptData'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
});
