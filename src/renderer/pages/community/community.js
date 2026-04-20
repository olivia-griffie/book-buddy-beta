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

  // ── Favorites state ──────────────────────────────────────────────────────
  let favorites = new Set(await window.api.community.getFavorites().catch(() => []));
  let activeFilter = 'all'; // 'all' | 'favorites'
  let allProjects = [];

  async function toggleFavorite(supabaseProjectId) {
    const result = await window.api.community.toggleFavorite({ supabaseProjectId });
    if (result.favorited) {
      favorites.add(supabaseProjectId);
    } else {
      favorites.delete(supabaseProjectId);
    }
    updateFavoriteButtons();
    if (activeFilter === 'favorites') renderList();
  }

  function updateFavoriteButtons() {
    document.querySelectorAll('[data-fav-btn]').forEach((btn) => {
      const id = btn.dataset.favBtn;
      const isFav = favorites.has(id);
      btn.classList.toggle('is-favorited', isFav);
      btn.title = isFav ? 'Remove from favorites' : 'Add to favorites';
      btn.setAttribute('aria-label', isFav ? 'Remove from favorites' : 'Add to favorites');
    });
  }

  // ── Reader state ─────────────────────────────────────────────────────────
  let activeProject = null;
  let activeChapter = null;
  let likeState = { count: 0, likedByMe: false };

  function closeReader() {
    reader.style.display = 'none';
    document.body.style.overflow = '';
  }

  document.getElementById('reader-close')?.addEventListener('click', closeReader);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && reader.style.display !== 'none') closeReader();
  });

  // ── Likes ────────────────────────────────────────────────────────────────
  async function loadLikes(supabaseProjectId, chapterId) {
    try {
      likeState = await window.api.community.getLikes({ supabaseProjectId, chapterId });
    } catch {
      likeState = { count: 0, likedByMe: false };
    }
    renderLikeBtn();
  }

  function renderLikeBtn() {
    const btn = document.getElementById('reader-like-btn');
    const count = document.getElementById('reader-like-count');
    if (!btn || !count) return;
    btn.classList.toggle('is-liked', likeState.likedByMe);
    count.textContent = likeState.count;
    btn.setAttribute('aria-label', likeState.likedByMe ? 'Unlike this chapter' : 'Like this chapter');
  }

  document.getElementById('reader-like-btn')?.addEventListener('click', async () => {
    if (!activeProject || !activeChapter) return;
    const btn = document.getElementById('reader-like-btn');
    btn.disabled = true;
    try {
      const result = await window.api.community.toggleLike({
        supabaseProjectId: activeProject.id,
        chapterId: activeChapter.chapter_id,
      });
      likeState.likedByMe = result.liked;
      likeState.count = result.liked ? likeState.count + 1 : Math.max(0, likeState.count - 1);
      renderLikeBtn();
    } catch (err) {
      if (err.message?.includes('Sign in')) alert('Sign in to like chapters.');
    } finally {
      btn.disabled = false;
    }
  });

  // ── Comments ─────────────────────────────────────────────────────────────
  async function loadComments(supabaseProjectId, chapterId) {
    const list = document.getElementById('reader-comments-list');
    list.innerHTML = '<p class="reader-comments-loading">Loading comments…</p>';
    try {
      const comments = await window.api.community.getChapterComments({ supabaseProjectId, chapterId });
      renderComments(list, comments || [], supabaseProjectId, chapterId);
    } catch {
      list.innerHTML = '<p class="reader-no-comments">Could not load comments.</p>';
    }
  }

  function renderComments(list, comments, supabaseProjectId, chapterId) {
    if (!comments.length) {
      list.innerHTML = '<p class="reader-no-comments">No comments yet — be the first!</p>';
      return;
    }
    const topLevel = comments.filter((c) => !c.parent_id);
    const replies = {};
    comments.filter((c) => c.parent_id).forEach((c) => {
      (replies[c.parent_id] ||= []).push(c);
    });

    list.innerHTML = topLevel.map((c) => `
      <div class="reader-comment" data-comment-id="${escapeHtml(c.id)}">
        <div class="reader-comment-header">
          <span class="reader-comment-author">${escapeHtml(c.profiles?.display_name || c.profiles?.username || 'Anonymous')}</span>
          <span class="reader-comment-date">${formatDateTime(c.created_at)}</span>
        </div>
        <p class="reader-comment-body">${escapeHtml(c.content)}</p>
        <button class="reader-reply-btn" type="button" data-reply-to="${escapeHtml(c.id)}">Reply</button>
        <div class="reader-reply-form" id="reply-form-${escapeHtml(c.id)}" style="display:none;">
          <textarea class="reader-comment-input reply-input" placeholder="Write a reply…" rows="2"></textarea>
          <div class="reader-reply-actions">
            <button class="btn btn-save reply-submit-btn" type="button" data-submit-reply="${escapeHtml(c.id)}">Post Reply</button>
            <button class="btn btn-ghost reply-cancel-btn" type="button" data-cancel-reply="${escapeHtml(c.id)}">Cancel</button>
          </div>
        </div>
        ${(replies[c.id] || []).map((r) => `
          <div class="reader-comment reader-reply">
            <div class="reader-comment-header">
              <span class="reader-comment-author">${escapeHtml(r.profiles?.display_name || r.profiles?.username || 'Anonymous')}</span>
              <span class="reader-comment-date">${formatDateTime(r.created_at)}</span>
            </div>
            <p class="reader-comment-body">${escapeHtml(r.content)}</p>
          </div>
        `).join('')}
      </div>
    `).join('');

    list.querySelectorAll('[data-reply-to]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const form = document.getElementById(`reply-form-${btn.dataset.replyTo}`);
        if (form) { form.style.display = form.style.display === 'none' ? 'grid' : 'none'; }
      });
    });

    list.querySelectorAll('[data-cancel-reply]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const form = document.getElementById(`reply-form-${btn.dataset.cancelReply}`);
        if (form) form.style.display = 'none';
      });
    });

    list.querySelectorAll('[data-submit-reply]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const parentId = btn.dataset.submitReply;
        const form = document.getElementById(`reply-form-${parentId}`);
        const input = form?.querySelector('.reply-input');
        const body = input?.value.trim();
        if (!body) return;
        btn.disabled = true;
        btn.textContent = 'Posting…';
        try {
          await window.api.community.addChapterComment({
            supabaseProjectId,
            chapterId,
            body,
            parentId,
          });
          await loadComments(supabaseProjectId, chapterId);
        } catch (err) {
          alert(err.message || 'Could not post reply.');
          btn.disabled = false;
          btn.textContent = 'Post Reply';
        }
      });
    });
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
    likeState = { count: 0, likedByMe: false };
    renderLikeBtn();

    reader.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    reader.querySelector('.chapter-reader-scroll')?.scrollTo(0, 0);

    await Promise.all([
      loadLikes(project.id, chapter.chapter_id),
      loadComments(project.id, chapter.chapter_id),
    ]);
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

  // ── Filter tabs ──────────────────────────────────────────────────────────
  function renderList() {
    const filtered = activeFilter === 'favorites'
      ? allProjects.filter((p) => favorites.has(p.id))
      : allProjects;

    if (!filtered.length) {
      grid.style.display = 'none';
      empty.style.display = 'block';
      empty.querySelector('h2').textContent = activeFilter === 'favorites' ? 'No favorites yet' : 'No public stories yet';
      empty.querySelector('p').textContent = activeFilter === 'favorites'
        ? 'Heart a story on the community page to save it here.'
        : 'Be the first — publish a chapter from your project to appear here.';
      return;
    }

    empty.style.display = 'none';
    grid.style.display = 'flex';
    grid.innerHTML = filtered.map((project) => {
      const content = project.content || {};
      const author = project.profiles?.display_name || project.profiles?.username || 'Unknown Author';
      const chapters = project.published_chapters || [];
      const isFav = favorites.has(project.id);

      return `
        <article class="community-card" data-project-id="${escapeHtml(project.id)}">
          <div class="community-card-body">
            <div class="community-card-top-row">
              <div class="community-author-row">
                <div class="community-author-avatar">${escapeHtml(author.charAt(0).toUpperCase())}</div>
                <span class="community-author-name">${escapeHtml(author)}</span>
              </div>
              <button
                class="community-fav-btn ${isFav ? 'is-favorited' : ''}"
                type="button"
                data-fav-btn="${escapeHtml(project.id)}"
                title="${isFav ? 'Remove from favorites' : 'Add to favorites'}"
                aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}"
              >
                <svg viewBox="0 0 20 20" fill="${isFav ? 'currentColor' : 'none'}" xmlns="http://www.w3.org/2000/svg" width="18" height="18" stroke="currentColor" stroke-width="1.6"><path d="M10 17s-7-4.35-7-9a4 4 0 0 1 7-2.65A4 4 0 0 1 17 8c0 4.65-7 9-7 9z" stroke-linejoin="round"/></svg>
              </button>
            </div>
            <h2 class="community-card-title">${escapeHtml(content.title || 'Untitled')}</h2>
            ${content.subtitle ? `<p class="community-card-subtitle">${escapeHtml(content.subtitle)}</p>` : ''}
            ${(content.genres || []).length ? `
              <div class="community-tags">
                ${(content.genres || []).map((g) => `<span class="community-tag">${escapeHtml(g)}</span>`).join('')}
              </div>
            ` : ''}
          </div>
          <div class="community-chapter-list">
            <p class="community-chapter-list-label">
              ${chapters.length} chapter${chapters.length !== 1 ? 's' : ''}
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

    grid.querySelectorAll('[data-fav-btn]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(btn.dataset.favBtn);
      });
    });

    grid.querySelectorAll('.community-chapter-row').forEach((btn) => {
      btn.addEventListener('click', () => {
        const project = allProjects.find((p) => p.id === btn.dataset.projectId);
        const chapter = project?.published_chapters.find((c) => c.chapter_id === btn.dataset.chapterId);
        if (project && chapter) openReader(project, chapter);
      });
    });
  }

  function setFilter(f) {
    activeFilter = f;
    document.querySelectorAll('[data-community-filter]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.communityFilter === f);
    });
    renderList();
  }

  document.querySelectorAll('[data-community-filter]').forEach((btn) => {
    btn.addEventListener('click', () => setFilter(btn.dataset.communityFilter));
  });

  // ── Load ─────────────────────────────────────────────────────────────────
  try {
    const projects = await window.api.community.getProjects();
    loading.style.display = 'none';
    allProjects = (projects || []).filter((p) => p.is_public && p.published_chapters?.length);
    if (!allProjects.length) {
      empty.style.display = 'block';
      return;
    }
    renderList();
  } catch (err) {
    loading.textContent = `Failed to load community stories: ${err?.message || err}`;
  }
});
