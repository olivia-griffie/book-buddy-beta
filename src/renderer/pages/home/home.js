window.registerPageInit('home', async function () {
  const allProjects = await window.api.getAllProjects();
  const preferredProject = typeof window.choosePreferredProject === 'function'
    ? window.choosePreferredProject(allProjects, window.getCurrentProject()?.id || null)
    : (allProjects[0] || null);
  const visibleProjects = preferredProject ? [preferredProject] : [];
  const grid = document.getElementById('projects-grid');
  const empty = document.getElementById('empty-state');
  const newProjectButton = document.getElementById('btn-new-project');
  const betaBanner = document.getElementById('beta-project-banner');
  const dashboard = document.getElementById('daily-dashboard');

  function showCreateLimitMessage() {
    betaBanner.style.display = 'block';
    betaBanner.innerHTML = `
      <p class="eyebrow">Beta Limit</p>
      <p>Book Buddy Beta includes one project slot for now. Delete your current project to start a different one.</p>
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

  function computePromptStreak(project) {
    const days = [...new Set(
      (project?.dailyPromptHistory || [])
        .filter((entry) => entry.answerInsertedAt)
        .map((entry) => entry.answerInsertedAt.slice(0, 10))
        .filter(Boolean),
    )].sort();

    if (!days.length) return 0;
    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (days.includes(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function getTodaySessionEntry(project) {
    const todayKey = window.buildLocalDayKey(new Date());
    return (project?.dailySessionHistory || []).find((entry) => entry.date === todayKey) || null;
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
    const sessionHistory = project.dailySessionHistory || [];
    const streakSettings = project.streakSettings || { target: 100 };

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
    const writingStreak = Number(project?.streakState?.current || 0);
    const bestStreak = Number(project?.streakState?.best || 0);
    const todayEntry = getTodaySessionEntry(project);
    const wordsToday = Number(todayEntry?.wordsAdded || 0);
    const goal = Number(streakSettings?.target || 100);
    const remainingToday = Math.max(0, goal - wordsToday);
    const streakSecured = Boolean(todayEntry?.streakQualified);
    const sessionCount = Number(todayEntry?.sessionCount || 0);
    const touchedCount = Number(todayEntry?.chaptersTouched?.length || 0);
    const streakTone = streakSecured ? 'success' : 'warning';
    const streakLabel = streakSecured ? 'Streak secured today' : 'Not secured yet';
    const streakDetail = streakSecured
      ? `${wordsToday.toLocaleString()} words logged today.`
      : `${remainingToday.toLocaleString()} more words to count today.`;
    const streak = computePromptStreak(project);
    const activePrompts = (project.dailyPromptHistory || []).filter((entry) => !entry.answerInsertedAt);
    const todayKey = new Date().toISOString().slice(0, 10);
    const doneToday = (project.dailyPromptHistory || []).some((entry) => entry.answerInsertedAt?.slice(0, 10) === todayKey);

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
            <input
              type="date"
              class="daily-dashboard-date-input"
              data-dashboard-date-input
              value="${project.targetCompletionDate || ''}"
              aria-label="Target completion date"
            />
          </div>
          <div class="daily-dashboard-stat ui-card ui-card-soft ui-card-compact is-${pace.tone}">
            <span class="daily-dashboard-stat-label">${pace.status}</span>
            <strong>${pace.detail}</strong>
          </div>
          <div class="daily-dashboard-stat ui-card ui-card-soft ui-card-compact is-${streakTone}">
            <span class="daily-dashboard-stat-label">${streakLabel}</span>
            <strong>${streakDetail}</strong>
          </div>
        </div>
      </div>
      <div class="daily-dashboard-grid">
        <section class="daily-dashboard-panel ui-card ui-card-soft ui-card-stack">
          <h3>Today</h3>
          <div class="daily-dashboard-stat">
            <span class="daily-dashboard-stat-label">Words written</span>
            <strong>${wordsToday.toLocaleString()} / ${goal.toLocaleString()}</strong>
          </div>
          <div class="daily-dashboard-stat">
            <span class="daily-dashboard-stat-label">Sessions logged</span>
            <strong>${sessionCount.toLocaleString()}</strong>
          </div>
          <div class="daily-dashboard-stat">
            <span class="daily-dashboard-stat-label">Chapters touched</span>
            <strong>${touchedCount.toLocaleString()}</strong>
          </div>
        </section>
        <section class="daily-dashboard-panel ui-card ui-card-soft ui-card-stack">
          <h3>Writing Streak</h3>
          <div class="daily-dashboard-stat">
            <span class="daily-dashboard-stat-label">Current streak</span>
            <strong>${writingStreak.toLocaleString()} day${writingStreak === 1 ? '' : 's'}</strong>
          </div>
          <div class="daily-dashboard-stat">
            <span class="daily-dashboard-stat-label">Best streak</span>
            <strong>${bestStreak.toLocaleString()} day${bestStreak === 1 ? '' : 's'}</strong>
          </div>
          <div class="daily-dashboard-stat">
            <span class="daily-dashboard-stat-label">Daily goal</span>
            <strong>${goal.toLocaleString()} words</strong>
          </div>
        </section>
      </div>
      <details class="bb-collapse daily-dashboard-collapse" data-dashboard-collapse="goal">
        <summary>
          <div class="bb-collapse__header">
            <p class="eyebrow">Goal</p>
            <h3 class="bb-collapse__title">Set daily goal</h3>
            <p class="bb-collapse__meta">${goal.toLocaleString()} words needed to secure your writing streak each day.</p>
          </div>
          <span class="bb-collapse__chevron" aria-hidden="true">âŒ„</span>
        </summary>
        <div class="bb-collapse__body">
          <div class="daily-goal-editor">
            <div class="field">
              <label for="dashboard-daily-goal">Daily writing goal</label>
              <input id="dashboard-daily-goal" type="number" min="1" step="25" value="${goal}" />
            </div>
            <button class="btn btn-save" type="button" id="dashboard-save-goal">Save Goal</button>
          </div>
        </div>
      </details>
      <details class="bb-collapse daily-dashboard-collapse" data-dashboard-collapse="insights">
        <summary>
          <div class="bb-collapse__header">
            <p class="eyebrow">Writing Insights</p>
            <h3 class="bb-collapse__title">Weekly chart and 28-day calendar</h3>
            <p class="bb-collapse__meta">Open this when you want the broader view without crowding the home screen.</p>
          </div>
          <span class="bb-collapse__chevron" aria-hidden="true">âŒ„</span>
        </summary>
        <div class="bb-collapse__body">
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
      </details>
      <section class="home-prompt-widget ui-card ui-card-soft ui-card-stack">
        <div class="home-prompt-widget-head">
          <div>
            <p class="eyebrow">Writing Challenges</p>
            <h3>Today's Prompts</h3>
          </div>
          ${streak > 0 ? `
            <div class="home-streak-badge ${doneToday ? 'is-active' : 'is-warning'}" title="${doneToday ? 'Prompt streak maintained today' : 'Complete a prompt to keep your prompt streak'}">
              <span class="home-streak-flame">&#9889;</span>
              <span>${streak} day prompt streak${doneToday ? '' : ' at risk'}</span>
            </div>
          ` : ''}
        </div>
        ${activePrompts.length > 0 ? `
          <p class="home-prompt-widget-count">${activePrompts.length} active prompt${activePrompts.length === 1 ? '' : 's'} waiting for you.</p>
          <div class="home-prompt-previews">
            ${activePrompts.slice(0, 2).map((p) => `<p class="prompt-callout home-prompt-preview">${p.prompt || ''}</p>`).join('')}
          </div>
          <button class="btn btn-primary" type="button" id="home-go-to-challenges">Continue Writing</button>
        ` : `
          <p class="home-prompt-widget-count">${doneToday ? 'Great work today! Generate a new batch to keep the momentum.' : 'No active prompts. Start a quick challenge to build your streak.'}</p>
          <button class="btn btn-primary" type="button" id="home-go-to-challenges">Generate a Prompt</button>
        `}
      </section>
    `;

    dashboard.querySelector('[data-dashboard-date-input]')?.addEventListener('change', async (event) => {
      const newDate = event.target.value;
      project.targetCompletionDate = newDate;
      await window.saveProjectData({
        ...project,
        targetCompletionDate: newDate,
        updatedAt: new Date().toISOString(),
      }, { dirtyFields: ['targetCompletionDate'] });
      renderDashboard(project);
    });

    dashboard.querySelectorAll('[data-dashboard-collapse]').forEach((details) => {
      window.bindPersistentDetailsState?.(details, {
        projectId: project.id,
        sectionId: `home-dashboard-${details.dataset.dashboardCollapse}`,
        defaultOpen: false,
      });
    });

    dashboard.querySelector('#dashboard-save-goal')?.addEventListener('click', async () => {
      const input = dashboard.querySelector('#dashboard-daily-goal');
      const nextGoal = Math.max(1, Number(input?.value || goal));
      const nextProject = await window.saveProjectData({
        ...project,
        streakSettings: {
          ...(project.streakSettings || {}),
          target: nextGoal,
        },
        updatedAt: new Date().toISOString(),
      }, {
        dirtyFields: ['streakSettings'],
      });
      renderDashboard(nextProject);
    });

    dashboard.querySelector('#home-go-to-challenges')?.addEventListener('click', () => {
      window.navigate('daily-prompts');
    });
  }

  function handleNewProject() {
    if (visibleProjects.length >= 1) {
      showCreateLimitMessage();
      return;
    }

    window.navigate('create-project', { project: null });
  }

  newProjectButton?.addEventListener('click', handleNewProject);

  document.getElementById('btn-import-project')?.addEventListener('click', async () => {
    if (typeof window.api?.importProjectBackup !== 'function') {
      betaBanner.style.display = 'block';
      betaBanner.innerHTML = `<p class="eyebrow">Import</p><p>Import is not available in this session. Please restart Book Buddy and try again.</p>`;
      return;
    }
    try {
      const result = await window.api.importProjectBackup();
      if (result?.canceled) return;
      const imported = result.project;
      imported.id = `project-${Date.now()}`;
      imported.updatedAt = new Date().toISOString();
      await window.api.saveProject(imported);
      betaBanner.style.display = 'block';
      betaBanner.innerHTML = `<p class="eyebrow">Import Complete</p><p>"${imported.title}" has been restored. All your content, settings, and rich text are preserved.</p>`;
      await window.navigate('home');
    } catch (error) {
      betaBanner.style.display = 'block';
      betaBanner.innerHTML = `<p class="eyebrow">Import Failed</p><p>${error?.message || 'Could not import the project file. Make sure it was exported from Book Buddy.'}</p>`;
    }
  });

  document.getElementById('btn-empty-new')?.addEventListener('click', () => {
    window.navigate('create-project', { project: null });
  });

  if (!visibleProjects.length) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    dashboard.style.display = 'none';
    betaBanner.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  betaBanner.style.display = allProjects.length >= 1 ? 'block' : 'none';
  if (betaBanner.style.display === 'block') {
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
      const tags = (project.tags || [])
        .map((tag) => `<span class="project-tag-chip project-tag-chip-display">${tag}</span>`)
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
                <button class="project-thumb-icon-btn project-thumb-icon-btn-danger" type="button" data-remove-thumbnail="${project.id}" title="Remove thumbnail" aria-label="Remove thumbnail" ${project.thumbnail ? '' : 'disabled'}>×</button>
                <input type="file" accept="image/*" data-thumbnail-input="${project.id}" hidden />
              </div>
            </div>
          </div>
          <div class="project-info ui-card-body">
            <div class="project-title-row">
              <div class="project-title" data-project-title="${project.id}">${project.title}</div>
              <button class="btn btn-ghost project-title-edit" type="button" data-edit-project-title="${project.id}">Edit title</button>
            </div>
            <div class="project-subtitle">${project.subtitle || ''}</div>
            <div class="project-genres-row">
              <div class="project-genres">${genres || '<span class="genre-tag genre-tag-empty">No genre set</span>'}</div>
              <button class="btn btn-ghost project-genres-edit" type="button" data-edit-genres="${project.id}" title="Change genre">Change Genre</button>
            </div>
            ${tags ? `<div class="project-tag-chips">${tags}</div>` : ''}
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
              <div class="project-goal-editor" data-project-goal-details="${project.id}">
                <div class="project-goal-summary">
                  <div class="project-goal-copy">
                    <span class="project-goal-label">Word Count Goal</span>
                    <span class="project-goal-value">${(project.wordCountGoal || 0).toLocaleString()} words</span>
                    <span class="project-goal-label">Date To Complete</span>
                    <span class="project-goal-value">${formatShortDate(project.targetCompletionDate)}</span>
                  </div>
                  <button class="btn btn-ghost project-goal-toggle" type="button" data-toggle-goal="${project.id}">
                    Edit Project Goal
                    <span class="bb-collapse__chevron" aria-hidden="true">âŒ„</span>
                  </button>
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
                    <button class="btn btn-save" type="button" data-save-goal="${project.id}">Update</button>
                  </div>
                  <div class="project-tags-editor">
                    <label>Tags</label>
                    <div class="tag-input-row">
                      <input type="text" class="project-tag-editor-input" data-tag-input="${project.id}" placeholder="Type a tag and press Enter" maxlength="40" autocomplete="off" />
                      <button type="button" class="btn btn-ghost" data-tag-add="${project.id}">Add</button>
                    </div>
                    <div class="project-tags-list" data-tags-list="${project.id}">
                      ${(project.tags || []).map((tag) => `
                        <span class="project-tag-chip">
                          <span>${tag}</span>
                          <button type="button" class="project-tag-remove" data-card-remove-tag="${tag}" data-card-project="${project.id}" aria-label="Remove tag ${tag}">×</button>
                        </span>
                      `).join('')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="project-card-actions ui-card-footer">
            <button class="btn btn-ghost" type="button" data-open-project="${project.id}">Open</button>
            <button class="btn btn-ghost" type="button" data-export-project="${project.id}">Export</button>
            <button class="btn btn-ghost project-backup-btn" type="button" data-export-backup="${project.id}" title="Save a full backup of this project that can be imported after an app update">Export for Safe Keeping</button>
            <button class="btn btn-danger-soft" type="button" data-delete-project="${project.id}">Delete</button>
          </div>
        </div>
      `;
    })
    .join('');

  grid.querySelectorAll('.project-card').forEach((card) => {
    card.addEventListener('click', (event) => {
      if (event.target.closest('button, input, label, summary, details')) {
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

  grid.querySelectorAll('[data-edit-project-title]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      const project = allProjects.find((entry) => entry.id === button.dataset.editProjectTitle);
      if (!project) {
        return;
      }

      const nextTitle = await window.requestTextEntry?.({
        title: 'Edit project title',
        label: 'Project title',
        value: project.title || '',
        confirmLabel: 'Save title',
        placeholder: 'Enter a project title',
      });
      if (nextTitle == null) {
        return;
      }

      await window.renameProjectTitle?.(project.id, nextTitle);
      await window.navigate('home', { project: window.getCurrentProject() });
    });
  });

  grid.querySelectorAll('[data-edit-genres]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      const project = allProjects.find((entry) => entry.id === button.dataset.editGenres);
      if (!project) return;

      const nextGenres = await window.requestGenreSelection?.({
        title: 'Change Genre',
        currentGenres: project.genres || [],
      });
      if (!nextGenres) return;

      const updatedProject = {
        ...project,
        genres: nextGenres,
        updatedAt: new Date().toISOString(),
      };

      await window.saveProjectData(updatedProject, { dirtyFields: ['genres'] });
      await window.navigate('home', { project: window.getCurrentProject() });
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

  grid.querySelectorAll('[data-export-backup]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      const project = allProjects.find((entry) => entry.id === button.dataset.exportBackup);
      if (!project) return;
      if (typeof window.api?.exportProjectBackup !== 'function') {
        betaBanner.style.display = 'block';
        betaBanner.innerHTML = `<p class="eyebrow">Export</p><p>Export is not available in this session. Please restart Book Buddy and try again.</p>`;
        return;
      }
      try {
        const result = await window.api.exportProjectBackup(project);
        betaBanner.style.display = 'block';
        betaBanner.innerHTML = result?.canceled
          ? `<p class="eyebrow">Export</p><p>Export canceled.</p>`
          : `<p class="eyebrow">Project Saved</p><p>Your project has been exported to <strong>${result.filePath}</strong>. Import it any time from the home page.</p>`;
      } catch (error) {
        betaBanner.style.display = 'block';
        betaBanner.innerHTML = `<p class="eyebrow">Export Failed</p><p>${error?.message || 'Please restart the app and try again.'}</p>`;
      }
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
      const editor = button.closest('.project-goal-editor');
      const panel = editor?.querySelector('.project-goal-editor-panel');
      if (!editor || !panel) {
        return;
      }

      const nextOpen = !panel.classList.contains('is-open');
      panel.classList.toggle('is-open', nextOpen);
      button.setAttribute('aria-expanded', String(nextOpen));
      localStorage.setItem(`collapse:${button.dataset.toggleGoal}:home-project-goal`, nextOpen ? '1' : '0');
      if (nextOpen) {
        panel.querySelector('[data-goal-input]')?.focus();
      }
    });
  });

  grid.querySelectorAll('.project-goal-editor').forEach((editor) => {
    const toggle = editor.querySelector('[data-toggle-goal]');
    const panel = editor.querySelector('.project-goal-editor-panel');
    const projectId = toggle?.dataset.toggleGoal;
    if (!projectId || !panel || !toggle) {
      return;
    }

    const isOpen = localStorage.getItem(`collapse:${projectId}:home-project-goal`) === '1';
    panel.classList.toggle('is-open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
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
      const tagChips = [...grid.querySelectorAll(`[data-tags-list="${projectId}"] [data-card-remove-tag]`)];
      const tags = tagChips.map((btn) => btn.dataset.cardRemoveTag).filter(Boolean);
      const updatedProject = {
        ...project,
        wordCountGoal,
        targetCompletionDate,
        tags,
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

  function renderCardTags(projectId) {
    const tagsList = grid.querySelector(`[data-tags-list="${projectId}"]`);
    if (!tagsList) return;
    const currentTags = [...tagsList.querySelectorAll('[data-card-remove-tag]')].map((b) => b.dataset.cardRemoveTag);
    tagsList.innerHTML = currentTags.map((tag) => `
      <span class="project-tag-chip">
        <span>${tag}</span>
        <button type="button" class="project-tag-remove" data-card-remove-tag="${tag}" data-card-project="${projectId}" aria-label="Remove tag ${tag}">×</button>
      </span>
    `).join('');
    wireCardTagRemove(projectId);
  }

  function wireCardTagRemove(projectId) {
    grid.querySelectorAll(`[data-card-project="${projectId}"][data-card-remove-tag]`).forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        const tag = btn.dataset.cardRemoveTag;
        const tagsList = grid.querySelector(`[data-tags-list="${projectId}"]`);
        const remaining = [...tagsList.querySelectorAll('[data-card-remove-tag]')]
          .map((b) => b.dataset.cardRemoveTag)
          .filter((t) => t !== tag);
        tagsList.innerHTML = remaining.map((t) => `
          <span class="project-tag-chip">
            <span>${t}</span>
            <button type="button" class="project-tag-remove" data-card-remove-tag="${t}" data-card-project="${projectId}" aria-label="Remove tag ${t}">×</button>
          </span>
        `).join('');
        wireCardTagRemove(projectId);
      });
    });
  }

  grid.querySelectorAll('[data-tag-add]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      const projectId = btn.dataset.tagAdd;
      const tagInput = grid.querySelector(`[data-tag-input="${projectId}"]`);
      const raw = tagInput?.value.replace(/,/g, '').trim();
      if (!raw) return;
      const tagsList = grid.querySelector(`[data-tags-list="${projectId}"]`);
      const existing = [...tagsList.querySelectorAll('[data-card-remove-tag]')].map((b) => b.dataset.cardRemoveTag);
      if (!existing.includes(raw)) {
        const chip = document.createElement('span');
        chip.className = 'project-tag-chip';
        chip.innerHTML = `<span>${raw}</span><button type="button" class="project-tag-remove" data-card-remove-tag="${raw}" data-card-project="${projectId}" aria-label="Remove tag ${raw}">×</button>`;
        tagsList.appendChild(chip);
        wireCardTagRemove(projectId);
      }
      tagInput.value = '';
      tagInput.focus();
    });
  });

  grid.querySelectorAll('[data-tag-input]').forEach((input) => {
    input.addEventListener('click', (event) => event.stopPropagation());
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        event.stopPropagation();
        grid.querySelector(`[data-tag-add="${input.dataset.tagInput}"]`)?.click();
      }
    });
  });

  grid.querySelectorAll('[data-card-remove-tag]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      wireCardTagRemove(btn.dataset.cardProject);
      btn.closest('.project-tag-chip')?.remove();
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
});
