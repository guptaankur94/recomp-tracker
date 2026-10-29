/* The plan editor: days, exercises, schedule. */

/* Plan editor: a working copy of the plan, edited across three views (plan, day, exercise) and saved
   in one go. Exercise and alternative pickers reuse the Add Exercise sheet. */
let editor = null; // { plan, view, dayIdx, exIdx, dirty }

let pickCallback = null; // set while the Add Exercise sheet picks for the editor

function exerciseFromTemplate(t) {
  const ex = {
    name: String(t.name).trim(),
    repTarget: t.repTarget || '8–12 reps',
    weightTarget: t.weightTarget || '2 reps in reserve',
    rest: t.rest || 90,
    sets: t.sets || 3
  };
  if (t.cue) ex.cue = t.cue;
  if (t.warmup !== undefined) ex.warmup = t.warmup;
  if (t.alt && typeof t.alt === 'object' && t.alt.name) {
    ex.alt = { name: t.alt.name, repTarget: t.alt.repTarget, weightTarget: t.alt.weightTarget, rest: t.alt.rest, sets: t.alt.sets };
    if (t.alt.warmup !== undefined) ex.alt.warmup = t.alt.warmup;
    if (t.alt.cue) ex.alt.cue = t.alt.cue;
  }
  return ex;
}

function openPlanEditor({ plan = null, dayIdx = null } = {}) {
  const source = plan || getCustomPlan() || { planName: getPlanName(), days: programData };
  const copy = JSON.parse(JSON.stringify({ planName: source.planName, days: source.days }));
  copy.schedule = Array.isArray(source.schedule) && source.schedule.length === 7 ? [...source.schedule] : Array(7).fill(null);
  editor = { plan: copy, view: dayIdx === null ? 'plan' : 'day', dayIdx: dayIdx || 0, exIdx: 0, dirty: !!plan };
  closeSheet('plan-sheet');
  renderEditor();
  const overlay = document.getElementById('editor-sheet');
  overlay.onSheetClose = () => {
    // Closed by swipe or backdrop with unsaved edits: offer to reopen them
    if (editor && editor.dirty && !editor.saved && !introPending) {
      const kept = editor;
      showToast('Plan changes not saved', { type: 'info', actionLabel: 'Reopen', onAction: () => { editor = kept; renderEditor(); openSheet('editor-sheet'); } });
    }
  };
  setTimeout(() => openSheet('editor-sheet'), 50);
}

function editorGo(view, idx) {
  if (view === 'day' && idx !== undefined) editor.dayIdx = idx;
  if (view === 'exercise' && idx !== undefined) editor.exIdx = idx;
  editor.view = view;
  renderEditor();
  document.querySelector('#editor-sheet .sheet').scrollTop = 0;
}

function editorChange(fn) {
  fn();
  editor.dirty = true;
  renderEditor();
}

function editorMove(list, i, delta) {
  const j = i + delta;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  haptic('light');
}

function exerciseSummary(ex) {
  return `${ex.warmup ? `${ex.warmup} warm-up + ` : ''}${ex.sets} × ${ex.repTarget} · rest ${fmtClock(ex.rest)}${ex.alt ? ` · alt ${ex.alt.name}` : ''}`;
}

function moveButtons(onUp, onDown, first, last) {
  return `
    <span class="move-btns">
      <button class="icon-btn" onclick="event.stopPropagation(); ${onUp}" ${first ? 'disabled' : ''} aria-label="Move up">${icon('chevronUp')}</button>
      <button class="icon-btn" onclick="event.stopPropagation(); ${onDown}" ${last ? 'disabled' : ''} aria-label="Move down">${icon('chevronDown')}</button>
    </span>`;
}

function renderEditor() {
  const body = document.getElementById('editor-body');
  const foot = document.getElementById('editor-foot');
  const title = document.getElementById('editor-title');
  const back = document.getElementById('editor-back');
  const plan = editor.plan;

  if (editor.view === 'plan') {
    title.textContent = 'Edit Plan';
    back.hidden = true;
    body.innerHTML = `
      <label class="ed-field">Plan name<input type="text" value="${escapeHtml(plan.planName)}" oninput="editor.plan.planName = this.value; editor.dirty = true"></label>
      <div class="ed-label">Days · in the order you train them</div>
      <div class="ed-list">
        ${plan.days.map((d, i) => `
          <div class="ed-row" onclick="editorGo('day', ${i})" role="button">
            <span class="day-dot" style="background:${dayColor(`Day ${i + 1}`)}"></span>
            <span class="row-main"><span class="ed-row-title">Day ${i + 1} · ${escapeHtml(d.title || 'Untitled')}</span><span class="row-sub">${d.exercises.length} exercise${d.exercises.length === 1 ? '' : 's'}${plan.schedule.some(v => v === i) ? ` · ${WEEKDAYS.filter((_, w) => plan.schedule[w] === i).join(', ')}` : ''}</span></span>
            ${moveButtons(`editorChange(() => editorMoveDay(${i}, -1))`, `editorChange(() => editorMoveDay(${i}, 1))`, i === 0, i === plan.days.length - 1)}
            <span class="chevron">${icon('chevron')}</span>
          </div>`).join('')}
      </div>
      ${plan.days.length < 7 ? '<button class="btn btn-secondary" onclick="editorAddDay()">+ Add Day</button>' : ''}
      <div class="ed-label">Weekly schedule</div>
      <div class="ed-list">
        ${WEEKDAY_NAMES.map((name, w) => `
          <label class="ed-row sched-row">
            <span class="row-main"><span class="ed-row-title">${name}</span></span>
            <select onchange="editorSetWeekday(${w}, this.value)" aria-label="${name}">
              <option value="" ${plan.schedule[w] === null ? 'selected' : ''}>Rest</option>
              ${plan.days.map((d, i) => `<option value="${i}" ${plan.schedule[w] === i ? 'selected' : ''}>Day ${i + 1} · ${escapeHtml(d.title || 'Untitled')}</option>`).join('')}
            </select>
          </label>`).join('')}
      </div>
      <div class="ed-hint">The app opens on today's day. Set every day to Rest to rotate through the days in order instead.</div>`;
    foot.innerHTML = `
      <button class="btn btn-positive" onclick="saveEditedPlan()">Save Plan</button>
      <button class="btn btn-plain" onclick="editor.saved = true; closeSheet('editor-sheet')">Cancel</button>`;
  } else if (editor.view === 'day') {
    const d = plan.days[editor.dayIdx];
    title.textContent = `Day ${editor.dayIdx + 1}`;
    back.hidden = false;
    body.innerHTML = `
      <label class="ed-field">Day name<input type="text" value="${escapeHtml(d.title)}" placeholder="e.g. Push, Upper A, Legs" oninput="editor.plan.days[${editor.dayIdx}].title = this.value; editor.dirty = true"></label>
      <div class="ed-label">Exercises · in order</div>
      ${d.exercises.length ? `<div class="ed-list">
        ${d.exercises.map((ex, i) => `
          <div class="ed-row" onclick="editorGo('exercise', ${i})" role="button">
            <span class="row-main"><span class="ed-row-title">${escapeHtml(ex.name)}</span><span class="row-sub">${escapeHtml(exerciseSummary(ex))}</span></span>
            ${moveButtons(`editorChange(() => editorMove(editor.plan.days[${editor.dayIdx}].exercises, ${i}, -1))`, `editorChange(() => editorMove(editor.plan.days[${editor.dayIdx}].exercises, ${i}, 1))`, i === 0, i === d.exercises.length - 1)}
            <span class="chevron">${icon('chevron')}</span>
          </div>`).join('')}
      </div>` : '<div class="empty-list">No exercises yet. Add the first one.</div>'}
      <button class="btn btn-secondary" onclick="editorPickExercise()">+ Add Exercise</button>
      ${plan.days.length > 1 ? '<button class="btn btn-plain ed-danger" onclick="editorDeleteDay()">Delete This Day</button>' : ''}`;
    foot.innerHTML = `<button class="btn btn-primary" onclick="editorGo('plan')">Done</button>`;
  } else {
    const d = plan.days[editor.dayIdx];
    const ex = d.exercises[editor.exIdx];
    const path = `editor.plan.days[${editor.dayIdx}].exercises[${editor.exIdx}]`;
    const restOpts = [...new Set([...REST_CHOICES, 30, ex.rest])].sort((a, b) => a - b);
    title.textContent = 'Exercise';
    back.hidden = false;
    body.innerHTML = `
      <label class="ed-field">Name<input type="text" value="${escapeHtml(ex.name)}" oninput="${path}.name = this.value; editor.dirty = true"></label>
      <div class="form-grid">
        <label>Working sets
          <select onchange="${path}.sets = +this.value; editor.dirty = true">${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `<option ${n === ex.sets ? 'selected' : ''}>${n}</option>`).join('')}</select>
        </label>
        <label>Reps<input type="text" value="${escapeHtml(ex.repTarget)}" onchange="${path}.repTarget = normalizeReps(this.value); editor.dirty = true"></label>
        <label>Weight target<input type="text" value="${escapeHtml(ex.weightTarget)}" placeholder="e.g. 40 kg" onchange="${path}.weightTarget = this.value.trim() || '2 reps in reserve'; editor.dirty = true"></label>
        <label>Rest
          <select onchange="${path}.rest = +this.value; editor.dirty = true">${restOpts.map(sec => `<option value="${sec}" ${sec === ex.rest ? 'selected' : ''}>${fmtClock(sec)}</option>`).join('')}</select>
        </label>
        <label class="full">Warm-up sets
          <select onchange="${path}.warmup = +this.value; editor.dirty = true">${[[0, 'None'], [1, '1 (light set)'], [2, '2 (ramp up)'], [3, '3 (heavy lift)']].map(([v, l]) => `<option value="${v}" ${v === warmupCount(ex, editor.exIdx) ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </label>
        <label class="full">Technique cue<input type="text" value="${escapeHtml(ex.cue || '')}" placeholder="Optional, e.g. 3s lowering" onchange="${path}.cue = this.value.trim(); editor.dirty = true"></label>
      </div>
      <div class="ed-label">Alternative · used when you tap Swap</div>
      <div class="ed-list">
        ${ex.alt ? `
          <div class="ed-row" onclick="editorPickAlt()" role="button">
            <span class="row-main"><span class="ed-row-title">${escapeHtml(ex.alt.name)}</span><span class="row-sub">${escapeHtml(exerciseSummary(ex.alt))}</span></span>
            <span class="row-value">Change</span>
          </div>` : `
          <div class="ed-row" onclick="editorPickAlt()" role="button">
            <span class="row-main"><span class="ed-row-title">No alternative</span><span class="row-sub">Pick one for when equipment is busy</span></span>
            <span class="row-value">Add</span>
          </div>`}
      </div>
      ${ex.alt ? '<button class="btn btn-plain btn-sm" onclick="editorChange(() => { delete editor.plan.days[editor.dayIdx].exercises[editor.exIdx].alt; })">Remove alternative</button>' : ''}
      <button class="btn btn-plain ed-danger" onclick="editorDeleteExercise()">Delete Exercise</button>`;
    foot.innerHTML = `<button class="btn btn-primary" onclick="editorGo('day')">Done</button>`;
  }
}

function editorSetWeekday(w, value) {
  editor.plan.schedule[w] = value === '' ? null : Number(value);
  editor.dirty = true;
  renderEditor();
}

// Swap two days and keep each weekday pointing at the same workout
function editorMoveDay(i, delta) {
  const j = i + delta;
  if (j < 0 || j >= editor.plan.days.length) return;
  editorMove(editor.plan.days, i, delta);
  editor.plan.schedule = editor.plan.schedule.map(v => (v === i ? j : v === j ? i : v));
}

function normalizeReps(v) {
  const t = String(v).trim().replace(/(\d)\s*-\s*(\d)/, '$1–$2');
  if (!t) return '8–12 reps';
  return /reps|hold|walk|failure|s\b|\/ /i.test(t) ? t : `${t} reps`;
}

function editorBack() {
  editorGo(editor.view === 'exercise' ? 'day' : 'plan');
}

function editorAddDay() {
  editorChange(() => editor.plan.days.push({ day: '', title: `Day ${editor.plan.days.length + 1}`, exercises: [] }));
  editorGo('day', editor.plan.days.length - 1);
}

async function editorDeleteDay() {
  const d = editor.plan.days[editor.dayIdx];
  if (d.exercises.length && !await confirmSheet(`Delete ${d.title || `Day ${editor.dayIdx + 1}`}?`, `Its ${d.exercises.length} exercises will be removed from the plan. Saved workouts are not affected.`, 'Delete Day', true)) return;
  // Leave the day view before removing it, so nothing renders a day that's gone
  const gone = editor.dayIdx;
  editor.plan.days.splice(gone, 1);
  editor.plan.schedule = editor.plan.schedule.map(v => (v === gone ? null : v !== null && v > gone ? v - 1 : v));
  editor.dirty = true;
  editorGo('plan');
}

function editorDeleteExercise() {
  const d = editor.plan.days[editor.dayIdx];
  const removed = d.exercises[editor.exIdx];
  const at = editor.exIdx;
  d.exercises.splice(at, 1);
  editor.dirty = true;
  editorGo('day');
  showToast(`${removed.name} removed`, { actionLabel: 'Undo', onAction: () => editorChange(() => d.exercises.splice(at, 0, removed)) });
}

// Open the Add Exercise sheet to pick for the editor
function openPicker(existing, onPick) {
  pickCallback = { existing, onPick };
  addExMuscle = null;
  document.getElementById('add-ex-search').value = '';
  showAddExerciseForm(false);
  renderAddExerciseList();
  const overlay = document.getElementById('add-ex-sheet');
  overlay.onSheetClose = () => { pickCallback = null; };
  openSheet('add-ex-sheet');
}

function editorPickExercise() {
  const d = editor.plan.days[editor.dayIdx];
  openPicker(d.exercises, t => {
    editorChange(() => d.exercises.push(exerciseFromTemplate(t)));
    showToast(`${t.name} added to Day ${editor.dayIdx + 1}`);
  });
}

function editorPickAlt() {
  const ex = editor.plan.days[editor.dayIdx].exercises[editor.exIdx];
  openPicker([ex], t => {
    const alt = exerciseFromTemplate(t);
    delete alt.alt;
    editorChange(() => { ex.alt = alt; });
  });
}

async function saveEditedPlan() {
  const plan = editor.plan;
  plan.planName = (plan.planName || '').trim() || 'My Plan';
  const emptyDay = plan.days.findIndex(d => !d.exercises.length);
  if (!plan.days.length) return showToast('Add at least one day', { type: 'error' });
  if (emptyDay !== -1) {
    editorGo('day', emptyDay);
    haptic('error');
    return showToast(`Day ${emptyDay + 1} needs at least one exercise`, { type: 'error' });
  }
  const nameless = plan.days.flatMap(d => d.exercises).some(e => !String(e.name).trim());
  if (nameless) return showToast('Every exercise needs a name', { type: 'error' });
  if (anyUnsavedSets() && !await confirmSheet('Save plan changes?', 'Unsaved sets in your current workout will be cleared. Saved history is kept.', 'Save Plan')) return;
  const days = plan.days.map((d, i) => ({ day: `Day ${i + 1}`, title: (d.title || '').trim() || `Day ${i + 1}`, exercises: d.exercises }));
  editor.saved = true;
  const schedule = plan.schedule.some(v => Number.isInteger(v)) ? plan.schedule : undefined;
  // Editing the plan keeps a program under way
  const program = getProgram();
  setActivePlan({ planName: plan.planName, days, ...(schedule ? { schedule } : {}), ...(program ? { program } : {}) });
  document.getElementById('editor-sheet').dataset.saved = '1';
  closeSheet('editor-sheet');
  editor = null;
  renderSettings();
  updateStats();
  haptic('success');
  showToast('Plan saved');
}

// "Build my own": start from empty days, keeping the current plan until it's saved
function buildOwnPlan(days = 3) {
  const n = Math.min(7, Math.max(1, days));
  const weekdays = DEFAULT_WEEKDAYS[n];
  openPlanEditor({ plan: { planName: 'My Plan', schedule: defaultSchedule(n), days: weekdays.map((w, i) => ({ day: `Day ${i + 1}`, title: WEEKDAY_NAMES[w], exercises: [] })) } });
  setTimeout(() => editorGo('day', 0), 80);
}
