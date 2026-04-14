function stripEditorHtml(value = '') {
  if (!value || !String(value).includes('<')) {
    return String(value || '').trim();
  }

  const temp = document.createElement('div');
  temp.innerHTML = String(value || '');
  return (temp.textContent || temp.innerText || '').trim();
}

function buildPreview(value = '', fallback = 'Nothing added yet.') {
  const plainText = stripEditorHtml(value);
  if (!plainText) {
    return fallback;
  }

  return plainText.length > 180 ? `${plainText.slice(0, 177)}...` : plainText;
}

function getSectionLabelMap(project) {
  return new Map((project?.plotSections || []).map((section) => [section.id, section.label]));
}

function buildPlotPanel(project) {
  const workbook = project?.plotWorkbook || {};
  const sections = project?.plotSections || [];

  return `
    <div class="reference-panel-grid">
      <article class="reference-card">
        <p class="reference-card-kicker">Outline</p>
        <p>${buildPreview(workbook.outline, 'Start with a broad outline so this panel can mirror the spine of the story.')}</p>
      </article>
      <article class="reference-card">
        <p class="reference-card-kicker">Premise</p>
        <p>${buildPreview(workbook.premise)}</p>
      </article>
      <article class="reference-card">
        <p class="reference-card-kicker">Stakes</p>
        <p>${buildPreview(workbook.stakes)}</p>
      </article>
      <article class="reference-card">
        <p class="reference-card-kicker">Plot Notes</p>
        <p>${buildPreview(workbook.notes)}</p>
      </article>
    </div>
    <div class="reference-list">
      <div class="reference-list-head">
        <h4>Section Targets</h4>
        <span>${sections.length} total</span>
      </div>
      ${sections.length ? sections.map((section) => `
        <article class="reference-list-card">
          <div class="reference-list-row">
            <strong>${section.label}</strong>
            <span>${Number(section.targetWords || 0).toLocaleString()} words</span>
          </div>
          <p>${buildPreview(section.notes, 'No notes linked to this section yet.')}</p>
        </article>
      `).join('') : `
        <article class="reference-list-card is-empty">
          <p>No section targets added yet.</p>
        </article>
      `}
    </div>
  `;
}

function buildCharactersPanel(project) {
  const characters = project?.characters || [];

  return `
    <div class="reference-list">
      <div class="reference-list-head">
        <h4>Character Library</h4>
        <span>${characters.length} saved</span>
      </div>
      ${characters.length ? characters.map((character) => `
        <article class="reference-list-card">
          <div class="reference-list-row">
            <strong>${character.name || 'Unnamed Character'}</strong>
            <span>${(character.typeTags || []).length ? (character.typeTags || []).length + ' tags' : 'Draft'}</span>
          </div>
          ${(character.typeTags || []).length ? `
            <div class="reference-chip-row">
              ${(character.typeTags || []).map((tag) => `
                <span class="reference-chip">${tag.replace(/-/g, ' ')}</span>
              `).join('')}
            </div>
          ` : ''}
          <p>${buildPreview(character.background || character.desires || character.appearance, 'Add a backstory, desire, or appearance note to make this reference richer.')}</p>
        </article>
      `).join('') : `
        <article class="reference-list-card is-empty">
          <p>No characters added yet.</p>
        </article>
      `}
    </div>
  `;
}

function buildScenesPanel(project) {
  const scenes = project?.scenes || [];
  const chapters = new Map((project?.chapters || []).map((chapter) => [chapter.id, chapter.title || 'Untitled Chapter']));
  const sections = getSectionLabelMap(project);

  return `
    <div class="reference-list">
      <div class="reference-list-head">
        <h4>Scene Bank</h4>
        <span>${scenes.length} saved</span>
      </div>
      ${scenes.length ? scenes.map((scene) => `
        <article class="reference-list-card">
          <div class="reference-list-row">
            <strong>${scene.title || 'Untitled Scene'}</strong>
            <span>${chapters.get(scene.linkedChapterId) || sections.get(scene.sectionId) || 'General idea'}</span>
          </div>
          ${(scene.tags || []).length ? `
            <div class="reference-chip-row">
              ${(scene.tags || []).map((tag) => `<span class="reference-chip">${tag}</span>`).join('')}
            </div>
          ` : ''}
          <p>${buildPreview(scene.summary || scene.other, 'Capture a summary here so it is easy to reference while drafting.')}</p>
        </article>
      `).join('') : `
        <article class="reference-list-card is-empty">
          <p>No scenes added yet.</p>
        </article>
      `}
    </div>
  `;
}

function buildLocationsPanel(project) {
  const locations = project?.locations || [];
  const sections = getSectionLabelMap(project);

  return `
    <div class="reference-list">
      <div class="reference-list-head">
        <h4>Location Notes</h4>
        <span>${locations.length} saved</span>
      </div>
      ${locations.length ? locations.map((location) => `
        <article class="reference-list-card">
          <div class="reference-list-row">
            <strong>${location.name || 'Untitled Location'}</strong>
            <span>${sections.get(location.sectionId) || location.type || 'General area'}</span>
          </div>
          <div class="reference-chip-row">
            ${location.type ? `<span class="reference-chip">${location.type}</span>` : ''}
            ${location.climate ? `<span class="reference-chip">${location.climate}</span>` : ''}
            ${location.timeOfDay ? `<span class="reference-chip">${location.timeOfDay}</span>` : ''}
          </div>
          <p>${buildPreview(location.other || location.socialDynamic || location.season, 'Add atmosphere or social texture to turn this into a stronger drafting reference.')}</p>
        </article>
      `).join('') : `
        <article class="reference-list-card is-empty">
          <p>No locations added yet.</p>
        </article>
      `}
    </div>
  `;
}

window.renderReferenceDrawer = function renderReferenceDrawer(currentProject, options = {}) {
  const container = document.getElementById('reference-drawer-container');
  if (!container) {
    return;
  }

  if (!currentProject) {
    container.innerHTML = '';
    container.classList.add('is-hidden');
    container.classList.remove('is-open');
    container.setAttribute('aria-hidden', 'true');
    return;
  }

  const tabs = [
    { id: 'plot', label: 'Plot' },
    { id: 'characters', label: 'Characters' },
    { id: 'scenes', label: 'Scenes' },
    { id: 'locations', label: 'Locations' },
  ];
  const activeTab = tabs.some((tab) => tab.id === options.tab) ? options.tab : 'plot';
  const isOpen = Boolean(options.open);

  const panelMap = {
    plot: buildPlotPanel(currentProject),
    characters: buildCharactersPanel(currentProject),
    scenes: buildScenesPanel(currentProject),
    locations: buildLocationsPanel(currentProject),
  };

  container.classList.toggle('is-open', isOpen);
  container.classList.toggle('is-hidden', !isOpen);
  container.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  container.innerHTML = `
    <div class="reference-drawer">
      <div class="reference-drawer-header">
        <div class="reference-drawer-copy">
          <p class="reference-drawer-kicker">Writing Context</p>
          <h3>${currentProject.title || 'Current Project'}</h3>
          <p>Keep your story notes nearby without leaving the page.</p>
        </div>
        <button type="button" class="reference-drawer-close" aria-label="Close reference drawer">&times;</button>
      </div>
      <div class="reference-drawer-tabs" role="tablist" aria-label="Reference sections">
        ${tabs.map((tab) => `
          <button
            type="button"
            class="reference-drawer-tab ${tab.id === activeTab ? 'is-active' : ''}"
            data-reference-tab="${tab.id}"
            role="tab"
            aria-selected="${tab.id === activeTab ? 'true' : 'false'}"
          >
            ${tab.label}
          </button>
        `).join('')}
      </div>
      <div class="reference-drawer-body">
        ${panelMap[activeTab]}
      </div>
    </div>
  `;

  container.querySelector('.reference-drawer-close')?.addEventListener('click', () => {
    window.setReferenceDrawerOpen(false);
  });

  container.querySelectorAll('[data-reference-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      window.setReferenceDrawerTab(button.dataset.referenceTab);
    });
  });
};
