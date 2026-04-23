window.registerPageInit('sharing', async function () {
  const list = document.getElementById('sharing-list');
  const empty = document.getElementById('sharing-empty');
  const status = document.getElementById('sharing-status');

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  let currentProject = window.getCurrentProject?.() || null;

  function getMergedProjects(projects = []) {
    if (!currentProject?.id) {
      return projects;
    }

    return projects.map((project) => {
      if (project.id !== currentProject.id) {
        return project;
      }

      const currentUpdatedAt = new Date(currentProject.updatedAt || 0).getTime();
      const projectUpdatedAt = new Date(project.updatedAt || 0).getTime();
      return currentUpdatedAt >= projectUpdatedAt ? { ...project, ...currentProject } : project;
    });
  }

  const projects = getMergedProjects(await window.api.getAllProjects().catch(() => []));

  if (!projects.length) {
    empty.style.display = 'block';
    return;
  }

  list.innerHTML = projects.map((p) => `
    <div class="sharing-row ui-card ui-card-stack" data-project-id="${escapeHtml(p.id)}">
      <div class="ui-card-head">
        <div class="ui-card-copy">
          <p class="ui-card-kicker">${escapeHtml((p.genres || []).join(' x ') || 'No genre')}</p>
          <h2 class="ui-card-title">${escapeHtml(p.title || 'Untitled')}</h2>
        </div>
        <div class="sharing-row-actions">
          <span class="sharing-badge ${p.isPublic ? 'is-public' : 'is-private'}">
            ${p.isPublic ? 'Public' : 'Private'}
          </span>
          <button
            class="btn btn-ghost sharing-toggle-btn"
            type="button"
            data-project-id="${escapeHtml(p.id)}"
            data-is-public="${p.isPublic ? 'true' : 'false'}"
          >
            ${p.isPublic ? 'Make Private' : 'Make Public'}
          </button>
        </div>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.sharing-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const projectId = btn.dataset.projectId;
      const currentlyPublic = btn.dataset.isPublic === 'true';
      const nextPublic = !currentlyPublic;

      btn.disabled = true;
      try {
        const allProjects = getMergedProjects(await window.api.getAllProjects());
        const project = allProjects.find((p) => p.id === projectId);
        if (!project) return;

        project.isPublic = nextPublic;
        const savedProject = await window.api.saveProject(project);
        if (currentProject?.id === savedProject?.id) {
          currentProject = savedProject;
          window.setCurrentProject(savedProject);
        }

        // Update UI
        btn.dataset.isPublic = String(nextPublic);
        btn.textContent = nextPublic ? 'Make Private' : 'Make Public';
        const row = btn.closest('.sharing-row');
        const badge = row ? row.querySelector('.sharing-badge') : null;
        if (!badge) return;
        badge.textContent = nextPublic ? 'Public' : 'Private';
        badge.className = `sharing-badge ${nextPublic ? 'is-public' : 'is-private'}`;
        if (status) {
          status.textContent = nextPublic ? 'Project is now Public' : 'Project is now Private';
          status.classList.remove('is-error');
        }
      } catch (err) {
        if (status) {
          status.textContent = err.message || 'Failed to update visibility.';
          status.classList.add('is-error');
        }
        alert(err.message || 'Failed to update visibility.');
      } finally {
        btn.disabled = false;
      }
    });
  });
});
