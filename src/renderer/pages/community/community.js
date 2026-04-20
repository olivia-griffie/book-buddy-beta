window.registerPageInit('community', async function () {
  const grid = document.getElementById('community-content');
  const empty = document.getElementById('community-empty');
  const loading = document.getElementById('community-loading');
  const reader = document.getElementById('chapter-reader');
  const searchInput = document.getElementById('community-search-input');
  const favoritesCount = document.getElementById('community-favorites-count');
  const favoritesEmpty = document.getElementById('community-favorites-empty');

  const avatarColors = ['#ff6a5a', '#ff8a3d', '#4ff2c9', '#ff7eb8', '#7eb8ff', '#c9b4ff'];

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function stripHtml(value) {
    const temp = document.createElement('div');
    temp.innerHTML = String(value || '');
    return (temp.textContent || temp.innerText || '').trim();
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

  function getInitials(author) {
    const pieces = String(author || 'Anonymous').split(/[\s_]+/).filter(Boolean).slice(0, 2);
    return (pieces.map((piece) => piece.charAt(0).toUpperCase()).join('') || 'BB').slice(0, 2);
  }

  function countWords(project) {
    return (project.published_chapters || []).reduce((sum, chapter) => {
      return sum + stripHtml(chapter.content).split(/\s+/).filter(Boolean).length;
    }, 0);
  }

  function buildBlurb(project) {
    const content = project.content || {};
    const subtitle = String(content.subtitle || '').trim();
    if (subtitle) return subtitle;

    const chapterText = stripHtml(project.published_chapters?.[0]?.content || '');
    if (!chapterText) return 'Published chapters from this story are now available in the community reader.';
    if (chapterText.length <= 180) return chapterText;
    return `${chapterText.slice(0, 177).trimEnd()}…`;
  }

  function buildProjectMeta(project, index) {
    const content = project.content || {};
    const author = project.profiles?.display_name || project.profiles?.username || 'Unknown Author';
    const chapters = project.published_chapters || [];
    const latestChapter = chapters[chapters.length - 1] || null;

    return {
      id: project.id,
      authorId: project.owner_id || project.profiles?.id || null,
      author,
      authorHandle: project.profiles?.username || author.toLowerCase().replace(/\s+/g, '_'),
      title: content.title || 'Untitled',
      genres: content.genres || [],
      blurb: buildBlurb(project),
      initials: getInitials(author),
      avatarColor: avatarColors[index % avatarColors.length],
      chapterCount: chapters.length,
      wordCount: countWords(project),
      latestChapter,
      chapters,
      raw: project,
    };
  }

  const session = await window.api.auth.getSession().catch(() => null);
  const currentUserId = session?.user?.id || session?.id || null;
  let favorites = new Set(await window.api.community.getFavorites().catch(() => []));
  let activeFilter = 'all';
  let query = '';
  let allProjects = [];

  let activeProject = null;
  let activeChapter = null;
  let likeState = { count: 0, likedByMe: false };

  function updateFavoritesBadge() {
    const count = favorites.size;
    favoritesCount.textContent = count;
    favoritesCount.style.display = count ? 'inline-flex' : 'none';
  }

  async function toggleFavorite(supabaseProjectId) {
    const result = await window.api.community.toggleFavorite({ supabaseProjectId });
    if (result.favorited) {
      favorites.add(supabaseProjectId);
    } else {
      favorites.delete(supabaseProjectId);
    }
    updateFavoritesBadge();
    renderList();
  }

  async function messageAuthor(otherUserId) {
    if (!otherUserId) {
      return;
    }

    if (!currentUserId) {
      alert('Sign in to message other writers.');
      return;
    }

    if (otherUserId === currentUserId) {
      return;
    }

    try {
      const conversation = await window.api.inbox.findOrCreateConversation({ otherUserId });
      if (conversation?.id) {
        sessionStorage.setItem('bb-inbox-open-conversation', conversation.id);
      }
      await window.navigate('inbox', { project: window.getCurrentProject() });
    } catch (error) {
      alert(error?.message || 'Could not open a conversation.');
    }
  }

  function closeReader() {
    reader.style.display = 'none';
    document.body.style.overflow = '';
  }

  document.getElementById('reader-close')?.addEventListener('click', closeReader);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && reader.style.display !== 'none') closeReader();
  });

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
        if (form) form.style.display = form.style.display === 'none' ? 'grid' : 'none';
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
    const messageAuthorBtn = document.getElementById('reader-message-author');
    if (messageAuthorBtn) {
      const canMessageAuthor = Boolean(project.owner_id && currentUserId && project.owner_id !== currentUserId);
      messageAuthorBtn.style.display = canMessageAuthor ? 'inline-flex' : 'none';
      messageAuthorBtn.dataset.authorId = project.owner_id || '';
    }
    window.renderRichText?.(document.getElementById('reader-body'), chapter.content, {
      emptyHtml: '<p><em>No content.</em></p>',
    });
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

  document.getElementById('reader-message-author')?.addEventListener('click', () => {
    const authorId = document.getElementById('reader-message-author')?.dataset.authorId || '';
    if (authorId) {
      messageAuthor(authorId);
    }
  });

  function cardMarkup(projectMeta) {
    const isFav = favorites.has(projectMeta.id);
    const chaptersMarkup = projectMeta.chapters.slice(-3).reverse().map((chapter) => `
      <button
        class="community-chapter-pill"
        type="button"
        data-project-id="${escapeHtml(projectMeta.id)}"
        data-chapter-id="${escapeHtml(chapter.chapter_id)}"
      >
        ${escapeHtml(chapter.chapter_title || 'Chapter')}
      </button>
    `).join('');

    return `
      <article class="community-card" data-project-id="${escapeHtml(projectMeta.id)}">
        <div class="community-card-header">
          <div class="community-author">
            <div class="community-author-avatar" style="background:${projectMeta.avatarColor};">${escapeHtml(projectMeta.initials)}</div>
            <div class="community-author-meta">
              <p class="community-author-name">@${escapeHtml(projectMeta.authorHandle)}</p>
              <h2 class="community-card-title">${escapeHtml(projectMeta.title)}</h2>
            </div>
          </div>
          <button
            class="community-favorite-btn ${isFav ? 'is-favorited' : ''}"
            type="button"
            data-fav-btn="${escapeHtml(projectMeta.id)}"
            aria-label="${isFav ? 'Remove from favorites' : 'Save to favorites'}"
            title="${isFav ? 'Remove from favorites' : 'Save to favorites'}"
          >
            <svg viewBox="0 0 20 20" fill="${isFav ? 'currentColor' : 'none'}" xmlns="http://www.w3.org/2000/svg" width="16" height="16" stroke="currentColor" stroke-width="1.6"><path d="M10 17s-7-4.35-7-9a4 4 0 0 1 7-2.65A4 4 0 0 1 17 8c0 4.65-7 9-7 9z" stroke-linejoin="round"/></svg>
            <span>${isFav ? 'Saved' : 'Save'}</span>
          </button>
        </div>
        ${projectMeta.genres.length ? `
          <div class="community-tags">
            ${projectMeta.genres.map((genre) => `<span class="community-tag">${escapeHtml(genre)}</span>`).join('')}
          </div>
        ` : ''}
        <p class="community-blurb">${escapeHtml(projectMeta.blurb)}</p>
        <div class="community-chapter-strip">
          ${chaptersMarkup}
        </div>
        <div class="community-card-footer">
          <div class="community-metrics">
            <span class="community-metric">${projectMeta.chapterCount} chapter${projectMeta.chapterCount === 1 ? '' : 's'}</span>
            <span class="community-metric">${projectMeta.wordCount.toLocaleString()} words</span>
            <span class="community-metric">${escapeHtml(projectMeta.author)}</span>
          </div>
          <div class="community-card-actions">
            ${projectMeta.authorId && projectMeta.authorId !== currentUserId ? `
              <button
                class="btn btn-ghost community-message-btn"
                type="button"
                data-message-author="${escapeHtml(projectMeta.authorId)}"
              >
                Message
              </button>
            ` : ''}
            <button
              class="community-read-btn"
              type="button"
              data-read-project="${escapeHtml(projectMeta.id)}"
              data-read-chapter="${escapeHtml(projectMeta.latestChapter?.chapter_id || '')}"
            >
              Read Latest
            </button>
          </div>
        </div>
      </article>
    `;
  }

  function renderList() {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = allProjects.filter((projectMeta) => {
      const matchesFavorites = activeFilter === 'favorites' ? favorites.has(projectMeta.id) : true;
      const haystack = [
        projectMeta.title,
        projectMeta.author,
        projectMeta.authorHandle,
        projectMeta.blurb,
        ...(projectMeta.genres || []),
      ].join(' ').toLowerCase();
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      return matchesFavorites && matchesQuery;
    });

    updateFavoritesBadge();

    if (activeFilter === 'favorites' && !filtered.length && favorites.size === 0) {
      favoritesEmpty.style.display = 'block';
    } else {
      favoritesEmpty.style.display = 'none';
    }

    if (!filtered.length) {
      grid.style.display = 'none';
      empty.style.display = activeFilter === 'favorites' && favorites.size === 0 ? 'none' : 'block';
      if (activeFilter === 'favorites') {
        empty.querySelector('h2').textContent = 'No matching favorites';
        empty.querySelector('p').textContent = 'Try a different search, or save stories from Discover to see them here.';
      } else if (normalizedQuery) {
        empty.querySelector('h2').textContent = 'No stories match that search';
        empty.querySelector('p').textContent = 'Try another title, author, or genre.';
      } else {
        empty.querySelector('h2').textContent = 'No public stories yet';
        empty.querySelector('p').textContent = 'Be the first — publish a chapter from your project to appear here.';
      }
      return;
    }

    empty.style.display = 'none';
    grid.style.display = 'grid';
    grid.innerHTML = filtered.map(cardMarkup).join('');

    grid.querySelectorAll('[data-fav-btn]').forEach((btn) => {
      btn.addEventListener('click', () => toggleFavorite(btn.dataset.favBtn));
    });

    const openFromDataset = (projectId, chapterId) => {
      const projectMeta = allProjects.find((item) => item.id === projectId);
      const chapter = projectMeta?.chapters.find((item) => item.chapter_id === chapterId) || projectMeta?.latestChapter;
      if (projectMeta?.raw && chapter) {
        openReader(projectMeta.raw, chapter);
      }
    };

    grid.querySelectorAll('[data-read-project]').forEach((btn) => {
      btn.addEventListener('click', () => openFromDataset(btn.dataset.readProject, btn.dataset.readChapter));
    });

    grid.querySelectorAll('[data-chapter-id]').forEach((btn) => {
      btn.addEventListener('click', () => openFromDataset(btn.dataset.projectId, btn.dataset.chapterId));
    });

    grid.querySelectorAll('[data-message-author]').forEach((btn) => {
      btn.addEventListener('click', () => messageAuthor(btn.dataset.messageAuthor));
    });
  }

  function setFilter(filter) {
    activeFilter = filter;
    document.querySelectorAll('[data-community-filter]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.communityFilter === filter);
    });
    renderList();
  }

  searchInput?.addEventListener('input', () => {
    query = searchInput.value || '';
    renderList();
  });

  document.querySelectorAll('[data-community-filter]').forEach((btn) => {
    btn.addEventListener('click', () => setFilter(btn.dataset.communityFilter));
  });

  document.getElementById('community-browse-btn')?.addEventListener('click', () => setFilter('all'));

  try {
    const projects = await window.api.community.getProjects();
    loading.style.display = 'none';
    allProjects = (projects || [])
      .filter((project) => project.is_public && project.published_chapters?.length)
      .map(buildProjectMeta);

    if (!allProjects.length) {
      empty.style.display = 'block';
      return;
    }

    renderList();
  } catch (err) {
    loading.textContent = `Failed to load community stories: ${err?.message || err}`;
  }
});
