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
  const resources = window.getProjectResources(activeProject, {
    genrePrompts,
    specificPrompts,
    hybridGuides,
  });
  const hybridPromptSection = document.getElementById('hybrid-prompts-section');
  const hybridPromptGrid = document.getElementById('hybrid-prompt-grid');

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

  const hybridSection = document.getElementById('hybrid-guide-section');
  const hybridGrid = document.getElementById('hybrid-guide-grid');
  if (resources.hybridGuide) {
    hybridSection.style.display = 'grid';
    document.getElementById('hybrid-guide-title').textContent = resources.hybridGuide.genre;
    hybridGrid.innerHTML = Object.entries(resources.hybridGuide.beats)
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

  if (resources.hybridTrack?.beats?.length) {
    hybridPromptSection.style.display = 'block';
    document.getElementById('hybrid-prompts-title').textContent = resources.hybridTrack.genre;
    hybridPromptGrid.innerHTML = buildBeatCards(resources.hybridTrack.beats, resources.hybridTrack.prompts);
  } else {
    hybridPromptSection.style.display = 'none';
  }

  saveButton.addEventListener('click', async () => {
    const updatedProject = {
      ...activeProject,
      plotSections: resources.plotSections,
      plotWorkbook: {
        premise: premiseInput.value.trim(),
        stakes: stakesInput.value.trim(),
        notes: notesInput.value.trim(),
      },
      updatedAt: new Date().toISOString(),
    };

    await window.saveProjectData(updatedProject);
    saveMessage.textContent = 'Plot notes saved.';
  });
};
