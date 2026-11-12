/* Body: tape measurements (waist first: on a recomp the scale barely moves while the waist does) and progress
   photos. Measurements live in localStorage and go in backups; photos are kept in this phone's IndexedDB, made
   smaller first (about 1080 px, JPEG), and stay out of backups because of their size. */
const MEASURE_KEY = 'recomp_measurements';

const MEASURES = [
  { key: 'waist', label: 'Waist', unit: 'cm', hint: 'at the navel, relaxed, breath out', min: 30, max: 250 },
  { key: 'chest', label: 'Chest', unit: 'cm', hint: 'at the nipples', min: 30, max: 250 },
  { key: 'hips', label: 'Hips', unit: 'cm', hint: 'widest point', min: 30, max: 250 },
  { key: 'arm', label: 'Arm', unit: 'cm', hint: 'upper arm, flexed', min: 10, max: 100 },
  { key: 'thigh', label: 'Thigh', unit: 'cm', hint: 'widest point', min: 20, max: 150 },
  { key: 'bf', label: 'Body fat', unit: '%', hint: 'from a scale or calipers', min: 2, max: 70 }
];

function getMeasurements() {
  const list = readJSON(MEASURE_KEY, []);
  return Array.isArray(list) ? list.filter(m => m && /^\d{4}-\d{2}-\d{2}$/.test(m.dateStr)).sort((a, b) => a.dateStr.localeCompare(b.dateStr)) : [];
}

function saveMeasurements(list) {
  localStorage.setItem(MEASURE_KEY, JSON.stringify(list));
}

// The series for one measure, oldest first: [{ x (ms), y }]
function measureSeries(key, list = getMeasurements()) {
  return list.filter(m => m[key] > 0).map(m => ({ x: bwDateMs(m.dateStr), y: m[key] }));
}

// Change over about the last 4 weeks (the entry closest to 28 days before the latest), or null
function measureChange(key, list = getMeasurements()) {
  const s = measureSeries(key, list);
  if (s.length < 2) return null;
  const last = s[s.length - 1];
  const target = last.x - 28 * 864e5;
  const earlier = s.slice(0, -1).reduce((best, p) => (Math.abs(p.x - target) < Math.abs(best.x - target) ? p : best));
  const days = Math.round((last.x - earlier.x) / 864e5);
  return days >= 7 ? { delta: Math.round((last.y - earlier.y) * 10) / 10, days, from: earlier, to: last } : null;
}

/* The log sheet */
function openMeasureSheet() {
  const date = document.getElementById('measure-date');
  date.value = localDateStr(new Date());
  fillMeasureFields();
  openSheet('measure-sheet');
}

function fillMeasureFields() {
  const dateStr = document.getElementById('measure-date').value;
  const list = getMeasurements();
  const today = list.find(m => m.dateStr === dateStr) || {};
  const latest = list[list.length - 1] || {};
  document.getElementById('measure-fields').innerHTML = MEASURES.map(m => `
    <label class="measure-field ${m.key === 'waist' ? 'main' : ''}">
      <span class="measure-name">${m.label}<i>${m.hint}</i></span>
      <span class="measure-input"><input type="text" inputmode="decimal" id="measure-${m.key}" value="${today[m.key] || ''}" placeholder="${latest[m.key] ? fmtNum(latest[m.key]) : '–'}" aria-label="${m.label} in ${m.unit}"><span>${m.unit}</span></span>
    </label>`).join('');
}

function saveMeasureSheet() {
  const dateStr = document.getElementById('measure-date').value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || dateStr > localDateStr(new Date())) {
    haptic('error');
    showToast('Pick a date up to today', { type: 'error' });
    return;
  }
  const entry = { dateStr };
  for (const m of MEASURES) {
    const text = document.getElementById(`measure-${m.key}`).value.trim().replace(',', '.');
    if (!text) continue;
    const v = parseFloat(text);
    if (!(v >= m.min && v <= m.max)) {
      haptic('error');
      showToast(`${m.label}: ${text} ${m.unit} looks off (${m.min}–${m.max})`, { type: 'error' });
      return;
    }
    entry[m.key] = Math.round(v * 10) / 10;
  }
  if (Object.keys(entry).length === 1) {
    haptic('error');
    showToast('Enter at least one measurement', { type: 'error' });
    return;
  }
  const list = getMeasurements().filter(m => m.dateStr !== dateStr);
  list.push(entry);
  saveMeasurements(list);
  closeSheet('measure-sheet');
  haptic('success');
  renderBody();
  showToast('Measurements saved');
}

function deleteMeasurement(dateStr) {
  const before = getMeasurements();
  saveMeasurements(before.filter(m => m.dateStr !== dateStr));
  renderBody();
  showToast('Entry deleted', { actionLabel: 'Undo', onAction: () => { saveMeasurements(before); renderBody(); } });
}

/* Progress photos (IndexedDB) */
let photoDb = null;

function openPhotoDb() {
  if (photoDb) return Promise.resolve(photoDb);
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error('no IndexedDB'));
    const req = indexedDB.open('recomp-photos', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => { photoDb = req.result; resolve(photoDb); };
    req.onerror = () => reject(req.error);
  });
}

function photoStore(mode) {
  return openPhotoDb().then(db => db.transaction('photos', mode).objectStore('photos'));
}

const idbRequest = req => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });

async function listPhotos() {
  try {
    const all = await idbRequest((await photoStore('readonly')).getAll());
    return all.sort((a, b) => b.dateStr.localeCompare(a.dateStr) || b.id - a.id);
  } catch (e) {
    return [];
  }
}

// Shrink to at most 1080 px on the long side, JPEG: a phone photo of several MB becomes ~150–300 KB
async function shrinkPhoto(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1080 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/jpeg', 0.82));
}

function pickPhoto() {
  document.getElementById('photo-file').click();
}

async function addPhotoFromInput(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  try {
    const blob = await shrinkPhoto(file);
    const pose = await actionSheet('Which view?', 'Same pose, light and distance each time makes them easy to compare.',
      [{ label: 'Front', value: 'front' }, { label: 'Side', value: 'side' }, { label: 'Back', value: 'back' }]);
    if (!pose) return;
    await idbRequest((await photoStore('readwrite')).add({ dateStr: localDateStr(new Date()), pose, blob }));
    haptic('success');
    showToast('Photo saved on this phone');
    renderPhotos();
  } catch (e) {
    haptic('error');
    showToast('Couldn\'t save that photo', { type: 'error' });
  }
}

let photoUrls = [];

function photoUrl(p) {
  const url = URL.createObjectURL(p.blob);
  photoUrls.push(url);
  return url;
}

async function renderPhotos() {
  const box = document.getElementById('photo-strip');
  if (!box) return;
  const photos = await listPhotos();
  photoUrls.forEach(u => URL.revokeObjectURL(u));
  photoUrls = [];
  box.innerHTML = `
    <button class="photo-add" onclick="pickPhoto()" aria-label="Add a progress photo">${icon('plus', 2.6)}<span>Photo</span></button>
    ${photos.map(p => `
      <button class="photo-thumb" onclick="openPhoto(${p.id})" aria-label="${p.pose} photo, ${shortDate(bwDateMs(p.dateStr))}">
        <img src="${photoUrl(p)}" alt="">
        <span>${shortDate(bwDateMs(p.dateStr))} · ${p.pose}</span>
      </button>`).join('')}`;
}

async function openPhoto(id, compareId = null) {
  const photos = await listPhotos();
  const p = photos.find(x => x.id === id);
  if (!p) return;
  const other = compareId ? photos.find(x => x.id === compareId) : null;
  const shot = x => `<figure><img src="${photoUrl(x)}" alt="${x.pose} photo, ${shortDate(bwDateMs(x.dateStr))}"><figcaption>${shortDate(bwDateMs(x.dateStr))} · ${x.pose}</figcaption></figure>`;
  document.getElementById('photo-view').innerHTML = `
    <div class="photo-pair ${other ? 'two' : ''}">${other ? shot(other) : ''}${shot(p)}</div>
    <div class="photo-actions">
      ${photos.length > 1 ? `<button class="btn btn-secondary" onclick="comparePhoto(${p.id})">${other ? 'Compare with another' : 'Compare with…'}</button>` : ''}
      <button class="btn btn-danger" onclick="deletePhoto(${p.id})">Delete photo</button>
    </div>`;
  openSheet('photo-sheet');
}

async function comparePhoto(id) {
  const photos = await listPhotos();
  const p = photos.find(x => x.id === id);
  const others = photos.filter(x => x.id !== id).sort((a, b) => (a.pose === p.pose ? 0 : 1) - (b.pose === p.pose ? 0 : 1) || a.dateStr.localeCompare(b.dateStr));
  const pick = await actionSheet('Compare with', 'Same view first, oldest first', others.slice(0, 12).map(x => ({ label: `${shortDate(bwDateMs(x.dateStr))} · ${x.pose}`, value: x.id })));
  if (pick) openPhoto(id, pick);
}

async function deletePhoto(id) {
  if (!await confirmSheet('Delete this photo?', 'It\'s only on this phone, so it can\'t be brought back.', 'Delete', true)) return;
  await idbRequest((await photoStore('readwrite')).delete(id));
  closeSheet('photo-sheet');
  renderPhotos();
  showToast('Photo deleted');
}

/* The Body card on Progress */
function renderBody() {
  const box = document.getElementById('body-stats');
  if (!box) return;
  const list = getMeasurements();
  const latest = list[list.length - 1];
  const goal = getProfile() && getProfile().goalType;
  const waist = measureChange('waist', list);
  const lastWaist = measureSeries('waist', list).pop();
  const good = waist && (goal === 'gain' ? null : waist.delta < 0);
  box.innerHTML = latest ? `
    <div class="stat-tile"><div class="stat-tile-val">${lastWaist ? `${fmtNum(lastWaist.y)}<small>cm</small>` : '—'}</div><div class="stat-tile-lbl">Waist</div></div>
    <div class="stat-tile"><div class="stat-tile-val ${good === true ? 'good' : good === false && waist.delta > 0 ? 'bad' : ''}">${waist ? `${waist.delta > 0 ? '+' : waist.delta < 0 ? '−' : '±'}${fmtNum(Math.abs(waist.delta))}<small>cm</small>` : '—'}</div><div class="stat-tile-lbl">${waist ? `Last ${waist.days} days` : 'Need 2 entries'}</div></div>
    <div class="stat-tile"><div class="stat-tile-val">${shortDate(bwDateMs(latest.dateStr))}</div><div class="stat-tile-lbl">Last measured</div></div>` : '';
  const start = rangeStartMs();
  const series = measureSeries('waist', list).filter(p => p.x >= start);
  renderLineChart('body-chart', series, {
    emptyText: list.length ? 'No waist entries in this range.' : 'Measure your waist every 1–2 weeks, same time of day. On a recomp it often drops while your weight holds.',
    label: lastWaist ? `Waist ${fmtNum(lastWaist.y)} cm` : 'Waist',
    tip: p => `${shortDate(p.x)} · <strong>${fmtNum(p.y)} cm</strong>`
  });
  // The other measures: latest and change
  const others = MEASURES.filter(m => m.key !== 'waist' && measureSeries(m.key, list).length);
  document.getElementById('body-others').innerHTML = others.length ? `
    <table class="data-table">${others.map(m => {
      const s = measureSeries(m.key, list);
      const ch = measureChange(m.key, list);
      return `<tr><td>${m.label}</td><td class="num">${fmtNum(s[s.length - 1].y)} ${m.unit}</td><td class="num">${ch ? `${ch.delta > 0 ? '+' : ch.delta < 0 ? '−' : '±'}${fmtNum(Math.abs(ch.delta))}` : ''}</td></tr>`;
    }).join('')}</table>` : '';
  renderPhotos();
}

/* Coach: the recomp signal, waist against weight over the same weeks */
function bodyTips(now) {
  const waist = measureChange('waist');
  if (!waist || now - waist.to.x > 21 * 864e5) return [];
  const bw = getBodyweight();
  const near = t => {
    const e = bw.filter(x => Math.abs(bwDateMs(x.dateStr) - t) <= 4 * 864e5);
    return e.length ? e.reduce((s, x) => s + x.kg, 0) / e.length : null;
  };
  const w0 = near(waist.from.x);
  const w1 = near(waist.to.x);
  const dW = w0 != null && w1 != null ? Math.round((w1 - w0) * 10) / 10 : null;
  const goal = (getProfile() || {}).goalType || 'recomp';
  const wtxt = dW == null ? '' : `, weight ${dW > 0 ? '+' : dW < 0 ? '−' : '±'}${fmtNum(Math.abs(dW))} kg`;
  if (waist.delta <= -1 && dW != null && dW > -1) {
    return [{
      id: `body:recomp:${waist.to.x}`, tone: 'good',
      title: 'Recomp is working: waist down, weight holding',
      body: 'A smaller waist at about the same weight usually means less fat and more muscle. Keep doing what you\'re doing.',
      why: `Waist ${fmtNum(waist.delta)} cm${wtxt} over ${waist.days} days.`,
      source: ''
    }];
  }
  if (waist.delta >= 1 && goal !== 'gain') {
    return [{
      id: `body:up:${waist.to.x}`, tone: 'info',
      title: `Waist up ${fmtNum(waist.delta)} cm`,
      body: 'If it keeps rising over the next couple of weeks, trim about 150–200 kcal a day. One reading can be off; measure at the same time of day.',
      why: `Waist +${fmtNum(waist.delta)} cm${wtxt} over ${waist.days} days.`,
      source: ''
    }];
  }
  return [];
}

(() => {
  const input = document.getElementById('photo-file');
  if (input) input.addEventListener('change', () => addPhotoFromInput(input));
})();
