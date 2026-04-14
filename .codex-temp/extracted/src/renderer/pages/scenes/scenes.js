window.initPage = async function ({ project }) {
  let activeProject = project || window.getCurrentProject();
  const emptyState = document.getElementById('scenes-empty-state');
  const content = document.getElementById('scenes-content');
  const saveButton = document.getElementById('save-scenes');
  const addButton = document.getElementById('add-scene');
  const imageTrigger = document.getElementById('scene-image-trigger');
  const list = document.getElementById('scenes-list');
  const saveMessage = document.getElementById('scenes-save-message');
  const editorShell = document.getElementById('scene-editor-shell');
  const editorEmpty = document.getElementById('scene-editor-empty');
  const createButton = document.getElementById('scenes-create-project');

  createButton?.addEventListener('click', () => window.navigate('create-project', { project: null }));

  if (!activeProject) {
    emptyState.style.display = 'grid';
    content.style.display = 'none';
    saveButton.style.display = 'none';
    return;
  }

  const chapters = activeProject.chapters || [];
  const imageInput = document.getElementById('scene-image');
  const imagePreview = document.getElementById('scene-image-preview');

  emptyState.style.display = 'none';
  content.style.display = 'grid';
  saveButton.style.display = 'inline-flex';
  document.getElementById('scenes-page-title').textContent = `${activeProject.title || 'Project'} Scenes`;
  window.initializeTextEditor(content);

  const scenes = (activeProject.scenes || []).map((scene) => ({ ...scene }));
  let selectedId = scenes[0]?.id || '';

  const fields = {
    title: document.getElementById('scene-title'),
    tags: document.getElementById('scene-tags'),
    linkedChapterId: document.getElementById('scene-linked-chapter'),
    summary: document.getElementById('scene-summary'),
    other: document.getElementById('scene-other'),
  };
  const autosave = window.createAutosaveController(async () => {
    activeProject = await window.saveProjectData({
      ...activeProject,
      scenes,
      updatedAt: new Date().toISOString(),
    }, {
      dirtyFields: ['scenes'],
    });
    saveMessage.textContent = 'Scenes autosaved.';
  }, {
    dirtyText: 'Scene changes not saved',
  });

  fields.linkedChapterId.innerHTML = `
    <option value="">General scene idea</option>
    ${chapters.map((chapter) => `<option value="${chapter.id}">${chapter.title || 'Untitled Chapter'}</option>`).join('')}
  `;

  function getSelectedScene() {
    return scenes.find((scene) => scene.id === selectedId) || null;
  }

  function renderImagePreview(image) {
    imagePreview.innerHTML = image
      ? `<img src="${image}" alt="Scene reference" />`
      : '<span class="placeholder-icon">Scene</span>';
  }

  function renderList() {
    list.innerHTML = scenes.length
      ? scenes.map((scene) => `
        <div class="entity-list-item">
          <button type="button" data-open-scene="${scene.id}">
            <strong>${scene.title || 'Untitled Scene'}</strong>
          </button>
          <span>${scene.image ? 'Image ready' : scene.linkedChapterId ? 'Connected' : 'General'}</span>
        </div>
      `).join('')
      : '<p>No scenes yet.</p>';

    list.querySelectorAll('[data-open-scene]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedId = button.dataset.openScene;
        renderEditor();
      });
    });
  }

  function renderEditor() {
    const scene = getSelectedScene();
    if (!scene) {
      editorShell.style.display = 'none';
      editorEmpty.style.display = 'block';
      document.getElementById('scene-editor-title').textContent = 'Select a scene';
      renderImagePreview('');
      return;
    }

    editorShell.style.display = 'block';
    editorEmpty.style.display = 'none';
    document.getElementById('scene-editor-title').textContent = scene.title || 'Scene Details';
    fields.title.value = scene.title || '';
    fields.tags.value = (scene.tags || []).join(', ');
    fields.linkedChapterId.value = scene.linkedChapterId || '';
    fields.summary.value = scene.summary || '';
    fields.other.value = scene.other || '';
    window.refreshTextEditor(fields.summary, fields.summary.value);
    window.refreshTextEditor(fields.other, fields.other.value);
    imageInput.value = '';
    renderImagePreview(scene.image || '');
  }

  function syncScene() {
    const scene = getSelectedScene();
    if (!scene) {
      return;
    }

    scene.title = fields.title.value.trim();
    scene.tags = fields.tags.value.split(',').map((tag) => tag.trim()).filter(Boolean);
    scene.linkedChapterId = fields.linkedChapterId.value;
    scene.summary = String(window.getEditorFieldValue(fields.summary) || '').trim();
    scene.other = String(window.getEditorFieldValue(fields.other) || '').trim();
    document.getElementById('scene-editor-title').textContent = scene.title || 'Scene Details';
    renderList();
    autosave.touch();
  }

  async function readImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read the selected scene image.'));
      reader.readAsDataURL(file);
    });
  }

  addButton.addEventListener('click', () => {
    const scene = {
      id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: `Scene ${scenes.length + 1}`,
      image: '',
      tags: [],
      linkedChapterId: '',
      summary: '',
      other: '',
    };

    scenes.push(scene);
    selectedId = scene.id;
    autosave.touch();
    renderList();
    renderEditor();
  });

  Object.values(fields).forEach((field) => {
    field.addEventListener('input', syncScene);
    field.addEventListener('change', syncScene);
  });

  imageInput.addEventListener('change', async (event) => {
    const scene = getSelectedScene();
    const file = event.target.files?.[0];
    if (!scene || !file) {
      return;
    }

    try {
      scene.image = await readImage(file);
      renderImagePreview(scene.image);
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
        scenes,
        updatedAt: new Date().toISOString(),
      };

      activeProject = await window.saveProjectData(updatedProject, {
        dirtyFields: ['scenes'],
      });
      saveMessage.textContent = 'Scenes saved.';
    });
  });

  renderList();
  renderEditor();
};
