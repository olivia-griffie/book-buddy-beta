window.registerPageInit('sharing', async function () {
  const list = document.getElementById('sharing-list');
  const empty = document.getElementById('sharing-empty');

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const projects = await window.api.getAllProjects().catch(() => []);

  if (!projects.length) {
    empty.style.display = 'block';
    return;
  }

  list.innerHTML = projects.map((p) => `
    <div class="sharing-row ui-card ui-card-stack">
      <div class="ui-card-head">
        <div class="ui-card-copy">
          <p class="ui-card-kicker">${escapeHtml((p.genres || []).join(' x ') || 'No genre')}</p>
          <h2 class="ui-card-title">${escapeHtml(p.title || 'Untitled')}</h2>
        </div>
        <span class="sharing-badge ${p.isPublic ? 'is-public' : 'is-private'}">
          ${p.isPublic ? 'Public' : 'Private'}
        </span>
      </div>
    </div>
  `).join('');
});
