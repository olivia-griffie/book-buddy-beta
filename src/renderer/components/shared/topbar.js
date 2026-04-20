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
    id: 'five-chapters',
    label: 'Five Chapters',
    description: 'The story is growing — five chapters in.',
    isUnlocked(project) {
      return (project?.chapters || []).length >= 5;
    },
  },
  {
    id: 'ten-chapters',
    label: 'Ten Chapters',
    description: 'Double digits. This manuscript has real shape.',
    isUnlocked(project) {
      return (project?.chapters || []).length >= 10;
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
    id: 'story-outlined',
    label: 'Story Outlined',
    description: 'The spine of the story is written down.',
    isUnlocked(project) {
      const raw = project?.plotWorkbook?.outline || '';
      const temp = document.createElement('div');
      temp.innerHTML = raw;
      return (temp.textContent || temp.innerText || '').trim().length >= 50;
    },
  },
  {
    id: 'first-character',
    label: 'First Character',
    description: 'Your cast is coming to life.',
    isUnlocked(project) {
      return (project?.characters || []).length >= 1;
    },
  },
  {
    id: 'first-scene',
    label: 'Scene Set',
    description: 'You built the first scene in the scene bank.',
    isUnlocked(project) {
      return (project?.scenes || []).length >= 1;
    },
  },
  {
    id: 'first-location',
    label: 'World Builder',
    description: 'Your story now has a place to live.',
    isUnlocked(project) {
      return (project?.locations || []).length >= 1;
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
    id: 'five-prompt-inserts',
    label: '5 Prompt Wins',
    description: 'Five challenges conquered and on the page.',
    isUnlocked(project) {
      return (project?.dailyPromptHistory || []).filter((entry) => entry.answerInsertedAt).length >= 5;
    },
  },
  {
    id: 'one-thousand-words',
    label: '1K Written',
    description: 'The first thousand words are always the hardest.',
    isUnlocked(project) {
      return Number(project?.currentWordCount || 0) >= 1000;
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
    id: 'ten-thousand-words',
    label: '10K Written',
    description: 'Ten thousand words of story on the page.',
    isUnlocked(project) {
      return Number(project?.currentWordCount || 0) >= 10000;
    },
  },
  {
    id: 'twenty-five-thousand-words',
    label: '25K Written',
    description: 'A quarter of a novel. Keep going.',
    isUnlocked(project) {
      return Number(project?.currentWordCount || 0) >= 25000;
    },
  },
  {
    id: 'fifty-thousand-words',
    label: '50K Written',
    description: 'NaNoWriMo territory. Remarkable.',
    isUnlocked(project) {
      return Number(project?.currentWordCount || 0) >= 50000;
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
  {
    id: 'thirty-day-streak',
    label: '30 Day Streak',
    description: 'A month of showing up. That is discipline.',
    isUnlocked(project) {
      return computeChallengeStreak(project) >= 30;
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

window.updateTopBarSaveState = function updateTopBarSaveState(saveStatus = {}) {
  const container = document.getElementById('topbar-container');
  if (!container) {
    return false;
  }

  const saveState = container.querySelector('.topbar-save-state');
  if (!saveState) {
    return false;
  }

  const saveTone = saveStatus.tone || 'neutral';
  const saveText = saveStatus.text || 'Ready to write';
  saveState.className = `topbar-save-state is-${saveTone}`;
  saveState.textContent = saveText;
  return true;
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
  const activeStepIndex = workflowSteps.findIndex((step) => step.id === currentPage);
  const saveTone = saveStatus.tone || 'neutral';
  const saveText = saveStatus.text || 'Ready to write';
  const showBadges = hasProject && window.shouldShowTopbarBadges?.();

  const isTopbarOpen = localStorage.getItem('topbarCollapsed') !== '1';

  container.innerHTML = `
    <details class="topbar-details"${isTopbarOpen ? ' open' : ''}>
      <summary class="topbar-summary">
        <div class="topbar-summary-left">
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
        <div class="topbar-summary-right">
          <span
            class="topbar-collapse-hint"
            title="For more writing room, collapse header"
            aria-label="For more writing room, collapse header"
          >
            <svg class="topbar-collapse-hint-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M4 7l6-4 6 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M4 13l6 4 6-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M10 3v14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
          </span>
          <span class="topbar-summary-chevron" aria-hidden="true">▾</span>
        </div>
      </summary>
      ${!localStorage.getItem('topbarHintDismissed') ? `
        <div class="topbar-collapse-bubble" id="topbar-collapse-bubble" role="status" aria-live="polite">
          <span>Click here to collapse header</span>
          <button type="button" class="topbar-collapse-bubble-close" aria-label="Dismiss hint">×</button>
        </div>
      ` : ''}
      <div class="topbar-shell">
        <div class="topbar-main">
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
            ${hasProject ? `<button id="topbar-quick-prompt" class="btn btn-ghost${completedChallenges === 0 ? ' topbar-quick-prompt-pulse' : ''}" type="button" title="Jump to Writing Challenges">Quick Prompt</button>` : ''}
            <button id="topbar-new-project" class="btn btn-save" type="button">New Project</button>
          </div>
        </div>
        ${showBadges ? `
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
      </div>
    </details>
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
  `;

  container.querySelector('#topbar-new-project')?.addEventListener('click', () => {
    window.navigate('create-project', { project: null });
  });
  container.querySelector('#topbar-quick-prompt')?.addEventListener('click', () => {
    window.navigate('daily-prompts');
  });
  container.querySelector('#topbar-reference')?.addEventListener('click', () => {
    window.toggleReferenceDrawer();
  });
  container.querySelector('.topbar-details')?.addEventListener('toggle', (e) => {
    if (e.target.open) {
      localStorage.removeItem('topbarCollapsed');
    } else {
      localStorage.setItem('topbarCollapsed', '1');
    }
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

  const bubble = container.querySelector('#topbar-collapse-bubble');
  if (bubble) {
    const dismissBubble = () => {
      localStorage.setItem('topbarHintDismissed', '1');
      bubble.classList.add('is-hiding');
      setTimeout(() => bubble.remove(), 300);
    };
    bubble.querySelector('.topbar-collapse-bubble-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissBubble();
    });
    container.querySelector('.topbar-summary')?.addEventListener('click', dismissBubble, { once: true });
    setTimeout(dismissBubble, 8000);
  }

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
