function escapeEditorHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function plainTextToEditorHtml(value = '') {
  const normalized = String(value || '').replace(/\r\n/g, '\n');
  if (!normalized.trim()) {
    return '<p><br></p>';
  }

  return normalized
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeEditorHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function parseRichTextValue(value = '') {
  const raw = String(value || '');
  const container = document.createElement('div');
  container.innerHTML = raw;
  const root = container.firstElementChild;

  if (root?.matches('[data-editor-root="true"]')) {
    return {
      html: root.innerHTML || '<p><br></p>',
      settings: {
        fontFamily: root.dataset.fontFamily || '',
        fontSize: root.dataset.fontSize || '',
        lineHeight: root.dataset.lineHeight || '',
        textAlign: root.dataset.textAlign || '',
      },
    };
  }

  if (/<[a-z][\s\S]*>/i.test(raw)) {
    return {
      html: raw,
      settings: {},
    };
  }

  return {
    html: plainTextToEditorHtml(raw),
    settings: {},
  };
}

function serializeRichTextValue(html = '', settings = {}) {
  const wrapper = document.createElement('div');
  wrapper.dataset.editorRoot = 'true';
  wrapper.dataset.fontFamily = settings.fontFamily || '';
  wrapper.dataset.fontSize = settings.fontSize || '';
  wrapper.dataset.lineHeight = settings.lineHeight || '';
  wrapper.dataset.textAlign = settings.textAlign || '';
  wrapper.innerHTML = html || '<p><br></p>';
  return wrapper.outerHTML;
}

function buildAlignmentIcon(kind) {
  const paths = {
    left: `
      <line x1="3" y1="5" x2="17" y2="5"></line>
      <line x1="3" y1="10" x2="14" y2="10"></line>
      <line x1="3" y1="15" x2="17" y2="15"></line>
      <line x1="3" y1="20" x2="12" y2="20"></line>
    `,
    center: `
      <line x1="4" y1="5" x2="16" y2="5"></line>
      <line x1="6" y1="10" x2="14" y2="10"></line>
      <line x1="4" y1="15" x2="16" y2="15"></line>
      <line x1="6" y1="20" x2="14" y2="20"></line>
    `,
    right: `
      <line x1="5" y1="5" x2="17" y2="5"></line>
      <line x1="8" y1="10" x2="17" y2="10"></line>
      <line x1="5" y1="15" x2="17" y2="15"></line>
      <line x1="10" y1="20" x2="17" y2="20"></line>
    `,
  };

  return `
    <svg class="rich-text-btn-icon" viewBox="0 0 20 24" aria-hidden="true" focusable="false">
      ${paths[kind] || paths.left}
    </svg>
  `;
}

window.parseRichTextValue = parseRichTextValue;
window.serializeRichTextValue = serializeRichTextValue;
window.renderRichText = function renderRichText(container, rawValue, options = {}) {
  if (!container) {
    return {
      hasContent: false,
      settings: {},
      html: '',
    };
  }

  const parsed = parseRichTextValue(rawValue || '');
  const temp = document.createElement('div');
  temp.innerHTML = parsed.html || '';
  const hasContent = (temp.textContent || temp.innerText || '').trim().length > 0;

  container.classList.add('rich-text-rendered');

  if (!hasContent) {
    container.innerHTML = options.emptyHtml || '<p><br></p>';
  } else {
    container.innerHTML = parsed.html || '<p><br></p>';
  }

  const settings = parsed.settings || {};
  container.style.fontFamily = settings.fontFamily || '';
  container.style.fontSize = settings.fontSize ? `${settings.fontSize}px` : '';
  container.style.lineHeight = settings.lineHeight || '';
  container.style.textAlign = settings.textAlign || '';

  return {
    hasContent,
    settings,
    html: parsed.html || '',
  };
};

window.getEditorFieldValue = function getEditorFieldValue(field) {
  if (!field?._richText) {
    return field?.value ?? '';
  }

  const parsed = parseRichTextValue(field.value);
  const temp = document.createElement('div');
  temp.innerHTML = parsed.html || '';
  const plainText = (temp.textContent || temp.innerText || '').trim();
  return plainText ? field.value : '';
};

function sanitizeClipboardHtml(html) {
  const allowed = new Set(['strong', 'b', 'em', 'i', 'u', 'p', 'br', 'ul', 'ol', 'li']);
  const temp = document.createElement('div');
  temp.innerHTML = html;
  const root = temp.querySelector('body') || temp;

  function clean(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();
    [...node.childNodes].forEach(clean);
    if (!allowed.has(tag)) {
      const parent = node.parentNode;
      while (node.firstChild) parent.insertBefore(node.firstChild, node);
      parent.removeChild(node);
    } else {
      while (node.attributes.length > 0) node.removeAttribute(node.attributes[0].name);
    }
  }

  [...root.childNodes].forEach(clean);
  return root.innerHTML;
}

window.initializeTextEditor = function initializeTextEditor(root = document) {
  const textareas = [...root.querySelectorAll('textarea')];

  textareas.forEach((textarea) => {
    if (textarea.dataset.richTextInitialized === 'true') {
      return;
    }

    textarea.dataset.richTextInitialized = 'true';
    textarea.classList.add('rich-text-source');
    const editorMode = textarea.dataset.editorMode || 'simple';
    const showAdvancedToggle = editorMode !== 'minimal';
    const startExpanded = editorMode === 'full';

    const { html, settings } = parseRichTextValue(textarea.value);
    const resolvedPreferences = typeof window.resolveEditorPreferences === 'function'
      ? window.resolveEditorPreferences(window.getCurrentProject?.())
      : {
        fontFamily: 'serif',
        fontSize: 18,
        lineHeight: 1.7,
        saveMode: 'autosave',
      };
    const experienceState = {
      fontFamily: resolvedPreferences.fontFamily === 'sans'
        ? "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
        : "Georgia, 'Times New Roman', serif",
      fontSize: String(resolvedPreferences.fontSize || 18),
      lineHeight: String(resolvedPreferences.lineHeight || 1.7),
    };
    const toolbar = document.createElement('div');
    toolbar.className = `rich-text-toolbar is-${editorMode}`;
    toolbar.innerHTML = `
      <div class="rich-text-toolbar-main">
        <button type="button" class="rich-text-btn" data-command="bold" title="Bold"><strong>B</strong></button>
        <button type="button" class="rich-text-btn" data-command="italic" title="Italic"><em>I</em></button>
        <button type="button" class="rich-text-btn" data-command="underline" title="Underline"><u>U</u></button>
        ${showAdvancedToggle
    ? '<button type="button" class="rich-text-btn rich-text-btn-toggle" data-toggle-advanced="true" aria-expanded="false" title="More formatting">Advanced</button>'
    : ''}
      </div>
      <div class="rich-text-toolbar-advanced">
        <button type="button" class="rich-text-btn" data-command="insertUnorderedList" title="Bullet list">• List</button>
        <button type="button" class="rich-text-btn" data-command="insertOrderedList" title="Numbered list">1. List</button>
        <button type="button" class="rich-text-btn rich-text-icon-btn" data-command="justifyLeft" title="Align left" aria-label="Align left">
          ${buildAlignmentIcon('left')}
        </button>
        <button type="button" class="rich-text-btn rich-text-icon-btn" data-command="justifyCenter" title="Align center" aria-label="Align center">
          ${buildAlignmentIcon('center')}
        </button>
        <button type="button" class="rich-text-btn rich-text-icon-btn" data-command="justifyRight" title="Align right" aria-label="Align right">
          ${buildAlignmentIcon('right')}
        </button>
        <select class="rich-text-select" data-setting="fontFamily" title="Font family">
          <option value="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif">Sans</option>
          <option value="Georgia, 'Times New Roman', serif">Serif</option>
        </select>
        <select class="rich-text-select" data-setting="fontSize" title="Font size">
          <option value="10">10</option>
          <option value="12">12</option>
          <option value="14">14</option>
          <option value="16" selected>16</option>
          <option value="18">18</option>
          <option value="20">20</option>
          <option value="22">22</option>
        </select>
        <select class="rich-text-select" data-setting="lineHeight" title="Line spacing">
          <option value="1.2">1.2</option>
          <option value="1.4">1.4</option>
          <option value="1.6" selected>1.6</option>
          <option value="1.8">1.8</option>
          <option value="2">2.0</option>
        </select>
      </div>
    `;

    const editor = document.createElement('div');
    editor.className = 'rich-text-editor-shell';
    editor.contentEditable = 'true';
    editor.innerHTML = html || '<p><br></p>';

    const collapseBar = document.createElement('button');
    collapseBar.type = 'button';
    collapseBar.className = 'rich-text-collapse-bar';
    collapseBar.dataset.toggleCollapse = 'true';
    collapseBar.setAttribute('aria-expanded', 'true');
    collapseBar.innerHTML = '<span class="rich-text-collapse-label">Editor</span><span class="rich-text-collapse-chevron" aria-hidden="true">▾</span>';

    const wrapper = document.createElement('div');
    wrapper.className = 'rich-text-editor';
    wrapper.append(toolbar, collapseBar, editor);
    textarea.insertAdjacentElement('afterend', wrapper);
    textarea.hidden = true;

    const state = {
      fontFamily: settings.fontFamily || '',
      fontSize: settings.fontSize || '',
      lineHeight: settings.lineHeight || '',
      textAlign: settings.textAlign || '',
    };
    let savedRange = null;

    const familySelect = toolbar.querySelector('[data-setting="fontFamily"]');
    const sizeSelect = toolbar.querySelector('[data-setting="fontSize"]');
    const lineHeightSelect = toolbar.querySelector('[data-setting="lineHeight"]');

    function saveSelection() {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return;
      }

      const range = selection.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        savedRange = range.cloneRange();
      }
    }

    function restoreSelection() {
      if (!savedRange) {
        return;
      }

      const selection = window.getSelection();
      if (!selection) {
        return;
      }

      selection.removeAllRanges();
      selection.addRange(savedRange);
    }

    function applyState() {
      const activeFontFamily = state.fontFamily || experienceState.fontFamily;
      const activeFontSize = state.fontSize || experienceState.fontSize;
      const activeLineHeight = state.lineHeight || experienceState.lineHeight;

      editor.style.fontFamily = activeFontFamily;
      editor.style.fontSize = `${activeFontSize}px`;
      editor.style.lineHeight = activeLineHeight;
      editor.style.textAlign = state.textAlign;
      normalizeEditorContent();
      if (familySelect) familySelect.value = activeFontFamily;
      if (sizeSelect) sizeSelect.value = activeFontSize;
      if (lineHeightSelect) lineHeightSelect.value = activeLineHeight;
    }

    function normalizeEditorContent() {
      editor.querySelectorAll('p, ul, ol, li, div, span').forEach((node) => {
        node.style.color = 'inherit';
        node.style.fontFamily = 'inherit';
        node.style.fontSize = 'inherit';
        node.style.lineHeight = 'inherit';
      });
    }

    function syncTextarea(shouldDispatch = false) {
      textarea.value = serializeRichTextValue(editor.innerHTML, state);
      if (shouldDispatch) {
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    toolbar.querySelectorAll('[data-command]').forEach((button) => {
      button.addEventListener('mousedown', (event) => {
        event.preventDefault();
        saveSelection();
      });
      button.addEventListener('click', () => {
        editor.focus();
        restoreSelection();
        document.execCommand(button.dataset.command, false);
        normalizeEditorContent();
        saveSelection();
        syncTextarea(true);
      });
    });

    toolbar.querySelectorAll('[data-setting]').forEach((input) => {
      input.addEventListener('mousedown', () => {
        saveSelection();
      });
      input.addEventListener('change', () => {
        editor.focus();
        restoreSelection();
        state[input.dataset.setting] = input.value;
        applyState();
        saveSelection();
        syncTextarea(true);
      });
    });

    const advancedToggle = toolbar.querySelector('[data-toggle-advanced]');
    if (startExpanded) {
      toolbar.classList.add('is-expanded');
      advancedToggle?.setAttribute('aria-expanded', 'true');
    }

    advancedToggle?.addEventListener('click', () => {
      const expanded = toolbar.classList.toggle('is-expanded');
      advancedToggle.setAttribute('aria-expanded', String(expanded));
    });

    collapseBar.addEventListener('click', () => {
      const collapsed = wrapper.classList.toggle('is-collapsed');
      collapseBar.setAttribute('aria-expanded', String(!collapsed));
      collapseBar.querySelector('.rich-text-collapse-chevron').textContent = collapsed ? '▸' : '▾';
    });

    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        document.execCommand('insertHTML', false, '\u00a0\u00a0\u00a0\u00a0');
        syncTextarea(true);
      }
    });
    editor.addEventListener('input', () => {
      normalizeEditorContent();
      saveSelection();
      syncTextarea(true);
    });
    editor.addEventListener('blur', () => {
      saveSelection();
      syncTextarea(false);
    });
    editor.addEventListener('mouseup', saveSelection);
    editor.addEventListener('keyup', saveSelection);
    editor.addEventListener('focus', saveSelection);

    editor.addEventListener('paste', (e) => {
      e.preventDefault();
      const clipHtml = e.clipboardData.getData('text/html');
      const clipText = e.clipboardData.getData('text/plain');
      if (!clipText && !clipHtml) return;

      const plain = clipText || '';
      document.execCommand('insertHTML', false, plainTextToEditorHtml(plain));
      syncTextarea(true);

      const hasFormatting = clipHtml && /<(strong|b|em|i|u|ul|ol|li|h[1-6])\b/i.test(clipHtml);
      if (!hasFormatting) return;

      wrapper.querySelector('.paste-format-pill')?.remove();
      const pill = document.createElement('div');
      pill.className = 'paste-format-pill';
      pill.innerHTML = '<button type="button">Paste with formatting</button>';
      wrapper.appendChild(pill);

      let gone = false;
      const dismiss = () => {
        if (gone) return;
        gone = true;
        pill.remove();
      };
      const timer = setTimeout(dismiss, 4000);

      pill.querySelector('button').addEventListener('click', () => {
        clearTimeout(timer);
        dismiss();
        document.execCommand('undo');
        const clean = sanitizeClipboardHtml(clipHtml);
        document.execCommand('insertHTML', false, clean);
        syncTextarea(true);
      });
    });

    applyState();
    syncTextarea(false);

    textarea._richText = {
      editor,
      setValue(nextValue) {
        const parsed = parseRichTextValue(nextValue);
        editor.innerHTML = parsed.html || '<p><br></p>';
        state.fontFamily = parsed.settings.fontFamily || '';
        state.fontSize = parsed.settings.fontSize || '';
        state.lineHeight = parsed.settings.lineHeight || '';
        state.textAlign = parsed.settings.textAlign || state.textAlign;
        applyState();
        normalizeEditorContent();
        syncTextarea(false);
      },
      setPreferences(preferences = {}, options = {}) {
        const persist = options.persist === true;
        if (persist) {
          if (preferences.fontFamily) state.fontFamily = preferences.fontFamily;
          if (preferences.fontSize) state.fontSize = String(preferences.fontSize);
          if (preferences.lineHeight) state.lineHeight = String(preferences.lineHeight);
          if (preferences.textAlign !== undefined) state.textAlign = preferences.textAlign;
        } else {
          if (preferences.fontFamily) experienceState.fontFamily = preferences.fontFamily;
          if (preferences.fontSize) experienceState.fontSize = String(preferences.fontSize);
          if (preferences.lineHeight) experienceState.lineHeight = String(preferences.lineHeight);
        }
        applyState();
        if (persist) {
          syncTextarea(false);
        }
      },
      getState() {
        return {
          ...state,
          experienceState: { ...experienceState },
        };
      },
    };
  });
};

window.refreshTextEditor = function refreshTextEditor(textarea, value) {
  if (!textarea?._richText) {
    return;
  }

  textarea._richText.setValue(value ?? textarea.value);
};
