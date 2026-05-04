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
  document.getElementById('plot-page-title').textContent = 'Plot';
  const resolvedEditorPreferences = window.resolveEditorPreferences?.(activeProject) || { saveMode: 'autosave' };

  const workbook = activeProject.plotWorkbook || {};
  outlineInput.value = workbook.outline || '';
  premiseInput.value = workbook.premise || '';
  stakesInput.value = workbook.stakes || '';
  notesInput.value = workbook.notes || '';
  let timeline = Array.isArray(workbook.timeline) ? workbook.timeline : [];
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
  let chapters = activeProject.chapters || [];

  const tagManagerContainer = document.getElementById('plot-tag-manager');
  let plotTagManager = null;
  if (tagManagerContainer) {
    plotTagManager = window.createTagManager({
      container: tagManagerContainer,
      initialTags: activeProject.tags || [],
      label: '',
      hint: 'Tags help readers find your story in the community. Free-form — type anything.',
      onChange: () => autosave.touch(),
    });
    tagManagerContainer.querySelector('.tm-root')?.classList.add('tm-inline');
  }

  const autosave = window.createAutosaveController(async () => {
    const updatedProject = {
      ...activeProject,
      chapters,
      plotSections: resources.plotSections,
      tags: plotTagManager?.getTags() ?? activeProject.tags ?? [],
      plotWorkbook: {
        outline: window.getEditorFieldValue(outlineInput),
        premise: window.getEditorFieldValue(premiseInput),
        stakes: window.getEditorFieldValue(stakesInput),
        notes: window.getEditorFieldValue(notesInput),
        timeline,
      },
      updatedAt: new Date().toISOString(),
    };

    activeProject = await window.saveProjectData(updatedProject, {
      dirtyFields: ['chapters', 'plotSections', 'plotWorkbook', 'tags'],
    });
    chapters = activeProject.chapters || [];
    saveMessage.textContent = 'Plot notes autosaved.';
    syncWorkbookLayout();
    window.syncReferenceDrawer?.();
  }, {
    dirtyText: 'Plot notes not saved',
    mode: resolvedEditorPreferences.saveMode,
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

  content.querySelectorAll('.plot-block').forEach((block, index) => {
    window.bindPersistentDetailsState?.(block, {
      projectId: activeProject.id,
      sectionId: `plot-block-${block.dataset.plotBlock || index}`,
      defaultOpen: (block.dataset.plotBlock || '') === 'outline',
    });
  });

  function renderSectionTargets() {
    sectionTargets.innerHTML = resources.plotSections.map((section) => {
      const linkedChapters = chapters.filter((ch) => ch.sectionId === section.id);
      const availableChapters = chapters.filter((ch) => ch.sectionId !== section.id);
      const linkedCount = linkedChapters.length;

      return `
        <details class="plot-section-target-card bb-collapse" data-section-target-card="${section.id}">
          <summary class="plot-section-target-toggle">
            <div class="bb-collapse__header">
              <h3 class="plot-section-label" data-section-label-display="${section.id}">${section.label}</h3>
              <p class="bb-collapse__meta">${Number(section.targetWords || 0).toLocaleString()} word target${linkedCount ? ` &middot; ${linkedCount} chapter${linkedCount !== 1 ? 's' : ''}` : ''}</p>
            </div>
            <span class="plot-section-target-indicator bb-collapse__chevron" aria-hidden="true">▾</span>
          </summary>
          <div class="plot-section-target-body bb-collapse__body">
            <div class="plot-section-target-actions">
              <button
                type="button"
                class="plot-section-label-edit btn btn-ghost"
                data-section-label-edit="${section.id}"
                title="Rename this section"
              >Rename Plot Point</button>
            </div>
            <div class="field">
              <label for="plot-section-desc-${section.id}">Plot Point Guidance</label>
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
            <div class="plot-chapter-links">
              <div class="plot-chapter-links-head">
                <span class="plot-chapter-links-label">Linked Chapters</span>
                ${linkedCount ? `<span class="plot-chapter-links-count">${linkedCount} linked</span>` : ''}
              </div>
              ${linkedChapters.length ? `
                <div class="plot-chapter-linked-list">
                  ${linkedChapters.map((ch) => `
                    <div class="plot-chapter-linked-row">
                      <span class="plot-chapter-linked-title">${escapeHtml(ch.title || 'Untitled Chapter')}</span>
                      <div class="plot-chapter-linked-foot">
                        <span class="plot-chapter-linked-words">${window.computeWordCount(ch.content || '')} words</span>
                        <button type="button" class="plot-chapter-unlink" data-unlink-chapter="${ch.id}" aria-label="Unlink ${escapeHtml(ch.title || 'chapter')}" title="Unlink chapter">&times;</button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : `<p class="plot-chapter-links-empty">No chapters linked to this section yet.</p>`}
              ${availableChapters.length ? `
                <div class="field">
                  <select class="plot-chapter-link-select" data-link-chapter-to="${section.id}">
                    <option value="">Link a chapter…</option>
                    ${availableChapters.map((ch) => `
                      <option value="${ch.id}">${escapeHtml(ch.title || 'Untitled Chapter')}</option>
                    `).join('')}
                  </select>
                </div>
              ` : ''}
            </div>
          </div>
        </details>
      `;
    }).join('');

    sectionTargets.querySelectorAll('[data-section-target-card]').forEach((details, index) => {
      window.bindPersistentDetailsState?.(details, {
        projectId: activeProject.id,
        sectionId: `plot-section-target-${details.dataset.sectionTargetCard}`,
        defaultOpen: index === 0,
      });
    });

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
          title: 'Rename Plot Point',
          label: 'Plot point name',
          value: section.label,
          confirmLabel: 'Save name',
          placeholder: 'e.g. Act One, Rising Tension…',
        });
        if (!nextLabel?.trim()) return;

        const trimmed = nextLabel.trim();
        const duplicate = resources.plotSections.some((s) => s.id !== section.id && s.label.toLowerCase() === trimmed.toLowerCase());
        if (duplicate) {
          window.requestTextEntry?.({ title: 'Name already used', label: 'A plot point with that name already exists. Choose a different name.', value: trimmed, confirmLabel: 'OK', placeholder: '' });
          return;
        }

        section.label = trimmed;
        const display = sectionTargets.querySelector(`[data-section-label-display="${section.id}"]`);
        if (display) display.textContent = section.label;
        autosave.touch();
      });
    });

    sectionTargets.querySelectorAll('[data-unlink-chapter]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const chapter = chapters.find((ch) => ch.id === btn.dataset.unlinkChapter);
        if (!chapter) return;
        chapter.sectionId = null;
        renderSectionTargets();
        autosave.touch();
      });
    });

    sectionTargets.querySelectorAll('[data-link-chapter-to]').forEach((select) => {
      select.addEventListener('change', () => {
        const chapterId = select.value;
        if (!chapterId) return;
        const chapter = chapters.find((ch) => ch.id === chapterId);
        if (!chapter) return;
        chapter.sectionId = select.dataset.linkChapterTo;
        renderSectionTargets();
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

  function generateTimelineId() {
    return 'tl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function renderTimeline() {
    const container = document.getElementById('plot-timeline');
    if (!container) return;

    if (!timeline.length) {
      container.innerHTML = '<p class="plot-timeline-empty">No events yet. Add your first timeline event below.</p>';
      return;
    }

    container.innerHTML = timeline.map((event, index) => `
      <div class="plot-timeline-event" data-timeline-id="${event.id}">
        <div class="plot-timeline-marker" aria-hidden="true"></div>
        <div class="plot-timeline-card">
          <div class="plot-timeline-card-head">
            <div class="plot-timeline-fields">
              <input
                class="plot-timeline-title"
                type="text"
                placeholder="Event title"
                value="${escapeHtml(event.title || '')}"
                data-timeline-field="title"
                data-timeline-id="${event.id}"
              />
              <input
                class="plot-timeline-period"
                type="text"
                placeholder="Time reference (e.g. Act 1, Year 500, Before the story)"
                value="${escapeHtml(event.period || '')}"
                data-timeline-field="period"
                data-timeline-id="${event.id}"
              />
            </div>
            <div class="plot-timeline-actions">
              <button type="button" class="btn btn-icon plot-timeline-move-btn" data-timeline-move-up="${event.id}" ${index === 0 ? 'disabled' : ''} title="Move up" aria-label="Move event up">↑</button>
              <button type="button" class="btn btn-icon plot-timeline-move-btn" data-timeline-move-down="${event.id}" ${index === timeline.length - 1 ? 'disabled' : ''} title="Move down" aria-label="Move event down">↓</button>
              <button type="button" class="btn btn-icon btn-danger plot-timeline-delete-btn" data-timeline-delete="${event.id}" title="Delete event" aria-label="Delete event">&times;</button>
            </div>
          </div>
          <textarea
            class="plot-timeline-description"
            placeholder="Describe what happened..."
            rows="2"
            data-timeline-field="description"
            data-timeline-id="${event.id}"
          >${escapeHtml(event.description || '')}</textarea>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('[data-timeline-field]').forEach((input) => {
      input.addEventListener('input', () => {
        const ev = timeline.find((e) => e.id === input.dataset.timelineId);
        if (!ev) return;
        ev[input.dataset.timelineField] = input.value;
        autosave.touch();
      });
    });

    container.querySelectorAll('[data-timeline-move-up]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = timeline.findIndex((e) => e.id === btn.dataset.timelineMoveUp);
        if (idx <= 0) return;
        [timeline[idx - 1], timeline[idx]] = [timeline[idx], timeline[idx - 1]];
        renderTimeline();
        autosave.touch();
      });
    });

    container.querySelectorAll('[data-timeline-move-down]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = timeline.findIndex((e) => e.id === btn.dataset.timelineMoveDown);
        if (idx < 0 || idx >= timeline.length - 1) return;
        [timeline[idx], timeline[idx + 1]] = [timeline[idx + 1], timeline[idx]];
        renderTimeline();
        autosave.touch();
      });
    });

    container.querySelectorAll('[data-timeline-delete]').forEach((btn) => {
      btn.addEventListener('click', () => {
        timeline = timeline.filter((e) => e.id !== btn.dataset.timelineDelete);
        renderTimeline();
        autosave.touch();
      });
    });
  }

  document.getElementById('add-timeline-event')?.addEventListener('click', () => {
    timeline.push({ id: generateTimelineId(), title: '', period: '', description: '' });
    renderTimeline();
    autosave.touch();
    const titles = document.querySelectorAll('.plot-timeline-title');
    titles[titles.length - 1]?.focus();
  });

  renderTimeline();
  renderSectionTargets();

  function escapeHtml(value = '') {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildOutlineFromSections() {
    const baseSettings = window.parseRichTextValue?.(window.getEditorFieldValue(outlineInput) || '')?.settings || {};
    let nextSettings = { ...baseSettings };

    const sectionHtml = resources.plotSections
      .map((section) => {
        const notesField = sectionTargets.querySelector(`[data-section-notes="${section.id}"]`);
        const notesRaw = notesField ? window.getEditorFieldValue(notesField) : section.notes || '';
        const parsedNotes = window.parseRichTextValue?.(notesRaw || '') || { html: '', settings: {} };
        const notesMeta = window.getRichTextContentMeta?.(notesRaw || '') || {
          hasContent: false,
          plainText: '',
        };
        const rawDesc = section.description || '';
        const descField = sectionTargets.querySelector(`[data-section-description="${section.id}"]`);
        const descRaw = descField ? window.getEditorFieldValue(descField) : rawDesc;
        const parsedDesc = window.parseRichTextValue?.(descRaw || '') || { html: '' };
        const descMeta = window.getRichTextContentMeta?.(descRaw || '') || { hasContent: false };
        const linkedChapters = chapters.filter((ch) => ch.sectionId === section.id);
        const hasContent = section.targetWords > 0 || descMeta.hasContent || notesMeta.hasContent || linkedChapters.length > 0;
        if (!hasContent) {
          return '';
        }

        if (!nextSettings.fontFamily && parsedNotes.settings?.fontFamily) {
          nextSettings.fontFamily = parsedNotes.settings.fontFamily;
        }
        if (!nextSettings.fontSize && parsedNotes.settings?.fontSize) {
          nextSettings.fontSize = parsedNotes.settings.fontSize;
        }
        if (!nextSettings.lineHeight && parsedNotes.settings?.lineHeight) {
          nextSettings.lineHeight = parsedNotes.settings.lineHeight;
        }
        if (!nextSettings.textAlign && parsedNotes.settings?.textAlign) {
          nextSettings.textAlign = parsedNotes.settings.textAlign;
        }

        const blocks = [
          `<p><strong>${escapeHtml(section.label || 'Untitled Section')}</strong></p>`,
        ];

        if (descMeta.hasContent) {
          blocks.push(parsedDesc.html || '');
        }

        if (section.targetWords > 0) {
          blocks.push(`<p><em>Target Words: ${Number(section.targetWords || 0).toLocaleString()}</em></p>`);
        }

        if (notesMeta.hasContent) {
          blocks.push(parsedNotes.html || '<p><br></p>');
        }

        if (linkedChapters.length > 0) {
          const chapterItems = linkedChapters
            .map((ch) => `<li>${escapeHtml(ch.title || 'Untitled Chapter')} <em>(${window.computeWordCount(ch.content || '').toLocaleString()} words)</em></li>`)
            .join('');
          blocks.push(`<p><strong>Chapters in this section:</strong></p><ul>${chapterItems}</ul>`);
        }

        return blocks.join('');
      })
      .filter(Boolean);

    const combinedHtml = sectionHtml.join('<p><br></p>') || '<p><br></p>';
    const serializedValue = window.serializeRichTextValue(
      combinedHtml,
      nextSettings,
    );
    const hasContent = window.getRichTextContentMeta?.(serializedValue)?.hasContent || false;

    return {
      hasContent,
      settings: nextSettings,
      value: serializedValue,
    };
  }

  document.getElementById('generate-outline-btn')?.addEventListener('click', () => {
    const nextOutline = buildOutlineFromSections();
    if (!nextOutline.hasContent) return;

    window.refreshTextEditor(outlineInput, nextOutline.value);
    outlineInput.dispatchEvent(new Event('input'));

    const outlineBlock = outlineInput.closest('details');
    if (outlineBlock) outlineBlock.open = true;

    const msg = document.getElementById('generate-outline-message');
    if (msg) {
      msg.innerHTML = 'Outline generated. <button class="generate-outline-message__link" type="button">View Outline ↑</button>';
      msg.hidden = false;
      msg.classList.remove('generate-outline-message--visible');
      requestAnimationFrame(() => msg.classList.add('generate-outline-message--visible'));

      msg.querySelector('.generate-outline-message__link')?.addEventListener('click', () => {
        outlineInput.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      clearTimeout(msg._hideTimer);
      msg._hideTimer = setTimeout(() => {
        msg.classList.remove('generate-outline-message--visible');
        msg.addEventListener('transitionend', () => { msg.hidden = true; }, { once: true });
      }, 6000);
    }
  });

  saveButton.addEventListener('click', async () => {
    await window.runButtonFeedback(saveButton, async () => {
      const updatedProject = {
        ...activeProject,
        chapters,
        plotSections: resources.plotSections,
        tags: plotTagManager?.getTags() ?? activeProject.tags ?? [],
        plotWorkbook: {
          outline: window.getEditorFieldValue(outlineInput),
          premise: window.getEditorFieldValue(premiseInput),
          stakes: window.getEditorFieldValue(stakesInput),
          notes: window.getEditorFieldValue(notesInput),
          timeline,
        },
        updatedAt: new Date().toISOString(),
      };

      activeProject = await window.saveProjectData(updatedProject, {
        dirtyFields: ['chapters', 'plotSections', 'plotWorkbook', 'tags'],
      });
      chapters = activeProject.chapters || [];
      saveMessage.textContent = 'Plot notes saved.';
      syncWorkbookLayout();
      window.syncReferenceDrawer?.();
    });
  });
});
