window.registerPageInit('account', async function () {
  const AVATAR_COUNT = 12;
  const BORDER_COLORS = ['#C97B6E', '#7EB5A6', '#8B7BB5', '#D4A96A', '#6A9FD4', '#C96E9A', '#7EB57E', '#D4C96A', '#6ABDD4', '#C9896E'];
  let selectedAvatar = 1;
  let selectedColor = BORDER_COLORS[0];

  function setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? 'Please wait…' : btn.dataset.label;
  }

  const saveBtn = document.getElementById('profile-save-btn');
  if (saveBtn) saveBtn.dataset.label = saveBtn.textContent;

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

  // Load session info
  try {
    const session = await window.api.auth.getSession();
    const user = session?.user ?? session;
    const meta = user?.user_metadata || {};
    document.getElementById('account-display-name').textContent = meta.username || user?.email || 'Your Account';
    document.getElementById('account-username').textContent = meta.username || '—';
    document.getElementById('account-email').textContent = user?.email || '—';
  } catch {}

  // Load profile
  try {
    const profile = await window.api.profile.get();
    if (profile) {
      document.getElementById('profile-display-name').value = profile.display_name || '';
      document.getElementById('profile-bio').value = profile.bio || '';
      if (profile.avatar_index) selectedAvatar = Number(profile.avatar_index);
      if (profile.avatar_color) selectedColor = profile.avatar_color;
    }
  } catch {}

  renderAvatarPicker();
  renderColorPicker();

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
