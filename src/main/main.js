const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const Store = require('electron-store');
const { setApplicationMenu, buildTextContextMenu } = require('./menu');
const packageJson = require('../../package.json');
const { signIn, signUp, refreshSession, signOut } = require('./auth');
const {
  getProfile, updateProfile,
  upsertProject, publishChapter, unpublishChapter, getPublishedChapters,
  getPublicProjects, getComments, addComment,
  getLikes, toggleLike, getAuthorNotifications,
  getInboxConversations, getConversationMessages,
  findOrCreateDirectConversation, sendDirectMessage, markConversationRead,
  getUserProjects, saveUserProject, deleteUserProject,
} = require('./supabase');


const store = new Store();
let mainWindow;
const PROJECT_BACKUP_LIMIT = 15;

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRtf(value = '') {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\u2018|\u2019/g, (c) => `\\u${c.charCodeAt(0)}?`)
    .replace(/\u201c|\u201d/g, (c) => `\\u${c.charCodeAt(0)}?`)
    .replace(/\u2013/g, '\\u8211?')
    .replace(/\u2014/g, '\\u8212?')
    .replace(/\u2026/g, '\\u8230?')
    .replace(/[\u0080-\uffff]/g, (c) => `\\u${c.charCodeAt(0)}?`)
    .replace(/\r?\n/g, '\\par\n');
}

function richTextToPlainText(value = '') {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function richTextToHtml(value = '') {
  const raw = String(value || '').trim();
  if (!raw) {
    return '<p>[No chapter text yet]</p>';
  }

  const rootMatch = raw.match(/^<div[^>]*data-editor-root="true"[^>]*>([\s\S]*)<\/div>$/i);
  if (rootMatch) {
    return rootMatch[1] || '<p>[No chapter text yet]</p>';
  }

  if (/<[a-z][\s\S]*>/i.test(raw)) {
    return raw;
  }

  return `<p>${escapeHtml(raw).replace(/\n/g, '<br>')}</p>`;
}

function buildOrderedChapters(project = {}) {
  return (project.chapters || [])
    .map((chapter, index) => {
      const title = String(chapter.title || '').trim();
      const match = title.match(/chapter\s+(\d+)/i);
      return {
        ...chapter,
        title,
        __index: index,
        __chapterNumber: match ? Number(match[1]) : Number.POSITIVE_INFINITY,
      };
    })
    .sort((left, right) => {
      if (left.__chapterNumber !== right.__chapterNumber) {
        return left.__chapterNumber - right.__chapterNumber;
      }

      return left.__index - right.__index;
    });
}

function buildExportDocument(project = {}) {
  const title = String(project.title || 'Untitled Project').trim();
  const subtitle = String(project.subtitle || '').trim();
  const authorName = String(project.authorName || packageJson.author || '').trim();
  const chapters = buildOrderedChapters(project);

  const frontMatter = [title];
  if (subtitle) {
    frontMatter.push(subtitle);
  }
  if (authorName) {
    frontMatter.push(`by ${authorName}`);
  }

  const chapterBlocks = chapters.map((chapter, index) => {
    const heading = chapter.title || `Chapter ${index + 1}`;
    const body = richTextToPlainText(chapter.content || '') || '[No chapter text yet]';
    const htmlBody = richTextToHtml(chapter.content || '');
    return {
      heading,
      body,
      htmlBody,
    };
  });

  const textParts = [
    frontMatter.join('\n'),
    chapterBlocks.length
      ? chapterBlocks.map((chapter) => `${chapter.heading}\n\n${chapter.body}`).join('\n\n\n')
      : 'No chapters have been written yet.',
  ];

  const text = textParts.filter(Boolean).join('\n\n\n');

  const rtfBody = [
    '{\\rtf1\\ansi\\ansicpg1252\\uc1\\deff0',
    `{\\b\\fs40 ${escapeRtf(title)}}\\par`,
    subtitle ? `\\par {\\i\\fs28 ${escapeRtf(subtitle)}}\\par` : '',
    authorName ? `\\par ${escapeRtf(`by ${authorName}`)}\\par` : '',
    '\\par',
    chapterBlocks.length
      ? chapterBlocks.map((chapter) => `\\b\\fs32 ${escapeRtf(chapter.heading)}\\b0\\fs24\\par\\par ${escapeRtf(chapter.body)}\\par\\par`).join('\n')
      : `${escapeRtf('No chapters have been written yet.')}\\par`,
    '}',
  ].filter(Boolean).join('\n');

  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body {
            font-family: Georgia, "Times New Roman", serif;
            color: #2f261f;
            margin: 56px;
            line-height: 1.65;
          }
          .front-matter {
            text-align: center;
            margin-bottom: 56px;
          }
          h1 {
            font-size: 28px;
            margin: 0 0 10px;
          }
          .subtitle {
            font-size: 18px;
            font-style: italic;
            margin: 0 0 8px;
          }
          .author {
            font-size: 16px;
            margin: 0;
          }
          .chapter {
            page-break-inside: avoid;
            margin-bottom: 36px;
          }
          .chapter h2 {
            font-size: 20px;
            margin: 0 0 14px;
          }
          .chapter p {
            white-space: pre-wrap;
            margin: 0;
          }
        </style>
      </head>
      <body>
        <section class="front-matter">
          <h1>${escapeHtml(title)}</h1>
          ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ''}
          ${authorName ? `<p class="author">by ${escapeHtml(authorName)}</p>` : ''}
        </section>
        ${chapterBlocks.length
          ? chapterBlocks.map((chapter) => `
            <section class="chapter">
              <h2>${escapeHtml(chapter.heading)}</h2>
              <div>${chapter.htmlBody}</div>
            </section>
          `).join('')
          : '<p>No chapters have been written yet.</p>'}
      </body>
    </html>
  `;

  return {
    title,
    text,
    rtf: rtfBody,
    html: htmlBody,
  };
}

function normalizeProjectSaveRequest(payload) {
  if (payload && payload.project) {
    return {
      project: payload.project,
      options: payload.options || {},
    };
  }

  return {
    project: payload,
    options: {},
  };
}

function cloneProjectSnapshot(project) {
  return JSON.parse(JSON.stringify(project || null));
}

function mergeProjectRecord(existingProject = {}, incomingProject = {}, dirtyFields = []) {
  const normalizedDirtyFields = [...new Set((dirtyFields || []).filter(Boolean))];
  const nextProject = { ...existingProject };
  const keysToApply = normalizedDirtyFields.length
    ? normalizedDirtyFields
    : Object.keys(incomingProject).filter((key) => !['id', 'createdAt', 'updatedAt'].includes(key));

  keysToApply.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(incomingProject, key)) {
      nextProject[key] = incomingProject[key];
    }
  });

  nextProject.id = incomingProject.id || existingProject.id;
  nextProject.createdAt = existingProject.createdAt || incomingProject.createdAt || new Date().toISOString();
  nextProject.updatedAt = incomingProject.updatedAt || new Date().toISOString();

  return nextProject;
}

function recordProjectBackup(projectId, projectSnapshot) {
  if (!projectId || !projectSnapshot) {
    return;
  }

  const backups = store.get('projectBackups', {});
  const projectBackups = Array.isArray(backups[projectId]) ? backups[projectId] : [];
  projectBackups.unshift({
    savedAt: new Date().toISOString(),
    project: cloneProjectSnapshot(projectSnapshot),
  });
  backups[projectId] = projectBackups.slice(0, PROJECT_BACKUP_LIMIT);
  store.set('projectBackups', backups);
}

async function writeProjectExport(project, targetPath, format) {
  const document = buildExportDocument(project);

  if (format === 'txt') {
    await fs.writeFile(targetPath, document.text, 'utf8');
    return;
  }

  if (format === 'doc') {
    await fs.writeFile(targetPath, document.rtf, 'utf8');
    return;
  }

  if (format === 'pdf') {
    const exportWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
      },
    });

    try {
      await exportWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(document.html)}`);
      const pdfBuffer = await exportWindow.webContents.printToPDF({
        printBackground: true,
        pageSize: 'Letter',
        margins: {
          top: 0.5,
          bottom: 0.5,
          left: 0.5,
          right: 0.5,
        },
      });
      await fs.writeFile(targetPath, pdfBuffer);
    } finally {
      if (!exportWindow.isDestroyed()) {
        exportWindow.close();
      }
    }
  }
}

async function loadPromptDataBundle() {
  const [genrePrompts, specificPrompts, hybridGuides] = await Promise.all([
    fs.readFile(path.join(__dirname, '../data/prompts/genre_prompts.json'), 'utf8').then(JSON.parse),
    fs.readFile(path.join(__dirname, '../data/prompts/specific_genre_prompts.json'), 'utf8').then(JSON.parse),
    fs.readFile(path.join(__dirname, '../data/defaults/hybrid_genres.json'), 'utf8').then(JSON.parse),
  ]);

  return {
    genrePrompts,
    specificPrompts,
    hybridGuides,
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#faf7f2',
    icon: path.join(__dirname, '../../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  mainWindow.webContents.session.setSpellCheckerLanguages(['en-US']);
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.setZoomLevel(0);
    mainWindow.webContents.setZoomFactor(1.0);
  });
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.webContents.on('context-menu', (event, params) => {
    buildTextContextMenu(mainWindow, params).popup({
      window: mainWindow,
    });
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  setApplicationMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC: Projects
ipcMain.handle('projects:getAll', async () => {
  const session = await getValidSession().catch(() => null);

  if (!session) {
    return store.get('projects', []);
  }

  try {
    const [cloudProjects, localProjects] = await Promise.all([
      getUserProjects(session.user.id, session.access_token),
      Promise.resolve(store.get('projects', [])),
    ]);

    // Merge: prefer whichever copy has a newer updatedAt
    const merged = new Map();
    for (const p of localProjects) {
      merged.set(p.id, p);
    }
    for (const p of cloudProjects) {
      const existing = merged.get(p.id);
      if (!existing || new Date(p.updatedAt || 0) >= new Date(existing.updatedAt || 0)) {
        merged.set(p.id, p);
      }
    }

    const mergedList = Array.from(merged.values());

    // Upload local projects not yet in the cloud (first-run migration + offline writes)
    const cloudIds = new Set(cloudProjects.map((p) => p.id));
    localProjects
      .filter((p) => !cloudIds.has(p.id))
      .forEach((p) => {
        saveUserProject(p.id, session.user.id, p, session.access_token)
          .catch((err) => console.warn('[cloud] Migration upload failed for', p.id, err.message));
      });

    store.set('projects', mergedList);
    return mergedList;
  } catch (err) {
    console.warn('[cloud] Failed to fetch projects, using local cache:', err.message);
    return store.get('projects', []);
  }
});

ipcMain.handle('projects:getCurrentId', () => store.get('currentProjectId', null));
ipcMain.handle('projects:setCurrentId', (_, projectId) => {
  if (projectId) {
    store.set('currentProjectId', projectId);
    return projectId;
  }

  store.delete('currentProjectId');
  return null;
});

ipcMain.handle('projects:save', async (_, payload) => {
  const { project, options } = normalizeProjectSaveRequest(payload);
  const dirtyFields = options?.dirtyFields || [];
  const projects = store.get('projects', []);
  const index = projects.findIndex((entry) => entry.id === project.id);

  let mergedProject;
  if (index >= 0) {
    const existingProject = projects[index];
    mergedProject = mergeProjectRecord(existingProject, project, dirtyFields);

    if (JSON.stringify(existingProject) !== JSON.stringify(mergedProject)) {
      recordProjectBackup(project.id, existingProject);
    }

    projects[index] = mergedProject;
    store.set('projects', projects);
    if (store.get('currentProjectId') === mergedProject.id) {
      store.set('currentProjectId', mergedProject.id);
    }
  } else {
    mergedProject = project;
    projects.push(project);
    store.set('projects', projects);
    if (!store.get('currentProjectId')) {
      store.set('currentProjectId', project.id);
    }
  }

  // Push to cloud without blocking the response
  getValidSession()
    .then((session) => {
      if (!session) return;
      return saveUserProject(mergedProject.id, session.user.id, mergedProject, session.access_token);
    })
    .catch((err) => console.warn('[cloud] Save sync failed:', err.message));

  return mergedProject;
});

ipcMain.handle('projects:delete', async (_, id) => {
  const projects = store.get('projects', []).filter((project) => project.id !== id);
  store.set('projects', projects);
  if (store.get('currentProjectId') === id) {
    if (projects.length) {
      store.set('currentProjectId', projects[0].id);
    } else {
      store.delete('currentProjectId');
    }
  }

  // Remove from cloud without blocking
  getValidSession()
    .then((session) => {
      if (!session) return;
      return deleteUserProject(id, session.user.id, session.access_token);
    })
    .catch((err) => console.warn('[cloud] Delete sync failed:', err.message));
});

ipcMain.handle('projects:exportManuscript', async (_, project) => {
  const safeTitle = String(project?.title || 'book-buddy-manuscript')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim() || 'book-buddy-manuscript';
  const defaultPath = path.join(app.getPath('documents'), `${safeTitle}.pdf`);
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Manuscript',
    defaultPath,
    filters: [
      { name: 'PDF Document', extensions: ['pdf'] },
      { name: 'Word Document', extensions: ['doc'] },
      { name: 'Text File', extensions: ['txt'] },
    ],
  });

  if (canceled || !filePath) {
    return { canceled: true };
  }

  const extension = path.extname(filePath).slice(1).toLowerCase();
  const format = ['pdf', 'doc', 'txt'].includes(extension) ? extension : 'pdf';
  const finalPath = extension ? filePath : `${filePath}.${format}`;

  await writeProjectExport(project, finalPath, format);

  return {
    canceled: false,
    filePath: finalPath,
    format,
  };
});

ipcMain.handle('projects:exportBackup', async (_, project) => {
  const safeTitle = String(project?.title || 'book-buddy-project')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, '-')
    .trim() || 'book-buddy-project';
  const defaultPath = path.join(app.getPath('documents'), `${safeTitle}.bbproject`);
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export BookBuddy Project for Safe Keeping',
    defaultPath,
    filters: [{ name: 'BookBuddy Project', extensions: ['bbproject'] }],
  });
  if (canceled || !filePath) return { canceled: true };
  const finalPath = filePath.endsWith('.bbproject') ? filePath : `${filePath}.bbproject`;
  await fs.writeFile(finalPath, JSON.stringify(project, null, 2), 'utf8');
  return { canceled: false, filePath: finalPath };
});

ipcMain.handle('projects:importBackup', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import BookBuddy Project',
    filters: [
      { name: 'BookBuddy Project', extensions: ['bbproject'] },
      { name: 'JSON', extensions: ['json'] },
    ],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return { canceled: true };
  const raw = await fs.readFile(filePaths[0], 'utf8');
  let project;
  try {
    project = JSON.parse(raw);
  } catch {
    throw new Error('Could not read the file — it may be corrupted or not a valid BookBuddy project.');
  }
  if (!project || typeof project !== 'object' || !project.id || !project.title) {
    throw new Error('This file doesn\'t look like a valid BookBuddy project.');
  }
  return { canceled: false, project };
});

ipcMain.handle('data:getPromptData', async () => loadPromptDataBundle());

// IPC: Settings
ipcMain.handle('settings:get', () => store.get('settings', { tier: 'beta' }));
ipcMain.handle('settings:save', (_, settings) => {
  const nextSettings = {
    ...store.get('settings', { tier: 'beta' }),
    ...settings,
  };

  store.set('settings', nextSettings);
  return nextSettings;
});

// IPC: Auth
ipcMain.handle('auth:getSession', () => {
  return store.get('auth.session', null);
});

ipcMain.handle('auth:login', async (_, { email, password }) => {
  const session = await signIn(email, password);
  store.set('auth.session', session);
  return session;
});

ipcMain.handle('auth:refresh', async () => {
  const session = store.get('auth.session', null);
  if (!session?.refresh_token) throw new Error('No session to refresh.');
  const next = await refreshSession(session.refresh_token);
  store.set('auth.session', next);
  return next;
});

ipcMain.handle('auth:logout', async () => {
  const session = store.get('auth.session', null);
  if (session?.access_token) await signOut(session.access_token);
  store.delete('auth.session');
});

ipcMain.handle('auth:signup', async (_, { email, password, username }) => {
  const result = await signUp(email, password, username);
  if (result.session) {
    store.set('auth.session', result.session);
  }
  return result;
});

// IPC: Profile
function getSession() {
  return store.get('auth.session', null);
}

async function getValidSession() {
  const session = getSession();
  if (!session) return null;

  const expiresAt = session.expires_at;
  const nowSecs = Math.floor(Date.now() / 1000);
  if (expiresAt && nowSecs < expiresAt - 60) return session;

  if (!session.refresh_token) return null;
  try {
    const next = await refreshSession(session.refresh_token);
    store.set('auth.session', next);
    return next;
  } catch {
    store.delete('auth.session');
    return null;
  }
}

ipcMain.handle('profile:get', async () => {
  const session = await getValidSession();
  if (!session) throw new Error('Not authenticated.');
  return getProfile(session.user.id, session.access_token);
});

ipcMain.handle('profile:update', async (_, updates) => {
  const session = await getValidSession();
  if (!session) throw new Error('Not authenticated.');
  return updateProfile(session.user.id, updates, session.access_token);
});

// IPC: Publishing
ipcMain.handle('chapters:publishChapter', async (_, { projectLocalId, projectContent, isPublic, chapter }) => {
  const session = await getValidSession();
  if (!session) throw new Error('Not authenticated.');
  const userId = session.user.id;
  const token = session.access_token;

  const project = await upsertProject(projectLocalId, userId, projectContent, isPublic, token);
  if (!project?.id) throw new Error('Failed to sync project.');

  store.set(`publishing.${projectLocalId}`, project.id);

  const published = await publishChapter(project.id, chapter.id, chapter.title, chapter.content, token);
  return { supabaseProjectId: project.id, published };
});

ipcMain.handle('chapters:unpublishChapter', async (_, { projectLocalId, chapterId }) => {
  const session = await getValidSession();
  if (!session) throw new Error('Not authenticated.');
  const supabaseProjectId = store.get(`publishing.${projectLocalId}`);
  if (!supabaseProjectId) return null;
  return unpublishChapter(supabaseProjectId, chapterId, session.access_token);
});

ipcMain.handle('chapters:getPublished', async (_, { projectLocalId }) => {
  const session = await getValidSession();
  if (!session) return [];
  const supabaseProjectId = store.get(`publishing.${projectLocalId}`);
  if (!supabaseProjectId) return [];
  return getPublishedChapters(supabaseProjectId, session.access_token);
});

// IPC: Community
ipcMain.handle('community:getProjects', async () => {
  try {
    const session = await getValidSession();
    return await getPublicProjects(session?.access_token);
  } catch (err) {
    if (err?.message?.includes('infinite recursion') || err?.message?.includes('JWT')) {
      return getPublicProjects(null);
    }
    throw err;
  }
});

ipcMain.handle('community:getComments', async (_, { projectLocalId, chapterId }) => {
  const session = await getValidSession();
  if (!session) return [];
  const supabaseProjectId = store.get(`publishing.${projectLocalId}`);
  if (!supabaseProjectId) return [];
  return getComments(supabaseProjectId, chapterId, session.access_token);
});

ipcMain.handle('community:addComment', async (_, { projectLocalId, chapterId, body }) => {
  const session = await getValidSession();
  if (!session) throw new Error('Not authenticated.');
  const supabaseProjectId = store.get(`publishing.${projectLocalId}`);
  if (!supabaseProjectId) throw new Error('Project not found.');
  return addComment(session.user.id, supabaseProjectId, chapterId, body, session.access_token);
});

ipcMain.handle('community:getChapterComments', async (_, { supabaseProjectId, chapterId }) => {
  const session = await getValidSession();
  return getComments(supabaseProjectId, chapterId, session?.access_token);
});

ipcMain.handle('community:addChapterComment', async (_, { supabaseProjectId, chapterId, body, parentId }) => {
  const session = await getValidSession();
  if (!session) throw new Error('Sign in to leave a comment.');
  return addComment(session.user.id, supabaseProjectId, chapterId, body, session.access_token, parentId || null);
});

ipcMain.handle('community:getLikes', async (_, { supabaseProjectId, chapterId }) => {
  const session = await getValidSession();
  return getLikes(supabaseProjectId, chapterId, session?.user?.id || null, session?.access_token);
});

ipcMain.handle('community:toggleLike', async (_, { supabaseProjectId, chapterId }) => {
  const session = await getValidSession();
  if (!session) throw new Error('Sign in to like chapters.');
  return toggleLike(session.user.id, supabaseProjectId, chapterId, session.access_token);
});

ipcMain.handle('community:getFavorites', () => {
  return store.get('favorites', []);
});

ipcMain.handle('community:toggleFavorite', (_, { supabaseProjectId }) => {
  const favorites = store.get('favorites', []);
  const idx = favorites.indexOf(supabaseProjectId);
  if (idx === -1) {
    favorites.push(supabaseProjectId);
  } else {
    favorites.splice(idx, 1);
  }
  store.set('favorites', favorites);
  return { favorited: idx === -1 };
});

ipcMain.handle('inbox:getNotifications', async () => {
  const session = await getValidSession();
  if (!session) return [];
  return getAuthorNotifications(session.user.id, session.access_token);
});

ipcMain.handle('inbox:replyToComment', async (_, { supabaseProjectId, chapterId, parentId, body }) => {
  const session = await getValidSession();
  if (!session) throw new Error('Sign in to reply.');
  return addComment(session.user.id, supabaseProjectId, chapterId, body, session.access_token, parentId);
});

ipcMain.handle('inbox:getDirectConversations', async () => {
  const session = await getValidSession();
  if (!session) return [];
  return getInboxConversations(session.user.id, session.access_token);
});

ipcMain.handle('inbox:getConversationMessages', async (_, { conversationId }) => {
  const session = await getValidSession();
  if (!session) throw new Error('Sign in to view messages.');
  return getConversationMessages(conversationId, session.user.id, session.access_token);
});

ipcMain.handle('inbox:findOrCreateConversation', async (_, { otherUserId }) => {
  const session = await getValidSession();
  if (!session) throw new Error('Sign in to message writers.');
  return findOrCreateDirectConversation(session.user.id, otherUserId, session.access_token);
});

ipcMain.handle('inbox:sendDirectMessage', async (_, { conversationId, body }) => {
  const session = await getValidSession();
  if (!session) throw new Error('Sign in to send a message.');
  return sendDirectMessage(conversationId, session.user.id, body, session.access_token);
});

ipcMain.handle('inbox:markConversationRead', async (_, { conversationId }) => {
  const session = await getValidSession();
  if (!session) throw new Error('Sign in to update messages.');
  return markConversationRead(conversationId, session.user.id, session.access_token);
});
