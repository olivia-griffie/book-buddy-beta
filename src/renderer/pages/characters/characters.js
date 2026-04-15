window.registerPageInit('characters', async function ({ project }) {
  function escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function stripEditorHtml(value = '') {
    if (!value || !String(value).includes('<')) {
      return String(value || '').trim();
    }

    const temp = document.createElement('div');
    temp.innerHTML = String(value || '');
    return (temp.textContent || temp.innerText || '').trim();
  }

  const characterTypeDefinitions = [
    {
      id: 'protagonist',
      label: 'Protagonist',
      description: 'The main character of the story, with a defined backstory, motivation, and arc that often carries the point of view.',
    },
    {
      id: 'antagonist',
      label: 'Antagonist',
      description: 'The story villain or opposing force creating direct conflict for the protagonist.',
    },
    {
      id: 'love-interest',
      label: 'Love Interest',
      description: 'The protagonist\'s object of desire and the emotional focus of a romantic thread.',
    },
    {
      id: 'confidant',
      label: 'Confidant',
      description: 'The trusted friend, sidekick, or sounding board who supports the protagonist closely.',
    },
    {
      id: 'deuteragonist',
      label: 'Deuteragonist',
      description: 'A major secondary character who stays close to the protagonist even though the main plot is not centered on their arc.',
    },
    {
      id: 'tertiary',
      label: 'Tertiary Character',
      description: 'A world-building character who helps populate the story without directly driving the central plot.',
    },
    {
      id: 'foil',
      label: 'Foil',
      description: 'A contrasting character whose differences make the protagonist\'s qualities stand out more clearly.',
    },
  ];

  let activeProject = project || window.getCurrentProject();
  const emptyState = document.getElementById('characters-empty-state');
  const content = document.getElementById('characters-content');
  const saveButton = document.getElementById('save-characters');
  const addButton = document.getElementById('add-character');
  const gallery = document.getElementById('characters-gallery');
  const saveMessage = document.getElementById('characters-save-message');
  const editorShell = document.getElementById('character-editor-shell');
  const editorEmpty = document.getElementById('character-editor-empty');
  const createButton = document.getElementById('characters-create-project');
  const imageInput = document.getElementById('character-image');
  const imageTrigger = document.getElementById('character-image-trigger');
  const imagePreview = document.getElementById('character-image-preview');
  const typeTags = document.getElementById('character-type-tags');
  const typeSummary = document.getElementById('character-type-summary');

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
  const chapters = (activeProject.chapters || []).map((chapter) => ({ ...chapter }));
  const scenes = (activeProject.scenes || []).map((scene) => ({ ...scene }));
  let selectedId = characters[0]?.id || '';

  const textFields = {
    name: document.getElementById('character-name'),
    appearance: document.getElementById('character-appearance'),
    background: document.getElementById('character-background'),
    secrets: document.getElementById('character-secrets'),
    desires: document.getElementById('character-desires'),
    other: document.getElementById('character-other'),
  };
  const linkFields = {
    chapterIntro: document.getElementById('character-chapter-intro'),
    deathScene: document.getElementById('character-death-scene'),
    romanceScenes: document.getElementById('character-romance-scenes'),
  };
  const autosave = window.createAutosaveController(async () => {
    activeProject = await window.saveProjectData({
      ...activeProject,
      characters,
      updatedAt: new Date().toISOString(),
    }, {
      dirtyFields: ['characters'],
    });
    saveMessage.textContent = 'Characters autosaved.';
  }, {
    dirtyText: 'Character changes not saved',
  });

  function getSelectedCharacter() {
    return characters.find((character) => character.id === selectedId) || null;
  }

  function normalizeLinkedId(value, items, labelKey) {
    const raw = String(value || '').trim();
    if (!raw) {
      return '';
    }

    const directMatch = items.find((item) => item.id === raw);
    if (directMatch) {
      return directMatch.id;
    }

    const fallbackMatch = items.find((item) => String(item[labelKey] || '').trim() === raw);
    return fallbackMatch?.id || '';
  }

  function normalizeLinkedIds(value, items, labelKey) {
    const rawValues = Array.isArray(value)
      ? value
      : String(value || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);

    return [...new Set(rawValues
      .map((entry) => normalizeLinkedId(entry, items, labelKey))
      .filter(Boolean))];
  }

  function renderImagePreview(image) {
    imagePreview.innerHTML = image
      ? `<img src="${image}" alt="Character reference" />`
      : '<span class="placeholder-icon">Portrait</span>';
  }

  function normalizeCharacterTypes(value) {
    return [...new Set((Array.isArray(value) ? value : [])
      .filter(Boolean)
      .map((item) => String(item)))];
  }

  function getCharacterTypeLabels(character) {
    return normalizeCharacterTypes(character?.typeTags).map((typeId) => (
      characterTypeDefinitions.find((type) => type.id === typeId)?.label || typeId
    ));
  }

  function populateLinkFields() {
    linkFields.chapterIntro.innerHTML = `
      <option value="">No chapter linked</option>
      ${chapters.map((chapter) => `<option value="${chapter.id}">${escapeHtml(chapter.title || 'Untitled Chapter')}</option>`).join('')}
    `;

    linkFields.deathScene.innerHTML = `
      <option value="">No death scene linked</option>
      ${scenes.map((scene) => `<option value="${scene.id}">${escapeHtml(scene.title || 'Untitled Scene')}</option>`).join('')}
    `;

    linkFields.romanceScenes.innerHTML = `
      <option value="">No romance scene linked</option>
      ${scenes.map((scene) => `<option value="${scene.id}">${escapeHtml(scene.title || 'Untitled Scene')}</option>`).join('')}
    `;
  }

  function initializeCollapsibles() {
    editorShell.querySelectorAll('[data-collapse-toggle]').forEach((trigger) => {
      if (trigger.dataset.collapseBound === 'true') {
        return;
      }

      trigger.dataset.collapseBound = 'true';
      const wrapper = trigger.closest('.field-collapsible');
      trigger.setAttribute('aria-expanded', String(wrapper?.classList.contains('is-open')));
      trigger.addEventListener('click', () => {
        const field = trigger.closest('.field-collapsible');
        if (!field) {
          return;
        }

        const isOpen = field.classList.toggle('is-open');
        trigger.setAttribute('aria-expanded', String(isOpen));
      });
    });
  }

  function renderList() {
    gallery.innerHTML = characters.length
      ? characters.map((character) => `
        <button
          class="character-gallery-card ui-card ui-card-soft ui-card-interactive ${character.id === selectedId ? 'is-active' : ''}"
          type="button"
          data-gallery-character="${character.id}"
        >
          <div class="character-gallery-thumb ${character.image ? 'has-image' : ''}">
            ${character.image
              ? `<img src="${character.image}" alt="${escapeHtml(character.name || 'Character')}" />`
              : '<span class="placeholder-icon">Portrait</span>'}
          </div>
          <div class="character-gallery-copy">
            <div class="character-gallery-name">${escapeHtml(character.name || 'Unnamed Character')}</div>
            <div class="character-gallery-tags">
              ${getCharacterTypeLabels(character).slice(0, 3).map((label) => `
                <span class="character-type-badge">${escapeHtml(label)}</span>
              `).join('')}
            </div>
          </div>
        </button>
      `).join('')
      : '';

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
      typeTags.innerHTML = '';
      typeSummary.innerHTML = '';
      return;
    }

    editorShell.style.display = 'block';
    editorEmpty.style.display = 'none';
    document.getElementById('character-editor-title').textContent = character.name || 'Character Profile';
    Object.entries(textFields).forEach(([key, field]) => {
      field.value = character[key] || '';
      window.refreshTextEditor(field, field.value);
    });

    character.chapterIntro = normalizeLinkedId(character.chapterIntro, chapters, 'title');
    character.deathScene = normalizeLinkedId(character.deathScene, scenes, 'title');
    character.romanceScenes = normalizeLinkedIds(character.romanceScenes, scenes, 'title')[0] || '';

    linkFields.chapterIntro.value = character.chapterIntro || '';
    linkFields.deathScene.value = character.deathScene || '';
    linkFields.romanceScenes.value = character.romanceScenes || '';

    imageInput.value = '';
    renderImagePreview(character.image || '');
    const selectedTypes = normalizeCharacterTypes(character.typeTags);
    typeTags.innerHTML = characterTypeDefinitions.map((type) => `
      <button
        class="character-type-tag ${selectedTypes.includes(type.id) ? 'is-selected' : ''}"
        type="button"
        data-character-type="${type.id}"
        aria-pressed="${selectedTypes.includes(type.id) ? 'true' : 'false'}"
      >
        ${type.label}
      </button>
    `).join('');

    typeSummary.innerHTML = selectedTypes.length
      ? selectedTypes.map((typeId) => {
        const definition = characterTypeDefinitions.find((type) => type.id === typeId);
        if (!definition) {
          return '';
        }

        return `
          <div class="character-type-summary-card ui-card ui-card-soft ui-card-compact">
            <strong>${definition.label}</strong>
            <p>${definition.description}</p>
          </div>
        `;
      }).join('')
      : `
        <div class="character-type-summary-card ui-card ui-card-soft ui-card-compact">
          <strong>No tags selected yet</strong>
          <p>Choose the roles that best describe how this character functions in your manuscript.</p>
        </div>
      `;

    initializeCollapsibles();

    typeTags.querySelectorAll('[data-character-type]').forEach((button) => {
      button.addEventListener('click', () => {
        const nextCharacter = getSelectedCharacter();
        if (!nextCharacter) {
          return;
        }

        const currentTypes = normalizeCharacterTypes(nextCharacter.typeTags);
        nextCharacter.typeTags = currentTypes.includes(button.dataset.characterType)
          ? currentTypes.filter((typeId) => typeId !== button.dataset.characterType)
          : [...currentTypes, button.dataset.characterType];
        renderList();
        renderEditor();
        autosave.touch();
      });
    });
  }

  function syncCharacter() {
    const character = getSelectedCharacter();
    if (!character) {
      return;
    }

    character.typeTags = normalizeCharacterTypes(character.typeTags);
    Object.entries(textFields).forEach(([key, field]) => {
      character[key] = String(window.getEditorFieldValue(field) || '').trim();
    });
    character.chapterIntro = linkFields.chapterIntro.value;
    character.deathScene = linkFields.deathScene.value;
    character.romanceScenes = linkFields.romanceScenes.value;

    document.getElementById('character-editor-title').textContent = character.name || 'Character Profile';
    renderList();
    autosave.touch();
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
      typeTags: [],
      chapterIntro: '',
      deathScene: '',
      romanceScenes: '',
      other: '',
    };

    characters.push(character);
    selectedId = character.id;
    autosave.touch();
    renderList();
    renderEditor();
  });

  Object.values(textFields).forEach((field) => field.addEventListener('input', syncCharacter));
  Object.values(linkFields).forEach((field) => {
    field.addEventListener('input', syncCharacter);
    field.addEventListener('change', syncCharacter);
  });

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
      autosave.touch();
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

      activeProject = await window.saveProjectData(updatedProject, {
        dirtyFields: ['characters'],
      });
      saveMessage.textContent = 'Characters saved.';
    });
  });

  populateLinkFields();
  renderList();
  renderEditor();
});
