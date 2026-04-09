const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { setApplicationMenu, buildTextContextMenu } = require('./menu');

const store = new Store();
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#faf7f2',
    icon: path.join(__dirname, '../../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  mainWindow.webContents.session.setSpellCheckerLanguages(['en-US']);
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.webContents.on('context-menu', (event, params) => {
    if (!params.isEditable && !params.selectionText && !params.misspelledWord) {
      return;
    }

    buildTextContextMenu(mainWindow, params).popup({
      window: mainWindow,
    });
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  setApplicationMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC: Projects
ipcMain.handle('projects:getAll', () => store.get('projects', []));

ipcMain.handle('projects:save', (_, project) => {
  const projects = store.get('projects', []);
  const index = projects.findIndex((entry) => entry.id === project.id);

  if (index >= 0) {
    projects[index] = project;
  } else {
    projects.push(project);
  }

  store.set('projects', projects);
  return project;
});

ipcMain.handle('projects:delete', (_, id) => {
  const projects = store.get('projects', []).filter((project) => project.id !== id);
  store.set('projects', projects);
});

// IPC: Settings
ipcMain.handle('settings:get', () => store.get('settings', { tier: 'beta' }));
ipcMain.handle('settings:save', (_, settings) => {
  const nextSettings = {
    ...store.get('settings', { tier: 'beta' }),
    ...settings,
  };

  store.set('settings', nextSettings);
  return nextSettings;
});
