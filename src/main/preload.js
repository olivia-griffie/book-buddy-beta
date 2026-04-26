const { contextBridge, ipcRenderer } = require('electron');

try {
  const root = document.documentElement;
  const cachedRaw = localStorage.getItem('bb-user-preferences-cache');
  const cachedPreferences = cachedRaw ? JSON.parse(cachedRaw) : {};
  const appearance = cachedPreferences?.appearance === 'dark' ? 'dark' : 'light';
  const fontFamily = cachedPreferences?.editorFontFamily === 'sans'
    ? "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    : "Georgia, 'Times New Roman', serif";
  const fontSize = Number(cachedPreferences?.editorFontSize || 18);
  const lineHeight = Number(cachedPreferences?.editorLineHeight || 1.7);

  root.dataset.theme = appearance;
  root.style.setProperty('--editor-font-family', fontFamily);
  root.style.setProperty('--editor-font-size', `${fontSize}px`);
  root.style.setProperty('--editor-line-height', String(lineHeight));

  window.addEventListener('DOMContentLoaded', () => {
    document.body.classList.toggle('dark-mode', appearance === 'dark');
  });
} catch {}

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
    signup: (email, password, displayName) => ipcRenderer.invoke('auth:signup', { email, password, displayName }),
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
    syncProjectVisibility: (args) => ipcRenderer.invoke('publishing:syncProjectVisibility', args),
  },
  community: {
    getProjects: () => ipcRenderer.invoke('community:getProjects'),
    getPrompts: () => ipcRenderer.invoke('community:getPrompts'),
    createPrompt: (prompt) => ipcRenderer.invoke('community:createPrompt', prompt),
    getComments: (args) => ipcRenderer.invoke('community:getComments', args),
    addComment: (args) => ipcRenderer.invoke('community:addComment', args),
    getChapterComments: (args) => ipcRenderer.invoke('community:getChapterComments', args),
    addChapterComment: (args) => ipcRenderer.invoke('community:addChapterComment', args),
    getLikes: (args) => ipcRenderer.invoke('community:getLikes', args),
    toggleLike: (args) => ipcRenderer.invoke('community:toggleLike', args),
    getFavorites: () => ipcRenderer.invoke('community:getFavorites'),
    toggleFavorite: (args) => ipcRenderer.invoke('community:toggleFavorite', args),
    getPromptFavorites: () => ipcRenderer.invoke('community:getPromptFavorites'),
    togglePromptFavorite: (args) => ipcRenderer.invoke('community:togglePromptFavorite', args),
    recordPromptCompletion: (args) => ipcRenderer.invoke('community:recordPromptCompletion', args),
  },
  inbox: {
    getNotifications: () => ipcRenderer.invoke('inbox:getNotifications'),
    replyToComment: (args) => ipcRenderer.invoke('inbox:replyToComment', args),
    getDirectConversations: () => ipcRenderer.invoke('inbox:getDirectConversations'),
    getConversationMessages: (args) => ipcRenderer.invoke('inbox:getConversationMessages', args),
    findOrCreateConversation: (args) => ipcRenderer.invoke('inbox:findOrCreateConversation', args),
    sendDirectMessage: (args) => ipcRenderer.invoke('inbox:sendDirectMessage', args),
    markConversationRead: (args) => ipcRenderer.invoke('inbox:markConversationRead', args),
  },
  onNewVersion: (cb) => ipcRenderer.on('app:newVersion', (_, data) => cb(data)),
  updater: {
    onUpdateAvailable: (cb) => ipcRenderer.on('update:available', (_, data) => cb(data)),
    onUpdateProgress: (cb) => ipcRenderer.on('update:progress', (_, data) => cb(data)),
    onUpdateReady: (cb) => ipcRenderer.on('update:ready', (_, data) => cb(data)),
    installNow: () => ipcRenderer.invoke('updater:installNow'),
    dismiss: () => ipcRenderer.invoke('updater:dismiss'),
    removeListeners: () => {
      ipcRenderer.removeAllListeners('update:available');
      ipcRenderer.removeAllListeners('update:progress');
      ipcRenderer.removeAllListeners('update:ready');
    },
  },
});
