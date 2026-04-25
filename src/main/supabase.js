const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY } = require('./supabase-config');

async function restUpsert(path, body, accessToken) {
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=representation',
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || data?.error || 'Supabase upsert failed');
  return data;
}

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
  const existing = await restReq('GET', `projects?local_id=eq.${encodeURIComponent(localId)}&owner_id=eq.${userId}&select=id`, null, accessToken);
  const row = {
    owner_id: userId,
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
  await restReq('DELETE', `published_chapters?project_id=eq.${supabaseProjectId}&chapter_id=eq.${chapterId}`, null, accessToken).catch(() => {});
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

async function clearPublishedChaptersForProject(supabaseProjectId, accessToken) {
  return restReq('DELETE', `published_chapters?project_id=eq.${encodeFilterValue(supabaseProjectId)}`, null, accessToken);
}

async function getPublicProjects(accessToken) {
  const projects = await restReq('GET', 'projects?is_public=eq.true&select=id,local_id,content,owner_id,is_public,updated_at&order=updated_at.desc', null, accessToken);
  if (!projects?.length) return [];

  const ids = projects.map((p) => p.id).join(',');

  const [profiles, chapters] = await Promise.all([
    restReq('GET', `profiles?id=in.(${projects.map((p) => p.owner_id).join(',')})&select=id,username,display_name`, null, accessToken).catch(() => []),
    restReq('GET', `published_chapters?project_id=in.(${ids})&select=id,project_id,chapter_id,chapter_title,content,published_at&order=published_at.asc`, null, accessToken).catch(() => []),
  ]);

  const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  const chaptersByProject = {};
  for (const ch of (chapters || [])) {
    (chaptersByProject[ch.project_id] ||= []).push(ch);
  }

  return projects.map((p) => ({
    ...p,
    profiles: profileMap[p.owner_id] || null,
    published_chapters: chaptersByProject[p.id] || [],
  }));
}

async function getComments(supabaseProjectId, chapterId, accessToken) {
  return restReq('GET', `comments?project_id=eq.${supabaseProjectId}&chapter_ref=eq.${chapterId}&select=id,content,created_at,parent_id,profiles!user_id(username,display_name)&order=created_at.asc`, null, accessToken);
}

async function addComment(userId, supabaseProjectId, chapterId, body, accessToken, parentId = null) {
  const payload = {
    user_id: userId,
    project_id: supabaseProjectId,
    chapter_ref: chapterId,
    content: body,
  };
  if (parentId) payload.parent_id = parentId;
  const rows = await restReq('POST', 'comments', payload, accessToken);
  return rows?.[0] || null;
}

async function getLikes(supabaseProjectId, chapterId, userId, accessToken) {
  const rows = await restReq('GET', `likes?project_id=eq.${supabaseProjectId}&chapter_ref=eq.${encodeURIComponent(chapterId)}&select=id,user_id`, null, accessToken);
  return {
    count: rows?.length || 0,
    likedByMe: userId ? (rows || []).some((r) => r.user_id === userId) : false,
  };
}

async function toggleLike(userId, supabaseProjectId, chapterId, accessToken) {
  const existing = await restReq('GET', `likes?project_id=eq.${supabaseProjectId}&chapter_ref=eq.${encodeURIComponent(chapterId)}&user_id=eq.${userId}&select=id`, null, accessToken);
  if (existing?.length) {
    await restReq('DELETE', `likes?id=eq.${existing[0].id}`, null, accessToken);
    return { liked: false };
  }
  await restReq('POST', 'likes', { user_id: userId, project_id: supabaseProjectId, chapter_ref: chapterId }, accessToken);
  return { liked: true };
}

async function getCommunityPrompts(accessToken) {
  const rows = await restReq(
    'GET',
    'community_prompts?select=id,user_id,genre,plot_point,prompt,target_word_count,created_at,updated_at,profiles!user_id(id,username,display_name)&order=updated_at.desc',
    null,
    accessToken,
  ).catch(() => []);

  return (rows || []).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    genre: row.genre,
    plot_point: row.plot_point,
    prompt: row.prompt,
    target_word_count: Number(row.target_word_count || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
    profiles: row.profiles || null,
  }));
}

async function createCommunityPrompt(userId, prompt, accessToken) {
  const timestamp = new Date().toISOString();
  const rows = await restReq(
    'POST',
    'community_prompts',
    {
      user_id: userId,
      genre: String(prompt?.genre || '').trim(),
      plot_point: String(prompt?.plotPoint || '').trim(),
      prompt: String(prompt?.prompt || '').trim(),
      target_word_count: Number(prompt?.targetWordCount || 0),
      created_at: timestamp,
      updated_at: timestamp,
    },
    accessToken,
  );

  return rows?.[0] || null;
}

async function getPromptFavorites(userId, accessToken) {
  if (!userId) {
    return [];
  }

  const rows = await restReq(
    'GET',
    `community_prompt_favorites?user_id=eq.${encodeFilterValue(userId)}&select=prompt_id`,
    null,
    accessToken,
  ).catch(() => []);

  return (rows || []).map((row) => row.prompt_id).filter(Boolean);
}

async function togglePromptFavorite(userId, promptId, accessToken) {
  const existing = await restReq(
    'GET',
    `community_prompt_favorites?user_id=eq.${encodeFilterValue(userId)}&prompt_id=eq.${encodeFilterValue(promptId)}&select=id&limit=1`,
    null,
    accessToken,
  ).catch(() => []);

  if (existing?.length) {
    await restReq('DELETE', `community_prompt_favorites?id=eq.${encodeFilterValue(existing[0].id)}`, null, accessToken);
    return { favorited: false };
  }

  await restReq(
    'POST',
    'community_prompt_favorites',
    {
      user_id: userId,
      prompt_id: promptId,
      created_at: new Date().toISOString(),
    },
    accessToken,
  );
  return { favorited: true };
}

async function recordCommunityPromptCompletion(userId, completion, accessToken) {
  const promptId = String(completion?.promptId || '').trim();
  const authorId = String(completion?.authorId || '').trim();
  if (!promptId || !authorId || !userId || authorId === userId) {
    return null;
  }

  const rows = await restReq(
    'POST',
    'community_prompt_completions',
    {
      prompt_id: promptId,
      author_id: authorId,
      responder_id: userId,
      project_title: String(completion?.projectTitle || '').trim(),
      chapter_title: String(completion?.chapterTitle || '').trim(),
      word_count: Number(completion?.wordCount || 0),
      created_at: new Date().toISOString(),
    },
    accessToken,
  );

  return rows?.[0] || null;
}

async function getAuthorNotifications(userId, accessToken) {
  const projects = await restReq('GET', `projects?owner_id=eq.${userId}&select=id,content`, null, accessToken).catch(() => []);
  const ids = projects.map((p) => p.id).join(',');
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.content?.title || 'Untitled']));

  const [pubChapters, comments, likes, promptCompletions] = await Promise.all([
    ids
      ? restReq('GET', `published_chapters?project_id=in.(${ids})&select=chapter_id,chapter_title,project_id`, null, accessToken).catch(() => [])
      : Promise.resolve([]),
    ids
      ? restReq('GET', `comments?project_id=in.(${ids})&select=id,content,chapter_ref,created_at,project_id,parent_id,profiles!user_id(id,username,display_name)&order=created_at.desc&limit=40`, null, accessToken).catch(() => [])
      : Promise.resolve([]),
    ids
      ? restReq('GET', `likes?project_id=in.(${ids})&select=id,chapter_ref,created_at,project_id,profiles!user_id(id,username,display_name)&order=created_at.desc&limit=40`, null, accessToken).catch(() => [])
      : Promise.resolve([]),
    restReq(
      'GET',
      `community_prompt_completions?author_id=eq.${encodeFilterValue(userId)}&select=id,prompt_id,project_title,chapter_title,word_count,created_at,community_prompts!prompt_id(prompt,genre,plot_point),profiles!responder_id(id,username,display_name)&order=created_at.desc&limit=40`,
      null,
      accessToken,
    ).catch(() => []),
  ]);

  const chapterMap = {};
  for (const ch of (pubChapters || [])) {
    chapterMap[`${ch.project_id}:${ch.chapter_id}`] = ch.chapter_title;
  }

  const items = [
    ...(comments || []).map((c) => ({
      type: 'comment',
      id: c.id,
      userId: c.profiles?.id || null,
      parentId: c.parent_id || null,
      projectId: c.project_id,
      projectTitle: projectMap[c.project_id] || 'Untitled',
      chapterId: c.chapter_ref,
      chapterTitle: chapterMap[`${c.project_id}:${c.chapter_ref}`] || 'Chapter',
      author: c.profiles?.display_name || c.profiles?.username || 'Anonymous',
      content: c.content,
      createdAt: c.created_at,
    })),
    ...(likes || []).map((l) => ({
      type: 'like',
      id: l.id,
      userId: l.profiles?.id || null,
      projectId: l.project_id,
      projectTitle: projectMap[l.project_id] || 'Untitled',
      chapterId: l.chapter_ref,
      chapterTitle: chapterMap[`${l.project_id}:${l.chapter_ref}`] || 'Chapter',
      author: l.profiles?.display_name || l.profiles?.username || 'Anonymous',
      createdAt: l.created_at,
    })),
    ...(promptCompletions || []).map((entry) => ({
      type: 'prompt',
      id: entry.id,
      userId: entry.profiles?.id || null,
      promptId: entry.prompt_id,
      prompt: entry.community_prompts?.prompt || '',
      genre: entry.community_prompts?.genre || '',
      plotPoint: entry.community_prompts?.plot_point || '',
      projectTitle: entry.project_title || 'Untitled',
      chapterTitle: entry.chapter_title || 'Chapter',
      wordCount: Number(entry.word_count || 0),
      author: entry.profiles?.display_name || entry.profiles?.username || 'Anonymous',
      createdAt: entry.created_at,
    })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return items;
}

function encodeFilterValue(value) {
  return encodeURIComponent(String(value ?? ''));
}

function buildDirectMessagePairKey(leftUserId, rightUserId) {
  return [String(leftUserId || '').trim(), String(rightUserId || '').trim()]
    .filter(Boolean)
    .sort()
    .join('::');
}

function buildMessagePreview(body) {
  return String(body || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

async function ensureConversationParticipant(conversationId, userId, accessToken) {
  const rows = await restReq(
    'GET',
    `conversation_participants?conversation_id=eq.${encodeFilterValue(conversationId)}&user_id=eq.${encodeFilterValue(userId)}&select=id&limit=1`,
    null,
    accessToken,
  );
  if (!rows?.length) {
    throw new Error('You do not have access to this conversation.');
  }
}

async function getProfilesByIds(userIds, accessToken) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) {
    return {};
  }

  const rows = await restReq(
    'GET',
    `profiles?id=in.(${ids.map(encodeFilterValue).join(',')})&select=id,username,display_name`,
    null,
    accessToken,
  ).catch(() => []);

  return Object.fromEntries((rows || []).map((profile) => [profile.id, profile]));
}

async function getInboxConversations(userId, accessToken) {
  const membershipRows = await restReq(
    'GET',
    `conversation_participants?user_id=eq.${encodeFilterValue(userId)}&select=conversation_id`,
    null,
    accessToken,
  ).catch(() => []);

  const conversationIds = [...new Set((membershipRows || []).map((row) => row.conversation_id).filter(Boolean))];
  if (!conversationIds.length) {
    return [];
  }

  const [conversations, participants, unreadMessages] = await Promise.all([
    restReq(
      'GET',
      `conversations?id=in.(${conversationIds.map(encodeFilterValue).join(',')})&select=id,created_at,updated_at,last_message_at,last_message_preview,participant_key`,
      null,
      accessToken,
    ).catch(() => []),
    restReq(
      'GET',
      `conversation_participants?conversation_id=in.(${conversationIds.map(encodeFilterValue).join(',')})&select=conversation_id,user_id,created_at`,
      null,
      accessToken,
    ).catch(() => []),
    restReq(
      'GET',
      `direct_messages?conversation_id=in.(${conversationIds.map(encodeFilterValue).join(',')})&sender_id=neq.${encodeFilterValue(userId)}&read_at=is.null&select=id,conversation_id`,
      null,
      accessToken,
    ).catch(() => []),
  ]);

  const participantUserIds = [...new Set((participants || []).map((row) => row.user_id).filter(Boolean))];
  const profileMap = await getProfilesByIds(participantUserIds, accessToken);

  const participantsByConversation = {};
  for (const participant of (participants || [])) {
    (participantsByConversation[participant.conversation_id] ||= []).push({
      ...participant,
      profile: profileMap[participant.user_id] || null,
    });
  }

  const unreadCountByConversation = {};
  for (const message of (unreadMessages || [])) {
    unreadCountByConversation[message.conversation_id] = (unreadCountByConversation[message.conversation_id] || 0) + 1;
  }

  return (conversations || [])
    .map((conversation) => {
      const threadParticipants = participantsByConversation[conversation.id] || [];
      const otherParticipant = threadParticipants.find((participant) => participant.user_id !== userId) || threadParticipants[0] || null;
      const otherProfile = otherParticipant?.profile || null;
      return {
        id: conversation.id,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        lastMessageAt: conversation.last_message_at || conversation.updated_at || conversation.created_at,
        lastMessagePreview: conversation.last_message_preview || '',
        unreadCount: unreadCountByConversation[conversation.id] || 0,
        otherUser: otherParticipant ? {
          id: otherParticipant.user_id,
          username: otherProfile?.username || '',
          displayName: otherProfile?.display_name || otherProfile?.username || 'Unknown writer',
        } : null,
      };
    })
    .sort((left, right) => new Date(right.lastMessageAt || right.updatedAt || 0) - new Date(left.lastMessageAt || left.updatedAt || 0));
}

async function getConversationMessages(conversationId, userId, accessToken) {
  await ensureConversationParticipant(conversationId, userId, accessToken);

  const rows = await restReq(
    'GET',
    `direct_messages?conversation_id=eq.${encodeFilterValue(conversationId)}&select=id,conversation_id,sender_id,body,created_at,read_at&order=created_at.asc`,
    null,
    accessToken,
  ).catch(() => []);

  const profileMap = await getProfilesByIds((rows || []).map((row) => row.sender_id), accessToken);

  return (rows || []).map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at,
    sender: profileMap[row.sender_id] || null,
  }));
}

async function findOrCreateDirectConversation(currentUserId, otherUserId, accessToken) {
  if (!currentUserId || !otherUserId) {
    throw new Error('Both participants are required.');
  }

  if (currentUserId === otherUserId) {
    throw new Error('You cannot message yourself.');
  }

  const pairKey = buildDirectMessagePairKey(currentUserId, otherUserId);
  const existing = await restReq(
    'GET',
    `conversations?participant_key=eq.${encodeFilterValue(pairKey)}&select=id,created_at,updated_at,last_message_at,last_message_preview,participant_key&limit=1`,
    null,
    accessToken,
  ).catch(() => []);

  if (existing?.length) {
    return existing[0];
  }

  const timestamp = new Date().toISOString();

  try {
    const inserted = await restReq(
      'POST',
      'conversations',
      {
        participant_key: pairKey,
        created_at: timestamp,
        updated_at: timestamp,
        last_message_at: null,
        last_message_preview: '',
      },
      accessToken,
    );

    const conversation = inserted?.[0];
    if (!conversation?.id) {
      throw new Error('Could not create conversation.');
    }

    await restReq(
      'POST',
      'conversation_participants',
      {
        conversation_id: conversation.id,
        user_id: currentUserId,
        created_at: timestamp,
      },
      accessToken,
    );

    await restReq(
      'POST',
      'conversation_participants',
      {
        conversation_id: conversation.id,
        user_id: otherUserId,
        created_at: timestamp,
      },
      accessToken,
    );

    return conversation;
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('duplicate key') || message.includes('unique')) {
      const retry = await restReq(
        'GET',
        `conversations?participant_key=eq.${encodeFilterValue(pairKey)}&select=id,created_at,updated_at,last_message_at,last_message_preview,participant_key&limit=1`,
        null,
        accessToken,
      ).catch(() => []);
      if (retry?.length) {
        return retry[0];
      }
    }
    throw error;
  }
}

async function sendDirectMessage(conversationId, senderId, body, accessToken) {
  const trimmedBody = String(body || '').trim();
  if (!trimmedBody) {
    throw new Error('Message body cannot be empty.');
  }

  await ensureConversationParticipant(conversationId, senderId, accessToken);

  const timestamp = new Date().toISOString();
  const inserted = await restReq(
    'POST',
    'direct_messages',
    {
      conversation_id: conversationId,
      sender_id: senderId,
      body: trimmedBody,
      created_at: timestamp,
    },
    accessToken,
  );

  await restReq(
    'PATCH',
    `conversations?id=eq.${encodeFilterValue(conversationId)}`,
    {
      updated_at: timestamp,
      last_message_at: timestamp,
      last_message_preview: buildMessagePreview(trimmedBody),
    },
    accessToken,
  );

  return inserted?.[0] || null;
}

async function markConversationRead(conversationId, currentUserId, accessToken) {
  await ensureConversationParticipant(conversationId, currentUserId, accessToken);
  return restReq(
    'PATCH',
    `direct_messages?conversation_id=eq.${encodeFilterValue(conversationId)}&sender_id=neq.${encodeFilterValue(currentUserId)}&read_at=is.null`,
    { read_at: new Date().toISOString() },
    accessToken,
  ).catch(() => []);
}

async function getUserProjects(userId, accessToken) {
  const rows = await restReq(
    'GET',
    `user_projects?user_id=eq.${userId}&select=id,data,updated_at&order=updated_at.desc`,
    null,
    accessToken,
  );
  return (rows || []).map((row) => ({
    ...row.data,
    id: row.id,
    updatedAt: row.updated_at || row.data?.updatedAt,
  }));
}

async function saveUserProject(projectId, userId, projectData, accessToken) {
  const now = new Date().toISOString();
  await restUpsert('user_projects', {
    id: projectId,
    user_id: userId,
    data: projectData,
    updated_at: now,
    created_at: projectData.createdAt || now,
  }, accessToken);
}

async function deleteUserProject(projectId, userId, accessToken) {
  return restReq(
    'DELETE',
    `user_projects?id=eq.${encodeURIComponent(projectId)}&user_id=eq.${encodeURIComponent(userId)}`,
    null,
    accessToken,
  );
}

module.exports = {
  getProfile,
  updateProfile,
  upsertProject,
  publishChapter,
  unpublishChapter,
  getPublishedChapters,
  clearPublishedChaptersForProject,
  getPublicProjects,
  getCommunityPrompts,
  createCommunityPrompt,
  getComments,
  addComment,
  getLikes,
  toggleLike,
  getPromptFavorites,
  togglePromptFavorite,
  recordCommunityPromptCompletion,
  getAuthorNotifications,
  getInboxConversations,
  getConversationMessages,
  findOrCreateDirectConversation,
  sendDirectMessage,
  markConversationRead,
  getUserProjects,
  saveUserProject,
  deleteUserProject,
};
