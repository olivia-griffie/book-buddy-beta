window.initPage = async function ({ project }) {
  const activeProject = project || window.getCurrentProject();
  const emptyState = document.getElementById('characters-empty-state');
  const content = document.getElementById('characters-content');
  const saveButton = document.getElementById('save-characters');
  const addButton = document.getElementById('add-character');
  const gallery = document.getElementById('characters-gallery');
  const list = document.getElementById('characters-list');
  const saveMessage = document.getElementById('characters-save-message');
  const editorShell = document.getElementById('character-editor-shell');
  const editorEmpty = document.getElementById('character-editor-empty');
  const createButton = document.getElementById('characters-create-project');
  const imageInput = document.getElementById('character-image');
  const imageTrigger = document.getElementById('character-image-trigger');
  const imagePreview = document.getElementById('character-image-preview');

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
  window.initializeTextEditor(content);

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

  function renderImagePreview(image) {
    imagePreview.innerHTML = image
      ? `<img src="${image}" alt="Character reference" />`
      : '<span class="placeholder-icon">Portrait</span>';
  }

  function renderList() {
    gallery.innerHTML = characters.length
      ? characters.map((character) => `
        <button
          class="character-gallery-card ${character.id === selectedId ? 'is-active' : ''}"
          type="button"
          data-gallery-character="${character.id}"
        >
          <div class="character-gallery-thumb">
            ${character.image
              ? `<img src="${character.image}" alt="${character.name || 'Character'}" />`
              : '<span class="placeholder-icon">Portrait</span>'}
          </div>
          <div class="character-gallery-name">${character.name || 'Unnamed Character'}</div>
          <div class="character-gallery-status">${character.image ? 'Image Ready' : character.desires ? 'Prompt Ready' : 'Draft'}</div>
        </button>
      `).join('')
      : '';

    list.innerHTML = characters.length
      ? characters.map((character) => `
        <div class="entity-list-item">
          <button type="button" data-open-character="${character.id}">
            <strong>${character.name || 'Unnamed Character'}</strong>
          </button>
          <span>${character.image ? 'Image ready' : character.desires ? 'Prompt ready' : 'Draft'}</span>
        </div>
      `).join('')
      : '<p>No characters yet.</p>';

    list.querySelectorAll('[data-open-character]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedId = button.dataset.openCharacter;
        renderList();
        renderEditor();
      });
    });

    gallery.querySelectorAll('[data-gallery-character]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedId = button.dataset.galleryCharacter;
        renderList();
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
      renderImagePreview('');
      return;
    }

    editorShell.style.display = 'block';
    editorEmpty.style.display = 'none';
    document.getElementById('character-editor-title').textContent = character.name || 'Character Profile';
    Object.entries(fields).forEach(([key, field]) => {
      field.value = character[key] || '';
      window.refreshTextEditor(field, field.value);
    });
    imageInput.value = '';
    renderImagePreview(character.image || '');
  }

  function syncCharacter() {
    const character = getSelectedCharacter();
    if (!character) {
      return;
    }

    Object.entries(fields).forEach(([key, field]) => {
      character[key] = String(window.getEditorFieldValue(field) || '').trim();
    });

    document.getElementById('character-editor-title').textContent = character.name || 'Character Profile';
    renderList();
  }

  async function readImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read the selected character image.'));
      reader.readAsDataURL(file);
    });
  }

  addButton.addEventListener('click', () => {
    const character = {
      id: `character-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: `Character ${characters.length + 1}`,
      image: '',
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

  imageInput.addEventListener('change', async (event) => {
    const character = getSelectedCharacter();
    const file = event.target.files?.[0];
    if (!character || !file) {
      return;
    }

    try {
      character.image = await readImage(file);
      renderImagePreview(character.image);
      renderList();
      saveMessage.textContent = '';
    } catch (error) {
      saveMessage.textContent = error.message;
    }
  });

  imageTrigger?.addEventListener('click', () => {
    imageInput?.click();
  });

  saveButton.addEventListener('click', async () => {
    await window.runButtonFeedback(saveButton, async () => {
      const updatedProject = {
        ...activeProject,
        characters,
        updatedAt: new Date().toISOString(),
      };

      await window.saveProjectData(updatedProject);
      saveMessage.textContent = 'Characters saved.';
    });
  });

  renderList();
  renderEditor();
};
