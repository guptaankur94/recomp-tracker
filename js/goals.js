/* Goals: each exercise's target for the end of the program, how close you are, and the program itself
   (e.g. 12 weeks from a start date). An AI plan can give each exercise a goal; otherwise it's worked out from
   the plan's targets: the top of the weight range for the low end of the reps (all sets at the top weight). */
const PROGRAM_WEEKS = [8, 12, 16];

function rangeNumbers(text) {
  return (String(text || '').match(/\d+(?:\.\d+)?/g) || []).map(Number);
}

// { kg, reps, unit } or null when the plan has no number to aim for ("Moderate", "Failure")
function exerciseGoal(ex) {
  const timed = /\d\s*(s|sec|secs|seconds)\b/i.test(ex.repTarget || '');
  if (ex.goal && ex.goal.reps > 0) return { kg: ex.goal.weight > 0 ? ex.goal.weight : 0, reps: ex.goal.reps, unit: timed ? 'sec' : 'reps', fromPlan: true };
  const reps = rangeNumbers(ex.repTarget);
  if (!reps.length) return null;
  const kgMatch = String(ex.weightTarget || '').match(/(\d+(?:\.\d+)?)(?:\s*[–-]\s*(\d+(?:\.\d+)?))?\s*kg/i);
  const kg = kgMatch ? Number(kgMatch[2] || kgMatch[1]) : 0;
  // A machine set to "Moderate" has no number to aim for: you set the goal yourself
  if (!kg && !timed && !/\bBW\b|bodyweight/i.test(ex.weightTarget || '')) return null;
  // With a weight: reach it for the low end of the reps. Without: the top of the reps (or seconds)
  return { kg, reps: kg ? Math.min(...reps) : Math.max(...reps), unit: timed ? 'sec' : 'reps', fromPlan: false };
}

function goalLabel(goal) {
  const amount = goal.unit === 'sec' ? `${goal.reps} s` : `${goal.reps}`;
  return goal.kg ? `${fmtNum(goal.kg)} kg × ${amount}` : goal.unit === 'sec' ? `${goal.reps} s hold` : `${goal.reps} reps`;
}

// Where you are against the goal, from your best set last time: { pct, reached, toGo } (null before the first time)
function goalProgress(goal, last) {
  if (!goal || !last || !last.sets || !last.sets.length) return null;
  const best = last.sets.reduce((a, s) => (Number(s.weight) > Number(a.weight) || (Number(s.weight) === Number(a.weight) && Number(s.reps) > Number(a.reps)) ? s : a));
  const w = Number(best.weight) || 0;
  const r = Number(best.reps) || 0;
  let pct;
  let toGo = '';
  if (goal.kg) {
    pct = estOneRepMax(w, r) / estOneRepMax(goal.kg, goal.reps);
    if (w < goal.kg) toGo = `${fmtNum(Math.round((goal.kg - w) * 100) / 100)} kg to go`;
    else if (r < goal.reps) toGo = `${goal.reps - r} more rep${goal.reps - r === 1 ? '' : 's'} at ${fmtNum(goal.kg)} kg`;
  } else {
    pct = r / goal.reps;
    if (r < goal.reps) toGo = `${goal.reps - r} more ${goal.unit === 'sec' ? 's' : `rep${goal.reps - r === 1 ? '' : 's'}`}`;
  }
  const reached = goal.kg ? w >= goal.kg && r >= goal.reps : r >= goal.reps;
  return { best: { weight: w, reps: r }, pct: Math.max(0, Math.min(1, reached ? 1 : pct)), reached, toGo };
}

// { week, weeks, endDate, ended } for a program started on startDate ("YYYY-MM-DD"), or null
function programStatus(program, now = new Date()) {
  if (!program || !(program.weeks > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(program.startDate || '')) return null;
  const [y, m, d] = program.startDate.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today - start) / 864e5);
  const end = new Date(y, m - 1, d + program.weeks * 7 - 1);
  return { week: Math.max(1, Math.min(program.weeks, Math.floor(days / 7) + 1)), weeks: program.weeks, endDate: localDateStr(end), ended: days >= program.weeks * 7 };
}

function getProgram() {
  const plan = getCustomPlan();
  return plan && plan.program ? plan.program : null;
}

// The program lives on the active plan, so a new plan starts without one
function saveProgram(program) {
  const plan = getCustomPlan() || templatePlan(TEMPLATES[0]);
  if (program) plan.program = program;
  else delete plan.program;
  localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
}

async function startProgram() {
  const weeks = await actionSheet('Start a program', 'Train your plan for a set number of weeks. Each exercise shows the goal to reach by the end.',
    PROGRAM_WEEKS.map(w => ({ label: `${w} weeks${w === 12 ? ' (recommended)' : ''}`, value: w })));
  if (!weeks) return;
  saveProgram({ weeks, startDate: localDateStr(new Date()) });
  haptic('success');
  showToast(`Week 1 of ${weeks}. Your goals are on every exercise.`);
  renderPlanSummary();
  renderWorkout();
}

async function stopProgram() {
  if (!await confirmSheet('End this program?', 'Your goals stay on each exercise; only the week count stops. Your history is kept.', 'End Program', true)) return;
  saveProgram(null);
  renderPlanSummary();
  renderWorkout();
}

/* The goal panel on an exercise card: the number to reach, big and gold, with where you are and what's left */
function goalPanelHtml(ex, last, exIdx) {
  const goal = exerciseGoal(ex);
  if (!goal) {
    return ex.isCustom ? '' : `<button class="goal-empty" onclick="editGoal(${exIdx})">${icon('arrowUp', 2.4)}Set your goal for ${escapeHtml(ex.name)}</button>`;
  }
  const prog = goalProgress(goal, last);
  const status = programStatus(getProgram());
  const label = status ? (status.ended ? 'Program goal' : `Goal by week ${status.weeks}`) : 'Your goal';
  const pct = prog ? Math.round(prog.pct * 100) : 0;
  const now = prog ? (prog.best.weight > 0 ? `${fmtNum(prog.best.weight)} kg × ${prog.best.reps}` : `${prog.best.reps}${goal.unit === 'sec' ? ' s' : ' reps'}`) : '';
  const sub = !prog ? 'First time: build towards it'
    : prog.reached ? 'Goal reached. Time to raise it.'
    : `Now ${now} · ${prog.toGo}`;
  return `
    <div class="goal-panel ${prog && prog.reached ? 'reached' : ''}" ${ex.isCustom ? '' : `onclick="editGoal(${exIdx})" role="button"`} aria-label="${label}: ${goalLabel(goal)}. ${sub}${ex.isCustom ? '' : '. Change goal'}">
      <div class="goal-head">
        <span class="goal-label">${label}</span>
        ${status && !status.ended ? `<span class="goal-week">Week ${status.week} of ${status.weeks}</span>` : ''}
      </div>
      <div class="goal-row">
        <span class="goal-value">${prog && prog.reached ? icon('check', 3) : ''}${escapeHtml(goalLabel(goal))}</span>
        ${prog ? `<span class="goal-pct">${pct}%</span>` : ''}
      </div>
      <div class="goal-track"><div class="goal-fill" style="width:${pct}%"></div></div>
      <div class="goal-sub">${escapeHtml(sub)}</div>
    </div>`;
}

/* The program card in the Plan tab: start one, or see the week you're in */
function programCardHtml() {
  const status = programStatus(getProgram());
  if (!status) {
    return `
      <div class="card program-card">
        <div class="program-title">Train to a goal</div>
        <div class="program-text">Start a 12-week program and every exercise shows the weight to reach by the end, with how close you are.</div>
        <button class="btn btn-primary" onclick="startProgram()">Start a program</button>
      </div>`;
  }
  const [y, m, d] = status.endDate.split('-').map(Number);
  const end = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `
    <div class="card program-card on">
      <div class="program-head">
        <span class="program-title">${status.ended ? 'Program complete' : `Week ${status.week} of ${status.weeks}`}</span>
        <span class="program-end">${status.ended ? `ended ${end}` : `ends ${end}`}</span>
      </div>
      <div class="goal-track"><div class="goal-fill" style="width:${Math.round((status.ended ? 1 : (status.week - 1) / status.weeks) * 100)}%"></div></div>
      <div class="program-text">${status.ended ? 'See how close you got on each exercise, then start the next block.' : 'Your goal for the end is on every exercise.'}</div>
      ${status.ended ? '<button class="btn btn-primary" onclick="startProgram()">Start the next program</button>' : ''}
      <button class="btn btn-plain" onclick="stopProgram()">End program</button>
    </div>`;
}

// A typed goal: "60 kg × 8", "60x8", "60 8", or just reps ("15") for bodyweight and timed moves
function parseGoalText(text) {
  const t = String(text || '').trim();
  const both = t.match(/^(\d+(?:\.\d+)?)\s*(?:kg)?\s*(?:[×x*]|\s)\s*(\d+)\s*(?:reps?|s|sec)?$/i);
  if (both) {
    const weight = Math.round(parseFloat(both[1]) * 100) / 100;
    const reps = parseInt(both[2], 10);
    return weight > 0 && weight <= 1000 && reps > 0 && reps <= 500 ? { weight, reps } : null;
  }
  const only = t.match(/^(\d+)\s*(?:reps?|s|sec|seconds)?$/i);
  return only && +only[1] > 0 && +only[1] <= 500 ? { reps: parseInt(only[1], 10) } : null;
}

// Your gold standard: set or change an exercise's goal (saved on the plan, so it stays with it)
async function editGoal(exIdx) {
  const ex = getAllExercisesForDay(currentDayIdx)[exIdx];
  if (!ex || ex.isCustom) return;
  const current = exerciseGoal(ex);
  const text = await openDialog({
    title: `Goal for ${ex.name}`,
    message: 'The weight × reps to reach by the end of your program, e.g. 60 kg × 8. For bodyweight moves, just the reps.',
    input: { placeholder: current ? goalLabel(current) : 'e.g. 60 kg × 8' },
    confirmLabel: 'Save goal'
  });
  if (!text) return;
  const goal = parseGoalText(text);
  if (!goal) {
    haptic('error');
    showToast('Type it like 60 kg × 8, or 15 for reps only', { type: 'error' });
    return;
  }
  const plan = getCustomPlan() || templatePlan(TEMPLATES[0]);
  const target = plan.days[currentDayIdx] && plan.days[currentDayIdx].exercises[exIdx];
  if (!target) return;
  if (ex.swapped && target.alt) target.alt.goal = goal;
  else target.goal = goal;
  localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
  loadActivePlan();
  haptic('success');
  showToast(`Goal set: ${goalLabel(exerciseGoal({ ...ex, goal }))}`);
  renderWorkout();
}
