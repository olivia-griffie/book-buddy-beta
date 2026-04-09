window.initPage = async function ({ project }) {
  const activeProject = project || window.getCurrentProject();
  const emptyState = document.getElementById('chapters-empty-state');
  const content = document.getElementById('chapters-content');
  const saveButton = document.getElementById('save-chapters');
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
    return;
  }

  emptyState.style.display = 'none';
  content.style.display = 'grid';
  saveButton.style.display = 'inline-flex';
  document.getElementById('chapters-page-title').textContent = activeProject.title || 'Chapter Workspace';
  document.getElementById('chapters-page-subtitle').textContent = 'Set section targets, add chapters, and draft in a simple focused editor.';

  const promptData = await window.getGenrePromptData();
  const resources = window.getProjectResources(activeProject, promptData);
  const plotSections = (activeProject.plotSections || resources.plotSections).map((section) => ({ ...section }));
  const chapters = (activeProject.chapters || []).map((chapter) => ({
    fontFamily: 'serif',
    fontSize: 18,
    ...chapter,
  }));

  let selectedChapterId = chapters[0]?.id || '';

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
    contentInput.style.fontFamily = fontFamilyInput.value === 'serif'
      ? "Georgia, 'Times New Roman', serif"
      : "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    contentInput.style.fontSize = `${fontSizeInput.value}px`;
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
    contentInput.value = chapter.content || '';

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
                      <button class="chapter-open" type="button" data-open-chapter="${chapter.id}">
                        <strong>${chapter.title || 'Untitled Chapter'}</strong>
                      </button>
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
        renderEditor();
      });
    });

    sectionsList.querySelectorAll('.add-chapter').forEach((button) => {
      button.addEventListener('click', () => {
        const newChapter = {
          id: `chapter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: `New Chapter ${chapters.length + 1}`,
          sectionId: button.dataset.section,
          targetWords: 0,
          fontFamily: 'serif',
          fontSize: 18,
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
    chapter.content = contentInput.value;

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

  populateSectionSelect();
  renderSections();
  renderEditor();

  [titleInput, sectionSelect, targetWordsInput, fontFamilyInput, fontSizeInput, contentInput].forEach((field) => {
    field.addEventListener('input', syncSelectedChapter);
  });

  saveButton.addEventListener('click', async () => {
    const updatedProject = buildProjectPayload();
    await window.saveProjectData(updatedProject);
    saveMessage.textContent = 'Chapters saved.';
  });
};
