/* First-launch setup: about you, training, choosing a plan and the finish screen. */

/* Existing users keep their plan: before templates existed, the built-in plan was the owner's own
   programme. Anyone with data and no saved plan gets it saved as their plan, unchanged. */
const ONBOARDED_KEY = 'recomp_onboarded';

const SETUP_KEY = 'recomp_setup';

function migrateExistingUserPlan() {
  if (getCustomPlan()) return;
  const hasData = getHistory().length || getBodyweight().length || getProfile() ||
    Object.keys(localStorage).some(k => /^active_d\d+_e\d+_s\d+_/.test(k));
  if (!hasData) return;
  localStorage.setItem(PLAN_KEY, JSON.stringify({ planName: DEFAULT_PLAN_NAME, templateId: 'recomp-5', days: JSON.parse(JSON.stringify(DEFAULT_PLAN)) }));
  localStorage.setItem(ONBOARDED_KEY, '1');
}

function needsOnboarding() {
  return !localStorage.getItem(ONBOARDED_KEY) && !getCustomPlan() && !getHistory().length;
}

/* First-launch setup: welcome → about you → your training → create your plan
   (sample plan, build your own, or AI) → for sample plans, pick one */
const GOALS = [
  { id: 'recomp', label: 'Lose fat & build muscle', sub: 'Both at once' },
  { id: 'gain', label: 'Build muscle', sub: 'Get bigger' },
  { id: 'lose', label: 'Lose fat', sub: 'Keep muscle while leaning out' },
  { id: 'strength', label: 'Get stronger', sub: 'Lift heavier' }
];

const LEVELS = [
  { id: 'Beginner', sub: 'Under 1 year' },
  { id: 'Intermediate', sub: '1–3 years' },
  { id: 'Advanced', sub: '3+ years' }
];

const EQUIPMENT = [
  { id: 'gym', label: 'Full gym', sub: 'Barbells, machines, cables' },
  { id: 'dumbbells', label: 'Dumbbells', sub: 'A pair of dumbbells and a bench' },
  { id: 'bodyweight', label: 'No equipment', sub: 'Bodyweight at home' }
];

let onb = null;

function openOnboarding() {
  const saved = readJSON(SETUP_KEY, {});
  const p = getProfile() || {};
  onb = {
    step: 0, path: null, picked: null,
    name: p.name || '', sex: p.sex || '', age: profileAge(p) || saved.age || '', height: p.heightCm || '', weight: p.weightKg || '', goalKg: p.goalKg || '',
    goal: saved.goal || p.goalType || 'recomp', level: saved.level || 'Beginner', days: saved.days || 3, equipment: saved.equipment || 'gym'
  };
  const el = document.getElementById('onboarding');
  el.hidden = false;
  void el.offsetWidth;
  el.classList.add('open');
  renderOnboarding();
  fitSheetsToKeyboard();
}

function closeOnboarding() {
  const el = document.getElementById('onboarding');
  el.classList.remove('open');
  setTimeout(() => { el.hidden = true; }, 300);
  onb = null;
}

// Typed fields update quietly; choices re-render to show the selection
function onbSet(field, value, quiet = false) {
  onb[field] = value;
  if (!quiet) {
    haptic('light');
    renderOnboarding();
  }
}

function onbAboutValid() {
  if (!onb.sex) { fieldError(document.getElementById('onb-sex'), 'Pick one so your targets are right.'); return false; }
  const need = [['onb-age', 'Age should be 13–90.', 13, 90], ['onb-height', 'Height should be 100–250 cm.', 100, 250], ['onb-weight', 'Weight should be 25–300 kg.', 25, 300]];
  for (const [id, msg, lo, hi] of need) {
    const el = document.getElementById(id);
    const v = parseFloat(el.value);
    if (!el.value || (lo !== undefined && !(v >= lo && v <= hi))) { fieldError(el, msg); return false; }
  }
  const goal = document.getElementById('onb-goalkg');
  if (goal.value && !(parseFloat(goal.value) >= 25 && parseFloat(goal.value) <= 300)) { fieldError(goal, 'Weight should be 25–300 kg.'); return false; }
  return true;
}

// Save what's been answered so far to the profile and setup, so every route (and Settings) uses it
function saveOnbAnswers() {
  const num = v => { const n = parseFloat(v); return isNaN(n) ? null : Math.round(n * 10) / 10; };
  const p = getProfile() || {};
  const profile = { ...p, sex: onb.sex || p.sex || '', heightCm: num(onb.height) || p.heightCm || null, weightKg: num(onb.weight) || p.weightKg || null, goalKg: num(onb.goalKg) || p.goalKg || null, goalType: onb.goal === 'strength' ? 'gain' : onb.goal };
  if (onb.name.trim()) profile.name = onb.name.trim();
  if (num(onb.age) && !calcAge(p.birthDate)) profile.age = Math.round(num(onb.age));
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  localStorage.setItem(SETUP_KEY, JSON.stringify({ ...readJSON(SETUP_KEY, {}), age: num(onb.age), goal: onb.goal, level: onb.level, days: onb.days, equipment: onb.equipment }));
}

function onbNext() {
  if (onb.step === 1) {
    if (!onbAboutValid()) return;
    saveOnbAnswers();
  }
  if (onb.step === 2) saveOnbAnswers();
  onbGo(onb.step + 1);
}

function onbStart(path) {
  haptic('light');
  onb.path = path;
  if (path === 'sample') {
    onb.picked = recommendTemplate(onb);
    return onbGo(4);
  }
  finishOnboarding(path === 'own' ? 'build' : 'ai');
}

function onbGo(step) {
  onb.step = step;
  renderOnboarding();
  document.querySelector('#onboarding .onb-scroll').scrollTop = 0;
}

function choiceGrid(items, current, field, cls = '') {
  return `<div class="opt-grid ${cls}">${items.map(it => `
    <button class="opt ${it.id === current ? 'on' : ''}" onclick="onbSet('${field}', ${typeof it.id === 'number' ? it.id : `'${it.id}'`})" aria-pressed="${it.id === current}">
      <span class="opt-label">${escapeHtml(it.label || String(it.id))}</span>
      ${it.sub ? `<span class="opt-sub">${escapeHtml(it.sub)}</span>` : ''}
    </button>`).join('')}</div>`;
}

function renderOnboarding() {
  const body = document.getElementById('onb-body');
  const foot = document.getElementById('onb-foot');
  // Labelled progress: each stage gets a tick once it's done (step 4 is still "Your plan"; 5 is the finish)
  const stage = onb.step >= 5 ? 4 : Math.min(onb.step, 3);
  document.getElementById('onb-dots').innerHTML = onb.step === 0 ? '' : ['About you', 'Training', 'Your plan'].map((label, i) => {
    const n = i + 1;
    const state = stage > n ? 'done' : stage === n ? 'on' : '';
    return `<span class="onb-stage ${state}"><span class="onb-stage-dot">${state === 'done' ? icon('check', 3.4) : n}</span>${label}</span>`;
  }).join('<span class="onb-stage-line"></span>');
  document.getElementById('onb-back').hidden = onb.step === 0 || onb.step === 5;
  const field = (id, key, label, attrs, sub = '') => `
    <label class="onb-field">${label}${sub ? ` <span class="opt-sub">${sub}</span>` : ''}
      <input ${attrs} id="${id}" value="${escapeHtml(onb[key])}" oninput="onbSet('${key}', this.value, true)">
    </label>`;

  if (onb.step === 0) {
    body.innerHTML = `
      <img class="onb-logo" src="images/icons/icon-192.png" alt="">
      <h2 class="onb-title">Welcome to Recomp</h2>
      <p class="onb-text">Your training plan, rest timer and progress in one place.</p>
      <div class="onb-points">
        <div class="onb-point"><span class="onb-point-icon">${ROW_ICONS.plan}</span><span><strong>A plan that fits you</strong><br>Start from a sample plan, build your own, or let AI create one. Change anything, any time.</span></div>
        <div class="onb-point"><span class="onb-point-icon">${icon('check', 2.6)}</span><span><strong>Log in seconds</strong><br>Tap ✓ after each set and the rest timer starts on its own.</span></div>
        <div class="onb-point"><span class="onb-point-icon">${icon('arrowUp', 2.4)}</span><span><strong>See yourself improve</strong><br>Records for more weight, more reps, or the same work on less rest.</span></div>
        <div class="onb-point"><span class="onb-point-icon">${ROW_ICONS.backup}</span><span><strong>Private by design</strong><br>Everything stays on this phone. No account needed.</span></div>
      </div>`;
    foot.innerHTML = `
      <button class="btn btn-primary" onclick="onbGo(1)">Get Started</button>
      <button class="btn btn-plain" onclick="finishOnboarding('skip')">Skip for now</button>`;
  } else if (onb.step === 1) {
    body.innerHTML = `
      <h2 class="onb-title">About you</h2>
      <p class="onb-text">Used to shape your plan and your calorie and protein targets. It stays on this phone.</p>
      ${field('onb-name', 'name', 'Your name', 'type="text" placeholder="First name (optional)" autocomplete="given-name"')}
      <div class="onb-q">Sex</div>
      <div class="opt-grid two" id="onb-sex" tabindex="-1">${[['male', 'Male'], ['female', 'Female']].map(([id, label]) => `
        <button class="opt ${onb.sex === id ? 'on' : ''}" onclick="onbSet('sex', '${id}')" aria-pressed="${onb.sex === id}"><span class="opt-label">${label}</span></button>`).join('')}</div>
      <div class="onb-row">
        ${field('onb-age', 'age', 'Age', 'type="number" inputmode="numeric" placeholder="e.g. 30"')}
        ${field('onb-height', 'height', 'Height', 'type="number" inputmode="decimal" placeholder="cm"')}
      </div>
      <div class="onb-row">
        ${field('onb-weight', 'weight', 'Weight', 'type="number" step="0.1" inputmode="decimal" placeholder="kg"')}
        ${field('onb-goalkg', 'goalKg', 'Target weight', 'type="number" step="0.1" inputmode="decimal" placeholder="kg · optional"')}
      </div>`;
    foot.innerHTML = `<button class="btn btn-primary" onclick="onbNext()">Continue</button>`;
  } else if (onb.step === 2) {
    body.innerHTML = `
      <h2 class="onb-title">Your training</h2>
      <p class="onb-text">Be realistic. A plan you can keep up beats a perfect one.</p>
      <div class="onb-q">Main goal</div>
      ${choiceGrid(GOALS, onb.goal, 'goal', 'two')}
      <div class="onb-q">How long have you been lifting?</div>
      ${choiceGrid(LEVELS.map(l => ({ ...l, label: l.id })), onb.level, 'level', 'three')}
      <div class="onb-q">Days per week</div>
      ${choiceGrid([2, 3, 4, 5, 6].map(n => ({ id: n })), onb.days, 'days', 'five')}
      <div class="onb-q">Where do you train?</div>
      ${choiceGrid(EQUIPMENT, onb.equipment, 'equipment')}`;
    foot.innerHTML = `<button class="btn btn-primary" onclick="onbNext()">Continue</button>`;
  } else if (onb.step === 3) {
    const option = (path, iconSvg, color, title, sub) => `
      <button class="start-opt" onclick="onbStart('${path}')">
        <span class="start-opt-ico" style="background:${color}">${iconSvg}</span>
        <span class="start-opt-text"><span class="start-opt-title">${title}</span><span class="start-opt-sub">${sub}</span></span>
        <span class="chevron">${icon('chevron')}</span>
      </button>`;
    const rec = templateById(recommendTemplate(onb));
    body.innerHTML = `
      <h2 class="onb-title">Create your plan</h2>
      <p class="onb-text">${onb.name.trim() ? `${escapeHtml(onb.name.trim())}, w` : 'W'}hichever you pick, the plan is yours. Edit any day, exercise, set or rest time later in the Plan tab.</p>
      <div class="start-opts">
        ${option('sample', ROW_ICONS.plan, 'var(--accent)', 'Pick a ready-made plan', `Full body, splits, home, strength and more, with warm-ups, rest times and swaps. We suggest ${escapeHtml(rec.name)} for you.`)}
        ${option('own', icon('pencil', 2.2), '#3987e5', 'Create your own plan', 'Pick your days and exercises from a library of 70+ moves. Sets, reps, rest and warm-ups are filled in for you.')}
        ${option('ai', ROW_ICONS.ai, '#9085e9', 'Create your plan with AI', 'Copy a prompt with your details into ChatGPT, Claude or Gemini, and upload the plan file it gives you.')}
      </div>`;
    foot.innerHTML = '';
  } else if (onb.step === 4) {
    const rec = recommendTemplate(onb);
    const picked = templateById(onb.picked || rec);
    body.innerHTML = `
      <h2 class="onb-title">Ready-made plans</h2>
      <p class="onb-text">Every exercise has a swap if a machine is taken, plus warm-up sets and rest times. Nothing is locked: change it any time in the Plan tab.</p>
      ${templateListHtml({ picked: picked.id, rec, filter: onb.filter || 'all', pickFn: 'onbPickTemplate', filterFn: 'onbFilterTemplates' })}`;
    foot.innerHTML = `<button class="btn btn-positive" onclick="finishOnboarding('sample')">Use ${escapeHtml(picked.name)}</button>`;
  } else {
    // Finish: one calm screen with what to know, then the workout
    const days = programData.length;
    const schedule = getSchedule();
    const title = onb.result === 'uploaded' ? 'Plan uploaded' : onb.result === 'fallback' ? 'Ready when you are' : "You're all set";
    const sub = onb.result === 'uploaded' ? 'Your AI plan is in and ready to train.'
      : onb.result === 'fallback' ? `We've started you on ${escapeHtml(getPlanName())} so you can train today. Build your own or create one with AI any time in the Plan tab.`
      : `${onb.name.trim() ? `${escapeHtml(onb.name.trim())}, y` : 'Y'}our plan is ready.`;
    body.innerHTML = `
      <div class="onb-done-tick">${icon('check', 3)}</div>
      <h2 class="onb-title center">${title}</h2>
      <p class="onb-text center">${sub}</p>
      <div class="onb-card">
        <div class="onb-card-title">${escapeHtml(getPlanName())}</div>
        <div class="onb-card-sub">${days} day${days === 1 ? '' : 's'} a week${schedule ? ` · ${WEEKDAYS.filter((_, w) => Number.isInteger(schedule[w])).join(', ')}` : ''} · first up: ${escapeHtml(dayAt(currentDayIdx).title)}</div>
      </div>
      <div class="onb-card">
        <div class="onb-card-head">${icon('pencil', 2.2)}This plan is yours</div>
        <div class="onb-card-text">Change any day, exercise, set or rest time in the <strong>Plan</strong> tab. Your history is always kept.</div>
      </div>
      <div class="onb-card">
        <div class="onb-card-head">${icon('check', 2.6)}How logging works</div>
        <ol class="onb-steps">
          <li>Type the weight and reps you did. Grey numbers are suggestions.</li>
          <li>Tap <strong>✓</strong> to log the set. The rest timer starts on its own.</li>
          <li>Tap <strong>Finish Workout</strong> at the bottom when you're done.</li>
        </ol>
      </div>`;
    foot.innerHTML = `<button class="btn btn-positive" onclick="startTraining()">Start Training</button>`;
  }
}

function onbPickTemplate(id) {
  onb.picked = id;
  haptic('light');
  renderOnboarding();
  document.querySelector('#onboarding .onb-scroll').scrollTop = 0;
}

function onbFilterTemplates(type) {
  onb.filter = type;
  onb.picked = pickForFilter(onb.picked || recommendTemplate(onb), type, recommendTemplate(onb));
  haptic('light');
  renderOnboarding();
}

// Own plan and AI plan finish in the editor / AI sheet; when that closes, setup comes back for the finish screen
let introPending = null;

function showIntroFinish(result) {
  const answers = introPending || { name: '' };
  introPending = null;
  onb = { ...answers, step: 5, result };
  const el = document.getElementById('onboarding');
  el.hidden = false;
  void el.offsetWidth;
  el.classList.add('open');
  renderOnboarding();
  document.querySelector('#onboarding .onb-scroll').scrollTop = 0;
  haptic('success');
}

function introSheetClosed(id, saved) {
  if (!introPending || !['editor-sheet', 'ai-sheet'].includes(id)) return;
  setTimeout(() => {
    if (introPending && !openSheets.length) showIntroFinish(saved ? (id === 'ai-sheet' ? 'uploaded' : 'saved') : 'fallback');
  }, 360);
}

function startTraining() {
  closeOnboarding();
  switchView('workout');
  window.scrollTo(0, 0);
  renderWorkout();
  updateStats();
}

// Everyone leaves setup with a working plan, so closing the builder or the AI sheet early still leaves a usable app
function finishOnboarding(mode) {
  const choice = templateById(mode === 'sample' ? (onb.picked || recommendTemplate(onb)) : mode === 'skip' ? 'full-body-3' : recommendTemplate(onb));
  setActivePlan(templatePlan(choice));
  localStorage.setItem(ONBOARDED_KEY, '1');
  updateHeader();
  updateStats();
  if (mode === 'sample') return onbGo(5);
  if (mode === 'skip') {
    closeOnboarding();
    switchView('workout');
    window.scrollTo(0, 0);
    return showToast(`Starting you on ${choice.name}. Change it any time in Plan.`, { duration: 4000 });
  }
  introPending = { name: onb.name, days: onb.days };
  const days = onb.days;
  closeOnboarding();
  switchView('workout');
  window.scrollTo(0, 0);
  if (mode === 'build') setTimeout(() => buildOwnPlan(days), 350);
  else setTimeout(() => openAiSheet(), 350);
}

function onbBack() {
  if (onb && onb.step > 0) onbGo(onb.step - 1);
}
