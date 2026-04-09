window.initPage = async function () {
  const form = document.getElementById('create-project-form');
  const genreOptions = document.getElementById('genre-options');
  const genreCount = document.getElementById('genre-count');
  const formMessage = document.getElementById('form-message');
  const { genrePrompts } = await window.getGenrePromptData();

  const genres = [...new Set(genrePrompts.map((entry) => entry.genre))]
    .filter((genre) => !genre.includes('–') && !genre.includes('×'))
    .sort((a, b) => a.localeCompare(b));

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

  genreOptions.innerHTML = genres
    .map((genre) => `
      <label class="genre-option">
        <input type="checkbox" name="genres" value="${genre}" />
        <span>${genre}</span>
      </label>
    `)
    .join('');

  genreOptions.querySelectorAll('input').forEach((input) => {
    input.addEventListener('change', () => {
      syncGenreSelectionState();
    });
  });

  syncGenreSelectionState();

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
