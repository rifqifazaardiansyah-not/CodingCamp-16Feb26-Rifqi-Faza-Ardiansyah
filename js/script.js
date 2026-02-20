/* ============================================================
   STATE
   ============================================================ */
let tasks = JSON.parse(localStorage.getItem('taskflow_tasks')) || [];
let currentFilter = 'all';
let currentSort   = 'date-added';
let searchQuery   = '';
let editingId     = null;

/* ============================================================
   LOCALSTORAGE
   ============================================================ */
function saveTasks() {
  localStorage.setItem('taskflow_tasks', JSON.stringify(tasks));
}

/* ============================================================
   GENERATE ID
   ============================================================ */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/* ============================================================
   FORMAT DATE
   ============================================================ */
function formatDate(dateStr) {
  if (!dateStr) return '<span class="due-normal">No due date</span>';

  // Parse tanggal tanpa timezone shift
  const [y, m, d] = dateStr.split('-').map(Number);
  const date  = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diff = Math.round((date - today) / (1000 * 60 * 60 * 24));
  const formatted = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  if (diff < 0)  return `<span class="overdue">⚠ ${formatted}</span>`;
  if (diff === 0) return `<span class="today">Today</span>`;
  return `<span class="due-normal">${formatted}</span>`;
}

/* ============================================================
   ESCAPE HTML
   ============================================================ */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ============================================================
   VALIDATE
   ============================================================ */
function validateForm(taskText, dateValue, isModal = false) {
  const prefix    = isModal ? 'edit-' : '';
  const taskInput = document.getElementById(prefix + 'task-input');
  const taskError = document.getElementById(prefix + 'task-error');
  const dateError = !isModal ? document.getElementById('date-error') : null;
  let valid = true;

  // Reset
  taskInput.classList.remove('error');
  taskError.textContent = '';
  taskError.classList.remove('show');
  if (dateError) { dateError.textContent = ''; dateError.classList.remove('show'); }

  if (!taskText.trim()) {
    taskInput.classList.add('error');
    taskError.textContent = 'Task name cannot be empty.';
    taskError.classList.add('show');
    valid = false;
  } else if (taskText.trim().length < 3) {
    taskInput.classList.add('error');
    taskError.textContent = 'Minimum 3 characters.';
    taskError.classList.add('show');
    valid = false;
  }

  // Peringatan tanggal lampau (non-blocking)
  if (valid && dateValue && dateError) {
    const [y, m, d] = dateValue.split('-').map(Number);
    const selected  = new Date(y, m - 1, d);
    const today     = new Date();
    today.setHours(0, 0, 0, 0);
    if (selected < today) {
      dateError.textContent = 'Due date is in the past.';
      dateError.classList.add('show');
    }
  }

  return valid;
}

/* ============================================================
   ADD TASK
   ============================================================ */
function addTask() {
  const taskInput = document.getElementById('task-input');
  const dateInput = document.getElementById('date-input');
  const text      = taskInput.value;
  const date      = dateInput.value;

  if (!validateForm(text, date)) return;

  tasks.unshift({
    id:        generateId(),
    text:      text.trim(),
    dueDate:   date || null,
    completed: false,
    addedAt:   new Date().toISOString()
  });

  saveTasks();
  renderAll();

  taskInput.value = '';
  dateInput.value = '';
  taskInput.focus();
  showToast('Task added!', 'success');
}

/* ============================================================
   TOGGLE STATUS ← FIXED
   ============================================================ */
function toggleTask(id) {
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return;

  tasks[idx].completed = !tasks[idx].completed;
  saveTasks();
  renderAll();
  showToast(tasks[idx].completed ? 'Marked as done ✓' : 'Marked as pending', 'info');
}

/* ============================================================
   DELETE TASK
   ============================================================ */
function deleteTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  openConfirmModal(
    'Delete Task?',
    `"<strong>${escapeHtml(task.text)}</strong>" akan dihapus permanen.`,
    () => {
      tasks = tasks.filter(t => t.id !== id);
      saveTasks();
      renderAll();
      showToast('Task deleted.', 'error');
    }
  );
}

/* ============================================================
   DELETE ALL
   ============================================================ */
function deleteAllTasks() {
  if (tasks.length === 0) { showToast('No tasks to delete.', 'info'); return; }
  openConfirmModal(
    'Delete All Tasks?',
    `Semua <strong>${tasks.length} task</strong> akan dihapus permanen.`,
    () => {
      tasks = [];
      saveTasks();
      renderAll();
      showToast('All tasks deleted.', 'error');
    }
  );
}

/* ============================================================
   OPEN EDIT MODAL
   ============================================================ */
function openEditModal(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  editingId = id;
  document.getElementById('edit-task-input').value = task.text;
  document.getElementById('edit-date-input').value = task.dueDate || '';
  document.getElementById('modal-overlay').classList.add('open');
}

/* ============================================================
   CLOSE MODAL
   ============================================================ */
function closeModal() {
  editingId = null;
  document.getElementById('modal-overlay').classList.remove('open');
}

/* ============================================================
   SAVE EDIT
   ============================================================ */
function saveEdit() {
  const text = document.getElementById('edit-task-input').value;
  const date = document.getElementById('edit-date-input').value;
  if (!validateForm(text, date, true)) return;

  const idx = tasks.findIndex(t => t.id === editingId);
  if (idx === -1) return;

  tasks[idx].text    = text.trim();
  tasks[idx].dueDate = date || null;

  saveTasks();
  renderAll();
  closeModal();
  showToast('Task updated!', 'success');
}

/* ============================================================
   SEARCH
   ============================================================ */
function handleSearch(value) {
  searchQuery = value.toLowerCase().trim();
  renderList();
}

/* ============================================================
   SET FILTER ← FIXED
   ============================================================ */
function setFilter(filter) {
  currentFilter = filter;

  // Update active state pada semua item filter
  document.querySelectorAll('#filter-menu .dropdown-item').forEach(el => {
    el.classList.toggle('active', el.dataset.filter === filter);
  });

  // Update label tombol
  const labels = { all: 'All', completed: 'Completed', pending: 'Pending' };
  document.getElementById('filter-label').textContent = labels[filter] || 'All';

  closeAllMenus();
  renderList();
}

/* ============================================================
   SET SORT ← FIXED
   ============================================================ */
function setSort(sort) {
  currentSort = sort;

  // Update active state pada semua item sort
  document.querySelectorAll('#sort-menu .dropdown-item').forEach(el => {
    el.classList.toggle('active', el.dataset.sort === sort);
  });

  // Update label tombol
  const labels = {
    'date-added': 'Date Added',
    'due-date':   'Due Date',
    'name-asc':   'Name A–Z',
    'name-desc':  'Name Z–A',
    'status':     'Status'
  };
  document.getElementById('sort-label').textContent = labels[sort] || 'Sort';

  closeAllMenus();
  renderList();
}

/* ============================================================
   MENU TOGGLES
   ============================================================ */
function toggleFilterMenu() {
  const fm = document.getElementById('filter-menu');
  const sm = document.getElementById('sort-menu');
  fm.classList.toggle('open');
  sm.classList.remove('open');
}

function toggleSortMenu() {
  const sm = document.getElementById('sort-menu');
  const fm = document.getElementById('filter-menu');
  sm.classList.toggle('open');
  fm.classList.remove('open');
}

function closeAllMenus() {
  document.getElementById('filter-menu').classList.remove('open');
  document.getElementById('sort-menu').classList.remove('open');
}

/* ============================================================
   GET FILTERED + SORTED LIST
   ============================================================ */
function getFilteredTasks() {
  let list = [...tasks];

  // Filter
  if (currentFilter === 'completed') list = list.filter(t => t.completed);
  if (currentFilter === 'pending')   list = list.filter(t => !t.completed);

  // Search
  if (searchQuery) {
    list = list.filter(t => t.text.toLowerCase().includes(searchQuery));
  }

  // Sort
  switch (currentSort) {
    case 'date-added':
      list.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
      break;
    case 'due-date':
      list.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
      break;
    case 'name-asc':
      list.sort((a, b) => a.text.localeCompare(b.text));
      break;
    case 'name-desc':
      list.sort((a, b) => b.text.localeCompare(a.text));
      break;
    case 'status':
      // pending dulu, lalu done
      list.sort((a, b) => Number(a.completed) - Number(b.completed));
      break;
  }

  return list;
}

/* ============================================================
   RENDER STATS
   ============================================================ */
function renderStats() {
  const total     = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const pending   = total - completed;
  const progress  = total === 0 ? 0 : Math.round((completed / total) * 100);

  document.getElementById('stat-total').textContent     = total;
  document.getElementById('stat-completed').textContent = completed;
  document.getElementById('stat-pending').textContent   = pending;
  document.getElementById('stat-progress').textContent  = progress + '%';
  document.getElementById('progress-fill').style.width  = progress + '%';
}

/* ============================================================
   RENDER LIST
   ============================================================ */
function renderList() {
  const tbody = document.getElementById('task-tbody');
  const list  = getFilteredTasks();

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4">
          <div class="empty-state">
            <div style="font-size:2.5rem;margin-bottom:12px">🗂️</div>
            <p>No tasks found</p>
            <p style="font-size:13px;color:var(--muted);margin-top:4px">Add a new task or change your filters.</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = list.map(task => {
    const checkSvg = task.completed
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0f0f13" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
      : '';

    const editSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

    const delSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;

    const badgeDone    = `<span class="badge badge-done">✓ Done</span>`;
    const badgePending = `<span class="badge badge-pending">● Pending</span>`;

    return `
      <tr class="task-row">
        <td>
          <div class="task-cell">
            <div class="check-box ${task.completed ? 'checked' : ''}" onclick="toggleTask('${task.id}')">${checkSvg}</div>
            <span class="task-name ${task.completed ? 'done' : ''}">${escapeHtml(task.text)}</span>
          </div>
        </td>
        <td>${formatDate(task.dueDate)}</td>
        <td>${task.completed ? badgeDone : badgePending}</td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn-row edit" onclick="openEditModal('${task.id}')" title="Edit">${editSvg}</button>
            <button class="btn-row del"  onclick="deleteTask('${task.id}')"    title="Delete">${delSvg}</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

/* ============================================================
   RENDER ALL
   ============================================================ */
function renderAll() {
  renderStats();
  renderList();
}

/* ============================================================
   TOAST
   ============================================================ */
let toastTimer;
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className   = `toast ${type}`;
  clearTimeout(toastTimer);
  setTimeout(() => toast.classList.add('show'), 10);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

/* ============================================================
   KEYBOARD SHORTCUTS
   ============================================================ */
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    document.getElementById('search-input').focus();
  }
  if (e.key === 'Enter' && document.activeElement.id === 'task-input') {
    addTask();
  }
  if (e.key === 'Escape') {
    closeModal();
    closeConfirmModal();
    closeAllMenus();
  }
});

/* ============================================================
   CLOSE MENUS WHEN CLICKING OUTSIDE
   ============================================================ */
document.addEventListener('click', e => {
  if (!e.target.closest('.dropdown-wrap')) closeAllMenus();
  if (e.target.id === 'modal-overlay')   closeModal();
  if (e.target.id === 'confirm-overlay') closeConfirmModal();
});

/* ============================================================
   CONFIRM MODAL — reusable
   ============================================================ */
let confirmCallback = null;

function openConfirmModal(title, message, onConfirm) {
  confirmCallback = onConfirm;
  document.getElementById('confirm-title').textContent   = title;
  document.getElementById('confirm-message').innerHTML   = message;
  document.getElementById('confirm-overlay').classList.add('open');
}

function closeConfirmModal() {
  confirmCallback = null;
  document.getElementById('confirm-overlay').classList.remove('open');
}

function confirmAction() {
  if (typeof confirmCallback === 'function') confirmCallback();
  closeConfirmModal();
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', renderAll);