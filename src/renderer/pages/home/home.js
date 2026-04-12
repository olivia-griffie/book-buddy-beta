window.initPage = async function () {
  const allProjects = await window.api.getAllProjects();
  const settings = await window.api.getSettings();
  const isAdminMode = Boolean(settings.betaTesterUnlocked);
  const visibleProjects = isAdminMode ? allProjects : allProjects.slice(0, 1);
  const grid = document.getElementById('projects-grid');
  const empty = document.getElementById('empty-state');
  const newProjectButton = document.getElementById('btn-new-project');
  const betaBanner = document.getElementById('beta-project-banner');
  const dashboard = document.getElementById('daily-dashboard');
  const ADMIN_OVERRIDE_CODE = 'Tester';

  function showCreateLimitMessage() {
    betaBanner.style.display = 'block';
    betaBanner.innerHTML = `
      <p class="eyebrow">Beta Limit</p>
      <p>Book Buddy Beta includes one project slot for now. Delete your current project to start a different one, or buy the full version on release to unlock multiple projects.</p>
      <div class="admin-banner-row">
        <div class="field">
          <label for="home-admin-code">Admin Key</label>
          <input id="home-admin-code" type="password" placeholder="Enter admin key" />
        </div>
        <button id="unlock-home-admin" class="btn btn-ghost" type="button">Unlock Admin Mode</button>
      </div>
    `;

    const input = document.getElementById('home-admin-code');
    const button = document.getElementById('unlock-home-admin');
    button?.addEventListener('click', async () => {
      const code = String(input?.value || '').trim();
      if (code !== ADMIN_OVERRIDE_CODE) {
        betaBanner.innerHTML = `
          <p class="eyebrow">Admin Key</p>
          <p>That admin key did not unlock project override mode.</p>
        `;
        return;
      }

      await window.saveSettingsData({ betaTesterUnlocked: true });
      await window.navigate('home');
    });
  }

  function showAdminModeMessage() {
    betaBanner.style.display = 'block';
    betaBanner.innerHTML = `
      <p class="eyebrow">Admin Mode</p>
      <p>Admin mode is active on this device. Multiple project slots are available for testing.</p>
    `;
  }

  async function readImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read the selected thumbnail image.'));
      reader.readAsDataURL(file);
    });
  }

  function formatShortDate(value) {
    if (!value) {
      return 'Not set';
    }

    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) {
      return 'Not set';
    }

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function computePace(project) {
    const goal = Number(project.wordCountGoal || 0);
    const current = Number(project.currentWordCount || 0);
    const targetDate = project.targetCompletionDate;
    if (!goal || !targetDate) {
      return {
        status: 'Set a completion date to unlock pace tracking.',
        detail: 'Choose a target date so Book Buddy can tell you whether the project is on track.',
        tone: 'neutral',
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const finish = new Date(`${targetDate}T12:00:00`);
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysLeft = Math.ceil((finish - today) / msPerDay);
    const remainingWords = Math.max(0, goal - current);
    const recentWords = (project.dailyWordHistory || [])
      .slice(-7)
      .reduce((sum, entry) => sum + Number(entry.wordsWritten || 0), 0);
    const recentDailyAverage = Math.round(recentWords / 7);

    if (remainingWords === 0) {
      return {
        status: 'Goal complete',
        detail: 'You have already reached your current manuscript goal.',
        tone: 'success',
      };
    }

    if (daysLeft <= 0) {
      return {
        status: 'Past target date',
        detail: `${remainingWords.toLocaleString()} words still remain after your planned finish date.`,
        tone: 'warning',
      };
    }

    const neededPerDay = Math.ceil(remainingWords / daysLeft);
    const onTrack = recentDailyAverage >= neededPerDay;

    return {
      status: onTrack ? 'On track' : 'Needs a stronger pace',
      detail: `${neededPerDay.toLocaleString()} words/day needed. Recent average: ${recentDailyAverage.toLocaleString()} words/day.`,
      tone: onTrack ? 'success' : 'warning',
    };
  }

  function renderDashboard(project) {
    if (!project || !dashboard) {
      return;
    }

    const history = project.dailyWordHistory || [];
    if (!history.length && !project.targetCompletionDate) {
      dashboard.style.display = 'none';
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weeklyDates = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      return date;
    });

    const weeklyEntries = weeklyDates.map((date) => {
      const dateKey = window.buildLocalDayKey(date);
      const entry = history.find((item) => item.date === dateKey);
      return {
        label: date.toLocaleDateString(undefined, { weekday: 'short' }),
        value: Number(entry?.wordsWritten || 0),
      };
    });

    const maxWeekly = Math.max(...weeklyEntries.map((entry) => entry.value), 1);

    const calendarDates = Array.from({ length: 28 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (27 - index));
      const dateKey = window.buildLocalDayKey(date);
      const entry = history.find((item) => item.date === dateKey);
      return {
        key: dateKey,
        dayLabel: String(date.getDate()),
        value: Number(entry?.wordsWritten || 0),
      };
    });

    const maxCalendar = Math.max(...calendarDates.map((entry) => entry.value), 1);
    const pace = computePace(project);

    dashboard.style.display = 'grid';
    dashboard.innerHTML = `
      <div class="daily-dashboard-head">
        <div>
          <p class="eyebrow">Daily Dashboard</p>
          <h2>${project.title} Progress</h2>
          <p>See your recent writing rhythm and whether you are pacing toward your target finish date.</p>
        </div>
        <div class="daily-dashboard-meta">
          <div class="daily-dashboard-stat ui-card ui-card-soft ui-card-compact">
            <span class="daily-dashboard-stat-label">Date To Complete</span>
            <strong>${formatShortDate(project.targetCompletionDate)}</strong>
          </div>
          <div class="daily-dashboard-stat ui-card ui-card-soft ui-card-compact is-${pace.tone}">
            <span class="daily-dashboard-stat-label">${pace.status}</span>
            <strong>${pace.detail}</strong>
          </div>
        </div>
      </div>
      <div class="daily-dashboard-grid">
        <section class="daily-dashboard-panel ui-card ui-card-soft ui-card-stack">
          <h3>Weekly Writing</h3>
          <div class="daily-chart">
            ${weeklyEntries.map((entry) => `
              <div class="daily-chart-bar-group">
                <div class="daily-chart-bar-track">
                  <div class="daily-chart-bar-fill" style="height:${Math.max(10, Math.round((entry.value / maxWeekly) * 100))}%"></div>
                </div>
                <span class="daily-chart-bar-value">${entry.value ? entry.value.toLocaleString() : ''}</span>
                <span class="daily-chart-bar-label">${entry.label}</span>
              </div>
            `).join('')}
          </div>
        </section>
        <section class="daily-dashboard-panel ui-card ui-card-soft ui-card-stack">
          <h3>28 Day Writing Calendar</h3>
          <div class="daily-calendar">
            ${calendarDates.map((entry) => {
              const intensity = entry.value === 0 ? '0' : entry.value < maxCalendar * 0.34 ? '1' : entry.value < maxCalendar * 0.67 ? '2' : '3';
              return `
                <div class="daily-calendar-cell intensity-${intensity}" title="${entry.key}: ${entry.value.toLocaleString()} words">
                  <span>${entry.dayLabel}</span>
                </div>
              `;
            }).join('')}
          </div>
        </section>
      </div>
    `;
  }

  function handleNewProject() {
    if (!isAdminMode && visibleProjects.length >= 1) {
      showCreateLimitMessage();
      return;
    }

    window.navigate('create-project', { project: null });
  }

  newProjectButton?.addEventListener('click', handleNewProject);

  document.getElementById('btn-empty-new')?.addEventListener('click', () => {
    window.navigate('create-project', { project: null });
  });

  if (!visibleProjects.length) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    dashboard.style.display = 'none';
    betaBanner.style.display = isAdminMode ? 'block' : 'none';
    if (isAdminMode) {
      showAdminModeMessage();
    }
    return;
  }

  empty.style.display = 'none';
  betaBanner.style.display = (isAdminMode || allProjects.length >= 1) ? 'block' : 'none';
  if (betaBanner.style.display === 'block' && isAdminMode) {
    showAdminModeMessage();
  } else if (betaBanner.style.display === 'block') {
    showCreateLimitMessage();
  }

  grid.innerHTML = visibleProjects
    .map((project) => {
      const pct = project.wordCountGoal > 0
        ? Math.min(100, Math.round((project.currentWordCount / project.wordCountGoal) * 100))
        : 0;
      const completed = project.wordCountGoal > 0 && (project.currentWordCount || 0) >= project.wordCountGoal;
      const genres = (project.genres || [])
        .map((genre) => `<span class="genre-tag">${genre}</span>`)
        .join('');
      const thumb = project.thumbnail
        ? `<img src="${project.thumbnail}" alt="${project.title}" />`
        : '<span class="placeholder-icon">Book</span>';

      return `
        <div class="project-card ui-card ui-card-interactive" data-id="${project.id}">
          <div class="project-card-head ui-card-head">
            <div class="project-media">
              <div class="project-thumb">${thumb}</div>
              <div class="project-thumb-actions">
                <button class="upload-trigger upload-trigger-compact" type="button" data-change-thumbnail="${project.id}" title="${project.thumbnail ? 'Change thumbnail' : 'Upload thumbnail'}" aria-label="${project.thumbnail ? 'Change thumbnail' : 'Upload thumbnail'}">
                  <img class="upload-trigger-icon" src="../../public/upload.jpg" alt="" />
                </button>
                <button class="project-thumb-icon-btn project-thumb-icon-btn-danger" type="button" data-remove-thumbnail="${project.id}" title="Remove thumbnail" aria-label="Remove thumbnail" ${project.thumbnail ? '' : 'disabled'}>X</button>
                <input type="file" accept="image/*" data-thumbnail-input="${project.id}" hidden />
              </div>
            </div>
          </div>
          <div class="project-info ui-card-body">
            <div class="project-title">${project.title}</div>
            <div class="project-subtitle">${project.subtitle || ''}</div>
            <div class="project-genres">${genres}</div>
            <div class="project-progress goal-progress-card">
              <div class="goal-progress-head">
                <div class="progress-status-icon ${completed ? 'is-complete' : ''}">${completed ? 'OK' : '...'}</div>
                <div>
                  <div class="goal-progress-meta">
                    <span class="goal-progress-percent">${pct}%</span>
                    <span class="goal-progress-state">${completed ? 'Completed' : 'done'}</span>
                  </div>
                  <p class="goal-progress-caption">${(project.currentWordCount || 0).toLocaleString()} of ${(project.wordCountGoal || 0).toLocaleString()} words</p>
                </div>
              </div>
              <div class="goal-progress-track">
                <div class="goal-progress-fill ${completed ? 'is-complete' : ''}" style="width:${pct}%"></div>
              </div>
              <div class="project-goal-editor">
                <div class="project-goal-summary">
                  <div class="project-goal-copy">
                    <span class="project-goal-label">Word Count Goal</span>
                    <span class="project-goal-value">${(project.wordCountGoal || 0).toLocaleString()} words</span>
                    <span class="project-goal-label">Date To Complete</span>
                    <span class="project-goal-value">${formatShortDate(project.targetCompletionDate)}</span>
                  </div>
                  <button class="btn btn-ghost project-goal-toggle" type="button" data-toggle-goal="${project.id}">Edit</button>
                </div>
                <div class="project-goal-editor-panel">
                  <div class="project-goal-editor-row">
                    <div class="field">
                      <label for="goal-${project.id}">Update Goal</label>
                      <input id="goal-${project.id}" type="number" min="0" step="100" value="${project.wordCountGoal || 0}" data-goal-input="${project.id}" />
                    </div>
                    <div class="field">
                      <label for="target-date-${project.id}">Target Date</label>
                      <input id="target-date-${project.id}" type="date" value="${project.targetCompletionDate || ''}" data-target-date-input="${project.id}" />
                    </div>
                    <button class="btn btn-save" type="button" data-save-goal="${project.id}">Update Goal</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="project-card-actions ui-card-footer">
            <button class="btn btn-ghost" type="button" data-open-project="${project.id}">Open</button>
            <button class="btn btn-ghost" type="button" data-export-project="${project.id}">Export</button>
            <button class="btn btn-danger-soft" type="button" data-delete-project="${project.id}">Delete</button>
          </div>
        </div>
      `;
    })
    .join('');

  grid.querySelectorAll('.project-card').forEach((card) => {
    card.addEventListener('click', (event) => {
      if (event.target.closest('button, input, label')) {
        return;
      }

      const project = allProjects.find((entry) => entry.id === card.dataset.id);
      if (!project) {
        return;
      }

      window.showProjectNav(true);
      window.navigate('plot-creation', { project });
    });
  });

  grid.querySelectorAll('[data-open-project]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const project = allProjects.find((entry) => entry.id === button.dataset.openProject);
      window.showProjectNav(true);
      window.navigate('plot-creation', { project });
    });
  });

  grid.querySelectorAll('[data-delete-project]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      const projectId = button.dataset.deleteProject;
      const project = allProjects.find((entry) => entry.id === projectId);
      if (!project) {
        return;
      }

      const confirmed = window.confirm(`Delete "${project.title || 'this project'}"? This cannot be undone.`);
      if (!confirmed) {
        return;
      }

      await window.api.deleteProject(projectId);

      if (window.getCurrentProject()?.id === projectId) {
        window.setCurrentProject(null);
      }

      await window.navigate('home');
    });
  });

  grid.querySelectorAll('[data-export-project]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      const project = allProjects.find((entry) => entry.id === button.dataset.exportProject);
      if (!project) {
        return;
      }

      if (typeof window.api?.exportProjectManuscript !== 'function') {
        betaBanner.style.display = 'block';
        betaBanner.innerHTML = `
          <p class="eyebrow">Export</p>
          <p>Export is not available in the current app session. Restart Book Buddy Beta and try again.</p>
        `;
        return;
      }

      try {
        const result = await window.api.exportProjectManuscript(project);
        betaBanner.style.display = 'block';
        betaBanner.innerHTML = result?.canceled
          ? `
            <p class="eyebrow">Export</p>
            <p>Export canceled.</p>
          `
          : `
            <p class="eyebrow">Export Complete</p>
            <p>Your book was exported as ${result.format?.toUpperCase()} to ${result.filePath}.</p>
          `;
      } catch (error) {
        betaBanner.style.display = 'block';
        betaBanner.innerHTML = `
          <p class="eyebrow">Export Failed</p>
          <p>${error?.message || 'Please restart the app and try again.'}</p>
        `;
      }
    });
  });

  grid.querySelectorAll('[data-change-thumbnail]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const input = grid.querySelector(`[data-thumbnail-input="${button.dataset.changeThumbnail}"]`);
      input?.click();
    });
  });

  grid.querySelectorAll('[data-thumbnail-input]').forEach((input) => {
    input.addEventListener('change', async (event) => {
      event.stopPropagation();
      const projectId = event.currentTarget.dataset.thumbnailInput;
      const file = event.currentTarget.files?.[0];
      if (!file) {
        return;
      }

      const project = allProjects.find((entry) => entry.id === projectId);
      if (!project) {
        return;
      }

      try {
        const thumbnail = await readImage(file);
        const updatedProject = {
          ...project,
          thumbnail,
          updatedAt: new Date().toISOString(),
        };

        await window.saveProjectData(updatedProject, {
          dirtyFields: ['thumbnail'],
        });
        await window.navigate('home');
      } catch (error) {
        betaBanner.style.display = 'block';
        betaBanner.innerHTML = `
          <p class="eyebrow">Thumbnail Error</p>
          <p>${error.message}</p>
        `;
      }
    });
  });

  grid.querySelectorAll('[data-remove-thumbnail]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      const projectId = button.dataset.removeThumbnail;
      const project = allProjects.find((entry) => entry.id === projectId);
      if (!project) {
        return;
      }

      const updatedProject = {
        ...project,
        thumbnail: '',
        updatedAt: new Date().toISOString(),
      };

      await window.saveProjectData(updatedProject, {
        dirtyFields: ['thumbnail'],
      });
      await window.navigate('home');
    });
  });

  grid.querySelectorAll('[data-toggle-goal]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const panel = button.closest('.project-goal-editor')?.querySelector('.project-goal-editor-panel');
      panel?.classList.toggle('is-open');
      if (panel?.classList.contains('is-open')) {
        panel.querySelector('[data-goal-input]')?.focus();
      }
    });
  });

  grid.querySelectorAll('[data-save-goal]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      const projectId = button.dataset.saveGoal;
      const project = allProjects.find((entry) => entry.id === projectId);
      const input = grid.querySelector(`[data-goal-input="${projectId}"]`);
      const targetDateInput = grid.querySelector(`[data-target-date-input="${projectId}"]`);
      if (!project || !input) {
        return;
      }

      const wordCountGoal = Math.max(0, Number(input.value || 0));
      const targetCompletionDate = String(targetDateInput?.value || '').trim();
      const updatedProject = {
        ...project,
        wordCountGoal,
        targetCompletionDate,
        updatedAt: new Date().toISOString(),
      };

      await window.saveProjectData(updatedProject, {
        dirtyFields: ['wordCountGoal', 'targetCompletionDate'],
      });
      betaBanner.style.display = 'block';
      betaBanner.innerHTML = `
        <p class="eyebrow">Project Updated</p>
        <p>Your project goal is now ${wordCountGoal.toLocaleString()} words${targetCompletionDate ? ` with a target date of ${formatShortDate(targetCompletionDate)}` : ''}.</p>
      `;
      await window.navigate('home');
    });
  });

  grid.querySelectorAll('[data-goal-input]').forEach((input) => {
    input.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    input.addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const saveButton = grid.querySelector(`[data-save-goal="${event.currentTarget.dataset.goalInput}"]`);
      await saveButton?.click();
    });
  });

  const dashboardProject = visibleProjects.find((project) => project.id === window.getCurrentProject()?.id) || visibleProjects[0];
  renderDashboard(dashboardProject);
};
