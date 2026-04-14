import { STAGES } from './auth.js';
import * as storage from './storage.js';

export async function handleApi(request, env, path) {
  const method = request.method;
  const url = new URL(request.url);

  // Parse: /api/v1/boards[/:board[/tasks[/:taskId[/updates]]]]
  const parts = path.replace(/^\/api\/v1\//, '').replace(/\/$/, '').split('/');

  // GET /api/v1/boards
  if (parts[0] === 'boards' && parts.length === 1) {
    if (method === 'GET') {
      const boards = await storage.listBoards(env);
      return Response.json({ boards });
    }
    if (method === 'POST') {
      const body = await request.json();
      if (!body.name) return Response.json({ error: 'Name required' }, { status: 400 });
      const result = await storage.createBoard(env, body);
      if (result.error) return Response.json({ error: result.error }, { status: result.status });
      return Response.json(result, { status: 201 });
    }
    return methodNotAllowed();
  }

  // /api/v1/boards/:board
  if (parts[0] === 'boards' && parts.length === 2) {
    const boardSlug = parts[1];
    if (method === 'GET') {
      const board = await storage.getBoard(env, boardSlug);
      if (!board) return notFound('Board');
      return Response.json(board);
    }
    if (method === 'DELETE') {
      await storage.deleteBoard(env, boardSlug);
      return Response.json({ ok: true });
    }
    return methodNotAllowed();
  }

  // /api/v1/boards/:board/tasks
  if (parts[0] === 'boards' && parts[2] === 'tasks' && parts.length === 3) {
    const boardSlug = parts[1];
    if (method === 'GET') {
      const stage = url.searchParams.get('stage');
      if (stage && !STAGES.includes(stage)) {
        return Response.json({ error: `Invalid stage. Must be one of: ${STAGES.join(', ')}` }, { status: 400 });
      }
      const tasks = await storage.listTasks(env, boardSlug, stage);
      return Response.json({ tasks });
    }
    if (method === 'POST') {
      const body = await request.json();
      if (!body.title) return Response.json({ error: 'Title required' }, { status: 400 });
      if (body.stage && !STAGES.includes(body.stage)) {
        return Response.json({ error: `Invalid stage. Must be one of: ${STAGES.join(', ')}` }, { status: 400 });
      }
      const result = await storage.createTask(env, boardSlug, body);
      if (result.error) return Response.json({ error: result.error }, { status: result.status });
      return Response.json(result, { status: 201 });
    }
    return methodNotAllowed();
  }

  // /api/v1/boards/:board/tasks/:taskId
  if (parts[0] === 'boards' && parts[2] === 'tasks' && parts.length === 4) {
    const boardSlug = parts[1];
    const taskId = parts[3];
    if (method === 'GET') {
      const task = await storage.getTask(env, boardSlug, taskId);
      if (!task) return notFound('Task');
      const updates = await storage.listUpdates(env, boardSlug, taskId);
      return Response.json({ ...task, updates });
    }
    if (method === 'PUT') {
      const body = await request.json();
      if (body.stage && !STAGES.includes(body.stage)) {
        return Response.json({ error: `Invalid stage. Must be one of: ${STAGES.join(', ')}` }, { status: 400 });
      }
      const result = await storage.updateTask(env, boardSlug, taskId, body);
      if (result.error) return Response.json({ error: result.error }, { status: result.status });
      return Response.json(result);
    }
    if (method === 'DELETE') {
      await storage.deleteTask(env, boardSlug, taskId);
      return Response.json({ ok: true });
    }
    return methodNotAllowed();
  }

  // /api/v1/boards/:board/tasks/:taskId/updates
  if (parts[0] === 'boards' && parts[2] === 'tasks' && parts[4] === 'updates' && parts.length === 5) {
    const boardSlug = parts[1];
    const taskId = parts[3];
    if (method === 'GET') {
      const updates = await storage.listUpdates(env, boardSlug, taskId);
      return Response.json({ updates });
    }
    if (method === 'POST') {
      const body = await request.json();
      if (!body.content) return Response.json({ error: 'Content required' }, { status: 400 });
      const result = await storage.createUpdate(env, boardSlug, taskId, body);
      if (result.error) return Response.json({ error: result.error }, { status: result.status });
      return Response.json(result, { status: 201 });
    }
    return methodNotAllowed();
  }

  // GET /api/v1/stages
  if (parts[0] === 'stages' && parts.length === 1 && method === 'GET') {
    return Response.json({ stages: STAGES });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}

function notFound(entity) {
  return Response.json({ error: `${entity} not found` }, { status: 404 });
}

function methodNotAllowed() {
  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
