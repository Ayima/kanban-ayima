# Ayima Kanban

A lightweight kanban board hosted on Cloudflare Workers with R2 storage, available at **kanban.ayima.net**.

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

### 3. Create the R2 Bucket

```bash
wrangler r2 bucket create kanban-ayima-net
```

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

## Web UI

Navigate to `https://kanban.ayima.net` and log in with the credentials you set via `wrangler secret put`.

Features:
- Create and manage boards (one per project)
- Drag-and-drop tasks between stages: Backlog → Next → In Progress → Complete → Archive
- Task descriptions in markdown
- Comment/update threads on each task
- Priority levels (low, medium, high)

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

```bash
sudo curl -fsSL https://raw.githubusercontent.com/ayima/kanban-ayima/main/cli/kanban-ayima -o /usr/local/bin/kanban-ayima && sudo chmod +x /usr/local/bin/kanban-ayima
```

Requires `curl`, `jq`, and `base64` (standard on macOS/Linux).

### Update

Re-run the install command to update to the latest version:

```bash
sudo curl -fsSL https://raw.githubusercontent.com/ayima/kanban-ayima/main/cli/kanban-ayima -o /usr/local/bin/kanban-ayima && sudo chmod +x /usr/local/bin/kanban-ayima
```

### Login

```bash
kanban-ayima login https://kanban.ayima.net
```

Credentials are stored in `~/.kanban-ayima/credentials`.

### Commands

```
kanban-ayima boards                              # List boards
kanban-ayima boards create "Project Alpha"       # Create a board
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
