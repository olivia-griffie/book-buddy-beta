window.registerPageInit('account', async function () {
  const loggedOut = document.getElementById('account-logged-out');
  const loggedIn = document.getElementById('account-logged-in');

  // Tab switching
  document.querySelectorAll('.account-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.account-tab').forEach((t) => t.classList.remove('is-active'));
      document.querySelectorAll('.account-tab-panel').forEach((p) => { p.hidden = true; });
      tab.classList.add('is-active');
      const panel = document.getElementById(`account-tab-${tab.dataset.tab}`);
      if (panel) panel.hidden = false;
    });
  });

  function showError(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message;
    el.hidden = !message;
  }

  function setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? 'Please wait…' : btn.dataset.label;
  }

  ['signin-submit', 'signup-submit', 'profile-save-btn'].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.dataset.label = btn.textContent;
  });

  const AVATAR_COUNT = 12;
  const BORDER_COLORS = ['#C97B6E', '#7EB5A6', '#8B7BB5', '#D4A96A', '#6A9FD4', '#C96E9A', '#7EB57E', '#D4C96A', '#6ABDD4', '#C9896E'];
  let selectedAvatar = 1;
  let selectedColor = BORDER_COLORS[0];

  function renderAvatarPicker() {
    const picker = document.getElementById('avatar-picker');
    if (!picker) return;
    picker.innerHTML = Array.from({ length: AVATAR_COUNT }, (_, i) => {
      const n = i + 1;
      return `
        <button type="button" class="avatar-option ${selectedAvatar === n ? 'is-selected' : ''}"
          data-avatar="${n}"
          style="--avatar-border: ${selectedColor};"
          aria-label="Avatar ${n}" aria-pressed="${selectedAvatar === n}">
          <img src="../../public/avatars/${n}.png" alt="Avatar ${n}" />
        </button>
      `;
    }).join('');

    picker.querySelectorAll('[data-avatar]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedAvatar = Number(btn.dataset.avatar);
        renderAvatarPicker();
      });
    });
  }

  function renderColorPicker() {
    const picker = document.getElementById('avatar-color-picker');
    if (!picker) return;
    picker.innerHTML = BORDER_COLORS.map((color) => `
      <button type="button" class="avatar-color-swatch ${selectedColor === color ? 'is-selected' : ''}"
        data-color="${color}"
        style="background: ${color};"
        aria-label="Border color ${color}" aria-pressed="${selectedColor === color}">
      </button>
    `).join('');

    picker.querySelectorAll('[data-color]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedColor = btn.dataset.color;
        renderColorPicker();
        renderAvatarPicker();
      });
    });
  }

  async function loadProfile() {
    try {
      const profile = await window.api.profile.get();
      if (!profile) return;
      document.getElementById('profile-display-name').value = profile.display_name || '';
      document.getElementById('profile-bio').value = profile.bio || '';
      if (profile.avatar_index) selectedAvatar = Number(profile.avatar_index);
      if (profile.avatar_color) selectedColor = profile.avatar_color;
    } catch {}
    renderAvatarPicker();
    renderColorPicker();
  }

  function showLoggedIn(session) {
    const user = session?.user ?? session;
    const meta = user?.user_metadata || {};
    document.getElementById('account-display-name').textContent = meta.username || user?.email || 'Your Account';
    document.getElementById('account-username').textContent = meta.username || '—';
    document.getElementById('account-email').textContent = user?.email || '—';
    loggedOut.hidden = true;
    loggedIn.hidden = false;
    renderAvatarPicker();
    renderColorPicker();
    loadProfile();
  }

  function showLoggedOut() {
    loggedOut.hidden = false;
    loggedIn.hidden = true;
  }

  // Check existing session
  try {
    const session = await window.api.auth.getSession();
    if (session?.user || session?.access_token) {
      showLoggedIn(session);
    } else {
      showLoggedOut();
    }
  } catch {
    showLoggedOut();
  }

  // Sign In
  document.getElementById('signin-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('signin-error', '');
    setLoading('signin-submit', true);
    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;
    try {
      const session = await window.api.auth.login(email, password);
      showLoggedIn(session);
      window.onLoginSuccess?.();
    } catch (err) {
      showError('signin-error', err.message || 'Sign in failed.');
    } finally {
      setLoading('signin-submit', false);
    }
  });

  // Sign Up
  document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('signup-error', '');
    setLoading('signup-submit', true);
    const email = document.getElementById('signup-email').value.trim();
    const username = document.getElementById('signup-username').value.trim();
    const password = document.getElementById('signup-password').value;
    try {
      const result = await window.api.auth.signup(email, password, username);
      if (result.session) {
        showLoggedIn(result.session);
        window.onLoginSuccess?.();
      } else {
        showError('signup-error', 'Account created! Check your email to confirm, then sign in.');
      }
    } catch (err) {
      showError('signup-error', err.message || 'Sign up failed.');
    } finally {
      setLoading('signup-submit', false);
    }
  });

  // Profile save
  document.getElementById('profile-save-btn')?.addEventListener('click', async () => {
    const msgEl = document.getElementById('profile-save-message');
    setLoading('profile-save-btn', true);
    try {
      await window.api.profile.update({
        display_name: document.getElementById('profile-display-name').value.trim() || null,
        bio: document.getElementById('profile-bio').value.trim() || null,
        avatar_index: selectedAvatar,
        avatar_color: selectedColor,
      });
      msgEl.textContent = 'Profile saved.';
      msgEl.className = 'account-profile-msg is-success';
      msgEl.hidden = false;
      setTimeout(() => { msgEl.hidden = true; }, 3000);
    } catch (err) {
      msgEl.textContent = err.message || 'Save failed.';
      msgEl.className = 'account-profile-msg is-error';
      msgEl.hidden = false;
    } finally {
      setLoading('profile-save-btn', false);
    }
  });

  // Sign Out
  document.getElementById('account-signout')?.addEventListener('click', async () => {
    await window.authLogout?.();
  });
});
