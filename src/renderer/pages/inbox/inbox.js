window.registerPageInit('inbox', async function () {
  const loading = document.getElementById('inbox-loading');
  const empty = document.getElementById('inbox-empty');
  const feed = document.getElementById('inbox-feed');
  const unreadBadge = document.getElementById('inbox-unread-badge');
  const markReadBtn = document.getElementById('inbox-mark-read');

  const storageKey = 'bb-inbox-read-items';
  const avatarPalette = ['#ff6a5a', '#ff8a3d', '#4ff2c9', '#ff7eb8', '#7eb8ff', '#c9b4ff'];

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function timeAgo(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function loadReadState() {
    try {
      return new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'));
    } catch {
      return new Set();
    }
  }

  function saveReadState(readIds) {
    localStorage.setItem(storageKey, JSON.stringify([...readIds]));
  }

  function getInitials(name) {
    const pieces = String(name || 'Anonymous').split(/[\s_]+/).filter(Boolean).slice(0, 2);
    return (pieces.map((piece) => piece.charAt(0).toUpperCase()).join('') || 'BB').slice(0, 2);
  }

  function getAvatarColor(id) {
    const value = String(id || '');
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash << 5) - hash) + value.charCodeAt(index);
      hash |= 0;
    }
    return avatarPalette[Math.abs(hash) % avatarPalette.length];
  }

  function getNotificationTypeLabel(type) {
    const map = {
      like: 'Like',
      favorite: 'Favorite',
      comment: 'Comment',
    };
    return map[type] || 'Notification';
  }

  function groupLabel(key, hasUnread) {
    if (key === 'new') return 'New';
    return hasUnread ? 'Earlier' : 'All notifications';
  }

  let notifications = [];
  let readIds = loadReadState();
  let activeFilter = 'all';
  let replyDrafts = {};
  let replyOpen = {};
  let pendingReplies = new Set();
  let savedReplies = {};

  function filteredNotifications() {
    return notifications.filter((item) => activeFilter === 'all' || item.type === activeFilter);
  }

  function updateUnreadUI() {
    const unreadCount = filteredNotifications().filter((item) => !readIds.has(item.id)).length;
    unreadBadge.textContent = unreadCount;
    unreadBadge.style.display = unreadCount ? 'inline-flex' : 'none';
    markReadBtn.style.display = unreadCount ? 'inline-flex' : 'none';
  }

  function likeMarkup(item) {
    return `
      <div class="inbox-item-main">
        <div class="inbox-avatar" style="background:${getAvatarColor(item.id)};">${escapeHtml(getInitials(item.author))}</div>
        <div class="inbox-item-body">
          <div class="inbox-meta">
            <span class="inbox-actor">@${escapeHtml(item.author)}</span>
            <span class="inbox-badge inbox-badge-like">Like</span>
            <span class="inbox-time">${timeAgo(item.createdAt)}</span>
          </div>
          <p class="inbox-text">liked <em>${escapeHtml(item.chapterTitle)}</em></p>
          <p class="inbox-context">${escapeHtml(item.projectTitle)}</p>
        </div>
      </div>
    `;
  }

  function favoriteMarkup(item) {
    return `
      <div class="inbox-item-main">
        <div class="inbox-type-icon">
          <svg viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M10 17s-7-4.35-7-9a4 4 0 0 1 7-2.65A4 4 0 0 1 17 8c0 4.65-7 9-7 9z"/></svg>
        </div>
        <div class="inbox-item-body">
          <div class="inbox-meta">
            <span class="inbox-badge inbox-badge-favorite">Favorite</span>
            <span class="inbox-time">${timeAgo(item.createdAt)}</span>
          </div>
          <p class="inbox-text">${escapeHtml(item.note || 'Readers added your project to their favorites.')}</p>
          <p class="inbox-context">${escapeHtml(item.projectTitle)}</p>
        </div>
      </div>
    `;
  }

  function commentMarkup(item) {
    const isOpen = Boolean(replyOpen[item.id]);
    const savedReply = savedReplies[item.id];
    const isPending = pendingReplies.has(item.id);

    return `
      <div class="inbox-item-main">
        <div class="inbox-avatar" style="background:${getAvatarColor(item.id)};">${escapeHtml(getInitials(item.author))}</div>
        <div class="inbox-item-body">
          <div class="inbox-meta">
            <span class="inbox-actor">@${escapeHtml(item.author)}</span>
            <span class="inbox-badge inbox-badge-comment">Comment</span>
            <span class="inbox-time">${timeAgo(item.createdAt)}</span>
          </div>
          <p class="inbox-context">${escapeHtml(item.chapterTitle)} · ${escapeHtml(item.projectTitle)}</p>
          <blockquote class="inbox-quote">
            <p>${escapeHtml(item.content)}</p>
          </blockquote>
        </div>
      </div>
      ${savedReply ? `
        <div class="inbox-replied">
          <p class="inbox-replied-kicker">Your reply</p>
          <p class="inbox-replied-text">${escapeHtml(savedReply)}</p>
        </div>
      ` : !isOpen ? `
        <div class="inbox-action-row">
          <button class="inbox-reply-btn" type="button" data-reply-open="${escapeHtml(item.id)}">Reply</button>
        </div>
      ` : `
        <div class="inbox-reply-form">
          <textarea class="inbox-reply-input" rows="2" placeholder="Reply to @${escapeHtml(item.author)}…" data-reply-input="${escapeHtml(item.id)}">${escapeHtml(replyDrafts[item.id] || '')}</textarea>
          <div class="inbox-reply-actions">
            <button class="btn btn-save" type="button" data-reply-submit="${escapeHtml(item.id)}" ${isPending ? 'disabled' : ''}>${isPending ? 'Sending…' : 'Send Reply'}</button>
            <button class="btn btn-ghost" type="button" data-reply-cancel="${escapeHtml(item.id)}">Cancel</button>
          </div>
        </div>
      `}
    `;
  }

  function renderNotification(item) {
    const unread = !readIds.has(item.id);
    let content = '';
    if (item.type === 'comment') content = commentMarkup(item);
    if (item.type === 'like') content = likeMarkup(item);
    if (item.type === 'favorite') content = favoriteMarkup(item);

    return `
      <article class="inbox-item ${unread ? 'is-unread' : ''}" data-item-id="${escapeHtml(item.id)}">
        ${unread ? '<span class="inbox-item-unread-dot" aria-hidden="true"></span>' : ''}
        ${content}
      </article>
    `;
  }

  function bindEvents() {
    feed.querySelectorAll('[data-reply-open]').forEach((button) => {
      button.addEventListener('click', () => {
        replyOpen[button.dataset.replyOpen] = true;
        renderFeed();
      });
    });

    feed.querySelectorAll('[data-reply-cancel]').forEach((button) => {
      button.addEventListener('click', () => {
        replyOpen[button.dataset.replyCancel] = false;
        renderFeed();
      });
    });

    feed.querySelectorAll('[data-reply-input]').forEach((input) => {
      input.addEventListener('input', () => {
        replyDrafts[input.dataset.replyInput] = input.value;
      });
    });

    feed.querySelectorAll('[data-reply-submit]').forEach((button) => {
      button.addEventListener('click', async () => {
        const itemId = button.dataset.replySubmit;
        const item = notifications.find((entry) => entry.id === itemId);
        const body = String(replyDrafts[itemId] || '').trim();
        if (!item || !body) return;

        pendingReplies.add(itemId);
        renderFeed();

        try {
          await window.api.inbox.replyToComment({
            supabaseProjectId: item.projectId,
            chapterId: item.chapterId,
            parentId: item.id,
            body,
          });
          savedReplies[itemId] = body;
          replyDrafts[itemId] = '';
          replyOpen[itemId] = false;
        } catch (err) {
          alert(err.message || 'Could not post reply.');
        } finally {
          pendingReplies.delete(itemId);
          renderFeed();
        }
      });
    });
  }

  function renderFeed() {
    const filtered = filteredNotifications();
    updateUnreadUI();

    if (!filtered.length) {
      feed.style.display = 'none';
      empty.style.display = 'block';
      empty.querySelector('h2').textContent = activeFilter === 'all' ? 'All caught up' : `No ${getNotificationTypeLabel(activeFilter).toLowerCase()} notifications`;
      empty.querySelector('p').textContent = activeFilter === 'all'
        ? 'New likes, favorites, and comments will appear here.'
        : `When new ${getNotificationTypeLabel(activeFilter).toLowerCase()} activity arrives, it will show up here.`;
      return;
    }

    empty.style.display = 'none';
    feed.style.display = 'grid';

    const unreadItems = filtered.filter((item) => !readIds.has(item.id));
    const readItems = filtered.filter((item) => readIds.has(item.id));
    const groups = [
      { key: 'new', items: unreadItems },
      { key: 'earlier', items: readItems },
    ].filter((group) => group.items.length);

    feed.innerHTML = groups.map((group) => `
      <section class="inbox-group">
        <p class="inbox-group-heading">${groupLabel(group.key, unreadItems.length > 0)}</p>
        ${group.items.map(renderNotification).join('')}
      </section>
    `).join('');

    bindEvents();
  }

  markReadBtn?.addEventListener('click', () => {
    filteredNotifications().forEach((item) => readIds.add(item.id));
    saveReadState(readIds);
    renderFeed();
  });

  document.querySelectorAll('[data-inbox-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      activeFilter = button.dataset.inboxFilter;
      document.querySelectorAll('[data-inbox-filter]').forEach((item) => {
        item.classList.toggle('is-active', item.dataset.inboxFilter === activeFilter);
      });
      renderFeed();
    });
  });

  try {
    const items = await window.api.inbox.getNotifications();
    notifications = (items || []).map((item) => ({
      ...item,
      type: item.type || 'comment',
    }));

    loading.style.display = 'none';
    renderFeed();
  } catch (err) {
    loading.textContent = `Could not load activity: ${err?.message || err}`;
  }
});
