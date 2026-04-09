window.initPage = async function ({ project }) {
  const activeProject = project || window.getCurrentProject();
  const emptyState = document.getElementById('plot-empty-state');
  const content = document.getElementById('plot-content');
  const createProjectButton = document.getElementById('plot-create-project');
  const saveButton = document.getElementById('save-plot-workbook');
  const saveMessage = document.getElementById('plot-save-message');
  const premiseInput = document.getElementById('plot-premise');
  const stakesInput = document.getElementById('plot-stakes');
  const notesInput = document.getElementById('plot-notes');

  createProjectButton?.addEventListener('click', () => window.navigate('create-project', { project: null }));

  if (!activeProject) {
    emptyState.style.display = 'grid';
    content.style.display = 'none';
    saveButton.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  content.style.display = 'grid';
  saveButton.style.display = 'inline-flex';
  document.getElementById('plot-page-title').textContent = activeProject.title || 'Plot Builder';
  document.getElementById('plot-page-subtitle').textContent = (activeProject.genres || []).join(' + ');

  const workbook = activeProject.plotWorkbook || {};
  premiseInput.value = workbook.premise || '';
  stakesInput.value = workbook.stakes || '';
  notesInput.value = workbook.notes || '';

  const { genrePrompts, specificPrompts, hybridGuides } = await window.getGenrePromptData();
  const selectedGenres = activeProject.genres || [];
  const selectedKeys = selectedGenres.map((genre) => window.normalizeGenreKey(genre));
  const hybridPromptSection = document.getElementById('hybrid-prompts-section');
  const hybridPromptGrid = document.getElementById('hybrid-prompt-grid');

  function isMatchingHybridEntry(genreName) {
    const genreKey = window.normalizeGenreKey(genreName);
    return selectedKeys.length === 2
      && selectedKeys.every((key) => genreKey.includes(key))
      && genreKey.includes('-');
  }

  function buildBeatCards(entries, matchingPrompts) {
    if (!entries.length) {
      return '<article class="beat-card"><p>No plot data found for this genre yet.</p></article>';
    }

    return entries
      .map((entry) => {
        const promptEntry = matchingPrompts.find((prompt) => prompt.plotPoint === entry.plotPoint);

        return `
          <article class="beat-card">
            <h4>${entry.plotPoint}</h4>
            <ul>
              ${entry.questions.map((question) => `<li>${question}</li>`).join('')}
            </ul>
            ${promptEntry?.prompt ? `<p class="prompt-callout">${promptEntry.prompt}</p>` : ''}
          </article>
        `;
      })
      .join('');
  }

  const hybridGuide = selectedGenres.length === 2
    ? hybridGuides.find((entry) => {
      const entryKey = window.normalizeGenreKey(entry.genre);
      const forward = `${selectedKeys[0]} x ${selectedKeys[1]}`;
      const reverse = `${selectedKeys[1]} x ${selectedKeys[0]}`;
      return entryKey === forward || entryKey === reverse;
    })
    : null;

  const hybridSection = document.getElementById('hybrid-guide-section');
  const hybridGrid = document.getElementById('hybrid-guide-grid');
  if (hybridGuide) {
    hybridSection.style.display = 'grid';
    document.getElementById('hybrid-guide-title').textContent = hybridGuide.genre;
    hybridGrid.innerHTML = Object.entries(hybridGuide.beats)
      .map(([label, text]) => `
        <article class="hybrid-beat">
          <h3>${label}</h3>
          <p>${text}</p>
        </article>
      `)
      .join('');
  } else {
    hybridSection.style.display = 'none';
  }

  const hybridPromptEntries = selectedGenres.length === 2
    ? genrePrompts.filter((entry) => isMatchingHybridEntry(entry.genre))
    : [];
  const hybridSpecificPrompts = selectedGenres.length === 2
    ? specificPrompts.filter((entry) => isMatchingHybridEntry(entry.genre))
    : [];

  if (hybridPromptEntries.length) {
    hybridPromptSection.style.display = 'block';
    document.getElementById('hybrid-prompts-title').textContent = hybridPromptEntries[0].genre;
    hybridPromptGrid.innerHTML = buildBeatCards(hybridPromptEntries, hybridSpecificPrompts);
  } else {
    hybridPromptSection.style.display = 'none';
  }

  const genreSections = document.getElementById('genre-beat-sections');
  genreSections.innerHTML = selectedGenres
    .map((genre) => {
      const genreKey = window.normalizeGenreKey(genre);
      const beats = genrePrompts.filter((entry) => window.normalizeGenreKey(entry.genre) === genreKey);
      const prompts = specificPrompts.filter((entry) => window.normalizeGenreKey(entry.genre) === genreKey);
      const cards = buildBeatCards(beats, prompts);

      return `
        <section class="genre-section">
          <div class="genre-section-header">
            <div>
              <p class="eyebrow">Genre Track</p>
              <h2>${genre}</h2>
            </div>
            <span class="genre-pill">${beats.length} beats</span>
          </div>
          <div class="beat-grid">${cards}</div>
        </section>
      `;
    })
    .join('');

  saveButton.addEventListener('click', async () => {
    const updatedProject = {
      ...activeProject,
      plotWorkbook: {
        premise: premiseInput.value.trim(),
        stakes: stakesInput.value.trim(),
        notes: notesInput.value.trim(),
      },
      updatedAt: new Date().toISOString(),
    };

    await window.api.saveProject(updatedProject);
    window.setCurrentProject(updatedProject);
    saveMessage.textContent = 'Plot notes saved.';
  });
};
