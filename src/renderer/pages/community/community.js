window.registerPageInit('community', async function () {
  const grid = document.getElementById('community-content');
  const empty = document.getElementById('community-empty');
  const loading = document.getElementById('community-loading');

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  try {
    const projects = await window.api.community.getProjects();
    loading.style.display = 'none';

    const publicProjects = (projects || []).filter((p) => p.is_public && p.published_chapters?.length);

    if (!publicProjects.length) {
      empty.style.display = 'block';
      return;
    }

    grid.innerHTML = publicProjects.map((project) => {
      const content = project.content || {};
      const author = project.profiles?.display_name || project.profiles?.username || 'Unknown Author';
      const chapters = project.published_chapters || [];
      return `
        <article class="community-card ui-card ui-card-stack" data-project-id="${escapeHtml(project.id)}">
          <div class="ui-card-head">
            <div class="ui-card-copy">
              <p class="ui-card-kicker">${escapeHtml(author)}</p>
              <h2 class="ui-card-title">${escapeHtml(content.title || 'Untitled')}</h2>
              ${content.subtitle ? `<p class="community-card-subtitle">${escapeHtml(content.subtitle)}</p>` : ''}
            </div>
          </div>
          <div class="community-card-meta">
            ${(content.genres || []).map((g) => `<span class="community-tag">${escapeHtml(g)}</span>`).join('')}
          </div>
          <div class="community-chapters">
            <p class="community-chapters-label">${chapters.length} published chapter${chapters.length !== 1 ? 's' : ''}</p>
            ${chapters.map((ch) => `
              <button class="community-chapter-btn" type="button"
                data-project-id="${escapeHtml(project.id)}"
                data-chapter-id="${escapeHtml(ch.chapter_id)}"
                data-chapter-title="${escapeHtml(ch.chapter_title || 'Chapter')}">
                ${escapeHtml(ch.chapter_title || 'Chapter')}
              </button>
            `).join('')}
          </div>
        </article>
      `;
    }).join('');

    grid.style.display = 'grid';
  } catch (err) {
    loading.textContent = `Failed to load community stories: ${err?.message || err}`;
  }
});
