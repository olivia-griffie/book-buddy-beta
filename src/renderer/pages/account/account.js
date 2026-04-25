window.registerPageInit('account', async function () {
  try {
    const session = await window.api.auth.getSession();
    const user = session?.user ?? session;
    const meta = user?.user_metadata || {};
    document.getElementById('account-display-name').textContent = meta.username || user?.email || 'Your Account';
    document.getElementById('account-username').textContent = meta.username || '—';
    document.getElementById('account-email').textContent = user?.email || '—';
  } catch {}

  try {
    const profile = await window.api.profile.get();
    if (profile) {
      document.getElementById('profile-display-name').value = profile.display_name || '';
      document.getElementById('profile-bio').value = profile.bio || '';
    }
  } catch {}

  document.getElementById('profile-save')?.addEventListener('click', async () => {
    const displayName = document.getElementById('profile-display-name').value.trim();
    const bio = document.getElementById('profile-bio').value.trim();
    const statusEl = document.getElementById('profile-save-status');
    const saveBtn = document.getElementById('profile-save');

    saveBtn.disabled = true;
    statusEl.textContent = 'Saving...';

    try {
      await window.api.profile.update({ display_name: displayName, bio });
      statusEl.textContent = 'Saved!';
      setTimeout(() => { statusEl.textContent = ''; }, 2500);
    } catch {
      statusEl.textContent = 'Could not save. Try again.';
    } finally {
      saveBtn.disabled = false;
    }
  });

  document.getElementById('account-signout')?.addEventListener('click', async () => {
    await window.authLogout?.();
  });
});
