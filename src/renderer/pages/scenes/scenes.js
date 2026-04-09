window.initPage = async function ({ project }) {
  const activeProject = project || window.getCurrentProject();
  const emptyState = document.getElementById('scenes-empty-state');
  const content = document.getElementById('scenes-content');
  const saveButton = document.getElementById('save-scenes');
  const addButton = document.getElementById('add-scene');
  const list = document.getElementById('scenes-list');
  const saveMessage = document.getElementById('scenes-save-message');
  const editorShell = document.getElementById('scene-editor-shell');
  const editorEmpty = document.getElementById('scene-editor-empty');
  const createButton = document.getElementById('scenes-create-project');
  const chapters = activeProject?.chapters || [];

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
  document.getElementById('scenes-page-title').textContent = `${activeProject.title || 'Project'} Scenes`;

  const scenes = (activeProject.scenes || []).map((scene) => ({ ...scene }));
  let selectedId = scenes[0]?.id || '';

  const fields = {
    title: document.getElementById('scene-title'),
    tags: document.getElementById('scene-tags'),
    linkedChapterId: document.getElementById('scene-linked-chapter'),
    summary: document.getElementById('scene-summary'),
    other: document.getElementById('scene-other'),
  };

  fields.linkedChapterId.innerHTML = `
    <option value="">General scene idea</option>
    ${chapters.map((chapter) => `<option value="${chapter.id}">${chapter.title || 'Untitled Chapter'}</option>`).join('')}
  `;

  function getSelectedScene() {
    return scenes.find((scene) => scene.id === selectedId) || null;
  }

  function renderList() {
    list.innerHTML = scenes.length
      ? scenes.map((scene) => `
        <div class="entity-list-item">
          <button type="button" data-open-scene="${scene.id}">
            <strong>${scene.title || 'Untitled Scene'}</strong>
          </button>
          <span>${scene.linkedChapterId ? 'Connected' : 'General'}</span>
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
  }

  function syncScene() {
    const scene = getSelectedScene();
    if (!scene) {
      return;
    }

    scene.title = fields.title.value.trim();
    scene.tags = fields.tags.value.split(',').map((tag) => tag.trim()).filter(Boolean);
    scene.linkedChapterId = fields.linkedChapterId.value;
    scene.summary = fields.summary.value.trim();
    scene.other = fields.other.value.trim();
    document.getElementById('scene-editor-title').textContent = scene.title || 'Scene Details';
    renderList();
  }

  addButton.addEventListener('click', () => {
    const scene = {
      id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: `Scene ${scenes.length + 1}`,
      tags: [],
      linkedChapterId: '',
      summary: '',
      other: '',
    };

    scenes.push(scene);
    selectedId = scene.id;
    renderList();
    renderEditor();
  });

  Object.values(fields).forEach((field) => {
    field.addEventListener('input', syncScene);
    field.addEventListener('change', syncScene);
  });

  saveButton.addEventListener('click', async () => {
    const updatedProject = {
      ...activeProject,
      scenes,
      updatedAt: new Date().toISOString(),
    };

    await window.saveProjectData(updatedProject);
    saveMessage.textContent = 'Scenes saved.';
  });

  renderList();
  renderEditor();
};
