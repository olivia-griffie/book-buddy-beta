window.registerPageInit('community', async function () {
  const grid = document.getElementById('community-content');
  const empty = document.getElementById('community-empty');
  const loading = document.getElementById('community-loading');
  const reader = document.getElementById('chapter-reader');

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDateTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      + ' at ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  // ── Reader ──────────────────────────────────────────────────────────────────
  let activeProject = null;
  let activeChapter = null;

  function closeReader() {
    reader.style.display = 'none';
    document.body.style.overflow = '';
  }

  document.getElementById('reader-close')?.addEventListener('click', closeReader);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && reader.style.display !== 'none') closeReader();
  });

  async function loadComments(supabaseProjectId, chapterId) {
    const list = document.getElementById('reader-comments-list');
    list.innerHTML = '<p class="reader-comments-loading">Loading comments…</p>';
    try {
      const comments = await window.api.community.getChapterComments({ supabaseProjectId, chapterId });
      if (!comments?.length) {
        list.innerHTML = '<p class="reader-no-comments">No comments yet — be the first!</p>';
        return;
      }
      list.innerHTML = comments.map((c) => `
        <div class="reader-comment">
          <div class="reader-comment-header">
            <span class="reader-comment-author">${escapeHtml(c.profiles?.display_name || c.profiles?.username || 'Anonymous')}</span>
            <span class="reader-comment-date">${formatDateTime(c.created_at)}</span>
          </div>
          <p class="reader-comment-body">${escapeHtml(c.body)}</p>
        </div>
      `).join('');
    } catch {
      list.innerHTML = '<p class="reader-no-comments">Could not load comments.</p>';
    }
  }

  async function openReader(project, chapter) {
    activeProject = project;
    activeChapter = chapter;

    document.getElementById('reader-project-name').textContent = project.content?.title || 'Untitled';
    document.getElementById('reader-chapter-name').textContent = chapter.chapter_title || 'Chapter';
    document.getElementById('reader-chapter-title').textContent = chapter.chapter_title || 'Chapter';
    document.getElementById('reader-author-name').textContent = project.profiles?.display_name || project.profiles?.username || 'Unknown Author';
    document.getElementById('reader-published-at').textContent = `Published ${formatDate(chapter.published_at)}`;
    document.getElementById('reader-body').innerHTML = chapter.content || '<p><em>No content.</em></p>';
    document.getElementById('reader-comment-input').value = '';

    reader.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    document.getElementById('chapter-reader-scroll') || reader.querySelector('.chapter-reader-scroll')?.scrollTo(0, 0);

    await loadComments(project.id, chapter.chapter_id);
  }

  document.getElementById('reader-comment-submit')?.addEventListener('click', async () => {
    const input = document.getElementById('reader-comment-input');
    const submit = document.getElementById('reader-comment-submit');
    const body = input.value.trim();
    if (!body || !activeProject || !activeChapter) return;

    submit.disabled = true;
    submit.textContent = 'Posting…';
    try {
      await window.api.community.addChapterComment({
        supabaseProjectId: activeProject.id,
        chapterId: activeChapter.chapter_id,
        body,
      });
      input.value = '';
      await loadComments(activeProject.id, activeChapter.chapter_id);
    } catch (err) {
      alert(err.message || 'Could not post comment.');
    } finally {
      submit.disabled = false;
      submit.textContent = 'Post Comment';
    }
  });

  // ── Load projects ───────────────────────────────────────────────────────────
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
      const genres = content.genres || [];

      return `
        <article class="community-card" data-project-id="${escapeHtml(project.id)}">
          <div class="community-card-body">
            <div class="community-author-row">
              <div class="community-author-avatar">${escapeHtml(author.charAt(0).toUpperCase())}</div>
              <span class="community-author-name">${escapeHtml(author)}</span>
            </div>
            <h2 class="community-card-title">${escapeHtml(content.title || 'Untitled')}</h2>
            ${content.subtitle ? `<p class="community-card-subtitle">${escapeHtml(content.subtitle)}</p>` : ''}
            ${genres.length ? `
              <div class="community-tags">
                ${genres.map((g) => `<span class="community-tag">${escapeHtml(g)}</span>`).join('')}
              </div>
            ` : ''}
          </div>
          <div class="community-chapter-list">
            <p class="community-chapter-list-label">
              ${chapters.length} published chapter${chapters.length !== 1 ? 's' : ''}
            </p>
            ${chapters.map((ch) => `
              <button class="community-chapter-row" type="button"
                data-project-id="${escapeHtml(project.id)}"
                data-chapter-id="${escapeHtml(ch.chapter_id)}">
                <span class="community-chapter-row-title">${escapeHtml(ch.chapter_title || 'Chapter')}</span>
                <span class="community-chapter-row-date">${formatDate(ch.published_at)}</span>
              </button>
            `).join('')}
          </div>
        </article>
      `;
    }).join('');

    grid.style.display = 'flex';

    grid.querySelectorAll('.community-chapter-row').forEach((btn) => {
      btn.addEventListener('click', () => {
        const project = publicProjects.find((p) => p.id === btn.dataset.projectId);
        const chapter = project?.published_chapters.find((c) => c.chapter_id === btn.dataset.chapterId);
        if (project && chapter) openReader(project, chapter);
      });
    });

  } catch (err) {
    loading.textContent = `Failed to load community stories: ${err?.message || err}`;
  }
});
