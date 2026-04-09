window.initPage = async function () {
  const projects = await window.api.getAllProjects();
  const grid = document.getElementById('projects-grid');
  const empty = document.getElementById('empty-state');

  document.getElementById('btn-new-project')?.addEventListener('click', () => {
    window.navigate('create-project');
  });
  document.getElementById('btn-empty-new')?.addEventListener('click', () => {
    window.navigate('create-project');
  });

  if (!projects.length) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  grid.innerHTML = projects.map(p => {
    const pct = p.wordCountGoal > 0
      ? Math.min(100, Math.round((p.currentWordCount / p.wordCountGoal) * 100))
      : 0;
    const genres = (p.genres || []).map(g => `<span class="genre-tag">${g}</span>`).join('');
    const thumb = p.thumbnail
      ? `<img src="${p.thumbnail}" alt="${p.title}" />`
      : `<span class="placeholder-icon">📖</span>`;

    return `
      <div class="project-card" data-id="${p.id}">
        <div class="project-thumb">${thumb}</div>
        <div class="project-info">
          <div class="project-title">${p.title}</div>
          <div class="project-subtitle">${p.subtitle || ''}</div>
          <div class="project-genres">${genres}</div>
          <div class="project-progress">
            <div class="progress-label">
              <span>${(p.currentWordCount || 0).toLocaleString()} words</span>
              <span>${pct}%</span>
            </div>
            <div class="progress-bar-track">
              <div class="progress-bar-fill" style="width:${pct}%"></div>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', () => {
      const project = projects.find(p => p.id === card.dataset.id);
      window.showProjectNav(true);
      window.navigate('plot-creation', { project });
    });
  });
};
