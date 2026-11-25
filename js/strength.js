/* Recommended weights: a starting weight for an exercise you haven't logged yet, worked out the way a coach
   would. Four reference lifts are estimated (a press, a dumbbell curl, a squat and a hinge, each as a one-rep
   max): from your own logged sets first (best set, adjusted for how hard it felt), else the strength you
   entered in Profile, else from the other references, else from your bodyweight. Every exercise is a typical
   fraction of one of them. The weight is for the bottom of the rep range with about 2 reps in reserve, and a
   first try on an estimate goes 10 % lighter: easier to add a step than to grind or get hurt. Approximate by
   nature: the first set tells you, and suggestions take over from your log after that. */

// Exercise: [reference, fraction of the reference's 1RM, 'hand' = per dumbbell, 'side' = per cable handle]
// P = bench press 1RM, C = dumbbell curl 1RM per hand, S = back squat 1RM, H = deadlift 1RM, BW = bodyweight
const STRENGTH = {
  // Chest
  'Barbell Bench Press': ['P', 1], 'Dumbbell Bench Press': ['P', 0.4, 'hand'], 'Incline Barbell Bench Press': ['P', 0.82],
  'Incline Dumbbell Press': ['P', 0.35, 'hand'], 'Machine Chest Press': ['P', 1], 'Pec Deck Machine Flyes': ['P', 0.6],
  'Cable Fly': ['P', 0.2, 'side'], 'Dumbbell Fly': ['P', 0.2, 'hand'], 'Decline Barbell Bench Press': ['P', 1.05],
  'Decline Dumbbell Press': ['P', 0.42, 'hand'], 'Smith Machine Bench Press': ['P', 0.95], 'Smith Machine Incline Press': ['P', 0.8],
  'Incline Machine Press': ['P', 0.85], 'Dumbbell Floor Press': ['P', 0.38, 'hand'], 'Incline Dumbbell Fly': ['P', 0.18, 'hand'],
  'Low-to-High Cable Fly': ['P', 0.15, 'side'], 'High-to-Low Cable Fly': ['P', 0.2, 'side'],
  // Back (pulling strength tracks pressing strength closely in most lifters)
  'Lat Pulldown': ['P', 0.95], 'Close-Grip Lat Pulldown': ['P', 0.95], 'Single-Arm Lat Pulldown': ['P', 0.45, 'side'],
  'Straight-Arm Pulldown': ['P', 0.4], 'Seated Cable Row': ['P', 0.95], 'Machine Row': ['P', 0.95],
  'Barbell Bent-Over Row': ['P', 0.85], 'Pendlay Row': ['P', 0.8], 'T-Bar Row': ['P', 0.75], 'Meadows Row': ['P', 0.35],
  'Single-Arm Dumbbell Row': ['P', 0.45, 'hand'], 'Chest-Supported Dumbbell Row': ['P', 0.32, 'hand'], 'Face Pull': ['P', 0.45],
  'Dumbbell Pullover': ['P', 0.35], 'Barbell Pullover': ['P', 0.35],
  'Assisted Pull-ups': null, // the weight is help, not load: no starting weight
  'Deadlift': ['H', 1], 'Rack Pull': ['H', 1.15], 'Barbell Shrug': ['H', 0.7], 'Dumbbell Shrug': ['H', 0.3, 'hand'],
  // Shoulders
  'Barbell Overhead Press': ['P', 0.63], 'Seated Dumbbell Shoulder Press': ['P', 0.27, 'hand'],
  'Standing Dumbbell Shoulder Press': ['P', 0.25, 'hand'], 'Arnold Press': ['P', 0.24, 'hand'], 'Machine Shoulder Press': ['P', 0.6],
  'Smith Machine Shoulder Press': ['P', 0.6], 'Push Press': ['P', 0.8], 'Dumbbell Lateral Raise': ['P', 0.15, 'hand'],
  'Cable Lateral Raise': ['P', 0.09, 'side'], 'Machine Lateral Raise': ['P', 0.35], 'Dumbbell Front Raise': ['P', 0.14, 'hand'],
  'Cable Front Raise': ['P', 0.15], 'Rear Delt Dumbbell Fly': ['P', 0.11, 'hand'], 'Reverse Pec Deck': ['P', 0.45],
  'Cable Rear Delt Fly': ['P', 0.08, 'side'], 'Cable Upright Row': ['P', 0.4], 'Dumbbell Y-Raise': ['P', 0.07, 'hand'],
  // Triceps
  'Triceps Pushdown': ['P', 0.55], 'Rope Pushdown': ['P', 0.45], 'Single-Arm Cable Pushdown': ['P', 0.22, 'side'],
  'Overhead Cable Extension': ['P', 0.45], 'Overhead Dumbbell Extension': ['P', 0.3], 'Skull Crushers': ['P', 0.42],
  'Incline Dumbbell Skull Crusher': ['P', 0.17, 'hand'], 'Dumbbell Skull Crusher': ['P', 0.17, 'hand'],
  'Seated EZ-Bar Overhead Extension': ['P', 0.4], 'Close-Grip Bench Press': ['P', 0.88], 'JM Press': ['P', 0.6],
  'Dumbbell Kickback': ['P', 0.09, 'hand'], 'Cable Kickback': ['P', 0.08, 'side'], 'Machine Dip': ['P', 1],
  // Biceps and forearms
  'Dumbbell Curl': ['C', 1, 'hand'], 'Barbell Curl': ['C', 1.8], 'EZ-Bar Curl': ['C', 1.7], 'Hammer Curl': ['C', 1.1, 'hand'],
  'Incline Dumbbell Curl': ['C', 0.85, 'hand'], 'Cable Curl': ['C', 1.5], 'EZ-Bar Preacher Curl': ['C', 1.45],
  'Dumbbell Preacher Curl': ['C', 0.75, 'hand'], 'Machine Preacher Curl': ['C', 1.4], 'Concentration Curl': ['C', 0.85, 'hand'],
  'Spider Curl': ['C', 0.75, 'hand'], 'Bayesian Cable Curl': ['C', 0.65, 'side'], 'Cross-Body Hammer Curl': ['C', 1.05, 'hand'],
  'Rope Hammer Curl': ['C', 1.6], 'Drag Curl': ['C', 1.4], 'Zottman Curl': ['C', 0.8, 'hand'],
  'Reverse Barbell Curl': ['C', 1.2], 'Reverse EZ-Bar Curl': ['C', 1.2], 'Dumbbell Wrist Curl': ['C', 0.6, 'hand'],
  'Reverse Wrist Curl': ['C', 0.35, 'hand'],
  // Legs
  'Barbell Back Squat': ['S', 1], 'Front Squat': ['S', 0.82], 'Hack Squat': ['S', 1], 'Smith Machine Squat': ['S', 0.95],
  'Pendulum Squat': ['S', 0.9], 'Leg Press': ['S', 2], 'Single-Leg Leg Press': ['S', 0.9], 'Goblet Squat': ['S', 0.35],
  'Heel-Elevated Goblet Squat': ['S', 0.33], 'Bulgarian Split Squat': ['S', 0.22, 'hand'], 'Reverse Lunge': ['S', 0.25, 'hand'],
  'Walking Lunge': ['S', 0.25, 'hand'], 'Step-ups': ['S', 0.2, 'hand'], 'Lateral Lunge': ['S', 0.18, 'hand'],
  'Curtsy Lunge': ['S', 0.18, 'hand'], 'Leg Extension': ['S', 0.55], 'Hip Adduction Machine': ['S', 0.6],
  'Hip Abduction Machine': ['S', 0.6],
  // Calves
  'Standing Calf Raise': ['S', 1], 'Seated Calf Raise': ['S', 0.6], 'Smith Machine Calf Raise': ['S', 0.9],
  'Leg Press Calf Raise': ['S', 1.6], 'Single-Leg Dumbbell Calf Raise': ['S', 0.2, 'hand'], 'Donkey Calf Raise': ['S', 1],
  // Hamstrings and glutes
  'Romanian Deadlift': ['H', 0.72], 'Dumbbell Romanian Deadlift': ['H', 0.3, 'hand'], 'Stiff-Leg Deadlift': ['H', 0.68],
  'Good Morning': ['H', 0.45], 'Trap Bar Deadlift': ['H', 1.05], 'Sumo Deadlift': ['H', 1], 'Lying Leg Curl': ['H', 0.35],
  'Seated Leg Curl': ['H', 0.38], 'Standing Single-Leg Leg Curl': ['H', 0.17], 'Hip Thrust': ['H', 1.1],
  'B-Stance Hip Thrust': ['H', 0.6], 'Machine Hip Thrust': ['H', 1], 'Cable Pull-Through': ['H', 0.35],
  'Cable Glute Kickback': ['H', 0.12, 'side'], 'Kettlebell Swing': ['H', 0.3],
  // Core and carries
  'Cable Crunch': ['P', 0.5], 'Machine Crunch': ['P', 0.5], 'Cable Woodchop': ['P', 0.25], 'Pallof Press': ['P', 0.2], 'Landmine Press': ['P', 0.4],
  "Farmer's Carry": ['BW', 0.3, 'hand'], 'Suitcase Carry': ['BW', 0.3]
};

// Typical size of each reference next to the bench press, and per kg of bodyweight (male / female)
const REF_VS_PRESS = { P: 1, C: 0.26, S: 1.25, H: 1.5 };
const REF_PER_KG = { male: { P: 0.8, C: 0.21, S: 1, H: 1.2 }, female: { P: 0.45, C: 0.12, S: 0.75, H: 0.95 } };
// What the Profile asks for: a set you can do now (about 2 reps left), as the exercise it names
const BENCHMARKS = [
  { key: 'press', ref: 'P', label: 'Bench / chest press', short: 'chest press', example: 'e.g. 50', ratio: 1 },
  { key: 'curl', ref: 'C', label: 'DB curl (each)', short: 'curls', example: 'e.g. 12.5', ratio: 1 },
  { key: 'legs', ref: 'S', label: 'Leg press', short: 'leg press', example: 'e.g. 100', ratio: 2 },
  { key: 'hinge', ref: 'H', label: 'Romanian DL', short: 'Romanian deadlift', example: 'e.g. 60', ratio: 0.72 }
];
// Effort (reps in reserve): easy 4+, moderate 2, hard 1, all out 0; unknown counts as hard
const RIR_BY_EFFORT = { 6: 4, 8: 2, 9: 1, 10: 0 };

// "Incline DB Curls (45°)" → "Incline Dumbbell Curl": the library exercise whose words it contains (the most specific)
function strengthWords(name) {
  return String(name).toLowerCase().replace(/[‘’]/g, "'").replace(/\(.*?\)/g, ' ').replace(/skullcrushers?/g, 'skull crusher').replace(/[^a-z0-9'\- ]/g, ' ')
    .split(/\s+/).filter(w => w && !/\d/.test(w)).map(w => {
      if (/^dbs?$/.test(w)) return 'dumbbell';
      if (w === 'bb') return 'barbell';
      if (/^flye?s$/.test(w)) return 'fly';
      if (w === 'ext') return 'extension';
      if (w === 'carries') return 'carry';
      if (w === 'presses') return 'press';
      if (w === 'bicep' || w === 'biceps') return '';
      return /(curl|raise|row|crusher|extension|dip|squat|lunge|deadlift|pullover|pulldown|shrug|thrust|kickback)s$/.test(w) ? w.slice(0, -1) : w;
    }).filter(Boolean);
}

const strengthNameCache = new Map();
function strengthName(name) {
  if (STRENGTH[name] !== undefined || LIBRARY.has(name)) return name;
  if (strengthNameCache.has(name)) return strengthNameCache.get(name);
  const words = new Set(strengthWords(name));
  const weight = w => (['barbell', 'dumbbell', 'machine', 'cable'].includes(w) ? 0.5 : 1);
  let best = null;
  let bestScore = 0;
  LIBRARY.forEach((e, libName) => {
    const lib = strengthWords(libName);
    if (!lib.length || !lib.every(w => words.has(w))) return;
    const score = lib.reduce((n, w) => n + weight(w), 0);
    if (score > bestScore) { best = libName; bestScore = score; }
  });
  strengthNameCache.set(name, best);
  return best;
}

function strengthOf(name) {
  const key = strengthName(name);
  const row = key ? STRENGTH[key] : null;
  return row ? { name: key, ref: row[0], ratio: row[1], per: row[2] || null } : null;
}

// Best estimated one-rep max from a session's sets, counting the reps that were left (sets of 1–15 reps)
function strengthE1rm(sets, effort) {
  const rir = RIR_BY_EFFORT[effort] ?? (effort > 0 ? Math.max(0, 10 - effort) : 1);
  return (sets || []).reduce((best, s) => {
    const w = Number(s.weight);
    const r = Number(s.reps);
    return w > 0 && r >= 1 && r <= 15 ? Math.max(best, w * (1 + (r + rir) / 30)) : best;
  }, 0);
}

let strengthCache = null;
// What the estimates depend on (history, profile, bodyweight), so they're worked out again only when it changes
function strengthSig() {
  const raw = localStorage.getItem(HISTORY_KEY) || '';
  return `${raw.length}|${raw.slice(0, 160)}|${raw.slice(-160)}|${localStorage.getItem(PROFILE_KEY) || ''}|${localStorage.getItem(BODYWEIGHT_KEY) || ''}`;
}

// The four references, each { v: 1RM, from: why }, and the history they came from
function strengthRefs() {
  const sig = strengthSig();
  if (strengthCache && strengthCache.sig === sig) return strengthCache.refs;
  const history = getHistory();
  const refs = {};
  // 1. Your log: the latest session of each exercise (last 6 months), as each reference; the middle value wins
  const found = { P: [], C: [], S: [], H: [] };
  const seen = new Set();
  const now = Date.now();
  history.forEach(s => {
    if (now - s.id > 183 * DAY_MS) return;
    (s.exercises || []).forEach(e => {
      if (seen.has(e.name)) return;
      const st = strengthOf(e.name);
      if (!st || !found[st.ref]) return;
      const e1 = strengthE1rm(e.sets, e.effort);
      if (!e1) return;
      seen.add(e.name);
      found[st.ref].push({ v: e1 / st.ratio, from: `your ${e.name}` });
    });
  });
  Object.entries(found).forEach(([ref, list]) => {
    if (!list.length) return;
    list.sort((a, b) => a.v - b.v);
    refs[ref] = list[Math.floor((list.length - 1) / 2)];
  });
  // 2. The strength entered in Profile
  const profile = getProfile() || {};
  const bench = profile.strength || {};
  BENCHMARKS.forEach(b => {
    const x = bench[b.key];
    if (refs[b.ref] || !x || !(x.w > 0) || !(x.r > 0)) return;
    refs[b.ref] = { v: strengthE1rm([{ weight: x.w, reps: x.r }], 8) / b.ratio, from: `your ${b.short}` };
  });
  // 3. Missing ones from the ones known (a typical balance between them)
  const known = Object.keys(refs);
  if (known.length) {
    const asPress = known.reduce((n, k) => n + refs[k].v / REF_VS_PRESS[k], 0) / known.length;
    const from = refs[known[0]].from;
    Object.keys(REF_VS_PRESS).forEach(k => { if (!refs[k]) refs[k] = { v: asPress * REF_VS_PRESS[k], from, derived: true }; });
  } else {
    // 4. Bodyweight, sex and age (a careful start for a beginner)
    const bw = currentWeightKg(profile);
    if (bw) {
      const per = REF_PER_KG[profile.sex] || { P: 0.62, C: 0.16, S: 0.87, H: 1.07 };
      const age = profileAge(profile);
      const ageFactor = age >= 65 ? 0.7 : age >= 50 ? 0.85 : 1;
      Object.keys(per).forEach(k => { refs[k] = { v: bw * per[k] * ageFactor, from: 'your bodyweight', derived: true }; });
    }
  }
  const bw = currentWeightKg(profile);
  if (bw) refs.BW = { v: bw, from: 'your bodyweight' };
  strengthCache = { sig, refs, history };
  return refs;
}

// Round to what a gym has: dumbbells in 1 kg steps under 10 kg, else 2.5 kg; a barbell is at least the bar
function roundLoad(w, name, equipment) {
  if (!(w > 0)) return 0;
  if (equipment === 'Dumbbell' && w < 10) return Math.max(1, Math.round(w));
  const r = Math.round(w / 2.5) * 2.5;
  if (equipment === 'Barbell') return Math.max(/\bEZ\b|skull|curl|pullover|extension|JM/i.test(name) ? 10 : 20, r);
  return Math.max(2.5, r);
}

/* { w, r, perHand, why, own } for the bottom of the exercise's rep range, or null (bodyweight exercises, no data) */
function recommendSet(ex) {
  if (!ex || !ex.name) return null;
  const st = strengthOf(ex.name);
  if (!st) return null;
  const lib = LIBRARY.get(st.name);
  const equipment = lib ? lib.equipment : 'Machine';
  const range = repRange(ex) || (lib ? repRange({ repTarget: lib.reps }) : null);
  const reps = range ? range[0] : 8;
  const refs = strengthRefs();
  if (st.ref === 'BW') {
    if (!refs.BW) return null;
    const w = roundLoad(refs.BW.v * st.ratio * 0.9, st.name, equipment);
    return w ? { w, r: reps, perHand: st.per === 'hand', per: st.per, why: 'from your bodyweight', own: false } : null;
  }
  // Your own last session of it (a set number you didn't do last time), else the reference
  const last = getLastPerformance(ex.name, strengthCache.history);
  const ownE1 = last ? strengthE1rm(last.sets, last.effort) : 0;
  const ref = refs[st.ref];
  if (!ownE1 && !ref) return null;
  const e1 = ownE1 || ref.v * st.ratio;
  // ~2 reps in reserve at the bottom of the range; 10 % lighter on a first try from an estimate
  const w = roundLoad(e1 / (1 + (reps + 2) / 30) * (ownE1 ? 1 : 0.9), st.name, equipment);
  if (!w) return null;
  return { w, r: reps, perHand: st.per === 'hand', per: st.per, why: ownE1 ? 'from your last session' : `${ref.derived ? 'est. ' : ''}from ${ref.from}`, own: !!ownE1 };
}

function recLabel(rec) {
  return `${fmtNum(rec.w)} kg${rec.per === 'hand' ? ' each' : rec.per === 'side' ? ' a side' : ''} × ${rec.r}`;
}
