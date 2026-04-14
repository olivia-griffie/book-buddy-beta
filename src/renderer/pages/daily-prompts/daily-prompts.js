window.registerPageInit('daily-prompts', async function ({ project }) {
  let activeProject = project || window.getCurrentProject();
  const emptyState = document.getElementById('daily-prompts-empty-state');
  const content = document.getElementById('daily-prompts-content');
  const createButton = document.getElementById('daily-prompts-create-project');
  const generateButton = document.getElementById('generate-prompts');
  const countInput = document.getElementById('prompt-count');
  const modeInput = document.getElementById('prompt-mode');
  const status = document.getElementById('daily-prompts-status');
  const resultsGrid = document.getElementById('prompt-results-grid');
  const progressCard = document.getElementById('daily-prompts-progress');
  const progressIcon = document.getElementById('daily-prompts-progress-icon');
  const progressPercent = document.getElementById('daily-prompts-progress-percent');
  const progressState = document.getElementById('daily-prompts-progress-state');
  const progressCaption = document.getElementById('daily-prompts-progress-caption');
  const progressFill = document.getElementById('daily-prompts-progress-fill');

  createButton?.addEventListener('click', () => window.navigate('create-project', { project: null }));

  if (!activeProject) {
    emptyState.style.display = 'grid';
    content.style.display = 'none';
    generateButton.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  content.style.display = 'grid';
  generateButton.style.display = 'inline-flex';
  document.getElementById('daily-prompts-title').textContent = `${activeProject.title || 'Project'} Daily Prompts`;

  const promptData = await window.getGenrePromptData();
  const resources = window.getProjectResources(activeProject, promptData);
  const dailyState = {
    cursor: Number(activeProject.dailyPromptState?.cursor || 0),
  };

  function extractPromptWordTarget(prompt = '') {
    const normalizedPrompt = String(prompt || '').replace(/,/g, '');
    const patterns = [
      /\bwrite\b[\s\S]{0,24}?\b(\d+)\s*-\s*word\b/i,
      /\bwrite\b[\s\S]{0,24}?\b(\d+)\s+words?\b/i,
      /\b(\d+)\s*-\s*word\b/i,
      /\b(\d+)\s+words?\b/i,
    ];
    const match = patterns
      .map((pattern) => normalizedPrompt.match(pattern))
      .find(Boolean);

    return match ? Number(match[1]) : 0;
  }

  function getPromptAnswerWordCount(entry) {
    return window.computeWordCount(entry?.answer || '');
  }

  if (activeProject.dailyPromptHistory?.some((entry) => (
    !entry.id
    || typeof entry.requiredWordCount !== 'number'
    || typeof entry.insertedWordCount !== 'number'
  ))) {
    activeProject = await window.saveProjectData({
      ...activeProject,
      dailyPromptHistory: (activeProject.dailyPromptHistory || []).map((entry, index) => ({
        ...entry,
        id: entry.id || `daily-prompt-legacy-${Date.now()}-${index}`,
        assignedChapterId: entry.assignedChapterId || '',
        answer: entry.answer || '',
        answerInsertedAt: entry.answerInsertedAt || '',
        requiredWordCount: Number(entry.requiredWordCount || extractPromptWordTarget(entry.prompt)),
        insertedWordCount: Number(entry.insertedWordCount || 0),
      })),
      updatedAt: new Date().toISOString(),
    }, {
      dirtyFields: ['dailyPromptHistory'],
    });
  }

  function getChapters() {
    return activeProject.chapters || [];
  }

  function getDailyHistory() {
    return activeProject.dailyPromptHistory || [];
  }

  function isSameLocalDay(left, right) {
    return new Date(left).toDateString() === new Date(right).toDateString();
  }

  function syncPromptCountState() {
    countInput.value = '1';
    [...countInput.options].forEach((option) => {
      option.disabled = option.value !== '1';
    });
  }

  function getContextLabel(index) {
    const character = activeProject.characters?.[index % (activeProject.characters?.length || 1)];
    const scene = activeProject.scenes?.[index % (activeProject.scenes?.length || 1)];
    const location = activeProject.locations?.[index % (activeProject.locations?.length || 1)];
    const pieces = [];
    if (character?.name) pieces.push(`Character: ${character.name}`);
    if (scene?.title) pieces.push(`Scene: ${scene.title}`);
    if (location?.name) pieces.push(`Location: ${location.name}`);
    return pieces.length ? pieces.join(' | ') : 'Use this anywhere in the draft.';
  }

  function hasPromptBeenCompleted(entry) {
    if (!entry?.assignedChapterId || !entry?.answerInsertedAt) {
      return false;
    }

    const requiredWordCount = Number(entry.requiredWordCount || extractPromptWordTarget(entry.prompt));
    const insertedWordCount = Number(entry.insertedWordCount || 0);

    return requiredWordCount > 0
      ? insertedWordCount >= requiredWordCount
      : insertedWordCount > 0;
  }

  function buildCompletionSnapshot(entry) {
    const requiredWordCount = Number(entry.requiredWordCount || extractPromptWordTarget(entry.prompt));
    const answerWords = entry.answerInsertedAt
      ? Number(entry.insertedWordCount || 0)
      : getPromptAnswerWordCount(entry);
    const targetWords = requiredWordCount > 0 ? requiredWordCount : Math.max(answerWords, 1);
    const inserted = Boolean(entry.answerInsertedAt);
    const thresholdMet = requiredWordCount > 0 ? answerWords >= requiredWordCount : answerWords > 0;
    const completed = inserted && thresholdMet;
    const percent = targetWords > 0 ? Math.min(100, Math.round((answerWords / targetWords) * 100)) : 0;

    return {
      completed,
      percent,
      state: completed
        ? 'completed'
        : inserted
          ? 'inserted below target'
          : entry.assignedChapterId
            ? 'assigned to chapter'
            : 'not assigned',
      caption: completed
        ? `Inserted and met the ${targetWords.toLocaleString()} word target.`
        : inserted
          ? `Inserted ${answerWords.toLocaleString()} of ${targetWords.toLocaleString()} required words.`
          : entry.assignedChapterId
            ? `Write ${targetWords.toLocaleString()} words, then insert the answer into the linked chapter.`
            : `Choose a chapter and write ${targetWords.toLocaleString()} words to complete this prompt.`,
    };
  }

  function appendPromptAnswerToChapter(chapter, answerValue) {
    const parsedChapter = window.parseRichTextValue(chapter.content || '');
    const parsedAnswer = window.parseRichTextValue(answerValue || '');
    const textOnly = (() => {
      const temp = document.createElement('div');
      temp.innerHTML = parsedAnswer.html || '';
      return (temp.textContent || temp.innerText || '').trim();
    })();

    if (!textOnly) {
      return false;
    }

    const nextHtml = `${parsedChapter.html || '<p><br></p>'}${parsedAnswer.html || ''}`;
    chapter.content = window.serializeRichTextValue(nextHtml, parsedChapter.settings || {});
    return true;
  }

  function renderBatchProgress(entries) {
    if (!entries.length) {
      progressCard.style.display = 'none';
      return;
    }

    const completedCount = entries.filter((entry) => hasPromptBeenCompleted(entry)).length;
    const percent = Math.round((completedCount / entries.length) * 100);
    const completed = completedCount === entries.length;

    progressCard.style.display = 'block';
    progressPercent.textContent = `${percent}%`;
    progressState.textContent = completed ? 'completed' : completedCount ? 'in progress' : 'not started';
    progressCaption.textContent = `${completedCount} of ${entries.length} prompts completed`;
    progressFill.style.width = `${percent}%`;
    progressFill.classList.toggle('is-complete', completed);
    progressIcon.classList.toggle('is-complete', completed);
    progressIcon.textContent = completed ? 'OK' : '...';
  }

  function renderPromptCards(entries) {
    resultsGrid.innerHTML = entries.length
      ? entries.map((entry, index) => `
        <article class="beat-card daily-prompt-card ui-card ui-card-soft ui-card-stack">
          <h4>${index + 1}. ${entry.plotPoint}</h4>
          <p class="genre-pill">${entry.genre}</p>
          <p class="prompt-callout">${entry.prompt}</p>
          <p>${entry.context || 'Use this anywhere in the draft.'}</p>
          <p class="daily-prompt-status">Target: ${(Number(entry.requiredWordCount || extractPromptWordTarget(entry.prompt)) || 0).toLocaleString()} words</p>
          <div class="daily-prompt-answer">
            <label for="prompt-answer-${entry.id}">Your Answer</label>
            <textarea id="prompt-answer-${entry.id}" data-prompt-answer="${entry.id}" rows="5">${entry.answer || ''}</textarea>
          </div>
          <div class="daily-prompt-actions">
            <div class="field">
              <label for="prompt-chapter-${entry.id}">Add To Chapter</label>
              <select id="prompt-chapter-${entry.id}" data-prompt-chapter="${entry.id}">
                <option value="">Choose a chapter</option>
                ${getChapters().map((chapter) => `
                  <option value="${chapter.id}" ${entry.assignedChapterId === chapter.id ? 'selected' : ''}>
                    ${chapter.title || 'Untitled Chapter'}
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="daily-prompt-editor-actions">
              <button class="btn btn-save" type="button" data-save-prompt-answer="${entry.id}">Save Answer</button>
              <button class="btn btn-primary" type="button" data-add-prompt="${entry.id}" ${getChapters().length ? '' : 'disabled'}>
                Insert Into Chapter
              </button>
            </div>
          </div>
          <div class="daily-prompt-progress">
            <div class="goal-progress-track">
              <div class="goal-progress-fill ${buildCompletionSnapshot(entry).completed ? 'is-complete' : ''}" style="width:${buildCompletionSnapshot(entry).percent}%"></div>
            </div>
            <p class="daily-prompt-status">
              ${buildCompletionSnapshot(entry).state}: ${buildCompletionSnapshot(entry).caption}
            </p>
          </div>
        </article>
      `).join('')
      : '<p>No prompts found for this project yet.</p>';

    window.initializeTextEditor(resultsGrid);
    entries.forEach((entry) => {
      const answerField = resultsGrid.querySelector(`[data-prompt-answer="${entry.id}"]`);
      if (answerField) {
        window.refreshTextEditor(answerField, entry.answer || '');
      }
    });

    renderBatchProgress(entries);

    resultsGrid.querySelectorAll('[data-prompt-chapter]').forEach((input) => {
      input.addEventListener('change', async () => {
        const promptEntry = getDailyHistory().find((entry) => entry.id === input.dataset.promptChapter);
        if (!promptEntry) {
          return;
        }

        promptEntry.assignedChapterId = input.value;
        activeProject = await window.saveProjectData({
          ...activeProject,
          dailyPromptHistory: getDailyHistory(),
          updatedAt: new Date().toISOString(),
        }, {
          dirtyFields: ['dailyPromptHistory'],
        });
        renderPromptCards(getDailyHistory());
      });
    });

    resultsGrid.querySelectorAll('[data-add-prompt]').forEach((button) => {
      button.addEventListener('click', async () => {
        const promptEntry = getDailyHistory().find((entry) => entry.id === button.dataset.addPrompt);
        if (!promptEntry?.assignedChapterId) {
          status.textContent = 'Choose a chapter before adding this prompt.';
          return;
        }

        const chapters = getChapters().map((chapter) => ({ ...chapter }));
        const chapterIndex = chapters.findIndex((chapter) => chapter.id === promptEntry.assignedChapterId);
        if (chapterIndex < 0) {
          status.textContent = 'That chapter could not be found.';
          return;
        }

        const answerField = resultsGrid.querySelector(`[data-prompt-answer="${promptEntry.id}"]`);
        promptEntry.answer = window.getEditorFieldValue(answerField);
        const inserted = appendPromptAnswerToChapter(chapters[chapterIndex], promptEntry.answer);
        if (!inserted) {
          status.textContent = 'Write an answer before inserting it into a chapter.';
          return;
        }

        const insertedWordCount = window.computeWordCount(promptEntry.answer);
        const nextHistory = getDailyHistory().map((entry) => (
          entry.id === promptEntry.id
            ? {
              ...entry,
              assignedChapterId: promptEntry.assignedChapterId,
              answer: promptEntry.answer,
              requiredWordCount: Number(entry.requiredWordCount || extractPromptWordTarget(entry.prompt)),
              insertedWordCount,
              answerInsertedAt: new Date().toISOString(),
            }
            : entry
        ));

        activeProject = await window.saveProjectData({
          ...activeProject,
          chapters,
          dailyPromptHistory: nextHistory,
          currentWordCount: chapters.reduce(
            (sum, chapter) => sum + window.computeWordCount(chapter.content || ''),
            0,
          ),
          updatedAt: new Date().toISOString(),
        }, {
          dirtyFields: ['chapters', 'dailyPromptHistory', 'currentWordCount'],
        });

        const requiredWordCount = Number(promptEntry.requiredWordCount || extractPromptWordTarget(promptEntry.prompt));
        status.textContent = insertedWordCount >= requiredWordCount
          ? 'Prompt answer inserted into the selected chapter and marked complete.'
          : `Prompt answer inserted, but it is still below the ${requiredWordCount.toLocaleString()} word target.`;
        renderPromptCards(getDailyHistory());
      });
    });

    resultsGrid.querySelectorAll('[data-save-prompt-answer]').forEach((button) => {
      button.addEventListener('click', async () => {
        const promptEntry = getDailyHistory().find((entry) => entry.id === button.dataset.savePromptAnswer);
        const answerField = resultsGrid.querySelector(`[data-prompt-answer="${button.dataset.savePromptAnswer}"]`);
        if (!promptEntry || !answerField) {
          return;
        }

        promptEntry.answer = window.getEditorFieldValue(answerField);
        promptEntry.requiredWordCount = Number(promptEntry.requiredWordCount || extractPromptWordTarget(promptEntry.prompt));
        activeProject = await window.saveProjectData({
          ...activeProject,
          dailyPromptHistory: getDailyHistory(),
          updatedAt: new Date().toISOString(),
        }, {
          dirtyFields: ['dailyPromptHistory'],
        });
        status.textContent = 'Prompt answer saved.';
        renderPromptCards(getDailyHistory());
      });
    });
  }

  function generatePromptBatch() {
    const count = Number(countInput.value || 1);
    const mode = modeInput.value;

    let batch = [];
    if (mode === 'sequential') {
      const source = resources.sequentialSource.length ? resources.sequentialSource : resources.promptPool;
      batch = Array.from(
        { length: count },
        (_, offset) => source[(dailyState.cursor + offset) % source.length],
      ).filter(Boolean);
      dailyState.cursor += count;
    } else {
      const pool = [...resources.promptPool];
      while (pool.length && batch.length < count) {
        const index = Math.floor(Math.random() * pool.length);
        batch.push(pool.splice(index, 1)[0]);
      }
    }

    return batch.map((entry, index) => ({
      id: `daily-prompt-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      ...entry,
      context: getContextLabel(index),
      assignedChapterId: '',
      answer: '',
      answerInsertedAt: '',
      requiredWordCount: extractPromptWordTarget(entry.prompt),
      insertedWordCount: 0,
    }));
  }

  countInput.addEventListener('change', () => {
    if (countInput.value !== '1') {
      countInput.value = '1';
      status.textContent = 'Book Buddy Beta currently includes one prompt per day.';
    }
  });

  generateButton.addEventListener('click', async () => {
    const today = new Date();
    const lastGeneratedAt = activeProject.dailyPromptState?.lastGeneratedAt;

    if (Number(countInput.value) !== 1) {
      countInput.value = '1';
      status.textContent = 'Book Buddy Beta currently includes one prompt per day.';
      return;
    }

    if (lastGeneratedAt && isSameLocalDay(lastGeneratedAt, today)) {
      status.textContent = 'You have already used today\'s beta prompt.';
      renderPromptCards(getDailyHistory());
      return;
    }

    const prompts = generatePromptBatch();
    renderPromptCards(prompts);

    const updatedProject = {
      ...activeProject,
      dailyPromptState: {
        cursor: dailyState.cursor,
        lastMode: modeInput.value,
        lastCount: Number(countInput.value || 1),
        lastGeneratedAt: today.toISOString(),
      },
      dailyPromptHistory: prompts,
      updatedAt: today.toISOString(),
    };

    activeProject = await window.saveProjectData(updatedProject, {
      dirtyFields: ['dailyPromptState', 'dailyPromptHistory'],
    });

    status.textContent = 'Today\'s beta prompt is ready.';
  });

  syncPromptCountState();
  renderPromptCards(getDailyHistory());

  if (!activeProject.dailyPromptHistory?.length) {
    progressCard.style.display = 'none';
    resultsGrid.innerHTML = '<p>No prompts generated yet today.</p>';
  }
});
