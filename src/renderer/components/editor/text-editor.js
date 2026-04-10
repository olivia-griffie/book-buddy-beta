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

window.parseRichTextValue = parseRichTextValue;
window.serializeRichTextValue = serializeRichTextValue;

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

window.initializeTextEditor = function initializeTextEditor(root = document) {
  const textareas = [...root.querySelectorAll('textarea')];

  textareas.forEach((textarea) => {
    if (textarea.dataset.richTextInitialized === 'true') {
      return;
    }

    textarea.dataset.richTextInitialized = 'true';
    textarea.classList.add('rich-text-source');

    const { html, settings } = parseRichTextValue(textarea.value);
    const toolbar = document.createElement('div');
    toolbar.className = 'rich-text-toolbar';
    toolbar.innerHTML = `
      <div class="rich-text-toolbar-main">
        <button type="button" class="rich-text-btn" data-command="bold" title="Bold"><strong>B</strong></button>
        <button type="button" class="rich-text-btn" data-command="italic" title="Italic"><em>I</em></button>
        <button type="button" class="rich-text-btn" data-command="underline" title="Underline"><u>U</u></button>
        <button type="button" class="rich-text-btn rich-text-btn-toggle" data-toggle-advanced="true" aria-expanded="false" title="More formatting">...</button>
      </div>
      <div class="rich-text-toolbar-advanced">
        <button type="button" class="rich-text-btn" data-command="justifyLeft" title="Align left">L</button>
        <button type="button" class="rich-text-btn" data-command="justifyCenter" title="Center">C</button>
        <button type="button" class="rich-text-btn" data-command="justifyRight" title="Align right">R</button>
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

    const wrapper = document.createElement('div');
    wrapper.className = 'rich-text-editor';
    wrapper.append(toolbar, editor);
    textarea.insertAdjacentElement('afterend', wrapper);
    textarea.hidden = true;

    const state = {
      fontFamily: settings.fontFamily || "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      fontSize: settings.fontSize || '16',
      lineHeight: settings.lineHeight || '1.6',
      textAlign: settings.textAlign || '',
    };

    const familySelect = toolbar.querySelector('[data-setting="fontFamily"]');
    const sizeSelect = toolbar.querySelector('[data-setting="fontSize"]');
    const lineHeightSelect = toolbar.querySelector('[data-setting="lineHeight"]');

    function applyState() {
      editor.style.fontFamily = state.fontFamily;
      editor.style.fontSize = `${state.fontSize}px`;
      editor.style.lineHeight = state.lineHeight;
      editor.style.textAlign = state.textAlign;
      familySelect.value = state.fontFamily;
      sizeSelect.value = state.fontSize;
      lineHeightSelect.value = state.lineHeight;
    }

    function syncTextarea(shouldDispatch = false) {
      textarea.value = serializeRichTextValue(editor.innerHTML, state);
      if (shouldDispatch) {
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    toolbar.querySelectorAll('[data-command]').forEach((button) => {
      button.addEventListener('click', () => {
        editor.focus();
        document.execCommand(button.dataset.command, false);
        syncTextarea(true);
      });
    });

    toolbar.querySelectorAll('[data-setting]').forEach((input) => {
      input.addEventListener('change', () => {
        state[input.dataset.setting] = input.value;
        applyState();
        syncTextarea(true);
      });
    });

    const advancedToggle = toolbar.querySelector('[data-toggle-advanced]');
    advancedToggle?.addEventListener('click', () => {
      const expanded = toolbar.classList.toggle('is-expanded');
      advancedToggle.setAttribute('aria-expanded', String(expanded));
    });

    editor.addEventListener('input', () => syncTextarea(true));
    editor.addEventListener('blur', () => syncTextarea(false));

    applyState();
    syncTextarea(false);

    textarea._richText = {
      editor,
      setValue(nextValue) {
        const parsed = parseRichTextValue(nextValue);
        editor.innerHTML = parsed.html || '<p><br></p>';
        state.fontFamily = parsed.settings.fontFamily || state.fontFamily;
        state.fontSize = parsed.settings.fontSize || state.fontSize;
        state.lineHeight = parsed.settings.lineHeight || state.lineHeight;
        state.textAlign = parsed.settings.textAlign || state.textAlign;
        applyState();
        syncTextarea(false);
      },
      setPreferences(preferences = {}) {
        if (preferences.fontFamily) state.fontFamily = preferences.fontFamily;
        if (preferences.fontSize) state.fontSize = String(preferences.fontSize);
        if (preferences.lineHeight) state.lineHeight = String(preferences.lineHeight);
        if (preferences.textAlign !== undefined) state.textAlign = preferences.textAlign;
        applyState();
        syncTextarea(false);
      },
      getState() {
        return { ...state };
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
