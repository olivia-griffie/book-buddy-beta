const { Menu, shell } = require('electron');

function buildMenu() {
  const template = [
    {
      label: 'Book Buddy Beta',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'GitHub',
          click: () => shell.openExternal('https://github.com/olivia-griffie/book-buddy-beta'),
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

function setApplicationMenu() {
  Menu.setApplicationMenu(buildMenu());
}

function buildTextContextMenu(mainWindow, params = {}) {
  const canEdit = Boolean(
    params.isEditable
    || params.inputFieldType && params.inputFieldType !== 'none'
    || params.editFlags?.canPaste
    || params.editFlags?.canUndo
    || params.editFlags?.canRedo,
  );
  const hasSelection = Boolean(params.selectionText || params.editFlags?.canCopy || params.editFlags?.canCut);
  const spellingSuggestions = (params.dictionarySuggestions || []).slice(0, 5).map((suggestion) => ({
    label: suggestion,
    click: () => {
      mainWindow.webContents.replaceMisspelling(suggestion);
    },
  }));
  const template = [
    ...spellingSuggestions,
    ...(spellingSuggestions.length ? [{ type: 'separator' }] : []),
    { role: 'undo', enabled: canEdit },
    { role: 'redo', enabled: canEdit },
    { type: 'separator' },
    { role: 'cut', enabled: canEdit && (hasSelection || params.editFlags?.canCut) },
    { role: 'copy', enabled: hasSelection },
    { role: 'paste', enabled: canEdit },
    { role: 'selectAll', enabled: canEdit || hasSelection },
  ];

  if (params.misspelledWord && !spellingSuggestions.length) {
    template.unshift(
      { label: 'No suggestions found', enabled: false },
      { type: 'separator' },
    );
  }

  return Menu.buildFromTemplate(template);
}

module.exports = {
  setApplicationMenu,
  buildTextContextMenu,
};
