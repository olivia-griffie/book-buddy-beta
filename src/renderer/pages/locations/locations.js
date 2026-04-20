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
      updatedAt: new Date().toISOString(),
    }, {
      dirtyFields: ['locations'],
    });
    saveMessage.textContent = 'Locations autosaved.';
  }, {
    dirtyText: 'Location changes not saved',
    mode: resolvedEditorPreferences.saveMode,
  });
  window.registerBeforeNavigate(async () => {
    await autosave.flush();
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
