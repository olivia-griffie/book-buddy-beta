window.registerPageInit('chapters', async function ({ project }) {
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

    return text.length > 180 ? `${text.slice(0, 177)}...` : text;
  }

  let activeProject = project || window.getCurrentProject();
  const emptyState = document.getElementById('chapters-empty-state');
  const content = document.getElementById('chapters-content');
  const saveButton = document.getElementById('save-chapters');
  const exportButton = document.getElementById('export-chapters');
  const createButton = document.getElementById('chapters-create-project');
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
  const chapterSelectedSection = document.getElementById('chapter-selected-section');
  const chapterSelectedName = document.getElementById('chapter-selected-name');
  const chapterPromptList = document.getElementById('chapter-prompt-list');
  const chapterPromptEmpty = document.getElementById('chapter-prompt-empty');
  const chapterPromptMessage = document.getElementById('chapter-prompt-message');
  const chapterProgressPercent = document.getElementById('chapter-progress-percent');
  const chapterProgressState = document.getElementById('chapter-progress-state');
  const chapterProgressCaption = document.getElementById('chapter-progress-caption');
  const chapterProgressFill = document.getElementById('chapter-progress-fill');
  const chapterProgressIcon = document.getElementById('chapter-progress-icon');
  const contextContent = document.getElementById('chapter-context-content');
  const contextTabs = [...document.querySelectorAll('[data-context-tab]')];

  createButton?.addEventListener('click', () => window.navigate('create-project', { project: null }));

  if (!activeProject) {
    emptyState.style.display = 'grid';
    content.style.display = 'none';
    saveButton.style.display = 'none';
    exportButton.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  content.style.display = 'grid';
  saveButton.style.display = 'inline-flex';
  exportButton.style.display = 'inline-flex';
  document.getElementById('chapters-page-title').textContent = activeProject.title || 'Chapter Workspace';
  document.getElementById('chapters-page-subtitle').textContent = 'Set section targets, add chapters, and draft in a simple focused editor.';

  const promptData = await window.getGenrePromptData();
  const resources = window.getProjectResources(activeProject, promptData);
  const plotSections = (activeProject.plotSections || resources.plotSections).map((section) => ({ ...section }));
  const chapters = (activeProject.chapters || []).map((chapter) => ({
    fontFamily: 'serif',
    fontSize: 18,
    lineHeight: 1.6,
    ...chapter,
  }));
  const characters = (activeProject.characters || []).map((character) => ({ ...character }));
  const scenes = (activeProject.scenes || []).map((scene) => ({ ...scene }));
  const locations = (activeProject.locations || []).map((location) => ({ ...location }));
  const dailyPromptHistory = (activeProject.dailyPromptHistory || []).map((entry) => ({
    answer: '',
    answerInsertedAt: '',
    ...entry,
  }));
  const contextState = {
    tab: 'plot',
  };
  const autosave = window.createAutosaveController(async () => {
    const updatedProject = buildProjectPayload();
    activeProject = await window.saveProjectData(updatedProject, {
      dirtyFields: ['plotSections', 'chapters', 'characters', 'scenes', 'locations', 'dailyPromptHistory', 'currentWordCount'],
    });
    saveMessage.textContent = 'Chapter changes autosaved.';
  }, {
    dirtyText: 'Chapter changes not saved',
  });

  let selectedChapterId = chapters[0]?.id || '';

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
    const linkedItems = collection.filter((entity) => entity.sectionId === sectionId);
    const selectableItems = collection.filter((entity) => entity.sectionId !== sectionId);
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
                  <button class="plot-section-chip-remove" type="button" data-unlink-entity="${type}" data-unlink-id="${entity.id}">×</button>
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
      });
      return;
    }

    contentInput.style.fontFamily = fontFamily;
    contentInput.style.fontSize = `${fontSizeInput.value}px`;
    contentInput.style.lineHeight = lineHeightInput.value;
  }

  function populateSectionSelect() {
    sectionSelect.innerHTML = plotSections
      .map((section) => `<option value="${section.id}">${section.label}</option>`)
      .join('');
  }

  function renderEditor() {
    const chapter = getSelectedChapter();
    if (!chapter) {
      editorShell.style.display = 'none';
      editorEmpty.style.display = 'block';
      document.getElementById('chapter-editor-title').textContent = 'Select a chapter';
      return;
    }

    editorShell.style.display = 'block';
    editorEmpty.style.display = 'none';
    const currentSection = plotSections.find((section) => section.id === chapter.sectionId);
    document.getElementById('chapter-editor-title').textContent = chapter.title || 'Untitled Chapter';
    chapterSelectedSection.textContent = currentSection?.label || 'Plot Section';
    chapterSelectedName.textContent = chapter.title || 'Untitled Chapter';
    titleInput.value = chapter.title || '';
    sectionSelect.value = chapter.sectionId || plotSections[0]?.id || '';
    targetWordsInput.value = chapter.targetWords || 0;
    fontFamilyInput.value = chapter.fontFamily || 'serif';
    fontSizeInput.value = String(chapter.fontSize || 18);
    lineHeightInput.value = String(chapter.lineHeight || 1.6);
    contentInput.value = chapter.content || '';
    window.refreshTextEditor(contentInput, chapter.content || '');

    const currentWords = window.computeWordCount(chapter.content || '');
    currentWordsInput.value = currentWords.toLocaleString();
    setProgress(currentWords, chapter.targetWords);
    applyEditorStyles();
    renderContextPanel();
    renderPromptPanel();

    editorShell.querySelectorAll('[data-collapse-toggle]').forEach((trigger) => {
      trigger.addEventListener('click', () => {
        trigger.closest('.field-collapsible')?.classList.toggle('is-open');
      });
    });
  }

  function renderContextPanel() {
    const chapter = getSelectedChapter();
    const currentSection = plotSections.find((section) => section.id === chapter?.sectionId);
    const workbook = activeProject.plotWorkbook || {};
    const visibleCharacters = (characters.filter((character) => !currentSection?.id || character.sectionId === currentSection.id).length
      ? characters.filter((character) => character.sectionId === currentSection?.id)
      : characters).map((character) => ({
      ...character,
      typeTags: Array.isArray(character.typeTags) ? character.typeTags : [],
    }));
    const visibleScenes = scenes.filter((scene) => (
      !chapter
      || scene.linkedChapterId === chapter.id
      || scene.sectionId === currentSection?.id
      || (!scene.linkedChapterId && !scene.sectionId)
    ));
    const visibleLocations = locations.filter((location) => !currentSection?.id || location.sectionId === currentSection.id).length
      ? locations.filter((location) => location.sectionId === currentSection?.id)
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

  function renderPromptPanel() {
    const chapter = getSelectedChapter();
    const prompts = getChapterPrompts();

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
              <label for="chapter-prompt-answer-${entry.id}">Your Answer</label>
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
      if (answerField) {
        window.refreshTextEditor(answerField, entry.answer || '');
      }
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
          dirtyFields: ['plotSections', 'chapters', 'characters', 'scenes', 'locations', 'dailyPromptHistory', 'currentWordCount'],
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
          dirtyFields: ['plotSections', 'chapters', 'characters', 'scenes', 'locations', 'dailyPromptHistory', 'currentWordCount'],
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
        const hasSelectedChapter = sectionChapters.some((chapter) => chapter.id === selectedChapterId);

        return `
          <details class="plot-section-item" ${hasSelectedChapter ? 'open' : ''}>
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
                        <span class="chapter-row-word-count">${window.computeWordCount(chapter.content || '')} words</span>
                        <button class="chapter-row-delete" type="button" data-delete-chapter="${chapter.id}" aria-label="Delete ${escapeHtml(chapter.title || 'chapter')}">Delete</button>
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
        selectedChapterId = button.dataset.openChapter;
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
          document.getElementById('chapter-editor-title').textContent = chapter.title || 'Untitled Chapter';
          chapterSelectedName.textContent = chapter.title || 'Untitled Chapter';
          titleInput.value = chapter.title || '';
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
          fontFamily: 'serif',
          fontSize: 18,
          lineHeight: 1.6,
          content: '',
        };

        chapters.push(newChapter);
        selectedChapterId = newChapter.id;
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

        entity.sectionId = input.dataset.linkSection;
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

        entity.sectionId = '';
        autosave.touch();
        renderSections();
        renderContextPanel();
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
    chapter.fontFamily = fontFamilyInput.value;
    chapter.fontSize = Number(fontSizeInput.value || 18);
    chapter.lineHeight = Number(lineHeightInput.value || 1.6);
    chapter.content = window.getEditorFieldValue(contentInput);

    const currentWords = window.computeWordCount(chapter.content);
    currentWordsInput.value = currentWords.toLocaleString();
    setProgress(currentWords, chapter.targetWords);
    document.getElementById('chapter-editor-title').textContent = chapter.title || 'Untitled Chapter';
    const currentSection = plotSections.find((section) => section.id === chapter.sectionId);
    chapterSelectedSection.textContent = currentSection?.label || 'Plot Section';
    chapterSelectedName.textContent = chapter.title || 'Untitled Chapter';
    applyEditorStyles();
    renderSections();
    renderContextPanel();
    autosave.touch();
  }

  function buildProjectPayload() {
    return {
      ...activeProject,
      plotSections,
      chapters,
      characters,
      scenes,
      locations,
      dailyPromptHistory,
      currentWordCount: chapters.reduce(
        (sum, chapter) => sum + window.computeWordCount(chapter.content || ''),
        0,
      ),
      updatedAt: new Date().toISOString(),
    };
  }

  async function exportProjectBook() {
    if (typeof window.api?.exportProjectManuscript !== 'function') {
      saveMessage.textContent = 'Export is not available in the current app session. Restart Book Buddy Beta and try again.';
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

  window.initializeTextEditor(document.getElementById('chapters-content'));
  populateSectionSelect();
  renderSections();
  renderEditor();
  contextTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      contextState.tab = tab.dataset.contextTab;
      renderContextPanel();
    });
  });

  [titleInput, sectionSelect, targetWordsInput, fontFamilyInput, fontSizeInput, lineHeightInput, contentInput].forEach((field) => {
    field.addEventListener('input', syncSelectedChapter);
  });

  saveButton.addEventListener('click', async () => {
    await window.runButtonFeedback(saveButton, async () => {
      const updatedProject = buildProjectPayload();
      activeProject = await window.saveProjectData(updatedProject, {
        dirtyFields: ['plotSections', 'chapters', 'characters', 'scenes', 'locations', 'dailyPromptHistory', 'currentWordCount'],
      });
      saveMessage.textContent = 'Chapters saved.';
    });
  });

  exportButton.addEventListener('click', async () => {
    await exportProjectBook();
  });
});
