window.registerPageInit('inbox', async function () {
  const loading = document.getElementById('inbox-loading');
  const empty = document.getElementById('inbox-empty');
  const feed = document.getElementById('inbox-feed');

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function timeAgo(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  try {
    const items = await window.api.inbox.getNotifications();
    loading.style.display = 'none';

    if (!items?.length) {
      empty.style.display = 'block';
      return;
    }

    feed.innerHTML = items.map((item) => {
      if (item.type === 'like') {
        return `
          <div class="inbox-item inbox-item-like">
            <div class="inbox-item-icon inbox-icon-like">
              <svg viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="14" height="14"><path d="M10 17s-7-4.35-7-9a4 4 0 0 1 7-2.65A4 4 0 0 1 17 8c0 4.65-7 9-7 9z"/></svg>
            </div>
            <div class="inbox-item-body">
              <p class="inbox-item-text">
                <strong>${escapeHtml(item.author)}</strong> liked
                <em>${escapeHtml(item.chapterTitle)}</em>
                in <span class="inbox-item-project">${escapeHtml(item.projectTitle)}</span>
              </p>
              <span class="inbox-item-time">${timeAgo(item.createdAt)}</span>
            </div>
          </div>
        `;
      }

      if (item.type === 'comment') {
        return `
          <div class="inbox-item inbox-item-comment" data-item-id="${escapeHtml(item.id)}">
            <div class="inbox-item-icon inbox-icon-comment">
              <svg viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="14" height="14"><path d="M2 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6l-4 3V4z"/></svg>
            </div>
            <div class="inbox-item-body">
              <p class="inbox-item-text">
                <strong>${escapeHtml(item.author)}</strong> commented on
                <em>${escapeHtml(item.chapterTitle)}</em>
                in <span class="inbox-item-project">${escapeHtml(item.projectTitle)}</span>
                ${item.parentId ? '<span class="inbox-reply-badge">reply</span>' : ''}
              </p>
              <blockquote class="inbox-item-quote">${escapeHtml(item.content)}</blockquote>
              <div class="inbox-item-footer">
                <span class="inbox-item-time">${timeAgo(item.createdAt)}</span>
                <button class="inbox-reply-btn" type="button"
                  data-reply-project="${escapeHtml(item.projectId)}"
                  data-reply-chapter="${escapeHtml(item.chapterId)}"
                  data-reply-parent="${escapeHtml(item.id)}">
                  Reply
                </button>
              </div>
              <div class="inbox-reply-form" id="inbox-reply-${escapeHtml(item.id)}" style="display:none;">
                <textarea class="inbox-reply-input" placeholder="Write a reply…" rows="2"></textarea>
                <div class="inbox-reply-actions">
                  <button class="btn btn-save inbox-reply-submit" type="button"
                    data-submit-project="${escapeHtml(item.projectId)}"
                    data-submit-chapter="${escapeHtml(item.chapterId)}"
                    data-submit-parent="${escapeHtml(item.id)}">
                    Post Reply
                  </button>
                  <button class="btn btn-ghost inbox-reply-cancel" type="button"
                    data-cancel="${escapeHtml(item.id)}">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      }

      return '';
    }).join('');

    feed.style.display = 'grid';

    feed.querySelectorAll('.inbox-reply-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const form = document.getElementById(`inbox-reply-${btn.dataset.replyParent}`);
        if (form) form.style.display = form.style.display === 'none' ? 'grid' : 'none';
      });
    });

    feed.querySelectorAll('.inbox-reply-cancel').forEach((btn) => {
      btn.addEventListener('click', () => {
        const form = document.getElementById(`inbox-reply-${btn.dataset.cancel}`);
        if (form) form.style.display = 'none';
      });
    });

    feed.querySelectorAll('.inbox-reply-submit').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const form = document.getElementById(`inbox-reply-${btn.dataset.submitParent}`);
        const input = form?.querySelector('.inbox-reply-input');
        const body = input?.value.trim();
        if (!body) return;

        btn.disabled = true;
        btn.textContent = 'Posting…';
        try {
          await window.api.inbox.replyToComment({
            supabaseProjectId: btn.dataset.submitProject,
            chapterId: btn.dataset.submitChapter,
            parentId: btn.dataset.submitParent,
            body,
          });
          input.value = '';
          form.style.display = 'none';
          btn.textContent = 'Replied ✓';
          setTimeout(() => { btn.textContent = 'Post Reply'; btn.disabled = false; }, 2000);
        } catch (err) {
          alert(err.message || 'Could not post reply.');
          btn.disabled = false;
          btn.textContent = 'Post Reply';
        }
      });
    });

  } catch (err) {
    loading.textContent = `Could not load activity: ${err?.message || err}`;
  }
});
