window.registerPageInit('community', async function () {
  const grid = document.getElementById('community-content');
  const empty = document.getElementById('community-empty');
  const loading = document.getElementById('community-loading');
  const reader = document.getElementById('chapter-reader');
  const promptReader = document.getElementById('community-prompt-reader');
  const searchInput = document.getElementById('community-search-input');
  const favoritesCount = document.getElementById('community-favorites-count');
  const favoritesEmpty = document.getElementById('community-favorites-empty');
  const promptsEmpty = document.getElementById('community-prompts-empty');
  const promptFormCard = document.getElementById('community-prompt-form-card');
  const promptForm = document.getElementById('community-prompt-form');
  const promptGenreInput = document.getElementById('community-prompt-genre');
  const promptPlotPointInput = document.getElementById('community-prompt-plot-point');
  const promptCalloutInput = document.getElementById('community-prompt-callout');
  const promptTargetWordsInput = document.getElementById('community-prompt-target-words');
  const promptFormMessage = document.getElementById('community-prompt-form-message');
  const promptUseMessage = document.getElementById('community-prompt-use-message');
  const promptProjectSelect = document.getElementById('community-prompt-project-select');
  const promptChapterSelect = document.getElementById('community-prompt-chapter-select');
  const promptUseBtn = document.getElementById('community-prompt-use-btn');
  const promptFavoriteToggle = document.getElementById('community-prompt-favorite-toggle');

  const avatarColors = ['#ff6a5a', '#ff8a3d', '#4ff2c9', '#ff7eb8', '#7eb8ff', '#c9b4ff'];

  function getAvatarColor(id) {
    const value = String(id || '');
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = ((hash << 5) - hash) + value.charCodeAt(i);
      hash |= 0;
    }
    return avatarColors[Math.abs(hash) % avatarColors.length];
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
    return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
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
    return `${chapterText.slice(0, 177).trimEnd()}...`;
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
      avatarColor: getAvatarColor(project.owner_id || project.profiles?.id),
      chapterCount: chapters.length,
      wordCount: countWords(project),
      latestChapter,
      chapters,
      raw: project,
    };
  }

  function buildPromptMeta(prompt, index) {
    const author = prompt.profiles?.display_name || prompt.profiles?.username || 'Unknown Writer';
    return {
      id: prompt.id,
      authorId: prompt.user_id,
      author,
      authorHandle: prompt.profiles?.username || author.toLowerCase().replace(/\s+/g, '_'),
      genre: prompt.genre || '',
      plotPoint: prompt.plot_point || 'Community Prompt',
      prompt: prompt.prompt || '',
      targetWordCount: Number(prompt.target_word_count || 0),
      createdAt: prompt.created_at,
      updatedAt: prompt.updated_at,
      initials: getInitials(author),
      avatarColor: getAvatarColor(prompt.user_id || prompt.profiles?.id),
      raw: prompt,
    };
  }

  const session = await window.api.auth.getSession().catch(() => null);
  const currentUserId = session?.user?.id || session?.id || null;

  let favorites = new Set(await window.api.community.getFavorites().catch(() => []));
  let promptFavorites = new Set(await window.api.community.getPromptFavorites().catch(() => []));
  let activeFilter = 'all';
  let query = '';
  let allProjects = [];
  let allPrompts = [];
  let localProjects = [];
  let promptPlotPointsByGenre = {};

  let activeProject = null;
  let activeChapter = null;
  let likeState = { count: 0, likedByMe: false };
  let activePrompt = null;

  function canMessageAuthor(authorId) {
    return Boolean(authorId && currentUserId && authorId !== currentUserId);
  }

  function shouldShowAuthorContact(authorId) {
    return Boolean(authorId && authorId !== currentUserId);
  }

  function authorContactMarkup(authorId) {
    if (!shouldShowAuthorContact(authorId)) return '';

    if (canMessageAuthor(authorId)) {
      return `<button class="btn btn-save community-message-primary" type="button" data-message-author="${escapeHtml(authorId)}">Message</button>`;
    }

    return `<button class="btn btn-ghost community-message-primary is-disabled" type="button" data-message-signin="true" aria-disabled="true">Sign In</button>`;
  }

  function updateFavoritesBadge() {
    const count = favorites.size;
    favoritesCount.textContent = count;
    favoritesCount.style.display = count ? 'inline-flex' : 'none';
  }

  function setSearchPlaceholder() {
    if (!searchInput) return;
    searchInput.placeholder = activeFilter === 'prompts'
      ? 'Search prompts by genre, section, author, or callout...'
      : 'Search by title, author, or genre...';
  }

  async function toggleFavorite(supabaseProjectId) {
    const result = await window.api.community.toggleFavorite({ supabaseProjectId });
    if (result.favorited) favorites.add(supabaseProjectId);
    else favorites.delete(supabaseProjectId);
    updateFavoritesBadge();
    renderList();
  }

  async function togglePromptFavorite(promptId) {
    if (!currentUserId) {
      alert('Sign in to save prompts.');
      return;
    }
    const result = await window.api.community.togglePromptFavorite({ promptId });
    if (result.favorited) promptFavorites.add(promptId);
    else promptFavorites.delete(promptId);
    syncPromptFavoriteButton();
    renderList();
  }

  async function messageAuthor(otherUserId) {
    if (!otherUserId) return;
    if (!currentUserId) {
      alert('Sign in to message other writers.');
      return;
    }
    if (otherUserId === currentUserId) return;

    try {
      const conversation = await window.api.inbox.findOrCreateConversation({ otherUserId });
      if (conversation?.id) {
        sessionStorage.setItem('bb-inbox-open-conversation', conversation.id);
      }
      await window.navigate('inbox', { project: window.getCurrentProject() });
    } catch (error) {
      const isAuthError = /auth|sign.?in|session|unauthorized|jwt|token/i.test(error?.message || '');
      alert(isAuthError
        ? 'Your session has expired. Please sign out and back in to send messages.'
        : error?.message || 'Could not open a conversation.');
    }
  }

  function closeReader() {
    reader.style.display = 'none';
    document.body.style.overflow = '';
  }

  function closePromptReader() {
    promptReader.style.display = 'none';
    promptUseMessage.textContent = '';
    document.body.style.overflow = '';
  }

  document.getElementById('reader-close')?.addEventListener('click', closeReader);
  document.getElementById('community-prompt-close')?.addEventListener('click', closePromptReader);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && reader.style.display !== 'none') closeReader();
    if (event.key === 'Escape' && promptReader.style.display !== 'none') closePromptReader();
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
    list.innerHTML = '<p class="reader-comments-loading">Loading comments...</p>';
    try {
      const comments = await window.api.community.getChapterComments({ supabaseProjectId, chapterId });
      renderComments(list, comments || [], supabaseProjectId, chapterId);
    } catch {
      list.innerHTML = '<p class="reader-no-comments">Could not load comments.</p>';
    }
  }

  function renderComments(list, comments, supabaseProjectId, chapterId) {
    if (!comments.length) {
      list.innerHTML = '<p class="reader-no-comments">No comments yet - be the first!</p>';
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
          <textarea class="reader-comment-input reply-input" placeholder="Write a reply..." rows="2"></textarea>
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
        btn.textContent = 'Posting...';
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
    const authorContactShell = document.getElementById('reader-author-contact');
    const authorContactText = document.getElementById('reader-author-contact-text');
    const authorName = project.profiles?.display_name || project.profiles?.username || 'this author';
    if (messageAuthorBtn && authorContactShell && authorContactText) {
      const showAuthorContact = shouldShowAuthorContact(project.owner_id);
      authorContactShell.style.display = showAuthorContact ? 'flex' : 'none';
      messageAuthorBtn.style.display = showAuthorContact ? 'inline-flex' : 'none';
      messageAuthorBtn.dataset.authorId = project.owner_id || '';
      messageAuthorBtn.dataset.requiresSignin = currentUserId ? 'false' : 'true';
      messageAuthorBtn.textContent = canMessageAuthor(project.owner_id) ? 'Message Author' : 'Sign In To Message';
      messageAuthorBtn.classList.toggle('btn-save', canMessageAuthor(project.owner_id));
      messageAuthorBtn.classList.toggle('btn-ghost', !canMessageAuthor(project.owner_id));
      authorContactText.textContent = canMessageAuthor(project.owner_id)
        ? `Want to ask ${authorName} about this chapter or their story?`
        : `Sign in to privately message ${authorName} about this chapter.`;
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
    submit.textContent = 'Posting...';
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
    const button = document.getElementById('reader-message-author');
    if (button?.dataset.requiresSignin === 'true') {
      alert('Sign in to privately message other writers.');
      return;
    }
    const authorId = button?.dataset.authorId || '';
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
      <article
        class="community-card"
        data-project-id="${escapeHtml(projectMeta.id)}"
        data-open-project="${escapeHtml(projectMeta.id)}"
        data-open-chapter="${escapeHtml(projectMeta.latestChapter?.chapter_id || '')}"
        tabindex="0"
        role="button"
        aria-label="Read ${escapeHtml(projectMeta.title)} by ${escapeHtml(projectMeta.author)}"
      >
        <div class="community-card-header">
          <div class="community-author">
            <div class="community-author-avatar" style="background:${projectMeta.avatarColor};">${escapeHtml(projectMeta.initials)}</div>
            <div class="community-author-meta">
              <div class="community-author-line">
                <p class="community-author-name">@${escapeHtml(projectMeta.authorHandle)}</p>
                ${authorContactMarkup(projectMeta.authorId)}
              </div>
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
        <div class="community-chapter-strip">
          ${chaptersMarkup}
        </div>
        <p class="community-blurb">${escapeHtml(projectMeta.blurb)}</p>
        <div class="community-card-footer">
          <div class="community-metrics">
            <span class="community-metric">${projectMeta.chapterCount} chapter${projectMeta.chapterCount === 1 ? '' : 's'}</span>
            <span class="community-metric">${projectMeta.wordCount.toLocaleString()} words</span>
            <span class="community-metric">${escapeHtml(projectMeta.author)}</span>
          </div>
          <div class="community-card-actions">
            <button class="community-read-btn" type="button" data-read-project="${escapeHtml(projectMeta.id)}" data-read-chapter="${escapeHtml(projectMeta.latestChapter?.chapter_id || '')}">Read Latest</button>
          </div>
        </div>
      </article>
    `;
  }

  function promptCardMarkup(promptMeta) {
    const isFav = promptFavorites.has(promptMeta.id);
    return `
      <article
        class="community-card community-prompt-card"
        data-open-prompt="${escapeHtml(promptMeta.id)}"
        tabindex="0"
        role="button"
        aria-label="Open prompt by ${escapeHtml(promptMeta.author)}"
      >
        <div class="community-card-header">
          <div class="community-author">
            <div class="community-author-avatar" style="background:${promptMeta.avatarColor};">${escapeHtml(promptMeta.initials)}</div>
            <div class="community-author-meta">
              <div class="community-author-line">
                <p class="community-author-name">Author: ${escapeHtml(promptMeta.author)}</p>
                ${authorContactMarkup(promptMeta.authorId)}
              </div>
              <h2 class="community-card-title">${escapeHtml(promptMeta.plotPoint || 'Community Prompt')}</h2>
            </div>
          </div>
          <button
            class="community-favorite-btn ${isFav ? 'is-favorited' : ''}"
            type="button"
            data-prompt-favorite="${escapeHtml(promptMeta.id)}"
            aria-label="${isFav ? 'Remove prompt from favorites' : 'Save prompt for later'}"
          >
            <svg viewBox="0 0 20 20" fill="${isFav ? 'currentColor' : 'none'}" xmlns="http://www.w3.org/2000/svg" width="16" height="16" stroke="currentColor" stroke-width="1.6"><path d="M10 17s-7-4.35-7-9a4 4 0 0 1 7-2.65A4 4 0 0 1 17 8c0 4.65-7 9-7 9z" stroke-linejoin="round"/></svg>
            <span>${isFav ? 'Saved' : 'Save'}</span>
          </button>
        </div>
        <div class="community-tags">
          <span class="community-tag">${escapeHtml(promptMeta.genre)}</span>
          ${promptMeta.targetWordCount ? `<span class="community-tag">${promptMeta.targetWordCount.toLocaleString()} words</span>` : ''}
        </div>
        <p class="prompt-callout">${escapeHtml(promptMeta.prompt)}</p>
        <div class="community-card-footer">
          <div class="community-metrics">
            <span class="community-metric">${escapeHtml(promptMeta.author)}</span>
            <span class="community-metric">${escapeHtml(formatDate(promptMeta.createdAt))}</span>
          </div>
          <div class="community-card-actions">
            <button class="community-read-btn" type="button" data-open-prompt-btn="${escapeHtml(promptMeta.id)}">Use Prompt</button>
          </div>
        </div>
      </article>
    `;
  }

  async function loadLocalProjects() {
    localProjects = await window.api.getAllProjects().catch(() => []);
    return localProjects;
  }

  function syncPromptFavoriteButton() {
    if (!activePrompt || !promptFavoriteToggle) return;
    const isFav = promptFavorites.has(activePrompt.id);
    promptFavoriteToggle.classList.toggle('is-favorited', isFav);
    promptFavoriteToggle.innerHTML = isFav ? 'Saved' : 'Save';
  }

  function populatePromptChapterOptions(projectId) {
    const project = localProjects.find((entry) => entry.id === projectId);
    const chapters = project?.chapters || [];
    promptChapterSelect.innerHTML = chapters.length
      ? chapters.map((chapter) => `<option value="${chapter.id}">${escapeHtml(chapter.title || 'Untitled Chapter')}</option>`).join('')
      : '<option value="">No chapters yet — add one in Chapters first</option>';
    promptChapterSelect.disabled = !chapters.length;
    if (!chapters.length) {
      promptUseMessage.textContent = 'This project has no chapters yet. Add a chapter in the Chapters page first, then come back to assign this prompt.';
    } else {
      promptUseMessage.textContent = '';
    }
  }

  async function openPromptReader(promptMeta) {
    activePrompt = promptMeta;
    document.getElementById('community-prompt-reader-genre').textContent = promptMeta.genre || 'Community Prompt';
    document.getElementById('community-prompt-reader-title').textContent = promptMeta.plotPoint || 'Community Prompt';
    document.getElementById('community-prompt-reader-author').textContent = promptMeta.author;
    document.getElementById('community-prompt-reader-target').textContent = promptMeta.targetWordCount
      ? `${promptMeta.targetWordCount.toLocaleString()} word target`
      : 'No target word count';
    document.getElementById('community-prompt-reader-callout').textContent = promptMeta.prompt || '';
    promptUseMessage.textContent = '';

    await loadLocalProjects();
    promptProjectSelect.innerHTML = localProjects.length
      ? localProjects.map((project) => `<option value="${project.id}">${escapeHtml(project.title || 'Untitled Project')}</option>`).join('')
      : '<option value="">No projects available</option>';
    promptProjectSelect.disabled = !localProjects.length;
    populatePromptChapterOptions(promptProjectSelect.value);
    syncPromptFavoriteButton();

    promptReader.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    promptReader.querySelector('.chapter-reader-scroll')?.scrollTo(0, 0);
  }

  promptProjectSelect?.addEventListener('change', () => {
    populatePromptChapterOptions(promptProjectSelect.value);
  });

  promptFavoriteToggle?.addEventListener('click', () => {
    if (activePrompt) {
      togglePromptFavorite(activePrompt.id);
    }
  });

  promptUseBtn?.addEventListener('click', async () => {
    if (!activePrompt) return;
    const projectId = promptProjectSelect.value;
    const chapterId = promptChapterSelect.value;
    const targetProject = localProjects.find((project) => project.id === projectId);

    if (!targetProject) {
      promptUseMessage.textContent = 'Choose a project first.';
      return;
    }

    if (!chapterId) {
      promptUseMessage.textContent = 'Choose a chapter to assign this prompt to.';
      return;
    }

    const existingActivePrompt = (targetProject.dailyPromptHistory || []).find((entry) => (
      entry.source === 'community'
      && entry.sourcePromptId === activePrompt.id
      && !entry.answerInsertedAt
    ));

    const importedPrompt = existingActivePrompt || {
      id: `community-prompt-${activePrompt.id}-${Date.now()}`,
      genre: activePrompt.genre,
      plotPoint: activePrompt.plotPoint,
      prompt: activePrompt.prompt,
      context: `Shared by ${activePrompt.author}.`,
      assignedChapterId: chapterId,
      answer: '',
      answerInsertedAt: '',
      requiredWordCount: Number(activePrompt.targetWordCount || 0),
      insertedWordCount: 0,
      source: 'community',
      sourcePromptId: activePrompt.id,
      sourceAuthorId: activePrompt.authorId,
      sourceAuthorName: activePrompt.author,
    };

    importedPrompt.assignedChapterId = chapterId;

    const nextHistory = existingActivePrompt
      ? (targetProject.dailyPromptHistory || []).map((entry) => (entry === existingActivePrompt ? importedPrompt : entry))
      : [importedPrompt, ...(targetProject.dailyPromptHistory || []).filter((entry) => !entry.answerInsertedAt), ...(targetProject.dailyPromptHistory || []).filter((entry) => entry.answerInsertedAt)];

    promptUseMessage.textContent = 'Opening this prompt in Daily Prompts...';

    try {
      const savedProject = await window.api.saveProject({
        ...targetProject,
        dailyPromptHistory: nextHistory,
        updatedAt: new Date().toISOString(),
      }, {
        dirtyFields: ['dailyPromptHistory'],
      });
      window.setCurrentProject(savedProject);
      closePromptReader();
      await window.navigate('daily-prompts', { project: savedProject });
    } catch (error) {
      promptUseMessage.textContent = error?.message || 'Could not add this prompt to your project.';
    }
  });

  function openPromptComposer() {
    if (!currentUserId) {
      alert('Sign in to share a community prompt.');
      return;
    }
    promptFormCard.style.display = 'grid';
    promptCalloutInput?.focus();
    promptFormCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function syncPromptPlotPointOptions() {
    const selectedGenre = promptGenreInput?.value || '';
    const normalizeGenre = window.normalizeGenreKey || ((value) => String(value || '').trim().toLowerCase());
    const genreKey = normalizeGenre(selectedGenre);
    const plotPoints = promptPlotPointsByGenre[genreKey] || [];

    if (!promptPlotPointInput) {
      return;
    }

    promptPlotPointInput.innerHTML = plotPoints.length
      ? plotPoints.map((plotPoint) => `<option value="${escapeHtml(plotPoint)}">${escapeHtml(plotPoint)}</option>`).join('')
      : '<option value="">No section targets available</option>';

    promptPlotPointInput.disabled = !plotPoints.length;
  }

  function populatePromptGenreOptions() {
    const fallbackGenres = ['Contemporary', 'Fantasy', 'Historical Fiction', 'Horror', 'Literary Fiction', 'Memoir', 'Mystery', 'Romance', 'Science Fiction', 'Short Story', 'Thriller'];
    window.getGenrePromptData()
      .then((data) => {
        const genreBeatRows = data?.genrePrompts || [];
        const genres = [...new Set((data?.genrePrompts || []).map((entry) => entry.genre).filter(Boolean))]
          .filter((genre) => !String(genre).includes('-') && !String(genre).toLowerCase().includes(' x '))
          .sort((left, right) => left.localeCompare(right));
        const normalizeGenre = window.normalizeGenreKey || ((value) => String(value || '').trim().toLowerCase());
        promptPlotPointsByGenre = genres.reduce((accumulator, genre) => {
          const genreKey = normalizeGenre(genre);
          accumulator[genreKey] = [...new Set(
            genreBeatRows
              .filter((entry) => normalizeGenre(entry.genre) === genreKey)
              .map((entry) => String(entry.plotPoint || '').trim())
              .filter(Boolean),
          )];
          return accumulator;
        }, {});
        const source = genres.length ? genres : fallbackGenres;
        promptGenreInput.innerHTML = source.map((genre) => `<option value="${genre}">${genre}</option>`).join('');
        syncPromptPlotPointOptions();
      })
      .catch(() => {
        promptGenreInput.innerHTML = fallbackGenres.map((genre) => `<option value="${genre}">${genre}</option>`).join('');
        promptPlotPointsByGenre = {};
        syncPromptPlotPointOptions();
      });
  }

  promptGenreInput?.addEventListener('change', syncPromptPlotPointOptions);

  promptForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    promptFormMessage.textContent = '';

    if (!currentUserId) {
      promptFormMessage.textContent = 'Sign in to share a prompt.';
      return;
    }

    const payload = {
      genre: promptGenreInput.value,
      plotPoint: promptPlotPointInput.value.trim(),
      prompt: promptCalloutInput.value.trim(),
      targetWordCount: Number(promptTargetWordsInput.value || 0),
    };

    if (!payload.genre || !payload.plotPoint || !payload.prompt) {
      promptFormMessage.textContent = 'Add a genre, section target, and prompt callout before saving.';
      return;
    }

    try {
      await window.api.community.createPrompt(payload);
      const prompts = await window.api.community.getPrompts();
      allPrompts = (prompts || []).map(buildPromptMeta);
      syncPromptPlotPointOptions();
      promptCalloutInput.value = '';
      promptTargetWordsInput.value = '500';
      promptFormMessage.textContent = 'Community prompt shared.';
      activeFilter = 'prompts';
      renderList();
    } catch (error) {
      promptFormMessage.textContent = error?.message || 'Could not share this prompt.';
    }
  });

  function renderStoryList(filtered) {
    updateFavoritesBadge();
    promptFormCard.style.display = 'none';
    promptsEmpty.style.display = 'none';

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
      } else if (query.trim()) {
        empty.querySelector('h2').textContent = 'No stories match that search';
        empty.querySelector('p').textContent = 'Try another title, author, or genre.';
      } else {
        empty.querySelector('h2').textContent = 'No public stories yet';
        empty.querySelector('p').textContent = 'Be the first - publish a chapter from your project to appear here.';
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

    grid.querySelectorAll('[data-open-project]').forEach((card) => {
      const openCard = () => openFromDataset(card.dataset.openProject, card.dataset.openChapter);
      card.addEventListener('click', (event) => {
        if (event.target.closest('button, a, input, textarea, select, label')) return;
        openCard();
      });
      card.addEventListener('keydown', (event) => {
        if (event.target !== card) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openCard();
        }
      });
    });

    grid.querySelectorAll('[data-chapter-id]').forEach((btn) => {
      btn.addEventListener('click', () => openFromDataset(btn.dataset.projectId, btn.dataset.chapterId));
    });

    grid.querySelectorAll('[data-message-author]').forEach((btn) => {
      btn.addEventListener('click', () => messageAuthor(btn.dataset.messageAuthor));
    });

    grid.querySelectorAll('[data-message-signin]').forEach((btn) => {
      btn.addEventListener('click', () => {
        alert('Sign in to privately message other writers.');
      });
    });
  }

  function renderPromptList(filtered) {
    favoritesEmpty.style.display = 'none';
    empty.style.display = 'none';
    promptFormCard.style.display = 'grid';

    if (!allPrompts.length) {
      grid.style.display = 'none';
      promptsEmpty.style.display = 'block';
      return;
    }

    promptsEmpty.style.display = 'none';

    if (!filtered.length) {
      grid.style.display = 'none';
      empty.style.display = 'block';
      empty.querySelector('h2').textContent = 'No prompts match that search';
      empty.querySelector('p').textContent = 'Try another author, genre, section target, or prompt phrase.';
      return;
    }

    grid.style.display = 'grid';
    grid.innerHTML = filtered.map(promptCardMarkup).join('');

    const openPromptById = (promptId) => {
      const promptMeta = allPrompts.find((item) => item.id === promptId);
      if (promptMeta) openPromptReader(promptMeta);
    };

    grid.querySelectorAll('[data-prompt-favorite]').forEach((btn) => {
      btn.addEventListener('click', () => togglePromptFavorite(btn.dataset.promptFavorite));
    });

    grid.querySelectorAll('[data-open-prompt-btn]').forEach((btn) => {
      btn.addEventListener('click', () => openPromptById(btn.dataset.openPromptBtn));
    });

    grid.querySelectorAll('[data-open-prompt]').forEach((card) => {
      const openCard = () => openPromptById(card.dataset.openPrompt);
      card.addEventListener('click', (event) => {
        if (event.target.closest('button, a, input, textarea, select, label')) return;
        openCard();
      });
      card.addEventListener('keydown', (event) => {
        if (event.target !== card) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openCard();
        }
      });
    });

    grid.querySelectorAll('[data-message-author]').forEach((btn) => {
      btn.addEventListener('click', () => messageAuthor(btn.dataset.messageAuthor));
    });

    grid.querySelectorAll('[data-message-signin]').forEach((btn) => {
      btn.addEventListener('click', () => {
        alert('Sign in to privately message other writers.');
      });
    });
  }

  function renderList() {
    const normalizedQuery = query.trim().toLowerCase();
    setSearchPlaceholder();

    if (activeFilter === 'prompts') {
      const filteredPrompts = allPrompts.filter((promptMeta) => {
        const haystack = [
          promptMeta.genre,
          promptMeta.plotPoint,
          promptMeta.prompt,
          promptMeta.author,
          promptMeta.authorHandle,
        ].join(' ').toLowerCase();
        return !normalizedQuery || haystack.includes(normalizedQuery);
      });
      renderPromptList(filteredPrompts);
      return;
    }

    const filteredStories = allProjects.filter((projectMeta) => {
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

    renderStoryList(filteredStories);
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
  document.getElementById('community-empty-add-prompt')?.addEventListener('click', openPromptComposer);

  populatePromptGenreOptions();

  try {
    const [projects, prompts] = await Promise.all([
      window.api.community.getProjects(),
      window.api.community.getPrompts(),
    ]);
    loading.style.display = 'none';
    allProjects = (projects || [])
      .filter((project) => project.is_public && project.published_chapters?.length)
      .map(buildProjectMeta);
    allPrompts = (prompts || []).map(buildPromptMeta);

    if (!allProjects.length && !allPrompts.length) {
      empty.style.display = 'block';
      empty.querySelector('h2').textContent = 'Nothing in Community yet';
      empty.querySelector('p').textContent = 'Publish a chapter or share a prompt to get the community started.';
      return;
    }

    renderList();
  } catch (err) {
    loading.textContent = `Failed to load community: ${err?.message || err}`;
  }
});
