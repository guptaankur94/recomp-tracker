/* The active plan, the Plan tab and the ready-made plan browser. */

/* Workout plans: built-in default or a custom plan imported from an AI chatbot */
const DEFAULT_PLAN_NAME = 'Recomposition Split';

function getCustomPlan() {
  const plan = readJSON(PLAN_KEY, null);
  return plan && Array.isArray(plan.days) && plan.days.length ? plan : null;
}

function getPlanName() {
  const plan = getCustomPlan();
  return plan ? plan.planName : templatePlan(TEMPLATES[0]).planName;
}

function loadActivePlan() {
  const plan = getCustomPlan();
  programData = plan ? plan.days : templatePlan(TEMPLATES[0]).days;
  if (currentDayIdx > programData.length) currentDayIdx = 0;
}

function planExerciseOut(ex) {
  const out = { name: ex.name, warmup: ex.warmup, sets: ex.sets, reps: ex.repTarget, weight: ex.weightTarget, rest: ex.rest };
  if (out.warmup === undefined) delete out.warmup;
  if (ex.goal) out.goal = ex.goal;
  if (ex.cue) out.cue = ex.cue;
  return out;
}

// Plan in the same friendly format the AI prompt asks for
function planToJson() {
  return JSON.stringify({
    planName: getPlanName(),
    days: programData.map(d => ({
      title: d.title,
      exercises: d.exercises.map(ex => ex.alt ? { ...planExerciseOut(ex), alt: planExerciseOut(ex.alt) } : planExerciseOut(ex))
    }))
  }, null, 2);
}

function anyUnsavedSets() {
  return programData.some((_, i) => dayHasDraft(i)) || dayHasDraft(programData.length);
}

// Unsaved sets, swaps and set counts are tied to exercise positions, so they reset with a new plan.
function setActivePlan(plan) {
  removeKeysMatching(/^(active_)?d\d+_e\d+_/);
  removeKeysMatching(/^active_d\d+_meta$/);
  removeKeysMatching(/^custom_ex_d\d+$/);
  removeKeysMatching(/^swap_d\d+_e\d+$/);
  if (plan) localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
  else localStorage.removeItem(PLAN_KEY);
  currentDayIdx = 0;
  loadActivePlan();
  currentDayIdx = initialDayIdx();
  initNav();
  renderWorkout();
  updateHeader();
  renderPlanSummary();
}

function planDaysHtml(days, schedule = null) {
  return days.map((d, i) => `
    <div class="plan-day">
      <span class="day-dot" style="background:${dayColor(d.day)}"></span>
      <div class="plan-day-main">
        <div class="plan-day-title">${escapeHtml(d.day)} · ${escapeHtml(d.title)}${schedule && weekdaysFor(i, schedule).length ? ` <span class="plan-day-when">${weekdaysFor(i, schedule).join(', ')}</span>` : ''}</div>
        <div class="plan-day-sub">${d.exercises.map(e => escapeHtml(e.name)).join(' · ')}</div>
      </div>
    </div>`).join('');
}

function renderPlanSummary() {
  const total = programData.reduce((n, d) => n + d.exercises.length, 0);
  document.getElementById('plan-summary').innerHTML =
    `<strong>${escapeHtml(getPlanName())}</strong> · ${programData.length} days · ${total} exercises · ${getSchedule() ? 'weekly schedule' : 'rotates in order'}`;
  document.getElementById('plan-days').innerHTML = planDaysHtml(programData, getSchedule());
  if (currentView === 'plan') renderPlanView();
}

/* Plan tab: the active plan, each day, and ways to start a different one */
function dayMinutes(day) {
  const sec = day.exercises.reduce((t, ex) => t + (parseInt(ex.sets, 10) || 3) * ((parseInt(ex.rest, 10) || 90) + 40) + (parseInt(ex.warmup, 10) || 0) * 60, 0);
  return Math.max(10, Math.round(sec / 60 / 5) * 5);
}

function startPlanDay(i) {
  currentDayIdx = i;
  switchView('workout');
  initNav();
  scrollActiveTab();
  renderWorkout();
  haptic('light');
}

function addPlanDay() {
  openPlanEditor();
  setTimeout(() => editorAddDay(), 80);
}

function renderPlanView() {
  const schedule = getSchedule();
  const total = programData.reduce((n, d) => n + d.exercises.length, 0);
  const week = WEEKDAYS.map((w, i) => {
    const d = schedule ? schedule[i] : null;
    const on = Number.isInteger(d) && programData[d];
    return `<span class="week-dot ${on ? 'on' : ''}" ${on ? `style="--c:${dayColor(programData[d].day)}"` : ''} title="${WEEKDAY_NAMES[i]}${on ? ` · ${escapeHtml(programData[d].title)}` : ' · Rest'}">${w[0]}</span>`;
  }).join('');
  const tile = (iconSvg, color, title, sub, onclick) => `
    <button class="new-plan-tile" onclick="${onclick}">
      <span class="new-plan-ico" style="background:${color}">${iconSvg}</span>
      <span class="new-plan-title">${title}</span>
      <span class="new-plan-sub">${sub}</span>
    </button>`;
  document.getElementById('plan-view').innerHTML = `
    <div class="card plan-hero">
      <div class="plan-hero-name">${escapeHtml(getPlanName())}</div>
      <div class="plan-hero-meta">${programData.length} day${programData.length === 1 ? '' : 's'} · ${total} exercises · ${schedule ? 'weekly schedule' : 'rotates in order'}</div>
      ${schedule ? `<div class="week-strip" aria-label="Weekly schedule">${week}</div>` : ''}
      <div class="plan-own">${icon('pencil', 2.2)}<span>This plan is yours. Change any day, exercise, set or rest time. Your history is kept.</span></div>
      <button class="btn btn-primary" onclick="openPlanEditor()">Edit Plan</button>
    </div>
    ${programCardHtml()}

    <div class="group-label">Days</div>
    ${programData.map((d, i) => {
      const when = weekdaysFor(i, schedule);
      const names = d.exercises.map(e => escapeHtml(e.name));
      return `
      <div class="card pday" onclick="openPlanEditor({ dayIdx: ${i} })" role="button" aria-label="Edit ${escapeHtml(d.day)} · ${escapeHtml(d.title)}">
        <div class="pday-head">
          <span class="pday-num" style="background:${dayColor(d.day)}">${i + 1}</span>
          <div class="pday-text">
            <div class="pday-title">${escapeHtml(d.title)}</div>
            <div class="pday-meta">${when.length ? `${when.join(', ')} · ` : ''}${d.exercises.length} exercise${d.exercises.length === 1 ? '' : 's'} · ~${dayMinutes(d)} min</div>
          </div>
          <button class="btn btn-secondary btn-sm pday-start" onclick="event.stopPropagation(); startPlanDay(${i})">Start</button>
        </div>
        <div class="pday-ex">${names.slice(0, 4).join(' · ')}${names.length > 4 ? ` · +${names.length - 4} more` : ''}</div>
        <div class="pday-edit">${icon('pencil', 2.2)}Edit day</div>
      </div>`;
    }).join('')}
    ${programData.length < 7 ? '<button class="btn btn-secondary plan-add-day" onclick="addPlanDay()">+ Add Day</button>' : ''}

    <div class="group-label">Start a different plan</div>
    <div class="new-plan-grid">
      ${tile(icon('pencil', 2.2), '#3987e5', 'Build my own', 'Pick days and exercises', 'buildOwnPlan(Math.max(1, programData.length))')}
      ${tile(ROW_ICONS.plan, '#199e70', 'Starter plans', 'Proven programmes', 'openTemplatesSheet()')}
      ${tile(ROW_ICONS.ai, '#9085e9', 'Create with AI', 'ChatGPT, Claude, Gemini', 'openAiSheet()')}
      ${tile(ROW_ICONS.backup, '#636366', 'Import a file', '.json or .txt plan', "document.getElementById('plan-file').click()")}
    </div>
    <div class="plan-foot">Switching plans keeps your workout history and records.</div>
    <button class="guide-link" onclick="openGuide()">${icon('infoCircle', 1.8)}How Recomp works</button>`;
}

function openPlanSheet() {
  renderPlanSummary();
  openSheet('plan-sheet');
}

function templateCardHtml(t, { featured = false, recommended = false, onclick = '' } = {}) {
  const plan = templatePlan(t);
  return `
    <div class="tpl-card ${featured ? 'featured' : ''}" ${onclick ? `onclick="${onclick}" role="button"` : ''}>
      ${recommended || t.creator ? `<div class="tpl-badges">${recommended ? '<span class="tpl-badge">Recommended for you</span>' : ''}${t.creator ? '<span class="tpl-badge creator">Creator\'s plan</span>' : ''}</div>` : ''}
      <div class="tpl-name">${escapeHtml(t.name)}</div>
      <div class="tpl-meta">${t.days} days a week · ~${t.minutes} min · ${escapeHtml(t.level)}</div>
      <div class="tpl-blurb">${escapeHtml(t.blurb)}</div>
      ${featured ? `<div class="plan-days">${planDaysHtml(plan.days, plan.schedule)}</div>` : ''}
    </div>`;
}

/* Template browser (Settings → Workout plan) */
let tplPicked = null;

function openTemplatesSheet() {
  closeSheet('plan-sheet');
  const current = getCustomPlan();
  tplPicked = (current && current.templateId) || recommendTemplate(readJSON(SETUP_KEY, { days: 3, equipment: 'gym', level: 'Beginner' }));
  renderTemplatesSheet();
  setTimeout(() => openSheet('templates-sheet'), 50);
}

let tplFilter = 'all';

function filterTemplates(type) {
  tplFilter = type;
  tplPicked = pickForFilter(tplPicked, type, null);
  haptic('light');
  renderTemplatesSheet();
}

function pickTemplate(id) {
  tplPicked = id;
  haptic('light');
  renderTemplatesSheet();
  document.querySelector('#templates-sheet .sheet').scrollTop = 0;
}

function renderTemplatesSheet() {
  const picked = templateById(tplPicked);
  const current = getCustomPlan();
  document.getElementById('tpl-list').innerHTML = templateListHtml({ picked: picked.id, filter: tplFilter, pickFn: 'pickTemplate', filterFn: 'filterTemplates' });
  document.getElementById('tpl-use').textContent = current && current.templateId === picked.id ? `Restart ${picked.name}` : `Use ${picked.name}`;
}

async function useTemplate() {
  const t = templateById(tplPicked);
  const current = getCustomPlan();
  const warning = anyUnsavedSets() ? ' Unsaved sets will be cleared.' : '';
  if (current && !await confirmSheet(`Switch to ${t.name}?`, `This replaces “${current.planName}”.${warning} Your workout history is kept.`, 'Switch Plan')) return;
  setActivePlan(templatePlan(t));
  closeSheet('templates-sheet');
  renderSettings();
  haptic('success');
  showToast(`Now using ${t.name}`);
}
