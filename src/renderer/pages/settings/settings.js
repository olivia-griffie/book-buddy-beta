window.registerPageInit('settings', function () {
  const darkToggle = document.getElementById('toggle-dark-mode');
  const tabletToggle = document.getElementById('toggle-tablet-mode');

  function syncDarkToggle() {
    const on = window.isDarkMode?.() ?? false;
    darkToggle?.setAttribute('aria-checked', String(on));
  }

  function syncTabletToggle() {
    const on = window.isTabletMode?.() ?? false;
    tabletToggle?.setAttribute('aria-checked', String(on));
  }

  syncDarkToggle();
  syncTabletToggle();

  darkToggle?.addEventListener('click', () => {
    window.toggleDarkMode?.();
    syncDarkToggle();
  });

  tabletToggle?.addEventListener('click', () => {
    window.toggleTabletMode?.();
    syncTabletToggle();
  });

  document.getElementById('sign-out-btn')?.addEventListener('click', async () => {
    await window.authLogout?.();
  });
});
