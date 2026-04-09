function normalizeProject(project = {}) {
  return {
    id: project.id || '',
    title: project.title || 'Untitled Project',
    subtitle: project.subtitle || '',
    genres: Array.isArray(project.genres) ? project.genres : [],
    wordCountGoal: Number(project.wordCountGoal || 0),
    currentWordCount: Number(project.currentWordCount || 0),
    thumbnail: project.thumbnail || '',
  };
}

module.exports = {
  normalizeProject,
};
