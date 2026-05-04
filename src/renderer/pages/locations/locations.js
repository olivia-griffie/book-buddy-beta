window.registerPageInit('locations', async function ({ project }) {
  let activeProject = project || window.getCurrentProject();
  const emptyState = document.getElementById('locations-empty-state');
  const content = document.getElementById('locations-content');
  const saveButton = document.getElementById('save-locations');
  const addButton = document.getElementById('add-location');
  const list = document.getElementById('locations-list');
  const saveMessage = document.getElementById('locations-save-message');
  const editorShell = document.getElementById('location-editor-shell');
  const editorEmpty = document.getElementById('location-editor-empty');
  const createButton = document.getElementById('locations-create-project');
  const deleteButton = document.getElementById('delete-location');

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
  const resolvedEditorPreferences = window.resolveEditorPreferences?.(activeProject) || { saveMode: 'autosave' };
  document.getElementById('locations-page-title').textContent = `${activeProject.title || 'Project'} Locations`;
  window.initializeTextEditor(content);

  const locations = (activeProject.locations || []).map((location) => ({ ...location }));
  let selectedId = locations[0]?.id || '';

  // ── World map state (wired after autosave is defined below) ──────────────
  let worldMap = { image: '', notes: '', ...(activeProject.worldMap || {}) };
  const worldMapInput = document.getElementById('world-map-input');
  const worldMapTrigger = document.getElementById('world-map-trigger');
  const worldMapPreview = document.getElementById('world-map-preview');
  const worldMapClear = document.getElementById('world-map-clear');
  const worldMapNotes = document.getElementById('world-map-notes');

  worldMapNotes.value = worldMap.notes || '';

  function renderWorldMapPreview() {
    if (worldMap.image) {
      worldMapPreview.innerHTML = `
        <img src="${worldMap.image}" alt="World map" class="world-map-img" />
        <button type="button" class="world-map-img-change" id="world-map-img-change-btn" aria-label="Change world map image">Change image</button>
      `;
      worldMapClear.style.display = 'inline-flex';
      document.getElementById('world-map-img-change-btn')?.addEventListener('click', () => worldMapInput.click());
    } else {
      worldMapPreview.innerHTML = `
        <button type="button" id="world-map-trigger-inner" class="world-map-upload-area" aria-label="Upload world map image">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="32" height="32" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span>Click to upload world map</span>
          <span class="world-map-upload-hint">PNG, JPG, or any image format</span>
        </button>
      `;
      worldMapClear.style.display = 'none';
      document.getElementById('world-map-trigger-inner')?.addEventListener('click', () => worldMapInput.click());
    }
  }

  renderWorldMapPreview();
  worldMapTrigger?.addEventListener('click', () => worldMapInput.click());

  const fields = {
    name: document.getElementById('location-name'),
    type: document.getElementById('location-type'),
    temperature: document.getElementById('location-temperature'),
    climate: document.getElementById('location-climate'),
    season: document.getElementById('location-season'),
    timeOfDay: document.getElementById('location-time-of-day'),
    socialDynamic: document.getElementById('location-social-dynamic'),
    other: document.getElementById('location-other'),
  };
  const autosave = window.createAutosaveController(async () => {
    activeProject = await window.saveProjectData({
      ...activeProject,
      locations,
      worldMap,
      updatedAt: new Date().toISOString(),
    }, {
      dirtyFields: ['locations', 'worldMap'],
    });
    saveMessage.textContent = 'Locations autosaved.';
  }, {
    dirtyText: 'Location changes not saved',
    mode: resolvedEditorPreferences.saveMode,
  });
  window.registerBeforeNavigate(async () => {
    await autosave.flush();
  });

  worldMapInput?.addEventListener('change', () => {
    const file = worldMapInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      worldMap.image = e.target.result;
      renderWorldMapPreview();
      autosave.touch();
    };
    reader.readAsDataURL(file);
    worldMapInput.value = '';
  });

  worldMapClear?.addEventListener('click', () => {
    worldMap.image = '';
    renderWorldMapPreview();
    autosave.touch();
  });

  worldMapNotes?.addEventListener('input', () => {
    worldMap.notes = worldMapNotes.value;
    autosave.touch();
  });

  function getSelectedLocation() {
    return locations.find((location) => location.id === selectedId) || null;
  }

  function renderList() {
    list.innerHTML = locations.length
      ? locations.map((location) => `
        <div class="entity-list-item">
          <button type="button" data-open-location="${location.id}">
            <strong>${location.name || 'Untitled Location'}</strong>
          </button>
          <span>${location.type || 'General Area'}</span>
        </div>
      `).join('')
      : '<p>No locations yet.</p>';

    list.querySelectorAll('[data-open-location]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedId = button.dataset.openLocation;
        renderEditor();
      });
    });
  }

  function renderEditor() {
    const location = getSelectedLocation();
    if (!location) {
      editorShell.style.display = 'none';
      editorEmpty.style.display = 'block';
      document.getElementById('location-editor-title').textContent = 'Select a location';
      if (deleteButton) {
        deleteButton.style.display = 'none';
      }
      return;
    }

    editorShell.style.display = 'block';
    editorEmpty.style.display = 'none';
    document.getElementById('location-editor-title').textContent = location.name || 'Location Profile';
    if (deleteButton) {
      deleteButton.style.display = 'inline-flex';
    }
    Object.entries(fields).forEach(([key, field]) => {
      field.value = location[key] || (key === 'type' ? 'Country' : '');
      window.refreshTextEditor(field, field.value);
    });
  }

  function syncLocation() {
    const location = getSelectedLocation();
    if (!location) {
      return;
    }

    Object.entries(fields).forEach(([key, field]) => {
      location[key] = String(window.getEditorFieldValue(field) || '').trim();
    });

    document.getElementById('location-editor-title').textContent = location.name || 'Location Profile';
    renderList();
    autosave.touch();
  }

  addButton.addEventListener('click', () => {
    const location = {
      id: `location-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: `Location ${locations.length + 1}`,
      type: 'Country',
      temperature: '',
      climate: '',
      season: '',
      timeOfDay: '',
      socialDynamic: '',
      other: '',
    };

    locations.push(location);
    selectedId = location.id;
    autosave.touch();
    renderList();
    renderEditor();
  });

  Object.values(fields).forEach((field) => {
    field.addEventListener('input', syncLocation);
    field.addEventListener('change', syncLocation);
  });

  saveButton.addEventListener('click', async () => {
    await window.runButtonFeedback(saveButton, async () => {
      const updatedProject = {
        ...activeProject,
        locations,
        worldMap,
        updatedAt: new Date().toISOString(),
      };

      activeProject = await window.saveProjectData(updatedProject, {
        dirtyFields: ['locations'],
      });
      saveMessage.textContent = 'Locations saved.';
    });
  });

  deleteButton?.addEventListener('click', () => {
    const location = getSelectedLocation();
    if (!location) {
      return;
    }

    const confirmed = window.confirm(`Delete "${location.name || 'this location'}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    const index = locations.findIndex((entry) => entry.id === location.id);
    if (index === -1) {
      return;
    }

    locations.splice(index, 1);
    selectedId = locations[Math.max(0, index - 1)]?.id || locations[0]?.id || '';
    saveMessage.textContent = 'Location deleted.';
    autosave.touch();
    renderList();
    renderEditor();
  });

  renderList();
  renderEditor();
});
