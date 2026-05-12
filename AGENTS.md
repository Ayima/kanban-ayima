# AGENTS.md

## Project Overview

Cloudflare Workers kanban board app with R2 storage. Source in `src/`, CLI in `cli/`, skill in `skill/`.

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
- `skill/kanban-ayima/SKILL.md` — Claude Code skill definition

## CLI + Skill Sync Rule

**Whenever you modify the kanban app (API, storage, or UI), you must also:**

1. Update `cli/kanban-ayima` to expose any new/changed fields or endpoints.
2. Update `skill/kanban-ayima/SKILL.md` to document the new CLI usage accurately.
3. Copy the updated skill to the ayima-skills repo: `cp skill/kanban-ayima/SKILL.md ~/apro/ayima-skills/skills/kanban-ayima/SKILL.md`

The skill is what coding agents read to understand available commands — if it's stale, agents will use wrong or missing flags (e.g. the `--assignee` gap that existed before this rule was added).

Key places to check for drift:
- `src/api.js` PUT `/boards/:board/tasks/:taskId` — fields accepted by the update handler
- `cli/kanban-ayima` `edit` command — fields it actually parses and sends
- `skill/kanban-ayima/SKILL.md` `edit` command documentation

## Deployment

### Deploy the Worker

```bash
npm run deploy
```

### Re-link the CLI (only needed if `cli/kanban-ayima` is moved or the symlink breaks)

```bash
sudo ln -sf "$(pwd)/cli/kanban-ayima" /usr/local/bin/kanban-ayima
```

The symlink at `/usr/local/bin/kanban-ayima` already points to this repo, so `git pull` updates the CLI automatically with no re-linking needed.

### Deploy the Skill

Copy `skill/kanban-ayima/SKILL.md` to the ayima-skills repo (which is symlinked into the agent config directories):

```bash
cp skill/kanban-ayima/SKILL.md ~/apro/ayima-skills/skills/kanban-ayima/SKILL.md
```

The `ayima-skills` repo is the single source for agent skills:
- `~/apro/.claude/skills` → `~/apro/ayima-skills/skills`
- `~/apro/.agents/skills` → `~/apro/ayima-skills/skills`
