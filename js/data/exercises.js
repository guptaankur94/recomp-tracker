/* Exercise library: muscles, equipment, warm-ups, swaps, reps, rest and cues. */

/* Exercise library: [name, muscle, equipment, warm-up sets, alternative, reps, rest (s), cue].
   Templates, the plan editor and Add Exercise build on it. Loads are effort-based: the first session
   asks for a weight and suggestions take over from there. */
const LIBRARY_ROWS = [
  ['Barbell Bench Press', 'Chest', 'Barbell', 2, 'Dumbbell Bench Press', '6–10', 150, 'Shoulder blades pinched, bar to the lower chest'],
  ['Dumbbell Bench Press', 'Chest', 'Dumbbell', 2, 'Push-ups', '8–12', 120, 'Full stretch at the bottom, press in a slight arc'],
  ['Incline Barbell Bench Press', 'Chest', 'Barbell', 2, 'Incline Dumbbell Press', '6–10', 150, 'Bench at 30°, bar to the upper chest'],
  ['Incline Dumbbell Press', 'Chest', 'Dumbbell', 1, 'Incline Barbell Bench Press', '8–12', 120, 'Bench at 30°, elbows about 45° from the body'],
  ['Machine Chest Press', 'Chest', 'Machine', 1, 'Dumbbell Bench Press', '8–12', 120, 'Handles at mid-chest, control the return'],
  ['Pec Deck Machine Flyes', 'Chest', 'Machine', 0, 'Cable Fly', '10–15', 90, 'Soft elbows, squeeze for a second'],
  ['Cable Fly', 'Chest', 'Cable', 0, 'Pec Deck Machine Flyes', '10–15', 90, 'Slight forward lean, hug a big tree'],
  ['Dumbbell Fly', 'Chest', 'Dumbbell', 0, 'Cable Fly', '10–15', 90, 'Deep stretch, stop before the shoulders strain'],
  ['Push-ups', 'Chest', 'Bodyweight', 0, 'Knee Push-ups', '8–15', 90, 'Body straight, chest to the floor'],
  ['Knee Push-ups', 'Chest', 'Bodyweight', 0, 'Push-ups', '10–20', 60, 'Hips in line with the shoulders'],
  ['Decline Push-ups', 'Chest', 'Bodyweight', 0, 'Push-ups', '8–15', 90, 'Feet on a chair, slow on the way down'],
  ['Dips', 'Chest', 'Bar', 1, 'Bench Dips', '6–12', 120, 'Slight forward lean, stop at 90° at the elbow'],

  ['Lat Pulldown', 'Back', 'Machine', 2, 'Assisted Pull-ups', '8–12', 120, 'Pull elbows down to the ribs, chest up'],
  ['Pull-ups', 'Back', 'Bar', 1, 'Lat Pulldown', '5–10', 150, 'Full hang at the bottom, chin over the bar'],
  ['Chin-ups', 'Back', 'Bar', 1, 'Assisted Pull-ups', '5–10', 150, 'Palms facing you, chest to the bar'],
  ['Assisted Pull-ups', 'Back', 'Machine', 1, 'Lat Pulldown', '6–10', 120, 'Use the least assistance you can control'],
  ['Seated Cable Row', 'Back', 'Cable', 1, 'Chest-Supported Dumbbell Row', '8–12', 120, 'Tall chest, pull to the belly button'],
  ['Barbell Bent-Over Row', 'Back', 'Barbell', 1, 'Single-Arm Dumbbell Row', '6–10', 150, 'Hinge to 45°, bar to the lower ribs'],
  ['Single-Arm Dumbbell Row', 'Back', 'Dumbbell', 0, 'Seated Cable Row', '8–12 / arm', 90, 'Pull to the hip, pause at the top'],
  ['Chest-Supported Dumbbell Row', 'Back', 'Dumbbell', 0, 'Seated Cable Row', '10–12', 90, 'Chest on an incline bench, squeeze the shoulder blades'],
  ['Inverted Row', 'Back', 'Bodyweight', 0, 'Towel Door Row', '6–12', 90, 'Under a sturdy table or bar, body straight'],
  ['Towel Door Row', 'Back', 'Bodyweight', 0, 'Inverted Row', '10–15', 60, 'Towel around a door handle, lean back and row'],
  ['Face Pull', 'Back', 'Cable', 0, 'Rear Delt Dumbbell Fly', '12–15', 60, 'Rope to the forehead, elbows high'],
  ['Rear Delt Dumbbell Fly', 'Shoulders', 'Dumbbell', 0, 'Face Pull', '12–15', 60, 'Hinged over, lead with the elbows'],

  ['Barbell Overhead Press', 'Shoulders', 'Barbell', 2, 'Seated Dumbbell Shoulder Press', '6–10', 150, 'Squeeze glutes, head through at the top'],
  ['Seated Dumbbell Shoulder Press', 'Shoulders', 'Dumbbell', 2, 'Machine Shoulder Press', '8–12', 120, 'Lower to ear level, press straight up'],
  ['Machine Shoulder Press', 'Shoulders', 'Machine', 1, 'Seated Dumbbell Shoulder Press', '8–12', 120, 'Handles at shoulder height, no back arch'],
  ['Dumbbell Lateral Raise', 'Shoulders', 'Dumbbell', 0, 'Cable Lateral Raise', '12–15', 60, 'Lead with the elbows, stop at shoulder height'],
  ['Cable Lateral Raise', 'Shoulders', 'Cable', 0, 'Dumbbell Lateral Raise', '12–15', 60, 'Cable behind you, slow on the way down'],
  ['Pike Push-ups', 'Shoulders', 'Bodyweight', 0, 'Push-ups', '6–12', 90, 'Hips high, head to the floor between the hands'],

  ['Barbell Back Squat', 'Legs', 'Barbell', 3, 'Leg Press', '5–8', 180, 'Brace, sit between the hips, knees track the toes'],
  ['Goblet Squat', 'Legs', 'Dumbbell', 1, 'Bodyweight Squat', '8–12', 120, 'Dumbbell at the chest, elbows inside the knees'],
  ['Leg Press', 'Legs', 'Machine', 2, 'Goblet Squat', '10–12', 150, 'Lower until the hips start to lift, then drive'],
  ['Bodyweight Squat', 'Legs', 'Bodyweight', 0, 'Goblet Squat', '15–25', 60, 'Slow down, pause at the bottom'],
  ['Bodyweight Lunge', 'Legs', 'Bodyweight', 0, 'Bodyweight Squat', '10–15 / leg', 60, 'Step back, back knee just above the floor'],
  ['Bulgarian Split Squat', 'Legs', 'Dumbbell', 1, 'Reverse Lunge', '8–12 / leg', 90, 'Back foot on a bench, front shin near vertical'],
  ['Reverse Lunge', 'Legs', 'Dumbbell', 0, 'Bulgarian Split Squat', '8–12 / leg', 90, 'Step back, back knee just above the floor'],
  ['Walking Lunge', 'Legs', 'Dumbbell', 0, 'Reverse Lunge', '10–12 / leg', 90, 'Long steps, torso upright'],
  ['Step-ups', 'Legs', 'Dumbbell', 0, 'Reverse Lunge', '10–12 / leg', 90, 'Drive through the heel of the top foot'],
  ['Leg Extension', 'Legs', 'Machine', 1, 'Goblet Squat', '12–15', 90, 'Pause at the top, slow down'],
  ['Romanian Deadlift', 'Hamstrings', 'Barbell', 2, 'Dumbbell Romanian Deadlift', '8–10', 150, 'Soft knees, push the hips back, bar close'],
  ['Dumbbell Romanian Deadlift', 'Hamstrings', 'Dumbbell', 1, 'Romanian Deadlift', '10–12', 120, 'Hips back until you feel the hamstrings stretch'],
  ['Single-Leg Romanian Deadlift', 'Hamstrings', 'Bodyweight', 0, 'Dumbbell Romanian Deadlift', '10–12 / leg', 60, 'Hips square, reach long with the back leg'],
  ['Trap Bar Deadlift', 'Hamstrings', 'Barbell', 3, 'Romanian Deadlift', '5–8', 180, 'Push the floor away, stand tall'],
  ['Lying Leg Curl', 'Hamstrings', 'Machine', 1, 'Seated Leg Curl', '10–12', 90, 'Hips down, slow on the way back'],
  ['Seated Leg Curl', 'Hamstrings', 'Machine', 1, 'Lying Leg Curl', '10–12', 90, 'Lean forward slightly for a bigger stretch'],
  ['Hip Thrust', 'Glutes', 'Barbell', 2, 'Glute Bridge', '8–12', 120, 'Chin tucked, pause with the hips locked out'],
  ['Glute Bridge', 'Glutes', 'Bodyweight', 0, 'Hip Thrust', '12–20', 60, 'Drive through the heels, squeeze at the top'],
  ['Single-Leg Glute Bridge', 'Glutes', 'Bodyweight', 0, 'Glute Bridge', '10–15 / leg', 60, 'Hips level, pause at the top'],
  ['Standing Calf Raise', 'Calves', 'Machine', 1, 'Single-Leg Calf Raise', '10–15', 60, 'Pause in the stretch and at the top'],
  ['Single-Leg Calf Raise', 'Calves', 'Bodyweight', 1, 'Standing Calf Raise', '12–20 / leg', 60, 'On a step, full range, hold for balance'],
  ['Calf Raise on a Step', 'Calves', 'Bodyweight', 0, 'Single-Leg Calf Raise', '15–25', 60, 'Both feet on a step: full stretch at the bottom, 2s squeeze at the top'],

  ['Barbell Curl', 'Biceps', 'Barbell', 1, 'Dumbbell Curl', '8–12', 90, 'Elbows still, no swinging'],
  ['Dumbbell Curl', 'Biceps', 'Dumbbell', 1, 'Cable Curl', '10–12', 60, 'Turn the palm up as you curl'],
  ['Hammer Curl', 'Biceps', 'Dumbbell', 0, 'Dumbbell Curl', '10–12', 60, 'Neutral grip, elbows by your sides'],
  ['Incline Dumbbell Curl', 'Biceps', 'Dumbbell', 0, 'Dumbbell Curl', '10–12', 60, 'Arms hang straight, full stretch'],
  ['Cable Curl', 'Biceps', 'Cable', 0, 'Dumbbell Curl', '10–15', 60, 'Constant tension, squeeze at the top'],
  ['Triceps Pushdown', 'Triceps', 'Cable', 1, 'Overhead Dumbbell Extension', '10–15', 60, 'Elbows pinned, lock out fully'],
  ['Overhead Dumbbell Extension', 'Triceps', 'Dumbbell', 1, 'Triceps Pushdown', '10–12', 60, 'Elbows in, deep stretch behind the head'],
  ['Skull Crushers', 'Triceps', 'Barbell', 1, 'Overhead Dumbbell Extension', '8–12', 90, 'Lower to just behind the head'],
  ['Close-Grip Bench Press', 'Triceps', 'Barbell', 1, 'Dips', '6–10', 120, 'Hands shoulder-width, elbows tucked'],
  ['Bench Dips', 'Triceps', 'Bodyweight', 1, 'Diamond Push-ups', '10–15', 60, 'Shoulders down, stop at 90°'],
  ['Diamond Push-ups', 'Triceps', 'Bodyweight', 0, 'Bench Dips', '6–15', 60, 'Hands close, elbows brush the ribs'],

  ['Plank', 'Core', 'Bodyweight', 0, 'Dead Bug', '30–60s hold', 60, 'Squeeze glutes, ribs down'],
  ['Dead Bug', 'Core', 'Bodyweight', 0, 'Plank', '8–12 / side', 60, 'Lower back pressed into the floor'],
  ['Hanging Knee Raise', 'Core', 'Bar', 0, 'Reverse Crunch', '10–15', 60, 'Curl the pelvis up, no swinging'],
  ['Reverse Crunch', 'Core', 'Bodyweight', 0, 'Hanging Knee Raise', '12–15', 60, 'Roll the hips off the floor slowly'],
  ['Cable Crunch', 'Core', 'Cable', 0, 'Reverse Crunch', '12–15', 60, 'Crunch the ribs to the hips, hips still'],
  ['Pallof Press', 'Core', 'Cable', 0, 'Dead Bug', '10–12 / side', 60, 'Resist the twist, press straight out'],
  ["Farmer's Carry", 'Core', 'Dumbbell', 0, 'Plank', '30–45s walk', 90, 'Tall posture, short quick steps']
];

const LIBRARY = new Map(LIBRARY_ROWS.map(([name, muscle, equipment, warmup, alt, reps, rest, cue]) =>
  [name, { name, muscle, equipment, warmup, alt, reps, rest, cue }]));

const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Legs', 'Hamstrings', 'Glutes', 'Calves', 'Biceps', 'Triceps', 'Core'];

function libraryTarget(entry) {
  return entry.equipment === 'Bodyweight' || entry.equipment === 'Bar' ? 'Bodyweight' : '2 reps in reserve';
}

function repLabel(reps) {
  return /reps|hold|walk|s\b/.test(reps) ? reps : `${reps} reps`;
}

// Equipment each template's alternatives may use
const EQUIPMENT_ALLOWED = { gym: null, dumbbells: ['Dumbbell', 'Bodyweight'], bodyweight: ['Bodyweight'] };

// An alternative the user can actually do: the named one, else the first same-muscle exercise with allowed equipment
function pickAlternative(e, wanted, allowed) {
  const a = LIBRARY.get(wanted);
  if (!allowed || (a && allowed.includes(a.equipment))) return a;
  return [...LIBRARY.values()].find(x => x.muscle === e.muscle && x.name !== e.name && allowed.includes(x.equipment)) || null;
}

// A plan exercise from the library, alternative included; `o` overrides sets, reps, rest, warm-up or alt.
function libExercise(name, o = {}, allowed = null) {
  const e = LIBRARY.get(name);
  if (!e) throw new Error(`Unknown exercise: ${name}`);
  const ex = { name, warmup: o.warmup ?? e.warmup, sets: o.sets ?? 3, repTarget: repLabel(o.reps || e.reps), weightTarget: libraryTarget(e), rest: o.rest ?? e.rest, cue: e.cue };
  const a = pickAlternative(e, o.alt || e.alt, allowed);
  if (a) ex.alt = { name: a.name, warmup: Math.min(a.warmup, ex.warmup), sets: ex.sets, repTarget: repLabel(a.reps), weightTarget: libraryTarget(a), rest: a.rest, cue: a.cue };
  return ex;
}
