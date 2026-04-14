window.registerPageInit('create-project', async function () {
  const fallbackGenres = [
    'Fantasy',
    'Romance',
    'Horror',
    'Mystery',
    'Thriller',
    'Science Fiction',
    'Historical Fiction',
    'Memoir',
    'Literary Fiction',
    'Contemporary',
  ];

  const form = document.getElementById('create-project-form');
  const genreOptions = document.getElementById('genre-options');
  const genreCount = document.getElementById('genre-count');
  const formMessage = document.getElementById('form-message');
  const projectSlotNote = document.getElementById('project-slot-note');
  const goalInput = document.getElementById('project-goal');
  const goalPercent = document.getElementById('project-goal-percent');
  const goalState = document.getElementById('project-goal-state');
  const goalCaption = document.getElementById('project-goal-caption');
  const goalFill = document.getElementById('project-goal-fill');
  const goalIcon = document.getElementById('project-goal-icon');
  const titleInput = document.getElementById('project-title');
  const thumbnailInput = document.getElementById('project-thumbnail');
  const thumbnailTrigger = document.getElementById('project-thumbnail-trigger');
  const thumbnailPreview = document.getElementById('project-thumbnail-preview');
  const thumbnailStatus = document.getElementById('project-thumbnail-status');

  let existingProjects = [];
  let projectLimitsReady = false;
  let thumbnailData = '';

  function normalizeGenre(value = '') {
    if (typeof window.normalizeGenreKey === 'function') {
      return window.normalizeGenreKey(value);
    }

    return String(value || '').trim().toLowerCase();
  }

  function formatWords(value) {
    return Number(value || 0).toLocaleString();
  }

  function getSelectedGenres() {
    return [...genreOptions.querySelectorAll('input:checked')].map((input) => input.value);
  }

  function syncGenreSelectionState() {
    const selected = getSelectedGenres();
    genreCount.textContent = `${selected.length} selected`;

    genreOptions.querySelectorAll('input').forEach((input) => {
      const shouldDisable = selected.length >= 2 && !input.checked;
      input.disabled = shouldDisable;
      input.closest('.genre-option')?.classList.toggle('is-disabled', shouldDisable);
    });
  }

  function renderGenreOptions(sourceGenres = fallbackGenres) {
    const selectedGenres = new Set(getSelectedGenres());
    const genres = [...new Set(sourceGenres)]
      .filter((genre) => {
        const normalized = normalizeGenre(genre);
        return normalized && !normalized.includes('-') && !normalized.includes(' x ');
      })
      .sort((left, right) => left.localeCompare(right));

    genreOptions.innerHTML = genres
      .map((genre) => `
        <label class="genre-option">
          <input type="checkbox" name="genres" value="${genre}" ${selectedGenres.has(genre) ? 'checked' : ''} />
          <span>${genre}</span>
        </label>
      `)
      .join('');

    genreOptions.querySelectorAll('input').forEach((input) => {
      input.addEventListener('change', syncGenreSelectionState);
    });

    syncGenreSelectionState();
  }

  function renderThumbnailPreview() {
    thumbnailPreview.innerHTML = thumbnailData
      ? `<img src="${thumbnailData}" alt="Project thumbnail preview" />`
      : '<span class="placeholder-icon">Book</span>';
    if (thumbnailStatus) {
      thumbnailStatus.textContent = thumbnailData ? 'Image selected and ready for this project.' : 'No image selected yet.';
    }
  }

  function syncProjectLimitState() {
    projectSlotNote.textContent = 'Book Buddy Beta currently supports one active project slot. Delete your current project to start a different one.';
  }

  function syncGoalPreview() {
    const goal = Number(goalInput.value || 0);
    const currentWords = 0;
    const percent = goal > 0 ? Math.min(100, Math.round((currentWords / goal) * 100)) : 0;
    const completed = goal > 0 && currentWords >= goal;

    goalPercent.textContent = `${percent}%`;
    goalState.textContent = completed ? 'Completed' : 'in progress';
    goalCaption.textContent = `${formatWords(currentWords)} of ${formatWords(goal)} words`;
    goalFill.style.width = `${percent}%`;
    goalFill.classList.toggle('is-complete', completed);
    goalIcon.classList.toggle('is-complete', completed);
    goalIcon.textContent = completed ? 'OK' : '...';
  }

  async function readThumbnail(file) {
    if (!file) {
      thumbnailData = '';
      renderThumbnailPreview();
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    thumbnailPreview.innerHTML = `<img src="${previewUrl}" alt="Project thumbnail preview" />`;

    thumbnailData = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read the selected image.'));
      reader.readAsDataURL(file);
    });

    renderThumbnailPreview();
  }

  async function bootstrapProjectSetup() {
    try {
      const promptData = await window.getGenrePromptData();
      const promptGenres = (promptData?.genrePrompts || []).map((entry) => entry.genre).filter(Boolean);
      if (promptGenres.length) {
        renderGenreOptions(promptGenres);
      }
    } catch (error) {
      formMessage.textContent = 'Prompt guidance did not load cleanly, so Book Buddy is using a fallback genre list for now.';
    }

    try {
      existingProjects = await window.api.getAllProjects();
      projectLimitsReady = true;
      syncProjectLimitState();
    } catch (error) {
      projectLimitsReady = false;
      formMessage.textContent = formMessage.textContent || 'Project settings did not load cleanly. You can still create a project and retry a restart later if needed.';
    }
  }

  renderGenreOptions(fallbackGenres);
  renderThumbnailPreview();
  syncGoalPreview();
  syncProjectLimitState();

  async function handleThumbnailSelection(event) {
    formMessage.textContent = '';

    try {
      await readThumbnail(event.target.files?.[0]);
      if (event.target.files?.[0]) {
        formMessage.textContent = 'Thumbnail selected.';
      }
    } catch (error) {
      thumbnailData = '';
      renderThumbnailPreview();
      formMessage.textContent = error.message;
    }
  }

  thumbnailInput?.addEventListener('change', handleThumbnailSelection);
  thumbnailInput?.addEventListener('input', handleThumbnailSelection);

  goalInput.addEventListener('input', syncGoalPreview);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formMessage.textContent = '';

    if (projectLimitsReady && existingProjects.length >= 1) {
      formMessage.textContent = 'Book Buddy Beta currently allows one project slot. Delete your current project to create a different one.';
      return;
    }

    const formData = new FormData(form);
    const selectedGenres = getSelectedGenres();

    if (!selectedGenres.length) {
      formMessage.textContent = 'Choose at least one genre.';
      return;
    }

    const project = {
      id: `project-${Date.now()}`,
      title: String(formData.get('title') || '').trim(),
      subtitle: String(formData.get('subtitle') || '').trim(),
      authorName: String(formData.get('authorName') || '').trim(),
      genres: selectedGenres,
      wordCountGoal: Number(formData.get('wordCountGoal') || 0),
      targetCompletionDate: String(formData.get('targetCompletionDate') || '').trim(),
      currentWordCount: 0,
      thumbnail: thumbnailData,
      plotWorkbook: {},
      dailyWordHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!project.title) {
      formMessage.textContent = 'Add a project title before continuing.';
      titleInput?.focus();
      return;
    }

    try {
      const savedProject = await window.api.saveProject(project);
      window.setCurrentProject(savedProject);
      await window.navigate('plot-creation', { project: savedProject });
    } catch (error) {
      formMessage.textContent = error?.message || 'Project creation failed. Please try again.';
    }
  });

  bootstrapProjectSetup().catch(() => {});
});
