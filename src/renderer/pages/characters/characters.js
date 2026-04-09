window.initPage = async function ({ project }) {
  const activeProject = project || window.getCurrentProject();
  const emptyState = document.getElementById('characters-empty-state');
  const content = document.getElementById('characters-content');
  const saveButton = document.getElementById('save-characters');
  const addButton = document.getElementById('add-character');
  const list = document.getElementById('characters-list');
  const saveMessage = document.getElementById('characters-save-message');
  const editorShell = document.getElementById('character-editor-shell');
  const editorEmpty = document.getElementById('character-editor-empty');
  const createButton = document.getElementById('characters-create-project');

  createButton?.addEventListener('click', () => window.navigate('create-project', { project: null }));

  if (!activeProject) {
    emptyState.style.display = 'grid';
    content.style.display = 'none';
    saveButton.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  content.style.display = 'grid';
  saveButton.style.display = 'inline-flex';
  document.getElementById('characters-page-title').textContent = `${activeProject.title || 'Project'} Characters`;

  const characters = (activeProject.characters || []).map((character) => ({ ...character }));
  let selectedId = characters[0]?.id || '';

  const fields = {
    name: document.getElementById('character-name'),
    appearance: document.getElementById('character-appearance'),
    background: document.getElementById('character-background'),
    secrets: document.getElementById('character-secrets'),
    desires: document.getElementById('character-desires'),
    chapterIntro: document.getElementById('character-chapter-intro'),
    deathScene: document.getElementById('character-death-scene'),
    romanceScenes: document.getElementById('character-romance-scenes'),
    other: document.getElementById('character-other'),
  };

  function getSelectedCharacter() {
    return characters.find((character) => character.id === selectedId) || null;
  }

  function renderList() {
    list.innerHTML = characters.length
      ? characters.map((character) => `
        <div class="entity-list-item">
          <button type="button" data-open-character="${character.id}">
            <strong>${character.name || 'Unnamed Character'}</strong>
          </button>
          <span>${character.desires ? 'Prompt ready' : 'Draft'}</span>
        </div>
      `).join('')
      : '<p>No characters yet.</p>';

    list.querySelectorAll('[data-open-character]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedId = button.dataset.openCharacter;
        renderEditor();
      });
    });
  }

  function renderEditor() {
    const character = getSelectedCharacter();
    if (!character) {
      editorShell.style.display = 'none';
      editorEmpty.style.display = 'block';
      document.getElementById('character-editor-title').textContent = 'Select a character';
      return;
    }

    editorShell.style.display = 'block';
    editorEmpty.style.display = 'none';
    document.getElementById('character-editor-title').textContent = character.name || 'Character Profile';
    Object.entries(fields).forEach(([key, field]) => {
      field.value = character[key] || '';
    });
  }

  function syncCharacter() {
    const character = getSelectedCharacter();
    if (!character) {
      return;
    }

    Object.entries(fields).forEach(([key, field]) => {
      character[key] = field.value.trim();
    });

    document.getElementById('character-editor-title').textContent = character.name || 'Character Profile';
    renderList();
  }

  addButton.addEventListener('click', () => {
    const character = {
      id: `character-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: `Character ${characters.length + 1}`,
      appearance: '',
      background: '',
      secrets: '',
      desires: '',
      chapterIntro: '',
      deathScene: '',
      romanceScenes: '',
      other: '',
    };

    characters.push(character);
    selectedId = character.id;
    renderList();
    renderEditor();
  });

  Object.values(fields).forEach((field) => field.addEventListener('input', syncCharacter));

  saveButton.addEventListener('click', async () => {
    const updatedProject = {
      ...activeProject,
      characters,
      updatedAt: new Date().toISOString(),
    };

    await window.saveProjectData(updatedProject);
    saveMessage.textContent = 'Characters saved.';
  });

  renderList();
  renderEditor();
};
