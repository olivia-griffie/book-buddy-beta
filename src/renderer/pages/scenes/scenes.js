window.registerPageInit('scenes', async function ({ project }) {
  function escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeSectionIds(entity) {
    const ids = Array.isArray(entity.sectionIds) ? entity.sectionIds : (entity.sectionId ? [entity.sectionId] : []);
    return { ...entity, sectionIds: ids, sectionId: ids[0] || '' };
  }

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
  const deleteButton = document.getElementById('delete-scene');
  const sectionTargetsPanel = document.getElementById('scene-section-targets-panel');
  const sectionTargetsList = document.getElementById('scene-section-targets-list');
  const sectionTargetsMessage = document.getElementById('scenes-targets-save-message');

  createButton?.addEventListener('click', () => window.navigate('create-project', { project: null }));

  if (!activeProject) {
    emptyState.style.display = 'grid';
    content.style.display = 'none';
    saveButton.style.display = 'none';
    return;
  }

  const imageInput = document.getElementById('scene-image');
  const imagePreview = document.getElementById('scene-image-preview');

  emptyState.style.display = 'none';
  content.style.display = 'grid';
  saveButton.style.display = 'inline-flex';
  const resolvedEditorPreferences = window.resolveEditorPreferences?.(activeProject) || { saveMode: 'autosave' };
  document.getElementById('scenes-page-title').textContent = 'Scenes';
  window.initializeTextEditor(content);

  const promptData = await window.getGenrePromptData();
  const resources = window.getProjectResources(activeProject, promptData);
  const plotSections = (activeProject.plotSections || resources.plotSections).map((section) => ({ ...section }));
  const chapters = (activeProject.chapters || []).map((chapter) => ({ ...chapter }));
  const scenes = (activeProject.scenes || []).map((scene) => normalizeSectionIds(scene));
  const characters = (activeProject.characters || []).map((character) => normalizeSectionIds(character));
  const locations = (activeProject.locations || []).map((location) => normalizeSectionIds(location));
  const dailyPromptHistory = (activeProject.dailyPromptHistory || []).map((entry) => ({ ...entry }));
  let selectedId = scenes[0]?.id || '';

  const fields = {
    title: document.getElementById('scene-title'),
    linkedChapterId: document.getElementById('scene-linked-chapter'),
    summary: document.getElementById('scene-summary'),
    other: document.getElementById('scene-other'),
  };

  function getSceneTagButtons() {
    return [...document.querySelectorAll('[data-scene-tag]')];
  }

  function readSceneTags() {
    return getSceneTagButtons()
      .filter((btn) => btn.getAttribute('aria-pressed') === 'true')
      .map((btn) => btn.dataset.sceneTag);
  }

  function applySceneTags(tags) {
    const active = new Set(tags || []);
    getSceneTagButtons().forEach((btn) => {
      const selected = active.has(btn.dataset.sceneTag);
      btn.classList.toggle('is-selected', selected);
      btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  }
  const autosave = window.createAutosaveController(async () => {
    activeProject = await window.saveProjectData(buildProjectPayload(), {
      dirtyFields: ['plotSections', 'chapters', 'characters', 'scenes', 'locations', 'dailyPromptHistory', 'currentWordCount'],
    });
    saveMessage.textContent = 'Scenes autosaved.';
  }, {
    dirtyText: 'Scene changes not saved',
    mode: resolvedEditorPreferences.saveMode,
  });
  window.registerBeforeNavigate(async () => {
    await autosave.flush();
  });

  function getSelectedScene() {
    return scenes.find((scene) => scene.id === selectedId) || null;
  }

  function getNextChapterNumber() {
    const explicitNumbers = chapters
      .map((chapter) => {
        const match = String(chapter.title || '').match(/chapter\s+(\d+)/i);
        return match ? Number(match[1]) : 0;
      })
      .filter(Boolean);

    return explicitNumbers.length
      ? Math.max(...explicitNumbers) + 1
      : chapters.length + 1;
  }

  function getEntityCollection(type) {
    if (type === 'characters') {
      return characters;
    }
    if (type === 'scenes') {
      return scenes;
    }
    return locations;
  }

  function getEntityLabel(type, entity) {
    if (type === 'characters') {
      return entity.name || 'Unnamed Character';
    }
    if (type === 'scenes') {
      return entity.title || 'Untitled Scene';
    }
    return entity.name || 'Untitled Location';
  }

  function renderSectionLinkCard(type, label, sectionId) {
    const collection = getEntityCollection(type);
    const linkedItems = collection.filter((entity) => (entity.sectionIds || []).includes(sectionId));
    const selectableItems = collection.filter((entity) => !(entity.sectionIds || []).includes(sectionId));
    const singularLabel = label.endsWith('s') ? label.slice(0, -1) : label;

    return `
      <div class="plot-section-link-card">
        <div class="plot-section-link-head">
          <div>
            <h4>${label}</h4>
            <p>${linkedItems.length ? `${linkedItems.length} linked here` : `No ${label.toLowerCase()} linked yet`}</p>
          </div>
          <span class="plot-section-link-count">${linkedItems.length}</span>
        </div>
        <div class="plot-section-linked-list">
          ${linkedItems.length
      ? linkedItems.map((entity) => `
                <span class="plot-section-linked-chip">
                  <span>${escapeHtml(getEntityLabel(type, entity))}</span>
                  <button class="plot-section-chip-remove" type="button" data-unlink-entity="${type}" data-unlink-id="${entity.id}" data-unlink-section="${sectionId}">&times;</button>
                </span>
              `).join('')
      : '<span class="plot-section-link-empty">None linked yet.</span>'}
        </div>
        <div class="field">
          <label>Add ${singularLabel}</label>
          <select data-link-entity="${type}" data-link-section="${sectionId}">
            <option value="">Choose ${singularLabel.toLowerCase()}</option>
            ${selectableItems.map((entity) => `
              <option value="${entity.id}">${escapeHtml(getEntityLabel(type, entity))}</option>
            `).join('')}
          </select>
        </div>
      </div>
    `;
  }

  function buildProjectPayload() {
    return {
      ...activeProject,
      plotSections,
      chapters,
      scenes,
      characters,
      locations,
      dailyPromptHistory,
      currentWordCount: chapters.reduce(
        (sum, chapter) => sum + window.computeWordCount(chapter.content || ''),
        0,
      ),
      updatedAt: new Date().toISOString(),
    };
  }

  function populateLinkedChapterSelect() {
    const currentValue = fields.linkedChapterId.value;
    fields.linkedChapterId.innerHTML = `
      <option value="">General scene idea</option>
      ${chapters.map((chapter) => `<option value="${chapter.id}">${escapeHtml(chapter.title || 'Untitled Chapter')}</option>`).join('')}
    `;
    fields.linkedChapterId.value = chapters.some((chapter) => chapter.id === currentValue) ? currentValue : '';
  }

  function renderImagePreview(image) {
    imagePreview.innerHTML = image
      ? `<img src="${image}" alt="Scene reference" />`
      : '<span class="placeholder-icon">Scene</span>';
  }

  let dragSrcId = null;

  function attachDragHandlers(items, getId, getArray) {
    items.forEach((item) => {
      item.setAttribute('draggable', 'true');

      item.addEventListener('dragstart', (e) => {
        dragSrcId = getId(item);
        item.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      item.addEventListener('dragend', () => {
        dragSrcId = null;
        item.classList.remove('is-dragging');
        items.forEach((el) => el.classList.remove('drag-above', 'drag-below'));
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        items.forEach((el) => el.classList.remove('drag-above', 'drag-below'));
        const { top, height } = item.getBoundingClientRect();
        item.classList.add(e.clientY < top + height / 2 ? 'drag-above' : 'drag-below');
      });

      item.addEventListener('dragleave', (e) => {
        if (!item.contains(e.relatedTarget)) {
          item.classList.remove('drag-above', 'drag-below');
        }
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        const tgtId = getId(item);
        if (!dragSrcId || dragSrcId === tgtId) return;
        const arr = getArray();
        const srcIdx = arr.findIndex((x) => x.id === dragSrcId);
        const [moved] = arr.splice(srcIdx, 1);
        const { top, height } = item.getBoundingClientRect();
        const insertAfter = e.clientY >= top + height / 2;
        const tgtIdx = arr.findIndex((x) => x.id === tgtId);
        arr.splice(insertAfter ? tgtIdx + 1 : tgtIdx, 0, moved);
        autosave.touch();
        renderList();
      });
    });
  }

  function renderList() {
    list.innerHTML = scenes.length
      ? scenes.map((scene) => `
        <div class="entity-list-item" data-scene-id="${scene.id}">
          <span class="drag-handle" title="Drag to reorder" aria-hidden="true"></span>
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

    attachDragHandlers(
      [...list.querySelectorAll('[data-scene-id]')],
      (el) => el.dataset.sceneId,
      () => scenes,
    );
  }

  function renderEditor() {
    const scene = getSelectedScene();
    populateLinkedChapterSelect();
    if (!scene) {
      editorShell.style.display = 'none';
      editorEmpty.style.display = 'block';
      document.getElementById('scene-editor-title').textContent = 'Select a scene';
      if (deleteButton) {
        deleteButton.style.display = 'none';
      }
      renderImagePreview('');
      return;
    }

    editorShell.style.display = 'block';
    editorEmpty.style.display = 'none';
    document.getElementById('scene-editor-title').textContent = scene.title || 'Scene Details';
    if (deleteButton) {
      deleteButton.style.display = 'inline-flex';
    }
    fields.title.value = scene.title || '';
    applySceneTags(scene.tags || []);
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
    scene.tags = readSceneTags();
    scene.linkedChapterId = fields.linkedChapterId.value;
    scene.summary = String(window.getEditorFieldValue(fields.summary) || '').trim();
    scene.other = String(window.getEditorFieldValue(fields.other) || '').trim();
    document.getElementById('scene-editor-title').textContent = scene.title || 'Scene Details';
    renderList();
    renderSectionTargets();
    autosave.touch();
  }

  function renderSectionTargets() {
    if (!sectionTargetsList) {
      return;
    }

    sectionTargetsList.innerHTML = plotSections
      .map((section) => {
        const sectionChapters = chapters.filter((chapter) => chapter.sectionId === section.id);
        const sectionWords = sectionChapters.reduce(
          (sum, chapter) => sum + window.computeWordCount(chapter.content || ''),
          0,
        );
        return `
          <details class="plot-section-item bb-collapse" data-section-id="${section.id}">
            <summary class="plot-section-toggle">
              <div class="plot-section-toggle-copy">
                <h3>${escapeHtml(section.label)}</h3>
                <p>${sectionWords.toLocaleString()} words across ${sectionChapters.length} chapter${sectionChapters.length === 1 ? '' : 's'}</p>
              </div>
              <span class="plot-section-toggle-indicator" aria-hidden="true">&#8964;</span>
            </summary>
            <div class="plot-section-body">
              <div class="plot-section-head">
                <div class="field">
                  <label>Plot area target words</label>
                  <input type="number" min="0" step="100" value="${section.targetWords || 0}" data-target-section="${section.id}" />
                </div>
              </div>
              <div class="chapter-list">
                ${sectionChapters.length
                  ? sectionChapters
                    .map((chapter) => `
                      <div class="chapter-row" data-open-chapter="${chapter.id}">
                        <div class="chapter-row-main">
                          <input
                            class="chapter-title-inline"
                            type="text"
                            value="${escapeHtml(chapter.title || '')}"
                            placeholder="Chapter title"
                            data-title-chapter="${chapter.id}"
                          />
                        </div>
                        <div class="chapter-row-foot">
                          <span class="chapter-row-word-count">${window.computeWordCount(chapter.content || '')} words</span>
                          <div class="chapter-row-actions">
                            <button class="chapter-row-delete" type="button" data-delete-chapter="${chapter.id}" aria-label="Delete ${escapeHtml(chapter.title || 'chapter')}" title="Delete chapter">&times;</button>
                          </div>
                        </div>
                      </div>
                    `)
                    .join('')
                  : '<p>No chapters yet for this section.</p>'}
              </div>
              <button class="btn btn-ghost add-chapter plot-section-add-chapter" type="button" data-section="${section.id}">Add Chapter</button>
              <div class="plot-section-links">
                <div class="plot-section-links-grid">
                  ${renderSectionLinkCard('characters', 'Characters', section.id)}
                  ${renderSectionLinkCard('scenes', 'Scenes', section.id)}
                  ${renderSectionLinkCard('locations', 'Locations', section.id)}
                </div>
              </div>
            </div>
          </details>
        `;
      })
      .join('');

    sectionTargetsList.querySelectorAll('details.plot-section-item').forEach((details) => {
      const containsSelectedScene = scenes
        .find((scene) => scene.id === selectedId)
        ?.sectionIds
        ?.includes(details.dataset.sectionId);
      window.bindPersistentDetailsState?.(details, {
        projectId: activeProject.id,
        sectionId: `scenes-section-${details.dataset.sectionId}`,
        defaultOpen: Boolean(containsSelectedScene),
      });
      if (containsSelectedScene) {
        details.open = true;
      }
    });

    sectionTargetsList.querySelectorAll('[data-target-section]').forEach((input) => {
      input.addEventListener('input', () => {
        const section = plotSections.find((entry) => entry.id === input.dataset.targetSection);
        if (section) {
          section.targetWords = Number(input.value || 0);
          autosave.touch();
        }
      });
    });

    sectionTargetsList.querySelectorAll('[data-open-chapter]').forEach((row) => {
      row.addEventListener('click', () => {
        window.navigate('chapters', { project: buildProjectPayload() });
      });
    });

    sectionTargetsList.querySelectorAll('[data-title-chapter]').forEach((input) => {
      input.addEventListener('input', () => {
        const chapter = chapters.find((entry) => entry.id === input.dataset.titleChapter);
        if (!chapter) {
          return;
        }

        chapter.title = input.value.trim();
        populateLinkedChapterSelect();
        autosave.touch();
      });

      input.addEventListener('click', (event) => {
        event.stopPropagation();
      });

      input.addEventListener('focus', (event) => {
        event.stopPropagation();
      });
    });

    sectionTargetsList.querySelectorAll('[data-delete-chapter]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const chapterId = button.dataset.deleteChapter;
        const chapterIndex = chapters.findIndex((entry) => entry.id === chapterId);
        if (chapterIndex === -1) {
          return;
        }

        const chapter = chapters[chapterIndex];
        const confirmed = window.confirm(`Delete "${chapter.title || 'this chapter'}"? This cannot be undone.`);
        if (!confirmed) {
          return;
        }

        chapters.splice(chapterIndex, 1);
        scenes.forEach((scene) => {
          if (scene.linkedChapterId === chapterId) {
            scene.linkedChapterId = '';
          }
        });
        characters.forEach((character) => {
          if (character.chapterIntro === chapterId) {
            character.chapterIntro = '';
          }
        });
        dailyPromptHistory.forEach((entry) => {
          if (entry.assignedChapterId === chapterId) {
            entry.assignedChapterId = '';
          }
        });

        sectionTargetsMessage.textContent = 'Chapter deleted.';
        populateLinkedChapterSelect();
        autosave.touch();
        renderList();
        renderEditor();
        renderSectionTargets();
      });
    });

    sectionTargetsList.querySelectorAll('.add-chapter').forEach((button) => {
      button.addEventListener('click', () => {
        const nextChapterNumber = getNextChapterNumber();
        const newChapter = {
          id: `chapter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: `Chapter ${nextChapterNumber}`,
          sectionId: button.dataset.section,
          targetWords: 0,
          content: '',
        };

        chapters.push(newChapter);
        populateLinkedChapterSelect();
        autosave.touch();
        renderSectionTargets();
      });
    });

    sectionTargetsList.querySelectorAll('[data-link-entity]').forEach((input) => {
      input.addEventListener('change', () => {
        if (!input.value) {
          return;
        }

        const collection = getEntityCollection(input.dataset.linkEntity);
        const entity = collection.find((entry) => entry.id === input.value);
        if (!entity) {
          return;
        }

        const ids = entity.sectionIds || [];
        if (!ids.includes(input.dataset.linkSection)) {
          entity.sectionIds = [...ids, input.dataset.linkSection];
          entity.sectionId = entity.sectionIds[0];
        }
        autosave.touch();
        renderList();
        renderEditor();
        renderSectionTargets();
      });
    });

    sectionTargetsList.querySelectorAll('[data-unlink-entity]').forEach((button) => {
      button.addEventListener('click', () => {
        const collection = getEntityCollection(button.dataset.unlinkEntity);
        const entity = collection.find((entry) => entry.id === button.dataset.unlinkId);
        if (!entity) {
          return;
        }

        entity.sectionIds = (entity.sectionIds || []).filter((id) => id !== button.dataset.unlinkSection);
        entity.sectionId = entity.sectionIds[0] || '';
        autosave.touch();
        renderList();
        renderEditor();
        renderSectionTargets();
      });
    });
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
      sectionIds: [],
      sectionId: '',
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

  document.getElementById('scene-editor-shell').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-scene-tag]');
    if (!btn) return;
    const pressed = btn.getAttribute('aria-pressed') === 'true';
    btn.setAttribute('aria-pressed', pressed ? 'false' : 'true');
    btn.classList.toggle('is-selected', !pressed);
    syncScene();
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

  deleteButton?.addEventListener('click', () => {
    const scene = getSelectedScene();
    if (!scene) {
      return;
    }

    const confirmed = window.confirm(`Delete "${scene.title || 'this scene'}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    const index = scenes.findIndex((entry) => entry.id === scene.id);
    if (index === -1) {
      return;
    }

    scenes.splice(index, 1);
    characters.forEach((character) => {
      if (character.deathScene === scene.id) {
        character.deathScene = '';
      }
      if (character.romanceScenes === scene.id) {
        character.romanceScenes = '';
      }
    });
    selectedId = scenes[Math.max(0, index - 1)]?.id || scenes[0]?.id || '';
    saveMessage.textContent = 'Scene deleted.';
    autosave.touch();
    renderList();
    renderEditor();
  });

  saveButton.addEventListener('click', async () => {
    await window.runButtonFeedback(saveButton, async () => {
      activeProject = await window.saveProjectData(buildProjectPayload(), {
        dirtyFields: ['plotSections', 'chapters', 'characters', 'scenes', 'locations', 'dailyPromptHistory', 'currentWordCount'],
      });
      saveMessage.textContent = 'Scenes saved.';
    });
  });

  window.bindPersistentDetailsState?.(sectionTargetsPanel, {
    projectId: activeProject.id,
    sectionId: 'scenes-section-targets-panel',
    defaultOpen: true,
  });
  populateLinkedChapterSelect();
  renderList();
  renderEditor();
  renderSectionTargets();
});
