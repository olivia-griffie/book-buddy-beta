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
  const { genrePrompts } = await window.getGenrePromptData();

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

  syncGenreSelectionState();
  syncGoalPreview();
  goalInput.addEventListener('input', syncGoalPreview);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formMessage.textContent = '';

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
