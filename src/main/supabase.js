const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY } = require('./supabase-config');

async function restReq(method, path, body, accessToken) {
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || data?.error || 'Supabase request failed');
  }
  return data;
}

async function getProfile(userId, accessToken) {
  const rows = await restReq('GET', `profiles?id=eq.${userId}&select=*`, null, accessToken);
  return rows?.[0] || null;
}

async function updateProfile(userId, updates, accessToken) {
  const rows = await restReq('PATCH', `profiles?id=eq.${userId}`, updates, accessToken);
  return rows?.[0] || null;
}

async function upsertProject(localId, userId, projectContent, isPublic, accessToken) {
  const existing = await restReq('GET', `projects?local_id=eq.${encodeURIComponent(localId)}&user_id=eq.${userId}&select=id`, null, accessToken);
  const row = {
    user_id: userId,
    local_id: localId,
    content: projectContent,
    is_public: isPublic,
    updated_at: new Date().toISOString(),
  };

  if (existing?.length) {
    const rows = await restReq('PATCH', `projects?id=eq.${existing[0].id}`, row, accessToken);
    return rows?.[0] || existing[0];
  }

  const rows = await restReq('POST', 'projects', { ...row, created_at: new Date().toISOString() }, accessToken);
  return rows?.[0] || null;
}

async function publishChapter(supabaseProjectId, chapterId, chapterTitle, content, accessToken) {
  const rows = await restReq('POST', 'published_chapters', {
    project_id: supabaseProjectId,
    chapter_id: chapterId,
    chapter_title: chapterTitle,
    content,
    published_at: new Date().toISOString(),
  }, accessToken);
  return rows?.[0] || null;
}

async function unpublishChapter(supabaseProjectId, chapterId, accessToken) {
  return restReq('DELETE', `published_chapters?project_id=eq.${supabaseProjectId}&chapter_id=eq.${chapterId}`, null, accessToken);
}

async function getPublishedChapters(supabaseProjectId, accessToken) {
  return restReq('GET', `published_chapters?project_id=eq.${supabaseProjectId}&select=*&order=published_at.asc`, null, accessToken);
}

async function getPublicProjects(accessToken) {
  return restReq('GET', 'projects?is_public=eq.true&select=*,profiles(username,display_name,avatar_url),published_chapters(id,chapter_id,chapter_title,published_at)&order=updated_at.desc', null, accessToken);
}

async function getComments(supabaseProjectId, chapterId, accessToken) {
  return restReq('GET', `comments?project_id=eq.${supabaseProjectId}&chapter_id=eq.${chapterId}&select=*,profiles(username,display_name,avatar_url)&order=created_at.asc`, null, accessToken);
}

async function addComment(userId, supabaseProjectId, chapterId, body, accessToken) {
  const rows = await restReq('POST', 'comments', {
    user_id: userId,
    project_id: supabaseProjectId,
    chapter_id: chapterId,
    body,
  }, accessToken);
  return rows?.[0] || null;
}

module.exports = {
  getProfile,
  updateProfile,
  upsertProject,
  publishChapter,
  unpublishChapter,
  getPublishedChapters,
  getPublicProjects,
  getComments,
  addComment,
};
