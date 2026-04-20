const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getAllProjects: () => ipcRenderer.invoke('projects:getAll'),
  getCurrentProjectId: () => ipcRenderer.invoke('projects:getCurrentId'),
  setCurrentProjectId: (projectId) => ipcRenderer.invoke('projects:setCurrentId', projectId),
  saveProject: (project, options = {}) => ipcRenderer.invoke('projects:save', { project, options }),
  deleteProject: (id) => ipcRenderer.invoke('projects:delete', id),
  exportProjectManuscript: (project) => ipcRenderer.invoke('projects:exportManuscript', project),
  exportProjectBackup: (project) => ipcRenderer.invoke('projects:exportBackup', project),
  importProjectBackup: () => ipcRenderer.invoke('projects:importBackup'),
  getPromptData: () => ipcRenderer.invoke('data:getPromptData'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  auth: {
    getSession: () => ipcRenderer.invoke('auth:getSession'),
    login: (email, password) => ipcRenderer.invoke('auth:login', { email, password }),
    signup: (email, password, username) => ipcRenderer.invoke('auth:signup', { email, password, username }),
    refresh: () => ipcRenderer.invoke('auth:refresh'),
    logout: () => ipcRenderer.invoke('auth:logout'),
  },
});
