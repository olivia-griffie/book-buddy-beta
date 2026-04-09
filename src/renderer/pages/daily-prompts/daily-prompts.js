window.initPage = async function ({ project }) {
  const activeProject = project || window.getCurrentProject();
  const emptyState = document.getElementById('daily-prompts-empty-state');
  const content = document.getElementById('daily-prompts-content');
  const createButton = document.getElementById('daily-prompts-create-project');
  const generateButton = document.getElementById('generate-prompts');
  const countInput = document.getElementById('prompt-count');
  const modeInput = document.getElementById('prompt-mode');
  const status = document.getElementById('daily-prompts-status');
  const resultsGrid = document.getElementById('prompt-results-grid');

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

  generateButton.addEventListener('click', async () => {
    const prompts = generatePromptBatch();
    renderPromptCards(prompts);

    await window.saveProjectData({
      ...activeProject,
      dailyPromptState: {
        cursor: dailyState.cursor,
        lastMode: modeInput.value,
        lastCount: Number(countInput.value || 1),
        lastGeneratedAt: new Date().toISOString(),
      },
      dailyPromptHistory: prompts,
      updatedAt: new Date().toISOString(),
    });

    status.textContent = modeInput.value === 'sequential'
      ? 'Sequential prompts generated.'
      : 'Wild prompts generated.';
  });

  renderPromptCards(activeProject.dailyPromptHistory || []);
  if (!activeProject.dailyPromptHistory?.length) {
    resultsGrid.innerHTML = '<p>No prompts generated yet today.</p>';
  }
};
