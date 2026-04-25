(function () {
  const banner = document.getElementById('update-banner');
  const bannerText = document.getElementById('update-banner-text');
  const bannerIcon = document.getElementById('update-banner-icon');
  const installBtn = document.getElementById('update-install-btn');
  const dismissBtn = document.getElementById('update-dismiss-btn');

  function showBanner() {
    banner.style.display = 'flex';
    requestAnimationFrame(() => {
      banner.style.transform = 'translateY(0)';
    });
  }

  function hideBanner() {
    banner.style.transform = 'translateY(100%)';
    setTimeout(() => { banner.style.display = 'none'; }, 300);
  }

  if (!window.api?.updater) return;

  window.api.updater.onUpdateAvailable((data) => {
    bannerIcon.textContent = '⬇';
    bannerText.textContent = `Update v${data.version} downloading...`;
    installBtn.style.display = 'none';
    showBanner();
  });

  window.api.updater.onUpdateProgress((data) => {
    bannerText.textContent = `Downloading update... ${data.percent}%`;
  });

  window.api.updater.onUpdateReady((data) => {
    bannerIcon.textContent = '✓';
    bannerText.textContent = `v${data.version} ready to install`;
    installBtn.style.display = 'inline-block';
    showBanner();
  });

  installBtn.addEventListener('click', () => {
    bannerText.textContent = 'Restarting...';
    installBtn.style.display = 'none';
    window.api.updater.installNow();
  });

  dismissBtn.addEventListener('click', () => {
    window.api.updater.dismiss();
    hideBanner();
  });
})();

(function () {
  const overlay = document.getElementById('whats-new-overlay');
  const headline = document.getElementById('whats-new-headline');
  const featureList = document.getElementById('whats-new-features');
  const dismissBtn = document.getElementById('whats-new-dismiss');

  function showWhatsNew(version) {
    const entry = window.CHANGELOG?.[version];
    if (!entry) return;

    headline.textContent = entry.headline;
    featureList.innerHTML = entry.features
      .map((f) => `<li>${f}</li>`)
      .join('');

    overlay.style.display = 'flex';
  }

  dismissBtn.addEventListener('click', () => {
    overlay.style.display = 'none';
  });

  if (window.api?.onNewVersion) {
    window.api.onNewVersion((data) => {
      showWhatsNew(data.version);
    });
  }
})();
