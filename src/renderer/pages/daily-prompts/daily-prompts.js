window.initPage = async function ({ project }) {
  let activeProject = project || window.getCurrentProject();
  const emptyState = document.getElementById('daily-prompts-empty-state');
  const content = document.getElementById('daily-prompts-content');
  const createButton = document.getElementById('daily-prompts-create-project');
  const generateButton = document.getElementById('generate-prompts');
  const countInput = document.getElementById('prompt-count');
  const modeInput = document.getElementById('prompt-mode');
  const testerCodeInput = document.getElementById('tester-code');
  const unlockTesterButton = document.getElementById('unlock-tester-mode');
  const status = document.getElementById('daily-prompts-status');
  const resultsGrid = document.getElementById('prompt-results-grid');
  const progressCard = document.getElementById('daily-prompts-progress');
  const progressIcon = document.getElementById('daily-prompts-progress-icon');
  const progressPercent = document.getElementById('daily-prompts-progress-percent');
  const progressState = document.getElementById('daily-prompts-progress-state');
  const progressCaption = document.getElementById('daily-prompts-progress-caption');
  const progressFill = document.getElementById('daily-prompts-progress-fill');
  const settings = await window.api.getSettings();
  const isTester = Boolean(settings.betaTesterUnlocked);

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

  if (activeProject.dailyPromptHistory?.some((entry) => !entry.id)) {
    activeProject = await window.saveProjectData({
      ...activeProject,
      dailyPromptHistory: (activeProject.dailyPromptHistory || []).map((entry, index) => ({
        ...entry,
        id: entry.id || `daily-prompt-legacy-${Date.now()}-${index}`,
        assignedChapterId: entry.assignedChapterId || '',
      })),
      updatedAt: new Date().toISOString(),
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
    if (isTester) {
      return;
    }

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
    if (!entry?.assignedChapterId) {
      return false;
    }

    const chapter = getChapters().find((item) => item.id === entry.assignedChapterId);
    if (!chapter) {
      return false;
    }

    const parsed = window.parseRichTextValue(chapter.content || '');
    const temp = document.createElement('div');
    temp.innerHTML = parsed.html || '';
    const chapterText = temp.textContent || temp.innerText || '';
    return chapterText.includes(String(entry.prompt || '').trim());
  }

  function buildCompletionSnapshot(entry) {
    const completed = hasPromptBeenCompleted(entry);
    const percent = completed ? 100 : 0;
    return {
      completed,
      percent,
      state: completed ? 'completed' : entry.assignedChapterId ? 'added to chapter' : 'not added',
      caption: completed
        ? 'Prompt found in the linked chapter.'
        : entry.assignedChapterId
          ? 'Waiting for this prompt text to appear in the linked chapter.'
          : 'Choose a chapter and add this prompt to start writing.',
    };
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
        <article class="beat-card daily-prompt-card">
          <h4>${index + 1}. ${entry.plotPoint}</h4>
          <p class="genre-pill">${entry.genre}</p>
          <p class="prompt-callout">${entry.prompt}</p>
          <p>${entry.context || 'Use this anywhere in the draft.'}</p>
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
            <button class="btn btn-ghost" type="button" data-add-prompt="${entry.id}" ${getChapters().length ? '' : 'disabled'}>
              Add To Chapter
            </button>
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

        const marker = `Daily Prompt: ${promptEntry.prompt}`;
        const existingValue = String(chapters[chapterIndex].content || '');
        const parsed = window.parseRichTextValue(existingValue);
        const textOnly = (() => {
          const temp = document.createElement('div');
          temp.innerHTML = parsed.html || '';
          return temp.textContent || temp.innerText || '';
        })();

        if (!textOnly.includes(marker)) {
          const nextHtml = `${parsed.html || '<p><br></p>'}<p>${marker}</p>`;
          chapters[chapterIndex].content = window.serializeRichTextValue(nextHtml, parsed.settings || {});
        }

        const nextHistory = getDailyHistory().map((entry) => (
          entry.id === promptEntry.id
            ? {
              ...entry,
              assignedChapterId: promptEntry.assignedChapterId,
              insertedAt: new Date().toISOString(),
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
        });

        status.textContent = hasPromptBeenCompleted(nextHistory.find((entry) => entry.id === promptEntry.id))
          ? 'Prompt added to the selected chapter and marked completed.'
          : 'Prompt added to the selected chapter. Completion will verify once it appears in the draft.';
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
    }));
  }

  countInput.addEventListener('change', () => {
    if (!isTester && countInput.value !== '1') {
      countInput.value = '1';
      status.textContent = 'Book Buddy Beta currently includes one prompt per day. Buy the full version on release to unlock larger prompt packs.';
    }
  });

  unlockTesterButton?.addEventListener('click', async () => {
    const code = String(testerCodeInput.value || '').trim();
    if (code !== 'Tester') {
      status.textContent = 'That code did not unlock tester mode.';
      return;
    }

    await window.saveSettingsData({ betaTesterUnlocked: true });
    status.textContent = 'Tester mode unlocked. You can now generate multiple prompts for admin testing.';
    window.navigate('daily-prompts', { project: activeProject });
  });

  generateButton.addEventListener('click', async () => {
    const today = new Date();
    const lastGeneratedAt = activeProject.dailyPromptState?.lastGeneratedAt;

    if (!isTester && Number(countInput.value) !== 1) {
      countInput.value = '1';
      status.textContent = 'Book Buddy Beta currently includes one prompt per day. Buy the full version on release to unlock 3 and 5 prompt packs.';
      return;
    }

    if (!isTester && lastGeneratedAt && isSameLocalDay(lastGeneratedAt, today)) {
      status.textContent = 'You have already used today\'s beta prompt. Buy the full version on release for expanded prompt generation.';
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

    activeProject = await window.saveProjectData(updatedProject);

    status.textContent = isTester
      ? `${prompts.length} prompt${prompts.length === 1 ? '' : 's'} generated in tester mode.`
      : 'Today\'s beta prompt is ready.';
  });

  testerCodeInput.value = '';
  testerCodeInput.placeholder = isTester ? 'Tester mode unlocked' : 'Enter admin code';
  unlockTesterButton.textContent = isTester ? 'Tester Mode Active' : 'Unlock Tester Mode';
  unlockTesterButton.disabled = isTester;

  syncPromptCountState();
  renderPromptCards(getDailyHistory());

  if (!activeProject.dailyPromptHistory?.length) {
    progressCard.style.display = 'none';
    resultsGrid.innerHTML = '<p>No prompts generated yet today.</p>';
  }
};
