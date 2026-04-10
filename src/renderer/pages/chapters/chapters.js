window.initPage = async function ({ project }) {
  const activeProject = project || window.getCurrentProject();
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
  const chapterProgressPercent = document.getElementById('chapter-progress-percent');
  const chapterProgressState = document.getElementById('chapter-progress-state');
  const chapterProgressCaption = document.getElementById('chapter-progress-caption');
  const chapterProgressFill = document.getElementById('chapter-progress-fill');
  const chapterProgressIcon = document.getElementById('chapter-progress-icon');

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

  function setProgress(currentWords, targetWords) {
    const goal = Number(targetWords || 0);
    const current = Number(currentWords || 0);
    const percent = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;
    const completed = goal > 0 && current >= goal;

    chapterProgressPercent.textContent = `${percent}%`;
    chapterProgressState.textContent = completed ? 'Completed' : 'in progress';
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
    document.getElementById('chapter-editor-title').textContent = chapter.title || 'Untitled Chapter';
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
          <article class="plot-section-item">
            <div class="plot-section-head">
              <div>
                <h3>${section.label}</h3>
                <p>${sectionWords.toLocaleString()} words across ${sectionChapters.length} chapter${sectionChapters.length === 1 ? '' : 's'}</p>
              </div>
              <button class="btn btn-ghost add-chapter" type="button" data-section="${section.id}">Add Chapter</button>
            </div>
            <div class="field">
              <label>Plot Area Target Words</label>
              <input type="number" min="0" step="100" value="${section.targetWords || 0}" data-target-section="${section.id}" />
            </div>
            <div class="chapter-list">
              ${sectionChapters.length
                ? sectionChapters
                  .map((chapter) => `
                    <div class="chapter-row">
                      <div class="chapter-row-main">
                        <button class="chapter-open" type="button" data-open-chapter="${chapter.id}">
                          Open
                        </button>
                        <input
                          class="chapter-title-inline"
                          type="text"
                          value="${chapter.title || ''}"
                          placeholder="Chapter title"
                          data-title-chapter="${chapter.id}"
                        />
                      </div>
                      <span>${window.computeWordCount(chapter.content || '')} words</span>
                    </div>
                  `)
                  .join('')
                : '<p>No chapters yet for this section.</p>'}
            </div>
          </article>
        `;
      })
      .join('');

    sectionsList.querySelectorAll('[data-target-section]').forEach((input) => {
      input.addEventListener('input', () => {
        const section = plotSections.find((entry) => entry.id === input.dataset.targetSection);
        if (section) {
          section.targetWords = Number(input.value || 0);
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
        if (chapter.id === selectedChapterId) {
          document.getElementById('chapter-editor-title').textContent = chapter.title || 'Untitled Chapter';
          titleInput.value = chapter.title || '';
        }
      });

      input.addEventListener('click', (event) => {
        event.stopPropagation();
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
        renderSections();
        renderEditor();
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
    applyEditorStyles();
    renderSections();
  }

  function buildProjectPayload() {
    return {
      ...activeProject,
      plotSections,
      chapters,
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

  [titleInput, sectionSelect, targetWordsInput, fontFamilyInput, fontSizeInput, lineHeightInput, contentInput].forEach((field) => {
    field.addEventListener('input', syncSelectedChapter);
  });

  saveButton.addEventListener('click', async () => {
    const updatedProject = buildProjectPayload();
    await window.saveProjectData(updatedProject);
    saveMessage.textContent = 'Chapters saved.';
  });

  exportButton.addEventListener('click', async () => {
    await exportProjectBook();
  });
};
