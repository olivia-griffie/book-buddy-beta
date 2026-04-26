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
  referenceDrawerOpen: false,
  referenceDrawerTab: 'plot',
  saveStatus: {
    tone: 'neutral',
    text: 'Ready to write',
  },
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

    const restoredProject = projects.find((project) => project.id === currentProjectId) || projects[0];
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

  if (typeof window.renderTopBar === 'function') {
    window.renderTopBar(state.currentPage, getProject(), state.saveStatus);
  }
}

function renderReferenceDrawer() {
  if (typeof window.renderReferenceDrawer === 'function') {
    window.renderReferenceDrawer(getProject(), {
      open: state.referenceDrawerOpen,
      tab: state.referenceDrawerTab,
    });
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
    if (!options.project) {
      state.referenceDrawerOpen = false;
    }
    setCurrentProject(options.project);
  }

  const [htmlResponse] = await Promise.all([
    fetch(pageDefinition.html),
    loadPageScript(pageDefinition.script),
  ]);

  const markup = await htmlResponse.text();
  document.getElementById('main-content').innerHTML = markup;
  ensurePageStylesheet().href = pageDefinition.css;

  if (typeof window.renderSidebar === 'function') {
    window.renderSidebar(page, getProject());
  }

  if (typeof window.renderTopBar === 'function') {
    window.renderTopBar(page, getProject(), state.saveStatus);
  }
  renderReferenceDrawer();

  if (typeof window.initPage === 'function') {
    try {
      await window.initPage({
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
}

window.navigate = navigate;
window.showProjectNav = () => {};
window.getCurrentProject = getProject;
window.setCurrentProject = setCurrentProject;
window.normalizeGenreKey = normalizeGenreKey;
window.getGenrePromptData = getGenrePromptData;
window.getProjectResources = buildProjectResources;
window.computeWordCount = computeWordCount;
window.buildLocalDayKey = buildLocalDayKey;
window.slugify = slugify;
window.setAppSaveStatus = setSaveStatus;
window.isReferenceDrawerOpen = function isReferenceDrawerOpen() {
  return state.referenceDrawerOpen;
};
window.setReferenceDrawerOpen = function setReferenceDrawerOpen(isOpen) {
  state.referenceDrawerOpen = Boolean(isOpen && getProject());
  if (typeof window.renderTopBar === 'function') {
    window.renderTopBar(state.currentPage, getProject(), state.saveStatus);
  }
  renderReferenceDrawer();
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
  renderReferenceDrawer();
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
  const delay = Number(options.delay || 7000);
  const dirtyText = options.dirtyText || 'Unsaved changes';

  async function flush() {
    if (!pending || saving) {
      return;
    }

    pending = false;
    saving = true;

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
      if (pending) {
        schedule();
      }
    }
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
  };
};
window.saveProjectData = async function saveProjectData(project, options = {}) {
  const previousProject = getProject();
  const previousMilestones = new Set(previousProject?.unlockedMilestones || []);
  const milestoneSnapshot = typeof window.getProjectMilestoneSnapshot === 'function'
    ? window.getProjectMilestoneSnapshot(project)
    : { unlockedMilestones: project?.unlockedMilestones || [], visibleBadges: [] };
  const milestoneDefinitions = typeof window.getProjectMilestoneDefinitions === 'function'
    ? window.getProjectMilestoneDefinitions()
    : [];
  const mergedProject = {
    ...project,
    dailyWordHistory: updateDailyWritingHistory(project, previousProject),
    unlockedMilestones: milestoneSnapshot.unlockedMilestones,
  };
  const newlyUnlocked = milestoneSnapshot.unlockedMilestones
    .filter((milestoneId) => !previousMilestones.has(milestoneId))
    .map((milestoneId) => milestoneDefinitions.find((entry) => entry.id === milestoneId))
    .filter(Boolean);

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

document.addEventListener('DOMContentLoaded', async () => {
  document.addEventListener('click', (event) => {
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
      const settings = typeof window.api?.getSettings === 'function'
        ? await window.api.getSettings()
        : { betaTesterUnlocked: false };

      if (!settings?.betaTesterUnlocked && allProjects.length >= 1) {
        if (formMessage) {
          formMessage.textContent = 'Inkbug Beta currently allows one project slot. Delete your current project now, or unlock admin mode for testing.';
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

  if (typeof window.renderSidebar === 'function') {
    window.renderSidebar('home', null);
  }

  if (typeof window.renderTopBar === 'function') {
    window.renderTopBar('home', null, state.saveStatus);
  }
  renderReferenceDrawer();

  await restoreCurrentProjectSelection();
  await navigate('home');
});
