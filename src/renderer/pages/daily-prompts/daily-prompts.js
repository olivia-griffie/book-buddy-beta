window.registerPageInit('daily-prompts', async function ({ project }) {
  let activeProject = project || window.getCurrentProject();
  const session = await window.api.auth.getSession().catch(() => null);
  const currentUserId = session?.user?.id || session?.id || null;
  const emptyState = document.getElementById('daily-prompts-empty-state');
  const content = document.getElementById('daily-prompts-content');
  const createButton = document.getElementById('daily-prompts-create-project');
  const generateButton = document.getElementById('generate-prompts');
  const countInput = document.getElementById('prompt-count');
  const modeInput = document.getElementById('prompt-mode');
  const status = document.getElementById('daily-prompts-status');
  const resultsGrid = document.getElementById('prompt-results-grid');
  const progressCard = document.getElementById('daily-prompts-progress');
  const progressIcon = document.getElementById('daily-prompts-progress-icon');
  const progressPercent = document.getElementById('daily-prompts-progress-percent');
  const progressState = document.getElementById('daily-prompts-progress-state');
  const progressCaption = document.getElementById('daily-prompts-progress-caption');
  const progressFill = document.getElementById('daily-prompts-progress-fill');

  createButton?.addEventListener('click', () => window.navigate('create-project', { project: null }));

  if (!activeProject) {
    emptyState.style.display = 'grid';
    content.style.display = 'none';
    generateButton.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  content.style.display = 'grid';
  generateButton.style.display = 'inline-flex';
  document.getElementById('daily-prompts-title').textContent = `${activeProject.title || 'Project'} Daily Prompts`;

  const promptData = await window.getGenrePromptData();
  const resources = window.getProjectResources(activeProject, promptData);
  const dailyState = {
    cursor: Number(activeProject.dailyPromptState?.cursor || 0),
  };

  function extractPromptWordTarget(prompt = '') {
    const normalizedPrompt = String(prompt || '').replace(/,/g, '');
    const patterns = [
      /\bwrite\b[\s\S]{0,24}?\b(\d+)\s*-\s*word\b/i,
      /\bwrite\b[\s\S]{0,24}?\b(\d+)\s+words?\b/i,
      /\b(\d+)\s*-\s*word\b/i,
      /\b(\d+)\s+words?\b/i,
    ];
    const match = patterns
      .map((pattern) => normalizedPrompt.match(pattern))
      .find(Boolean);

    return match ? Number(match[1]) : 0;
  }

  function getPromptAnswerWordCount(entry) {
    return window.computeWordCount(entry?.answer || '');
  }

  if (activeProject.dailyPromptHistory?.some((entry) => (
    !entry.id
    || typeof entry.requiredWordCount !== 'number'
    || typeof entry.insertedWordCount !== 'number'
  ))) {
    activeProject = await window.saveProjectData({
      ...activeProject,
      dailyPromptHistory: (activeProject.dailyPromptHistory || []).map((entry, index) => ({
        ...entry,
        id: entry.id || `daily-prompt-legacy-${Date.now()}-${index}`,
        assignedChapterId: entry.assignedChapterId || '',
        answer: entry.answer || '',
        answerInsertedAt: entry.answerInsertedAt || '',
        requiredWordCount: Number(entry.requiredWordCount || extractPromptWordTarget(entry.prompt)),
        insertedWordCount: Number(entry.insertedWordCount || 0),
      })),
      updatedAt: new Date().toISOString(),
    }, {
      dirtyFields: ['dailyPromptHistory'],
    });
  }

  function getChapters() {
    return activeProject.chapters || [];
  }

  function getDailyHistory() {
    return activeProject.dailyPromptHistory || [];
  }

  function setStatusMessage(message = '', tone = '') {
    status.textContent = message;
    status.classList.toggle('is-error', tone === 'error');
  }

  function pickRandom(array, count) {
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  function getActiveSceneTags(proj) {
    const scenes = proj.scenes || [];
    const plotSections = proj.plotSections || [];
    const normalize = window.normalizeGenreKey || ((s) => s.toLowerCase().trim());

    // Find the section that matches the current cursor position
    const pool = resources.promptPool;
    const currentEntry = pool[dailyState.cursor % (pool.length || 1)];
    const matchedSection = currentEntry?.plotPoint
      ? plotSections.find((s) => normalize(s.label) === normalize(currentEntry.plotPoint))
      : null;

    const linkedScenes = matchedSection
      ? scenes.filter((scene) => {
        const ids = Array.isArray(scene.sectionIds) ? scene.sectionIds : (scene.sectionId ? [scene.sectionId] : []);
        return ids.includes(matchedSection.id);
      })
      : scenes;

    return [...new Set(linkedScenes.flatMap((s) => s.tags || []).map((t) => t.toLowerCase()))];
  }

  function getCharacterNarrativeTags(proj) {
    return [...new Set(
      (proj.characters || []).flatMap((c) => c.narrativeTags || []).map((t) => t.toLowerCase()),
    )];
  }

  function scorePromptEntry(entry, proj) {
    let score = 0;
    const promptText = (entry.prompt || '').toLowerCase();
    const plotPointText = (entry.plotPoint || '').toLowerCase();

    const projectTags = (proj.tags || []).map((t) => t.toLowerCase());
    if (projectTags.some((t) => plotPointText.includes(t))) score += 2;
    if (projectTags.some((t) => promptText.includes(t))) score += 1;

    const activeSceneTags = getActiveSceneTags(proj);
    activeSceneTags.forEach((tag) => {
      if (promptText.includes(tag)) score += 3;
    });

    const narrativeTags = getCharacterNarrativeTags(proj);
    narrativeTags.forEach((tag) => {
      if (promptText.includes(tag)) score += 2;
    });

    return score;
  }

  function weightedPick(pool, count, proj) {
    const scored = pool.map((entry) => ({
      entry,
      weight: scorePromptEntry(entry, proj) + 1, // +1 so every entry has a non-zero chance
    }));

    const picked = [];
    const remaining = [...scored];

    while (remaining.length && picked.length < count) {
      const total = remaining.reduce((sum, item) => sum + item.weight, 0);
      let rand = Math.random() * total;
      const idx = remaining.findIndex((item) => {
        rand -= item.weight;
        return rand <= 0;
      });
      const chosen = remaining.splice(idx === -1 ? remaining.length - 1 : idx, 1)[0];
      picked.push(chosen.entry);
    }

    return picked;
  }

  const CHARACTER_ROLE_LABELS = {
    protagonist: 'Protagonist',
    antagonist: 'Antagonist',
    'love-interest': 'Love Interest',
    confidant: 'Confidant',
    deuteragonist: 'Deuteragonist',
    foil: 'Foil',
    tertiary: 'Character',
  };
  const CHARACTER_ROLE_ORDER = ['protagonist', 'love-interest', 'antagonist', 'confidant', 'deuteragonist', 'foil', 'tertiary'];

  function getContextLabel(index, entry) {
    const plotSections = activeProject.plotSections || [];
    const normalize = window.normalizeGenreKey || ((s) => s.toLowerCase().trim());

    const matchedSection = entry?.plotPoint
      ? plotSections.find((s) => normalize(s.label) === normalize(entry.plotPoint))
      : null;
    const sectionId = matchedSection?.id || null;

    function filterBySection(items, fallback) {
      if (!sectionId) return fallback;
      const linked = items.filter((item) => {
        const ids = Array.isArray(item.sectionIds) ? item.sectionIds : (item.sectionId ? [item.sectionId] : []);
        return ids.includes(sectionId);
      });
      return linked.length ? linked : [];
    }

    const allCharacters = filterBySection(
      (activeProject.characters || []).filter((c) => c.name),
      (activeProject.characters || []).filter((c) => c.name),
    );
    const candidateScenes = filterBySection(activeProject.scenes || [], activeProject.scenes || []);
    const candidateLocations = filterBySection(activeProject.locations || [], activeProject.locations || []);

    const scene = candidateScenes[index % (candidateScenes.length || 1)];
    const location = candidateLocations[index % (candidateLocations.length || 1)];
    const pieces = [];

    if (allCharacters.length > 0) {
      // Sort by role priority so protagonist always surfaces first
      const sorted = [...allCharacters].sort((a, b) => {
        const aRole = (a.typeTags || []).find((t) => CHARACTER_ROLE_ORDER.includes(t));
        const bRole = (b.typeTags || []).find((t) => CHARACTER_ROLE_ORDER.includes(t));
        const aIdx = aRole !== undefined ? CHARACTER_ROLE_ORDER.indexOf(aRole) : Infinity;
        const bIdx = bRole !== undefined ? CHARACTER_ROLE_ORDER.indexOf(bRole) : Infinity;
        return aIdx - bIdx;
      });

      const maxCharacters = Math.min(3, sorted.length);
      const characterCount = sorted.length === 1
        ? 1
        : Math.floor(Math.random() * maxCharacters) + 1;

      // Always include the top-priority character; fill the rest randomly
      const top = sorted.slice(0, 1);
      const rest = pickRandom(sorted.slice(1), Math.max(0, characterCount - 1));
      const picked = [...top, ...rest];

      const charParts = picked.map((c) => {
        const primaryRole = (c.typeTags || []).find((t) => CHARACTER_ROLE_LABELS[t]);
        const narrativePart = (c.narrativeTags || []).slice(0, 2).join(', ');
        const base = primaryRole
          ? `${CHARACTER_ROLE_LABELS[primaryRole]}: ${c.name}`
          : `Character: ${c.name}`;
        return narrativePart ? `${base} (${narrativePart})` : base;
      });
      pieces.push(charParts.join(' | '));
    }

    if (scene?.title) {
      const sceneTags = (scene.tags || []).filter(Boolean).slice(0, 3);
      pieces.push(sceneTags.length
        ? `Scene: ${scene.title} [${sceneTags.join(', ')}]`
        : `Scene: ${scene.title}`);
    }
    if (location?.name) pieces.push(`Location: ${location.name}`);
    return pieces.length ? pieces.join(' | ') : 'Use this anywhere in the draft.';
  }

  function hasPromptBeenCompleted(entry) {
    if (!entry?.assignedChapterId || !entry?.answerInsertedAt) {
      return false;
    }

    const requiredWordCount = Number(entry.requiredWordCount || extractPromptWordTarget(entry.prompt));
    const insertedWordCount = Number(entry.insertedWordCount || 0);

    return requiredWordCount > 0
      ? insertedWordCount >= requiredWordCount
      : insertedWordCount > 0;
  }

  function buildCompletionSnapshot(entry) {
    const requiredWordCount = Number(entry.requiredWordCount || extractPromptWordTarget(entry.prompt));
    const answerWords = entry.answerInsertedAt
      ? Number(entry.insertedWordCount || 0)
      : getPromptAnswerWordCount(entry);
    const targetWords = requiredWordCount > 0 ? requiredWordCount : Math.max(answerWords, 1);
    const inserted = Boolean(entry.answerInsertedAt);
    const thresholdMet = requiredWordCount > 0 ? answerWords >= requiredWordCount : answerWords > 0;
    const completed = inserted && thresholdMet;
    const percent = targetWords > 0 ? Math.min(100, Math.round((answerWords / targetWords) * 100)) : 0;

    return {
      completed,
      percent,
      state: completed
        ? 'completed'
        : inserted
          ? 'inserted below target'
          : entry.assignedChapterId
            ? 'assigned to chapter'
            : 'not assigned',
      caption: completed
        ? `Inserted and met the ${targetWords.toLocaleString()} word target.`
        : inserted
          ? `Inserted ${answerWords.toLocaleString()} of ${targetWords.toLocaleString()} required words.`
          : entry.assignedChapterId
            ? `Write ${targetWords.toLocaleString()} words, then insert the answer into the linked chapter.`
            : `Choose a chapter and write ${targetWords.toLocaleString()} words to complete this prompt.`,
    };
  }

  function appendPromptAnswerToChapter(chapter, answerValue) {
    const parsedChapter = window.parseRichTextValue(chapter.content || '');
    const parsedAnswer = window.parseRichTextValue(answerValue || '');
    const textOnly = (() => {
      const temp = document.createElement('div');
      temp.innerHTML = parsedAnswer.html || '';
      return (temp.textContent || temp.innerText || '').trim();
    })();

    if (!textOnly) {
      return false;
    }

    const nextHtml = `${parsedChapter.html || '<p><br></p>'}${parsedAnswer.html || ''}`;
    chapter.content = window.serializeRichTextValue(nextHtml, parsedChapter.settings || {});
    return true;
  }

  function renderBatchProgress(entries) {
    if (!entries.length) {
      progressCard.style.display = 'none';
      return;
    }

    const completedCount = entries.filter((entry) => hasPromptBeenCompleted(entry)).length;
    const percent = Math.round((completedCount / entries.length) * 100);
    const completed = completedCount === entries.length;

    progressCard.style.display = 'block';
    progressPercent.textContent = `${percent}%`;
    progressState.textContent = completed ? 'completed' : completedCount ? 'done' : 'not started';
    progressCaption.textContent = `${completedCount} of ${entries.length} prompts completed`;
    progressFill.style.width = `${percent}%`;
    progressFill.classList.toggle('is-complete', completed);
    progressIcon.classList.toggle('is-complete', completed);
    progressIcon.textContent = completed ? 'OK' : '...';
  }

  const promptViewState = { tab: 'active' };

  function excerptAnswer(value) {
    const temp = document.createElement('div');
    temp.innerHTML = window.parseRichTextValue(value || '').html || '';
    const text = (temp.textContent || temp.innerText || '').trim().replace(/\s+/g, ' ');
    return text.length > 220 ? `${text.slice(0, 217)}...` : text;
  }

  function renderHistoryCards(entries) {
    progressCard.style.display = 'none';
    if (!entries.length) {
      resultsGrid.innerHTML = '<p class="prompt-empty-state">No completed prompts yet. Finish a prompt on the Active tab to build your history.</p>';
      return;
    }

    const reversed = [...entries].reverse();
    resultsGrid.innerHTML = reversed.map((entry) => {
      const dateLabel = entry.answerInsertedAt
        ? new Date(entry.answerInsertedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : '';
      const wordCount = window.computeWordCount(entry.answer || '');
      const excerpt = excerptAnswer(entry.answer);
      return `
        <article class="prompt-history-card">
          <div class="prompt-history-head">
            <div class="prompt-history-meta">
              <span class="genre-pill">${entry.genre || ''}</span>
              <strong class="prompt-history-title">${entry.plotPoint || ''}</strong>
            </div>
            <span class="prompt-history-date">${dateLabel}</span>
          </div>
          <p class="prompt-callout">${entry.prompt || ''}</p>
          ${excerpt ? `
            <p class="prompt-history-excerpt">
              ${excerpt}
              <span class="prompt-history-word-count">${wordCount.toLocaleString()} words</span>
            </p>
          ` : ''}
        </article>
      `;
    }).join('');
  }

  function renderCurrentTab() {
    const history = getDailyHistory();
    const activeEntries = history.filter((entry) => !entry.answerInsertedAt);
    const completedEntries = history.filter((entry) => entry.answerInsertedAt);

    const activeCountEl = document.getElementById('prompt-tab-active-count');
    const historyCountEl = document.getElementById('prompt-tab-history-count');
    if (activeCountEl) activeCountEl.textContent = activeEntries.length ? `(${activeEntries.length})` : '';
    if (historyCountEl) historyCountEl.textContent = completedEntries.length ? `(${completedEntries.length})` : '';

    document.querySelectorAll('[data-prompt-tab]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.promptTab === promptViewState.tab);
    });

    if (promptViewState.tab === 'history') {
      renderHistoryCards(completedEntries);
      return;
    }

    if (activeEntries.length) {
      renderPromptCards(activeEntries);
    } else {
      progressCard.style.display = 'none';
      resultsGrid.innerHTML = '<p class="prompt-empty-state">No active prompts. Generate some above to get started.</p>';
    }
  }

  function getSectionDescription(entry) {
    const plotSections = activeProject.plotSections || [];
    const normalize = window.normalizeGenreKey || ((s) => s.toLowerCase().trim());
    const matched = entry?.plotPoint
      ? plotSections.find((s) => normalize(s.label) === normalize(entry.plotPoint))
      : null;
    return matched?.description ? String(matched.description).trim() : '';
  }

  function renderPromptCards(entries) {
    resultsGrid.innerHTML = entries.length
      ? entries.map((entry, index) => {
        const sectionDesc = getSectionDescription(entry);
        return `
        <article class="beat-card daily-prompt-card ui-card ui-card-soft ui-card-stack">
          <h4>${index + 1}. ${entry.plotPoint}${sectionDesc ? `: <span class="prompt-section-desc">${sectionDesc}</span>` : ''}</h4>
          <p class="genre-pill">${entry.genre}</p>
          <p class="prompt-callout">${entry.prompt}</p>
          <p>${entry.context || 'Use this anywhere in the draft.'}</p>
          <p class="daily-prompt-status">Target: ${(Number(entry.requiredWordCount || extractPromptWordTarget(entry.prompt)) || 0).toLocaleString()} words</p>
          <div class="daily-prompt-answer">
            <label for="prompt-answer-${entry.id}">Your Answer</label>
            <textarea id="prompt-answer-${entry.id}" data-prompt-answer="${entry.id}" rows="5">${entry.answer || ''}</textarea>
          </div>
          <div class="daily-prompt-actions">
            <div class="field">
              <label for="prompt-chapter-${entry.id}">Add To Chapter</label>
              <select id="prompt-chapter-${entry.id}" data-prompt-chapter="${entry.id}">
                <option value="">Choose a chapter</option>
                ${getChapters().map((chapter) => `
                  <option value="${chapter.id}" ${entry.assignedChapterId === chapter.id ? 'selected' : ''}>
                    ${chapter.title || 'Untitled Chapter'}
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="daily-prompt-editor-actions">
              <button class="btn btn-save" type="button" data-save-prompt-answer="${entry.id}">Save Answer</button>
              <button class="btn btn-primary" type="button" data-add-prompt="${entry.id}" ${getChapters().length ? '' : 'disabled'}>
                Insert Into Chapter
              </button>
            </div>
          </div>
          <div class="daily-prompt-progress">
            <div class="goal-progress-track">
              <div class="goal-progress-fill ${buildCompletionSnapshot(entry).completed ? 'is-complete' : ''}" style="width:${buildCompletionSnapshot(entry).percent}%"></div>
            </div>
            <p class="daily-prompt-status">
              ${buildCompletionSnapshot(entry).state}: ${buildCompletionSnapshot(entry).caption}
            </p>
          </div>
        </article>
      `;
      }).join('')
      : '<p>No prompts found for this project yet.</p>';

    window.initializeTextEditor(resultsGrid);
    entries.forEach((entry) => {
      const answerField = resultsGrid.querySelector(`[data-prompt-answer="${entry.id}"]`);
      if (answerField) {
        window.refreshTextEditor(answerField, entry.answer || '');
      }
    });

    renderBatchProgress(entries);

    resultsGrid.querySelectorAll('[data-prompt-chapter]').forEach((input) => {
      input.addEventListener('change', async () => {
        const promptEntry = getDailyHistory().find((entry) => entry.id === input.dataset.promptChapter);
        if (!promptEntry) {
          return;
        }

        promptEntry.assignedChapterId = input.value;
        activeProject = await window.saveProjectData({
          ...activeProject,
          dailyPromptHistory: getDailyHistory(),
          updatedAt: new Date().toISOString(),
        }, {
          dirtyFields: ['dailyPromptHistory'],
        });
        renderCurrentTab();
      });
    });

    resultsGrid.querySelectorAll('[data-add-prompt]').forEach((button) => {
      button.addEventListener('click', async () => {
        const promptEntry = getDailyHistory().find((entry) => entry.id === button.dataset.addPrompt);
        if (!promptEntry?.assignedChapterId) {
          setStatusMessage('Choose a chapter before adding this prompt.', 'error');
          return;
        }

        const chapters = getChapters().map((chapter) => ({ ...chapter }));
        const chapterIndex = chapters.findIndex((chapter) => chapter.id === promptEntry.assignedChapterId);
        if (chapterIndex < 0) {
          setStatusMessage('That chapter could not be found.', 'error');
          return;
        }

        const answerField = resultsGrid.querySelector(`[data-prompt-answer="${promptEntry.id}"]`);
        promptEntry.answer = window.getEditorFieldValue(answerField);
        const requiredWordCount = Number(promptEntry.requiredWordCount || extractPromptWordTarget(promptEntry.prompt));
        const answerWordCount = window.computeWordCount(promptEntry.answer);

        if (!answerWordCount || (requiredWordCount > 0 && answerWordCount < requiredWordCount)) {
          setStatusMessage(
            requiredWordCount > 0
              ? `Write an answer before inserting it into a chapter. ${requiredWordCount.toLocaleString()} words are required.`
              : 'Write an answer before inserting it into a chapter.',
            'error',
          );
          return;
        }

        const inserted = appendPromptAnswerToChapter(chapters[chapterIndex], promptEntry.answer);
        if (!inserted) {
          setStatusMessage('Write an answer before inserting it into a chapter.', 'error');
          return;
        }

        const insertedWordCount = window.computeWordCount(promptEntry.answer);
        const nextHistory = getDailyHistory().map((entry) => (
          entry.id === promptEntry.id
            ? {
              ...entry,
              assignedChapterId: promptEntry.assignedChapterId,
              answer: promptEntry.answer,
              requiredWordCount: Number(entry.requiredWordCount || extractPromptWordTarget(entry.prompt)),
              insertedWordCount,
              answerInsertedAt: new Date().toISOString(),
            }
            : entry
        ));

        activeProject = await window.saveProjectData({
          ...activeProject,
          chapters,
          dailyPromptHistory: nextHistory,
          currentWordCount: chapters.reduce(
            (sum, chapter) => sum + window.computeWordCount(chapter.content || ''),
            0,
          ),
          updatedAt: new Date().toISOString(),
        }, {
          dirtyFields: ['chapters', 'dailyPromptHistory', 'currentWordCount'],
        });

        if (
          promptEntry.source === 'community'
          && promptEntry.sourcePromptId
          && promptEntry.sourceAuthorId
          && promptEntry.sourceAuthorId !== currentUserId
        ) {
          await window.api.community.recordPromptCompletion({
            promptId: promptEntry.sourcePromptId,
            authorId: promptEntry.sourceAuthorId,
            projectTitle: activeProject.title || 'Untitled Project',
            chapterTitle: chapters[chapterIndex]?.title || 'Untitled Chapter',
            wordCount: insertedWordCount,
          }).catch(() => {});
        }

        const isComplete = insertedWordCount >= requiredWordCount;
        setStatusMessage(
          isComplete
            ? 'Prompt inserted and complete! Taking you to the chapter...'
            : `Prompt answer inserted, but it is still below the ${requiredWordCount.toLocaleString()} word target. Taking you to the chapter...`,
        );
        renderCurrentTab();

        setTimeout(() => {
          window.navigate('chapters', { chapterId: promptEntry.assignedChapterId });
        }, 900);
      });
    });

    resultsGrid.querySelectorAll('[data-save-prompt-answer]').forEach((button) => {
      button.addEventListener('click', async () => {
        const promptEntry = getDailyHistory().find((entry) => entry.id === button.dataset.savePromptAnswer);
        const answerField = resultsGrid.querySelector(`[data-prompt-answer="${button.dataset.savePromptAnswer}"]`);
        if (!promptEntry || !answerField) {
          return;
        }

        promptEntry.answer = window.getEditorFieldValue(answerField);
        promptEntry.requiredWordCount = Number(promptEntry.requiredWordCount || extractPromptWordTarget(promptEntry.prompt));
        activeProject = await window.saveProjectData({
          ...activeProject,
          dailyPromptHistory: getDailyHistory(),
          updatedAt: new Date().toISOString(),
        }, {
          dirtyFields: ['dailyPromptHistory'],
        });
        setStatusMessage('Prompt answer saved.');
        renderCurrentTab();
      });
    });
  }

  function generatePromptBatch() {
    const count = Number(countInput.value || 1);
    const mode = modeInput.value;

    let batch = [];
    if (mode === 'sequential') {
      const source = resources.sequentialSource.length ? resources.sequentialSource : resources.promptPool;
      batch = Array.from(
        { length: count },
        (_, offset) => source[(dailyState.cursor + offset) % source.length],
      ).filter(Boolean);
      dailyState.cursor += count;
    } else {
      batch = weightedPick(resources.promptPool, count, activeProject);
    }

    return batch.map((entry, index) => ({
      id: `daily-prompt-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      ...entry,
      context: getContextLabel(index, entry),
      assignedChapterId: '',
      answer: '',
      answerInsertedAt: '',
      requiredWordCount: extractPromptWordTarget(entry.prompt),
      insertedWordCount: 0,
    }));
  }

  generateButton.addEventListener('click', async () => {
    const today = new Date();
    const prompts = generatePromptBatch();
    const completedHistory = getDailyHistory().filter((entry) => entry.answerInsertedAt);
    const nextHistory = [...completedHistory, ...prompts];

    promptViewState.tab = 'active';

    const updatedProject = {
      ...activeProject,
      dailyPromptState: {
        cursor: dailyState.cursor,
        lastMode: modeInput.value,
        lastCount: Number(countInput.value || 1),
        lastGeneratedAt: today.toISOString(),
      },
      dailyPromptHistory: nextHistory,
      updatedAt: today.toISOString(),
    };

    activeProject = await window.saveProjectData(updatedProject, {
      dirtyFields: ['dailyPromptState', 'dailyPromptHistory'],
    });

    renderCurrentTab();
    setStatusMessage(`${prompts.length} prompt${prompts.length === 1 ? '' : 's'} ready.`);
  });

  document.querySelectorAll('[data-prompt-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      promptViewState.tab = btn.dataset.promptTab;
      renderCurrentTab();
    });
  });

  renderCurrentTab();
});
