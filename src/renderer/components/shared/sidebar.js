const baseSidebarItems = [
  { id: 'home', label: 'Home' },
  { id: 'create-project', label: 'Create Project' },
];

const projectSidebarItems = [
  { id: 'plot-creation', label: 'Plot Creation' },
  { id: 'chapters', label: 'Chapters' },
  { id: 'characters', label: 'Characters' },
  { id: 'scenes', label: 'Scenes' },
  { id: 'locations', label: 'Locations' },
  { id: 'daily-prompts', label: 'Daily Prompts' },
];

window.renderSidebar = function renderSidebar(currentPage, currentProject) {
  const container = document.getElementById('sidebar-container');
  if (!container) {
    return;
  }

  const projectTitle = currentProject?.title || 'No project selected';
  const hasProject = Boolean(currentProject);
  const sidebarItems = currentProject
    ? [...baseSidebarItems, ...projectSidebarItems]
    : baseSidebarItems;

  container.innerHTML = `
    <div class="sidebar">
      <div class="sidebar-brand">
        <img
          class="sidebar-brand-logo"
          src="../../public/logo-full.png"
          alt="Book Buddy"
        />
        <p class="sidebar-kicker">Writer's Hub</p>
        <div class="sidebar-project-status">
          <span class="sidebar-project-pill ${hasProject ? 'is-selected' : 'is-empty'}">
            ${hasProject ? 'Project Selected' : 'No Project Selected'}
          </span>
          <p class="sidebar-project-title">${projectTitle}</p>
        </div>
      </div>
      <nav class="sidebar-nav">
        ${sidebarItems
          .map((item) => `
            <button
              type="button"
              class="sidebar-link ${item.id === currentPage ? 'is-active' : ''}"
              data-page="${item.id}"
            >
              ${item.label}
            </button>
          `)
          .join('')}
      </nav>
    </div>
  `;

  container.querySelectorAll('[data-page]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.page === 'create-project') {
        window.navigate('create-project', { project: null });
        return;
      }

      window.navigate(button.dataset.page);
    });
  });
};
