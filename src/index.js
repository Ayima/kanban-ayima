import { authenticate, handleLogin, handleLogout } from './auth.js';
import { handleApi } from './api.js';
import { loginPage, boardListPage, boardViewPage } from './ui.js';
import { runBackup } from './backup.js';

function checkOrigin(request) {
  const origin = request.headers.get('Origin');
  const host = request.headers.get('Host');
  // Allow requests with no Origin (e.g. CLI/curl)
  if (!origin) return true;
  // Origin must match the Host
  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
  }
}

export default {
  async fetch(request, env) {
    try { return await this._fetch(request, env); }
    catch (e) { return Response.json({ error: e.message || 'Internal error' }, { status: 500 }); }
  },
  async _fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CSRF: reject state-changing requests from foreign origins
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method) && !checkOrigin(request)) {
      return Response.json({ error: 'Origin mismatch' }, { status: 403 });
    }

    // Login/logout endpoints (no auth required for login)
    if (path === '/api/v1/login') {
      return handleLogin(request, env);
    }

    // API routes require auth
    if (path.startsWith('/api/v1/')) {
      if (path === '/api/v1/logout') {
        return handleLogout(request, env);
      }

      const user = await authenticate(request, env);
      if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return handleApi(request, env, path, user);
    }

    // UI routes — check session auth
    const user = await authenticate(request, env);

    if (!user) {
      return new Response(loginPage(), { headers: { 'Content-Type': 'text/html' } });
    }

    // Board view
    const boardMatch = path.match(/^\/board\/([a-z0-9-]+)\/?$/);
    if (boardMatch) {
      return new Response(boardViewPage(boardMatch[1]), { headers: { 'Content-Type': 'text/html' } });
    }

    // Board list (home)
    return new Response(boardListPage(), { headers: { 'Content-Type': 'text/html' } });
  },

  async scheduled(event, env, ctx) {
    const result = await runBackup(env);
    console.log(`Backup complete: ${result.copied} objects copied (${result.date}), ${result.pruned} old objects pruned`);
  }
};
