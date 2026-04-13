const workflowSteps = [
  { id: 'create-project', label: 'Create Project' },
  { id: 'plot-creation', label: 'Plot' },
  { id: 'characters', label: 'Characters' },
  { id: 'scenes', label: 'Scenes' },
  { id: 'chapters', label: 'Chapters' },
  { id: 'daily-prompts', label: 'Challenges' },
];

window.renderTopBar = function renderTopBar(currentPage, currentProject) {
  const container = document.getElementById('topbar-container');
  if (!container) {
    return;
  }

  const hasProject = Boolean(currentProject);
  const goal = Number(currentProject?.wordCountGoal || 0);
  const words = Number(currentProject?.currentWordCount || 0);
  const progressPercent = goal > 0 ? Math.min(100, Math.round((words / goal) * 100)) : 0;

  container.innerHTML = `
    <div class="topbar-shell">
      <div class="topbar-main-row">
        <div class="topbar-copy">
          <p class="topbar-kicker">${hasProject ? 'Current Workspace' : 'Start Here'}</p>
          <div class="topbar-title-row">
            <h2 class="topbar-title">${hasProject ? currentProject.title : 'Book Buddy Beta'}</h2>
            ${hasProject ? `<span class="topbar-progress-pill">${progressPercent}% complete</span>` : ''}
          </div>
          <p class="topbar-subtitle">
            ${hasProject
              ? `${words.toLocaleString()} of ${goal.toLocaleString()} words tracked`
              : 'Create a project to unlock the writing workflow.'}
          </p>
        </div>
        <div class="topbar-actions">
          ${hasProject ? '<button id="topbar-export" class="btn btn-ghost" type="button">Export</button>' : ''}
          <button id="topbar-new-project" class="btn btn-primary" type="button">New Project</button>
        </div>
      </div>
      <div class="topbar-tracker">
        ${workflowSteps.map((step, index) => {
          const isLocked = !hasProject && step.id !== 'create-project';
          const isActive = step.id === currentPage;
          return `
            <button
              type="button"
              class="topbar-step ${isActive ? 'is-active' : ''} ${isLocked ? 'is-locked' : ''}"
              data-topbar-step="${step.id}"
              ${isLocked ? 'disabled' : ''}
            >
              <span class="topbar-step-index">${index + 1}</span>
              <span>${step.label}</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;

  container.querySelector('#topbar-new-project')?.addEventListener('click', () => {
    window.navigate('create-project', { project: null });
  });

  container.querySelector('#topbar-export')?.addEventListener('click', async () => {
    if (!currentProject || typeof window.api?.exportProjectManuscript !== 'function') {
      return;
    }

    try {
      await window.api.exportProjectManuscript(currentProject);
    } catch (error) {
      console.error('Export failed.', error);
    }
  });

  container.querySelectorAll('[data-topbar-step]').forEach((button) => {
    button.addEventListener('click', () => {
      const page = button.dataset.topbarStep;
      if (!page) {
        return;
      }

      if (page === 'create-project') {
        window.navigate('create-project', { project: null });
        return;
      }

      window.navigate(page);
    });
  });
};
