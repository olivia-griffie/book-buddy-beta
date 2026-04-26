const { Menu, shell } = require('electron');

function buildMenu() {
  const template = [
    {
      label: 'Inkbug Beta',
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
          click: () => shell.openExternal('https://github.com/olivia-griffie/inkbug-beta'),
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
    || (params.inputFieldType && params.inputFieldType !== 'none')
    || params.editFlags?.canPaste
    || params.editFlags?.canUndo
    || params.editFlags?.canRedo,
  );
  const hasSelection = Boolean(
    params.selectionText?.trim()
    || params.editFlags?.canCopy
    || params.editFlags?.canCut,
  );

  const template = [];

  // Spellcheck suggestions
  const spellingSuggestions = (params.dictionarySuggestions || []).slice(0, 5);
  if (params.misspelledWord) {
    if (spellingSuggestions.length) {
      spellingSuggestions.forEach((suggestion) => {
        template.push({
          label: suggestion,
          click: () => mainWindow.webContents.replaceMisspelling(suggestion),
        });
      });
    } else {
      template.push({ label: 'No suggestions found', enabled: false });
    }
    template.push({
      label: 'Add to dictionary',
      click: () => mainWindow.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
    });
    template.push({ type: 'separator' });
  }

  // Thesaurus — only shown when a single word is selected
  const selectedWord = params.selectionText?.trim();
  if (selectedWord && !selectedWord.includes(' ')) {
    template.push({
      label: `Thesaurus: "${selectedWord}"`,
      click: () => {
        const encoded = encodeURIComponent(selectedWord);
        shell.openExternal(`https://www.merriam-webster.com/thesaurus/${encoded}`);
      },
    });
    template.push({ type: 'separator' });
  }

  // Standard edit actions
  template.push(
    { role: 'undo', enabled: canEdit },
    { role: 'redo', enabled: canEdit },
    { type: 'separator' },
    { role: 'cut', enabled: canEdit && (hasSelection || params.editFlags?.canCut) },
    { role: 'copy', enabled: hasSelection },
    { role: 'paste', enabled: canEdit },
    { role: 'selectAll', enabled: canEdit || hasSelection },
  );

  // Inspect element (always available)
  template.push(
    { type: 'separator' },
    {
      label: 'Inspect Element',
      click: () => mainWindow.webContents.inspectElement(params.x, params.y),
    },
  );

  return Menu.buildFromTemplate(template);
}

module.exports = {
  setApplicationMenu,
  buildTextContextMenu,
};
