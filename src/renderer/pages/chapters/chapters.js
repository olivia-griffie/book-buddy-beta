window.registerPageInit('chapters', async function ({ project, chapterId }) {
  function escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function excerptRichText(value = '', fallback = 'No details yet.') {
    const parsed = window.parseRichTextValue(value || '');
    const temp = document.createElement('div');
    temp.innerHTML = parsed.html || '';
    const text = (temp.textContent || temp.innerText || '').trim().replace(/\s+/g, ' ');
    if (!text) {
      return fallback;
    }

    return text.length > 320 ? `${text.slice(0, 317)}...` : text;
  }

  let activeProject = project || window.getCurrentProject();
  let publishedChapterIds = new Set(activeProject?.publishedChapterIds || []);
  const emptyState = document.getElementById('chapters-empty-state');
  const content = document.getElementById('chapters-content');
  const saveButton = document.getElementById('save-chapters');
  const saveTopButton = document.getElementById('save-chapters-top');
  const exportButton = document.getElementById('export-chapters');
  const createButton = document.getElementById('chapters-create-project');
  const plotSectionsPanel = document.getElementById('plot-sections-panel');
  const sectionsList = document.getElementById('plot-sections-list');
  const saveMessage = document.getElementById('chapters-save-message');
  const editorShell = document.getElementById('chapter-editor-shell');
  const editorEmpty = document.getElementById('chapter-editor-empty');
  const titleInput = document.getElementById('chapter-title');
  const sectionSelect = document.getElementById('chapter-section');
  const targetWordsInput = document.getElementById('chapter-target-words');
  const fontFamilyInput = document.getElementById('chapter-font-family');
  const fontSizeInput = document.getElementById('chapter-font-size');
  const lineHeightInput = document.getElementById('chapter-line-height');
  const currentWordsInput = document.getElementById('chapter-current-words');
  const contentInput = document.getElementById('chapter-content');
  const chapterSelectDropdown = document.getElementById('chapter-select-dropdown');
  const chapterSelectedSection = document.getElementById('chapter-selected-section');
  const chapterProgressCard = document.querySelector('.chapter-progress-card');
  const chapterPromptList = document.getElementById('chapter-prompt-list');
  const chapterPromptEmpty = document.getElementById('chapter-prompt-empty');
  const chapterPromptMessage = document.getElementById('chapter-prompt-message');
  const chapterProgressPercent = document.getElementById('chapter-progress-percent');
  const chapterProgressState = document.getElementById('chapter-progress-state');
  const chapterProgressCaption = document.getElementById('chapter-progress-caption');
  const chapterProgressFill = document.getElementById('chapter-progress-fill');
  const chapterProgressIcon = document.getElementById('chapter-progress-icon');
  const chapterPublishStatus = document.getElementById('chapter-publish-status');
  const chapterPublishToggle = document.getElementById('chapter-publish-toggle');
  const contextContent = document.getElementById('chapter-context-content');
  const contextTabs = [...document.querySelectorAll('[data-context-tab]')];

  const chapterEditorCard = document.querySelector('#chapters-content > section');
  const chapterEditorHeadToggle = document.getElementById('chapter-editor-head-toggle');
  const chapterEditorCollapseKey = 'collapse:chapters:editor-card';

  function setChapterEditorCollapsed(collapsed) {
    chapterEditorCard.classList.toggle('is-collapsed', collapsed);
    chapterEditorHeadToggle.setAttribute('aria-expanded', String(!collapsed));
    const chevron = chapterEditorHeadToggle.querySelector('.chapter-editor-collapse-chevron');
    if (chevron) chevron.textContent = collapsed ? '▸' : '▾';
    localStorage.setItem(chapterEditorCollapseKey, collapsed ? '1' : '0');
  }

  setChapterEditorCollapsed(true);

  chapterEditorHeadToggle?.addEventListener('click', (e) => {
    if (e.target.closest('select, button, input')) return;
    setChapterEditorCollapsed(!chapterEditorCard.classList.contains('is-collapsed'));
  });

  chapterEditorHeadToggle?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setChapterEditorCollapsed(!chapterEditorCard.classList.contains('is-collapsed'));
    }
  });

  createButton?.addEventListener('click', () => window.navigate('create-project', { project: null }));

  if (!activeProject) {
    emptyState.style.display = 'grid';
    content.style.display = 'none';
    saveButton.style.display = 'none';
    saveTopButton.style.display = 'none';
    exportButton.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  content.style.display = 'grid';
  saveButton.style.display = 'inline-flex';
  saveTopButton.style.display = 'inline-flex';
  exportButton.style.display = 'inline-flex';
  document.getElementById('chapters-page-title').textContent = 'Chapters';
  document.getElementById('chapters-page-subtitle').textContent = 'Set section targets, add chapters, and draft in a simple focused editor.';
  function getResolvedEditorPreferences(projectOverride = activeProject) {
    return window.resolveEditorPreferences?.(projectOverride) || {
      saveMode: 'autosave',
      fontFamily: 'serif',
      fontSize: 18,
      lineHeight: 1.7,
    };
  }

  const resolvedEditorPreferences = getResolvedEditorPreferences();

  const promptData = await window.getGenrePromptData();
  const resources = window.getProjectResources(activeProject, promptData);
  const plotSections = (activeProject.plotSections || resources.plotSections).map((section) => ({ ...section }));
  const chapters = (activeProject.chapters || []).map((chapter) => {
    const {
      fontFamily: legacyFontFamily,
      fontSize: legacyFontSize,
      lineHeight: legacyLineHeight,
      ...rest
    } = chapter || {};
    return { ...rest };
  });
  function normalizeSectionIds(entity) {
    const ids = Array.isArray(entity.sectionIds) ? entity.sectionIds : (entity.sectionId ? [entity.sectionId] : []);
    return { ...entity, sectionIds: ids, sectionId: ids[0] || '' };
  }
  const characters = (activeProject.characters || []).map((c) => normalizeSectionIds(c));
  const scenes = (activeProject.scenes || []).map((s) => normalizeSectionIds(s));
  const locations = (activeProject.locations || []).map((l) => normalizeSectionIds(l));
  const dailyPromptHistory = (activeProject.dailyPromptHistory || []).map((entry) => ({
    answer: '',
    answerInsertedAt: '',
    ...entry,
  }));
  const contextState = {
    tab: 'plot',
  };
  const chapterProjectDirtyFields = ['plotSections', 'chapters', 'characters', 'scenes', 'locations', 'dailyPromptHistory', 'publishedChapterIds', 'currentWordCount', 'dailyWordHistory', 'dailySessionHistory', 'streakState', 'lastSessionMeta', 'lastEditedChapterId'];
  const autosave = window.createAutosaveController(async () => {
    const updatedProject = buildProjectPayload();
    activeProject = await window.saveProjectData(updatedProject, {
      dirtyFields: chapterProjectDirtyFields,
    });
    saveMessage.textContent = 'Chapter changes autosaved.';
  }, {
    dirtyText: 'Chapter changes not saved',
    mode: resolvedEditorPreferences.saveMode,
  });
  window.registerBeforeNavigate(async () => {
    flushPromptAnswers();
    await autosave.flush();
  });

  function bindChapterPanelState() {
    content.querySelectorAll('[data-chapter-panel]').forEach((details) => {
      window.bindPersistentDetailsState?.(details, {
        projectId: activeProject.id,
        sectionId: `chapters-panel-${details.dataset.chapterPanel}`,
        defaultOpen: details.dataset.chapterPanel === 'context',
      });
    });

    if (plotSectionsPanel) {
      const plotSectionsPanelKey = window.bindPersistentDetailsState?.(plotSectionsPanel, {
        projectId: activeProject.id,
        sectionId: 'chapters-section-targets-panel',
        defaultOpen: false,
      });
      plotSectionsPanel.open = false;
      if (plotSectionsPanelKey) {
        localStorage.setItem(plotSectionsPanelKey, '0');
      }
    }
  }

  const preferredChapterIds = [
    chapterId,
    activeProject.lastEditedChapterId,
    ...(Array.isArray(activeProject.lastSessionMeta?.chapterIds) ? activeProject.lastSessionMeta.chapterIds : []),
  ].filter(Boolean);
  let selectedChapterId = preferredChapterIds.find((id) => chapters.some((chapter) => chapter.id === id))
    || chapters[0]?.id
    || '';

  function selectChapter(chapterIdToSelect, { touch = false } = {}) {
    if (!chapterIdToSelect || !chapters.some((chapter) => chapter.id === chapterIdToSelect)) {
      return false;
    }

    selectedChapterId = chapterIdToSelect;
    activeProject = {
      ...activeProject,
      lastEditedChapterId: selectedChapterId,
      lastSessionMeta: {
        ...(activeProject.lastSessionMeta || {}),
        chapterIds: [selectedChapterId],
        source: 'chapters',
      },
    };

    if (touch) {
      autosave.touch();
    }

    return true;
  }
  selectChapter(selectedChapterId);

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

  function getSelectedChapter() {
    return chapters.find((chapter) => chapter.id === selectedChapterId) || null;
  }

  function getChapterPrompts() {
    return dailyPromptHistory.filter((entry) => {
      if (!selectedChapterId) {
        return false;
      }

      return !entry.assignedChapterId || entry.assignedChapterId === selectedChapterId;
    });
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
                  <button class="plot-section-chip-remove" type="button" data-unlink-entity="${type}" data-unlink-id="${entity.id}" data-unlink-section="${sectionId}">×</button>
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

  function setProgress(currentWords, targetWords) {
    const goal = Number(targetWords || 0);
    const current = Number(currentWords || 0);
    const percent = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;
    const completed = goal > 0 && current >= goal;

    chapterProgressPercent.textContent = `${percent}%`;
    chapterProgressState.textContent = completed ? 'Completed' : 'done';
    chapterProgressCaption.textContent = `${current.toLocaleString()} of ${goal.toLocaleString()} words`;
    chapterProgressFill.style.width = `${percent}%`;
    chapterProgressFill.classList.toggle('is-complete', completed);
    chapterProgressIcon.classList.toggle('is-complete', completed);
    chapterProgressIcon.textContent = completed ? '✓' : '•';
  }

  function applyEditorStyles() {
    const fontFamily = fontFamilyInput.value === 'serif'
      ? "Georgia, 'Times New Roman', serif"
      : "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    if (contentInput._richText) {
      contentInput._richText.setPreferences({
        fontFamily,
        fontSize: fontSizeInput.value,
        lineHeight: lineHeightInput.value,
      }, { persist: false });
      return;
    }

    contentInput.style.fontFamily = fontFamily;
    contentInput.style.fontSize = `${fontSizeInput.value}px`;
    contentInput.style.lineHeight = lineHeightInput.value;
  }

  function populateChapterDropdown() {
    const groups = plotSections.map((section) => {
      const sectionChapters = chapters.filter((ch) => ch.sectionId === section.id);
      return { section, sectionChapters };
    }).filter((group) => group.sectionChapters.length > 0);

    chapterSelectDropdown.innerHTML = `<option value="">— Select a chapter —</option>` + groups.map(({ section, sectionChapters }) => `
      <optgroup label="${escapeHtml(section.label)}">
        ${sectionChapters.map((ch) => `
          <option value="${ch.id}" ${ch.id === selectedChapterId ? 'selected' : ''}>
            ${escapeHtml(ch.title || 'Untitled Chapter')}
          </option>
        `).join('')}
      </optgroup>
    `).join('');

    if (!groups.length) {
      chapterSelectDropdown.innerHTML = '<option value="">No chapters yet — add one below</option>';
    }
  }

  function populateSectionSelect() {
    sectionSelect.innerHTML = plotSections
      .map((section) => `<option value="${section.id}">${section.label}</option>`)
      .join('');
  }

  function syncSelectedChapterPublishUI() {
    const chapter = getSelectedChapter();
    if (!chapterPublishStatus || !chapterPublishToggle) {
      return;
    }

    if (!chapter) {
      chapterPublishStatus.textContent = 'Draft';
      chapterPublishStatus.classList.remove('is-published');
      chapterPublishToggle.disabled = true;
      chapterPublishToggle.textContent = 'Publish Chapter';
      return;
    }

    const isPublished = publishedChapterIds.has(chapter.id);
    chapterPublishStatus.textContent = isPublished ? 'Published' : 'Draft';
    chapterPublishStatus.classList.toggle('is-published', isPublished);
    chapterPublishToggle.disabled = false;
    chapterPublishToggle.textContent = isPublished ? 'Unpublish Chapter' : 'Publish Chapter';
    chapterPublishToggle.classList.toggle('is-published', isPublished);
  }

  async function persistPublishedChapterState() {
    activeProject = await window.saveProjectData({
      ...buildProjectPayload(),
      publishedChapterIds: [...publishedChapterIds],
      updatedAt: new Date().toISOString(),
    }, {
      dirtyFields: ['publishedChapterIds', 'lastSessionMeta', 'lastEditedChapterId'],
    });
  }

  async function publishChapter(chapterId) {
    const chapter = chapters.find((entry) => entry.id === chapterId);
    if (!chapter) {
      return;
    }

    if (!activeProject?.isPublic) {
      const confirmed = window.confirm(
        'This story is set to private, and you just tried to publish a chapter. Automatically make project Public?\n\n*Note, only published chapters will be visible.',
      );

      if (!confirmed) {
        saveMessage.textContent = 'Chapter publish canceled. The project is still private.';
        throw new Error('Chapter publish canceled.');
      }

      activeProject = await window.saveProjectData({
        ...buildProjectPayload(),
        isPublic: true,
        updatedAt: new Date().toISOString(),
      }, {
        dirtyFields: chapterProjectDirtyFields.concat('isPublic'),
      });
      saveMessage.textContent = 'Project is now public. Publishing chapter...';
    }

    await window.api.publishing.publishChapter({
      projectLocalId: activeProject.id,
      projectContent: activeProject,
      isPublic: Boolean(activeProject.isPublic),
      chapter: { id: chapter.id, title: chapter.title || 'Untitled', content: chapter.content || '' },
    });
    publishedChapterIds.add(chapter.id);
    await persistPublishedChapterState();
    saveMessage.textContent = `"${chapter.title || 'Chapter'}" published.`;
    renderSections();
    renderEditor();
  }

  async function unpublishChapter(chapterId) {
    const chapter = chapters.find((entry) => entry.id === chapterId);
    await window.api.publishing.unpublishChapter({ projectLocalId: activeProject.id, chapterId });
    publishedChapterIds.delete(chapterId);
    await persistPublishedChapterState();
    saveMessage.textContent = `"${chapter?.title || 'Chapter'}" unpublished.`;
    renderSections();
    renderEditor();
  }

  function renderEditor() {
    const chapter = getSelectedChapter();
    const chapterEditorPreferences = getResolvedEditorPreferences();
    populateChapterDropdown();

    if (!chapter) {
      editorShell.style.display = 'none';
      editorEmpty.style.display = 'block';
      if (chapterProgressCard) chapterProgressCard.style.display = 'none';
      syncSelectedChapterPublishUI();
      return;
    }

    editorShell.style.display = 'block';
    editorEmpty.style.display = 'none';
    if (chapterProgressCard) chapterProgressCard.style.display = 'block';
    const currentSection = plotSections.find((section) => section.id === chapter.sectionId);
    chapterSelectedSection.textContent = currentSection?.label || '';
    titleInput.value = chapter.title || '';
    sectionSelect.value = chapter.sectionId || plotSections[0]?.id || '';
    targetWordsInput.value = chapter.targetWords || 0;
    fontFamilyInput.value = chapterEditorPreferences.fontFamily || 'serif';
    fontSizeInput.value = String(chapterEditorPreferences.fontSize || 18);
    lineHeightInput.value = String(chapterEditorPreferences.lineHeight || 1.7);
    contentInput.value = chapter.content || '';
    window.refreshTextEditor(contentInput, chapter.content || '');

    const currentWords = window.computeWordCount(chapter.content || '');
    currentWordsInput.value = currentWords.toLocaleString();
    setProgress(currentWords, chapter.targetWords);
    applyEditorStyles();
    syncSelectedChapterPublishUI();
    renderContextPanel();
    flushPromptAnswers();
    renderPromptPanel();
  }

  function renderContextPanel() {
    const chapter = getSelectedChapter();
    const currentSection = plotSections.find((section) => section.id === chapter?.sectionId);
    const workbook = activeProject.plotWorkbook || {};
    const visibleCharacters = (characters.filter((character) => !currentSection?.id || (character.sectionIds || []).includes(currentSection.id)).length
      ? characters.filter((character) => (character.sectionIds || []).includes(currentSection?.id))
      : characters).map((character) => ({
      ...character,
      typeTags: Array.isArray(character.typeTags) ? character.typeTags : [],
    }));
    const visibleScenes = scenes.filter((scene) => (
      !chapter
      || scene.linkedChapterId === chapter.id
      || (scene.sectionIds || []).includes(currentSection?.id)
      || (!scene.linkedChapterId && !(scene.sectionIds || []).length)
    ));
    const visibleLocations = locations.filter((location) => !currentSection?.id || (location.sectionIds || []).includes(currentSection.id)).length
      ? locations.filter((location) => (location.sectionIds || []).includes(currentSection?.id))
      : locations;

    contextTabs.forEach((tab) => {
      const isActive = tab.dataset.contextTab === contextState.tab;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });

    if (contextState.tab === 'plot') {
      contextContent.innerHTML = `
        <div class="chapter-context-grid">
          <article class="chapter-context-card">
            <h4>Premise</h4>
            <p>${escapeHtml(excerptRichText(workbook.premise, 'Add a premise in Plot Creation to keep it handy here.'))}</p>
          </article>
          <article class="chapter-context-card">
            <h4>Stakes</h4>
            <p>${escapeHtml(excerptRichText(workbook.stakes, 'Add stakes in Plot Creation to keep the tension visible while you write.'))}</p>
          </article>
          <article class="chapter-context-card">
            <h4>${escapeHtml(currentSection?.label || 'Current Plot Area')}</h4>
            <div class="chapter-context-meta">
              <span class="chapter-context-pill">Target ${Number(currentSection?.targetWords || 0).toLocaleString()} words</span>
            </div>
            <p>${escapeHtml(excerptRichText(currentSection?.notes, 'This plot area does not have notes yet.'))}</p>
          </article>
          <article class="chapter-context-card">
            <h4>Plot Notes</h4>
            <p>${escapeHtml(excerptRichText(workbook.notes, 'General plot notes will appear here once you add them.'))}</p>
          </article>
        </div>
      `;
      return;
    }

    if (contextState.tab === 'characters') {
      contextContent.innerHTML = visibleCharacters.length
        ? `
          <div class="chapter-context-grid">
            ${visibleCharacters.map((character) => `
              <article class="chapter-context-card">
                <h4>${escapeHtml(character.name || 'Unnamed Character')}</h4>
                <div class="chapter-context-meta">
                  ${(character.typeTags || []).slice(0, 3).map((tag) => `
                    <span class="chapter-context-pill">${escapeHtml(tag.replace(/-/g, ' '))}</span>
                  `).join('')}
                  ${(character.narrativeTags || []).slice(0, 2).map((tag) => `
                    <span class="chapter-context-pill">${escapeHtml(tag)}</span>
                  `).join('')}
                </div>
                <p>${escapeHtml(excerptRichText(character.desires || character.background || character.other, 'No reference notes yet.'))}</p>
              </article>
            `).join('')}
          </div>
        `
        : '<div class="chapter-context-empty">Add or link characters to this plot area to keep your cast notes visible while drafting.</div>';
      return;
    }

    if (contextState.tab === 'scenes') {
      contextContent.innerHTML = visibleScenes.length
        ? `
          <div class="chapter-context-grid">
            ${visibleScenes.map((scene) => `
              <article class="chapter-context-card">
                <h4>${escapeHtml(scene.title || 'Untitled Scene')}</h4>
                <div class="chapter-context-meta">
                  <span class="chapter-context-pill">${scene.linkedChapterId === chapter?.id ? 'Linked to this chapter' : 'General scene idea'}</span>
                  ${(scene.tags || []).slice(0, 2).map((tag) => `
                    <span class="chapter-context-pill">${escapeHtml(tag)}</span>
                  `).join('')}
                </div>
                <p>${escapeHtml(excerptRichText(scene.summary || scene.other, 'No scene summary yet.'))}</p>
              </article>
            `).join('')}
          </div>
        `
        : '<div class="chapter-context-empty">Add or link scenes to this plot area to keep chapter-specific beats nearby while you write.</div>';
      return;
    }

    contextContent.innerHTML = visibleLocations.length
      ? `
        <div class="chapter-context-grid">
          ${visibleLocations.map((location) => `
            <article class="chapter-context-card">
              <h4>${escapeHtml(location.name || 'Untitled Location')}</h4>
              <div class="chapter-context-meta">
                <span class="chapter-context-pill">${escapeHtml(location.type || 'General Area')}</span>
                ${location.timeOfDay ? `<span class="chapter-context-pill">${escapeHtml(location.timeOfDay)}</span>` : ''}
              </div>
              <p>${escapeHtml(excerptRichText(location.other || location.socialDynamic || location.climate, 'No location notes yet.'))}</p>
            </article>
          `).join('')}
        </div>
      `
      : '<div class="chapter-context-empty">Add or link locations to this plot area to keep setting details close at hand while drafting.</div>';
  }

  function appendHtmlToChapter(chapter, valueToAppend) {
    const parsedChapter = window.parseRichTextValue(chapter.content || '');
    const parsedAnswer = window.parseRichTextValue(valueToAppend || '');
    const answerText = (() => {
      const temp = document.createElement('div');
      temp.innerHTML = parsedAnswer.html || '';
      return (temp.textContent || temp.innerText || '').trim();
    })();

    if (!answerText) {
      return false;
    }

    const nextHtml = `${parsedChapter.html || '<p><br></p>'}${parsedAnswer.html || ''}`;
    chapter.content = window.serializeRichTextValue(nextHtml, parsedChapter.settings || {});
    return true;
  }

  function flushPromptAnswers() {
    chapterPromptList.querySelectorAll('[data-chapter-prompt-answer]').forEach((field) => {
      const entry = dailyPromptHistory.find((e) => e.id === field.dataset.chapterPromptAnswer);
      if (!entry) return;
      const value = window.getEditorFieldValue ? window.getEditorFieldValue(field) : field.value;
      if (value && value !== entry.answer) {
        entry.answer = value;
        if (!entry.assignedChapterId && selectedChapterId) {
          entry.assignedChapterId = selectedChapterId;
        }
      }
    });
  }

  function renderPromptPanel() {
    const chapter = getSelectedChapter();
    const prompts = getChapterPrompts();
    const countBadge = document.getElementById('chapter-prompt-count-badge');

    const activeCount = dailyPromptHistory.filter((entry) => !entry.answerInsertedAt).length;
    if (countBadge) {
      if (activeCount > 0) {
        countBadge.textContent = `${activeCount}`;
        countBadge.style.display = 'inline-flex';
      } else {
        countBadge.style.display = 'none';
      }
    }

    if (!chapter) {
      chapterPromptEmpty.style.display = 'block';
      chapterPromptList.innerHTML = '';
      chapterPromptMessage.textContent = '';
      chapterPromptMessage.classList.remove('is-success');
      return;
    }

    chapterPromptEmpty.style.display = prompts.length ? 'none' : 'block';
    chapterPromptList.innerHTML = prompts.length
      ? prompts.map((entry, index) => `
        <details class="chapter-prompt-card" ${index === 0 ? 'open' : ''}>
          <summary class="chapter-prompt-toggle">
            <div class="chapter-prompt-toggle-copy">
              <h4>${index + 1}. ${entry.plotPoint}</h4>
              <div class="chapter-prompt-meta">
                <span class="genre-pill">${entry.genre}</span>
                <span>${entry.context || 'Use this anywhere in the draft.'}</span>
              </div>
            </div>
            <span class="chapter-prompt-toggle-indicator" aria-hidden="true">⌄</span>
          </summary>
          <div class="chapter-prompt-body">
            <p class="prompt-callout">${entry.prompt}</p>
            <div class="chapter-prompt-answer">
              <div class="chapter-prompt-answer-header">
                <label for="chapter-prompt-answer-${entry.id}">Your Answer</label>
                ${entry.requiredWordCount ? `<span class="chapter-prompt-word-count" data-prompt-word-count="${entry.id}" data-required="${entry.requiredWordCount}">0 / ${entry.requiredWordCount} words</span>` : ''}
              </div>
              <textarea id="chapter-prompt-answer-${entry.id}" data-chapter-prompt-answer="${entry.id}" rows="5">${entry.answer || ''}</textarea>
            </div>
            <div class="chapter-prompt-footer">
              <p class="daily-prompt-status">
                ${entry.answerInsertedAt ? 'Inserted into draft.' : entry.assignedChapterId === selectedChapterId ? 'Ready to insert into this chapter.' : 'Available for this chapter.'}
              </p>
              <div class="chapter-prompt-actions">
                <button class="btn btn-save" type="button" data-prompt-save-answer="${entry.id}">Save Answer</button>
                <button class="btn btn-primary" type="button" data-insert-prompt-answer="${entry.id}">Insert Answer Into Draft</button>
              </div>
            </div>
          </div>
        </details>
      `).join('')
      : '';

    if (!prompts.length) {
      return;
    }

    window.initializeTextEditor(chapterPromptList);
    prompts.forEach((entry) => {
      const answerField = chapterPromptList.querySelector(`[data-chapter-prompt-answer="${entry.id}"]`);
      if (!answerField) return;
      window.refreshTextEditor(answerField, entry.answer || '');

      const countEl = chapterPromptList.querySelector(`[data-prompt-word-count="${entry.id}"]`);
      if (!countEl) return;

      function updateWordCount() {
        const value = window.getEditorFieldValue(answerField);
        const words = window.computeWordCount(value);
        const required = Number(countEl.dataset.required || 0);
        countEl.textContent = `${words.toLocaleString()} / ${required.toLocaleString()} words`;
        countEl.classList.toggle('is-met', words >= required);
      }

      updateWordCount();
      answerField.addEventListener('input', updateWordCount);
    });

    chapterPromptList.querySelectorAll('[data-prompt-save-answer]').forEach((button) => {
      button.addEventListener('click', async () => {
        const promptEntry = dailyPromptHistory.find((entry) => entry.id === button.dataset.promptSaveAnswer);
        const field = chapterPromptList.querySelector(`[data-chapter-prompt-answer="${button.dataset.promptSaveAnswer}"]`);
        if (!promptEntry || !field) {
          return;
        }

        promptEntry.answer = window.getEditorFieldValue(field);
        promptEntry.assignedChapterId = selectedChapterId;
        activeProject = await window.saveProjectData({
          ...buildProjectPayload(),
          dailyPromptHistory,
        }, {
          dirtyFields: chapterProjectDirtyFields,
        });
        chapterPromptMessage.textContent = 'Prompt answer saved.';
        chapterPromptMessage.classList.remove('is-success');
        renderPromptPanel();
      });
    });

    chapterPromptList.querySelectorAll('[data-insert-prompt-answer]').forEach((button) => {
      button.addEventListener('click', async () => {
        const promptEntry = dailyPromptHistory.find((entry) => entry.id === button.dataset.insertPromptAnswer);
        const field = chapterPromptList.querySelector(`[data-chapter-prompt-answer="${button.dataset.insertPromptAnswer}"]`);
        const selected = getSelectedChapter();
        if (!promptEntry || !field || !selected) {
          return;
        }

        const answerValue = window.getEditorFieldValue(field);
        promptEntry.answer = answerValue;
        promptEntry.assignedChapterId = selected.id;
        const inserted = appendHtmlToChapter(selected, answerValue);

        if (!inserted) {
          chapterPromptMessage.textContent = 'Write an answer before inserting it into the draft.';
          chapterPromptMessage.classList.remove('is-success');
          return;
        }

        promptEntry.answerInsertedAt = new Date().toISOString();
        contentInput.value = selected.content || '';
        window.refreshTextEditor(contentInput, selected.content || '');
        syncSelectedChapter();
        activeProject = await window.saveProjectData({
          ...buildProjectPayload(),
          dailyPromptHistory,
        }, {
          dirtyFields: chapterProjectDirtyFields,
        });
        chapterPromptMessage.textContent = 'Daily prompt submission has been added to the bottom of the selected chapter.';
        chapterPromptMessage.classList.add('is-success');
        renderPromptPanel();
      });
    });
  }

  function renderSections() {
    sectionsList.innerHTML = plotSections
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
                <h3>${section.label}</h3>
                <p>${sectionWords.toLocaleString()} words across ${sectionChapters.length} chapter${sectionChapters.length === 1 ? '' : 's'}</p>
              </div>
              <span class="plot-section-toggle-indicator" aria-hidden="true">⌄</span>
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
                      <div class="chapter-row ${chapter.id === selectedChapterId ? 'is-active' : ''}" data-open-chapter="${chapter.id}">
                        <div class="chapter-row-main">
                          <input
                            class="chapter-title-inline"
                            type="text"
                            value="${chapter.title || ''}"
                            placeholder="Chapter title"
                            data-title-chapter="${chapter.id}"
                          />
                        </div>
                        <div class="chapter-row-foot">
                          <span class="chapter-row-word-count">${window.computeWordCount(chapter.content || '')} words</span>
                          <div class="chapter-row-actions">
                            ${publishedChapterIds.has(chapter.id)
                              ? `<span class="chapter-row-published-badge">Published</span><button class="chapter-row-unpublish" type="button" data-unpublish-chapter="${chapter.id}" title="Unpublish this chapter">Unpublish</button>`
                              : `<button class="chapter-row-publish" type="button" data-publish-chapter="${chapter.id}">Publish</button>`
                            }
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

    sectionsList.querySelectorAll('details.plot-section-item').forEach((details) => {
      const containsSelectedChapter = details.querySelector(`[data-open-chapter="${selectedChapterId}"]`);
      window.bindPersistentDetailsState?.(details, {
        projectId: activeProject.id,
        sectionId: `chapters-section-${details.dataset.sectionId}`,
        defaultOpen: Boolean(containsSelectedChapter),
      });
      if (containsSelectedChapter) {
        details.open = true;
      }
    });

    sectionsList.querySelectorAll('[data-target-section]').forEach((input) => {
      input.addEventListener('input', () => {
        const section = plotSections.find((entry) => entry.id === input.dataset.targetSection);
        if (section) {
          section.targetWords = Number(input.value || 0);
          autosave.touch();
        }
      });
    });

    sectionsList.querySelectorAll('[data-open-chapter]').forEach((button) => {
      button.addEventListener('click', () => {
        selectChapter(button.dataset.openChapter, { touch: true });
        renderSections();
        renderEditor();
      });
    });

    sectionsList.querySelectorAll('[data-title-chapter]').forEach((input) => {
      input.addEventListener('input', () => {
        const chapter = chapters.find((entry) => entry.id === input.dataset.titleChapter);
        if (!chapter) {
          return;
        }

        chapter.title = input.value.trim();
        autosave.touch();
        if (chapter.id === selectedChapterId) {
          titleInput.value = chapter.title || '';
          populateChapterDropdown();
        }
      });

      input.addEventListener('click', (event) => {
        event.stopPropagation();
      });

      input.addEventListener('focus', (event) => {
        event.stopPropagation();
      });
    });

    sectionsList.querySelectorAll('[data-delete-chapter]').forEach((button) => {
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

        if (selectedChapterId === chapterId) {
          selectedChapterId = chapters[Math.max(0, chapterIndex - 1)]?.id || chapters[0]?.id || '';
          if (selectedChapterId) {
            selectChapter(selectedChapterId);
          }
        }

        saveMessage.textContent = 'Chapter deleted.';
        autosave.touch();
        renderSections();
        renderEditor();
      });
    });

    sectionsList.querySelectorAll('.add-chapter').forEach((button) => {
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
        selectChapter(newChapter.id, { touch: true });
        autosave.touch();
        renderSections();
        renderEditor();
      });
    });

    sectionsList.querySelectorAll('[data-link-entity]').forEach((input) => {
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
        renderSections();
        renderContextPanel();
      });
    });

    sectionsList.querySelectorAll('[data-unlink-entity]').forEach((button) => {
      button.addEventListener('click', () => {
        const collection = getEntityCollection(button.dataset.unlinkEntity);
        const entity = collection.find((entry) => entry.id === button.dataset.unlinkId);
        if (!entity) {
          return;
        }

        entity.sectionIds = (entity.sectionIds || []).filter((id) => id !== button.dataset.unlinkSection);
        entity.sectionId = entity.sectionIds[0] || '';
        autosave.touch();
        renderSections();
        renderContextPanel();
      });
    });

    sectionsList.querySelectorAll('[data-publish-chapter]').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.stopPropagation();
        const chapterId = button.dataset.publishChapter;
        button.disabled = true;
        button.textContent = 'Publishing…';
        try {
          await publishChapter(chapterId);
        } catch (err) {
          button.disabled = false;
          button.textContent = 'Publish';
          saveMessage.textContent = err.message || 'Publish failed.';
        }
      });
    });

    sectionsList.querySelectorAll('[data-unpublish-chapter]').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.stopPropagation();
        const chapterId = button.dataset.unpublishChapter;
        button.disabled = true;
        try {
          await unpublishChapter(chapterId);
        } catch (err) {
          button.disabled = false;
          saveMessage.textContent = err.message || 'Unpublish failed.';
        }
      });
    });
  }

  function syncSelectedChapter() {
    const chapter = getSelectedChapter();
    if (!chapter) {
      return;
    }

    chapter.title = titleInput.value.trim();
    chapter.sectionId = sectionSelect.value;
    chapter.targetWords = Number(targetWordsInput.value || 0);
    chapter.content = window.getEditorFieldValue(contentInput);

    const currentWords = window.computeWordCount(chapter.content);
    currentWordsInput.value = currentWords.toLocaleString();
    setProgress(currentWords, chapter.targetWords);
    document.getElementById('chapter-editor-title').textContent = chapter.title || 'Untitled Chapter';
    const currentSection = plotSections.find((section) => section.id === chapter.sectionId);
    chapterSelectedSection.textContent = currentSection?.label || '';
    applyEditorStyles();
    renderSections();
    renderContextPanel();
    autosave.touch();
  }

  function buildProjectPayload() {
    const resolvedPreferences = getResolvedEditorPreferences();
    return {
      ...activeProject,
      plotSections,
      chapters,
      characters,
      scenes,
      locations,
      dailyPromptHistory,
      publishedChapterIds: [...publishedChapterIds],
      editorPreferences: {
        ...(window.normalizeProjectEditorPreferences?.(activeProject.editorPreferences || {}) || activeProject.editorPreferences || {}),
        fontFamily: fontFamilyInput.value || resolvedPreferences.fontFamily,
        fontSize: Number(fontSizeInput.value || resolvedPreferences.fontSize || 18),
        lineHeight: Number(lineHeightInput.value || resolvedPreferences.lineHeight || 1.7),
      },
      currentWordCount: chapters.reduce(
        (sum, chapter) => sum + window.computeWordCount(chapter.content || ''),
        0,
      ),
      lastSessionMeta: {
        chapterIds: selectedChapterId ? [selectedChapterId] : [],
        source: 'chapters',
      },
      lastEditedChapterId: selectedChapterId || '',
      updatedAt: new Date().toISOString(),
    };
  }

  async function exportProjectBook() {
    if (typeof window.api?.exportProjectManuscript !== 'function') {
      saveMessage.textContent = 'Export is not available in the current app session. Restart Inkbug Beta and try again.';
      return;
    }

    try {
      const updatedProject = buildProjectPayload();
      const result = await window.api.exportProjectManuscript(updatedProject);

      if (result?.canceled) {
        saveMessage.textContent = 'Export canceled.';
        return;
      }

      saveMessage.textContent = `Book exported as ${result.format?.toUpperCase()} to ${result.filePath}.`;
    } catch (error) {
      saveMessage.textContent = error?.message || 'Export failed. Please try again after restarting the app.';
    }
  }

  document.getElementById('chapter-go-to-challenges')?.addEventListener('click', () => {
    window.navigate('daily-prompts');
  });

  chapterSelectDropdown?.addEventListener('change', () => {
    if (!chapterSelectDropdown.value) return;
    selectChapter(chapterSelectDropdown.value, { touch: true });
    renderSections();
    renderEditor();
    editorShell.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.getElementById('chapter-add-quick')?.addEventListener('click', () => {
    const defaultSectionId = plotSections[0]?.id || '';
    const nextChapterNumber = getNextChapterNumber();
    const newChapter = {
      id: `chapter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: `Chapter ${nextChapterNumber}`,
      sectionId: defaultSectionId,
      targetWords: 0,
      content: '',
    };
    chapters.push(newChapter);
    selectChapter(newChapter.id, { touch: true });
    autosave.touch();
    renderSections();
    renderEditor();
    editorShell.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  chapterPublishToggle?.addEventListener('click', async () => {
    const chapter = getSelectedChapter();
    if (!chapter) {
      return;
    }

    const isPublished = publishedChapterIds.has(chapter.id);
    chapterPublishToggle.disabled = true;
    chapterPublishToggle.textContent = isPublished ? 'Unpublishing…' : 'Publishing…';

    try {
      if (isPublished) {
        await unpublishChapter(chapter.id);
      } else {
        await publishChapter(chapter.id);
      }
    } catch (error) {
      saveMessage.textContent = error?.message || (isPublished ? 'Unpublish failed.' : 'Publish failed.');
      syncSelectedChapterPublishUI();
    } finally {
      chapterPublishToggle.disabled = false;
      syncSelectedChapterPublishUI();
    }
  });

  window.initializeTextEditor(document.getElementById('chapters-content'));
  populateSectionSelect();
  renderSections();
  renderEditor();
  if (chapterPublishToggle && getSelectedChapter()) {
    chapterPublishToggle.disabled = true;
    chapterPublishToggle.textContent = 'Loading…';
  }
  bindChapterPanelState();
  contextTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      contextState.tab = tab.dataset.contextTab;
      renderContextPanel();
    });
  });

  [titleInput, sectionSelect, targetWordsInput, fontFamilyInput, fontSizeInput, lineHeightInput, contentInput].forEach((field) => {
    field.addEventListener('input', syncSelectedChapter);
  });

  async function handleSaveChapters(button) {
    await window.runButtonFeedback(button, async () => {
      const updatedProject = buildProjectPayload();
      activeProject = await window.saveProjectData(updatedProject, {
        dirtyFields: chapterProjectDirtyFields,
      });
      saveMessage.textContent = 'Chapters saved.';
    });
  }

  saveButton.addEventListener('click', async () => {
    await handleSaveChapters(saveButton);
  });

  saveTopButton?.addEventListener('click', async () => {
    await handleSaveChapters(saveTopButton);
  });

  exportButton.addEventListener('click', async () => {
    await exportProjectBook();
  });

  // Publishing

  async function loadPublishedChapters() {
    const localPublishedIds = new Set(activeProject?.publishedChapterIds || []);
    try {
      const rows = await window.api.publishing.getPublished({ projectLocalId: activeProject.id });
      const remotePublishedIds = new Set((rows || []).map((r) => r.chapter_id));
      publishedChapterIds = remotePublishedIds;

      const localIds = [...localPublishedIds].sort();
      const remoteIds = [...remotePublishedIds].sort();
      const changed = localIds.length !== remoteIds.length
        || localIds.some((id, index) => id !== remoteIds[index]);

      if (changed) {
        activeProject = await window.api.saveProject({
          ...activeProject,
          publishedChapterIds: remoteIds,
          updatedAt: activeProject.updatedAt || new Date().toISOString(),
        }, {
          dirtyFields: ['publishedChapterIds', 'lastSessionMeta', 'lastEditedChapterId'],
        });
        window.setCurrentProject(activeProject);
      }
    } catch {}
    if (!publishedChapterIds.size && localPublishedIds.size) {
      publishedChapterIds = localPublishedIds;
    }
  }

  await loadPublishedChapters();
  renderSections();
  syncSelectedChapterPublishUI();
});
