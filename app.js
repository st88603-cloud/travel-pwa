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

// CSV import working state
let csvImportData   = [];   // parsed rows ready to import
let csvImportMode   = 'add'; // 'add' | 'replace'

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
  setTimeout(() => el.classList.remove('show'), 2400);
}

// ===== HELPERS =====
const TYPE_CONFIG = {
  attraction: { label: '景點', emoji: '🏛' },
  food:       { label: '餐廳', emoji: '🍜' },
  transport:  { label: '交通', emoji: '🚆' },
  hotel:      { label: '住宿', emoji: '🏨' },
};
const VALID_TYPES = Object.keys(TYPE_CONFIG);

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function addMinutes(t, m) {
  const [h, mm] = t.split(':').map(Number);
  const total = h*60+mm+m;
  return `${String(Math.floor(total/60)%24).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
}
function mapUrl(a, n) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a||n)}`; }
function normaliseUrl(raw) {
  if (!raw) return '';
  const t = raw.trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : 'https://' + t;
}
function linkifyText(text) {
  return escHtml(text).replace(/(https?:\/\/[^\s&<>"]+)/g,'<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}
function shortenUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./,'');
    const path = u.pathname.length > 20 ? u.pathname.slice(0,18)+'…' : u.pathname;
    return host + (path === '/' ? '' : path);
  } catch { return url.length>40 ? url.slice(0,38)+'…' : url; }
}

// ===== RENDER ALL =====
function renderAll() { renderTopbar(); renderDayTabs(); renderSchedule(); renderTripsSidebar(); }

function renderTopbar() {
  const trip = getCurrentTrip();
  document.getElementById('current-trip-name').textContent = trip ? trip.name : '尚無行程';
  document.getElementById('btn-fab').style.display = trip ? 'flex' : 'none';
}

// ===== DAY TABS =====
function renderDayTabs() {
  const trip = getCurrentTrip();
  const c = document.getElementById('days-tabs');
  c.innerHTML = '';
  if (!trip) return;
  for (let d = 1; d <= trip.days; d++) {
    const btn = document.createElement('button');
    btn.className = 'day-tab' + (d === state.currentDay ? ' active' : '');
    btn.textContent = `Day ${d}`;
    btn.addEventListener('click', () => { state.currentDay = d; state.sortMode = false; renderDayTabs(); renderSchedule(); });
    c.appendChild(btn);
  }
}

// ===== SCHEDULE =====
function renderSchedule() {
  const trip = getCurrentTrip();
  const emptyEl  = document.getElementById('empty-state');
  const schedEl  = document.getElementById('schedule-view');
  const sortBtn  = document.getElementById('sort-toggle-btn');
  if (!trip) { emptyEl.style.display='flex'; schedEl.style.display='none'; sortBtn.style.display='none'; return; }
  emptyEl.style.display='none'; schedEl.style.display='block';

  const items = (trip.days_data[state.currentDay]||[]).slice().sort((a,b)=>a.time.localeCompare(b.time));
  const list  = document.getElementById('items-list');
  list.innerHTML = '';
  list.classList.toggle('sort-mode', state.sortMode);

  if (!items.length) {
    list.innerHTML = `<div style="text-align:center;padding:50px 0 30px;color:var(--text3);font-size:14px;line-height:2.4;">這天還沒有行程<br><span style="font-size:12px;">點右下角 + 快速新增</span></div>`;
  } else {
    items.forEach((item, idx) => list.appendChild(createItemEl(item, idx, items.length)));
    setupDragDrop();
  }
  sortBtn.style.display = items.length > 1 ? 'block' : 'none';
  sortBtn.className     = 'sort-toggle' + (state.sortMode ? ' active' : '');
  sortBtn.textContent   = state.sortMode ? '✓ 完成排序' : '⇅ 排序';
}

function createItemEl(item, idx, total) {
  const wrap = document.createElement('div');
  wrap.className = 'schedule-item';
  wrap.dataset.id = item.id;
  wrap.draggable = true;

  const tc  = TYPE_CONFIG[item.type] || TYPE_CONFIG.attraction;
  const adr = item.address || '';
  const url = item.url     || '';

  let adrHtml = '';
  if (adr) {
    adrHtml = `
      <div class="item-address">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <span>${escHtml(adr)}</span>
      </div>
      <a class="map-link" href="${mapUrl(adr, item.place)}" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7l6-3 5.447 2.724A1 1 0 0121 7.618v10.764a1 1 0 01-1.447.894L15 17l-6 3z"/><line x1="9" y1="7" x2="9" y2="20"/><line x1="15" y1="4" x2="15" y2="17"/></svg>
        在 Google Maps 開啟
      </a>`;
  }
  const noteHtml = item.note ? `<div class="item-note">${escHtml(item.note)}</div>` : '';
  const urlHtml  = url
    ? `<a class="item-url-link" href="${escHtml(url)}" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
        ${escHtml(shortenUrl(url))}
      </a>` : '';

  wrap.innerHTML = `
    <div class="item-timeline">
      <span class="item-time">${escHtml(item.time)}</span>
      <div class="item-dot type-${item.type}"></div>
      <div class="item-line"></div>
    </div>
    <div class="item-card type-${item.type}">
      <div class="item-card-header">
        <span class="item-place">${escHtml(item.place)}</span>
        <span class="item-type-badge">${tc.emoji} ${tc.label}</span>
      </div>
      ${adrHtml}${noteHtml}${urlHtml}
      <div class="item-sort-controls">
        ${idx > 0       ? `<button class="sort-btn sort-up"   data-id="${item.id}">↑</button>` : '<span></span>'}
        ${idx < total-1 ? `<button class="sort-btn sort-down" data-id="${item.id}">↓</button>` : ''}
      </div>
    </div>`;

  wrap.querySelector('.item-card').addEventListener('click', function(e) {
    if (e.target.closest('.item-sort-controls,.map-link,.item-url-link')) return;
    if (state.sortMode) return;
    openEditItem(item.id);
  });
  const up = wrap.querySelector('.sort-up');
  if (up) up.addEventListener('click', e => { e.stopPropagation(); moveItem(item.id,-1); });
  const dn = wrap.querySelector('.sort-down');
  if (dn) dn.addEventListener('click', e => { e.stopPropagation(); moveItem(item.id, 1); });
  return wrap;
}

function moveItem(itemId, delta) {
  const trip = getCurrentTrip(); if (!trip) return;
  const items = (trip.days_data[state.currentDay]||[]).slice().sort((a,b)=>a.time.localeCompare(b.time));
  const idx = items.findIndex(i=>i.id===itemId), newIdx = idx+delta;
  if (newIdx<0||newIdx>=items.length) return;
  const t1=items[idx].time, t2=items[newIdx].time;
  if (t1===t2) { items[idx].time=addMinutes(t2,1); }
  else { items[idx].time=t2; items[newIdx].time=t1; }
  save(); renderSchedule();
}

// ===== DRAG AND DROP =====
let dragSrcId = null;
function setupDragDrop() {
  document.querySelectorAll('.schedule-item').forEach(el => {
    el.addEventListener('dragstart', e => { dragSrcId=el.dataset.id; el.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; });
    el.addEventListener('dragend',   () => { el.classList.remove('dragging'); document.querySelectorAll('.schedule-item').forEach(i=>i.classList.remove('drag-over')); });
    el.addEventListener('dragover',  e => { e.preventDefault(); e.dataTransfer.dropEffect='move'; document.querySelectorAll('.schedule-item').forEach(i=>i.classList.remove('drag-over')); el.classList.add('drag-over'); });
    el.addEventListener('drop',      e => { e.preventDefault(); if(dragSrcId&&dragSrcId!==el.dataset.id) swapDrag(dragSrcId,el.dataset.id); });
  });
}
function swapDrag(id1,id2) {
  const trip=getCurrentTrip(); if(!trip) return;
  const items=trip.days_data[state.currentDay]||[];
  const a=items.find(i=>i.id===id1), b=items.find(i=>i.id===id2);
  if(!a||!b) return;
  const t=a.time; a.time=b.time; b.time=t;
  save(); renderSchedule(); showToast('已重新排序');
}

// ===== SIDEBAR =====
function renderTripsSidebar() {
  const list=document.getElementById('trips-list');
  list.innerHTML='';
  if (!state.trips.length) {
    list.innerHTML='<div style="text-align:center;padding:32px;color:var(--text3);font-size:14px;line-height:2;">還沒有行程<br>點右上角 ⊕ 新增</div>';
    return;
  }
  state.trips.forEach(trip => {
    const el=document.createElement('div');
    el.className='trip-card'+(trip.id===state.currentTripId?' active':'');
    el.innerHTML=`
      <div class="trip-card-name">${escHtml(trip.name)}</div>
      <div class="trip-card-meta">
        <span>📍 ${escHtml(trip.dest||'未設定')}</span>
        <span>🗓 ${trip.days} 天</span>
        ${trip.startDate?`<span>${escHtml(trip.startDate)} 起</span>`:''}
      </div>
      <div class="trip-card-actions"><button class="btn-edit-trip">✏️ 編輯</button></div>`;
    el.addEventListener('click', e => {
      if (e.target.closest('.btn-edit-trip')) return;
      state.currentTripId=trip.id; state.currentDay=1; state.sortMode=false;
      save(); renderAll(); closeSidebar(); showToast(`已切換到「${trip.name}」`);
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
  ['input-trip-name','input-trip-dest','input-trip-date'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('input-trip-days').value='5';
  openModal('modal-new-trip');
  setTimeout(()=>document.getElementById('input-trip-name').focus(),350);
}
document.getElementById('btn-save-trip').addEventListener('click',()=>{
  const name=document.getElementById('input-trip-name').value.trim();
  if(!name){showToast('請輸入行程名稱');return;}
  const trip={id:uid(),name,dest:document.getElementById('input-trip-dest').value.trim(),
    startDate:document.getElementById('input-trip-date').value,
    days:Math.min(Math.max(parseInt(document.getElementById('input-trip-days').value)||5,1),30),
    days_data:{},createdAt:Date.now()};
  state.trips.unshift(trip);
  state.currentTripId=trip.id; state.currentDay=1; state.sortMode=false;
  save(); closeModal('modal-new-trip'); renderAll(); showToast(`已新增「${trip.name}」`);
});
document.getElementById('btn-cancel-trip').addEventListener('click',()=>closeModal('modal-new-trip'));

// ===== EDIT TRIP =====
function openEditTrip(tripId) {
  const trip=state.trips.find(t=>t.id===tripId); if(!trip) return;
  state.editingTripId=tripId;
  document.getElementById('input-edit-trip-name').value=trip.name;
  document.getElementById('input-edit-trip-dest').value=trip.dest||'';
  openModal('modal-edit-trip'); closeSidebar();
}
document.getElementById('btn-update-trip').addEventListener('click',()=>{
  const trip=state.trips.find(t=>t.id===state.editingTripId); if(!trip) return;
  const name=document.getElementById('input-edit-trip-name').value.trim();
  if(!name){showToast('請輸入行程名稱');return;}
  trip.name=name; trip.dest=document.getElementById('input-edit-trip-dest').value.trim();
  save(); closeModal('modal-edit-trip'); renderAll(); showToast('已更新行程');
});
document.getElementById('btn-delete-trip').addEventListener('click',()=>{
  if(!confirm('確定要刪除這個行程嗎？')) return;
  state.trips=state.trips.filter(t=>t.id!==state.editingTripId);
  if(state.currentTripId===state.editingTripId){state.currentTripId=state.trips[0]?.id||null;state.currentDay=1;}
  save(); closeModal('modal-edit-trip'); renderAll(); showToast('已刪除行程');
});

// ===== TYPE SELECTORS =====
let selectedType='attraction', selectedTypeEdit='attraction';
function setupTypeSelector(cid,setter) {
  document.querySelectorAll(`#${cid} .type-btn`).forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll(`#${cid} .type-btn`).forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); setter(btn.dataset.type);
  }));
}
setupTypeSelector('type-selector',      t=>{selectedType=t;});
setupTypeSelector('type-selector-edit', t=>{selectedTypeEdit=t;});

// ===== ADD ITEM =====
function getNextTime() {
  const trip=getCurrentTrip(); if(!trip) return '09:00';
  const items=trip.days_data[state.currentDay]||[];
  if(!items.length) return '09:00';
  return addMinutes(items.slice().sort((a,b)=>a.time.localeCompare(b.time)).pop().time,60);
}
function openAddItem() {
  const trip=getCurrentTrip(); if(!trip){showToast('請先新增一個行程');return;}
  selectedType='attraction';
  document.querySelectorAll('#type-selector .type-btn').forEach(b=>b.classList.remove('active'));
  document.querySelector('#type-selector .type-btn[data-type="attraction"]').classList.add('active');
  ['input-item-place','input-item-address','input-item-note','input-item-url'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('input-item-time').value=getNextTime();
  document.getElementById('modal-item-title').textContent=`新增 Day ${state.currentDay} 行程`;
  openModal('modal-add-item');
  setTimeout(()=>document.getElementById('input-item-place').focus(),350);
}
document.getElementById('btn-save-item').addEventListener('click',()=>{
  const place=document.getElementById('input-item-place').value.trim();
  if(!place){showToast('請輸入地點名稱');return;}
  const trip=getCurrentTrip(); if(!trip) return;
  if(!trip.days_data[state.currentDay]) trip.days_data[state.currentDay]=[];
  trip.days_data[state.currentDay].push({
    id:uid(),type:selectedType,
    time:document.getElementById('input-item-time').value||'09:00',
    place,
    address:document.getElementById('input-item-address').value.trim(),
    note:document.getElementById('input-item-note').value.trim(),
    url:normaliseUrl(document.getElementById('input-item-url').value),
  });
  save(); closeModal('modal-add-item'); renderSchedule(); showToast(`已新增「${place}」`);
});
document.getElementById('btn-cancel-item').addEventListener('click',()=>closeModal('modal-add-item'));

// ===== EDIT ITEM =====
function openEditItem(itemId) {
  const trip=getCurrentTrip(); if(!trip) return;
  const item=(trip.days_data[state.currentDay]||[]).find(i=>i.id===itemId); if(!item) return;
  state.editingItemId=itemId; selectedTypeEdit=item.type||'attraction';
  document.querySelectorAll('#type-selector-edit .type-btn').forEach(b=>b.classList.toggle('active',b.dataset.type===item.type));
  document.getElementById('input-edit-time').value    =item.time;
  document.getElementById('input-edit-place').value   =item.place;
  document.getElementById('input-edit-address').value =item.address||'';
  document.getElementById('input-edit-note').value    =item.note||'';
  document.getElementById('input-edit-url').value     =item.url||'';
  openModal('modal-edit-item');
}
document.getElementById('btn-update-item').addEventListener('click',()=>{
  const trip=getCurrentTrip(); if(!trip) return;
  const item=(trip.days_data[state.currentDay]||[]).find(i=>i.id===state.editingItemId); if(!item) return;
  const place=document.getElementById('input-edit-place').value.trim();
  if(!place){showToast('請輸入地點名稱');return;}
  item.type    =selectedTypeEdit;
  item.time    =document.getElementById('input-edit-time').value||'09:00';
  item.place   =place;
  item.address =document.getElementById('input-edit-address').value.trim();
  item.note    =document.getElementById('input-edit-note').value.trim();
  item.url     =normaliseUrl(document.getElementById('input-edit-url').value);
  save(); closeModal('modal-edit-item'); renderSchedule(); showToast('已更新');
});
document.getElementById('btn-delete-item').addEventListener('click',()=>{
  const trip=getCurrentTrip(); if(!trip) return;
  trip.days_data[state.currentDay]=(trip.days_data[state.currentDay]||[]).filter(i=>i.id!==state.editingItemId);
  save(); closeModal('modal-edit-item'); renderSchedule(); showToast('已刪除');
});

// ===== ADD DAY =====
document.getElementById('btn-add-day').addEventListener('click',()=>{
  const trip=getCurrentTrip(); if(!trip){showToast('請先新增行程');return;}
  if(trip.days>=30){showToast('最多 30 天');return;}
  trip.days++; state.currentDay=trip.days; state.sortMode=false;
  save(); renderDayTabs(); renderSchedule(); showToast(`已新增 Day ${trip.days}`);
});

// ===== CHECKLIST =====
function renderChecklist() {
  const items=state.checklists[state.checklistTab]||[];
  const ul=document.getElementById('checklist-items');
  ul.innerHTML='';
  if(!items.length){ul.innerHTML='<li style="text-align:center;padding:20px;color:var(--text3);font-size:13px;">清單是空的，快新增吧！</li>';return;}
  items.forEach(item=>{
    const li=document.createElement('li');
    li.className='checklist-item'+(item.done?' done':'');
    li.innerHTML=`<input type="checkbox" ${item.done?'checked':''}><span>${escHtml(item.text)}</span><button class="checklist-item-del">✕</button>`;
    li.querySelector('input').addEventListener('change',()=>{item.done=!item.done;save();renderChecklist();});
    li.querySelector('.checklist-item-del').addEventListener('click',()=>{
      state.checklists[state.checklistTab]=state.checklists[state.checklistTab].filter(i=>i!==item);
      save();renderChecklist();
    });
    ul.appendChild(li);
  });
}
document.querySelectorAll('.cl-tab').forEach(tab=>tab.addEventListener('click',()=>{
  document.querySelectorAll('.cl-tab').forEach(t=>t.classList.remove('active'));
  tab.classList.add('active'); state.checklistTab=tab.dataset.list;
  document.getElementById('input-checklist').value=''; renderChecklist();
}));
function addChecklistItem() {
  const val=document.getElementById('input-checklist').value.trim(); if(!val) return;
  if(!state.checklists[state.checklistTab]) state.checklists[state.checklistTab]=[];
  state.checklists[state.checklistTab].push({id:uid(),text:val,done:false});
  document.getElementById('input-checklist').value=''; save(); renderChecklist();
}
document.getElementById('btn-add-checklist').addEventListener('click',addChecklistItem);
document.getElementById('input-checklist').addEventListener('keydown',e=>{if(e.key==='Enter')addChecklistItem();});
document.getElementById('btn-clear-done').addEventListener('click',()=>{
  state.checklists[state.checklistTab]=(state.checklists[state.checklistTab]||[]).filter(i=>!i.done);
  save();renderChecklist();showToast('已清除完成項目');
});

// ===== NOTEPAD =====
function openNotepad() {
  const ta=document.getElementById('notepad-content');
  const pv=document.getElementById('notepad-preview');
  ta.value=state.notepad||'';
  updateNotepadPreview(ta.value,pv);
  openModal('modal-notepad');
  setTimeout(()=>ta.focus(),350);
}
function updateNotepadPreview(text,pv) {
  if(!text.trim()){pv.classList.remove('has-content');pv.innerHTML='';return;}
  pv.classList.add('has-content');
  pv.innerHTML=`<span class="notepad-preview-label">預覽（連結可點擊）</span>${linkifyText(text)}`;
}
document.getElementById('notepad-content').addEventListener('input',function(){
  updateNotepadPreview(this.value,document.getElementById('notepad-preview'));
});
document.getElementById('btn-save-notepad').addEventListener('click',()=>{
  state.notepad=document.getElementById('notepad-content').value;
  save();closeModal('modal-notepad');showToast('筆記已儲存');
});
document.getElementById('btn-clear-notepad').addEventListener('click',()=>{
  const v=document.getElementById('notepad-content').value;
  if(v.trim()&&!confirm('確定清除所有筆記內容？'))return;
  document.getElementById('notepad-content').value='';
  updateNotepadPreview('',document.getElementById('notepad-preview'));
  state.notepad='';save();showToast('已清除筆記');
});
document.getElementById('btn-close-notepad').addEventListener('click',()=>{
  state.notepad=document.getElementById('notepad-content').value;save();closeModal('modal-notepad');
});

// ============================================================
// ===== CSV EXPORT ===========================================
// ============================================================

const CSV_HEADERS = ['trip_name','trip_dest','start_date','days','day','time','type','place','address','note','url'];

function csvCell(v) {
  const s = String(v ?? '');
  // Wrap in quotes if contains comma, quote, or newline
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function tripToCsvRows(trip) {
  const rows = [];
  for (let day = 1; day <= trip.days; day++) {
    const items = trip.days_data[day] || [];
    if (items.length === 0) {
      // Include a blank row so the day still appears on import
      rows.push([trip.name, trip.dest||'', trip.startDate||'', trip.days, day, '', '', '', '', '', '']);
    } else {
      items.slice().sort((a,b)=>a.time.localeCompare(b.time)).forEach(item => {
        rows.push([trip.name, trip.dest||'', trip.startDate||'', trip.days, day, item.time, item.type, item.place, item.address||'', item.note||'', item.url||'']);
      });
    }
  }
  return rows;
}

function buildCsvString(trips) {
  const lines = [CSV_HEADERS.join(',')];
  trips.forEach(trip => {
    tripToCsvRows(trip).forEach(row => lines.push(row.map(csvCell).join(',')));
  });
  return lines.join('\r\n');
}

function downloadCsv(content, filename) {
  // BOM for Excel UTF-8 compatibility
  const bom = '\uFEFF';
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

function openExportModal() {
  const list = document.getElementById('export-trip-list');
  list.innerHTML = '';

  if (!state.trips.length) { showToast('目前沒有任何行程可匯出'); return; }

  // Select all checkbox row
  const allRow = document.createElement('div');
  allRow.className = 'export-select-all-row';
  allRow.innerHTML = `<input type="checkbox" id="export-select-all" checked><label for="export-select-all">全選 / 取消全選</label>`;
  list.appendChild(allRow);

  state.trips.forEach(trip => {
    const el = document.createElement('div');
    el.className = 'export-trip-item';
    el.innerHTML = `
      <input type="checkbox" class="export-cb" data-id="${trip.id}" checked>
      <div class="export-trip-item-info">
        <div class="export-trip-item-name">${escHtml(trip.name)}</div>
        <div class="export-trip-item-meta">📍 ${escHtml(trip.dest||'未設定')} · ${trip.days} 天</div>
      </div>`;
    el.addEventListener('click', e => {
      if (e.target.tagName === 'INPUT') return;
      const cb = el.querySelector('input[type=checkbox]');
      cb.checked = !cb.checked;
    });
    list.appendChild(el);
  });

  // Select all logic
  document.getElementById('export-select-all').addEventListener('change', function() {
    document.querySelectorAll('.export-cb').forEach(cb => cb.checked = this.checked);
  });

  closeSidebar();
  openModal('modal-export-csv');
}

document.getElementById('btn-confirm-export').addEventListener('click', () => {
  const selected = [...document.querySelectorAll('.export-cb:checked')].map(cb => cb.dataset.id);
  if (!selected.length) { showToast('請至少選一個行程'); return; }
  const trips = state.trips.filter(t => selected.includes(t.id));
  const csv   = buildCsvString(trips);
  const name  = trips.length === 1
    ? `旅途_${trips[0].name}.csv`
    : `旅途_${trips.length}個行程.csv`;
  downloadCsv(csv, name);
  closeModal('modal-export-csv');
  showToast(`✓ 已匯出 ${trips.length} 個行程`);
});
document.getElementById('btn-cancel-export').addEventListener('click', () => closeModal('modal-export-csv'));
document.getElementById('btn-close-export').addEventListener('click', () => closeModal('modal-export-csv'));

// ============================================================
// ===== CSV IMPORT ===========================================
// ============================================================

function parseCsvLine(line) {
  const result = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQuote = false; }
      else { cur += ch; }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === ',') { result.push(cur); cur = ''; }
      else { cur += ch; }
    }
  }
  result.push(cur);
  return result;
}

function parseCsvText(text) {
  // Normalize line endings
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l => l.trim());
  if (lines.length < 2) return { error: 'CSV 內容太少，至少需要標題列和一列資料' };

  const headers = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
  const required = ['trip_name','day','place'];
  for (const r of required) {
    if (!headers.includes(r)) return { error: `缺少必要欄位：${r}` };
  }

  const col = h => headers.indexOf(h);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const get   = h => (cells[col(h)] || '').trim();
    const tripName = get('trip_name');
    const place    = get('place');
    if (!tripName) continue; // skip blank trip_name rows

    rows.push({
      trip_name:  tripName,
      trip_dest:  get('trip_dest'),
      start_date: get('start_date'),
      days:       Math.min(Math.max(parseInt(get('days'))||1, 1), 30),
      day:        Math.min(Math.max(parseInt(get('day'))||1, 1), 30),
      time:       get('time') || '09:00',
      type:       VALID_TYPES.includes(get('type')) ? get('type') : 'attraction',
      place,
      address:    get('address'),
      note:       get('note'),
      url:        get('url') ? normaliseUrl(get('url')) : '',
    });
  }

  if (!rows.length) return { error: '沒有有效的資料列（place 欄位不能為空）' };
  return { rows };
}

function buildTripsFromRows(rows) {
  const tripMap = new Map(); // trip_name -> trip object
  rows.forEach(row => {
    if (!tripMap.has(row.trip_name)) {
      tripMap.set(row.trip_name, {
        id: uid(),
        name: row.trip_name,
        dest: row.trip_dest,
        startDate: row.start_date,
        days: row.days,
        days_data: {},
        createdAt: Date.now(),
      });
    }
    const trip = tripMap.get(row.trip_name);
    // Update days if larger value found
    if (row.days > trip.days) trip.days = row.days;
    if (row.day  > trip.days) trip.days = row.day;

    if (!row.place) return; // skip placeholder rows (empty day rows)
    if (!trip.days_data[row.day]) trip.days_data[row.day] = [];
    trip.days_data[row.day].push({
      id: uid(), type: row.type, time: row.time,
      place: row.place, address: row.address, note: row.note, url: row.url,
    });
  });
  return [...tripMap.values()];
}

function renderImportPreview(rows) {
  // Group by trip name
  const byTrip = {};
  rows.forEach(r => { if (!byTrip[r.trip_name]) byTrip[r.trip_name]=0; if(r.place) byTrip[r.trip_name]++; });
  const tripNames = Object.keys(byTrip);

  document.getElementById('import-preview-title').textContent =
    `找到 ${tripNames.length} 個行程，共 ${rows.filter(r=>r.place).length} 筆項目`;

  const tableDiv = document.getElementById('import-preview-table');
  const rowsToShow = rows.filter(r=>r.place).slice(0,60);
  if (!rowsToShow.length) { tableDiv.innerHTML='<p style="padding:12px;color:var(--text3);font-size:13px;">沒有可預覽的項目</p>'; return; }

  let html = '<table><thead><tr><th>行程</th><th>Day</th><th>時間</th><th>類型</th><th>地點</th><th>備註</th></tr></thead><tbody>';
  rowsToShow.forEach(r => {
    const tc = TYPE_CONFIG[r.type]||TYPE_CONFIG.attraction;
    html += `<tr>
      <td><span class="preview-trip-badge">${escHtml(r.trip_name)}</span></td>
      <td>Day ${r.day}</td>
      <td>${escHtml(r.time)}</td>
      <td>${tc.emoji} ${tc.label}</td>
      <td>${escHtml(r.place)}</td>
      <td>${escHtml(r.note||'')}</td>
    </tr>`;
  });
  if (rows.filter(r=>r.place).length > 60) html += `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:8px;font-size:12px;">還有更多項目…</td></tr>`;
  html += '</tbody></table>';
  tableDiv.innerHTML = html;
}

function handleCsvFile(file) {
  if (!file) return;
  if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
    showToast('請選擇 .csv 格式的檔案'); return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    // Strip BOM if present
    let text = e.target.result;
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

    const result = parseCsvText(text);
    if (result.error) { showToast('匯入失敗：' + result.error); return; }

    csvImportData = result.rows;
    renderImportPreview(csvImportData);

    document.getElementById('import-step-1').style.display = 'none';
    document.getElementById('import-step-2').style.display = 'block';
    document.getElementById('btn-confirm-import').disabled = false;
  };
  reader.readAsText(file, 'UTF-8');
}

function resetImportModal() {
  csvImportData = [];
  document.getElementById('import-step-1').style.display = 'block';
  document.getElementById('import-step-2').style.display = 'none';
  document.getElementById('btn-confirm-import').disabled = true;
  document.getElementById('input-csv-file').value = '';
  document.getElementById('import-preview-table').innerHTML = '';
}

function openImportModal() {
  resetImportModal();
  closeSidebar();
  openModal('modal-import-csv');
}

// File drop area
const dropArea = document.getElementById('file-drop-area');
dropArea.addEventListener('click', () => document.getElementById('input-csv-file').click());
dropArea.addEventListener('dragover',  e => { e.preventDefault(); dropArea.classList.add('drag-over'); });
dropArea.addEventListener('dragleave', ()  => dropArea.classList.remove('drag-over'));
dropArea.addEventListener('drop', e => {
  e.preventDefault(); dropArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleCsvFile(file);
});
document.getElementById('input-csv-file').addEventListener('change', function() {
  if (this.files[0]) handleCsvFile(this.files[0]);
});

// Import mode buttons
document.querySelectorAll('.import-mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.import-mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    csvImportMode = btn.dataset.mode;
  });
});

document.getElementById('btn-import-reselect').addEventListener('click', () => {
  document.getElementById('import-step-1').style.display = 'block';
  document.getElementById('import-step-2').style.display = 'none';
  document.getElementById('btn-confirm-import').disabled = true;
  document.getElementById('input-csv-file').value = '';
});

document.getElementById('btn-confirm-import').addEventListener('click', () => {
  if (!csvImportData.length) { showToast('沒有可匯入的資料'); return; }

  const incoming = buildTripsFromRows(csvImportData);
  let added = 0, replaced = 0;

  incoming.forEach(newTrip => {
    if (csvImportMode === 'replace') {
      const existIdx = state.trips.findIndex(t => t.name === newTrip.name);
      if (existIdx >= 0) {
        state.trips[existIdx] = { ...newTrip, id: state.trips[existIdx].id };
        replaced++;
        return;
      }
    }
    state.trips.unshift(newTrip);
    added++;
  });

  // Switch to first imported trip
  if (incoming.length) {
    const first = state.trips.find(t => incoming.some(i => i.name === t.name));
    if (first) { state.currentTripId = first.id; state.currentDay = 1; }
  }

  save(); renderAll(); closeModal('modal-import-csv');
  const msg = replaced > 0
    ? `✓ 匯入完成：新增 ${added} 個、取代 ${replaced} 個行程`
    : `✓ 已匯入 ${added} 個行程`;
  showToast(msg);
});

document.getElementById('btn-cancel-import').addEventListener('click', () => closeModal('modal-import-csv'));
document.getElementById('btn-close-import').addEventListener('click',  () => closeModal('modal-import-csv'));

// Sidebar CSV buttons
document.getElementById('btn-export-csv').addEventListener('click', openExportModal);
document.getElementById('btn-import-csv').addEventListener('click', openImportModal);

// ===== ALL BUTTON EVENTS =====
document.getElementById('btn-checklist').addEventListener('click', () => { renderChecklist(); openModal('modal-checklist'); });
document.getElementById('btn-close-checklist').addEventListener('click', () => closeModal('modal-checklist'));
document.getElementById('btn-notepad').addEventListener('click', openNotepad);
document.getElementById('btn-trips-menu').addEventListener('click', () => { renderTripsSidebar(); openSidebar(); });
document.getElementById('btn-new-trip').addEventListener('click',  () => { closeSidebar(); openNewTrip(); });
document.getElementById('btn-fab').addEventListener('click', openAddItem);
document.getElementById('overlay-trips').addEventListener('click', closeSidebar);
document.getElementById('btn-close-sidebar').addEventListener('click', closeSidebar);
document.getElementById('sort-toggle-btn').addEventListener('click', () => { state.sortMode = !state.sortMode; renderSchedule(); });

['modal-new-trip','modal-edit-trip','modal-add-item','modal-edit-item',
 'modal-checklist','modal-notepad','modal-import-csv','modal-export-csv'].forEach(id => {
  document.getElementById(id).addEventListener('click', function(e) { if(e.target===this) closeModal(id); });
});

// ===== SERVICE WORKER =====
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(r=>console.log('SW',r.scope)).catch(e=>console.log('SW skipped',e.message));
  });
}

// ===== PWA INSTALL =====
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredInstall = e;
  setTimeout(() => {
    if (!deferredInstall||document.getElementById('install-banner')) return;
    const b=document.createElement('div'); b.id='install-banner'; b.className='install-banner';
    b.innerHTML=`<p>📱 將旅途加入主畫面，隨時離線使用！</p><button class="btn-primary" id="btn-yes-install">安裝</button><button class="btn-cancel" id="btn-no-install">✕</button>`;
    document.body.appendChild(b);
    document.getElementById('btn-yes-install').addEventListener('click',()=>{deferredInstall.prompt();deferredInstall.userChoice.then(()=>{b.remove();deferredInstall=null;});});
    document.getElementById('btn-no-install').addEventListener('click',()=>b.remove());
  }, 5000);
});

// ===== INIT =====
load();
if (!state.checklists)         state.checklists={luggage:[],todo:[]};
if (!state.checklists.luggage) state.checklists.luggage=[];
if (!state.checklists.todo)    state.checklists.todo=[];
if (state.notepad===undefined) state.notepad='';

const _t=getCurrentTrip();
if (_t&&state.currentDay>_t.days) state.currentDay=1;
if (state.currentDay<1) state.currentDay=1;

if (state.trips.length===0) {
  const demo={
    id:uid(),name:'東京五日遊',dest:'日本東京',startDate:'',days:5,
    days_data:{
      1:[
        {id:uid(),type:'transport', time:'08:00',place:'成田機場入境',        address:'千葉縣成田市古込1',         note:'記得帶護照、換好日幣',        url:''},
        {id:uid(),type:'transport', time:'10:30',place:'搭乘成田特急往東京',  address:'',                          note:"N'EX 特急，約 60 分鐘",       url:''},
        {id:uid(),type:'hotel',     time:'13:00',place:'飯店入住（新宿）',    address:'東京都新宿區西新宿1-1-1',   note:'提早入住需加費',              url:''},
        {id:uid(),type:'attraction',time:'15:00',place:'新宿御苑',            address:'東京都新宿區內藤町11',      note:'門票 500 円，春季賞櫻超美',   url:'https://www.env.go.jp/garden/shinjukugyoen/'},
        {id:uid(),type:'food',      time:'18:30',place:'一蘭拉麵 新宿店',     address:'東京都新宿區歌舞伎町1-22-3',note:'博多風味豬骨湯頭',            url:'https://ichiran.com/tw/'},
      ],
      2:[
        {id:uid(),type:'attraction',time:'09:00',place:'淺草寺',              address:'東京都台東區淺草2-3-1',     note:'雷門很壯觀，記得拍照',        url:'https://www.senso-ji.jp/'},
        {id:uid(),type:'food',      time:'11:30',place:'仲見世通美食街',      address:'東京都台東區淺草1-36-3',    note:'人形燒、草餅必吃',            url:''},
        {id:uid(),type:'attraction',time:'14:00',place:'東京晴空塔',          address:'東京都墨田區押上1-1-2',     note:'350m 展望台票 2100 円',       url:'https://www.tokyo-skytree.jp/'},
      ],
    },
    createdAt:Date.now(),
  };
  state.trips.push(demo);
  state.currentTripId=demo.id; state.currentDay=1;
  save();
}

renderAll();
