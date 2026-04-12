const projectStoreState = {
  project: null,
};

const projectStoreListeners = new Set();

function notifyProjectStore() {
  projectStoreListeners.forEach((listener) => {
    try {
      listener(projectStoreState.project);
    } catch (error) {
      console.error('Project store listener failed.', error);
    }
  });
}

window.projectStore = {
  getProject() {
    return projectStoreState.project;
  },
  setProject(project) {
    projectStoreState.project = project || null;
    notifyProjectStore();
    return projectStoreState.project;
  },
  updateProject(updater) {
    if (typeof updater !== 'function') {
      return projectStoreState.project;
    }

    const nextProject = updater(projectStoreState.project);
    projectStoreState.project = nextProject || null;
    notifyProjectStore();
    return projectStoreState.project;
  },
  clearProject() {
    projectStoreState.project = null;
    notifyProjectStore();
    return null;
  },
  subscribe(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    projectStoreListeners.add(listener);
    return () => {
      projectStoreListeners.delete(listener);
    };
  },
};
