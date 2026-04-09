window.initPage = async function () {
  const allProjects = await window.api.getAllProjects();
  const visibleProjects = allProjects.slice(0, 1);
  const grid = document.getElementById('projects-grid');
  const empty = document.getElementById('empty-state');
  const newProjectButton = document.getElementById('btn-new-project');
  const betaBanner = document.getElementById('beta-project-banner');

  function showCreateLimitMessage() {
    betaBanner.style.display = 'block';
    betaBanner.innerHTML = `
      <p class="eyebrow">Beta Limit</p>
      <p>Book Buddy Beta includes one project slot for now. Delete your current project to start a different one, or buy the full version on release to unlock multiple projects.</p>
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

  function handleNewProject() {
    if (visibleProjects.length >= 1) {
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
      const thumb = project.thumbnail
        ? `<img src="${project.thumbnail}" alt="${project.title}" />`
        : '<span class="placeholder-icon">Book</span>';

      return `
        <div class="project-card" data-id="${project.id}">
          <div class="project-card-head">
            <div>
              <div class="project-thumb">${thumb}</div>
              <div class="project-thumb-actions">
                <button class="btn btn-ghost" type="button" data-change-thumbnail="${project.id}">${project.thumbnail ? 'Change Thumbnail' : 'Upload Thumbnail'}</button>
                <button class="btn btn-ghost" type="button" data-remove-thumbnail="${project.id}" ${project.thumbnail ? '' : 'disabled'}>Remove Thumbnail</button>
                <input type="file" accept="image/*" data-thumbnail-input="${project.id}" hidden />
              </div>
            </div>
            <div class="project-card-actions">
              <button class="btn btn-ghost" type="button" data-open-project="${project.id}">Open</button>
              <button class="btn btn-ghost" type="button" data-delete-project="${project.id}">Delete</button>
            </div>
          </div>
          <div class="project-info">
            <div class="project-title">${project.title}</div>
            <div class="project-subtitle">${project.subtitle || ''}</div>
            <div class="project-genres">${genres}</div>
            <div class="project-progress goal-progress-card">
              <div class="goal-progress-head">
                <div class="progress-status-icon ${completed ? 'is-complete' : ''}">${completed ? '✓' : '•'}</div>
                <div>
                  <div class="goal-progress-meta">
                    <span class="goal-progress-percent">${pct}%</span>
                    <span class="goal-progress-state">${completed ? 'Completed' : 'in progress'}</span>
                  </div>
                  <p class="goal-progress-caption">${(project.currentWordCount || 0).toLocaleString()} of ${(project.wordCountGoal || 0).toLocaleString()} words</p>
                </div>
              </div>
              <div class="goal-progress-track">
                <div class="goal-progress-fill ${completed ? 'is-complete' : ''}" style="width:${pct}%"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  grid.querySelectorAll('[data-open-project]').forEach((button) => {
    button.addEventListener('click', () => {
      const project = allProjects.find((entry) => entry.id === button.dataset.openProject);
      window.showProjectNav(true);
      window.navigate('plot-creation', { project });
    });
  });

  grid.querySelectorAll('[data-delete-project]').forEach((button) => {
    button.addEventListener('click', async () => {
      const projectId = button.dataset.deleteProject;
      await window.api.deleteProject(projectId);

      if (window.getCurrentProject()?.id === projectId) {
        window.setCurrentProject(null);
      }

      await window.navigate('home');
    });
  });

  grid.querySelectorAll('[data-change-thumbnail]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = grid.querySelector(`[data-thumbnail-input="${button.dataset.changeThumbnail}"]`);
      input?.click();
    });
  });

  grid.querySelectorAll('[data-thumbnail-input]').forEach((input) => {
    input.addEventListener('change', async (event) => {
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

        await window.saveProjectData(updatedProject);
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
    button.addEventListener('click', async () => {
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

      await window.saveProjectData(updatedProject);
      await window.navigate('home');
    });
  });
};
