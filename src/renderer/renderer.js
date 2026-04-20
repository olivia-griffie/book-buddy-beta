const pageRegistry = {
  home: {
    html: './pages/home/home.html',
    css: './pages/home/home.css',
    script: './pages/home/home.js',
  },
  'create-project': {
    html: './pages/create-project/create-project.html',
    css: './pages/create-project/create-project.css',
    script: './pages/create-project/create-project.js',
  },
  'plot-creation': {
    html: './pages/plot-creation/plot-creation.html',
    css: './pages/plot-creation/plot-creation.css',
    script: './pages/plot-creation/plot-creation.js',
  },
  chapters: {
    html: './pages/chapters/chapters.html',
    css: './pages/chapters/chapters.css',
    script: './pages/chapters/chapters.js',
  },
  characters: {
    html: './pages/characters/characters.html',
    css: './pages/characters/characters.css',
    script: './pages/characters/characters.js',
  },
  scenes: {
    html: './pages/scenes/scenes.html',
    css: './pages/scenes/scenes.css',
    script: './pages/scenes/scenes.js',
  },
  locations: {
    html: './pages/locations/locations.html',
    css: './pages/locations/locations.css',
    script: './pages/locations/locations.js',
  },
  'daily-prompts': {
    html: './pages/daily-prompts/daily-prompts.html',
    css: './pages/daily-prompts/daily-prompts.css',
    script: './pages/daily-prompts/daily-prompts.js',
  },
  settings: {
    html: './pages/settings/settings.html',
    css: './pages/settings/settings.css',
    script: './pages/settings/settings.js',
  },
  account: {
    html: './pages/account/account.html',
    css: './pages/account/account.css',
    script: './pages/account/account.js',
  },
  community: {
    html: './pages/community/community.html',
    css: './pages/community/community.css',
    script: './pages/community/community.js',
  },
  inbox: {
    html: './pages/inbox/inbox.html',
    css: './pages/inbox/inbox.css',
    script: './pages/inbox/inbox.js',
  },
  sharing: {
    html: './pages/sharing/sharing.html',
    css: './pages/sharing/sharing.css',
    script: './pages/sharing/sharing.js',
  },
};

const state = {
  currentPage: null,
  referenceDrawerOpen: false,
  referenceDrawerTab: 'plot',
  sidebarCollapsed: false,
  topbarBadgesVisibleUntil: 0,
  saveStatus: {
    tone: 'neutral',
    text: 'Ready to write',
  },
};

const pageInitRegistry = {};
let activePageScript = null;
let activeBeforeNavigateHook = null;
const dataCache = new Map();
let navigationRequestId = 0;
let topbarBadgeTimer = null;

function normalizeGenreKey(value = '') {
  return value
    .normalize('NFKC')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\u00d7/g, 'x')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function slugify(value = '') {
  return normalizeGenreKey(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function loadJson(path) {
  if (!dataCache.has(path)) {
    const promise = fetch(path).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load ${path}`);
      }

      return response.json();
    });

    dataCache.set(path, promise);
  }

  return dataCache.get(path);
}

async function getGenrePromptData() {
  if (typeof window.api?.getPromptData === 'function') {
    return window.api.getPromptData();
  }

  const [genrePrompts, specificPrompts, hybridGuides] = await Promise.all([
    loadJson('../data/prompts/genre_prompts.json'),
    loadJson('../data/prompts/specific_genre_prompts.json'),
    loadJson('../data/defaults/hybrid_genres.json'),
  ]);

  return {
    genrePrompts,
    specificPrompts,
    hybridGuides,
  };
}

function dedupeBy(items, keyBuilder) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyBuilder(item);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function parseProjectTimestamp(value) {
  const timestamp = new Date(value || '').getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getProjectSignalScore(project = {}) {
  const chapterCount = Array.isArray(project.chapters) ? project.chapters.length : 0;
  const plotSections = Array.isArray(project.plotSections) ? project.plotSections.length : 0;
  const plotWorkbook = project.plotWorkbook || {};
  const plotSignal = ['outline', 'premise', 'stakes', 'notes']
    .reduce((sum, key) => sum + (String(plotWorkbook[key] || '').trim() ? 1 : 0), 0);

  return (
    Number(project.currentWordCount || 0)
    + (chapterCount * 1000)
    + (plotSections * 50)
    + (plotSignal * 100)
  );
}

function choosePreferredProject(projects = [], preferredId = null) {
  if (!Array.isArray(projects) || !projects.length) {
    return null;
  }

  if (preferredId) {
    const preferredProject = projects.find((project) => project.id === preferredId);
    if (preferredProject) {
      return preferredProject;
    }
  }

  return [...projects].sort((left, right) => {
    const signalDifference = getProjectSignalScore(right) - getProjectSignalScore(left);
    if (signalDifference !== 0) {
      return signalDifference;
    }

    const updatedDifference = parseProjectTimestamp(right.updatedAt) - parseProjectTimestamp(left.updatedAt);
    if (updatedDifference !== 0) {
      return updatedDifference;
    }

    return parseProjectTimestamp(right.createdAt) - parseProjectTimestamp(left.createdAt);
  })[0];
}

function computeWordCount(text = '') {
  const normalized = String(text || '').includes('<')
    ? (() => {
      const temp = document.createElement('div');
      temp.innerHTML = String(text || '');
      return temp.textContent || temp.innerText || '';
    })()
    : String(text || '');
  const trimmed = normalized.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read the selected image.'));
    reader.readAsDataURL(file);
  });
}

function buildLocalDayKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildCollapseStorageKey(projectId = 'global', sectionId = '') {
  const normalizedProjectId = String(projectId || 'global').trim() || 'global';
  const normalizedSectionId = String(sectionId || '').trim();
  if (!normalizedSectionId) {
    return '';
  }

  return `collapse:${normalizedProjectId}:${normalizedSectionId}`;
}

function bindPersistentDetailsState(details, {
  projectId = 'global',
  sectionId = '',
  defaultOpen = false,
} = {}) {
  if (!(details instanceof HTMLElement) || details.tagName !== 'DETAILS') {
    return '';
  }

  const storageKey = buildCollapseStorageKey(projectId, sectionId || details.dataset.collapseId || details.id);
  if (!storageKey) {
    details.open = Boolean(defaultOpen);
    return '';
  }

  const storedValue = localStorage.getItem(storageKey);
  details.open = storedValue == null ? Boolean(defaultOpen) : storedValue === '1';

  if (details.dataset.collapsePersistBound !== 'true') {
    details.dataset.collapsePersistBound = 'true';
    details.addEventListener('toggle', () => {
      localStorage.setItem(storageKey, details.open ? '1' : '0');
    });
  }

  return storageKey;
}

function updateDailyWritingHistory(nextProject, previousProject) {
  const previousMatches = previousProject?.id && previousProject.id === nextProject?.id;
  const nextWords = Number(nextProject?.currentWordCount || 0);
  const previousWords = previousMatches ? Number(previousProject?.currentWordCount || 0) : 0;
  const positiveDelta = Math.max(0, nextWords - previousWords);
  const todayKey = buildLocalDayKey(new Date());
  const history = [...(nextProject?.dailyWordHistory || previousProject?.dailyWordHistory || [])]
    .map((entry) => ({
      date: entry.date,
      wordsWritten: Number(entry.wordsWritten || 0),
      totalWords: Number(entry.totalWords || 0),
    }))
    .filter((entry) => entry.date);

  let todayEntry = history.find((entry) => entry.date === todayKey);

  if (!todayEntry && !positiveDelta) {
    return history.sort((left, right) => left.date.localeCompare(right.date));
  }

  if (!todayEntry) {
    todayEntry = {
      date: todayKey,
      wordsWritten: 0,
      totalWords: nextWords,
    };
    history.push(todayEntry);
  }

  todayEntry.wordsWritten += positiveDelta;
  todayEntry.totalWords = nextWords;

  return history.sort((left, right) => left.date.localeCompare(right.date));
}

function getDefaultStreakSettings() {
  return {
    mode: 'words',
    target: 100,
    countRevision: true,
  };
}

function normalizeStreakSettings(settings = {}) {
  return {
    ...getDefaultStreakSettings(),
    ...(settings || {}),
    target: Math.max(1, Number(settings?.target || getDefaultStreakSettings().target)),
  };
}

function updateDailySessionHistory(nextProject, previousProject) {
  const previousMatches = previousProject?.id && previousProject.id === nextProject?.id;
  const nextWords = Number(nextProject?.currentWordCount || 0);
  const previousWords = previousMatches ? Number(previousProject?.currentWordCount || 0) : 0;
  const positiveDelta = Math.max(0, nextWords - previousWords);
  const todayKey = buildLocalDayKey(new Date());
  const streakSettings = normalizeStreakSettings(nextProject?.streakSettings);
  const history = [...(nextProject?.dailySessionHistory || previousProject?.dailySessionHistory || [])]
    .map((entry) => ({
      date: entry.date,
      wordsAdded: Number(entry.wordsAdded || 0),
      netWords: Number(entry.netWords || 0),
      sessionCount: Number(entry.sessionCount || 0),
      streakQualified: Boolean(entry.streakQualified),
      chaptersTouched: Array.isArray(entry.chaptersTouched) ? [...new Set(entry.chaptersTouched.filter(Boolean))] : [],
    }))
    .filter((entry) => entry.date);

  let todayEntry = history.find((entry) => entry.date === todayKey);
  if (!todayEntry && !positiveDelta) {
    return history.sort((left, right) => left.date.localeCompare(right.date));
  }

  if (!todayEntry) {
    todayEntry = {
      date: todayKey,
      wordsAdded: 0,
      netWords: 0,
      sessionCount: 0,
      streakQualified: false,
      chaptersTouched: [],
    };
    history.push(todayEntry);
  }

  if (positiveDelta > 0) {
    todayEntry.wordsAdded += positiveDelta;
    todayEntry.netWords += positiveDelta;
    todayEntry.sessionCount += 1;

    const touchedChapters = nextProject?.lastSessionMeta?.chapterIds || [];
    if (touchedChapters.length) {
      todayEntry.chaptersTouched = [...new Set([...(todayEntry.chaptersTouched || []), ...touchedChapters.filter(Boolean)])];
    }
  }

  if (streakSettings.mode === 'session') {
    todayEntry.streakQualified = todayEntry.sessionCount > 0;
  } else {
    todayEntry.streakQualified = todayEntry.wordsAdded >= streakSettings.target;
  }

  return history.sort((left, right) => left.date.localeCompare(right.date));
}

function computeWritingStreak(project) {
  const qualifyingDays = new Set((project?.dailySessionHistory || [])
    .filter((entry) => entry.streakQualified)
    .map((entry) => entry.date)
    .filter(Boolean));

  if (!qualifyingDays.size) {
    return 0;
  }

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (qualifyingDays.has(buildLocalDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function buildStreakState(project) {
  const entries = [...(project?.dailySessionHistory || [])]
    .filter((entry) => entry?.date)
    .sort((left, right) => left.date.localeCompare(right.date));

  let best = 0;
  let running = 0;
  let previousDate = null;
  let lastQualifiedDate = '';

  entries.forEach((entry) => {
    if (!entry.streakQualified) {
      running = 0;
      previousDate = null;
      return;
    }

    const currentDate = new Date(`${entry.date}T12:00:00`);
    if (previousDate) {
      const diff = Math.round((currentDate - previousDate) / (1000 * 60 * 60 * 24));
      running = diff === 1 ? running + 1 : 1;
    } else {
      running = 1;
    }

    if (running > best) {
      best = running;
    }

    previousDate = currentDate;
    lastQualifiedDate = entry.date;
  });

  return {
    current: computeWritingStreak(project),
    best,
    lastQualifiedDate,
  };
}

function getDefaultBeatOrder() {
  return [
    'Exposition & Initial Setup',
    'Inciting Incident',
    'Core Conflict',
    'Rising Action',
    'Midpoint Revelation',
    'Crisis',
    'Climax',
    'Aftermath',
  ];
}

function buildProjectResources(project, promptData) {
  const selectedGenres = project?.genres || [];
  const selectedKeys = selectedGenres.map((genre) => normalizeGenreKey(genre));

  function isMatchingHybridEntry(genreName) {
    const genreKey = normalizeGenreKey(genreName);
    return selectedKeys.length === 2
      && selectedKeys.every((key) => genreKey.includes(key))
      && genreKey.includes('-');
  }

  const hybridGuide = selectedGenres.length === 2
    ? promptData.hybridGuides.find((entry) => {
      const entryKey = normalizeGenreKey(entry.genre);
      const forward = `${selectedKeys[0]} x ${selectedKeys[1]}`;
      const reverse = `${selectedKeys[1]} x ${selectedKeys[0]}`;
      return entryKey === forward || entryKey === reverse;
    })
    : null;

  const genreTracks = selectedGenres.map((genre) => {
    const genreKey = normalizeGenreKey(genre);
    return {
      genre,
      beats: promptData.genrePrompts.filter((entry) => normalizeGenreKey(entry.genre) === genreKey),
      prompts: promptData.specificPrompts.filter((entry) => normalizeGenreKey(entry.genre) === genreKey),
    };
  });

  const hybridTrack = selectedGenres.length === 2
    ? {
      genre: hybridGuide?.genre || `${selectedGenres[0]} - ${selectedGenres[1]}`,
      beats: promptData.genrePrompts.filter((entry) => isMatchingHybridEntry(entry.genre)),
      prompts: promptData.specificPrompts.filter((entry) => isMatchingHybridEntry(entry.genre)),
    }
    : null;

  const baseBeats = hybridGuide
    ? Object.keys(hybridGuide.beats).map((label) => ({ plotPoint: label, description: '' }))
    : genreTracks[0]?.beats || getDefaultBeatOrder().map((label) => ({ plotPoint: label, description: '' }));

  const existingSections = project?.plotSections || [];
  const plotSections = baseBeats.map((beat, index) => {
    const label = beat.plotPoint;
    const existing = existingSections.find(
      (section) => normalizeGenreKey(section.label) === normalizeGenreKey(label),
    );

    return {
      id: existing?.id || `section-${slugify(label) || index + 1}`,
      label: existing?.label ?? label,
      description: beat.description || '',
      targetWords: existing?.targetWords ?? 0,
      notes: existing?.notes || '',
    };
  });

  const sequentialSource = hybridTrack?.prompts?.length
    ? hybridTrack.prompts
    : genreTracks[0]?.prompts || [];

  const promptPool = dedupeBy(
    [
      ...(hybridTrack?.prompts || []),
      ...genreTracks.flatMap((track) => track.prompts),
    ],
    (entry) => `${normalizeGenreKey(entry.genre)}|${entry.plotPoint}|${entry.prompt}`,
  );

  return {
    selectedGenres,
    hybridGuide,
    hybridTrack,
    genreTracks,
    plotSections,
    promptPool,
    sequentialSource,
  };
}

function getProject() {
  return window.projectStore?.getProject?.() || null;
}

async function persistCurrentProjectSelection(project) {
  if (typeof window.api?.setCurrentProjectId !== 'function') {
    return;
  }

  try {
    await window.api.setCurrentProjectId(project?.id || null);
  } catch (error) {
    console.warn('Unable to persist current project selection.', error);
  }
}

async function restoreCurrentProjectSelection() {
  if (typeof window.api?.getAllProjects !== 'function') {
    return null;
  }

  try {
    const [projects, currentProjectId] = await Promise.all([
      window.api.getAllProjects(),
      typeof window.api?.getCurrentProjectId === 'function'
        ? window.api.getCurrentProjectId()
        : Promise.resolve(null),
    ]);

    if (!Array.isArray(projects) || !projects.length) {
      setCurrentProject(null);
      return null;
    }

    const restoredProject = choosePreferredProject(projects, currentProjectId);
    setCurrentProject(restoredProject);

    if (restoredProject?.id !== currentProjectId) {
      persistCurrentProjectSelection(restoredProject);
    }

    return restoredProject;
  } catch (error) {
    console.warn('Unable to restore current project selection.', error);
    return null;
  }
}

function syncProjectState(project) {
  if (!project) {
    state.referenceDrawerOpen = false;
  }
  if (typeof window.renderSidebar === 'function') {
    window.renderSidebar(state.currentPage, project);
  }
  if (typeof window.renderTopBar === 'function') {
    window.renderTopBar(state.currentPage, project, state.saveStatus);
  }
  if (typeof window.renderReferenceDrawer === 'function') {
    window.renderReferenceDrawer(project, {
      open: state.referenceDrawerOpen,
      tab: state.referenceDrawerTab,
    });
  }
}

function scheduleTopbarBadgeRefresh() {
  clearTimeout(topbarBadgeTimer);

  const remaining = Number(state.topbarBadgesVisibleUntil || 0) - Date.now();
  if (remaining <= 0) {
    return;
  }

  topbarBadgeTimer = setTimeout(() => {
    if (typeof window.renderTopBar === 'function') {
      window.renderTopBar(state.currentPage, getProject(), state.saveStatus);
    }
  }, remaining + 50);
}

function setCurrentProject(project) {
  persistCurrentProjectSelection(project);

  if (window.projectStore?.setProject) {
    return window.projectStore.setProject(project);
  }

  syncProjectState(project);
  return project || null;
}

function setSaveStatus(nextStatus = {}) {
  state.saveStatus = {
    ...state.saveStatus,
    ...nextStatus,
  };

  if (typeof window.updateTopBarSaveState === 'function' && window.updateTopBarSaveState(state.saveStatus)) {
    return;
  }

  if (typeof window.renderTopBar === 'function') {
    window.renderTopBar(state.currentPage, getProject(), state.saveStatus);
  }
}

function syncReferenceDrawer() {
  if (typeof window.renderReferenceDrawer === 'function') {
    window.renderReferenceDrawer(getProject(), {
      open: state.referenceDrawerOpen,
      tab: state.referenceDrawerTab,
    });
  }
}
window.syncReferenceDrawer = syncReferenceDrawer;

function applyTabletMode(enabled) {
  document.body.classList.toggle('tablet-mode', enabled);
}

window.isTabletMode = function isTabletMode() {
  return localStorage.getItem('tabletMode') === 'true';
};

window.toggleTabletMode = function toggleTabletMode() {
  const next = !window.isTabletMode();
  localStorage.setItem('tabletMode', String(next));
  applyTabletMode(next);
  if (typeof window.renderTopBar === 'function') {
    window.renderTopBar(state.currentPage, getProject(), state.saveStatus);
  }
};

function applyDarkMode(enabled) {
  document.body.classList.toggle('dark-mode', enabled);
}

window.isDarkMode = function isDarkMode() {
  return localStorage.getItem('darkMode') === 'true';
};

window.toggleDarkMode = function toggleDarkMode() {
  const next = !window.isDarkMode();
  localStorage.setItem('darkMode', String(next));
  applyDarkMode(next);
};


function syncVisibleProjectLabels(project) {
  if (!project) {
    return;
  }

  const titleByPage = {
    'plot-creation': project.title || 'Plot Builder',
    chapters: project.title || 'Chapter Workspace',
    characters: `${project.title || 'Project'} Characters`,
    scenes: `${project.title || 'Project'} Scenes`,
    locations: `${project.title || 'Project'} Locations`,
    'daily-prompts': `${project.title || 'Project'} Daily Prompts`,
  };

  const pageTitleElementIds = {
    'plot-creation': 'plot-page-title',
    chapters: 'chapters-page-title',
    characters: 'characters-page-title',
    scenes: 'scenes-page-title',
    locations: 'locations-page-title',
    'daily-prompts': 'daily-prompts-title',
  };

  const pageTitleElement = document.getElementById(pageTitleElementIds[state.currentPage]);
  if (pageTitleElement && titleByPage[state.currentPage]) {
    pageTitleElement.textContent = titleByPage[state.currentPage];
  }

  document.querySelectorAll(`[data-project-title="${project.id}"]`).forEach((element) => {
    element.textContent = project.title || 'Untitled Project';
  });
}

window.requestTextEntry = function requestTextEntry(options = {}) {
  return new Promise((resolve) => {
    const existing = document.getElementById('app-text-entry-overlay');
    existing?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'app-text-entry-overlay';
    overlay.className = 'app-text-entry-overlay';
    overlay.innerHTML = `
      <div class="app-text-entry-dialog card" role="dialog" aria-modal="true" aria-labelledby="app-text-entry-title">
        <div class="app-text-entry-copy">
          <p class="eyebrow">Quick Edit</p>
          <h2 id="app-text-entry-title">${options.title || 'Edit value'}</h2>
        </div>
        <div class="field">
          <label for="app-text-entry-input">${options.label || 'Value'}</label>
          <input
            id="app-text-entry-input"
            type="text"
            maxlength="120"
            value="${String(options.value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"
            placeholder="${String(options.placeholder || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"
          />
        </div>
        <div class="app-text-entry-actions">
          <button type="button" class="btn btn-ghost" data-text-entry-cancel>Cancel</button>
          <button type="button" class="btn btn-save" data-text-entry-confirm>${options.confirmLabel || 'Save'}</button>
        </div>
      </div>
    `;

    function close(value) {
      overlay.remove();
      resolve(value);
    }

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        close(null);
      }
    });

    overlay.querySelector('[data-text-entry-cancel]')?.addEventListener('click', () => close(null));
    overlay.querySelector('[data-text-entry-confirm]')?.addEventListener('click', () => {
      const input = overlay.querySelector('#app-text-entry-input');
      close(input?.value ?? '');
    });

    overlay.querySelector('#app-text-entry-input')?.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        close(null);
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const input = overlay.querySelector('#app-text-entry-input');
        close(input?.value ?? '');
      }
    });

    document.body.appendChild(overlay);
    const input = overlay.querySelector('#app-text-entry-input');
    input?.focus();
    input?.select();
  });
};

window.requestGenreSelection = async function requestGenreSelection(options = {}) {
  return new Promise(async (resolve) => {
    const existing = document.getElementById('app-genre-selection-overlay');
    existing?.remove();

    let allGenres = options.genres || [];
    if (!allGenres.length) {
      try {
        const promptData = await window.getGenrePromptData();
        const fromData = (promptData?.genrePrompts || []).map((entry) => entry.genre).filter(Boolean);
        allGenres = fromData.length ? fromData : ['Contemporary', 'Fantasy', 'Historical Fiction', 'Horror', 'Literary Fiction', 'Memoir', 'Mystery', 'Romance', 'Science Fiction', 'Short Story', 'Thriller'];
      } catch {
        allGenres = ['Contemporary', 'Fantasy', 'Historical Fiction', 'Horror', 'Literary Fiction', 'Memoir', 'Mystery', 'Romance', 'Science Fiction', 'Short Story', 'Thriller'];
      }
    }

    const normalizeGenre = (value = '') => String(value || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
    const currentGenres = new Set((options.currentGenres || []).map(normalizeGenre));

    const filteredGenres = [...new Set(allGenres)]
      .filter((g) => {
        return g && !g.includes('\u2013') && !g.includes('\u2014') && !g.includes(' x ');
      })
      .sort((a, b) => a.localeCompare(b));

    const overlay = document.createElement('div');
    overlay.id = 'app-genre-selection-overlay';
    overlay.className = 'app-text-entry-overlay';
    overlay.innerHTML = `
      <div class="app-genre-dialog card" role="dialog" aria-modal="true" aria-labelledby="app-genre-dialog-title">
        <div class="app-genre-dialog-header app-text-entry-copy">
          <p class="eyebrow">Update Project</p>
          <h2 id="app-genre-dialog-title">${options.title || 'Change Genre'}</h2>
          <p class="app-genre-dialog-note">Select 1–2 genres. Your written content won't change — only the guidance and prompts will update.</p>
        </div>
        <div class="app-genre-options-wrap">
          <div class="app-genre-count-row">
            <span class="app-genre-label">Select up to 2 genres</span>
            <span id="app-genre-count" class="selection-badge">0 selected</span>
          </div>
          <div id="app-genre-options" class="genre-options">
            ${filteredGenres.map((genre) => `
              <label class="genre-option">
                <input type="checkbox" name="app-genre" value="${genre}" ${currentGenres.has(normalizeGenre(genre)) ? 'checked' : ''} />
                <span>${genre}</span>
              </label>
            `).join('')}
          </div>
        </div>
        <div class="app-genre-dialog-footer app-text-entry-actions">
          <button type="button" class="btn btn-ghost" data-genre-cancel>Cancel</button>
          <button type="button" class="btn btn-save" data-genre-confirm>Save Genre</button>
        </div>
      </div>
    `;

    function getSelected() {
      return [...overlay.querySelectorAll('input[name="app-genre"]:checked')].map((i) => i.value);
    }

    function syncState() {
      const selected = getSelected();
      const countEl = overlay.querySelector('#app-genre-count');
      if (countEl) countEl.textContent = `${selected.length} selected`;
      overlay.querySelectorAll('input[name="app-genre"]').forEach((input) => {
        const shouldDisable = selected.length >= 2 && !input.checked;
        input.disabled = shouldDisable;
        input.closest('.genre-option')?.classList.toggle('is-disabled', shouldDisable);
      });
    }

    overlay.querySelectorAll('input[name="app-genre"]').forEach((input) => {
      input.addEventListener('change', syncState);
    });
    syncState();

    function close(value) {
      overlay.remove();
      resolve(value);
    }

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close(null);
    });

    overlay.querySelector('[data-genre-cancel]')?.addEventListener('click', () => close(null));
    overlay.querySelector('[data-genre-confirm]')?.addEventListener('click', () => {
      const selected = getSelected();
      if (!selected.length) return;
      close(selected);
    });

    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close(null);
    });

    document.body.appendChild(overlay);
    overlay.querySelector('input[name="app-genre"]')?.focus();
  });
};

function renderStartupError(error) {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) {
    return;
  }

  mainContent.innerHTML = `
    <section class="page">
      <div class="empty-state card">
        <h2>Startup hit a loading problem</h2>
        <p>${error?.message || 'The app shell loaded, but the first page did not finish rendering.'}</p>
        <button id="startup-retry" class="btn btn-save" type="button">Retry Home</button>
      </div>
    </section>
  `;

  document.getElementById('startup-retry')?.addEventListener('click', async () => {
    try {
      const restoredProject = await restoreCurrentProjectSelection();
      await window.navigate('home', { project: restoredProject || getProject() });
    } catch (retryError) {
      renderStartupError(retryError);
    }
  });
}

function ensurePageStylesheet() {
  let link = document.getElementById('page-stylesheet');

  if (!link) {
    link = document.createElement('link');
    link.id = 'page-stylesheet';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }

  return link;
}

async function loadPageScript(scriptPath) {
  if (activePageScript) {
    activePageScript.remove();
    activePageScript = null;
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${scriptPath}?t=${Date.now()}`;
    script.onload = () => {
      resolve(script);
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(`Unable to load script: ${scriptPath}`));
    };
    document.body.appendChild(script);
  });
}


async function navigate(page, options = {}) {
  const pageDefinition = pageRegistry[page];
  if (!pageDefinition) {
    throw new Error(`Unknown page: ${page}`);
  }

  if (state.authRequired && page !== 'account') {
    return;
  }

  const previousPage = state.currentPage;
  const beforeNavigateHook = activeBeforeNavigateHook;
  if (typeof beforeNavigateHook === 'function') {
    await beforeNavigateHook({
      from: previousPage,
      to: page,
      options,
    });
  }

  activeBeforeNavigateHook = null;

  const requestId = ++navigationRequestId;
  state.currentPage = page;

  if (Object.prototype.hasOwnProperty.call(options, 'project')) {
    if (!options.project) {
      state.referenceDrawerOpen = false;
    }
    setCurrentProject(options.project);
  }

  const htmlResponse = await fetch(pageDefinition.html);
  const markup = await htmlResponse.text();

  if (requestId !== navigationRequestId) {
    return;
  }

  const mainContent = document.getElementById('main-content');
  mainContent.innerHTML = markup;
  document.getElementById('app-workspace').scrollTop = 0;
  ensurePageStylesheet().href = pageDefinition.css;

  const pageScript = await loadPageScript(pageDefinition.script);

  if (requestId !== navigationRequestId) {
    pageScript?.remove();
    return;
  }

  activePageScript = pageScript;

  if (typeof window.renderSidebar === 'function') {
    window.renderSidebar(page, getProject());
  }

  if (typeof window.renderTopBar === 'function') {
    window.renderTopBar(page, getProject(), state.saveStatus);
  }
  syncReferenceDrawer();

  try {
    const initFn = pageInitRegistry[page];
    if (typeof initFn !== 'function') {
      throw new Error(`The ${page} page did not finish registering correctly.`);
    }

    await initFn({
      page,
      project: getProject(),
    });
  } catch (error) {
    console.error(`Failed to initialize page "${page}".`, error);
    document.getElementById('main-content').innerHTML = `
      <section class="page">
        <div class="empty-state card">
          <h2>That page hit a loading problem</h2>
          <p>${error?.message || 'A renderer error interrupted the page setup.'}</p>
          <button id="page-init-retry" class="btn btn-save" type="button">Retry Page</button>
        </div>
      </section>
    `;
    document.getElementById('page-init-retry')?.addEventListener('click', () => {
      window.navigate(page, { project: getProject() });
    });
  }
}

window.navigate = navigate;
window.registerPageInit = function registerPageInit(pageName, initFn) {
  if (typeof initFn !== 'function') {
    throw new Error(`registerPageInit expected a function for "${pageName}".`);
  }

  pageInitRegistry[pageName] = initFn;
};
window.registerBeforeNavigate = function registerBeforeNavigate(hook) {
  if (hook != null && typeof hook !== 'function') {
    throw new Error('registerBeforeNavigate expected a function.');
  }

  activeBeforeNavigateHook = hook || null;
};
window.showProjectNav = () => {};
window.getCurrentProject = getProject;
window.setCurrentProject = setCurrentProject;
window.normalizeGenreKey = normalizeGenreKey;
window.getGenrePromptData = getGenrePromptData;
window.getProjectResources = buildProjectResources;
window.computeWordCount = computeWordCount;
window.buildLocalDayKey = buildLocalDayKey;
window.buildCollapseStorageKey = buildCollapseStorageKey;
window.bindPersistentDetailsState = bindPersistentDetailsState;
window.getDefaultStreakSettings = getDefaultStreakSettings;
window.computeWritingStreak = computeWritingStreak;
window.slugify = slugify;
window.choosePreferredProject = choosePreferredProject;
window.setAppSaveStatus = setSaveStatus;
window.isReferenceDrawerOpen = function isReferenceDrawerOpen() {
  return state.referenceDrawerOpen;
};
window.setReferenceDrawerOpen = function setReferenceDrawerOpen(isOpen) {
  state.referenceDrawerOpen = Boolean(isOpen && getProject());
  if (typeof window.renderTopBar === 'function') {
    window.renderTopBar(state.currentPage, getProject(), state.saveStatus);
  }
  syncReferenceDrawer();
};
window.toggleReferenceDrawer = function toggleReferenceDrawer() {
  window.setReferenceDrawerOpen(!state.referenceDrawerOpen);
};
window.setReferenceDrawerTab = function setReferenceDrawerTab(tab) {
  state.referenceDrawerTab = tab || 'plot';
  state.referenceDrawerOpen = Boolean(getProject());
  if (typeof window.renderTopBar === 'function') {
    window.renderTopBar(state.currentPage, getProject(), state.saveStatus);
  }
  syncReferenceDrawer();
};
window.renameProjectTitle = async function renameProjectTitle(projectId, nextTitle) {
  const trimmedTitle = String(nextTitle || '').trim();
  if (!trimmedTitle) {
    window.setAppSaveStatus({
      tone: 'warning',
      text: 'Project title cannot be empty.',
    });
    return null;
  }

  const currentProject = getProject();
  let baseProject = currentProject && (!projectId || currentProject.id === projectId) ? currentProject : null;

  if (!baseProject && typeof window.api?.getAllProjects === 'function') {
    const projects = await window.api.getAllProjects();
    baseProject = projects.find((project) => project.id === projectId) || null;
  }

  if (!baseProject) {
    window.setAppSaveStatus({
      tone: 'warning',
      text: 'Project not found.',
    });
    return null;
  }

  if ((baseProject.title || '').trim() === trimmedTitle) {
    return baseProject;
  }

  const savedProject = await window.saveProjectData({
    ...baseProject,
    title: trimmedTitle,
    updatedAt: new Date().toISOString(),
  }, {
    dirtyFields: ['title'],
  });

  syncVisibleProjectLabels(savedProject);
  syncProjectState(savedProject);
  return savedProject;
};
window.isSidebarCollapsed = function isSidebarCollapsed() {
  return Boolean(state.sidebarCollapsed);
};
window.setSidebarCollapsed = function setSidebarCollapsed(isCollapsed) {
  state.sidebarCollapsed = Boolean(isCollapsed);
  syncProjectState(getProject());
};
window.shouldShowTopbarBadges = function shouldShowTopbarBadges() {
  return Date.now() < Number(state.topbarBadgesVisibleUntil || 0);
};
window.showMilestoneCelebration = function showMilestoneCelebration(milestones = []) {
  if (!milestones.length) {
    return;
  }

  let rail = document.getElementById('milestone-toast-rail');
  if (!rail) {
    rail = document.createElement('div');
    rail.id = 'milestone-toast-rail';
    rail.className = 'milestone-toast-rail';
    document.body.appendChild(rail);
  }

  milestones.forEach((milestone, index) => {
    const toast = document.createElement('article');
    toast.className = 'milestone-toast';
    toast.innerHTML = `
      <div class="milestone-toast-mark" aria-hidden="true">+</div>
      <div class="milestone-toast-copy">
        <p class="milestone-toast-kicker">Milestone unlocked</p>
        <h3>${milestone.label}</h3>
        <p>${milestone.description}</p>
      </div>
    `;
    rail.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('is-visible');
    });

    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 260);
    }, 2600 + (index * 180));
  });
};
window.markAppDirty = function markAppDirty(text = 'Unsaved changes') {
  setSaveStatus({
    tone: 'warning',
    text,
  });
};
window.createAutosaveController = function createAutosaveController(saveTask, options = {}) {
  let timer = null;
  let pending = false;
  let saving = false;
  let activeSavePromise = null;
  const delay = Number(options.delay || 5000);
  const dirtyText = options.dirtyText || 'Unsaved changes';

  async function runSave() {
    pending = false;
    saving = true;
    activeSavePromise = (async () => {
      try {
        await saveTask();
      } catch (error) {
        setSaveStatus({
          tone: 'warning',
          text: error?.message || 'Autosave failed',
        });
        throw error;
      } finally {
        saving = false;
        activeSavePromise = null;
        if (pending) {
          schedule();
        }
      }
    })();

    return activeSavePromise;
  }

  async function flush() {
    clearTimeout(timer);

    if (saving) {
      return activeSavePromise;
    }

    if (!pending) {
      return;
    }

    return runSave();
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      flush().catch(() => {});
    }, delay);
  }

  return {
    touch(text = dirtyText) {
      pending = true;
      window.markAppDirty(text);
      schedule();
    },
    flush,
    cancel() {
      clearTimeout(timer);
      pending = false;
    },
    hasPending() {
      return pending || saving;
    },
  };
};
const sessionShownMilestones = new Set();

window.saveProjectData = async function saveProjectData(project, options = {}) {
  const previousProject = getProject();
  const previousMilestones = new Set(previousProject?.unlockedMilestones || []);
  const streakSettings = normalizeStreakSettings(project?.streakSettings || previousProject?.streakSettings);
  const dailyWordHistory = updateDailyWritingHistory(project, previousProject);
  const dailySessionHistory = updateDailySessionHistory({
    ...project,
    streakSettings,
    dailyWordHistory,
  }, previousProject);
  const streakState = buildStreakState({
    ...project,
    streakSettings,
    dailyWordHistory,
    dailySessionHistory,
  });
  const analyticsProject = {
    ...project,
    streakSettings,
    dailyWordHistory,
    dailySessionHistory,
    streakState,
  };
  const milestoneSnapshot = typeof window.getProjectMilestoneSnapshot === 'function'
    ? window.getProjectMilestoneSnapshot(analyticsProject)
    : { unlockedMilestones: analyticsProject?.unlockedMilestones || [], visibleBadges: [] };
  const milestoneDefinitions = typeof window.getProjectMilestoneDefinitions === 'function'
    ? window.getProjectMilestoneDefinitions()
    : [];
  const mergedProject = {
    ...analyticsProject,
    unlockedMilestones: milestoneSnapshot.unlockedMilestones,
  };
  const newlyUnlocked = milestoneSnapshot.unlockedMilestones
    .filter((milestoneId) => !previousMilestones.has(milestoneId) && !sessionShownMilestones.has(milestoneId))
    .map((milestoneId) => milestoneDefinitions.find((entry) => entry.id === milestoneId))
    .filter(Boolean);
  newlyUnlocked.forEach((m) => sessionShownMilestones.add(m.id));

  setSaveStatus({
    tone: 'saving',
    text: 'Saving changes...',
  });
  const savedProject = await window.api.saveProject(mergedProject, {
    dirtyFields: options.dirtyFields || [],
  });
  setCurrentProject(savedProject);
  setSaveStatus({
    tone: 'success',
    text: 'Saved just now',
  });
  if (newlyUnlocked.length) {
    window.showMilestoneCelebration(newlyUnlocked);
  }
  return savedProject;
};
window.saveSettingsData = async function saveSettingsData(settings) {
  return window.api.saveSettings(settings);
};
window.runButtonFeedback = async function runButtonFeedback(button, task, options = {}) {
  if (typeof task !== 'function') {
    throw new Error('runButtonFeedback requires a task function.');
  }

  if (!button) {
    return task();
  }

  if (!button.dataset.baseLabel) {
    button.dataset.baseLabel = button.textContent.trim();
  }

  const baseLabel = button.dataset.baseLabel;
  const successDuration = Number(options.successDuration || 900);

  function render(state) {
    if (state === 'idle') {
      button.innerHTML = `<span>${baseLabel}</span>`;
      return;
    }

    if (state === 'loading') {
      button.innerHTML = `
        <span class="btn-feedback-icon is-spinner" aria-hidden="true"></span>
        <span>${baseLabel}</span>
      `;
      return;
    }

    if (state === 'success') {
      button.innerHTML = `
        <span class="btn-feedback-icon is-check" aria-hidden="true"></span>
        <span>${baseLabel}</span>
      `;
    }
  }

  button.disabled = true;
  button.dataset.feedbackState = 'loading';
  render('loading');

  try {
    const result = await task();
    button.dataset.feedbackState = 'success';
    render('success');
    await new Promise((resolve) => setTimeout(resolve, successDuration));
    return result;
  } finally {
    button.disabled = false;
    button.dataset.feedbackState = 'idle';
    render('idle');
  }
};

function showAuthOverlay() {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.style.display = 'flex';
}

function hideAuthOverlay() {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.style.display = 'none';
}

function setAuthError(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message || '';
  el.classList.toggle('is-visible', Boolean(message));
}

function initAuthOverlay() {
  // Tab switching
  document.querySelectorAll('[data-auth-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-auth-tab]').forEach((t) => t.classList.remove('is-active'));
      document.querySelectorAll('.auth-panel').forEach((p) => { p.style.display = 'none'; });
      tab.classList.add('is-active');
      const panel = document.getElementById(`auth-panel-${tab.dataset.authTab}`);
      if (panel) panel.style.display = 'block';
    });
  });

  // Sign in
  document.getElementById('auth-signin-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setAuthError('auth-signin-error', '');
    const btn = document.getElementById('auth-signin-submit');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      await window.api.auth.login(
        document.getElementById('auth-signin-email').value.trim(),
        document.getElementById('auth-signin-password').value,
      );
      hideAuthOverlay();
      state.authRequired = false;
      await navigate('home', { project: getProject() });
      restoreCurrentProjectSelection()
        .then(async (restoredProject) => {
          if (!restoredProject) return;
          if (state.currentPage === 'home') {
            await navigate('home', { project: restoredProject });
          } else {
            syncProjectState(restoredProject);
          }
        })
        .catch(() => {});
    } catch (err) {
      setAuthError('auth-signin-error', err.message || 'Sign in failed.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });

  // Sign up
  document.getElementById('auth-signup-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setAuthError('auth-signup-error', '');
    const btn = document.getElementById('auth-signup-submit');
    btn.disabled = true;
    btn.textContent = 'Creating account…';
    try {
      const result = await window.api.auth.signup(
        document.getElementById('auth-signup-email').value.trim(),
        document.getElementById('auth-signup-password').value,
        document.getElementById('auth-signup-username').value.trim(),
      );
      if (result.session) {
        hideAuthOverlay();
        state.authRequired = false;
        await navigate('home', { project: getProject() });
      } else {
        document.getElementById('auth-signup-form').style.display = 'none';
        document.getElementById('auth-signup-confirm').style.display = 'block';
      }
    } catch (err) {
      setAuthError('auth-signup-error', err.message || 'Sign up failed.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });
}

async function checkAuth() {
  try {
    const session = await window.api.auth.getSession();
    if (!session) return false;

    const expiresAt = session.expires_at ? Number(session.expires_at) * 1000 : 0;
    const isExpired = expiresAt && Date.now() > expiresAt - 60_000;

    if (isExpired) {
      await window.api.auth.refresh();
    }

    return true;
  } catch {
    return false;
  }
}

window.authLogout = async function authLogout() {
  await window.api.auth.logout().catch(() => {});
  state.authRequired = true;
  showAuthOverlay();
};

window.onLoginSuccess = async function onLoginSuccess() {
  hideAuthOverlay();
  state.authRequired = false;
  await navigate('home', { project: getProject() });
  restoreCurrentProjectSelection()
    .then(async (restoredProject) => {
      if (!restoredProject) return;
      if (state.currentPage === 'home') {
        await navigate('home', { project: restoredProject });
      } else {
        syncProjectState(restoredProject);
      }
    })
    .catch(() => {});
};

document.addEventListener('DOMContentLoaded', async () => {
  state.topbarBadgesVisibleUntil = Date.now() + (3 * 60 * 1000);
  scheduleTopbarBadgeRefresh();

  if (window.isTabletMode()) {
    applyTabletMode(true);
  }

  if (window.isDarkMode()) {
    applyDarkMode(true);
  }

  if (typeof window.renderSidebar === 'function') {
    window.renderSidebar('home', getProject());
  }
  if (typeof window.renderTopBar === 'function') {
    window.renderTopBar('home', getProject(), state.saveStatus);
  }
  syncReferenceDrawer();

  initAuthOverlay();
  hideAuthOverlay();

  const isAuthenticated = await checkAuth();

  if (!isAuthenticated) {
    state.authRequired = true;
    showAuthOverlay();
    return;
  }

  try {
    await navigate('home', { project: getProject() });
  } catch (error) {
    console.error('Initial home navigation failed.', error);
    renderStartupError(error);
  }

  restoreCurrentProjectSelection()
    .then(async (restoredProject) => {
      if (!restoredProject) return;
      if (state.currentPage === 'home') {
        await navigate('home', { project: restoredProject });
      } else {
        syncProjectState(restoredProject);
      }
    })
    .catch((error) => {
      console.error('Background project restore failed.', error);
    });

  document.addEventListener('click', async (event) => {
    if (event.target.closest('[data-edit-project-title]')) {
      const project = getProject();
      if (!project) return;
      const nextTitle = await window.requestTextEntry?.({
        title: 'Edit project title',
        label: 'Project title',
        value: project.title || '',
        confirmLabel: 'Save title',
        placeholder: 'Enter a project title',
      });
      if (nextTitle == null) return;
      await window.renameProjectTitle?.(project.id, nextTitle);
      return;
    }

    const thumbnailTrigger = event.target.closest('#project-thumbnail-trigger');
    if (thumbnailTrigger) {
      const thumbnailInput = document.getElementById('project-thumbnail');
      if (thumbnailInput) {
        thumbnailInput.value = '';
      }
    }

    const sidebarNav = event.target.closest('[data-page]');
    if (sidebarNav) {
      const page = sidebarNav.dataset.page;
      if (page === 'create-project') {
        window.navigate('create-project', { project: null });
        return;
      }

      if (page) {
        window.navigate(page);
        return;
      }
    }

    const nextStepButton = event.target.closest('#topbar-next-step');
    if (nextStepButton) {
      const nextPage = nextStepButton.dataset.nextStep;
      if (nextPage === 'create-project') {
        window.navigate('create-project', { project: null });
      } else if (nextPage) {
        window.navigate(nextPage);
      }
      return;
    }

    if (event.target.closest('#topbar-new-project') || event.target.closest('#btn-new-project') || event.target.closest('#btn-empty-new')) {
      window.navigate('create-project', { project: null });
      return;
    }

    const stepButton = event.target.closest('[data-topbar-step]');
    if (stepButton) {
      const page = stepButton.dataset.topbarStep;
      if (page === 'create-project') {
        window.navigate('create-project', { project: null });
      } else if (page) {
        window.navigate(page);
      }
      return;
    }

    const sidebarToggle = event.target.closest('[data-sidebar-toggle]');
    if (sidebarToggle) {
      window.setSidebarCollapsed(!window.isSidebarCollapsed());
    }
  });

  document.addEventListener('change', async (event) => {
    const genreInput = event.target.closest('#genre-options input[name="genres"]');
    if (genreInput) {
      const genreContainer = document.getElementById('genre-options');
      const genreCount = document.getElementById('genre-count');
      if (genreContainer) {
        const selectedInputs = [...genreContainer.querySelectorAll('input[name="genres"]:checked')];
        if (selectedInputs.length > 2) {
          genreInput.checked = false;
        }

        const finalSelected = [...genreContainer.querySelectorAll('input[name="genres"]:checked')];
        genreContainer.querySelectorAll('input[name="genres"]').forEach((input) => {
          const shouldDisable = finalSelected.length >= 2 && !input.checked;
          input.disabled = shouldDisable;
          input.closest('.genre-option')?.classList.toggle('is-disabled', shouldDisable);
        });

        if (genreCount) {
          genreCount.textContent = `${finalSelected.length} selected`;
        }
      }
      return;
    }

    const thumbnailInput = event.target.closest('#project-thumbnail');
    if (!thumbnailInput) {
      return;
    }

    const preview = document.getElementById('project-thumbnail-preview');
    const status = document.getElementById('project-thumbnail-status');
    const file = thumbnailInput.files?.[0];

    if (!preview) {
      return;
    }

    if (!file) {
      preview.innerHTML = '<span class="placeholder-icon">Book</span>';
      const form = document.getElementById('create-project-form');
      if (form) {
        form.dataset.thumbnailData = '';
      }
      if (status) {
        status.textContent = 'No image selected yet.';
      }
      return;
    }

    try {
      const thumbnailData = await readFileAsDataUrl(file);
      preview.innerHTML = `<img src="${thumbnailData}" alt="Project thumbnail preview" />`;
      const form = document.getElementById('create-project-form');
      if (form) {
        form.dataset.thumbnailData = thumbnailData;
      }
      if (status) {
        status.textContent = 'Image selected and ready for this project.';
      }
    } catch (error) {
      if (status) {
        status.textContent = error?.message || 'Unable to load the selected image.';
      }
    }
  });

  document.addEventListener('submit', async (event) => {
    const form = event.target.closest('#create-project-form');
    if (!form) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    const formMessage = document.getElementById('form-message');
    const titleInput = document.getElementById('project-title');
    const selectedGenres = [...form.querySelectorAll('input[name="genres"]:checked')].map((input) => input.value);

    if (formMessage) {
      formMessage.textContent = '';
    }

    const title = String(titleInput?.value || '').trim();
    if (!title) {
      if (formMessage) {
        formMessage.textContent = 'Add a project title before continuing.';
      }
      titleInput?.focus();
      return;
    }

    if (!selectedGenres.length) {
      if (formMessage) {
        formMessage.textContent = 'Choose at least one genre.';
      }
      return;
    }

    try {
      const allProjects = typeof window.api?.getAllProjects === 'function'
        ? await window.api.getAllProjects()
        : [];

      if (allProjects.length >= 1) {
        if (formMessage) {
          formMessage.textContent = 'Book Buddy Beta currently allows one project slot. Delete your current project to create a different one.';
        }
        return;
      }

      const formData = new FormData(form);
      const project = {
        id: `project-${Date.now()}`,
        title,
        subtitle: String(formData.get('subtitle') || '').trim(),
        authorName: String(formData.get('authorName') || '').trim(),
        genres: selectedGenres,
      wordCountGoal: Number(formData.get('wordCountGoal') || 0),
      targetCompletionDate: String(formData.get('targetCompletionDate') || '').trim(),
      currentWordCount: 0,
      thumbnail: String(form.dataset.thumbnailData || ''),
      plotWorkbook: {},
      dailyWordHistory: [],
      dailySessionHistory: [],
      streakSettings: getDefaultStreakSettings(),
      streakState: {
        current: 0,
        best: 0,
        lastQualifiedDate: '',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

      const savedProject = await window.api.saveProject(project);
      window.setCurrentProject(savedProject);
      await window.navigate('plot-creation', { project: savedProject });
    } catch (error) {
      if (formMessage) {
        formMessage.textContent = error?.message || 'Project creation failed. Please try again.';
      }
    }
  }, true);

  if (window.projectStore?.subscribe) {
    window.projectStore.subscribe((project) => {
      syncProjectState(project);
    });
  }
});
