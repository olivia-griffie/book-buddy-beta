window.initPage = async function () {
  const form = document.getElementById('create-project-form');
  const genreOptions = document.getElementById('genre-options');
  const genreCount = document.getElementById('genre-count');
  const formMessage = document.getElementById('form-message');
  const goalInput = document.getElementById('project-goal');
  const goalPercent = document.getElementById('project-goal-percent');
  const goalState = document.getElementById('project-goal-state');
  const goalCaption = document.getElementById('project-goal-caption');
  const goalFill = document.getElementById('project-goal-fill');
  const goalIcon = document.getElementById('project-goal-icon');
  const thumbnailInput = document.getElementById('project-thumbnail');
  const thumbnailPreview = document.getElementById('project-thumbnail-preview');
  const { genrePrompts } = await window.getGenrePromptData();
  const existingProjects = await window.api.getAllProjects();
  let thumbnailData = '';

  const genres = [...new Set(genrePrompts.map((entry) => entry.genre))]
    .filter((genre) => {
      const normalized = window.normalizeGenreKey(genre);
      return !normalized.includes('-') && !normalized.includes(' x ');
    })
    .sort((a, b) => a.localeCompare(b));

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

  function renderThumbnailPreview() {
    thumbnailPreview.innerHTML = thumbnailData
      ? `<img src="${thumbnailData}" alt="Project thumbnail preview" />`
      : '<span class="placeholder-icon">Book</span>';
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
    goalIcon.textContent = completed ? '✓' : '•';
  }

  async function readThumbnail(file) {
    if (!file) {
      thumbnailData = '';
      renderThumbnailPreview();
      return;
    }

    thumbnailData = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read the selected image.'));
      reader.readAsDataURL(file);
    });

    renderThumbnailPreview();
  }

  genreOptions.innerHTML = genres
    .map((genre) => `
      <label class="genre-option">
        <input type="checkbox" name="genres" value="${genre}" />
        <span>${genre}</span>
      </label>
    `)
    .join('');

  genreOptions.querySelectorAll('input').forEach((input) => {
    input.addEventListener('change', syncGenreSelectionState);
  });

  thumbnailInput?.addEventListener('change', async (event) => {
    formMessage.textContent = '';

    try {
      await readThumbnail(event.target.files?.[0]);
    } catch (error) {
      thumbnailData = '';
      renderThumbnailPreview();
      formMessage.textContent = error.message;
    }
  });

  syncGenreSelectionState();
  syncGoalPreview();
  renderThumbnailPreview();
  goalInput.addEventListener('input', syncGoalPreview);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formMessage.textContent = '';

    if (existingProjects.length >= 1) {
      formMessage.textContent = 'Book Buddy Beta currently allows one project slot. Delete your current project now, or buy the full version when it releases to unlock multiple projects.';
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
      genres: selectedGenres,
      wordCountGoal: Number(formData.get('wordCountGoal') || 0),
      currentWordCount: 0,
      thumbnail: thumbnailData,
      plotWorkbook: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!project.title) {
      formMessage.textContent = 'Add a project title before continuing.';
      return;
    }

    await window.api.saveProject(project);
    window.setCurrentProject(project);
    await window.navigate('plot-creation', { project });
  });
};
