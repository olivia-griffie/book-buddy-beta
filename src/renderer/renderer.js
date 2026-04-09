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

function getProject() {
  return state.currentProject;
}

function setCurrentProject(project) {
  state.currentProject = project;
  if (typeof window.renderSidebar === 'function') {
    window.renderSidebar(state.currentPage, state.currentProject);
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

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof window.renderSidebar === 'function') {
    window.renderSidebar('home', null);
  }

  await navigate('home');
});
