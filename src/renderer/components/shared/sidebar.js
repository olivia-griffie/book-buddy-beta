const icons = {
  settings: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="15" height="15" aria-hidden="true"><path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>`,
  home: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="15" height="15" aria-hidden="true"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`,
  'create-project': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="15" height="15" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,
  'plot-creation': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="15" height="15" aria-hidden="true"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/></svg>`,
  characters: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="15" height="15" aria-hidden="true"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>`,
  scenes: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><polyline points="21 15 16 10 5 21"/></svg>`,
  locations: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true"><polygon points="3 6 3 20 10 17 14 20 21 17 21 3 14 6 10 3"/><line x1="10" y1="3" x2="10" y2="17"/><line x1="14" y1="6" x2="14" y2="20"/><circle cx="16.5" cy="6.5" r="2.5" fill="currentColor" stroke="none"/></svg>`,
  chapters: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
  'daily-prompts': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="15" height="15" aria-hidden="true"><path d="M11 3h2v12h-2zm0 14h2v2.5h-2z"/></svg>`,
};

const sidebarGroups = [
  {
    label: 'Project Setup',
    requiresProject: false,
    items: [
      { id: 'home', label: 'Home', icon: icons.home },
      { id: 'create-project', label: 'Create Project', icon: icons['create-project'] },
    ],
  },
  {
    label: 'Story Building',
    requiresProject: true,
    items: [
      { id: 'plot-creation', label: 'Plot', icon: icons['plot-creation'] },
      { id: 'characters', label: 'Characters', icon: icons.characters },
      { id: 'scenes', label: 'Scenes', icon: icons.scenes },
      { id: 'locations', label: 'Locations', icon: icons.locations },
    ],
  },
  {
    label: 'Writing',
    requiresProject: true,
    items: [
      { id: 'chapters', label: 'Chapters', icon: icons.chapters },
      { id: 'daily-prompts', label: 'Challenges', icon: icons['daily-prompts'] },
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

function getIncompletePromptCount(project) {
  return (project?.dailyPromptHistory || []).filter((entry) => !entry.answerInsertedAt).length;
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
  const incompletePromptCount = hasProject ? getIncompletePromptCount(currentProject) : 0;
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
                      <span class="sidebar-link-icon" aria-hidden="true">
                        ${item.icon}
                        ${item.id === 'daily-prompts' && incompletePromptCount > 0 ? `<span class="sidebar-badge" aria-label="${incompletePromptCount} active prompts">${incompletePromptCount}</span>` : ''}
                      </span>
                      ${isCollapsed ? '' : `<span class="sidebar-link-label">${item.label}</span>`}
                    </button>
                  `)
                  .join('')}
              </div>
            </section>
          `)
          .join('')}
      </nav>
      <div class="sidebar-footer">
        <button
          type="button"
          class="sidebar-link ${currentPage === 'settings' ? 'is-active' : ''}"
          data-page="settings"
        >
          <span class="sidebar-link-icon" aria-hidden="true">${icons.settings}</span>
          ${isCollapsed ? '' : `<span class="sidebar-link-label">Settings</span>`}
        </button>
      </div>
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
