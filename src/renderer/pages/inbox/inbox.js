window.registerPageInit('inbox', async function () {
  const loading = document.getElementById('inbox-loading');
  const empty = document.getElementById('inbox-empty');
  const heroCopy = document.getElementById('inbox-hero-copy');

  const messagesPane = document.getElementById('inbox-messages-pane');
  const activityPane = document.getElementById('inbox-activity-pane');
  const unreadBadge = document.getElementById('inbox-unread-badge');
  const activityBadge = document.getElementById('inbox-activity-badge');

  const shell = document.getElementById('inbox-shell');
  const threadList = document.getElementById('inbox-thread-list');
  const threadEmpty = document.getElementById('inbox-thread-empty');
  const threadView = document.getElementById('inbox-thread-view');
  const threadTitle = document.getElementById('inbox-thread-title');
  const threadHandle = document.getElementById('inbox-thread-handle');
  const messageState = document.getElementById('inbox-message-state');
  const messageList = document.getElementById('inbox-message-list');
  const composer = document.getElementById('inbox-composer');
  const composerInput = document.getElementById('inbox-composer-input');
  const sendBtn = document.getElementById('inbox-send-btn');
  const backBtn = document.getElementById('inbox-back-to-list');

  const feed = document.getElementById('inbox-feed');
  const markReadBtn = document.getElementById('inbox-mark-read');
  const storageKey = 'bb-inbox-read-items';
  const unreadStateKey = 'bb-inbox-unread-state';
  const openConversationKey = 'bb-inbox-open-conversation';
  const avatarPalette = ['#ff6a5a', '#ff8a3d', '#4ff2c9', '#ff7eb8', '#7eb8ff', '#c9b4ff'];

  const session = await window.api.auth.getSession().catch(() => null);
  const currentUser = session?.user || session || null;
  const currentUserId = currentUser?.id || null;
  const currentUserName = currentUser?.user_metadata?.username || currentUser?.email || 'You';

  let activeMode = 'messages';
  let activeFilter = 'all';

  let conversations = [];
  let selectedConversationId = '';
  let messagesByConversation = {};
  let draftsByConversation = {};
  let loadingConversationId = '';
  let sendingConversationId = '';

  let notifications = [];
  let readIds = loadReadState();
  let replyDrafts = {};
  let replyOpen = {};
  let pendingReplies = new Set();
  let savedReplies = {};

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function loadReadState() {
    try {
      return new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'));
    } catch {
      return new Set();
    }
  }

  function saveReadState(nextReadIds) {
    localStorage.setItem(storageKey, JSON.stringify([...nextReadIds]));
  }

  function persistUnreadState() {
    const nextState = {
      activityUnread: getActivityUnreadCount(),
      messageUnread: getMessageUnreadCount(),
      totalUnread: getActivityUnreadCount() + getMessageUnreadCount(),
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(unreadStateKey, JSON.stringify(nextState));
    } catch {}

    window.setInboxSidebarBadgeCount?.(nextState);
  }

  function getInitials(name) {
    const pieces = String(name || 'Writer').split(/[\s_]+/).filter(Boolean).slice(0, 2);
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

  function formatThreadTime(value) {
    if (!value) return '';
    const date = new Date(value);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }
    const diff = now.getTime() - date.getTime();
    const dayDiff = Math.floor(diff / 86400000);
    if (dayDiff < 7) {
      return date.toLocaleDateString(undefined, { weekday: 'short' });
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function formatMessageTime(value) {
    if (!value) return '';
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function filteredNotifications() {
    return notifications.filter((item) => activeFilter === 'all' || item.type === activeFilter);
  }

  function getMessageUnreadCount() {
    return conversations.reduce((sum, conversation) => sum + Number(conversation.unreadCount || 0), 0);
  }

  function getActivityUnreadCount() {
    return notifications.filter((item) => !readIds.has(item.id)).length;
  }

  function updateBadges() {
    const messageCount = getMessageUnreadCount();
    unreadBadge.textContent = messageCount;
    unreadBadge.style.display = messageCount ? 'inline-flex' : 'none';

    const activityCount = getActivityUnreadCount();
    activityBadge.textContent = activityCount;
    activityBadge.style.display = activityCount ? 'inline-flex' : 'none';
    markReadBtn.style.display = activeMode === 'activity' && activityCount ? 'inline-flex' : 'none';
    persistUnreadState();
  }

  function getConversationById(conversationId) {
    return conversations.find((conversation) => conversation.id === conversationId) || null;
  }

  function renderThreadList() {
    if (!conversations.length) {
      threadList.innerHTML = '';
      return;
    }

    threadList.innerHTML = conversations.map((conversation) => {
      const isActive = conversation.id === selectedConversationId;
      const unreadCount = Number(conversation.unreadCount || 0);
      const displayName = conversation.otherUser?.displayName || conversation.otherUser?.username || 'Unknown writer';
      const handle = conversation.otherUser?.username ? `@${conversation.otherUser.username}` : 'Private conversation';
      return `
        <button class="inbox-thread-row ${isActive ? 'is-active' : ''} ${unreadCount ? 'is-unread' : ''}" type="button" data-thread-id="${escapeHtml(conversation.id)}">
          <div class="inbox-thread-avatar" style="background:${getAvatarColor(conversation.otherUser?.id || conversation.id)};">${escapeHtml(getInitials(displayName))}</div>
          <div class="inbox-thread-copy">
            <div class="inbox-thread-meta">
              <span class="inbox-thread-name">${escapeHtml(displayName)}</span>
              <span class="inbox-thread-time">${escapeHtml(formatThreadTime(conversation.lastMessageAt))}</span>
            </div>
            <p class="inbox-thread-handle-row">${escapeHtml(handle)}</p>
            <p class="inbox-thread-preview">${escapeHtml(conversation.lastMessagePreview || 'No messages yet')}</p>
          </div>
          ${unreadCount ? `<span class="inbox-thread-badge">${unreadCount}</span>` : ''}
        </button>
      `;
    }).join('');

    threadList.querySelectorAll('[data-thread-id]').forEach((button) => {
      button.addEventListener('click', () => openConversation(button.dataset.threadId));
    });
  }

  function renderMessageList() {
    const conversation = getConversationById(selectedConversationId);
    const messages = messagesByConversation[selectedConversationId] || [];

    if (!conversation) {
      threadView.style.display = 'none';
      threadEmpty.style.display = 'grid';
      return;
    }

    threadEmpty.style.display = 'none';
    threadView.style.display = 'grid';
    threadTitle.textContent = conversation.otherUser?.displayName || conversation.otherUser?.username || 'Conversation';
    threadHandle.textContent = conversation.otherUser?.username ? `@${conversation.otherUser.username}` : 'Private conversation';
    composerInput.value = draftsByConversation[selectedConversationId] || '';
    sendBtn.disabled = sendingConversationId === selectedConversationId;
    sendBtn.textContent = sendingConversationId === selectedConversationId ? 'Sending...' : 'Send';

    if (loadingConversationId === selectedConversationId) {
      messageState.style.display = 'block';
      messageState.textContent = 'Loading messages...';
      messageList.innerHTML = '';
      return;
    }

    if (!messages.length) {
      messageState.style.display = 'block';
      messageState.textContent = 'No messages yet. Say hello to start the conversation.';
      messageList.innerHTML = '';
      return;
    }

    messageState.style.display = 'none';
    messageList.innerHTML = messages.map((message) => {
      const isMine = message.senderId === currentUserId;
      const senderName = isMine
        ? currentUserName
        : (message.sender?.display_name || message.sender?.username || conversation.otherUser?.displayName || 'Writer');
      return `
        <article class="inbox-message ${isMine ? 'is-mine' : ''} ${message.isPending ? 'is-pending' : ''}">
          <div class="inbox-message-bubble">
            <p class="inbox-message-author">${escapeHtml(senderName)}</p>
            <p class="inbox-message-body">${escapeHtml(message.body)}</p>
            <p class="inbox-message-time">${escapeHtml(formatMessageTime(message.createdAt))}</p>
          </div>
        </article>
      `;
    }).join('');

    messageList.scrollTop = messageList.scrollHeight;
  }

  function renderMessagesLayout() {
    renderThreadList();
    renderMessageList();
    shell.classList.toggle('has-active-thread', Boolean(selectedConversationId));
  }

  function getNotificationTypeLabel(type) {
    const map = { like: 'Like', favorite: 'Favorite', comment: 'Comment', prompt: 'Prompt', milestone: 'Milestone' };
    return map[type] || 'Notification';
  }

  function loadMilestoneNotifications() {
    try {
      return JSON.parse(localStorage.getItem('bb-milestone-notifications') || '[]');
    } catch {
      return [];
    }
  }

  function groupLabel(key, hasUnread) {
    if (key === 'new') return 'New';
    return hasUnread ? 'Earlier' : 'All notifications';
  }

  function likeMarkup(item) {
    return `
      <div class="inbox-item-main">
        <div class="inbox-avatar" style="background:${getAvatarColor(item.userId || item.author)};">${escapeHtml(getInitials(item.author))}</div>
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

  function milestoneMarkup(item) {
    return `
      <div class="inbox-item-main">
        <div class="inbox-type-icon inbox-type-icon--milestone" aria-hidden="true">★</div>
        <div class="inbox-item-body">
          <div class="inbox-meta">
            <span class="inbox-badge inbox-badge-milestone">Milestone</span>
            <span class="inbox-time">${timeAgo(item.createdAt)}</span>
          </div>
          <p class="inbox-text">${escapeHtml(item.label)}</p>
          <p class="inbox-context">${escapeHtml(item.description)}${item.projectTitle ? ` · ${escapeHtml(item.projectTitle)}` : ''}</p>
        </div>
      </div>
    `;
  }

  function promptMarkup(item) {
    return `
      <div class="inbox-item-main">
        <div class="inbox-avatar" style="background:${getAvatarColor(item.userId || item.author)};">${escapeHtml(getInitials(item.author))}</div>
        <div class="inbox-item-body">
          <div class="inbox-meta">
            <span class="inbox-actor">@${escapeHtml(item.author)}</span>
            <span class="inbox-badge inbox-badge-favorite">Prompt</span>
            <span class="inbox-time">${timeAgo(item.createdAt)}</span>
          </div>
          <p class="inbox-text">completed your prompt challenge${item.wordCount ? ` with ${Number(item.wordCount).toLocaleString()} words` : ''}</p>
          <p class="inbox-context">${escapeHtml(item.plotPoint || item.genre || 'Community Prompt')} · ${escapeHtml(item.projectTitle || 'Untitled')} · ${escapeHtml(item.chapterTitle || 'Chapter')}</p>
          ${item.prompt ? `
            <blockquote class="inbox-quote">
              <p>${escapeHtml(item.prompt)}</p>
            </blockquote>
          ` : ''}
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
        <div class="inbox-avatar" style="background:${getAvatarColor(item.userId || item.author)};">${escapeHtml(getInitials(item.author))}</div>
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
          <textarea class="inbox-reply-input" rows="2" placeholder="Reply to @${escapeHtml(item.author)}..." data-reply-input="${escapeHtml(item.id)}">${escapeHtml(replyDrafts[item.id] || '')}</textarea>
          <div class="inbox-reply-actions">
            <button class="btn btn-save" type="button" data-reply-submit="${escapeHtml(item.id)}" ${isPending ? 'disabled' : ''}>${isPending ? 'Sending...' : 'Send Reply'}</button>
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
    if (item.type === 'prompt') content = promptMarkup(item);
    if (item.type === 'favorite') content = favoriteMarkup(item);
    if (item.type === 'milestone') content = milestoneMarkup(item);

    return `
      <article class="inbox-item ${unread ? 'is-unread' : ''}" data-item-id="${escapeHtml(item.id)}">
        ${unread ? '<span class="inbox-item-unread-dot" aria-hidden="true"></span>' : ''}
        ${content}
      </article>
    `;
  }

  function bindActivityEvents() {
    feed.querySelectorAll('[data-reply-open]').forEach((button) => {
      button.addEventListener('click', () => {
        replyOpen[button.dataset.replyOpen] = true;
        renderActivityFeed();
      });
    });

    feed.querySelectorAll('[data-reply-cancel]').forEach((button) => {
      button.addEventListener('click', () => {
        replyOpen[button.dataset.replyCancel] = false;
        renderActivityFeed();
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
        renderActivityFeed();

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
        } catch (error) {
          alert(error?.message || 'Could not post reply.');
        } finally {
          pendingReplies.delete(itemId);
          renderActivityFeed();
        }
      });
    });
  }

  function renderActivityFeed() {
    const filtered = filteredNotifications();

    if (!filtered.length) {
      feed.style.display = 'none';
      if (activeMode === 'activity') {
        empty.style.display = 'block';
        empty.querySelector('h2').textContent = activeFilter === 'all' ? 'All caught up' : `No ${getNotificationTypeLabel(activeFilter).toLowerCase()} activity`;
        empty.querySelector('p').textContent = activeFilter === 'all'
          ? 'New likes, favorites, and comments will appear here.'
          : `When new ${getNotificationTypeLabel(activeFilter).toLowerCase()} activity arrives, it will show up here.`;
      }
      updateBadges();
      return;
    }

    if (activeMode === 'activity') {
      empty.style.display = 'none';
    }

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

    bindActivityEvents();
    updateBadges();
  }

  function renderEmptyForCurrentMode() {
    if (activeMode === 'messages') {
      empty.querySelector('h2').textContent = currentUserId ? 'No messages yet' : 'Sign in to use Inbox';
      empty.querySelector('p').textContent = currentUserId
        ? 'Use the Message button on a writer card in Community to start a conversation.'
        : 'Direct messages and private activity are available after you sign in.';
    } else {
      empty.querySelector('h2').textContent = 'All caught up';
      empty.querySelector('p').textContent = 'New likes, favorites, and comments will appear here.';
    }
  }

  function renderMode() {
    document.querySelectorAll('[data-inbox-mode]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.inboxMode === activeMode);
    });

    messagesPane.style.display = activeMode === 'messages' ? 'block' : 'none';
    activityPane.style.display = activeMode === 'activity' ? 'block' : 'none';
    heroCopy.textContent = activeMode === 'messages'
      ? 'Private conversations with other writers live here.'
      : 'Likes, comments, and favorites on your published writing show up here.';

    if (activeMode === 'messages') {
      if (!currentUserId || !conversations.length) {
        empty.style.display = 'block';
        messagesPane.style.display = 'none';
        renderEmptyForCurrentMode();
      } else {
        empty.style.display = 'none';
        messagesPane.style.display = 'block';
        renderMessagesLayout();
      }
    } else {
      renderActivityFeed();
      if (!filteredNotifications().length) {
        renderEmptyForCurrentMode();
      } else {
        empty.style.display = 'none';
      }
    }

    updateBadges();
  }

  async function refreshConversations(preferredConversationId = selectedConversationId) {
    conversations = currentUserId ? await window.api.inbox.getDirectConversations() : [];

    if (!conversations.length) {
      selectedConversationId = '';
      return;
    }

    if (preferredConversationId && conversations.some((conversation) => conversation.id === preferredConversationId)) {
      selectedConversationId = preferredConversationId;
    } else if (!selectedConversationId || !conversations.some((conversation) => conversation.id === selectedConversationId)) {
      selectedConversationId = conversations[0].id;
    }
  }

  async function openConversation(conversationId) {
    const conversation = getConversationById(conversationId);
    if (!conversation) {
      return;
    }

    selectedConversationId = conversationId;
    loadingConversationId = conversationId;
    conversation.unreadCount = 0;
    renderMessagesLayout();
    updateBadges();

    try {
      const messages = await window.api.inbox.getConversationMessages({ conversationId });
      messagesByConversation[conversationId] = messages || [];
      await window.api.inbox.markConversationRead({ conversationId }).catch(() => null);
      conversation.unreadCount = 0;
    } catch (error) {
      messageState.style.display = 'block';
      messageState.textContent = error?.message || 'Could not load this conversation.';
    } finally {
      loadingConversationId = '';
      renderMessagesLayout();
      updateBadges();
      window.refreshInboxSidebarBadge?.().catch(() => {});
    }
  }

  function upsertOptimisticMessage(conversationId, body) {
    const timestamp = new Date().toISOString();
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      conversationId,
      senderId: currentUserId,
      body,
      createdAt: timestamp,
      readAt: null,
      sender: {
        username: currentUser?.user_metadata?.username || '',
        display_name: currentUser?.user_metadata?.display_name || currentUserName,
      },
      isPending: true,
    };

    messagesByConversation[conversationId] = [...(messagesByConversation[conversationId] || []), optimisticMessage];

    const conversation = getConversationById(conversationId);
    if (conversation) {
      conversation.lastMessageAt = timestamp;
      conversation.lastMessagePreview = body;
      conversation.unreadCount = 0;
      conversations = [conversation, ...conversations.filter((item) => item.id !== conversationId)];
    }

    return optimisticMessage;
  }

  composerInput.addEventListener('input', () => {
    if (selectedConversationId) {
      draftsByConversation[selectedConversationId] = composerInput.value;
    }
  });

  composer.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selectedConversationId || sendingConversationId) {
      return;
    }

    const body = String(composerInput.value || '').trim();
    if (!body) {
      return;
    }

    draftsByConversation[selectedConversationId] = '';
    composerInput.value = '';
    sendingConversationId = selectedConversationId;
    const optimisticMessage = upsertOptimisticMessage(selectedConversationId, body);
    renderMessagesLayout();
    updateBadges();

    try {
      const saved = await window.api.inbox.sendDirectMessage({ conversationId: selectedConversationId, body });
      messagesByConversation[selectedConversationId] = (messagesByConversation[selectedConversationId] || []).map((message) => (
        message.id === optimisticMessage.id
          ? { ...message, id: saved?.id || message.id, createdAt: saved?.created_at || message.createdAt, isPending: false }
          : message
      ));
      await refreshConversations(selectedConversationId);
    } catch (error) {
      draftsByConversation[selectedConversationId] = body;
      composerInput.value = body;
      messagesByConversation[selectedConversationId] = (messagesByConversation[selectedConversationId] || []).filter((message) => message.id !== optimisticMessage.id);
      alert(error?.message || 'Could not send that message.');
    } finally {
      sendingConversationId = '';
      renderMessagesLayout();
      updateBadges();
      window.refreshInboxSidebarBadge?.().catch(() => {});
    }
  });

  backBtn.addEventListener('click', () => {
    selectedConversationId = '';
    renderMessagesLayout();
  });

  markReadBtn?.addEventListener('click', () => {
    filteredNotifications().forEach((item) => readIds.add(item.id));
    saveReadState(readIds);
    renderActivityFeed();
    window.refreshInboxSidebarBadge?.().catch(() => {});
  });

  document.querySelectorAll('[data-inbox-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      activeFilter = button.dataset.inboxFilter;
      document.querySelectorAll('[data-inbox-filter]').forEach((item) => {
        item.classList.toggle('is-active', item.dataset.inboxFilter === activeFilter);
      });
      renderActivityFeed();
    });
  });

  document.querySelectorAll('[data-inbox-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      activeMode = button.dataset.inboxMode;
      renderMode();
    });
  });

  try {
    const preferredConversationId = sessionStorage.getItem(openConversationKey) || '';
    sessionStorage.removeItem(openConversationKey);

    const [items] = await Promise.all([
      window.api.inbox.getNotifications().catch(() => []),
      refreshConversations(preferredConversationId),
    ]);

    const milestoneNotifications = loadMilestoneNotifications();
    notifications = [
      ...milestoneNotifications,
      ...(items || []).map((item) => ({ ...item, type: item.type || 'comment' })),
    ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    loading.style.display = 'none';

    if (preferredConversationId) {
      activeMode = 'messages';
    }

    renderMode();

    if (selectedConversationId) {
      await openConversation(selectedConversationId);
    }
  } catch (error) {
    loading.textContent = `Could not load Inbox: ${error?.message || error}`;
  }
});
