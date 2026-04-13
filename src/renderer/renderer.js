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
};

const state = {
  currentPage: null,
  currentProject: null,
};

let activePageScript = null;
const dataCache = new Map();

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

  const baseLabels = hybridGuide
    ? Object.keys(hybridGuide.beats)
    : genreTracks[0]?.beats.map((entry) => entry.plotPoint) || getDefaultBeatOrder();

  const existingSections = project?.plotSections || [];
  const plotSections = baseLabels.map((label, index) => {
    const existing = existingSections.find(
      (section) => normalizeGenreKey(section.label) === normalizeGenreKey(label),
    );

    return existing || {
      id: `section-${slugify(label) || index + 1}`,
      label,
      targetWords: 0,
      notes: '',
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
  return state.currentProject;
}

function setCurrentProject(project) {
  state.currentProject = project;
  if (typeof window.renderSidebar === 'function') {
    window.renderSidebar(state.currentPage, state.currentProject);
  }
  if (typeof window.renderTopBar === 'function') {
    window.renderTopBar(state.currentPage, state.currentProject);
  }
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
      activePageScript = script;
      resolve();
    };
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

async function navigate(page, options = {}) {
  const pageDefinition = pageRegistry[page];
  if (!pageDefinition) {
    throw new Error(`Unknown page: ${page}`);
  }

  state.currentPage = page;

  if (Object.prototype.hasOwnProperty.call(options, 'project')) {
    state.currentProject = options.project;
  }

  const [htmlResponse] = await Promise.all([
    fetch(pageDefinition.html),
    loadPageScript(pageDefinition.script),
  ]);

  const markup = await htmlResponse.text();
  document.getElementById('main-content').innerHTML = markup;
  ensurePageStylesheet().href = pageDefinition.css;

  if (typeof window.renderSidebar === 'function') {
    window.renderSidebar(page, state.currentProject);
  }

  if (typeof window.renderTopBar === 'function') {
    window.renderTopBar(page, state.currentProject);
  }

  if (typeof window.initPage === 'function') {
    await window.initPage({
      page,
      project: state.currentProject,
    });
  }
}

window.navigate = navigate;
window.showProjectNav = () => {};
window.getCurrentProject = getProject;
window.setCurrentProject = setCurrentProject;
window.normalizeGenreKey = normalizeGenreKey;
window.getGenrePromptData = getGenrePromptData;
window.getProjectResources = buildProjectResources;
window.computeWordCount = computeWordCount;
window.slugify = slugify;
window.saveProjectData = async function saveProjectData(project) {
  await window.api.saveProject(project);
  setCurrentProject(project);
  return project;
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

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof window.renderSidebar === 'function') {
    window.renderSidebar('home', null);
  }
  if (typeof window.renderTopBar === 'function') {
    window.renderTopBar('home', null);
  }

  await navigate('home');
});
