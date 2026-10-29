/* Create a plan with AI: details form, prompt, chatbot links, upload and paste. */

const AI_GOALS = { recomp: 'Lose fat and build muscle', gain: 'Build muscle', lose: 'Lose fat', strength: 'Get stronger' };

// The details asked for in the AI sheet: prefilled from the profile and last time, saved back as they change
function fillAiForm() {
  const p = getProfile() || {};
  const setup = readJSON(SETUP_KEY, {});
  const val = (id, v) => { if (v !== undefined && v !== null && v !== '') document.getElementById(id).value = String(v); };
  val('ai-sex', p.sex);
  val('ai-age', profileAge(p) || setup.age);
  val('ai-height', p.heightCm);
  val('ai-weight', currentWeightKg(p));
  val('ai-goal', setup.goal && AI_GOALS[setup.goal] ? setup.goal : p.goalType);
  val('ai-days', setup.days ? Math.min(7, Math.max(2, setup.days)) : null);
  val('ai-level', setup.level);
  val('ai-equipment', setup.equipmentText || { gym: 'Full commercial gym', dumbbells: 'A pair of adjustable dumbbells and a bench', bodyweight: 'No equipment, bodyweight at home' }[setup.equipment]);
  val('ai-notes', setup.notes);
}

function aiFormValid() {
  const checks = [['ai-age', 13, 90, 'Age should be 13–90.'], ['ai-height', 100, 250, 'Height should be 100–250 cm.'], ['ai-weight', 25, 300, 'Weight should be 25–300 kg.']];
  for (const [id, lo, hi, msg] of checks) {
    const el = document.getElementById(id);
    const v = parseFloat(el.value);
    if (el.value.trim() && !(v >= lo && v <= hi)) { fieldError(el, msg); return false; }
  }
  return true;
}

function saveAiForm() {
  const get = id => document.getElementById(id).value.trim();
  const num = id => { const v = parseFloat(get(id)); return isNaN(v) ? null : Math.round(v * 10) / 10; };
  const goal = get('ai-goal');
  localStorage.setItem(SETUP_KEY, JSON.stringify({ ...readJSON(SETUP_KEY, {}), age: num('ai-age'), goal, days: parseInt(get('ai-days'), 10), level: get('ai-level'), equipmentText: get('ai-equipment'), notes: get('ai-notes') }));
  const p = getProfile() || {};
  const next = { ...p, goalType: goal === 'strength' ? 'gain' : goal };
  if (get('ai-sex')) next.sex = get('ai-sex');
  if (num('ai-height') >= 100 && num('ai-height') <= 250) next.heightCm = num('ai-height');
  if (num('ai-weight') >= 25 && num('ai-weight') <= 300) next.weightKg = num('ai-weight');
  if (num('ai-age') >= 13 && num('ai-age') <= 90 && !calcAge(p.birthDate)) next.age = Math.round(num('ai-age'));
  localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  updateHeader();
  updateStats();
}

document.querySelectorAll('#ai-sheet .ai-form input, #ai-sheet .ai-form select').forEach(el => el.addEventListener('change', () => {
  if (aiFormValid()) saveAiForm();
  document.getElementById('ai-copy-btn').innerHTML = 'Copy Prompt';
  updateAiSteps();
}));

function buildAiPrompt() {
  const p = getProfile() || {};
  const get = id => document.getElementById(id).value.trim();
  const sex = get('ai-sex');
  const age = get('ai-age');
  const height = get('ai-height');
  const weight = get('ai-weight');
  const days = document.getElementById('ai-days').value;
  const level = document.getElementById('ai-level').value;
  const equipment = document.getElementById('ai-equipment').value.trim() || 'Standard commercial gym';
  const notes = document.getElementById('ai-notes').value.trim();
  const about = [
    sex && `Sex: ${sex}`,
    age && `Age: ${age}`,
    height && `Height: ${height} cm`,
    weight && `Weight: ${weight} kg`,
    p.goalKg && `Goal weight: ${p.goalKg} kg`,
    `Goal: ${AI_GOALS[get('ai-goal')] || AI_GOALS.recomp}`,
    p.activity && `Daily activity: ${ACTIVITY_LEVELS[p.activity].label}`,
    `Experience: ${level}`,
    `Equipment: ${equipment}`,
    notes && `Notes: ${notes}`
  ].filter(Boolean).map(line => `- ${line}`).join('\n');

  return `Act as an experienced strength coach. Create a ${days}-day-per-week workout plan for me, to be imported into my workout tracker app.

About me:
${about}

Rules:
- Exactly ${days} training days, 4–7 exercises per day, ordered big compound lifts first.
- "sets": 2–5. "reps": a range like "8–12 reps" (or "45s hold" / "Failure" where it fits).
- "weight": a realistic starting load for me, e.g. "40–50 kg", "12.5 kg DBs", "Moderate" or "Bodyweight".
- "goal": what I should lift by the end of a 12-week program if I train consistently: { "weight": kg as a number, "reps": a number } (for bodyweight or timed moves, just { "reps": number }, using seconds for holds). Ambitious but realistic for me; the app shows it on every exercise as the target to reach.
- "rest": seconds between sets as a number (60–180).
- "cue": one short technique tip.
- "warmup": number of light ramp-up sets before the working sets (0–3), not counted as working sets. Use 2 for the day's first heavy compound lift (3 if its working sets are 5 reps or fewer), 1 for a later compound lift or the first exercise for a new joint or muscle (e.g. first biceps or triceps move, overhead or elbow-heavy moves), and 0 for isolation, high-rep or bodyweight work on muscles already warmed up.
- Every exercise needs an "alt": an alternative using different equipment, with its own sets/reps/weight/rest/cue tuned for the same effort (lighter load = more reps or slower tempo).

How to send it: create a downloadable JSON file named my-plan.json containing the plan, so I can download it and upload it to the app (a my-plan.txt file with the same JSON is fine too). Don't paste the JSON into the chat. Only if you can't create files at all, reply with just the JSON inside one code block and nothing else.

The file must be valid JSON in exactly this format:
{
  "planName": "Short plan name",
  "days": [
{
  "title": "Push – Chest, Shoulders & Triceps",
  "exercises": [
    {
      "name": "Barbell Bench Press",
      "warmup": 2,
      "sets": 3,
      "reps": "8–10 reps",
      "weight": "40–50 kg",
      "goal": { "weight": 60, "reps": 8 },
      "rest": 150,
      "cue": "3s lowering, pause on the chest",
      "alt": { "name": "DB Bench Press", "warmup": 2, "sets": 3, "reps": "10–12 reps", "weight": "15–20 kg DBs", "rest": 120, "cue": "Full stretch at the bottom" }
    }
  ]
}
  ]
}`;
}

// Chatbots often wrap JSON in ``` fences or add a sentence around it; pull out the JSON object.
function extractJson(text) {
  let t = String(text).replace(/```(?:json)?/gi, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error("Couldn't find a plan in that. Upload the my-plan.json file from the chatbot, or paste its whole reply.");
  t = t.slice(start, end + 1);
  try {
    return JSON.parse(t);
  } catch (e) {
    try {
      return JSON.parse(t.replace(/[“”]/g, '"'));
    } catch (e2) {
      throw new Error("The plan text is incomplete or has a formatting error. Ask the chatbot to \"reply with only valid JSON\" and try again.");
    }
  }
}

function normalizePlan(data) {
  const rawDays = Array.isArray(data) ? data : (data && data.days);
  if (!Array.isArray(rawDays) || !rawDays.length) throw new Error('The plan has no training days.');
  if (rawDays.length > 7) throw new Error(`The plan has ${rawDays.length} days; the maximum is 7.`);

  const text = v => (v === undefined || v === null) ? '' : String(v).trim();
  const int = (v, min, max, fallback) => {
    const n = parseInt(v, 10);
    return isNaN(n) ? fallback : Math.min(max, Math.max(min, n));
  };
  const exercise = (raw, where) => {
    if (!raw || typeof raw !== 'object' || !text(raw.name)) throw new Error(`${where} is missing an exercise name.`);
    const reps = raw.reps ?? raw.repTarget;
    const ex = {
      name: text(raw.name),
      repTarget: typeof reps === 'number' ? `${reps} reps` : (text(reps) || '8–12 reps'),
      weightTarget: text(raw.weight ?? raw.weightTarget) || 'Moderate',
      rest: int(raw.rest ?? raw.restSec, 15, 600, 90),
      sets: int(raw.sets, 1, 10, 3)
    };
    if (text(raw.cue)) ex.cue = text(raw.cue);
    const warmup = raw.warmup ?? raw.warmupSets ?? raw.warmups;
    if (warmup !== undefined && warmup !== null && !Number.isNaN(parseInt(warmup, 10))) ex.warmup = int(warmup, 0, 3, 0);
    // The goal for the end of the program: { weight, reps } or text like "60 kg × 8" / "15 reps"
    const goal = raw.goal ?? raw.target;
    let gw = 0;
    let gr = 0;
    if (goal && typeof goal === 'object') {
      gw = parseFloat(goal.weight ?? goal.kg) || 0;
      gr = parseInt(goal.reps ?? goal.seconds, 10) || 0;
    } else if (typeof goal === 'string' || typeof goal === 'number') {
      const m = String(goal).match(/(\d+(?:\.\d+)?)\s*kg\s*[×x*]\s*(\d+)/i);
      if (m) { gw = parseFloat(m[1]); gr = parseInt(m[2], 10); } else gr = parseInt(goal, 10) || 0;
    }
    if (gr > 0 && gr <= 500 && gw >= 0 && gw <= 1000) ex.goal = gw > 0 ? { weight: Math.round(gw * 100) / 100, reps: gr } : { reps: gr };
    return ex;
  };

  const days = rawDays.map((d, i) => {
    const exercises = d && (d.exercises || d.workout);
    if (!Array.isArray(exercises) || !exercises.length) throw new Error(`Day ${i + 1} has no exercises.`);
    if (exercises.length > 15) throw new Error(`Day ${i + 1} has ${exercises.length} exercises; the maximum is 15.`);
    return {
      day: `Day ${i + 1}`,
      title: text(d.title || d.name || d.focus) || `Workout ${i + 1}`,
      exercises: exercises.map((raw, j) => {
        const ex = exercise(raw, `Day ${i + 1}, exercise ${j + 1}`);
        if (raw.alt && typeof raw.alt === 'object' && text(raw.alt.name)) ex.alt = exercise(raw.alt, `Day ${i + 1}, exercise ${j + 1} (alt)`);
        return ex;
      })
    };
  });
  const plan = { planName: text(data.planName || data.name) || 'Custom Plan', days };
  if (Array.isArray(data.schedule) && data.schedule.length === 7) {
    plan.schedule = data.schedule.map(v => (Number.isInteger(v) && v >= 0 && v < days.length ? v : null));
  }
  // A program already under way (kept through backups)
  const program = data.program;
  if (program && Number.isInteger(program.weeks) && program.weeks >= 1 && program.weeks <= 52 && /^\d{4}-\d{2}-\d{2}$/.test(program.startDate || '')) {
    plan.program = { weeks: program.weeks, startDate: program.startDate };
  }
  return plan;
}

/* Guided AI plan: the reply is checked as it is pasted and previewed before it replaces anything */
let pendingPlan = null;

function openAiSheet(text = '') {
  fillAiForm();
  document.getElementById('ai-reply').value = text;
  document.getElementById('ai-paste').open = !!text;
  document.getElementById('ai-copy-btn').innerHTML = 'Copy Prompt';
  validatePlanPaste();
  openSheet('ai-sheet');
}

function validatePlanPaste() {
  const text = document.getElementById('ai-reply').value.trim();
  const status = document.getElementById('ai-status');
  const preview = document.getElementById('ai-preview');
  const useBtn = document.getElementById('ai-use-btn');
  pendingPlan = null;
  preview.innerHTML = '';
  status.className = 'plan-status';
  if (!text) {
    status.textContent = '';
  } else {
    try {
      pendingPlan = normalizePlan(extractJson(text));
      const total = pendingPlan.days.reduce((n, d) => n + d.exercises.length, 0);
      status.className = 'plan-status ok';
      status.innerHTML = `${icon('check', 3)}<span><strong>${escapeHtml(pendingPlan.planName)}</strong> · ${pendingPlan.days.length} days · ${total} exercises</span>`;
      preview.innerHTML = planDaysHtml(pendingPlan.days) +
        (anyUnsavedSets() ? '<div class="plan-warning">Unsaved sets in your current plan will be cleared. Saved history is kept.</div>' : '');
    } catch (e) {
      status.className = 'plan-status error';
      status.textContent = e.message;
    }
  }
  useBtn.disabled = !pendingPlan;
  updateAiSteps();
}

function useAiPlan() {
  if (!pendingPlan) return;
  const plan = pendingPlan;
  setActivePlan(plan);
  document.getElementById('ai-sheet').dataset.saved = '1';
  const inSetup = !!introPending;
  closeSheet('ai-sheet');
  if (inSetup) return;
  haptic('success');
  showToast(`“${plan.planName}” is now your plan`);
  renderSettings();
}

// Each step of the AI sheet gets a tick once it's done
function updateAiSteps() {
  const done = {
    1: ['ai-sex', 'ai-age', 'ai-height', 'ai-weight'].every(id => document.getElementById(id).value.trim()),
    2: document.getElementById('ai-copy-btn').textContent.includes('Copied'),
    3: !!pendingPlan,
    4: !!pendingPlan
  };
  for (let n = 1; n <= 4; n++) {
    const num = document.querySelector(`#ai-step-${n} .step-num`);
    num.classList.toggle('done', done[n]);
    num.innerHTML = done[n] ? icon('check', 3.4) : String(n);
  }
}

/* Chatbot buttons: on iPhone try the app first, and open the website if the app doesn't take over.
   A chatbot whose app didn't open is remembered, so next time its website opens straight away. */
const CHATBOTS = {
  chatgpt: { app: 'chatgpt://', web: 'https://chatgpt.com/' },
  claude: { app: 'claude://', web: 'https://claude.ai/new' },
  gemini: { app: 'googlegemini://', web: 'https://gemini.google.com/app' }
};

const NO_APP_KEY = 'recomp_chatbot_no_app';

function openChatbot(e, id) {
  const bot = CHATBOTS[id];
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const noApp = readJSON(NO_APP_KEY, {});
  if (!isIOS || noApp[id]) return; // the link opens the website as usual
  e.preventDefault();
  let left = false;
  const onHide = () => { if (document.hidden) left = true; };
  document.addEventListener('visibilitychange', onHide);
  window.location.href = bot.app;
  setTimeout(() => {
    document.removeEventListener('visibilitychange', onHide);
    if (left || document.hidden) return;
    localStorage.setItem(NO_APP_KEY, JSON.stringify({ ...noApp, [id]: true }));
    if (!window.open(bot.web, '_blank')) window.location.href = bot.web;
  }, 1500);
}

function copyAiPrompt() {
  if (!aiFormValid()) return;
  saveAiForm();
  copyText(buildAiPrompt(), 'Prompt copied. Paste it into your chatbot, then upload the file it gives you.', 'AI Prompt').then(ok => {
    if (ok) document.getElementById('ai-copy-btn').innerHTML = `${icon('check', 3)}Copied`;
    updateAiSteps();
  });
}

function copyCurrentPlan() {
  copyText(`Here is my current workout plan. Please adjust it as I describe below and send the updated plan back as a downloadable file named my-plan.json in the same JSON format (if you can't create files, reply with only the JSON in one code block).\n\nMy changes: \n\n${planToJson()}`,
    'Plan copied. Paste it into a chatbot with your changes, then upload the file in Create a Plan with AI.', 'Current Plan');
}

function importPlanFile(inputEl) {
  const file = inputEl.files[0];
  inputEl.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    if (openSheets.includes(document.getElementById('ai-sheet'))) {
      document.getElementById('ai-reply').value = reader.result;
      validatePlanPaste();
      if (pendingPlan && introPending) return useAiPlan();
      document.getElementById('ai-status').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      openAiSheet(String(reader.result));
    }
  };
  reader.readAsText(file);
}
