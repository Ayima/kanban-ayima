export function loginPage() {
  return html(`
    <div class="login-container">
      <div class="login-card">
        <h1>Ayima Kanban</h1>
        <form id="login-form">
          <input type="text" name="username" placeholder="Username" class="input" />
          <input type="password" name="password" placeholder="Password" class="input" autofocus />
          <button type="submit" class="btn btn-primary">Log In</button>
          <div id="login-error" class="error"></div>
        </form>
      </div>
    </div>
    <script>
      document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const res = await fetch('/api/v1/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: fd.get('username'), password: fd.get('password') })
        });
        if (res.ok) { location.href = '/'; }
        else {
          const data = await res.json();
          document.getElementById('login-error').textContent = data.error || 'Login failed';
        }
      });
    </script>
  `, 'Login');
}

export function boardListPage() {
  return html(`
    <nav class="topbar">
      <h1>Ayima Kanban</h1>
      <button class="btn btn-sm" onclick="logout()">Logout</button>
    </nav>
    <div class="container">
      <div class="board-header">
        <h2>Boards</h2>
        <button class="btn btn-primary" onclick="showCreateBoard()">+ New Board</button>
      </div>
      <div id="create-board-form" style="display:none" class="card form-card">
        <input type="text" id="board-name" placeholder="Board name" class="input" />
        <input type="text" id="board-desc" placeholder="Description (optional)" class="input" />
        <div class="btn-row">
          <button class="btn btn-primary" onclick="createBoard()">Create</button>
          <button class="btn" onclick="hideCreateBoard()">Cancel</button>
        </div>
      </div>
      <div id="boards-list" class="boards-grid"></div>
    </div>
    <script>
      async function loadBoards() {
        const res = await fetch('/api/v1/boards');
        const data = await res.json();
        const el = document.getElementById('boards-list');
        if (!data.boards.length) {
          el.innerHTML = '<p class="empty">No boards yet. Create one to get started.</p>';
          return;
        }
        el.innerHTML = data.boards.map(b => \`
          <a href="/board/\${b.slug}" class="board-card card">
            <h3>\${esc(b.name)}</h3>
            <p>\${esc(b.description || '')}</p>
            <small>Created \${new Date(b.created).toLocaleDateString()}</small>
          </a>
        \`).join('');
      }
      function showCreateBoard() { document.getElementById('create-board-form').style.display = 'block'; }
      function hideCreateBoard() { document.getElementById('create-board-form').style.display = 'none'; }
      async function createBoard() {
        const name = document.getElementById('board-name').value.trim();
        if (!name) return;
        await fetch('/api/v1/boards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description: document.getElementById('board-desc').value.trim() })
        });
        hideCreateBoard();
        loadBoards();
      }
      function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
      async function logout() { await fetch('/api/v1/logout', { method: 'POST' }); location.href = '/'; }
      loadBoards();
    </script>
  `, 'Boards');
}

export function boardViewPage(slug) {
  return html(`
    <nav class="topbar">
      <a href="/" class="back">&larr; Boards</a>
      <h1 id="board-title">Loading...</h1>
      <span class="user-badge" id="current-user"></span>
      <button class="btn btn-sm" onclick="logout()">Logout</button>
    </nav>
    <div class="kanban-container">
      <div class="kanban-board" id="kanban-board">
        <div class="kanban-col" data-stage="backlog"><h3>Backlog</h3><div class="kanban-cards" data-stage="backlog"></div></div>
        <div class="kanban-col" data-stage="next"><h3>Next</h3><div class="kanban-cards" data-stage="next"></div></div>
        <div class="kanban-col" data-stage="in-progress"><h3>In Progress</h3><div class="kanban-cards" data-stage="in-progress"></div></div>
        <div class="kanban-col" data-stage="complete"><h3>Complete</h3><div class="kanban-cards" data-stage="complete"></div></div>
      </div>
      <details class="archive-section">
        <summary>Archive (<span id="archive-count">0</span>)</summary>
        <div class="kanban-cards" data-stage="archive" id="archive-cards"></div>
      </details>
    </div>
    <button class="fab" onclick="showCreateTask()" title="New Task">+</button>

    <!-- Create Task Modal -->
    <div id="modal-create" class="modal" style="display:none">
      <div class="modal-content">
        <h3>New Task</h3>
        <input type="text" id="new-title" placeholder="Task title" class="input" />
        <textarea id="new-content" placeholder="Description (markdown)" class="input textarea"></textarea>
        <select id="new-stage" class="input">
          <option value="backlog">Backlog</option>
          <option value="next">Next</option>
          <option value="in-progress">In Progress</option>
        </select>
        <select id="new-priority" class="input">
          <option value="low">Low</option>
          <option value="medium" selected>Medium</option>
          <option value="high">High</option>
        </select>
        <select id="new-assignee" class="input">
          <option value="unassigned">Unassigned</option>
        </select>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="createTask()">Create</button>
          <button class="btn" onclick="closeModal('modal-create')">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Task Detail Modal -->
    <div id="modal-detail" class="modal" style="display:none">
      <div class="modal-content modal-wide">
        <div class="task-detail" id="task-detail"></div>
      </div>
    </div>

    <script>
      const BOARD = '${slug}';
      const STAGES = ['backlog','next','in-progress','complete','archive'];
      let ASSIGNEES = [];
      let CURRENT_USER = '';

      async function loadAssignees() {
        const res = await fetch('/api/v1/assignees');
        const data = await res.json();
        ASSIGNEES = data.assignees || [];
        const sel = document.getElementById('new-assignee');
        sel.innerHTML = '<option value="unassigned">Unassigned</option>' +
          ASSIGNEES.map(a => '<option value="' + a + '">' + a.charAt(0).toUpperCase() + a.slice(1) + '</option>').join('');
      }

      async function loadCurrentUser() {
        const res = await fetch('/api/v1/me');
        const data = await res.json();
        CURRENT_USER = data.username || '';
        document.getElementById('current-user').textContent = CURRENT_USER.charAt(0).toUpperCase() + CURRENT_USER.slice(1);
      }

      async function loadBoard() {
        const bRes = await fetch('/api/v1/boards/' + BOARD);
        if (!bRes.ok) { location.href = '/'; return; }
        const board = await bRes.json();
        document.getElementById('board-title').textContent = board.name;

        const tRes = await fetch('/api/v1/boards/' + BOARD + '/tasks');
        const { tasks } = await tRes.json();

        for (const stage of STAGES) {
          const container = document.querySelector('.kanban-cards[data-stage="' + stage + '"]');
          if (!container) continue;
          const stageTasks = tasks.filter(t => t.stage === stage);
          container.innerHTML = stageTasks.map(t => taskCard(t)).join('');
          const col = container.closest('.kanban-col');
          if (col) {
            const h3 = col.querySelector('h3');
            const label = h3.textContent.replace(/\\s*\\d+$/, '');
            h3.innerHTML = label + ' <span class="col-count">' + stageTasks.length + '</span>';
          }
        }

        // Archive
        const archiveTasks = tasks.filter(t => t.stage === 'archive');
        document.getElementById('archive-count').textContent = archiveTasks.length;
        document.getElementById('archive-cards').innerHTML = archiveTasks.map(t => taskCard(t)).join('');

        setupDragDrop();
      }

      function taskCard(t) {
        const priorityClass = 'priority-' + (t.priority || 'medium');
        const assignee = t.assignee && t.assignee !== 'unassigned' ? t.assignee : '';
        const assigneeHtml = assignee ? '<span class="assignee-badge">' + esc(assignee.charAt(0).toUpperCase() + assignee.slice(1)) + '</span>' : '';
        return \`<div class="task-card card \${priorityClass}" draggable="true" data-id="\${t.id}" data-pos="\${t.position || 0}"
          ondragstart="dragStart(event)" onclick="showTask('\${t.id}')">
          <strong>\${esc(t.title)}</strong>
          <div class="task-meta">
            <span class="priority-badge \${priorityClass}">\${esc(t.priority || 'medium')}</span>
            \${assigneeHtml}
          </div>
        </div>\`;
      }

      let dragDropInitialized = false;
      function setupDragDrop() {
        if (dragDropInitialized) return;
        dragDropInitialized = true;

        document.querySelectorAll('.kanban-col').forEach(col => {
          col.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const cards = col.querySelector('.kanban-cards');
            cards.classList.add('drag-over');
            // Show insertion indicator
            const afterCard = getDragAfterElement(cards, e.clientY);
            const indicator = document.getElementById('drop-indicator');
            if (indicator) indicator.remove();
            const line = document.createElement('div');
            line.id = 'drop-indicator';
            line.style.cssText = 'height:2px;background:#58a6ff;border-radius:1px;margin:4px 0;';
            if (afterCard) cards.insertBefore(line, afterCard);
            else cards.appendChild(line);
          });
          col.addEventListener('dragleave', (e) => {
            if (!col.contains(e.relatedTarget)) {
              col.querySelector('.kanban-cards').classList.remove('drag-over');
              const ind = document.getElementById('drop-indicator');
              if (ind) ind.remove();
            }
          });
          col.addEventListener('drop', async (e) => {
            e.preventDefault();
            const cards = col.querySelector('.kanban-cards');
            cards.classList.remove('drag-over');
            const ind = document.getElementById('drop-indicator');
            if (ind) ind.remove();
            const taskId = e.dataTransfer.getData('text/plain');
            const newStage = cards.dataset.stage;
            // Calculate position based on drop location
            const afterCard = getDragAfterElement(cards, e.clientY);
            const cardEls = [...cards.querySelectorAll('.task-card:not(.dragging)')];
            let position;
            if (cardEls.length === 0) {
              position = Date.now();
            } else if (!afterCard) {
              // Dropped at end
              const lastPos = Number(cardEls[cardEls.length - 1].dataset.pos) || Date.now();
              position = lastPos + 1000;
            } else {
              const afterIdx = cardEls.indexOf(afterCard);
              const afterPos = Number(afterCard.dataset.pos) || Date.now();
              if (afterIdx === 0) {
                position = afterPos - 1000;
              } else {
                const beforePos = Number(cardEls[afterIdx - 1].dataset.pos) || afterPos - 2000;
                position = (beforePos + afterPos) / 2;
              }
            }
            await fetch('/api/v1/boards/' + BOARD + '/tasks/' + taskId, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ stage: newStage, position: position })
            });
            loadBoard();
          });
        });
      }

      function getDragAfterElement(container, y) {
        const cards = [...container.querySelectorAll('.task-card:not(.dragging)')];
        return cards.reduce((closest, child) => {
          const box = child.getBoundingClientRect();
          const offset = y - box.top - box.height / 2;
          if (offset < 0 && offset > closest.offset) return { offset, element: child };
          return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
      }

      function dragStart(e) {
        const card = e.target.closest('.task-card');
        e.dataTransfer.setData('text/plain', card.dataset.id);
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('dragging');
        card.addEventListener('dragend', () => card.classList.remove('dragging'), { once: true });
      }

      async function showTask(id) {
        const res = await fetch('/api/v1/boards/' + BOARD + '/tasks/' + id);
        const task = await res.json();
        const detail = document.getElementById('task-detail');
        detail.innerHTML = \`
          <div class="task-header">
            <h2>\${esc(task.title)}</h2>
            <button class="btn btn-sm btn-danger" onclick="deleteTask('\${id}')">Delete</button>
          </div>
          <div class="task-props">
            <label>Stage:
              <select onchange="moveTask('\${id}', this.value)" class="input input-sm">
                \${STAGES.map(s => '<option value="' + s + '"' + (s === task.stage ? ' selected' : '') + '>' + s + '</option>').join('')}
              </select>
            </label>
            <label>Priority:
              <select onchange="updateTaskField('\${id}', 'priority', this.value)" class="input input-sm">
                \${['low','medium','high'].map(p => '<option' + (p === task.priority ? ' selected' : '') + '>' + p + '</option>').join('')}
              </select>
            </label>
            <label>Assignee:
              <select onchange="updateTaskField('\${id}', 'assignee', this.value)" class="input input-sm">
                <option value="unassigned"\${(!task.assignee || task.assignee === 'unassigned') ? ' selected' : ''}>Unassigned</option>
                \${ASSIGNEES.map(a => '<option value="' + a + '"' + (a === task.assignee ? ' selected' : '') + '>' + a.charAt(0).toUpperCase() + a.slice(1) + '</option>').join('')}
              </select>
            </label>
          </div>
          <div class="task-content">
            <h4>Description</h4>
            <div class="editable-area">
              <textarea id="task-content-edit" class="input textarea">\${esc(task.content || '')}</textarea>
              <button class="btn btn-sm" onclick="saveContent('\${id}')">Save</button>
            </div>
          </div>
          <div class="task-updates">
            <h4>Updates</h4>
            <div id="updates-list">
              \${(task.updates || []).map(u => \`
                <div class="update-item">
                  <div class="update-meta">\${esc(u.author || 'anonymous')} &middot; \${new Date(u.date).toLocaleString()}</div>
                  <div class="update-body">\${esc(u.content)}</div>
                </div>
              \`).join('') || '<p class="empty">No updates yet.</p>'}
            </div>
            <div class="add-update">
              <textarea id="new-update" placeholder="Add an update..." class="input textarea-sm"></textarea>
              <button class="btn btn-primary btn-sm" onclick="addUpdate('\${id}')">Post Update</button>
            </div>
          </div>
          <button class="btn" onclick="closeModal('modal-detail')">Close</button>
        \`;
        document.getElementById('modal-detail').style.display = 'flex';
      }

      async function moveTask(id, stage) {
        await fetch('/api/v1/boards/' + BOARD + '/tasks/' + id, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage })
        });
        closeModal('modal-detail');
        loadBoard();
      }

      async function updateTaskField(id, field, value) {
        await fetch('/api/v1/boards/' + BOARD + '/tasks/' + id, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value })
        });
      }

      async function saveContent(id) {
        const content = document.getElementById('task-content-edit').value;
        await fetch('/api/v1/boards/' + BOARD + '/tasks/' + id, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content })
        });
      }

      async function addUpdate(id) {
        const content = document.getElementById('new-update').value.trim();
        if (!content) return;
        await fetch('/api/v1/boards/' + BOARD + '/tasks/' + id + '/updates', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content })
        });
        showTask(id);
      }

      async function deleteTask(id) {
        if (!confirm('Delete this task?')) return;
        await fetch('/api/v1/boards/' + BOARD + '/tasks/' + id, { method: 'DELETE' });
        closeModal('modal-detail');
        loadBoard();
      }

      function showCreateTask() { document.getElementById('modal-create').style.display = 'flex'; }
      function closeModal(id) {
        const m = document.getElementById(id);
        const c = m.querySelector('.modal-content');
        c.style.animation = 'modalOut 0.15s ease forwards';
        m.style.opacity = '0';
        m.style.transition = 'opacity 0.15s ease';
        setTimeout(() => { m.style.display = 'none'; m.style.opacity = ''; c.style.animation = ''; }, 150);
      }

      async function createTask() {
        const title = document.getElementById('new-title').value.trim();
        if (!title) return;
        await fetch('/api/v1/boards/' + BOARD + '/tasks', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            content: document.getElementById('new-content').value,
            stage: document.getElementById('new-stage').value,
            priority: document.getElementById('new-priority').value,
            assignee: document.getElementById('new-assignee').value,
          })
        });
        closeModal('modal-create');
        document.getElementById('new-title').value = '';
        document.getElementById('new-content').value = '';
        loadBoard();
      }

      function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
      async function logout() { await fetch('/api/v1/logout', { method: 'POST' }); location.href = '/'; }

      loadAssignees();
      loadCurrentUser();
      loadBoard();
    </script>
  `, 'Board');
}

function html(body, title) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Ayima Kanban</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    * { transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #e6edf3; min-height: 100vh; }
    a { color: inherit; text-decoration: none; }
    ::selection { background: #58a6ff44; color: #fff; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #0d1117; }
    ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #484f58; }

    .topbar { display: flex; align-items: center; gap: 16px; padding: 12px 24px; background: #161b22; border-bottom: 1px solid #30363d; color: #e6edf3; }
    .topbar h1 { flex: 1; font-size: 18px; font-weight: 600; }
    .topbar .back { color: #58a6ff; opacity: 0.8; font-size: 14px; }
    .topbar .back:hover { opacity: 1; }

    .container { max-width: 1000px; margin: 0 auto; padding: 24px; }
    .board-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }

    .input { display: block; width: 100%; padding: 8px 12px; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; font-size: 14px; margin-bottom: 8px; color: #e6edf3; }
    .input:focus { outline: none; border-color: #58a6ff; box-shadow: 0 0 0 3px #58a6ff33; }
    .input::placeholder { color: #6e7681; }
    .input-sm { display: inline-block; width: auto; margin: 0; padding: 4px 8px; font-size: 13px; }
    .textarea { min-height: 80px; resize: vertical; font-family: monospace; }
    .textarea-sm { min-height: 50px; resize: vertical; }
    select.input { cursor: pointer; }

    .btn { padding: 8px 16px; border: 1px solid #30363d; border-radius: 6px; background: #21262d; color: #e6edf3; cursor: pointer; font-size: 14px; }
    .btn:hover { background: #30363d; border-color: #484f58; }
    .btn-primary { background: #238636; color: #fff; border-color: #238636; }
    .btn-primary:hover { background: #2ea043; border-color: #2ea043; }
    .btn-danger { background: transparent; color: #f85149; border-color: #f85149; }
    .btn-danger:hover { background: #f8514922; }
    .btn-sm { padding: 4px 10px; font-size: 12px; }
    .btn-row { display: flex; gap: 8px; }

    .card { background: #1c2129; border: 1px solid #30363d; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
    .form-card { margin-bottom: 16px; }

    .boards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .board-card { transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s; }
    .board-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.3); border-color: #58a6ff; }
    .board-card h3 { margin-bottom: 4px; color: #e6edf3; }
    .board-card p { color: #8b949e; font-size: 14px; }
    .board-card small { color: #6e7681; font-size: 12px; }

    .kanban-container { padding: 16px 24px; overflow-x: auto; }
    .kanban-board { display: flex; gap: 16px; min-height: calc(100vh - 180px); }
    .kanban-col { flex: 1; min-width: 240px; background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 12px; }
    .kanban-col h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; color: #8b949e; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #30363d; }
    .col-count { background: #30363d; color: #8b949e; font-size: 11px; padding: 1px 7px; border-radius: 10px; margin-left: 6px; font-weight: 400; }
    .kanban-cards { min-height: 40px; padding: 2px; border-radius: 6px; }
    .kanban-cards.drag-over { background: #58a6ff11; border: 1px dashed #58a6ff44; }

    .task-card { margin-bottom: 8px; cursor: grab; padding: 12px; border: 1px solid #30363d; transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease; }
    .task-card:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.4); border-color: #484f58; }
    .task-card.dragging { opacity: 0.4; transform: scale(0.97); }
    .task-card strong { font-size: 14px; display: block; margin-bottom: 6px; color: #e6edf3; }
    .task-meta { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .priority-badge { font-size: 11px; padding: 1px 6px; border-radius: 3px; font-weight: 600; }
    .priority-high { border-left: 3px solid #f85149; }
    .priority-badge.priority-high { background: #f8514922; color: #f85149; border-left: none; }
    .priority-medium .priority-badge { background: #d2992222; color: #d29922; }
    .priority-low .priority-badge { background: #3fb95022; color: #3fb950; }

    .archive-section { margin-top: 16px; padding: 0 24px; }
    .archive-section summary { cursor: pointer; color: #8b949e; font-size: 14px; padding: 8px; }
    .archive-section summary:hover { color: #e6edf3; }

    .fab { position: fixed; bottom: 24px; right: 24px; width: 56px; height: 56px; border-radius: 50%; background: #238636; color: #fff; font-size: 28px; border: none; cursor: pointer; box-shadow: 0 4px 14px rgba(35,134,54,0.4); }
    .fab:hover { background: #2ea043; transform: scale(1.08); box-shadow: 0 6px 20px rgba(35,134,54,0.5); }

    .modal { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 100; }
    .modal-content { background: #1c2129; border: 1px solid #30363d; border-radius: 12px; padding: 24px; width: 90%; max-width: 480px; max-height: 90vh; overflow-y: auto; box-shadow: 0 16px 48px rgba(0,0,0,0.5); animation: modalIn 0.2s ease; }
    .modal-wide { max-width: 640px; }
    @keyframes modalIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    @keyframes modalOut { to { opacity: 0; transform: scale(0.97) translateY(5px); } }

    .task-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .task-header h2 { color: #e6edf3; }
    .task-props { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
    .task-props label { font-size: 13px; color: #8b949e; display: flex; align-items: center; gap: 4px; }
    .task-content { margin-bottom: 16px; }
    .task-content h4, .task-updates h4 { font-size: 13px; text-transform: uppercase; color: #6e7681; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #21262d; }
    .editable-area { display: flex; flex-direction: column; gap: 6px; }

    .task-updates { margin-bottom: 16px; }
    .update-item { padding: 8px 0; border-bottom: 1px solid #21262d; }
    .update-meta { font-size: 12px; color: #6e7681; margin-bottom: 4px; }
    .update-body { font-size: 14px; white-space: pre-wrap; color: #e6edf3; }
    .add-update { margin-top: 12px; }

    .assignee-badge { font-size: 11px; padding: 1px 6px; border-radius: 3px; background: #58a6ff22; color: #58a6ff; font-weight: 500; }
    .user-badge { font-size: 13px; color: #8b949e; padding: 2px 8px; border: 1px solid #30363d; border-radius: 12px; }

    .empty { color: #6e7681; font-style: italic; padding: 16px 0; }

    .login-container { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .login-card { background: #161b22; border: 1px solid #30363d; padding: 40px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); width: 360px; text-align: center; }
    .login-card h1 { margin-bottom: 24px; color: #e6edf3; }
    .error { color: #f85149; font-size: 14px; margin-top: 8px; }

    @media (max-width: 768px) {
      .kanban-board { flex-direction: column; }
      .kanban-col { min-width: auto; }
    }
  </style>
</head>
<body>${body}</body>
</html>`;
}
