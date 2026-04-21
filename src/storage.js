export async function listBoards(env) {
  const listed = await env.BUCKET.list({ prefix: 'boards/', delimiter: '/' });
  const boards = [];
  for (const prefix of listed.delimitedPrefixes || []) {
    const slug = prefix.replace('boards/', '').replace('/', '');
    const metaObj = await env.BUCKET.get(`boards/${slug}/_meta.json`);
    if (metaObj) {
      const meta = await metaObj.json();
      boards.push({ slug, ...meta });
    }
  }
  return boards;
}

export async function getBoard(env, slug) {
  const metaObj = await env.BUCKET.get(`boards/${slug}/_meta.json`);
  if (!metaObj) return null;
  const meta = await metaObj.json();
  return { slug, ...meta };
}

export async function createBoard(env, { name, description }) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const existing = await env.BUCKET.get(`boards/${slug}/_meta.json`);
  if (existing) return { error: 'Board already exists', status: 409 };

  const meta = { name, description: description || '', created: new Date().toISOString() };
  await env.BUCKET.put(`boards/${slug}/_meta.json`, JSON.stringify(meta));
  return { slug, ...meta };
}

export async function updateBoard(env, slug, updates) {
  const existing = await getBoard(env, slug);
  if (!existing) return { error: 'Board not found', status: 404 };

  const { slug: _slug, ...meta } = existing;
  if (updates.name !== undefined) meta.name = updates.name;
  if (updates.description !== undefined) meta.description = updates.description;

  await env.BUCKET.put(`boards/${slug}/_meta.json`, JSON.stringify(meta));
  return { slug, ...meta };
}

export async function deleteBoard(env, slug) {
  // Delete all objects under boards/{slug}/
  let cursor;
  do {
    const listed = await env.BUCKET.list({ prefix: `boards/${slug}/`, cursor });
    for (const obj of listed.objects) {
      await env.BUCKET.delete(obj.key);
    }
    cursor = listed.truncated ? listed.cursor : null;
  } while (cursor);
  return { ok: true };
}

export async function listTasks(env, boardSlug, stageFilter) {
  const prefix = `boards/${boardSlug}/tasks/`;
  const listed = await env.BUCKET.list({ prefix, delimiter: '/' });
  const tasks = [];

  for (const pfx of listed.delimitedPrefixes || []) {
    const taskId = pfx.replace(prefix, '').replace('/', '');
    const taskObj = await env.BUCKET.get(`${pfx}task.md`);
    if (taskObj) {
      const text = await taskObj.text();
      const parsed = parseFrontmatter(text);
      if (stageFilter && parsed.meta.stage !== stageFilter) continue;
      tasks.push({ id: taskId, ...parsed.meta, content: parsed.body });
    }
  }

  // Sort by position (ascending), fall back to created date
  tasks.sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));
  return tasks;
}

export async function getTask(env, boardSlug, taskId) {
  const key = `boards/${boardSlug}/tasks/${taskId}/task.md`;
  const obj = await env.BUCKET.get(key);
  if (!obj) return null;
  const text = await obj.text();
  const parsed = parseFrontmatter(text);
  return { id: taskId, ...parsed.meta, content: parsed.body };
}

export async function createTask(env, boardSlug, { title, content, stage, priority, position, assignee }) {
  const board = await getBoard(env, boardSlug);
  if (!board) return { error: 'Board not found', status: 404 };

  const taskId = generateId();
  const now = new Date().toISOString();
  const meta = {
    title,
    stage: stage || 'backlog',
    created: now,
    updated: now,
    priority: priority || 'medium',
    position: typeof position === 'number' ? position : Date.now(),
    assignee: assignee || 'unassigned',
  };

  const md = buildFrontmatter(meta) + '\n' + (content || '');
  await env.BUCKET.put(`boards/${boardSlug}/tasks/${taskId}/task.md`, md);
  return { id: taskId, ...meta, content: content || '' };
}

export async function updateTask(env, boardSlug, taskId, updates) {
  const existing = await getTask(env, boardSlug, taskId);
  if (!existing) return { error: 'Task not found', status: 404 };

  const { content: existingContent, id, ...existingMeta } = existing;
  const newMeta = { ...existingMeta };

  if (updates.title !== undefined) newMeta.title = updates.title;
  if (updates.stage !== undefined) newMeta.stage = updates.stage;
  if (updates.priority !== undefined) newMeta.priority = updates.priority;
  if (updates.position !== undefined) newMeta.position = updates.position;
  if (updates.assignee !== undefined) newMeta.assignee = updates.assignee;
  newMeta.updated = new Date().toISOString();

  const newContent = updates.content !== undefined ? updates.content : existingContent;
  const md = buildFrontmatter(newMeta) + '\n' + newContent;
  await env.BUCKET.put(`boards/${boardSlug}/tasks/${taskId}/task.md`, md);
  return { id: taskId, ...newMeta, content: newContent };
}

export async function deleteTask(env, boardSlug, taskId) {
  const prefix = `boards/${boardSlug}/tasks/${taskId}/`;
  let cursor;
  do {
    const listed = await env.BUCKET.list({ prefix, cursor });
    for (const obj of listed.objects) {
      await env.BUCKET.delete(obj.key);
    }
    cursor = listed.truncated ? listed.cursor : null;
  } while (cursor);
  return { ok: true };
}

export async function listUpdates(env, boardSlug, taskId) {
  const prefix = `boards/${boardSlug}/tasks/${taskId}/updates/`;
  const listed = await env.BUCKET.list({ prefix });
  const updates = [];

  for (const obj of listed.objects) {
    const fileObj = await env.BUCKET.get(obj.key);
    if (fileObj) {
      const text = await fileObj.text();
      const parsed = parseFrontmatter(text);
      const filename = obj.key.split('/').pop().replace('.md', '');
      updates.push({ id: filename, ...parsed.meta, content: parsed.body });
    }
  }

  updates.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return updates;
}

export async function createUpdate(env, boardSlug, taskId, { content, author }) {
  const task = await getTask(env, boardSlug, taskId);
  if (!task) return { error: 'Task not found', status: 404 };

  const now = new Date().toISOString();
  const timestamp = now.replace(/[:.]/g, '-');
  const meta = { date: now, author: author || 'anonymous' };
  const md = buildFrontmatter(meta) + '\n' + (content || '');

  await env.BUCKET.put(`boards/${boardSlug}/tasks/${taskId}/updates/${timestamp}.md`, md);

  // Also update the task's updated timestamp
  await updateTask(env, boardSlug, taskId, {});

  return { id: timestamp, ...meta, content: content || '' };
}

// --- Helpers ---

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: text };

  const meta = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      meta[key] = val;
    }
  }
  return { meta, body: match[2].trim() };
}

function buildFrontmatter(meta) {
  let fm = '---\n';
  for (const [key, val] of Object.entries(meta)) {
    fm += `${key}: ${val}\n`;
  }
  fm += '---\n';
  return fm;
}
