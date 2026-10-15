/* Ready-made plans and how they are built from the library. */

/* Starter templates. `build` returns days of [title, [[exercise, overrides], ...]]. */
const TEMPLATES = [
  {
    id: 'full-body-3', name: 'Full Body 3×', days: 3, level: 'Beginner friendly', equipment: 'gym', minutes: 50,
    blurb: 'Every muscle three times a week. The best start for most people.',
    build: () => [
      ['Full Body A', [['Barbell Back Squat', { reps: '6–8' }], ['Barbell Bench Press'], ['Lat Pulldown'], ['Romanian Deadlift'], ['Dumbbell Lateral Raise'], ['Plank']]],
      ['Full Body B', [['Leg Press'], ['Seated Dumbbell Shoulder Press'], ['Seated Cable Row'], ['Lying Leg Curl'], ['Dumbbell Curl'], ['Triceps Pushdown']]],
      ['Full Body C', [['Bulgarian Split Squat', { warmup: 2 }], ['Incline Dumbbell Press'], ['Assisted Pull-ups'], ['Hip Thrust'], ['Face Pull'], ['Hanging Knee Raise']]]
    ]
  },
  {
    id: 'full-body-2', name: 'Full Body 2×', days: 2, level: 'Beginner friendly', equipment: 'gym', minutes: 55,
    blurb: 'Two full-body sessions a week for a busy schedule. Every muscle twice a week.',
    build: () => [
      ['Full Body A', [['Barbell Back Squat', { reps: '6–8' }], ['Barbell Bench Press'], ['Lat Pulldown'], ['Romanian Deadlift'], ['Dumbbell Lateral Raise'], ['Plank']]],
      ['Full Body B', [['Leg Press'], ['Incline Dumbbell Press'], ['Seated Cable Row'], ['Hip Thrust'], ['Dumbbell Curl'], ['Triceps Pushdown']]]
    ]
  },
  {
    id: 'strength-5x5-3', name: 'Strength 5×5', days: 3, level: 'Beginner to intermediate', equipment: 'gym', minutes: 60, type: 'strength',
    blurb: 'The classic strength builder: five heavy sets of five on the big barbell lifts. Add a little weight every session.',
    build: () => [
      ['Workout A', [['Barbell Back Squat', { sets: 5, reps: '5', rest: 180, warmup: 3 }], ['Barbell Bench Press', { sets: 5, reps: '5', rest: 180, warmup: 3 }], ['Barbell Bent-Over Row', { sets: 5, reps: '5', rest: 150, warmup: 2 }], ['Plank', { warmup: 0 }]]],
      ['Workout B', [['Barbell Back Squat', { sets: 5, reps: '5', rest: 180, warmup: 3 }], ['Barbell Overhead Press', { sets: 5, reps: '5', rest: 180, warmup: 2 }], ['Trap Bar Deadlift', { sets: 3, reps: '5', rest: 180, warmup: 2 }], ['Chin-ups', { reps: '5–8', warmup: 0 }]]],
      ['Workout A2', [['Barbell Back Squat', { sets: 5, reps: '5', rest: 180, warmup: 3 }], ['Barbell Bench Press', { sets: 5, reps: '5', rest: 180, warmup: 3 }], ['Barbell Bent-Over Row', { sets: 5, reps: '5', rest: 150, warmup: 2 }], ['Hanging Knee Raise', { warmup: 0 }]]]
    ]
  },
  {
    id: 'glutes-legs-4', name: 'Glutes & Legs 4×', days: 4, level: 'Beginner to intermediate', equipment: 'gym', minutes: 55, type: 'split',
    blurb: 'Two lower-body days built around the glutes and hamstrings, plus two upper-body days to keep things balanced.',
    build: () => [
      ['Glutes & Hamstrings', [['Hip Thrust', { warmup: 2 }], ['Romanian Deadlift', { warmup: 1 }], ['Bulgarian Split Squat', { warmup: 0 }], ['Lying Leg Curl', { warmup: 0 }], ['Single-Leg Glute Bridge', { reps: '12–15' }], ['Standing Calf Raise']]],
      ['Upper A', [['Lat Pulldown'], ['Seated Dumbbell Shoulder Press', { warmup: 1 }], ['Seated Cable Row', { warmup: 0 }], ['Dumbbell Lateral Raise'], ['Triceps Pushdown', { warmup: 0 }], ['Dumbbell Curl', { warmup: 0 }]]],
      ['Quads & Glutes', [['Barbell Back Squat', { reps: '6–8' }], ['Walking Lunge', { warmup: 0 }], ['Step-ups', { warmup: 0 }], ['Leg Extension', { warmup: 0 }], ['Seated Leg Curl', { warmup: 0 }], ['Plank']]],
      ['Upper B', [['Incline Dumbbell Press', { warmup: 2 }], ['Single-Arm Dumbbell Row', { warmup: 0 }], ['Face Pull'], ['Cable Lateral Raise', { warmup: 0 }], ['Hammer Curl', { warmup: 0 }], ['Cable Crunch']]]
    ]
  },
  {
    id: 'upper-lower-4', name: 'Upper / Lower 4×', days: 4, level: 'Beginner to intermediate', equipment: 'gym', minutes: 55,
    blurb: 'Two upper and two lower days. Each muscle twice a week with more volume.',
    build: () => [
      ['Upper A', [['Barbell Bench Press'], ['Barbell Bent-Over Row'], ['Seated Dumbbell Shoulder Press', { warmup: 1 }], ['Lat Pulldown', { warmup: 0 }], ['Dumbbell Curl'], ['Triceps Pushdown', { warmup: 0 }]]],
      ['Lower A', [['Barbell Back Squat', { reps: '6–8' }], ['Romanian Deadlift'], ['Leg Extension', { warmup: 0 }], ['Lying Leg Curl', { warmup: 0 }], ['Standing Calf Raise'], ['Hanging Knee Raise']]],
      ['Upper B', [['Incline Dumbbell Press', { warmup: 2 }], ['Seated Cable Row'], ['Lat Pulldown', { warmup: 0 }], ['Dumbbell Lateral Raise'], ['Hammer Curl', { warmup: 1 }], ['Overhead Dumbbell Extension']]],
      ['Lower B', [['Leg Press'], ['Hip Thrust', { warmup: 1 }], ['Bulgarian Split Squat', { warmup: 0 }], ['Seated Leg Curl', { warmup: 0 }], ['Standing Calf Raise'], ['Cable Crunch']]]
    ]
  },
  {
    id: 'ppl-3', name: 'Push / Pull / Legs 3×', days: 3, level: 'Intermediate', equipment: 'gym', minutes: 60,
    blurb: 'Pushing, pulling and legs on separate days. Run it twice a week for 6 days.',
    build: () => PPL_DAYS()
  },
  {
    id: 'ppl-6', name: 'Push / Pull / Legs 6×', days: 6, level: 'Intermediate to advanced', equipment: 'gym', minutes: 60,
    blurb: 'The classic split, twice a week. High frequency for experienced lifters.',
    build: () => [...PPL_DAYS(), ...PPL_DAYS().map(([t, ex]) => [t.replace(' A', ' B'), ex])]
  },
  {
    id: 'dumbbell-3', name: 'Dumbbell Full Body 3×', days: 3, level: 'Beginner friendly', equipment: 'dumbbells', minutes: 45,
    blurb: 'Just a pair of dumbbells and a bench. Works at home or in a busy gym.',
    build: () => [
      ['Full Body A', [['Goblet Squat', { warmup: 2 }], ['Dumbbell Bench Press'], ['Single-Arm Dumbbell Row', { alt: 'Chest-Supported Dumbbell Row' }], ['Dumbbell Romanian Deadlift', { warmup: 0 }], ['Dumbbell Lateral Raise'], ['Dead Bug']]],
      ['Full Body B', [['Bulgarian Split Squat', { warmup: 2 }], ['Seated Dumbbell Shoulder Press', { warmup: 1, alt: 'Pike Push-ups' }], ['Chest-Supported Dumbbell Row', { alt: 'Single-Arm Dumbbell Row' }], ['Glute Bridge', { alt: 'Single-Leg Glute Bridge' }], ['Dumbbell Curl'], ['Overhead Dumbbell Extension', { warmup: 0 }]]],
      ['Full Body C', [['Reverse Lunge', { warmup: 1 }], ['Incline Dumbbell Press', { warmup: 2 }], ['Single-Arm Dumbbell Row', { alt: 'Chest-Supported Dumbbell Row' }], ['Single-Leg Romanian Deadlift'], ['Rear Delt Dumbbell Fly', { alt: 'Dumbbell Lateral Raise' }], ["Farmer's Carry"]]]
    ]
  },
  {
    id: 'bodyweight-3', name: 'Bodyweight at Home 3×', days: 3, level: 'Beginner friendly', equipment: 'bodyweight', minutes: 35,
    blurb: 'No equipment needed. Make it harder by slowing down and adding reps.',
    build: () => [
      ['Full Body A', [['Bodyweight Squat', { warmup: 1, alt: 'Bodyweight Lunge' }], ['Push-ups', { warmup: 1 }], ['Inverted Row'], ['Glute Bridge', { alt: 'Single-Leg Glute Bridge' }], ['Pike Push-ups'], ['Plank']]],
      ['Full Body B', [['Bodyweight Lunge', { warmup: 1 }], ['Decline Push-ups', { warmup: 1 }], ['Towel Door Row'], ['Single-Leg Romanian Deadlift', { alt: 'Single-Leg Glute Bridge' }], ['Bench Dips', { warmup: 0 }], ['Dead Bug']]],
      ['Full Body C', [['Bodyweight Squat', { warmup: 1, reps: '20–30' }], ['Push-ups', { warmup: 1 }], ['Inverted Row'], ['Single-Leg Calf Raise', { warmup: 0, alt: 'Calf Raise on a Step' }], ['Diamond Push-ups'], ['Reverse Crunch', { alt: 'Dead Bug' }]]]
    ]
  },
  {
    id: 'recomp-5', name: 'Recomposition Split 5×', days: 5, level: 'Intermediate', equipment: 'gym', minutes: 60, creator: true,
    blurb: 'The plan this app was built around: five focused days with extra arm work. Progress by adding weight, adding reps, or cutting rest at the same weight.',
    build: null // the creator's own plan, with personal weights swapped for effort targets
  }
];

// Grouping for the plan pickers
const TEMPLATE_TYPES = [['all', 'All'], ['full', 'Full body'], ['split', 'Splits'], ['home', 'Home'], ['strength', 'Strength']];

function templateType(t) {
  return t.type || (t.equipment !== 'gym' ? 'home' : /^full-body/.test(t.id) ? 'full' : 'split');
}

// Switching to a type keeps the picked plan if it fits, otherwise picks that type's best match
function pickForFilter(currentId, type, recId) {
  if (type === 'all' || templateType(templateById(currentId)) === type) return currentId;
  const group = TEMPLATES.filter(t => templateType(t) === type);
  return (group.find(t => t.id === recId) || group[0] || templateById(currentId)).id;
}

// Picked plan first (with its days), then the rest of the chosen group; shared by setup and Plan → Starter plans
function templateListHtml({ picked, rec = null, filter = 'all', pickFn, filterFn }) {
  const chosen = templateById(picked);
  const others = TEMPLATES.filter(t => t.id !== chosen.id && (filter === 'all' || templateType(t) === filter));
  return `
    <div class="tpl-filters" role="group" aria-label="Plan types">${TEMPLATE_TYPES.map(([id, label]) =>
      `<button class="tpl-filter ${filter === id ? 'on' : ''}" onclick="${filterFn}('${id}')" aria-pressed="${filter === id}">${label}</button>`).join('')}</div>
    ${templateCardHtml(chosen, { featured: true, recommended: chosen.id === rec })}
    ${others.length ? `<div class="onb-q">${filter === 'all' ? 'Other plans' : `More ${TEMPLATE_TYPES.find(x => x[0] === filter)[1].toLowerCase()} plans`}</div>` : ''}
    ${others.map(t => templateCardHtml(t, { recommended: t.id === rec, onclick: `${pickFn}('${t.id}')` })).join('')}
    ${!others.length ? '<div class="onb-note">No other plans of this type yet.</div>' : ''}`;
}

const PPL_DAYS = () => [
  ['Push A', [['Barbell Bench Press'], ['Seated Dumbbell Shoulder Press', { warmup: 1 }], ['Incline Dumbbell Press', { warmup: 0 }], ['Dumbbell Lateral Raise'], ['Triceps Pushdown'], ['Overhead Dumbbell Extension', { warmup: 0 }]]],
  ['Pull A', [['Lat Pulldown'], ['Barbell Bent-Over Row'], ['Seated Cable Row', { warmup: 0 }], ['Face Pull'], ['Barbell Curl'], ['Hammer Curl']]],
  ['Legs A', [['Barbell Back Squat', { reps: '6–8' }], ['Romanian Deadlift'], ['Leg Press', { warmup: 0 }], ['Lying Leg Curl', { warmup: 0 }], ['Standing Calf Raise'], ['Hanging Knee Raise']]]
];

// A template as a plan in the app's stored format (day labels, exercises with alternatives)
// The creator's plan for someone else: same exercises, sets, reps and rest, but effort targets
// instead of the creator's own weights (the app suggests weights after the first session).
function effortTarget(target) {
  const t = String(target || '');
  if (!/\d\s*kg/i.test(t)) return t;
  return /^BW\b/i.test(t) ? 'Bodyweight + extra weight' : '2 reps in reserve';
}

function creatorPlanDays() {
  const days = JSON.parse(JSON.stringify(DEFAULT_PLAN));
  days.forEach(d => d.exercises.forEach(ex => {
    ex.weightTarget = effortTarget(ex.weightTarget);
    if (ex.alt) ex.alt.weightTarget = effortTarget(ex.alt.weightTarget);
  }));
  return days;
}

function templatePlan(t) {
  const days = t.build
    ? t.build().map(([title, list], i) => ({ day: `Day ${i + 1}`, title, exercises: list.map(([name, o]) => libExercise(name, o, EQUIPMENT_ALLOWED[t.equipment])) }))
    : creatorPlanDays();
  return { planName: t.name.replace(/ \d×$/, ''), templateId: t.id, days, schedule: defaultSchedule(days.length) };
}

// Recommended template for the setup answers
function recommendTemplate({ days, equipment, level }) {
  if (equipment === 'bodyweight') return 'bodyweight-3';
  if (equipment === 'dumbbells') return 'dumbbell-3';
  if (days <= 2) return 'full-body-2';
  if (days <= 3) return 'full-body-3';
  if (days === 4) return 'upper-lower-4';
  if (days === 5) return level === 'Beginner' ? 'upper-lower-4' : 'recomp-5';
  return level === 'Beginner' ? 'upper-lower-4' : 'ppl-6';
}

function templateById(id) {
  return TEMPLATES.find(t => t.id === id) || TEMPLATES[0];
}
