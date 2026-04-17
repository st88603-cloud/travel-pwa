/* ============================================
   旅途 Travel App — app.js
   ============================================ */
'use strict';

// ===== STATE =====
let state = {
  trips: [],
  currentTripId: null,
  currentDay: 1,
  checklistTab: 'luggage',
  checklists: { luggage: [], todo: [] },
  notepad: '',
  editingItemId: null,
  editingTripId: null,
  sortMode: false,
};

// ===== STORAGE =====
const uid = () => Math.random().toString(36).slice(2, 10);

function save() {
  try {
    localStorage.setItem('travel_state', JSON.stringify({
      trips: state.trips,
      currentTripId: state.currentTripId,
      checklists: state.checklists,
      notepad: state.notepad,
    }));
  } catch(e) { console.warn('save failed', e); }
}

function load() {
  try {
    const raw = localStorage.getItem('travel_state');
    if (!raw) return;
    const d = JSON.parse(raw);
    state.trips         = d.trips         || [];
    state.currentTripId = d.currentTripId || null;
    state.checklists    = d.checklists    || { luggage: [], todo: [] };
    state.notepad       = d.notepad       || '';
  } catch(e) { console.warn('load failed', e); }
}

function getCurrentTrip() {
  return state.trips.find(t => t.id === state.currentTripId) || null;
}

// ===== TOAST =====
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

// ===== HELPERS =====
const TYPE_CONFIG = {
  attraction: { label: '景點', emoji: '🏛' },
  food:       { label: '餐廳', emoji: '🍜' },
  transport:  { label: '交通', emoji: '🚆' },
  hotel:      { label: '住宿', emoji: '🏨' },
};

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function addMinutes(timeStr, mins) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total/60)%24).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
}

function mapUrl(address, name) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || name)}`;
}

// Convert plain-text URLs to clickable links (safe, no XSS)
function linkifyText(text) {
  const escaped = escHtml(text);
  return escaped.replace(
    /(https?:\/\/[^\s&<>"]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
}

// Validate / normalise a URL (add https:// if missing scheme)
function normaliseUrl(raw) {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return 'https://' + trimmed;
}

// ===== RENDER ALL =====
function renderAll() {
  renderTopbar();
  renderDayTabs();
  renderSchedule();
  renderTripsSidebar();
}

// ===== TOPBAR =====
function renderTopbar() {
  const trip = getCurrentTrip();
  document.getElementById('current-trip-name').textContent = trip ? trip.name : '尚無行程';
  document.getElementById('btn-fab').style.display = trip ? 'flex' : 'none';
}

// ===== DAY TABS =====
function renderDayTabs() {
  const trip = getCurrentTrip();
  const container = document.getElementById('days-tabs');
  container.innerHTML = '';
  if (!trip) return;
  for (let d = 1; d <= trip.days; d++) {
    const btn = document.createElement('button');
    btn.className = 'day-tab' + (d === state.currentDay ? ' active' : '');
    btn.textContent = `Day ${d}`;
    btn.addEventListener('click', () => {
      state.currentDay = d;
      state.sortMode = false;
      renderDayTabs();
      renderSchedule();
    });
    container.appendChild(btn);
  }
}

// ===== SCHEDULE =====
function renderSchedule() {
  const trip = getCurrentTrip();
  const emptyEl      = document.getElementById('empty-state');
  const scheduleEl   = document.getElementById('schedule-view');
  const sortToggleEl = document.getElementById('sort-toggle-btn');

  if (!trip) {
    emptyEl.style.display      = 'flex';
    scheduleEl.style.display   = 'none';
    sortToggleEl.style.display = 'none';
    return;
  }
  emptyEl.style.display    = 'none';
  scheduleEl.style.display = 'block';

  const items = (trip.days_data[state.currentDay] || []).slice().sort((a,b) => a.time.localeCompare(b.time));
  const list  = document.getElementById('items-list');
  list.innerHTML = '';
  list.classList.toggle('sort-mode', state.sortMode);

  if (items.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:50px 0 30px;color:var(--text3);font-size:14px;line-height:2.4;">這天還沒有行程<br><span style="font-size:12px;">點右下角 + 快速新增</span></div>`;
  } else {
    items.forEach((item, idx) => list.appendChild(createItemEl(item, idx, items.length)));
    setupDragDrop();
  }

  sortToggleEl.style.display = items.length > 1 ? 'block' : 'none';
  sortToggleEl.className     = 'sort-toggle' + (state.sortMode ? ' active' : '');
  sortToggleEl.textContent   = state.sortMode ? '✓ 完成排序' : '⇅ 排序';
}

function createItemEl(item, idx, total) {
  const wrap = document.createElement('div');
  wrap.className = 'schedule-item';
  wrap.dataset.id = item.id;
  wrap.draggable = true;

  const typeConf = TYPE_CONFIG[item.type] || TYPE_CONFIG.attraction;
  const address  = item.address || '';
  const url      = item.url     || '';

  let addressHtml = '';
  if (address) {
    addressHtml = `
      <div class="item-address">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <span>${escHtml(address)}</span>
      </div>
      <a class="map-link" href="${mapUrl(address, item.place)}" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7l6-3 5.447 2.724A1 1 0 0121 7.618v10.764a1 1 0 01-1.447.894L15 17l-6 3z"/><line x1="9" y1="7" x2="9" y2="20"/><line x1="15" y1="4" x2="15" y2="17"/></svg>
        在 Google Maps 開啟
      </a>`;
  }

  const noteHtml = item.note
    ? `<div class="item-note">${escHtml(item.note)}</div>`
    : '';

  const urlHtml = url
    ? `<a class="item-url-link" href="${escHtml(url)}" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
        ${escHtml(shortenUrl(url))}
      </a>`
    : '';

  wrap.innerHTML = `
    <div class="item-timeline">
      <span class="item-time">${escHtml(item.time)}</span>
      <div class="item-dot type-${item.type}"></div>
      <div class="item-line"></div>
    </div>
    <div class="item-card type-${item.type}">
      <div class="item-card-header">
        <span class="item-place">${escHtml(item.place)}</span>
        <span class="item-type-badge">${typeConf.emoji} ${typeConf.label}</span>
      </div>
      ${addressHtml}
      ${noteHtml}
      ${urlHtml}
      <div class="item-sort-controls">
        ${idx > 0       ? `<button class="sort-btn sort-up"   data-id="${item.id}">↑</button>` : '<span></span>'}
        ${idx < total-1 ? `<button class="sort-btn sort-down" data-id="${item.id}">↓</button>` : ''}
      </div>
    </div>
  `;

  wrap.querySelector('.item-card').addEventListener('click', function(e) {
    if (e.target.closest('.item-sort-controls') || e.target.closest('.map-link') || e.target.closest('.item-url-link')) return;
    if (state.sortMode) return;
    openEditItem(item.id);
  });

  const upEl = wrap.querySelector('.sort-up');
  if (upEl) upEl.addEventListener('click', e => { e.stopPropagation(); moveItem(item.id, -1); });
  const dnEl = wrap.querySelector('.sort-down');
  if (dnEl) dnEl.addEventListener('click', e => { e.stopPropagation(); moveItem(item.id, 1); });

  return wrap;
}

function shortenUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const path = u.pathname.length > 20 ? u.pathname.slice(0, 18) + '…' : u.pathname;
    return host + (path === '/' ? '' : path);
  } catch {
    return url.length > 40 ? url.slice(0, 38) + '…' : url;
  }
}

// ===== MOVE ITEM =====
function moveItem(itemId, delta) {
  const trip = getCurrentTrip();
  if (!trip) return;
  const items = (trip.days_data[state.currentDay] || []).slice().sort((a,b) => a.time.localeCompare(b.time));
  const idx = items.findIndex(i => i.id === itemId);
  const newIdx = idx + delta;
  if (newIdx < 0 || newIdx >= items.length) return;
  const t1 = items[idx].time, t2 = items[newIdx].time;
  if (t1 === t2) { items[idx].time = addMinutes(t2, 1); }
  else { items[idx].time = t2; items[newIdx].time = t1; }
  save(); renderSchedule();
}

// ===== DRAG AND DROP =====
let dragSrcId = null;

function setupDragDrop() {
  document.querySelectorAll('.schedule-item').forEach(el => {
    el.addEventListener('dragstart', e => { dragSrcId = el.dataset.id; el.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    el.addEventListener('dragend',   () => { el.classList.remove('dragging'); document.querySelectorAll('.schedule-item').forEach(i => i.classList.remove('drag-over')); });
    el.addEventListener('dragover',  e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; document.querySelectorAll('.schedule-item').forEach(i => i.classList.remove('drag-over')); el.classList.add('drag-over'); });
    el.addEventListener('drop',      e => { e.preventDefault(); if (dragSrcId && dragSrcId !== el.dataset.id) swapItemsByDrag(dragSrcId, el.dataset.id); });
  });
}

function swapItemsByDrag(id1, id2) {
  const trip = getCurrentTrip();
  if (!trip) return;
  const items = trip.days_data[state.currentDay] || [];
  const a = items.find(i => i.id === id1), b = items.find(i => i.id === id2);
  if (!a || !b) return;
  const t = a.time; a.time = b.time; b.time = t;
  save(); renderSchedule(); showToast('已重新排序');
}

// ===== TRIPS SIDEBAR =====
function renderTripsSidebar() {
  const list = document.getElementById('trips-list');
  list.innerHTML = '';
  if (state.trips.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3);font-size:14px;line-height:2;">還沒有行程<br>點右上角 ⊕ 新增</div>';
    return;
  }
  state.trips.forEach(trip => {
    const el = document.createElement('div');
    el.className = 'trip-card' + (trip.id === state.currentTripId ? ' active' : '');
    const dateStr = trip.startDate ? `${trip.startDate} 起` : '';
    el.innerHTML = `
      <div class="trip-card-name">${escHtml(trip.name)}</div>
      <div class="trip-card-meta">
        <span>📍 ${escHtml(trip.dest || '未設定')}</span>
        <span>🗓 ${trip.days} 天</span>
        ${dateStr ? `<span>${escHtml(dateStr)}</span>` : ''}
      </div>
      <div class="trip-card-actions">
        <button class="btn-edit-trip">✏️ 編輯</button>
      </div>`;
    el.addEventListener('click', e => {
      if (e.target.closest('.btn-edit-trip')) return;
      state.currentTripId = trip.id; state.currentDay = 1; state.sortMode = false;
      save(); renderAll(); closeSidebar();
      showToast(`已切換到「${trip.name}」`);
    });
    el.querySelector('.btn-edit-trip').addEventListener('click', e => { e.stopPropagation(); openEditTrip(trip.id); });
    list.appendChild(el);
  });
}

// ===== MODAL HELPERS =====
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function openSidebar()  { document.getElementById('sidebar-trips').classList.add('open');    document.getElementById('overlay-trips').classList.add('open'); }
function closeSidebar() { document.getElementById('sidebar-trips').classList.remove('open'); document.getElementById('overlay-trips').classList.remove('open'); }

// ===== NEW TRIP =====
function openNewTrip() {
  ['input-trip-name','input-trip-dest','input-trip-date'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('input-trip-days').value = '5';
  openModal('modal-new-trip');
  setTimeout(() => document.getElementById('input-trip-name').focus(), 350);
}

document.getElementById('btn-save-trip').addEventListener('click', () => {
  const name = document.getElementById('input-trip-name').value.trim();
  if (!name) { showToast('請輸入行程名稱'); return; }
  const trip = {
    id: uid(), name,
    dest:      document.getElementById('input-trip-dest').value.trim(),
    startDate: document.getElementById('input-trip-date').value,
    days: Math.min(Math.max(parseInt(document.getElementById('input-trip-days').value)||5, 1), 30),
    days_data: {}, createdAt: Date.now(),
  };
  state.trips.unshift(trip);
  state.currentTripId = trip.id; state.currentDay = 1; state.sortMode = false;
  save(); closeModal('modal-new-trip'); renderAll();
  showToast(`已新增「${trip.name}」`);
});
document.getElementById('btn-cancel-trip').addEventListener('click', () => closeModal('modal-new-trip'));

// ===== EDIT TRIP =====
function openEditTrip(tripId) {
  const trip = state.trips.find(t => t.id === tripId);
  if (!trip) return;
  state.editingTripId = tripId;
  document.getElementById('input-edit-trip-name').value = trip.name;
  document.getElementById('input-edit-trip-dest').value = trip.dest || '';
  openModal('modal-edit-trip'); closeSidebar();
}
document.getElementById('btn-update-trip').addEventListener('click', () => {
  const trip = state.trips.find(t => t.id === state.editingTripId);
  if (!trip) return;
  const name = document.getElementById('input-edit-trip-name').value.trim();
  if (!name) { showToast('請輸入行程名稱'); return; }
  trip.name = name;
  trip.dest = document.getElementById('input-edit-trip-dest').value.trim();
  save(); closeModal('modal-edit-trip'); renderAll(); showToast('已更新行程');
});
document.getElementById('btn-delete-trip').addEventListener('click', () => {
  if (!confirm('確定要刪除這個行程嗎？此操作無法復原。')) return;
  state.trips = state.trips.filter(t => t.id !== state.editingTripId);
  if (state.currentTripId === state.editingTripId) { state.currentTripId = state.trips[0]?.id || null; state.currentDay = 1; }
  save(); closeModal('modal-edit-trip'); renderAll(); showToast('已刪除行程');
});

// ===== TYPE SELECTORS =====
let selectedType = 'attraction', selectedTypeEdit = 'attraction';

function setupTypeSelector(cid, setter) {
  document.querySelectorAll(`#${cid} .type-btn`).forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll(`#${cid} .type-btn`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active'); setter(btn.dataset.type);
    });
  });
}
setupTypeSelector('type-selector',      t => { selectedType     = t; });
setupTypeSelector('type-selector-edit', t => { selectedTypeEdit = t; });

// ===== ADD ITEM =====
function getNextTime() {
  const trip = getCurrentTrip();
  if (!trip) return '09:00';
  const items = trip.days_data[state.currentDay] || [];
  if (!items.length) return '09:00';
  return addMinutes(items.slice().sort((a,b) => a.time.localeCompare(b.time)).pop().time, 60);
}

function openAddItem() {
  const trip = getCurrentTrip();
  if (!trip) { showToast('請先新增一個行程'); return; }
  selectedType = 'attraction';
  document.querySelectorAll('#type-selector .type-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('#type-selector .type-btn[data-type="attraction"]').classList.add('active');
  document.getElementById('input-item-time').value    = getNextTime();
  document.getElementById('input-item-place').value   = '';
  document.getElementById('input-item-address').value = '';
  document.getElementById('input-item-note').value    = '';
  document.getElementById('input-item-url').value     = '';
  document.getElementById('modal-item-title').textContent = `新增 Day ${state.currentDay} 行程`;
  openModal('modal-add-item');
  setTimeout(() => document.getElementById('input-item-place').focus(), 350);
}

document.getElementById('btn-save-item').addEventListener('click', () => {
  const place = document.getElementById('input-item-place').value.trim();
  if (!place) { showToast('請輸入地點名稱'); return; }
  const trip = getCurrentTrip();
  if (!trip) return;
  if (!trip.days_data[state.currentDay]) trip.days_data[state.currentDay] = [];
  trip.days_data[state.currentDay].push({
    id: uid(), type: selectedType,
    time:    document.getElementById('input-item-time').value    || '09:00',
    place,
    address: document.getElementById('input-item-address').value.trim(),
    note:    document.getElementById('input-item-note').value.trim(),
    url:     normaliseUrl(document.getElementById('input-item-url').value),
  });
  save(); closeModal('modal-add-item'); renderSchedule();
  showToast(`已新增「${place}」`);
});
document.getElementById('btn-cancel-item').addEventListener('click', () => closeModal('modal-add-item'));

// ===== EDIT ITEM =====
function openEditItem(itemId) {
  const trip = getCurrentTrip();
  if (!trip) return;
  const item = (trip.days_data[state.currentDay]||[]).find(i => i.id === itemId);
  if (!item) return;
  state.editingItemId = itemId;
  selectedTypeEdit    = item.type || 'attraction';
  document.querySelectorAll('#type-selector-edit .type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === item.type));
  document.getElementById('input-edit-time').value    = item.time;
  document.getElementById('input-edit-place').value   = item.place;
  document.getElementById('input-edit-address').value = item.address || '';
  document.getElementById('input-edit-note').value    = item.note    || '';
  document.getElementById('input-edit-url').value     = item.url     || '';
  openModal('modal-edit-item');
}

document.getElementById('btn-update-item').addEventListener('click', () => {
  const trip = getCurrentTrip();
  if (!trip) return;
  const item = (trip.days_data[state.currentDay]||[]).find(i => i.id === state.editingItemId);
  if (!item) return;
  const place = document.getElementById('input-edit-place').value.trim();
  if (!place) { showToast('請輸入地點名稱'); return; }
  item.type    = selectedTypeEdit;
  item.time    = document.getElementById('input-edit-time').value || '09:00';
  item.place   = place;
  item.address = document.getElementById('input-edit-address').value.trim();
  item.note    = document.getElementById('input-edit-note').value.trim();
  item.url     = normaliseUrl(document.getElementById('input-edit-url').value);
  save(); closeModal('modal-edit-item'); renderSchedule(); showToast('已更新');
});
document.getElementById('btn-delete-item').addEventListener('click', () => {
  const trip = getCurrentTrip();
  if (!trip) return;
  trip.days_data[state.currentDay] = (trip.days_data[state.currentDay]||[]).filter(i => i.id !== state.editingItemId);
  save(); closeModal('modal-edit-item'); renderSchedule(); showToast('已刪除');
});

// ===== ADD DAY =====
document.getElementById('btn-add-day').addEventListener('click', () => {
  const trip = getCurrentTrip();
  if (!trip) { showToast('請先新增行程'); return; }
  if (trip.days >= 30) { showToast('最多 30 天'); return; }
  trip.days++; state.currentDay = trip.days; state.sortMode = false;
  save(); renderDayTabs(); renderSchedule(); showToast(`已新增 Day ${trip.days}`);
});

// ===== CHECKLIST =====
function renderChecklist() {
  const items = state.checklists[state.checklistTab] || [];
  const ul = document.getElementById('checklist-items');
  ul.innerHTML = '';
  if (items.length === 0) {
    ul.innerHTML = '<li style="text-align:center;padding:20px;color:var(--text3);font-size:13px;">清單是空的，快新增吧！</li>';
    return;
  }
  items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'checklist-item' + (item.done ? ' done' : '');
    li.innerHTML = `<input type="checkbox" ${item.done?'checked':''}><span>${escHtml(item.text)}</span><button class="checklist-item-del">✕</button>`;
    li.querySelector('input').addEventListener('change', () => { item.done = !item.done; save(); renderChecklist(); });
    li.querySelector('.checklist-item-del').addEventListener('click', () => {
      state.checklists[state.checklistTab] = state.checklists[state.checklistTab].filter(i => i !== item);
      save(); renderChecklist();
    });
    ul.appendChild(li);
  });
}

document.querySelectorAll('.cl-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.cl-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.checklistTab = tab.dataset.list;
    document.getElementById('input-checklist').value = '';
    renderChecklist();
  });
});

function addChecklistItem() {
  const val = document.getElementById('input-checklist').value.trim();
  if (!val) return;
  if (!state.checklists[state.checklistTab]) state.checklists[state.checklistTab] = [];
  state.checklists[state.checklistTab].push({ id: uid(), text: val, done: false });
  document.getElementById('input-checklist').value = '';
  save(); renderChecklist();
}
document.getElementById('btn-add-checklist').addEventListener('click', addChecklistItem);
document.getElementById('input-checklist').addEventListener('keydown', e => { if (e.key==='Enter') addChecklistItem(); });
document.getElementById('btn-clear-done').addEventListener('click', () => {
  state.checklists[state.checklistTab] = (state.checklists[state.checklistTab]||[]).filter(i => !i.done);
  save(); renderChecklist(); showToast('已清除完成項目');
});

// ===== NOTEPAD =====
function openNotepad() {
  const ta      = document.getElementById('notepad-content');
  const preview = document.getElementById('notepad-preview');
  ta.value = state.notepad || '';
  updateNotepadPreview(ta.value, preview);
  openModal('modal-notepad');
  setTimeout(() => ta.focus(), 350);
}

function updateNotepadPreview(text, previewEl) {
  if (!text.trim()) {
    previewEl.classList.remove('has-content');
    previewEl.innerHTML = '';
    return;
  }
  previewEl.classList.add('has-content');
  previewEl.innerHTML = `<span class="notepad-preview-label">預覽（連結可點擊）</span>${linkifyText(text)}`;
}

document.getElementById('notepad-content').addEventListener('input', function() {
  updateNotepadPreview(this.value, document.getElementById('notepad-preview'));
});

document.getElementById('btn-save-notepad').addEventListener('click', () => {
  state.notepad = document.getElementById('notepad-content').value;
  save(); closeModal('modal-notepad'); showToast('筆記已儲存');
});

document.getElementById('btn-clear-notepad').addEventListener('click', () => {
  if (document.getElementById('notepad-content').value.trim() && !confirm('確定清除所有筆記內容？')) return;
  document.getElementById('notepad-content').value = '';
  updateNotepadPreview('', document.getElementById('notepad-preview'));
  state.notepad = ''; save(); showToast('已清除筆記');
});

document.getElementById('btn-notepad').addEventListener('click', openNotepad);
document.getElementById('btn-close-notepad').addEventListener('click', () => {
  // Auto-save on close
  state.notepad = document.getElementById('notepad-content').value;
  save(); closeModal('modal-notepad');
});

// ===== ALL BUTTON EVENTS =====
document.getElementById('btn-checklist').addEventListener('click', () => { renderChecklist(); openModal('modal-checklist'); });
document.getElementById('btn-close-checklist').addEventListener('click', () => closeModal('modal-checklist'));
document.getElementById('btn-trips-menu').addEventListener('click', () => { renderTripsSidebar(); openSidebar(); });
document.getElementById('btn-new-trip').addEventListener('click', () => { closeSidebar(); openNewTrip(); });
document.getElementById('btn-fab').addEventListener('click', openAddItem);
document.getElementById('overlay-trips').addEventListener('click', closeSidebar);
document.getElementById('btn-close-sidebar').addEventListener('click', closeSidebar);
document.getElementById('sort-toggle-btn').addEventListener('click', () => { state.sortMode = !state.sortMode; renderSchedule(); });

['modal-new-trip','modal-edit-trip','modal-add-item','modal-edit-item','modal-checklist','modal-notepad'].forEach(id => {
  document.getElementById(id).addEventListener('click', function(e) { if (e.target === this) closeModal(id); });
});

// ===== SERVICE WORKER =====
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(r => console.log('SW registered', r.scope))
      .catch(e => console.log('SW skipped:', e.message));
  });
}

// ===== PWA INSTALL =====
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredInstall = e;
  setTimeout(() => {
    if (!deferredInstall || document.getElementById('install-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'install-banner'; banner.className = 'install-banner';
    banner.innerHTML = `<p>📱 將旅途加入主畫面，隨時離線使用！</p><button class="btn-primary" id="btn-yes-install">安裝</button><button class="btn-cancel" id="btn-no-install">✕</button>`;
    document.body.appendChild(banner);
    document.getElementById('btn-yes-install').addEventListener('click', () => { deferredInstall.prompt(); deferredInstall.userChoice.then(()=>{ banner.remove(); deferredInstall=null; }); });
    document.getElementById('btn-no-install').addEventListener('click', () => banner.remove());
  }, 5000);
});

// ===== INIT =====
load();
if (!state.checklists)         state.checklists  = { luggage: [], todo: [] };
if (!state.checklists.luggage) state.checklists.luggage = [];
if (!state.checklists.todo)    state.checklists.todo    = [];
if (state.notepad === undefined) state.notepad = '';

const _t = getCurrentTrip();
if (_t && state.currentDay > _t.days) state.currentDay = 1;
if (state.currentDay < 1) state.currentDay = 1;

// First-run demo
if (state.trips.length === 0) {
  const demo = {
    id: uid(), name: '東京五日遊', dest: '日本東京', startDate: '', days: 5,
    days_data: {
      1: [
        { id: uid(), type: 'transport',  time: '08:00', place: '成田機場入境',         address: '千葉縣成田市古込1',          note: '記得帶護照、換好日幣',         url: '' },
        { id: uid(), type: 'transport',  time: '10:30', place: '搭乘成田特急往東京',   address: '',                           note: "N'EX 特急，約 60 分鐘",        url: '' },
        { id: uid(), type: 'hotel',      time: '13:00', place: '飯店入住（新宿）',     address: '東京都新宿區西新宿1-1-1',    note: '提早入住需加費',                url: '' },
        { id: uid(), type: 'attraction', time: '15:00', place: '新宿御苑',             address: '東京都新宿區內藤町11',       note: '門票 500 円，春季賞櫻超美',     url: 'https://www.env.go.jp/garden/shinjukugyoen/' },
        { id: uid(), type: 'food',       time: '18:30', place: '一蘭拉麵 新宿店',      address: '東京都新宿區歌舞伎町1-22-3', note: '博多風味豬骨湯頭',              url: 'https://ichiran.com/tw/' },
      ],
      2: [
        { id: uid(), type: 'attraction', time: '09:00', place: '淺草寺',               address: '東京都台東區淺草2-3-1',      note: '雷門很壯觀，記得拍照',          url: 'https://www.senso-ji.jp/' },
        { id: uid(), type: 'food',       time: '11:30', place: '仲見世通美食街',       address: '東京都台東區淺草1-36-3',     note: '人形燒、草餅必吃',              url: '' },
        { id: uid(), type: 'attraction', time: '14:00', place: '東京晴空塔',           address: '東京都墨田區押上1-1-2',      note: '350m 展望台票 2100 円',         url: 'https://www.tokyo-skytree.jp/' },
      ],
    },
    createdAt: Date.now(),
  };
  state.trips.push(demo);
  state.currentTripId = demo.id;
  state.currentDay    = 1;
  save();
}

renderAll();
