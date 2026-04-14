const STAGES = ['backlog', 'next', 'in-progress', 'complete', 'archive'];

export { STAGES };

const SESSION_TTL = 604800; // 7 days in seconds

export async function authenticate(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);
  if (match) {
    const session = await env.SESSIONS.get(match[1]);
    if (session) return true;
  }
  return false;
}

const LOGIN_RATE_LIMIT = { maxAttempts: 5, windowSecs: 300 };

async function checkLoginRateLimit(env, ip) {
  const key = `_ratelimit/login/${ip}`;
  const obj = await env.BUCKET.get(key);
  const now = Date.now();
  let record = obj ? JSON.parse(await obj.text()) : { attempts: [], blocked: 0 };

  // Clear expired attempts
  record.attempts = record.attempts.filter(t => now - t < LOGIN_RATE_LIMIT.windowSecs * 1000);

  if (record.attempts.length >= LOGIN_RATE_LIMIT.maxAttempts) {
    return { allowed: false, retryAfter: Math.ceil((record.attempts[0] + LOGIN_RATE_LIMIT.windowSecs * 1000 - now) / 1000) };
  }

  record.attempts.push(now);
  await env.BUCKET.put(key, JSON.stringify(record));
  return { allowed: true };
}

export async function handleLogin(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateCheck = await checkLoginRateLimit(env, ip);
  if (!rateCheck.allowed) {
    return Response.json(
      { error: 'Too many login attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body?.password) {
    return Response.json({ error: 'Password required' }, { status: 400 });
  }

  if (body.username !== env.AUTH_USERNAME || body.password !== env.AUTH_PASSWORD) {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = crypto.randomUUID();
  await env.SESSIONS.put(token, JSON.stringify({ created: new Date().toISOString() }), { expirationTtl: SESSION_TTL });

  return Response.json({ ok: true, token }, {
    headers: {
      'Set-Cookie': `session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}`,
    }
  });
}

export async function handleLogout(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);
  if (match) {
    await env.SESSIONS.delete(match[1]);
  }
  return Response.json({ ok: true }, {
    headers: {
      'Set-Cookie': 'session=; Path=/; HttpOnly; Secure; Max-Age=0',
    }
  });
}
