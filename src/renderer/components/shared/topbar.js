const workflowSteps = [
  { id: 'create-project', label: 'Create Project' },
  { id: 'plot-creation', label: 'Plot' },
  { id: 'characters', label: 'Characters' },
  { id: 'scenes', label: 'Scenes' },
  { id: 'chapters', label: 'Chapters' },
  { id: 'daily-prompts', label: 'Challenges' },
];

const milestoneDefinitions = [
  {
    id: 'first-chapter',
    label: 'First Chapter',
    description: 'You started the manuscript.',
    isUnlocked(project) {
      return (project?.chapters || []).length >= 1;
    },
  },
  {
    id: 'plot-ready',
    label: 'Plot Ready',
    description: 'Your story foundation is taking shape.',
    isUnlocked(project) {
      const workbook = project?.plotWorkbook || {};
      return Boolean(workbook.premise || workbook.stakes || workbook.notes);
    },
  },
  {
    id: 'first-prompt-insert',
    label: 'Prompt Win',
    description: 'You turned a challenge into manuscript pages.',
    isUnlocked(project) {
      return (project?.dailyPromptHistory || []).some((entry) => entry.answerInsertedAt);
    },
  },
  {
    id: 'five-thousand-words',
    label: '5K Written',
    description: 'You crossed the 5,000 word mark.',
    isUnlocked(project) {
      return Number(project?.currentWordCount || 0) >= 5000;
    },
  },
  {
    id: 'goal-complete',
    label: 'Goal Complete',
    description: 'You hit your current manuscript goal.',
    isUnlocked(project) {
      const goal = Number(project?.wordCountGoal || 0);
      return goal > 0 && Number(project?.currentWordCount || 0) >= goal;
    },
  },
  {
    id: 'seven-day-streak',
    label: '7 Day Streak',
    description: 'A full week of writing momentum.',
    isUnlocked(project) {
      return computeChallengeStreak(project) >= 7;
    },
  },
];

function buildDayKey(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
}

function computeChallengeStreak(project) {
  const entries = [...new Set((project?.dailyPromptHistory || [])
    .map((entry) => buildDayKey(entry.answerInsertedAt || entry.insertedAt))
    .filter(Boolean))]
    .sort();

  if (!entries.length) {
    return 0;
  }

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (entries.includes(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function getProjectMilestoneSnapshot(project) {
  const unlockedMilestones = milestoneDefinitions
    .filter((milestone) => milestone.isUnlocked(project))
    .map((milestone) => milestone.id);

  return {
    unlockedMilestones,
    visibleBadges: milestoneDefinitions.filter((milestone) => unlockedMilestones.includes(milestone.id)),
  };
}

function getNextStepRecommendation(project) {
  if (!project) {
    return {
      page: 'create-project',
      label: 'Create Project',
      title: 'Start a new book workspace',
      description: 'Create a project so the guided writing flow can open up around it.',
    };
  }

  const workbook = project.plotWorkbook || {};
  const chapters = project.chapters || [];
  const characters = project.characters || [];
  const scenes = project.scenes || [];
  const completedChallenges = (project.dailyPromptHistory || []).filter((entry) => entry.answerInsertedAt).length;

  if (!workbook.premise && !workbook.stakes && !workbook.notes) {
    return {
      page: 'plot-creation',
      label: 'Build Plot',
      title: 'Shape the story foundation',
      description: 'Add your premise, stakes, and plot notes so the rest of the workflow has a strong spine.',
    };
  }

  if (!characters.length) {
    return {
      page: 'characters',
      label: 'Add Characters',
      title: 'Build your core cast',
      description: 'Create at least one character profile so prompts and chapters have someone to follow.',
    };
  }

  if (!scenes.length) {
    return {
      page: 'scenes',
      label: 'Sketch Scenes',
      title: 'Map out a few scene ideas',
      description: 'A couple of scene cards will make the chapter drafting flow feel much easier.',
    };
  }

  if (!chapters.length) {
    return {
      page: 'chapters',
      label: 'Draft Chapters',
      title: 'Start the manuscript',
      description: 'Add your first chapter and begin turning your plan into pages.',
    };
  }

  if (!completedChallenges) {
    return {
      page: 'daily-prompts',
      label: 'Try Challenges',
      title: 'Turn a prompt into pages',
      description: 'Use a daily challenge to generate fresh writing and insert it into your manuscript.',
    };
  }

  return {
    page: 'chapters',
    label: 'Keep Writing',
    title: 'Return to the manuscript',
    description: 'Your workspace is set up. The best next step is to keep drafting while the story is warm.',
  };
}

window.getProjectMilestoneSnapshot = getProjectMilestoneSnapshot;
window.getProjectMilestoneDefinitions = function getProjectMilestoneDefinitions() {
  return milestoneDefinitions.map((milestone) => ({ ...milestone }));
};

window.renderTopBar = function renderTopBar(currentPage, currentProject, saveStatus = {}) {
  const container = document.getElementById('topbar-container');
  if (!container) {
    return;
  }

  const hasProject = Boolean(currentProject);
  const goal = Number(currentProject?.wordCountGoal || 0);
  const words = Number(currentProject?.currentWordCount || 0);
  const progressPercent = goal > 0 ? Math.min(100, Math.round((words / goal) * 100)) : 0;
  const completedChallenges = (currentProject?.dailyPromptHistory || [])
    .filter((entry) => entry.answerInsertedAt)
    .length;
  const streak = computeChallengeStreak(currentProject);
  const milestoneSnapshot = getProjectMilestoneSnapshot(currentProject);
  const nextStep = getNextStepRecommendation(currentProject);
  const activeStepIndex = workflowSteps.findIndex((step) => step.id === currentPage);
  const saveTone = saveStatus.tone || 'neutral';
  const saveText = saveStatus.text || 'Ready to write';

  container.innerHTML = `
    <div class="topbar-shell">
      <div class="topbar-main">
        <div class="topbar-copy">
          <p class="topbar-kicker">${hasProject ? 'Current Workspace' : 'Welcome'}</p>
          <div class="topbar-title-row">
            <h2 class="topbar-title">${hasProject ? currentProject.title : 'Book Buddy Beta'}</h2>
            ${hasProject ? `<span class="topbar-save-state is-${saveTone}">${saveText}</span>` : ''}
          </div>
          <p class="topbar-subtitle">
            ${hasProject
              ? `${words.toLocaleString()} of ${goal.toLocaleString()} words tracked`
              : 'Create a project to unlock the full guided writing workflow.'}
          </p>
        </div>
        <div class="topbar-metrics">
          ${hasProject ? `
            <div class="topbar-metric">
              <span class="topbar-metric-value">${progressPercent}%</span>
              <span class="topbar-metric-label">Novel progress</span>
            </div>
            <div class="topbar-metric">
              <span class="topbar-metric-value">${completedChallenges}</span>
              <span class="topbar-metric-label">Challenge wins</span>
            </div>
            <div class="topbar-metric">
              <span class="topbar-metric-value">${streak}</span>
              <span class="topbar-metric-label">Day streak</span>
            </div>
          ` : ''}
        </div>
        <div class="topbar-actions">
          ${hasProject ? `
            <button
              id="topbar-reference"
              class="btn btn-ghost ${window.isReferenceDrawerOpen?.() ? 'is-active' : ''}"
              type="button"
            >
              Reference
            </button>
          ` : ''}
          ${hasProject ? '<button id="topbar-export" class="btn btn-ghost" type="button">Export</button>' : ''}
          <button id="topbar-new-project" class="btn btn-save" type="button">New Project</button>
        </div>
      </div>
      ${hasProject ? `
        <div class="topbar-badges">
          ${milestoneSnapshot.visibleBadges.length
      ? milestoneSnapshot.visibleBadges.slice(0, 4).map((milestone) => `
                <div class="topbar-badge" title="${milestone.description}">
                  <span class="topbar-badge-mark" aria-hidden="true">+</span>
                  <div class="topbar-badge-copy">
                    <span class="topbar-badge-label">${milestone.label}</span>
                    <span class="topbar-badge-description">${milestone.description}</span>
                  </div>
                </div>
              `).join('')
      : `
              <div class="topbar-badge is-empty">
                <div class="topbar-badge-copy">
                  <span class="topbar-badge-label">First milestone waiting</span>
                  <span class="topbar-badge-description">Start plotting or drafting to unlock progress badges.</span>
                </div>
              </div>
            `}
        </div>
      ` : ''}
      <div class="topbar-next-step">
        <div class="topbar-next-step-copy">
          <p class="topbar-next-step-kicker">Next Best Step</p>
          <h3 class="topbar-next-step-title">${nextStep.title}</h3>
          <p class="topbar-next-step-description">${nextStep.description}</p>
        </div>
        <button id="topbar-next-step" class="btn btn-primary" type="button" data-next-step="${nextStep.page}">
          ${nextStep.label}
        </button>
      </div>
      <div class="topbar-tracker">
        ${workflowSteps.map((step, index) => {
    const isLocked = !hasProject && step.id !== 'create-project';
    const isActive = step.id === currentPage;
    const isDone = hasProject && activeStepIndex > -1 && index < activeStepIndex;
    return `
            <button
              type="button"
              class="topbar-step ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''} ${isLocked ? 'is-locked' : ''}"
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
  container.querySelector('#topbar-reference')?.addEventListener('click', () => {
    window.toggleReferenceDrawer();
  });
  container.querySelector('#topbar-next-step')?.addEventListener('click', () => {
    if (nextStep.page === 'create-project') {
      window.navigate('create-project', { project: null });
      return;
    }

    window.navigate(nextStep.page);
  });

  container.querySelector('#topbar-export')?.addEventListener('click', async () => {
    if (!currentProject || typeof window.api?.exportProjectManuscript !== 'function') {
      window.setAppSaveStatus({
        tone: 'warning',
        text: 'Export is unavailable in this app session.',
      });
      return;
    }

    try {
      window.setAppSaveStatus({ tone: 'saving', text: 'Preparing export...' });
      const result = await window.api.exportProjectManuscript(currentProject);
      window.setAppSaveStatus({
        tone: result?.canceled ? 'neutral' : 'success',
        text: result?.canceled ? 'Export canceled.' : 'Export complete.',
      });
    } catch (error) {
      window.setAppSaveStatus({
        tone: 'warning',
        text: error?.message || 'Export failed.',
      });
    }
  });

  container.querySelectorAll('[data-topbar-step]').forEach((button) => {
    button.addEventListener('click', () => {
      const { topbarStep } = button.dataset;
      if (topbarStep === 'create-project') {
        window.navigate('create-project', { project: null });
        return;
      }

      window.navigate(topbarStep);
    });
  });
};
