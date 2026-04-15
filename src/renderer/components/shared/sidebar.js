const sidebarGroups = [
  {
    label: 'Project Setup',
    requiresProject: false,
    items: [
      { id: 'home', label: 'Home', icon: 'H' },
      { id: 'create-project', label: 'Create Project', icon: '+' },
    ],
  },
  {
    label: 'Story Building',
    requiresProject: true,
    items: [
      { id: 'plot-creation', label: 'Plot', icon: 'P' },
      { id: 'characters', label: 'Characters', icon: 'C' },
      { id: 'scenes', label: 'Scenes', icon: 'S' },
      { id: 'locations', label: 'Locations', icon: 'L' },
    ],
  },
  {
    label: 'Writing',
    requiresProject: true,
    items: [
      { id: 'chapters', label: 'Chapters', icon: 'W' },
      { id: 'daily-prompts', label: 'Challenges', icon: 'D' },
    ],
  },
];

function formatTargetDate(value) {
  if (!value) {
    return 'No target date';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'No target date';
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getSidebarSnapshot(currentProject) {
  const genres = (currentProject?.genres || []).filter(Boolean);
  const characters = currentProject?.characters || [];
  const leadCharacters = characters
    .filter((character) => Array.isArray(character.typeTags) && character.typeTags.length)
    .slice(0, 3)
    .map((character) => character.name || 'Unnamed Character');

  return {
    genres: genres.length ? genres.join(' x ') : 'Genre not set',
    wordGoal: Number(currentProject?.wordCountGoal || 0).toLocaleString() || '0',
    targetDate: formatTargetDate(currentProject?.targetCompletionDate),
    chapterCount: (currentProject?.chapters || []).length,
    characterCount: characters.length,
    leadCharacters: leadCharacters.length ? leadCharacters : characters.slice(0, 3).map((character) => character.name || 'Unnamed Character'),
  };
}

window.renderSidebar = function renderSidebar(currentPage, currentProject) {
  const container = document.getElementById('sidebar-container');
  if (!container) {
    return;
  }

  const projectTitle = currentProject?.title || '';
  const hasProject = Boolean(currentProject);
  const isCollapsed = Boolean(window.isSidebarCollapsed?.());
  const visibleGroups = sidebarGroups.filter((group) => hasProject || !group.requiresProject);
  const snapshot = hasProject ? getSidebarSnapshot(currentProject) : null;
  container.classList.toggle('is-collapsed', isCollapsed);

  container.innerHTML = `
    <div class="sidebar ${isCollapsed ? 'is-collapsed' : ''}">
      <button
        class="sidebar-toggle"
        type="button"
        data-sidebar-toggle
        aria-label="${isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}"
        title="${isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}"
      >
        <span class="sidebar-toggle-icon" aria-hidden="true"></span>
      </button>
      <div class="sidebar-brand">
        <div class="sidebar-brand-mark">
          <img
            class="sidebar-brand-icon"
            src="../../public/sidebar-book.png"
            alt="Book Buddy"
          />
        </div>
        ${isCollapsed ? '' : `
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
            ${hasProject ? `<p class="sidebar-project-title">${projectTitle}</p>` : ''}
          </div>
        `}
        ${hasProject && !isCollapsed ? `
          <section class="sidebar-project-snapshot">
            <div class="sidebar-snapshot-grid">
              <article class="sidebar-snapshot-card">
                <p class="sidebar-snapshot-label">Genre</p>
                <p class="sidebar-snapshot-value">${snapshot.genres}</p>
              </article>
              <article class="sidebar-snapshot-card">
                <p class="sidebar-snapshot-label">Word Goal</p>
                <p class="sidebar-snapshot-value">${snapshot.wordGoal} words</p>
              </article>
              <article class="sidebar-snapshot-card">
                <p class="sidebar-snapshot-label">Target Date</p>
                <p class="sidebar-snapshot-value">${snapshot.targetDate}</p>
              </article>
              <article class="sidebar-snapshot-card">
                <p class="sidebar-snapshot-label">Story Map</p>
                <p class="sidebar-snapshot-value">${snapshot.chapterCount} chapters, ${snapshot.characterCount} characters</p>
              </article>
            </div>
            <div class="sidebar-snapshot-leads">
              <p class="sidebar-snapshot-label">Core Cast</p>
              <div class="sidebar-snapshot-chip-row">
                ${snapshot.leadCharacters.length
                  ? snapshot.leadCharacters.map((characterName) => `<span class="sidebar-snapshot-chip">${characterName}</span>`).join('')
                  : '<span class="sidebar-snapshot-empty">Add characters to build your cast.</span>'}
              </div>
            </div>
          </section>
        ` : ''}
      </div>
      <nav class="sidebar-nav">
        ${visibleGroups
          .map((group) => `
            <section class="sidebar-group">
              ${isCollapsed ? '' : `<p class="sidebar-group-label">${group.label}</p>`}
              <div class="sidebar-group-links">
                ${group.items
                  .map((item) => `
                    <button
                      type="button"
                      class="sidebar-link ${item.id === currentPage ? 'is-active' : ''}"
                      data-page="${item.id}"
                    >
                      <span class="sidebar-link-icon" aria-hidden="true">${item.icon}</span>
                      ${isCollapsed ? '' : `<span class="sidebar-link-label">${item.label}</span>`}
                    </button>
                  `)
                  .join('')}
              </div>
            </section>
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
