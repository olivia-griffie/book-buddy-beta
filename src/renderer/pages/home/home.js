window.initPage = async function () {
  const projects = await window.api.getAllProjects();
  const grid = document.getElementById('projects-grid');
  const empty = document.getElementById('empty-state');

  document.getElementById('btn-new-project')?.addEventListener('click', () => {
    window.navigate('create-project', { project: null });
  });

  document.getElementById('btn-empty-new')?.addEventListener('click', () => {
    window.navigate('create-project', { project: null });
  });

  if (!projects.length) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  grid.innerHTML = projects
    .map((project) => {
      const pct = project.wordCountGoal > 0
        ? Math.min(100, Math.round((project.currentWordCount / project.wordCountGoal) * 100))
        : 0;
      const genres = (project.genres || [])
        .map((genre) => `<span class="genre-tag">${genre}</span>`)
        .join('');
      const thumb = project.thumbnail
        ? `<img src="${project.thumbnail}" alt="${project.title}" />`
        : '<span class="placeholder-icon">Book</span>';

      return `
        <div class="project-card" data-id="${project.id}">
          <div class="project-thumb">${thumb}</div>
          <div class="project-info">
            <div class="project-title">${project.title}</div>
            <div class="project-subtitle">${project.subtitle || ''}</div>
            <div class="project-genres">${genres}</div>
            <div class="project-progress">
              <div class="progress-label">
                <span>${(project.currentWordCount || 0).toLocaleString()} words</span>
                <span>${pct}%</span>
              </div>
              <div class="progress-bar-track">
                <div class="progress-bar-fill" style="width:${pct}%"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  grid.querySelectorAll('.project-card').forEach((card) => {
    card.addEventListener('click', () => {
      const project = projects.find((entry) => entry.id === card.dataset.id);
      window.showProjectNav(true);
      window.navigate('plot-creation', { project });
    });
  });
};
