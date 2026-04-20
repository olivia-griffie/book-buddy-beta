window.registerPageInit('plot-creation', async function ({ project }) {
  let activeProject = project || window.getCurrentProject();
  const emptyState = document.getElementById('plot-empty-state');
  const content = document.getElementById('plot-content');
  const createProjectButton = document.getElementById('plot-create-project');
  const saveButton = document.getElementById('save-plot-workbook');
  const saveMessage = document.getElementById('plot-save-message');
  const outlineInput = document.getElementById('plot-outline');
  const premiseInput = document.getElementById('plot-premise');
  const stakesInput = document.getElementById('plot-stakes');
  const notesInput = document.getElementById('plot-notes');
  const sectionTargets = document.getElementById('plot-section-targets');
  const workbookGrid = document.querySelector('.workbook-grid');

  createProjectButton?.addEventListener('click', () => window.navigate('create-project', { project: null }));

  if (!activeProject) {
    emptyState.style.display = 'grid';
    content.style.display = 'none';
    saveButton.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  content.style.display = 'grid';
  saveButton.style.display = 'inline-flex';
  content.querySelectorAll('.plot-block').forEach((block) => {
    block.open = false;
  });
  document.getElementById('plot-page-title').textContent = activeProject.title || 'Plot Builder';
  document.getElementById('plot-page-subtitle').textContent = (activeProject.genres || []).join(' + ');

  const workbook = activeProject.plotWorkbook || {};
  outlineInput.value = workbook.outline || '';
  premiseInput.value = workbook.premise || '';
  stakesInput.value = workbook.stakes || '';
  notesInput.value = workbook.notes || '';
  window.initializeTextEditor(content);
  [outlineInput, premiseInput, stakesInput, notesInput].forEach((field) => window.refreshTextEditor(field, field.value));

  function syncWorkbookLayout() {
    const premiseValue = window.getEditorFieldValue(premiseInput).trim();
    const stakesValue = window.getEditorFieldValue(stakesInput).trim();
    workbookGrid?.classList.toggle('has-secondary-column', Boolean(premiseValue && stakesValue));
  }

  function syncAutoHeight(textarea) {
    if (!textarea || textarea._richText) {
      return;
    }

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  syncAutoHeight(notesInput);
  notesInput?.addEventListener('input', () => syncAutoHeight(notesInput));
  [premiseInput, stakesInput, notesInput].forEach((field) => {
    field?.addEventListener('input', syncWorkbookLayout);
  });
  syncWorkbookLayout();

  const { genrePrompts, specificPrompts, hybridGuides } = await window.getGenrePromptData();
  const resources = window.getProjectResources(activeProject, {
    genrePrompts,
    specificPrompts,
    hybridGuides,
  });
  const autosave = window.createAutosaveController(async () => {
    const updatedProject = {
      ...activeProject,
      plotSections: resources.plotSections,
      plotWorkbook: {
        outline: window.getEditorFieldValue(outlineInput),
        premise: window.getEditorFieldValue(premiseInput),
        stakes: window.getEditorFieldValue(stakesInput),
        notes: window.getEditorFieldValue(notesInput),
      },
      updatedAt: new Date().toISOString(),
    };

    activeProject = await window.saveProjectData(updatedProject, {
      dirtyFields: ['plotSections', 'plotWorkbook'],
    });
    saveMessage.textContent = 'Plot notes autosaved.';
    syncWorkbookLayout();
    window.syncReferenceDrawer?.();
  }, {
    dirtyText: 'Plot notes not saved',
  });
  window.registerBeforeNavigate(async () => {
    await autosave.flush();
  });

  [outlineInput, premiseInput, stakesInput, notesInput].forEach((field) => {
    field?.addEventListener('input', () => autosave.touch());
  });

  outlineInput?.addEventListener('input', () => {
    const liveTarget = document.getElementById('reference-outline-live');
    if (!liveTarget) return;
    window.renderRichText?.(liveTarget, outlineInput.value || '', {
      emptyHtml: '<p class="reference-outline-empty">Start with a broad outline so this panel can mirror the spine of the story.</p>',
    });
  });
  const hybridPromptSection = document.getElementById('hybrid-prompts-section');
  const hybridPromptGrid = document.getElementById('hybrid-prompt-grid');

  function renderSectionTargets() {
    sectionTargets.innerHTML = resources.plotSections.map((section) => `
      <details class="plot-section-target-card">
        <summary class="plot-section-target-toggle">
          <div class="plot-section-label-row">
            <h3 class="plot-section-label" data-section-label-display="${section.id}">${section.label}</h3>
            <button
              type="button"
              class="plot-section-label-edit btn btn-ghost"
              data-section-label-edit="${section.id}"
              title="Rename this section"
            >Rename</button>
          </div>
          <span class="plot-section-target-indicator" aria-hidden="true"></span>
        </summary>
        <div class="plot-section-target-body">
          <div class="field">
            <label for="plot-section-desc-${section.id}">Section Guidance</label>
            <textarea
              id="plot-section-desc-${section.id}"
              class="plot-section-description-input"
              rows="3"
              data-section-description="${section.id}"
              placeholder="Describe what happens in this section of the story..."
            >${section.description || ''}</textarea>
          </div>
          <div class="field">
            <label for="plot-section-target-${section.id}">Target Words</label>
            <input id="plot-section-target-${section.id}" type="number" min="0" step="100" value="${section.targetWords || 0}" data-section-target="${section.id}" />
          </div>
          <div class="field">
            <label for="plot-section-notes-${section.id}">Section Notes</label>
            <textarea id="plot-section-notes-${section.id}" rows="4" data-section-notes="${section.id}">${section.notes || ''}</textarea>
          </div>
        </div>
      </details>
    `).join('');

    window.initializeTextEditor(sectionTargets);
    resources.plotSections.forEach((section) => {
      const notesField = sectionTargets.querySelector(`[data-section-notes="${section.id}"]`);
      if (notesField) {
        window.refreshTextEditor(notesField, section.notes || '');
      }
    });

    sectionTargets.querySelectorAll('[data-section-target]').forEach((input) => {
      input.addEventListener('input', () => {
        const section = resources.plotSections.find((entry) => entry.id === input.dataset.sectionTarget);
        if (!section) return;
        section.targetWords = Number(input.value || 0);
        autosave.touch();
      });
    });

    sectionTargets.querySelectorAll('[data-section-notes]').forEach((input) => {
      input.addEventListener('input', () => {
        const section = resources.plotSections.find((entry) => entry.id === input.dataset.sectionNotes);
        if (!section) return;
        section.notes = window.getEditorFieldValue(input);
        autosave.touch();
      });
    });

    sectionTargets.querySelectorAll('[data-section-description]').forEach((textarea) => {
      textarea.addEventListener('input', () => {
        const section = resources.plotSections.find((entry) => entry.id === textarea.dataset.sectionDescription);
        if (!section) return;
        section.description = textarea.value;
        autosave.touch();
      });
    });

    sectionTargets.querySelectorAll('[data-section-label-edit]').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const section = resources.plotSections.find((entry) => entry.id === button.dataset.sectionLabelEdit);
        if (!section) return;

        const nextLabel = await window.requestTextEntry?.({
          title: 'Rename Section',
          label: 'Section name',
          value: section.label,
          confirmLabel: 'Save name',
          placeholder: 'e.g. Act One, Rising Tension…',
        });
        if (!nextLabel?.trim()) return;

        section.label = nextLabel.trim();
        const display = sectionTargets.querySelector(`[data-section-label-display="${section.id}"]`);
        if (display) display.textContent = section.label;
        autosave.touch();
      });
    });
  }

  function getPlacementHint(plotPoint = '') {
    const normalizedPoint = window.normalizeGenreKey(plotPoint);
    const matchedSection = resources.plotSections.find((section) => (
      window.normalizeGenreKey(section.label) === normalizedPoint
      || normalizedPoint.includes(window.normalizeGenreKey(section.label))
      || window.normalizeGenreKey(section.label).includes(normalizedPoint)
    ));

    if (!matchedSection) {
      return 'Use this where it best supports the current act of the story.';
    }

    return `Best used around "${matchedSection.label}" in the book.`;
  }

  function buildBeatCards(entries, matchingPrompts) {
    if (!entries.length) {
      return '<article class="beat-card ui-card ui-card-soft ui-card-stack"><p>No plot data found for this genre yet.</p></article>';
    }

    return entries
      .map((entry) => {
        const promptEntry = matchingPrompts.find((prompt) => prompt.plotPoint === entry.plotPoint);

        return `
          <article class="beat-card ui-card ui-card-soft ui-card-stack">
            <h4>${entry.plotPoint}</h4>
            <ul>
              ${entry.questions.map((question) => `<li>${question}</li>`).join('')}
            </ul>
            <span class="beat-placement-hint">${getPlacementHint(entry.plotPoint)}</span>
            ${promptEntry?.prompt ? `<p class="prompt-callout">${promptEntry.prompt}</p>` : ''}
          </article>
        `;
      })
      .join('');
  }

  const hybridSection = document.getElementById('hybrid-guide-section');
  const hybridGrid = document.getElementById('hybrid-guide-grid');
  if (resources.hybridGuide) {
    hybridSection.style.display = 'grid';
    document.getElementById('hybrid-guide-title').textContent = resources.hybridGuide.genre;
    hybridGrid.innerHTML = Object.entries(resources.hybridGuide.beats)
      .map(([label, text]) => `
        <article class="hybrid-beat ui-card ui-card-soft ui-card-stack">
          <h3>${label}</h3>
          <p>${text}</p>
        </article>
      `)
      .join('');
  } else {
    hybridSection.style.display = 'none';
  }

  if (resources.hybridTrack?.beats?.length) {
    hybridPromptSection.style.display = 'block';
    document.getElementById('hybrid-prompts-title').textContent = resources.hybridTrack.genre;
    hybridPromptGrid.innerHTML = buildBeatCards(resources.hybridTrack.beats, resources.hybridTrack.prompts);
  } else {
    hybridPromptSection.style.display = 'none';
  }

  renderSectionTargets();

  function stripHtml(value = '') {
    const temp = document.createElement('div');
    temp.innerHTML = value;
    return (temp.textContent || temp.innerText || '').trim();
  }

  document.getElementById('generate-outline-btn')?.addEventListener('click', () => {
    const lines = resources.plotSections
      .map((section) => {
        const notesField = sectionTargets.querySelector(`[data-section-notes="${section.id}"]`);
        const notesRaw = notesField ? window.getEditorFieldValue(notesField) : section.notes || '';
        const notesText = stripHtml(notesRaw);
        const hasContent = section.targetWords > 0 || notesText;
        if (!hasContent) return null;

        const parts = [section.label];
        const descText = stripHtml(section.description);
        if (descText) parts.push(descText);
        if (section.targetWords > 0) parts.push(`Target Words: ${section.targetWords}`);
        if (notesText) parts.push(notesText);
        return parts.join('\n');
      })
      .filter(Boolean);

    if (!lines.length) return;

    const outlineText = lines.join('\n\n');
    window.refreshTextEditor(outlineInput, outlineText);
    outlineInput.dispatchEvent(new Event('input'));

    const outlineBlock = outlineInput.closest('details');
    if (outlineBlock) outlineBlock.open = true;
    outlineInput.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  saveButton.addEventListener('click', async () => {
    await window.runButtonFeedback(saveButton, async () => {
      const updatedProject = {
        ...activeProject,
        plotSections: resources.plotSections,
        plotWorkbook: {
          outline: window.getEditorFieldValue(outlineInput),
          premise: window.getEditorFieldValue(premiseInput),
          stakes: window.getEditorFieldValue(stakesInput),
          notes: window.getEditorFieldValue(notesInput),
        },
        updatedAt: new Date().toISOString(),
      };

      activeProject = await window.saveProjectData(updatedProject, {
        dirtyFields: ['plotSections', 'plotWorkbook'],
      });
      saveMessage.textContent = 'Plot notes saved.';
      syncWorkbookLayout();
      window.syncReferenceDrawer?.();
    });
  });
});
