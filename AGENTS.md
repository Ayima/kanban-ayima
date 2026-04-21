# AGENTS.md

## Project Overview

Cloudflare Workers kanban board app with R2 storage. Source in `src/`, CLI in `cli/`, Claude Code skill in `skill/`.

## Getting Started

Read `.secrets` at the start of each session for credentials and configuration values (Cloudflare account ID, auth password, session secret, API bearer token). This file is gitignored and contains secrets needed for development and deployment.

## Development

- `nvm use 24` — use Node 24 (see `.nvmrc`)
- `npm run dev` — start local dev server (requires `.dev.vars` with `AUTH_PASSWORD` and `SESSION_SECRET`)
- `npm run deploy` — deploy to Cloudflare Workers
- `wrangler.toml` — worker config; `account_id` is intentionally omitted from the repo (see `.secrets`)

## Key Files

- `src/index.js` — request router
- `src/auth.js` — authentication (session cookies + Bearer token)
- `src/api.js` — REST API handlers
- `src/storage.js` — R2 storage layer
- `src/ui.js` — server-rendered HTML UI
- `cli/kanban-ayima` — bash CLI client (symlinked to `/usr/local/bin/kanban-ayima`; `git pull` auto-updates)
- `skill/kanban-ayima/SKILL.md` — Claude Code skill definition (install to `~/.claude/skills/kanban-ayima/SKILL.md`)
