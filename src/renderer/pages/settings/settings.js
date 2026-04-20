window.registerPageInit('settings', function () {
  const profileForm = document.getElementById('profile-preferences-form');
  const projectForm = document.getElementById('project-preferences-form');
  const projectFields = document.getElementById('project-preferences-fields');
  const projectEmpty = document.getElementById('project-preferences-empty');
  const projectOverrideGrid = document.getElementById('project-override-grid');

  const profileAppearance = document.getElementById('settings-appearance');
  const profileSaveMode = document.getElementById('settings-save-mode');
  const profileFontFamily = document.getElementById('settings-editor-font-family');
  const profileFontSize = document.getElementById('settings-editor-font-size');
  const profileLineHeight = document.getElementById('settings-editor-line-height');
  const tabletModeInput = document.getElementById('toggle-tablet-mode');
  const profileMessage = document.getElementById('profile-preferences-message');
  const profileSaveButton = document.getElementById('profile-preferences-save');

  const projectDefaultsToggle = document.getElementById('project-use-profile-defaults');
  const projectSaveMode = document.getElementById('project-save-mode');
  const projectFontFamily = document.getElementById('project-editor-font-family');
  const projectFontSize = document.getElementById('project-editor-font-size');
  const projectLineHeight = document.getElementById('project-editor-line-height');
  const projectMessage = document.getElementById('project-preferences-message');
  const projectSaveButton = document.getElementById('project-preferences-save');

  let activeProject = window.getCurrentProject?.() || null;

  function syncProjectOverrideState() {
    const useDefaults = projectDefaultsToggle.checked;
    projectOverrideGrid.classList.toggle('is-disabled', useDefaults);
    projectOverrideGrid.querySelectorAll('input, select').forEach((input) => {
      input.disabled = useDefaults;
    });
  }

  function fillProfileForm() {
    const preferences = window.getUserPreferences?.() || window.getDefaultUserPreferences?.() || {};
    profileAppearance.value = preferences.appearance || 'light';
    profileSaveMode.value = preferences.saveMode || 'autosave';
    profileFontFamily.value = preferences.editorFontFamily || 'serif';
    profileFontSize.value = String(preferences.editorFontSize || 18);
    profileLineHeight.value = String(preferences.editorLineHeight || 1.7);
    tabletModeInput.checked = Boolean(preferences.tabletMode);
  }

  function fillProjectForm() {
    if (!activeProject) {
      projectFields.style.display = 'none';
      projectEmpty.style.display = 'block';
      return;
    }

    projectFields.style.display = 'block';
    projectEmpty.style.display = 'none';
    const projectPreferences = window.normalizeProjectEditorPreferences?.(activeProject.editorPreferences || {}) || activeProject.editorPreferences || {};
    projectDefaultsToggle.checked = projectPreferences.useProfileDefaults !== false;
    projectSaveMode.value = projectPreferences.saveMode || 'autosave';
    projectFontFamily.value = projectPreferences.fontFamily || 'serif';
    projectFontSize.value = String(projectPreferences.fontSize || 18);
    projectLineHeight.value = String(projectPreferences.lineHeight || 1.7);
    syncProjectOverrideState();
  }

  fillProfileForm();
  fillProjectForm();

  projectDefaultsToggle?.addEventListener('change', syncProjectOverrideState);

  profileForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    profileMessage.textContent = '';

    const nextPreferences = {
      appearance: profileAppearance.value,
      saveMode: profileSaveMode.value,
      editorFontFamily: profileFontFamily.value,
      editorFontSize: Number(profileFontSize.value || 18),
      editorLineHeight: Number(profileLineHeight.value || 1.7),
      tabletMode: tabletModeInput.checked,
    };

    await window.runButtonFeedback(profileSaveButton, async () => {
      await window.saveSettingsData({
        userPreferences: nextPreferences,
        syncProfile: true,
      });
      profileMessage.textContent = 'Default writing preferences saved.';
      fillProfileForm();
    });
  });

  projectForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    projectMessage.textContent = '';

    if (!activeProject) {
      return;
    }

    const nextProject = {
      ...activeProject,
      editorPreferences: {
        useProfileDefaults: projectDefaultsToggle.checked,
        saveMode: projectSaveMode.value,
        fontFamily: projectFontFamily.value,
        fontSize: Number(projectFontSize.value || 18),
        lineHeight: Number(projectLineHeight.value || 1.7),
      },
      updatedAt: new Date().toISOString(),
    };

    await window.runButtonFeedback(projectSaveButton, async () => {
      const savedProject = await window.saveProjectData(nextProject, {
        dirtyFields: ['editorPreferences'],
      });
      activeProject = savedProject;
      window.setCurrentProject(savedProject);
      projectMessage.textContent = projectDefaultsToggle.checked
        ? 'This project now follows your profile defaults.'
        : 'Project writing overrides saved.';
      fillProjectForm();
    });
  });

  document.getElementById('sign-out-btn')?.addEventListener('click', async () => {
    await window.authLogout?.();
  });
});
