# Kanban Ayima

> Made with ❤️ by [Ayima](https://www.ayima.com/) --- see [using this project](#using-this-project) below

A kanban board hosted on Cloudflare Workers with R2 storage.

- **Lightweight task management** — create boards, drag-and-drop tasks through stages (Backlog → Next → In Progress → Complete → Archive)
- **Claude Code integration** — install the CLI + agent skill and let Claude manage your board with natural language

## Quickstart

### 1. Install the CLI

Clone the repo and symlink the CLI so updates are instant:

```bash
git clone https://github.com/ayima/kanban-ayima.git ~/kanban-ayima
sudo ln -s ~/kanban-ayima/cli/kanban-ayima /usr/local/bin/kanban-ayima
```

After that, `git pull` in the repo is all you need to update — no reinstall required.

### 2. Log in

```bash
kanban-ayima login https://kanban.ayima.net
```

### 3. Install the Claude Code skill

```bash
mkdir -p ~/.claude/skills/kanban-ayima
curl -fsSL https://raw.githubusercontent.com/ayima/kanban-ayima/main/skill/kanban-ayima/SKILL.md \
  -o ~/.claude/skills/kanban-ayima/SKILL.md
```

Then ask Claude things like:
- `/kanban-ayima Create these tasks in the [project-name] board`
- `/kanban-ayima Show me all tasks in the backlog for [project-name]`


---

## Using this project

We are releasing this open-source for you to copy and adapt as needed.

If you find it helpful then please show your appreciation by **leaving us a star** ⭐. Thank you!

Here is a prompt to get you started:

```
Have a look at this kanban board project. I want to adapt it for my business
named "[insert-business-name]".

https://github.com/Ayima/kanban-ayima

Your task is to create my own version of this project on my local machine and
then help me deploy it.

You'll need to ensure that I have the proper dependencies before we get started
and also work with me to set up the proper credentials.

Let me know what you need from me as we go, and also pause to ask me any
questions that require clarification.
```

---

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)
- A Cloudflare account with Workers and R2 enabled

### 1. Configure Account ID

Add your Cloudflare account ID to `wrangler.toml`:

```toml
account_id = "your-account-id"
```

You can find this in the Cloudflare dashboard under **Workers & Pages > Overview**.

### 2. Install Dependencies

```bash
npm install
```

### 3. Create the R2 Buckets

```bash
wrangler r2 bucket create kanban-ayima-net
wrangler r2 bucket create kanban-ayima-net-backups
```

The first bucket stores board and task data. The second is used for daily automated backups (see [Daily Backups](#daily-backups)).

### 4. Create the KV Namespace for Sessions

```bash
npx wrangler kv namespace create SESSIONS
```

Add the returned namespace ID to `wrangler.toml` under `[[kv_namespaces]]`.

### 5. Set the Authentication Credentials

```bash
npx wrangler secret put AUTH_USERNAME
npx wrangler secret put AUTH_PASSWORD
```

Enter your chosen username and password when prompted. These are the shared credentials for the single user account.

### 6. Deploy

```bash
npm run deploy
```

### 6. Configure Custom Domain

In the Cloudflare dashboard, add `kanban.ayima.net` as a custom domain for the worker.

### Local Development

```bash
npm run dev
```

Note: For local dev, you'll need to create a `.dev.vars` file:

```
AUTH_USERNAME=your-dev-username
AUTH_PASSWORD=your-dev-password
```

---

## REST API

All API endpoints are under `/api/v1/`. Authentication is required via session cookie.

### Authentication

Log in via the login endpoint to get a session cookie:

```bash
curl -c cookies.txt -X POST -H "Content-Type: application/json" \
  -d '{"username":"youruser","password":"yourpassword"}' \
  https://kanban.ayima.net/api/v1/login

curl -b cookies.txt https://kanban.ayima.net/api/v1/boards
```

### Endpoints

#### Boards

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/boards` | List all boards |
| `POST` | `/api/v1/boards` | Create a board |
| `GET` | `/api/v1/boards/:slug` | Get board details |
| `PUT` | `/api/v1/boards/:slug` | Update board name/description |
| `DELETE` | `/api/v1/boards/:slug` | Delete a board and all its tasks |

**Create board body:**
```json
{ "name": "My Project", "description": "Optional description" }
```

#### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/boards/:board/tasks` | List tasks (`?stage=` to filter) |
| `POST` | `/api/v1/boards/:board/tasks` | Create a task |
| `GET` | `/api/v1/boards/:board/tasks/:id` | Get task with updates |
| `PUT` | `/api/v1/boards/:board/tasks/:id` | Update a task |
| `DELETE` | `/api/v1/boards/:board/tasks/:id` | Delete a task |

**Create task body:**
```json
{
  "title": "Implement feature X",
  "content": "Markdown description here",
  "stage": "backlog",
  "priority": "medium"
}
```

**Update task body** (all fields optional):
```json
{
  "title": "New title",
  "content": "Updated description",
  "stage": "in-progress",
  "priority": "high"
}
```

#### Task Updates (Comments)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/boards/:board/tasks/:id/updates` | List updates |
| `POST` | `/api/v1/boards/:board/tasks/:id/updates` | Add an update |

**Create update body:**
```json
{ "content": "Started working on this", "author": "alice" }
```

#### Stages

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/stages` | List valid stages |

**Valid stages:** `backlog`, `next`, `in-progress`, `complete`, `archive`

**Valid priorities:** `low`, `medium`, `high`

---

## CLI

### Install

Clone the repo and symlink the CLI:

```bash
git clone https://github.com/ayima/kanban-ayima.git ~/kanban-ayima
sudo ln -s ~/kanban-ayima/cli/kanban-ayima /usr/local/bin/kanban-ayima
```

### Update

```bash
cd ~/kanban-ayima && git pull
```

No reinstall needed — the symlink picks up changes automatically.

### Login

```bash
kanban-ayima login https://kanban.ayima.net
```

Credentials will be stored in `~/.kanban-ayima/credentials`.

### Commands

```
kanban-ayima boards                              # List boards
kanban-ayima boards create "Project Alpha"       # Create a board
kanban-ayima boards rename project-alpha "New Name"  # Rename a board
kanban-ayima boards delete project-alpha         # Delete a board

kanban-ayima tasks project-alpha                 # List all tasks
kanban-ayima tasks project-alpha --stage next    # Filter by stage
kanban-ayima tasks project-alpha create "Fix bug" --body "Details" --priority high
kanban-ayima tasks project-alpha show <id>       # Show task + updates
kanban-ayima tasks project-alpha move <id> in-progress
kanban-ayima tasks project-alpha edit <id> --title "New title"
kanban-ayima tasks project-alpha update <id> --body "Progress update"
kanban-ayima tasks project-alpha delete <id>
```

---

## Claude Code Agent Skill

To use the kanban board with Claude Code:

### 1. Install the CLI (see above)

### 2. Log in

```bash
kanban-ayima login https://kanban.ayima.net
```

### 3. Install the Skill

Copy the skill directory to your Claude Code skills directory:

```bash
mkdir -p ~/.claude/skills
cp -r skill/kanban-ayima ~/.claude/skills/kanban-ayima
```

Or if installing from the repo:

```bash
mkdir -p ~/.claude/skills/kanban-ayima
curl -fsSL https://raw.githubusercontent.com/ayima/kanban-ayima/main/skill/kanban-ayima/SKILL.md \
  -o ~/.claude/skills/kanban-ayima/SKILL.md
```

### 4. Use It

In Claude Code, you can now ask things like:
- "Show me all tasks on the project-alpha board"
- "Create a new task for fixing the login bug on the website board"
- "Move task abc123 to in-progress"
- "What's in the backlog for project-alpha?"

---

## R2 Data Structure

```
boards/
  {board-slug}/
    _meta.json                          # Board metadata
    tasks/
      {task-id}/
        task.md                         # Task content (YAML frontmatter + markdown body)
        updates/
          {timestamp}.md                # Update/comment files
```

Task frontmatter fields: `title`, `stage`, `created`, `updated`, `priority`
Update frontmatter fields: `date`, `author`

---

## Daily Backups

The worker runs a daily cron job (3:00 AM UTC) that snapshots all board data from the primary R2 bucket into a separate backup bucket. Snapshots older than 7 days are automatically pruned.

### Setup

Create the backup R2 bucket:

```bash
wrangler r2 bucket create kanban-ayima-net-backups
```

The backup bucket binding (`BACKUP_BUCKET`) and cron trigger are already configured in `wrangler.toml`. Deploy to activate:

```bash
npm run deploy
```

### How It Works

- **Schedule:** Runs daily at 03:00 UTC via a Cloudflare Worker [cron trigger](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- **Snapshot format:** Each day's backup is stored under a `YYYY-MM-DD/` prefix in the backup bucket, mirroring the original object paths
- **Retention:** Snapshots older than 7 days are deleted automatically
- **Cost:** R2-to-R2 copies within the same account incur no egress fees

### Backup Bucket Structure

```
2026-04-14/
  boards/
    {board-slug}/
      _meta.json
      tasks/
        {task-id}/
          task.md
          updates/
            {timestamp}.md
2026-04-13/
  boards/
    ...
```

### Restoring from a Backup

To restore a specific day's snapshot, copy objects from the backup bucket back to the primary bucket using the Wrangler CLI or the R2 dashboard. For example, to list a snapshot:

```bash
npx wrangler r2 object list kanban-ayima-net-backups --prefix "2026-04-14/"
```
