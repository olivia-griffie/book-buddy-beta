window.initPage = async function ({ project }) {
  const activeProject = project || window.getCurrentProject();
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

  function renderPromptCards(entries) {
    resultsGrid.innerHTML = entries.length
      ? entries.map((entry, index) => `
        <article class="beat-card">
          <h4>${index + 1}. ${entry.plotPoint}</h4>
          <p class="genre-pill">${entry.genre}</p>
          <p class="prompt-callout">${entry.prompt}</p>
          <p>${entry.context || 'Use this anywhere in the draft.'}</p>
        </article>
      `).join('')
      : '<p>No prompts found for this project yet.</p>';
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
      ...entry,
      context: getContextLabel(index),
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
      renderPromptCards(activeProject.dailyPromptHistory || []);
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

    await window.saveProjectData(updatedProject);

    status.textContent = isTester
      ? `${prompts.length} prompt${prompts.length === 1 ? '' : 's'} generated in tester mode.`
      : 'Today\'s beta prompt is ready.';
  });

  testerCodeInput.value = '';
  testerCodeInput.placeholder = isTester ? 'Tester mode unlocked' : 'Enter admin code';
  unlockTesterButton.textContent = isTester ? 'Tester Mode Active' : 'Unlock Tester Mode';
  unlockTesterButton.disabled = isTester;

  syncPromptCountState();
  renderPromptCards(activeProject.dailyPromptHistory || []);

  if (!activeProject.dailyPromptHistory?.length) {
    resultsGrid.innerHTML = '<p>No prompts generated yet today.</p>';
  }
};
