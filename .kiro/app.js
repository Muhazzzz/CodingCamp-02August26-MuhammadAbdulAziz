/* =============================================
   LIFE DASHBOARD — app.js
   Vanilla JS · LocalStorage · No dependencies
   ============================================= */

'use strict';

/* ─────────────────────────────────────────────
   STORAGE KEYS
───────────────────────────────────────────── */
const TASKS_KEY = 'lifeDashboard_tasks';
const LINKS_KEY = 'lifeDashboard_links';
const THEME_KEY = 'lifeDashboard_theme';
const NAME_KEY  = 'lifeDashboard_name';

/* ─────────────────────────────────────────────
   STATE
───────────────────────────────────────────── */
/** @type {Task[]} */
let tasks = [];

/** @type {Link[]} */
let links = [];

// Task UI filters
let activeFilter = 'all';   // all | active | completed | overdue
let activeCat    = 'all';
let activeSort   = 'newest';
let searchQuery  = '';

// Toast
let toastTimer = null;

/* ─────────────────────────────────────────────
   TYPES (JSDoc)
───────────────────────────────────────────── */
/**
 * @typedef {Object} Task
 * @property {string}  id
 * @property {string}  text
 * @property {string}  category
 * @property {'low'|'medium'|'high'} priority
 * @property {string}  dueDate    – ISO date string or ''
 * @property {boolean} completed
 * @property {string}  createdAt  – ISO datetime string
 */

/**
 * @typedef {Object} Link
 * @property {string} id
 * @property {string} name
 * @property {string} url
 */

/* ─────────────────────────────────────────────
   DOM HELPERS
───────────────────────────────────────────── */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  // Greeting
  greetingText:   $('#greeting-text'),
  clockDisplay:   $('#clock-display'),
  dateDisplay:    $('#date-display'),
  nameDisplay:    $('#name-display'),
  nameEditBtn:    $('#name-edit-btn'),
  nameForm:       $('#name-form'),
  nameInput:      $('#name-input'),
  nameCancelBtn:  $('#name-cancel-btn'),

  // Theme
  themeToggle:    $('#theme-toggle'),
  themeIcon:      $('#theme-icon'),

  // Timer
  timerDisplay:      $('#timer-display'),
  timerLabel:        $('#timer-label'),
  timerRingFill:     $('#timer-ring-fill'),
  timerStartBtn:     $('#timer-start-btn'),
  timerBtnIcon:      $('#timer-btn-icon'),
  timerBtnText:      $('#timer-btn-text'),
  timerResetBtn:     $('#timer-reset-btn'),
  presetBtns:        $$('.preset-btn'),
  customTimerForm:   $('#custom-timer-form'),
  customMinutesInput:$('#custom-minutes'),

  // Quick Links
  linkForm:       $('#link-form'),
  linkName:       $('#link-name'),
  linkUrl:        $('#link-url'),
  linkList:       $('#link-list'),
  linksEmpty:     $('#links-empty'),

  // Header progress
  progressText:   $('#progress-text'),
  progressFill:   $('#progress-bar-fill'),
  progressAria:   $('#progress-bar-aria'),

  // Stats chips
  statTotal:      $('#stat-total'),
  statDone:       $('#stat-done'),
  statPending:    $('#stat-pending'),
  statOverdue:    $('#stat-overdue'),
  overdueChip:    $('.overdue-chip'),

  // Task form
  taskForm:       $('#task-form'),
  taskInput:      $('#task-input'),
  taskCategory:   $('#task-category'),
  taskDue:        $('#task-due'),

  // Toolbar
  filterTabs:     $$('.tab'),
  categoryFilter: $('#category-filter'),
  sortSelect:     $('#sort-select'),
  clearCompleted: $('#clear-completed-btn'),
  searchInput:    $('#search-input'),

  // Task list & states
  taskList:       $('#task-list'),
  emptyState:     $('#empty-state'),
  noResults:      $('#no-results'),

  // Edit modal
  editModal:      $('#edit-modal'),
  editForm:       $('#edit-form'),
  editId:         $('#edit-id'),
  editInput:      $('#edit-input'),
  editCategory:   $('#edit-category'),
  editDue:        $('#edit-due'),
  modalCloseBtn:  $('#modal-close-btn'),
  modalCancelBtn: $('#modal-cancel-btn'),

  // Toast
  toast:          $('#toast'),
};

/* ═══════════════════════════════════════════════
   SECTION 1 — GREETING & LIVE CLOCK
═══════════════════════════════════════════════ */

const GREETINGS = {
  night:     'Good night 🌙',
  morning:   'Good morning ☀️',
  afternoon: 'Good afternoon 🌤',
  evening:   'Good evening 🌇',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return GREETINGS.morning;
  if (h >= 12 && h < 17) return GREETINGS.afternoon;
  if (h >= 17 && h < 21) return GREETINGS.evening;
  return GREETINGS.night;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function tickClock() {
  const now  = new Date();
  const h    = pad2(now.getHours());
  const m    = pad2(now.getMinutes());
  const s    = pad2(now.getSeconds());

  dom.clockDisplay.textContent = `${h}:${m}:${s}`;
  dom.greetingText.textContent = buildGreetingText();
  dom.dateDisplay.textContent  = now.toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function initClock() {
  tickClock();
  setInterval(tickClock, 1000);
}

/* ═══════════════════════════════════════════════
   SECTION 2 — FOCUS TIMER
═══════════════════════════════════════════════ */

// SVG ring circumference: 2π × r = 2π × 52 ≈ 326.73
const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

const timerState = {
  totalSeconds:   25 * 60,   // chosen duration
  secondsLeft:    25 * 60,   // countdown value
  running:        false,
  intervalId:     null,
};

/* ── helpers ── */
function timerSetRing(secondsLeft, total) {
  const ratio  = secondsLeft / total;
  const offset = RING_CIRCUMFERENCE * (1 - ratio);
  dom.timerRingFill.style.strokeDashoffset = offset;

  // Colour feedback: <25% = warning, <10% = urgent
  dom.timerRingFill.classList.remove('warning', 'urgent');
  if (ratio < 0.1)      dom.timerRingFill.classList.add('urgent');
  else if (ratio < 0.25) dom.timerRingFill.classList.add('warning');
}

function timerSetDisplay(secondsLeft) {
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  dom.timerDisplay.textContent = `${pad2(m)}:${pad2(s)}`;
}

function timerSetButton(running) {
  dom.timerBtnIcon.textContent = running ? '⏸' : '▶';
  dom.timerBtnText.textContent = running ? 'Pause' : 'Start';
  dom.timerStartBtn.setAttribute('aria-label', running ? 'Pause timer' : 'Start timer');
}

function timerRefreshUI() {
  timerSetDisplay(timerState.secondsLeft);
  timerSetRing(timerState.secondsLeft, timerState.totalSeconds);
  timerSetButton(timerState.running);
  dom.timerLabel.textContent = timerState.running ? 'focus' : (timerState.secondsLeft === timerState.totalSeconds ? 'ready' : 'paused');
}

/* ── tick ── */
function timerTick() {
  if (timerState.secondsLeft <= 0) {
    timerStop();
    timerState.secondsLeft = 0;
    timerRefreshUI();
    dom.timerLabel.textContent = 'done ✓';
    showToast('⏱ Focus session complete! Take a break.', 4000);
    // Browser notification if permitted
    if (Notification.permission === 'granted') {
      new Notification('Life Dashboard', { body: 'Focus session complete! Time for a break.' });
    }
    return;
  }
  timerState.secondsLeft--;
  timerRefreshUI();
}

/* ── controls ── */
function timerStart() {
  if (timerState.running) return;
  timerState.running    = true;
  timerState.intervalId = setInterval(timerTick, 1000);
  timerRefreshUI();
  // Request notification permission on first start
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function timerStop() {
  timerState.running = false;
  clearInterval(timerState.intervalId);
  timerState.intervalId = null;
  timerRefreshUI();
}

function timerReset() {
  timerStop();
  timerState.secondsLeft = timerState.totalSeconds;
  timerRefreshUI();
}

function timerSetDuration(minutes) {
  timerStop();
  timerState.totalSeconds = minutes * 60;
  timerState.secondsLeft  = timerState.totalSeconds;
  timerRefreshUI();

  // Update preset button active state
  dom.presetBtns.forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.minutes) === minutes);
  });
}

/* ── event bindings ── */
dom.timerStartBtn.addEventListener('click', () => {
  timerState.running ? timerStop() : timerStart();
});

dom.timerResetBtn.addEventListener('click', timerReset);

dom.presetBtns.forEach(btn => {
  btn.addEventListener('click', () => timerSetDuration(Number(btn.dataset.minutes)));
});

/* ═══════════════════════════════════════════════
   SECTION 3 — QUICK LINKS  (LocalStorage)
═══════════════════════════════════════════════ */

/* ── persistence ── */
function loadLinks() {
  try {
    const raw = localStorage.getItem(LINKS_KEY);
    links = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(links)) links = [];
  } catch { links = []; }
}

function saveLinks() {
  try {
    localStorage.setItem(LINKS_KEY, JSON.stringify(links));
  } catch { showToast('Storage error — links may not be saved.', 4000); }
}

/* ── helpers ── */
function normaliseUrl(raw) {
  raw = raw.trim();
  if (!raw) return '';
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  return raw;
}

function faviconUrl(url) {
  try {
    const origin = new URL(url).origin;
    return `https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(origin)}`;
  } catch { return ''; }
}

/* ── render ── */
function renderLinks() {
  dom.linksEmpty.hidden = links.length > 0;

  if (links.length === 0) {
    dom.linkList.innerHTML = '';
    return;
  }

  dom.linkList.innerHTML = links.map(link => {
    const favicon = faviconUrl(link.url);
    const safeName = escapeHtml(link.name);
    const safeUrl  = escapeHtml(link.url);
    return `
      <li class="link-item" data-id="${link.id}">
        ${favicon
          ? `<img class="link-favicon" src="${favicon}" alt="" aria-hidden="true"
                  onerror="this.style.display='none'">`
          : ''}
        <a class="link-anchor" href="${safeUrl}" target="_blank"
           rel="noopener noreferrer" title="${safeUrl}">${safeName}</a>
        <button class="link-delete-btn" data-id="${link.id}"
                aria-label="Delete link ${safeName}" title="Delete">✕</button>
      </li>`;
  }).join('');
}

/* ── CRUD ── */
function addLink(name, url) {
  links.push({ id: generateId(), name: name.trim(), url });
  saveLinks();
  renderLinks();
  showToast(`Link "${name}" added`);
}

function deleteLink(id) {
  links = links.filter(l => l.id !== id);
  saveLinks();
  renderLinks();
  showToast('Link removed');
}

/* ── form ── */
dom.linkForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = dom.linkName.value.trim();
  const url  = normaliseUrl(dom.linkUrl.value);

  if (!name) { dom.linkName.focus(); showToast('Enter a label for the link'); return; }
  if (!url)  { dom.linkUrl.focus();  showToast('Enter a URL'); return; }

  // Basic URL validation
  try { new URL(url); } catch {
    showToast('Please enter a valid URL'); dom.linkUrl.focus(); return;
  }

  addLink(name, url);
  dom.linkName.value = '';
  dom.linkUrl.value  = '';
  dom.linkName.focus();
});

/* ── delete delegation ── */
dom.linkList.addEventListener('click', (e) => {
  const btn = e.target.closest('.link-delete-btn');
  if (btn) deleteLink(btn.dataset.id);
});

/* ═══════════════════════════════════════════════
   SECTION 4 — TASKS  (LocalStorage)
═══════════════════════════════════════════════ */

/* ── persistence ── */
function loadTasks() {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    tasks = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(tasks)) tasks = [];
  } catch { tasks = []; }
}

function saveTasks() {
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  } catch { showToast('Storage error — tasks may not be saved.', 4000); }
}

/* ── date helpers ── */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(task) {
  if (!task.dueDate || task.completed) return false;
  return task.dueDate < todayISO();
}

function isToday(task) {
  return task.dueDate === todayISO();
}

function formatDate(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d))
    .toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCreated(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getPriorityOrder(p) {
  return p === 'high' ? 0 : p === 'medium' ? 1 : 2;
}

/* ── filter / sort ── */
function getFilteredSortedTasks() {
  let list = [...tasks];

  if (activeFilter === 'active')    list = list.filter(t => !t.completed);
  if (activeFilter === 'completed') list = list.filter(t => t.completed);
  if (activeFilter === 'overdue')   list = list.filter(t => isOverdue(t));
  if (activeCat !== 'all')          list = list.filter(t => t.category === activeCat);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(t => t.text.toLowerCase().includes(q));
  }

  list.sort((a, b) => {
    switch (activeSort) {
      case 'oldest':   return new Date(a.createdAt) - new Date(b.createdAt);
      case 'priority': return getPriorityOrder(a.priority) - getPriorityOrder(b.priority);
      case 'due': {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      case 'alpha':   return a.text.localeCompare(b.text);
      default:        return new Date(b.createdAt) - new Date(a.createdAt);
    }
  });

  return list;
}

/* ── render ── */
const CATEGORY_LABELS = {
  personal: '🏠 Personal', work: '💼 Work', health: '💪 Health',
  learning: '📚 Learning', finance: '💰 Finance', social: '🤝 Social',
};

function buildTaskHTML(task) {
  const over    = isOverdue(task);
  const today   = isToday(task);
  const classes = ['task-item', task.completed ? 'completed' : '', over ? 'overdue' : '']
    .filter(Boolean).join(' ');

  const dueLabelClass = over ? 'overdue' : today ? 'today' : '';
  const dueLabel = task.dueDate
    ? `<span class="due-date ${dueLabelClass}">
         <span aria-hidden="true">${over ? '⚠️' : '📅'}</span>
         ${over ? 'Overdue · ' : today ? 'Today · ' : ''}${formatDate(task.dueDate)}
       </span>`
    : '';

  return `
    <li class="${classes}" data-id="${task.id}" data-priority="${task.priority}"
        aria-label="${escapeHtml(task.text)}${task.completed ? ' (completed)' : ''}">
      <input type="checkbox" class="task-checkbox"
             aria-label="Mark '${escapeHtml(task.text)}' as ${task.completed ? 'incomplete' : 'complete'}"
             ${task.completed ? 'checked' : ''} />
      <div class="task-body">
        <p class="task-text">${escapeHtml(task.text)}</p>
        <div class="task-meta">
          <span class="badge badge-${task.category}">${CATEGORY_LABELS[task.category] || task.category}</span>
          ${dueLabel}
          <span class="created-date">Added ${formatCreated(task.createdAt)}</span>
        </div>
      </div>
      <div class="task-actions" aria-label="Task actions">
        <button class="btn-icon edit-btn"   data-id="${task.id}" title="Edit"   aria-label="Edit task">✏️</button>
        <button class="btn-icon danger delete-btn" data-id="${task.id}" title="Delete" aria-label="Delete task">🗑️</button>
      </div>
    </li>`;
}

function renderTasks() {
  const filtered  = getFilteredSortedTasks();
  const hasTasks  = tasks.length > 0;
  const hasResult = filtered.length > 0;

  if (!hasTasks) {
    dom.taskList.innerHTML = '';
    dom.emptyState.hidden  = false;
    dom.noResults.hidden   = true;
    return;
  }
  if (!hasResult) {
    dom.taskList.innerHTML = '';
    dom.emptyState.hidden  = true;
    dom.noResults.hidden   = false;
    return;
  }
  dom.emptyState.hidden  = true;
  dom.noResults.hidden   = true;
  dom.taskList.innerHTML = filtered.map(buildTaskHTML).join('');
}

function updateStats() {
  const total   = tasks.length;
  const done    = tasks.filter(t => t.completed).length;
  const pending = total - done;
  const overdue = tasks.filter(t => isOverdue(t)).length;

  dom.statTotal.textContent   = total;
  dom.statDone.textContent    = done;
  dom.statPending.textContent = pending;
  dom.statOverdue.textContent = overdue;

  dom.overdueChip?.classList.toggle('has-overdue', overdue > 0);

  // Header progress bar
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  dom.progressText.textContent = `${done} / ${total}`;
  dom.progressFill.style.width = `${pct}%`;
  dom.progressAria.setAttribute('aria-valuenow', pct);
}

function renderAll() {
  renderTasks();
  updateStats();
}

/* ── CRUD ── */
function addTask({ text, category, priority, dueDate }) {
  tasks.unshift({
    id:        generateId(),
    text:      text.trim(),
    category, priority,
    dueDate:   dueDate || '',
    completed: false,
    createdAt: new Date().toISOString(),
  });
  saveTasks();
  renderAll();
  showToast('Task added ✓');
}

function toggleTask(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  t.completed = !t.completed;
  saveTasks();
  renderAll();
  showToast(t.completed ? 'Marked complete 🎉' : 'Marked as active');
}

function deleteTask(id) {
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  tasks.splice(idx, 1);
  saveTasks();
  renderAll();
  showToast('Task deleted');
}

function updateTask(id, { text, category, priority, dueDate }) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  t.text = text.trim(); t.category = category;
  t.priority = priority; t.dueDate = dueDate || '';
  saveTasks();
  renderAll();
  showToast('Task updated ✓');
}

function clearCompleted() {
  const count = tasks.filter(t => t.completed).length;
  if (!count) { showToast('No completed tasks to clear'); return; }
  tasks = tasks.filter(t => !t.completed);
  saveTasks();
  renderAll();
  showToast(`Cleared ${count} completed task${count > 1 ? 's' : ''}`);
}

/* ── modal ── */
function openEditModal(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  dom.editId.value       = t.id;
  dom.editInput.value    = t.text;
  dom.editCategory.value = t.category;
  dom.editDue.value      = t.dueDate;
  dom.editForm.querySelectorAll('input[name="edit-priority"]')
    .forEach(r => { r.checked = r.value === t.priority; });
  dom.editModal.hidden = false;
  dom.editInput.focus();
}

function closeEditModal() { dom.editModal.hidden = true; }

/* ── task form ── */
function getRadio(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value ?? 'medium';
}

dom.taskForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = dom.taskInput.value.trim();
  if (!text) { dom.taskInput.focus(); showToast('Please enter a task description'); return; }
  addTask({ text, category: dom.taskCategory.value, priority: getRadio('priority'), dueDate: dom.taskDue.value });
  dom.taskInput.value = '';
  dom.taskDue.value   = '';
  document.querySelector('input[name="priority"][value="medium"]').checked = true;
  dom.taskInput.focus();
});

/* ── edit form ── */
dom.editForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = dom.editInput.value.trim();
  if (!text) { dom.editInput.focus(); return; }
  updateTask(dom.editId.value, {
    text, category: dom.editCategory.value,
    priority: getRadio('edit-priority'), dueDate: dom.editDue.value,
  });
  closeEditModal();
});

dom.modalCloseBtn.addEventListener('click', closeEditModal);
dom.modalCancelBtn.addEventListener('click', closeEditModal);
dom.editModal.addEventListener('click', (e) => { if (e.target === dom.editModal) closeEditModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !dom.editModal.hidden) closeEditModal(); });

/* ── task list events (delegation) ── */
dom.taskList.addEventListener('change', (e) => {
  if (e.target.classList.contains('task-checkbox')) {
    const id = e.target.closest('.task-item')?.dataset.id;
    if (id) toggleTask(id);
  }
});

dom.taskList.addEventListener('click', (e) => {
  const editBtn   = e.target.closest('.edit-btn');
  const deleteBtn = e.target.closest('.delete-btn');
  if (editBtn)   openEditModal(editBtn.dataset.id);
  if (deleteBtn) {
    const t = tasks.find(t => t.id === deleteBtn.dataset.id);
    if (t && confirm(`Delete "${t.text}"?`)) deleteTask(t.id);
  }
});

/* ── filter / sort / search ── */
dom.filterTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    dom.filterTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeFilter = tab.dataset.filter;
    renderTasks();
  });
});

dom.categoryFilter.addEventListener('change', () => { activeCat  = dom.categoryFilter.value; renderTasks(); });
dom.sortSelect.addEventListener('change',     () => { activeSort = dom.sortSelect.value;     renderTasks(); });

let searchTimer = null;
dom.searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { searchQuery = dom.searchInput.value.trim(); renderTasks(); }, 200);
});

dom.clearCompleted.addEventListener('click', () => {
  if (confirm('Remove all completed tasks?')) clearCompleted();
});

/* ═══════════════════════════════════════════════
   SECTION 5 — DARK / LIGHT MODE
═══════════════════════════════════════════════ */

function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  dom.themeIcon.textContent = dark ? '☀️' : '🌙';
  dom.themeToggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  dom.themeToggle.setAttribute('title',      dark ? 'Switch to light mode' : 'Switch to dark mode');
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  // If no preference saved, respect OS setting
  const prefersDark = saved !== null
    ? saved === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(prefersDark);
}

dom.themeToggle.addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  applyTheme(!isDark);
  localStorage.setItem(THEME_KEY, !isDark ? 'dark' : 'light');
});

// Keep in sync if OS theme changes while page is open
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (localStorage.getItem(THEME_KEY) === null) applyTheme(e.matches);
});

/* ═══════════════════════════════════════════════
   SECTION 6 — CUSTOM NAME IN GREETING
═══════════════════════════════════════════════ */

let userName = '';

function loadName() {
  userName = localStorage.getItem(NAME_KEY) || '';
}

function saveName(name) {
  userName = name.trim();
  if (userName) localStorage.setItem(NAME_KEY, userName);
  else          localStorage.removeItem(NAME_KEY);
}

function renderNameDisplay() {
  dom.nameDisplay.textContent = userName ? `👋 ${userName}` : '';
  dom.nameEditBtn.setAttribute('aria-label', userName ? 'Edit your name' : 'Set your name');
  dom.nameEditBtn.title = userName ? 'Edit your name' : 'Set your name';
}

function buildGreetingText() {
  const base = getGreeting();
  return userName ? `${base}, ${userName}!` : `${base}!`;
}

function openNameForm() {
  dom.nameInput.value  = userName;
  dom.nameForm.hidden  = false;
  dom.nameEditBtn.hidden = true;
  dom.nameDisplay.hidden = true;
  dom.nameInput.focus();
  dom.nameInput.select();
}

function closeNameForm() {
  dom.nameForm.hidden    = true;
  dom.nameEditBtn.hidden = false;
  dom.nameDisplay.hidden = false;
}

dom.nameEditBtn.addEventListener('click', openNameForm);
dom.nameCancelBtn.addEventListener('click', closeNameForm);

dom.nameForm.addEventListener('submit', (e) => {
  e.preventDefault();
  saveName(dom.nameInput.value);
  renderNameDisplay();
  closeNameForm();
  showToast(userName ? `Hi, ${userName}! 👋` : 'Name cleared');
});

dom.nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeNameForm();
});

/* ═══════════════════════════════════════════════
   SECTION 7 — CUSTOM TIMER DURATION
═══════════════════════════════════════════════ */

dom.customTimerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const raw = parseInt(dom.customMinutesInput.value, 10);

  if (!raw || raw < 1 || raw > 180) {
    showToast('Enter a duration between 1 and 180 minutes');
    dom.customMinutesInput.focus();
    return;
  }

  // Deactivate all presets — none matches a custom value
  dom.presetBtns.forEach(btn => btn.classList.remove('active'));

  timerSetDuration(raw);
  dom.customMinutesInput.value = '';
  showToast(`Timer set to ${raw} min`);
});

/* ═══════════════════════════════════════════════
   SHARED UTILITIES
═══════════════════════════════════════════════ */

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function showToast(message, duration = 2500) {
  dom.toast.textContent = message;
  dom.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.remove('show'), duration);
}

/* ═══════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════ */
function init() {
  // Theme (before paint to avoid flash)
  initTheme();

  // Clock
  initClock();

  // Timer
  timerRefreshUI();

  // Custom name
  loadName();
  renderNameDisplay();

  // Tasks
  loadTasks();

  // Links
  loadLinks();
  renderLinks();

  // Render task UI
  renderAll();

  // Set min date on date pickers
  const today = todayISO();
  dom.taskDue.min = today;
  dom.editDue.min = today;
}

init();
