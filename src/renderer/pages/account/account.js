window.registerPageInit('account', async function () {
  const loggedOut = document.getElementById('account-logged-out');
  const loggedIn = document.getElementById('account-logged-in');

  // Tab switching
  document.querySelectorAll('.account-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.account-tab').forEach((t) => t.classList.remove('is-active'));
      document.querySelectorAll('.account-tab-panel').forEach((p) => p.hidden = true);
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

  // Store button labels for reset
  ['signin-submit', 'signup-submit'].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.dataset.label = btn.textContent;
  });

  function showLoggedIn(session) {
    const user = session?.user ?? session;
    const meta = user?.user_metadata || {};
    document.getElementById('account-display-name').textContent = meta.username || user?.email || 'Your Account';
    document.getElementById('account-username').textContent = meta.username || '—';
    document.getElementById('account-email').textContent = user?.email || '—';
    loggedOut.hidden = true;
    loggedIn.hidden = false;
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
      } else {
        showError('signup-error', 'Account created! Check your email to confirm, then sign in.');
      }
    } catch (err) {
      showError('signup-error', err.message || 'Sign up failed.');
    } finally {
      setLoading('signup-submit', false);
    }
  });

  // Sign Out
  document.getElementById('account-signout')?.addEventListener('click', async () => {
    await window.api.auth.logout().catch(() => {});
    showLoggedOut();
  });

  // Sync (stub)
  document.getElementById('account-sync-btn')?.addEventListener('click', () => {
    document.getElementById('account-sync-status').textContent = 'Sync coming soon.';
  });
});
