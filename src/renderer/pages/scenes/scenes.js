window.registerPageInit('scenes', async function ({ project }) {
  function escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toPlainText(value = '') {
    const parsed = window.parseRichTextValue?.(value);
    const temp = document.createElement('div');
    temp.innerHTML = parsed?.html || String(value || '');
    return (temp.textContent || temp.innerText || '').trim().replace(/\s+/g, ' ');
  }

  function normalizeSectionIds(entity) {
    const ids = Array.isArray(entity.sectionIds) ? entity.sectionIds : (entity.sectionId ? [entity.sectionId] : []);
    return { ...entity, sectionIds: ids, sectionId: ids[0] || '' };
  }

  let activeProject = project || window.getCurrentProject();
  const emptyState = document.getElementById('scenes-empty-state');
  const content = document.getElementById('scenes-content');
  const saveButton = document.getElementById('save-scenes');
  const addButton = document.getElementById('add-scene');
  const imageTrigger = document.getElementById('scene-image-trigger');
  const list = document.getElementById('scenes-list');
  const saveMessage = document.getElementById('scenes-save-message');
  const editorShell = document.getElementById('scene-editor-shell');
  const editorEmpty = document.getElementById('scene-editor-empty');
  const createButton = document.getElementById('scenes-create-project');
  const deleteButton = document.getElementById('delete-scene');
  const sectionTargetsPanel = document.getElementById('scene-section-targets-panel');
  const sectionTargetsList = document.getElementById('scene-section-targets-list');
  const sectionTargetsMessage = document.getElementById('scenes-targets-save-message');
  const customSymbolInput = document.getElementById('scene-custom-symbol');
  const addCustomSymbolButton = document.getElementById('scene-add-custom-symbol');
  const customSymbolTags = document.getElementById('scene-custom-symbol-tags');

  createButton?.addEventListener('click', () => window.navigate('create-project', { project: null }));

  if (!activeProject) {
    emptyState.style.display = 'grid';
    content.style.display = 'none';
    saveButton.style.display = 'none';
    return;
  }

  const imageInput = document.getElementById('scene-image');
  const imagePreview = document.getElementById('scene-image-preview');

  emptyState.style.display = 'none';
  content.style.display = 'grid';
  saveButton.style.display = 'inline-flex';
  const resolvedEditorPreferences = window.resolveEditorPreferences?.(activeProject) || { saveMode: 'autosave' };
  document.getElementById('scenes-page-title').textContent = 'Scenes';
  window.initializeTextEditor(content);

  const promptData = await window.getGenrePromptData();
  const resources = window.getProjectResources(activeProject, promptData);
  const plotSections = (activeProject.plotSections || resources.plotSections).map((section) => ({ ...section }));
  const chapters = (activeProject.chapters || []).map((chapter) => ({ ...chapter }));
  const scenes = (activeProject.scenes || []).map((scene) => normalizeSectionIds(scene));
  const characters = (activeProject.characters || []).map((character) => normalizeSectionIds(character));
  const locations = (activeProject.locations || []).map((location) => normalizeSectionIds(location));
  const dailyPromptHistory = (activeProject.dailyPromptHistory || []).map((entry) => ({ ...entry }));
  let selectedId = scenes[0]?.id || '';

  const fields = {
    title: document.getElementById('scene-title'),
    linkedChapterId: document.getElementById('scene-linked-chapter'),
    summary: document.getElementById('scene-summary'),
    other: document.getElementById('scene-other'),
  };

  function getSceneTagButtons() {
    return [...document.querySelectorAll('[data-scene-tag]')];
  }

  function getBuiltInSceneTags() {
    return new Set(getSceneTagButtons()
      .filter((button) => button.dataset.customSceneTag !== 'true')
      .map((button) => button.dataset.sceneTag));
  }

  function readSceneTags() {
    return getSceneTagButtons()
      .filter((btn) => btn.getAttribute('aria-pressed') === 'true')
      .map((btn) => btn.dataset.sceneTag);
  }

  function applySceneTags(tags) {
    const active = new Set(tags || []);
    getSceneTagButtons().forEach((btn) => {
      const selected = active.has(btn.dataset.sceneTag);
      btn.classList.toggle('is-selected', selected);
      btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  }

  function renderCustomSymbolTags(scene) {
    if (!customSymbolTags) {
      return;
    }

    const builtInTags = getBuiltInSceneTags();
    const customTags = [...new Set((scene?.tags || [])
      .filter(Boolean)
      .map((tag) => String(tag).trim())
      .filter((tag) => tag && !builtInTags.has(tag)))];

    customSymbolTags.innerHTML = customTags.map((tag) => `
      <button
        class="character-type-tag scene-custom-symbol-tag is-selected"
        type="button"
        data-scene-tag="${escapeHtml(tag)}"
        data-custom-scene-tag="true"
        aria-pressed="true"
      >
        ${escapeHtml(tag)}
      </button>
    `).join('');
    syncSceneTagTooltips();
  }

  const sceneTagDescriptions = {
    Setup: 'A section target for establishing the story world, important relationships, baseline stakes, and the normal before disruption.',
    Disruption: 'A section target for the event or pressure that unsettles the existing order and pushes the story into motion.',
    Flashback: 'A section target or technique that returns to earlier events to reveal context, memory, trauma, or hidden cause.',
    'Internal Conflict': 'A section target for a character private struggle, contradiction, fear, desire, guilt, or difficult choice.',
    Revelation: 'A section target where new information changes the meaning of events, relationships, plans, or identity.',
    Crisis: 'A section target where pressure peaks into a decisive problem, failure, danger, or impossible choice.',
    Climax: 'A section target for the major confrontation or highest-intensity turning point of the story arc.',
    Aftermath: 'A section target for consequences, emotional fallout, recovery, damage, or changed relationships after a major event.',
    Resolution: 'A section target for closure, repair, final choices, new stability, or the story ending state.',
    Tense: 'A scene with sustained pressure, uncertainty, or emotional strain that keeps readers waiting for release.',
    Eerie: 'A scene with an unsettling, uncanny, or quietly disturbing atmosphere.',
    Melancholic: 'A scene shaped by sadness, longing, regret, or reflective emotional weight.',
    Hopeful: 'A scene that gives the characters or reader a sense that things can improve.',
    Dread: 'A scene that builds fear around something dangerous, painful, or inevitable.',
    Bittersweet: 'A scene that mixes emotional warmth or success with loss, cost, or sadness.',
    Peaceful: 'A calm scene that lets characters rest, recover, or experience quiet stability.',
    Chaotic: 'A scene where disorder, confusion, or overlapping pressures disrupt control.',
    Intimate: 'A close, private scene centered on vulnerability, trust, attraction, or emotional honesty.',
    Ominous: 'A scene that hints something bad, dangerous, or consequential is approaching.',
    Triumphant: 'A scene where a character experiences victory, vindication, or earned power.',
    Desperate: 'A scene where characters act under urgent pressure with few good options left.',
    Confrontation: 'A scene where characters directly face each other, a truth, a threat, or a conflict.',
    Chase: 'A pursuit scene driven by escape, capture, urgency, and motion.',
    Discovery: 'A scene where a character finds information, an object, a place, or a truth that changes what they know.',
    Reunion: 'A scene where separated characters meet again, often carrying relief, tension, or unresolved history.',
    Betrayal: 'A scene where trust is broken by deception, abandonment, exposed secrets, or changed allegiance.',
    Farewell: 'A scene of parting, goodbye, release, or final contact between characters.',
    Negotiation: 'A scene where characters bargain, trade leverage, set terms, or try to avoid direct conflict.',
    Seduction: 'A scene built around attraction, persuasion, temptation, or deliberate emotional influence.',
    Battle: 'A combat or large-scale conflict scene where opposing forces clash directly.',
    Escape: 'A scene where characters try to flee confinement, pursuit, danger, or a narrowing situation.',
    Interrogation: 'A scene where one character pressures another for answers, confession, or hidden information.',
    'Quiet Moment': 'A low-action scene that gives characters room for reflection, bonding, grief, or emotional recalibration.',
    Monologue: 'A scene centered on an extended speech that reveals motive, worldview, memory, or confession.',
    'Dream Sequence': 'A storytelling technique used to represent a character dream, fantasy, vision, or subconscious, often set apart from the main narrative.',
    'Close POV': 'Narration that stays tightly inside one character perspective, filtering the scene through their thoughts and senses.',
    'Distant Narrator': 'Narration that observes from farther away, giving less immediate access to character interiority.',
    'Multiple POV': 'A scene or sequence that uses more than one viewpoint or shifts perspective between characters.',
    Unreliable: 'Narration where the perspective may be incomplete, biased, deceptive, mistaken, or unstable.',
    'Stream of Thought': 'A narration style that follows a character inner flow of impressions, associations, and immediate thoughts.',
    Epistolary: 'A scene presented through letters, messages, documents, recordings, or other in-world text forms.',
    'In Medias Res': 'A scene that begins in the middle of action or conflict before explaining how events got there.',
    Retrospective: 'A scene narrated with hindsight, memory, or later understanding shaping how events are presented.',
    'Fast-Paced': 'A scene that moves quickly through action, dialogue, decisions, or escalating consequences.',
    'Slow Burn': 'A scene that develops tension, emotion, attraction, or dread gradually over time.',
    Cliffhanger: 'A scene ending that withholds resolution at a sharp moment of danger, discovery, or decision.',
    Breathless: 'A scene with compressed urgency, little pause, and a sense of racing momentum.',
    Languid: 'A scene with a slower, more lingering rhythm that invites atmosphere, sensation, or contemplation.',
    'Enclosed Space': 'A scene set somewhere confined, boxed-in, private, or physically limiting.',
    'Open Wilderness': 'A scene set in untamed, expansive, remote, or natural surroundings.',
    Urban: 'A scene shaped by a city, town, street, neighborhood, or built public environment.',
    Night: 'A scene where darkness, secrecy, quiet, danger, or altered perception matters.',
    Storm: 'A scene involving severe weather that heightens mood, conflict, danger, or symbolism.',
    Silence: 'A scene where absence of sound, withheld speech, or quiet tension carries meaning.',
    Crowd: 'A scene involving many people, public pressure, anonymity, spectacle, or social chaos.',
    Ruin: 'A scene set among decay, wreckage, aftermath, abandoned places, or broken structures.',
    'Sacred Space': 'A scene set somewhere holy, ritualized, revered, forbidden, or emotionally consecrated.',
    Weapon: 'An object used or threatened as a tool of violence, leverage, defense, or symbolism.',
    Letter: 'A written message that can reveal information, emotion, warning, confession, or connection.',
    Artifact: 'An important object from the past, a culture, a mystery, or a magical or symbolic system.',
    Mirror: 'An object that can reflect identity, truth, vanity, doubling, illusion, or self-recognition.',
    Door: 'A threshold object that can represent entry, escape, secrecy, transition, or forbidden access.',
    Blood: 'A symbol or physical trace tied to injury, violence, kinship, sacrifice, guilt, or mortality.',
    Fire: 'A force or symbol of destruction, purification, passion, danger, warmth, or transformation.',
    Photo: 'An image that preserves memory, exposes evidence, evokes loss, or anchors a past relationship.',
    Map: 'A guide or symbol of direction, territory, discovery, strategy, or the unknown.',
    Key: 'An object that grants access, unlocks secrets, marks trust, or symbolizes permission and power.',
    Poison: 'A substance or symbol tied to harm, betrayal, secrecy, corruption, or slow danger.',
    'Ritual Object': 'An item used in ceremony, magic, tradition, worship, or repeated symbolic action.',
  };

  const sectionTargetTagLabels = [
    'Setup',
    'Disruption',
    'Flashback',
    'Internal Conflict',
    'Revelation',
    'Crisis',
    'Climax',
    'Aftermath',
    'Resolution',
  ];

  function syncSceneTagTooltips() {
    const normalize = window.normalizeGenreKey || ((s) => s.toLowerCase().trim());
    getSceneTagButtons().forEach((button) => {
      const tagLabel = button.dataset.sceneTag || '';
      const targetIndex = sectionTargetTagLabels.indexOf(tagLabel);
      const section = targetIndex === -1
        ? null
        : plotSections.find((entry) => normalize(entry.label) === normalize(tagLabel) || normalize(entry.label).includes(normalize(tagLabel)))
          || plotSections[targetIndex]
          || null;
      const sectionDescription = toPlainText(section?.description || '');
      const description = sectionDescription || sceneTagDescriptions[tagLabel] || `A custom key item or symbol named ${tagLabel}.`;
      const title = sectionDescription ? `${section?.label || tagLabel}: ${description}` : `${tagLabel}: ${description}`;
      button.setAttribute('title', title);
      button.setAttribute('aria-label', title);
    });
  }
  syncSceneTagTooltips();
  const autosave = window.createAutosaveController(async () => {
    activeProject = await window.saveProjectData(buildProjectPayload(), {
      dirtyFields: ['plotSections', 'chapters', 'characters', 'scenes', 'locations', 'dailyPromptHistory', 'currentWordCount'],
    });
    saveMessage.textContent = 'Scenes autosaved.';
  }, {
    dirtyText: 'Scene changes not saved',
    mode: resolvedEditorPreferences.saveMode,
  });
  window.registerBeforeNavigate(async () => {
    await autosave.flush();
  });

  function getSelectedScene() {
    return scenes.find((scene) => scene.id === selectedId) || null;
  }

  function getNextChapterNumber() {
    const explicitNumbers = chapters
      .map((chapter) => {
        const match = String(chapter.title || '').match(/chapter\s+(\d+)/i);
        return match ? Number(match[1]) : 0;
      })
      .filter(Boolean);

    return explicitNumbers.length
      ? Math.max(...explicitNumbers) + 1
      : chapters.length + 1;
  }

  function getEntityCollection(type) {
    if (type === 'characters') {
      return characters;
    }
    if (type === 'scenes') {
      return scenes;
    }
    return locations;
  }

  function getEntityLabel(type, entity) {
    if (type === 'characters') {
      return entity.name || 'Unnamed Character';
    }
    if (type === 'scenes') {
      return entity.title || 'Untitled Scene';
    }
    return entity.name || 'Untitled Location';
  }

  function renderSectionLinkCard(type, label, sectionId) {
    const collection = getEntityCollection(type);
    const linkedItems = collection.filter((entity) => (entity.sectionIds || []).includes(sectionId));
    const selectableItems = collection.filter((entity) => !(entity.sectionIds || []).includes(sectionId));
    const singularLabel = label.endsWith('s') ? label.slice(0, -1) : label;

    return `
      <div class="plot-section-link-card">
        <div class="plot-section-link-head">
          <div>
            <h4>${label}</h4>
            <p>${linkedItems.length ? `${linkedItems.length} linked here` : `No ${label.toLowerCase()} linked yet`}</p>
          </div>
          <span class="plot-section-link-count">${linkedItems.length}</span>
        </div>
        <div class="plot-section-linked-list">
          ${linkedItems.length
      ? linkedItems.map((entity) => `
                <span class="plot-section-linked-chip">
                  <span>${escapeHtml(getEntityLabel(type, entity))}</span>
                  <button class="plot-section-chip-remove" type="button" data-unlink-entity="${type}" data-unlink-id="${entity.id}" data-unlink-section="${sectionId}">&times;</button>
                </span>
              `).join('')
      : '<span class="plot-section-link-empty">None linked yet.</span>'}
        </div>
        <div class="field">
          <label>Add ${singularLabel}</label>
          <select data-link-entity="${type}" data-link-section="${sectionId}">
            <option value="">Choose ${singularLabel.toLowerCase()}</option>
            ${selectableItems.map((entity) => `
              <option value="${entity.id}">${escapeHtml(getEntityLabel(type, entity))}</option>
            `).join('')}
          </select>
        </div>
      </div>
    `;
  }

  function buildProjectPayload() {
    return {
      ...activeProject,
      plotSections,
      chapters,
      scenes,
      characters,
      locations,
      dailyPromptHistory,
      currentWordCount: chapters.reduce(
        (sum, chapter) => sum + window.computeWordCount(chapter.content || ''),
        0,
      ),
      updatedAt: new Date().toISOString(),
    };
  }

  function populateLinkedChapterSelect() {
    const currentValue = fields.linkedChapterId.value;
    fields.linkedChapterId.innerHTML = `
      <option value="">General scene idea</option>
      ${chapters.map((chapter) => `<option value="${chapter.id}">${escapeHtml(chapter.title || 'Untitled Chapter')}</option>`).join('')}
    `;
    fields.linkedChapterId.value = chapters.some((chapter) => chapter.id === currentValue) ? currentValue : '';
  }

  function renderImagePreview(image) {
    imagePreview.innerHTML = image
      ? `<img src="${image}" alt="Scene reference" />`
      : '<span class="placeholder-icon">Scene</span>';
  }

  let dragSrcId = null;

  function attachDragHandlers(items, getId, getArray) {
    items.forEach((item) => {
      item.setAttribute('draggable', 'true');

      item.addEventListener('dragstart', (e) => {
        dragSrcId = getId(item);
        item.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      item.addEventListener('dragend', () => {
        dragSrcId = null;
        item.classList.remove('is-dragging');
        items.forEach((el) => el.classList.remove('drag-above', 'drag-below'));
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        items.forEach((el) => el.classList.remove('drag-above', 'drag-below'));
        const { top, height } = item.getBoundingClientRect();
        item.classList.add(e.clientY < top + height / 2 ? 'drag-above' : 'drag-below');
      });

      item.addEventListener('dragleave', (e) => {
        if (!item.contains(e.relatedTarget)) {
          item.classList.remove('drag-above', 'drag-below');
        }
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        const tgtId = getId(item);
        if (!dragSrcId || dragSrcId === tgtId) return;
        const arr = getArray();
        const srcIdx = arr.findIndex((x) => x.id === dragSrcId);
        const [moved] = arr.splice(srcIdx, 1);
        const { top, height } = item.getBoundingClientRect();
        const insertAfter = e.clientY >= top + height / 2;
        const tgtIdx = arr.findIndex((x) => x.id === tgtId);
        arr.splice(insertAfter ? tgtIdx + 1 : tgtIdx, 0, moved);
        autosave.touch();
        renderList();
      });
    });
  }

  function renderList() {
    list.innerHTML = scenes.length
      ? scenes.map((scene) => `
        <div class="entity-list-item" data-scene-id="${scene.id}">
          <span class="drag-handle" title="Drag to reorder" aria-hidden="true"></span>
          <button type="button" data-open-scene="${scene.id}">
            <strong>${scene.title || 'Untitled Scene'}</strong>
          </button>
          <span>${scene.image ? 'Image ready' : scene.linkedChapterId ? 'Connected' : 'General'}</span>
        </div>
      `).join('')
      : '<p>No scenes yet.</p>';

    list.querySelectorAll('[data-open-scene]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedId = button.dataset.openScene;
        renderEditor();
      });
    });

    attachDragHandlers(
      [...list.querySelectorAll('[data-scene-id]')],
      (el) => el.dataset.sceneId,
      () => scenes,
    );
  }

  function renderEditor() {
    const scene = getSelectedScene();
    populateLinkedChapterSelect();
    if (!scene) {
      editorShell.style.display = 'none';
      editorEmpty.style.display = 'block';
      document.getElementById('scene-editor-title').textContent = 'Select a scene';
      if (deleteButton) {
        deleteButton.style.display = 'none';
      }
      renderImagePreview('');
      renderCustomSymbolTags(null);
      return;
    }

    editorShell.style.display = 'block';
    editorEmpty.style.display = 'none';
    document.getElementById('scene-editor-title').textContent = scene.title || 'Scene Details';
    if (deleteButton) {
      deleteButton.style.display = 'inline-flex';
    }
    fields.title.value = scene.title || '';
    renderCustomSymbolTags(scene);
    applySceneTags(scene.tags || []);
    fields.linkedChapterId.value = scene.linkedChapterId || '';
    fields.summary.value = scene.summary || '';
    fields.other.value = scene.other || '';
    window.refreshTextEditor(fields.summary, fields.summary.value);
    window.refreshTextEditor(fields.other, fields.other.value);
    imageInput.value = '';
    renderImagePreview(scene.image || '');
  }

  function syncScene() {
    const scene = getSelectedScene();
    if (!scene) {
      return;
    }

    scene.title = fields.title.value.trim();
    scene.tags = readSceneTags();
    scene.linkedChapterId = fields.linkedChapterId.value;
    scene.summary = String(window.getEditorFieldValue(fields.summary) || '').trim();
    scene.other = String(window.getEditorFieldValue(fields.other) || '').trim();
    document.getElementById('scene-editor-title').textContent = scene.title || 'Scene Details';
    renderList();
    renderSectionTargets();
    autosave.touch();
  }

  function renderSectionTargets() {
    if (!sectionTargetsList) {
      return;
    }

    sectionTargetsList.innerHTML = plotSections
      .map((section) => {
        const sectionChapters = chapters.filter((chapter) => chapter.sectionId === section.id);
        const sectionWords = sectionChapters.reduce(
          (sum, chapter) => sum + window.computeWordCount(chapter.content || ''),
          0,
        );
        return `
          <details class="plot-section-item bb-collapse" data-section-id="${section.id}">
            <summary class="plot-section-toggle">
              <div class="plot-section-toggle-copy">
                <h3>${escapeHtml(section.label)}</h3>
                <p>${sectionWords.toLocaleString()} words across ${sectionChapters.length} chapter${sectionChapters.length === 1 ? '' : 's'}</p>
              </div>
              <span class="plot-section-toggle-indicator" aria-hidden="true">&#8964;</span>
            </summary>
            <div class="plot-section-body">
              <div class="plot-section-head">
                <div class="field">
                  <label>Plot area target words</label>
                  <input type="number" min="0" step="100" value="${section.targetWords || 0}" data-target-section="${section.id}" />
                </div>
              </div>
              <div class="chapter-list">
                ${sectionChapters.length
                  ? sectionChapters
                    .map((chapter) => `
                      <div class="chapter-row" data-open-chapter="${chapter.id}">
                        <div class="chapter-row-main">
                          <input
                            class="chapter-title-inline"
                            type="text"
                            value="${escapeHtml(chapter.title || '')}"
                            placeholder="Chapter title"
                            data-title-chapter="${chapter.id}"
                          />
                        </div>
                        <div class="chapter-row-foot">
                          <span class="chapter-row-word-count">${window.computeWordCount(chapter.content || '')} words</span>
                          <div class="chapter-row-actions">
                            <button class="chapter-row-delete" type="button" data-delete-chapter="${chapter.id}" aria-label="Delete ${escapeHtml(chapter.title || 'chapter')}" title="Delete chapter">&times;</button>
                          </div>
                        </div>
                      </div>
                    `)
                    .join('')
                  : '<p>No chapters yet for this section.</p>'}
              </div>
              <button class="btn btn-ghost add-chapter plot-section-add-chapter" type="button" data-section="${section.id}">Add Chapter</button>
              <div class="plot-section-links">
                <div class="plot-section-links-grid">
                  ${renderSectionLinkCard('characters', 'Characters', section.id)}
                  ${renderSectionLinkCard('scenes', 'Scenes', section.id)}
                  ${renderSectionLinkCard('locations', 'Locations', section.id)}
                </div>
              </div>
            </div>
          </details>
        `;
      })
      .join('');

    sectionTargetsList.querySelectorAll('details.plot-section-item').forEach((details) => {
      const containsSelectedScene = scenes
        .find((scene) => scene.id === selectedId)
        ?.sectionIds
        ?.includes(details.dataset.sectionId);
      window.bindPersistentDetailsState?.(details, {
        projectId: activeProject.id,
        sectionId: `scenes-section-${details.dataset.sectionId}`,
        defaultOpen: Boolean(containsSelectedScene),
      });
      if (containsSelectedScene) {
        details.open = true;
      }
    });

    sectionTargetsList.querySelectorAll('[data-target-section]').forEach((input) => {
      input.addEventListener('input', () => {
        const section = plotSections.find((entry) => entry.id === input.dataset.targetSection);
        if (section) {
          section.targetWords = Number(input.value || 0);
          autosave.touch();
        }
      });
    });

    sectionTargetsList.querySelectorAll('[data-open-chapter]').forEach((row) => {
      row.addEventListener('click', () => {
        window.navigate('chapters', { project: buildProjectPayload() });
      });
    });

    sectionTargetsList.querySelectorAll('[data-title-chapter]').forEach((input) => {
      input.addEventListener('input', () => {
        const chapter = chapters.find((entry) => entry.id === input.dataset.titleChapter);
        if (!chapter) {
          return;
        }

        chapter.title = input.value.trim();
        populateLinkedChapterSelect();
        autosave.touch();
      });

      input.addEventListener('click', (event) => {
        event.stopPropagation();
      });

      input.addEventListener('focus', (event) => {
        event.stopPropagation();
      });
    });

    sectionTargetsList.querySelectorAll('[data-delete-chapter]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const chapterId = button.dataset.deleteChapter;
        const chapterIndex = chapters.findIndex((entry) => entry.id === chapterId);
        if (chapterIndex === -1) {
          return;
        }

        const chapter = chapters[chapterIndex];
        const confirmed = window.confirm(`Delete "${chapter.title || 'this chapter'}"? This cannot be undone.`);
        if (!confirmed) {
          return;
        }

        chapters.splice(chapterIndex, 1);
        scenes.forEach((scene) => {
          if (scene.linkedChapterId === chapterId) {
            scene.linkedChapterId = '';
          }
        });
        characters.forEach((character) => {
          if (character.chapterIntro === chapterId) {
            character.chapterIntro = '';
          }
        });
        dailyPromptHistory.forEach((entry) => {
          if (entry.assignedChapterId === chapterId) {
            entry.assignedChapterId = '';
          }
        });

        sectionTargetsMessage.textContent = 'Chapter deleted.';
        populateLinkedChapterSelect();
        autosave.touch();
        renderList();
        renderEditor();
        renderSectionTargets();
      });
    });

    sectionTargetsList.querySelectorAll('.add-chapter').forEach((button) => {
      button.addEventListener('click', () => {
        const nextChapterNumber = getNextChapterNumber();
        const newChapter = {
          id: `chapter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title: `Chapter ${nextChapterNumber}`,
          sectionId: button.dataset.section,
          targetWords: 0,
          content: '',
        };

        chapters.push(newChapter);
        populateLinkedChapterSelect();
        autosave.touch();
        renderSectionTargets();
      });
    });

    sectionTargetsList.querySelectorAll('[data-link-entity]').forEach((input) => {
      input.addEventListener('change', () => {
        if (!input.value) {
          return;
        }

        const collection = getEntityCollection(input.dataset.linkEntity);
        const entity = collection.find((entry) => entry.id === input.value);
        if (!entity) {
          return;
        }

        const ids = entity.sectionIds || [];
        if (!ids.includes(input.dataset.linkSection)) {
          entity.sectionIds = [...ids, input.dataset.linkSection];
          entity.sectionId = entity.sectionIds[0];
        }
        autosave.touch();
        renderList();
        renderEditor();
        renderSectionTargets();
      });
    });

    sectionTargetsList.querySelectorAll('[data-unlink-entity]').forEach((button) => {
      button.addEventListener('click', () => {
        const collection = getEntityCollection(button.dataset.unlinkEntity);
        const entity = collection.find((entry) => entry.id === button.dataset.unlinkId);
        if (!entity) {
          return;
        }

        entity.sectionIds = (entity.sectionIds || []).filter((id) => id !== button.dataset.unlinkSection);
        entity.sectionId = entity.sectionIds[0] || '';
        autosave.touch();
        renderList();
        renderEditor();
        renderSectionTargets();
      });
    });
  }

  async function readImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read the selected scene image.'));
      reader.readAsDataURL(file);
    });
  }

  addButton.addEventListener('click', () => {
    const scene = {
      id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: `Scene ${scenes.length + 1}`,
      image: '',
      tags: [],
      linkedChapterId: '',
      sectionIds: [],
      sectionId: '',
      summary: '',
      other: '',
    };

    scenes.push(scene);
    selectedId = scene.id;
    autosave.touch();
    renderList();
    renderEditor();
  });

  Object.values(fields).forEach((field) => {
    field.addEventListener('input', syncScene);
    field.addEventListener('change', syncScene);
  });

  document.getElementById('scene-editor-shell').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-scene-tag]');
    if (!btn) return;
    const pressed = btn.getAttribute('aria-pressed') === 'true';
    btn.setAttribute('aria-pressed', pressed ? 'false' : 'true');
    btn.classList.toggle('is-selected', !pressed);
    syncScene();
    if (btn.dataset.customSceneTag === 'true') {
      renderCustomSymbolTags(getSelectedScene());
      applySceneTags(getSelectedScene()?.tags || []);
    }
  });

  function addCustomSymbolTag() {
    const scene = getSelectedScene();
    const value = customSymbolInput?.value.trim();
    if (!scene || !value) {
      return;
    }

    const existingTags = scene.tags || [];
    const duplicate = existingTags.some((tag) => tag.toLowerCase() === value.toLowerCase());
    if (!duplicate) {
      scene.tags = [...existingTags, value];
    }

    customSymbolInput.value = '';
    renderCustomSymbolTags(scene);
    applySceneTags(scene.tags || []);
    syncScene();
  }

  addCustomSymbolButton?.addEventListener('click', addCustomSymbolTag);
  customSymbolInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addCustomSymbolTag();
    }
  });

  imageInput.addEventListener('change', async (event) => {
    const scene = getSelectedScene();
    const file = event.target.files?.[0];
    if (!scene || !file) {
      return;
    }

    try {
      scene.image = await readImage(file);
      renderImagePreview(scene.image);
      renderList();
      saveMessage.textContent = '';
      autosave.touch();
    } catch (error) {
      saveMessage.textContent = error.message;
    }
  });

  imageTrigger?.addEventListener('click', () => {
    imageInput?.click();
  });

  deleteButton?.addEventListener('click', () => {
    const scene = getSelectedScene();
    if (!scene) {
      return;
    }

    const confirmed = window.confirm(`Delete "${scene.title || 'this scene'}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    const index = scenes.findIndex((entry) => entry.id === scene.id);
    if (index === -1) {
      return;
    }

    scenes.splice(index, 1);
    characters.forEach((character) => {
      if (character.deathScene === scene.id) {
        character.deathScene = '';
      }
      if (character.romanceScenes === scene.id) {
        character.romanceScenes = '';
      }
    });
    selectedId = scenes[Math.max(0, index - 1)]?.id || scenes[0]?.id || '';
    saveMessage.textContent = 'Scene deleted.';
    autosave.touch();
    renderList();
    renderEditor();
  });

  saveButton.addEventListener('click', async () => {
    await window.runButtonFeedback(saveButton, async () => {
      activeProject = await window.saveProjectData(buildProjectPayload(), {
        dirtyFields: ['plotSections', 'chapters', 'characters', 'scenes', 'locations', 'dailyPromptHistory', 'currentWordCount'],
      });
      saveMessage.textContent = 'Scenes saved.';
    });
  });

  window.bindPersistentDetailsState?.(sectionTargetsPanel, {
    projectId: activeProject.id,
    sectionId: 'scenes-section-targets-panel',
    defaultOpen: true,
  });
  populateLinkedChapterSelect();
  renderList();
  renderEditor();
  renderSectionTargets();
});
