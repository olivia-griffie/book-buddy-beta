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
  profile: {
    get: () => ipcRenderer.invoke('profile:get'),
    update: (updates) => ipcRenderer.invoke('profile:update', updates),
  },
  publishing: {
    publishChapter: (args) => ipcRenderer.invoke('chapters:publishChapter', args),
    unpublishChapter: (args) => ipcRenderer.invoke('chapters:unpublishChapter', args),
    getPublished: (args) => ipcRenderer.invoke('chapters:getPublished', args),
  },
  community: {
    getProjects: () => ipcRenderer.invoke('community:getProjects'),
    getComments: (args) => ipcRenderer.invoke('community:getComments', args),
    addComment: (args) => ipcRenderer.invoke('community:addComment', args),
    getChapterComments: (args) => ipcRenderer.invoke('community:getChapterComments', args),
    addChapterComment: (args) => ipcRenderer.invoke('community:addChapterComment', args),
    getLikes: (args) => ipcRenderer.invoke('community:getLikes', args),
    toggleLike: (args) => ipcRenderer.invoke('community:toggleLike', args),
    getFavorites: () => ipcRenderer.invoke('community:getFavorites'),
    toggleFavorite: (args) => ipcRenderer.invoke('community:toggleFavorite', args),
  },
  inbox: {
    getNotifications: () => ipcRenderer.invoke('inbox:getNotifications'),
    replyToComment: (args) => ipcRenderer.invoke('inbox:replyToComment', args),
  },
});
