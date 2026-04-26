/**
 * Inkbug — Shared Tag Manager Component
 * src/renderer/components/shared/tag-manager.js
 */

const TAG_SUGGESTIONS = {
  'Tone & Mood': [
    'dark',
    'cozy',
    'literary',
    'fast-paced',
    'slow burn',
    'angsty',
    'hopeful',
    'bittersweet',
    'lighthearted',
    'heavy themes',
    'found family vibes',
    'emotional',
    'introspective',
  ],
  'Audience': [
    'adult',
    'new adult',
    'young adult',
    'middle grade',
    'all ages',
    'mature themes',
    'clean',
  ],
  'Content Notes': [
    'grief',
    'mental health',
    'violence',
    'war',
    'abuse',
    'addiction',
    'trauma',
    'death',
    'found family',
  ],
  'Fandom': [
    'fanfiction',
    'original fiction',
    'inspired by',
    'crossover',
    'AU',
    'canon divergence',
    'fix-it fic',
    'modern AU',
    'coffee shop AU',
    'high school AU',
  ],
  'Tropes': [
    'enemies to lovers',
    'slow burn',
    'found family',
    'forced proximity',
    'second chance',
    'fake dating',
    'forbidden love',
    'chosen one',
    'redemption arc',
    'unreliable narrator',
    'love triangle',
    'rivals to lovers',
    'hurt/comfort',
    'friends to lovers',
    'soulmates',
    'one bed',
    'grumpy/sunshine',
    'age gap',
    'secret identity',
    'amnesia',
  ],
};

const ALL_SUGGESTIONS = Object.values(TAG_SUGGESTIONS).flat();

window.createTagManager = function createTagManager(options = {}) {
  const {
    container,
    initialTags = [],
    onChange = () => {},
    suggestions = true,
    maxTags = 20,
    label = 'Tags',
    hint = 'Type a tag and press Enter, or pick from suggestions below.',
    placeholder = 'e.g. enemies to lovers, fanfiction…',
  } = options;

  if (!container) {
    console.warn('createTagManager: no container provided');
    return null;
  }

  let tags = [...initialTags];
  let activeSuggestionCategory = Object.keys(TAG_SUGGESTIONS)[0];

  container.innerHTML = `
    <div class="tm-root">
      <div class="tm-header">
        <div class="tm-label-group">
          ${label ? `<label class="tm-label">${label}</label>` : ''}
          <p class="tm-hint">${hint}</p>
        </div>
        <span class="tm-count">0 tags</span>
      </div>

      <div class="tm-input-row">
        <div class="tm-input-wrap">
          <input
            class="tm-input"
            type="text"
            placeholder="${placeholder}"
            maxlength="50"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
          />
          <div class="tm-autocomplete" style="display:none;"></div>
        </div>
        <button type="button" class="btn btn-ghost tm-add-btn">Add</button>
      </div>

      <div class="tm-chips-wrap">
        <div class="tm-chips" aria-label="Active tags"></div>
        <p class="tm-chips-empty">No tags yet.</p>
      </div>

      ${suggestions ? `
        <div class="tm-suggestions-panel">
          <div class="tm-suggestions-categories"></div>
          <p class="tm-suggestions-label">Suggestions</p>
          <div class="tm-suggestions-list"></div>
        </div>
      ` : ''}
    </div>
  `;

  const root         = container.querySelector('.tm-root');
  const input        = container.querySelector('.tm-input');
  const addBtn       = container.querySelector('.tm-add-btn');
  const chipsWrap    = container.querySelector('.tm-chips');
  const chipsEmpty   = container.querySelector('.tm-chips-empty');
  const countBadge   = container.querySelector('.tm-count');
  const autocomplete = container.querySelector('.tm-autocomplete');
  const catTabs      = container.querySelector('.tm-suggestions-categories');
  const suggList     = container.querySelector('.tm-suggestions-list');

  function normalize(raw) {
    return String(raw || '').toLowerCase().replace(/[^\w\s\-\/]/g, '').trim();
  }

  function updateCount() {
    if (!countBadge) return;
    const n = tags.length;
    countBadge.textContent = n === 0 ? 'No tags' : `${n} tag${n === 1 ? '' : 's'}`;
    countBadge.classList.toggle('tm-count-limit', n >= maxTags);
  }

  function fireChange() {
    onChange([...tags]);
    updateCount();
  }

  function renderChips() {
    if (!chipsWrap) return;
    chipsEmpty.style.display = tags.length ? 'none' : 'block';
    chipsWrap.innerHTML = tags.map((tag) => `
      <span class="tm-chip" data-tag="${tag}">
        <span class="tm-chip-text">${tag}</span>
        <button
          type="button"
          class="tm-chip-remove"
          data-remove="${tag}"
          aria-label="Remove tag: ${tag}"
        >&times;</button>
      </span>
    `).join('');

    chipsWrap.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        tags = tags.filter((t) => t !== btn.dataset.remove);
        renderChips();
        renderSuggestions();
        fireChange();
      });
    });
  }

  function addTag(raw) {
    const value = normalize(raw);
    if (!value) return false;
    if (tags.length >= maxTags) {
      input.placeholder = `Max ${maxTags} tags reached`;
      return false;
    }
    if (tags.map(normalize).includes(value)) {
      const existing = chipsWrap.querySelector(`[data-tag="${value}"]`);
      if (existing) {
        existing.classList.add('tm-chip-flash');
        setTimeout(() => existing.classList.remove('tm-chip-flash'), 600);
      }
      input.value = '';
      return false;
    }
    tags = [...tags, value];
    input.value = '';
    autocomplete.style.display = 'none';
    renderChips();
    renderSuggestions();
    fireChange();
    return true;
  }

  function renderAutocomplete(query) {
    if (!autocomplete) return;
    if (!query || query.length < 2) {
      autocomplete.style.display = 'none';
      return;
    }

    const activeTags = new Set(tags.map(normalize));
    const matches = ALL_SUGGESTIONS
      .filter((s) => s.includes(query) && !activeTags.has(normalize(s)))
      .slice(0, 6);

    if (!matches.length) {
      autocomplete.style.display = 'none';
      return;
    }

    autocomplete.innerHTML = matches.map((m) => {
      const idx = m.indexOf(query);
      const highlighted = idx >= 0
        ? `${m.slice(0, idx)}<strong>${m.slice(idx, idx + query.length)}</strong>${m.slice(idx + query.length)}`
        : m;
      return `<button type="button" class="tm-ac-item" data-ac="${m}">${highlighted}</button>`;
    }).join('');

    autocomplete.style.display = 'block';
    autocomplete.querySelectorAll('[data-ac]').forEach((btn) => {
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        addTag(btn.dataset.ac);
        autocomplete.style.display = 'none';
      });
    });
  }

  function renderSuggestionCategories() {
    if (!catTabs) return;
    catTabs.innerHTML = Object.keys(TAG_SUGGESTIONS).map((cat) => `
      <button
        type="button"
        class="tm-cat-tab ${cat === activeSuggestionCategory ? 'is-active' : ''}"
        data-cat="${cat}"
      >${cat}</button>
    `).join('');

    catTabs.querySelectorAll('[data-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeSuggestionCategory = btn.dataset.cat;
        renderSuggestionCategories();
        renderSuggestions();
      });
    });
  }

  function renderSuggestions() {
    if (!suggList) return;
    const activeTags = new Set(tags.map(normalize));
    const list = TAG_SUGGESTIONS[activeSuggestionCategory] || [];

    suggList.innerHTML = list.map((tag) => {
      const active = activeTags.has(normalize(tag));
      return `
        <button
          type="button"
          class="tm-sugg-chip ${active ? 'is-active' : ''}"
          data-sugg="${tag}"
          ${active ? 'aria-pressed="true"' : 'aria-pressed="false"'}
        >${tag}${active ? ' <span class="tm-sugg-check">✓</span>' : ''}</button>
      `;
    }).join('');

    suggList.querySelectorAll('[data-sugg]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.sugg;
        if (tags.map(normalize).includes(normalize(tag))) {
          tags = tags.filter((t) => normalize(t) !== normalize(tag));
          renderChips();
        } else {
          addTag(tag);
          return;
        }
        renderSuggestions();
        fireChange();
      });
    });
  }

  input.addEventListener('input', () => {
    renderAutocomplete(input.value.toLowerCase().trim());
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input.value);
    }
    if (e.key === 'Escape') {
      autocomplete.style.display = 'none';
    }
  });

  input.addEventListener('blur', () => {
    setTimeout(() => { autocomplete.style.display = 'none'; }, 150);
  });

  addBtn.addEventListener('click', () => addTag(input.value));

  renderChips();
  updateCount();

  if (suggestions) {
    renderSuggestionCategories();
    renderSuggestions();
  }

  return {
    getTags: () => [...tags],
    setTags: (nextTags) => {
      tags = [...(nextTags || [])];
      renderChips();
      if (suggestions) renderSuggestions();
      updateCount();
    },
    destroy: () => {
      container.innerHTML = '';
    },
  };
};
