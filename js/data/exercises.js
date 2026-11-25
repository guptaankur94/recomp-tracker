/* Exercise library: muscles, equipment, warm-ups, swaps, reps, rest and cues. */

/* Exercise library: [name, muscle, equipment, warm-up sets, alternative, reps, rest (s), cue].
   Templates, the plan editor and Add Exercise build on it. The first time, a starting weight is worked out
   from your other lifts (js/strength.js); after that, suggestions take over from your log. */
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

/* More of the library: the common gym exercises for every muscle, in the same format */
const LIBRARY_MORE = [
  ['Decline Barbell Bench Press', 'Chest', 'Barbell', 1, 'Dips', '6–10', 150, 'Slight decline, bar to the lower chest'],
  ['Decline Dumbbell Press', 'Chest', 'Dumbbell', 1, 'Decline Barbell Bench Press', '8–12', 120, 'Slight decline, press up and in'],
  ['Smith Machine Bench Press', 'Chest', 'Machine', 2, 'Barbell Bench Press', '6–10', 150, 'Bar path to the lower chest, shoulder blades back'],
  ['Smith Machine Incline Press', 'Chest', 'Machine', 1, 'Incline Dumbbell Press', '8–12', 120, 'Bench at 30°, bar to the upper chest'],
  ['Incline Machine Press', 'Chest', 'Machine', 1, 'Incline Dumbbell Press', '8–12', 120, 'Seat so the handles start at the upper chest'],
  ['Dumbbell Floor Press', 'Chest', 'Dumbbell', 1, 'Dumbbell Bench Press', '8–12', 90, 'Pause the elbows on the floor, press up'],
  ['Incline Dumbbell Fly', 'Chest', 'Dumbbell', 0, 'Low-to-High Cable Fly', '10–15', 90, 'Bench at 30°, wide arc, stretch the upper chest'],
  ['Low-to-High Cable Fly', 'Chest', 'Cable', 0, 'Incline Dumbbell Fly', '12–15', 60, 'Handles low, scoop up to chin height'],
  ['High-to-Low Cable Fly', 'Chest', 'Cable', 0, 'Cable Fly', '12–15', 60, 'Handles high, sweep down to the hips'],
  ['Incline Push-ups', 'Chest', 'Bodyweight', 0, 'Knee Push-ups', '10–20', 60, 'Hands on a bench, body straight'],
  ['Archer Push-ups', 'Chest', 'Bodyweight', 0, 'Push-ups', '5–10 / side', 90, 'Wide hands, shift over one arm, other arm straight'],
  ['Weighted Dips', 'Chest', 'Bar', 1, 'Dips', '6–10', 150, 'Belt or dumbbell between the feet, lean forward'],

  ['Deadlift', 'Back', 'Barbell', 3, 'Trap Bar Deadlift', '3–6', 180, 'Bar over mid-foot, brace, push the floor away'],
  ['Rack Pull', 'Back', 'Barbell', 2, 'Deadlift', '5–8', 180, 'Bar just below the knees, lock out tall'],
  ['Pendlay Row', 'Back', 'Barbell', 1, 'Barbell Bent-Over Row', '5–8', 150, 'Back flat to the floor, row from a dead stop'],
  ['T-Bar Row', 'Back', 'Barbell', 1, 'Seated Cable Row', '8–10', 120, 'Chest up, pull the handle to the stomach'],
  ['Machine Row', 'Back', 'Machine', 1, 'Seated Cable Row', '8–12', 120, 'Chest on the pad, elbows past the ribs'],
  ['Meadows Row', 'Back', 'Barbell', 0, 'Single-Arm Dumbbell Row', '8–12 / arm', 90, 'Staggered stance, elbow high, big stretch'],
  ['Close-Grip Lat Pulldown', 'Back', 'Machine', 1, 'Lat Pulldown', '8–12', 120, 'V-handle, pull to the upper chest, lean back slightly'],
  ['Single-Arm Lat Pulldown', 'Back', 'Cable', 0, 'Lat Pulldown', '10–12 / arm', 60, 'Drive the elbow to the hip'],
  ['Straight-Arm Pulldown', 'Back', 'Cable', 0, 'Dumbbell Pullover', '12–15', 60, 'Arms long, sweep the bar to the thighs'],
  ['Neutral-Grip Pull-ups', 'Back', 'Bar', 1, 'Close-Grip Lat Pulldown', '5–10', 150, 'Palms facing, chest to the handles'],
  ['Weighted Pull-ups', 'Back', 'Bar', 1, 'Pull-ups', '4–8', 180, 'Belt or dumbbell between the feet, full hang'],
  ['Dumbbell Pullover', 'Back', 'Dumbbell', 0, 'Straight-Arm Pulldown', '10–12', 90, 'One dumbbell, soft elbows, deep stretch overhead'],
  ['Barbell Pullover', 'Back', 'Barbell', 0, 'Dumbbell Pullover', '10–12', 90, 'Light bar, arms nearly straight, ribs down'],
  ['Barbell Shrug', 'Back', 'Barbell', 1, 'Dumbbell Shrug', '10–15', 90, 'Straight up to the ears, pause, no rolling'],
  ['Dumbbell Shrug', 'Back', 'Dumbbell', 0, 'Barbell Shrug', '12–15', 60, 'Arms long, shoulders to the ears'],
  ['Back Extension', 'Back', 'Bodyweight', 0, 'Superman', '10–15', 60, 'Hinge at the hips, stop at a straight line'],
  ['Superman', 'Back', 'Bodyweight', 0, 'Back Extension', '10–15', 60, 'Lift arms and legs together, hold 2s'],

  ['Standing Dumbbell Shoulder Press', 'Shoulders', 'Dumbbell', 1, 'Seated Dumbbell Shoulder Press', '8–12', 120, 'Brace, ribs down, press straight up'],
  ['Arnold Press', 'Shoulders', 'Dumbbell', 1, 'Seated Dumbbell Shoulder Press', '8–12', 90, 'Palms in at the bottom, turn out as you press'],
  ['Smith Machine Shoulder Press', 'Shoulders', 'Machine', 1, 'Machine Shoulder Press', '8–12', 120, 'Bar to the chin, press straight up'],
  ['Push Press', 'Shoulders', 'Barbell', 2, 'Barbell Overhead Press', '5–8', 150, 'Small knee dip, drive with the legs, press'],
  ['Landmine Press', 'Shoulders', 'Barbell', 1, 'Seated Dumbbell Shoulder Press', '8–12 / arm', 90, 'Bar end at the shoulder, press up and forward'],
  ['Machine Lateral Raise', 'Shoulders', 'Machine', 0, 'Dumbbell Lateral Raise', '12–15', 60, 'Pads on the outer arms, lift to shoulder height'],
  ['Dumbbell Front Raise', 'Shoulders', 'Dumbbell', 0, 'Cable Front Raise', '10–12', 60, 'To eye level, no swing'],
  ['Cable Front Raise', 'Shoulders', 'Cable', 0, 'Dumbbell Front Raise', '12–15', 60, 'Cable between the legs, lift to eye level'],
  ['Reverse Pec Deck', 'Shoulders', 'Machine', 0, 'Rear Delt Dumbbell Fly', '12–15', 60, 'Arms long, sweep back, pause'],
  ['Cable Rear Delt Fly', 'Shoulders', 'Cable', 0, 'Reverse Pec Deck', '12–15', 60, 'Cables crossed, pull wide at shoulder height'],
  ['Cable Upright Row', 'Shoulders', 'Cable', 0, 'Dumbbell Lateral Raise', '10–15', 60, 'Wide grip, elbows lead, stop at chest height'],
  ['Dumbbell Y-Raise', 'Shoulders', 'Dumbbell', 0, 'Dumbbell Lateral Raise', '12–15', 60, 'Chest on an incline bench, raise in a Y'],
  ['Handstand Push-ups', 'Shoulders', 'Bodyweight', 1, 'Pike Push-ups', '3–8', 120, 'Against a wall, head to a cushion, press up'],

  ['Front Squat', 'Legs', 'Barbell', 3, 'Goblet Squat', '5–8', 180, 'Elbows high, torso upright, sit straight down'],
  ['Hack Squat', 'Legs', 'Machine', 2, 'Leg Press', '8–12', 150, 'Feet mid-plate, deep, knees over the toes'],
  ['Smith Machine Squat', 'Legs', 'Machine', 2, 'Barbell Back Squat', '8–10', 150, 'Feet slightly forward, sit down between the hips'],
  ['Pendulum Squat', 'Legs', 'Machine', 2, 'Hack Squat', '8–12', 150, 'Deep and controlled, drive through mid-foot'],
  ['Single-Leg Leg Press', 'Legs', 'Machine', 1, 'Bulgarian Split Squat', '10–12 / leg', 90, 'One foot mid-plate, hips down on the seat'],
  ['Heel-Elevated Goblet Squat', 'Legs', 'Dumbbell', 1, 'Goblet Squat', '10–15', 90, 'Heels on a plate, knees far forward, upright'],
  ['Lateral Lunge', 'Legs', 'Dumbbell', 0, 'Reverse Lunge', '8–12 / leg', 60, 'Sit back into one hip, other leg straight'],
  ['Sissy Squat', 'Legs', 'Bodyweight', 0, 'Leg Extension', '8–15', 60, 'Hold on, knees forward, lean back'],
  ['Pistol Squat', 'Legs', 'Bodyweight', 0, 'Bulgarian Split Squat', '3–8 / leg', 90, 'Hold a post at first, sit down on one leg'],
  ['Jump Squat', 'Legs', 'Bodyweight', 0, 'Bodyweight Squat', '8–12', 60, 'Quarter squat, jump, land soft'],
  ['Wall Sit', 'Legs', 'Bodyweight', 0, 'Bodyweight Squat', '30–60s hold', 60, 'Thighs level, back flat on the wall'],
  ['Hip Adduction Machine', 'Legs', 'Machine', 0, 'Lateral Lunge', '12–15', 60, 'Squeeze in, slow on the way out'],

  ['Stiff-Leg Deadlift', 'Hamstrings', 'Barbell', 2, 'Romanian Deadlift', '8–10', 150, 'Legs nearly straight, hinge to the stretch'],
  ['Good Morning', 'Hamstrings', 'Barbell', 1, 'Romanian Deadlift', '8–12', 120, 'Bar on the back, soft knees, hips back'],
  ['Standing Single-Leg Leg Curl', 'Hamstrings', 'Machine', 0, 'Lying Leg Curl', '10–12 / leg', 60, 'Hips still, squeeze the heel up'],
  ['Nordic Hamstring Curl', 'Hamstrings', 'Bodyweight', 0, 'Lying Leg Curl', '3–8', 120, 'Feet anchored, lower as slowly as you can'],
  ['Glute-Ham Raise', 'Hamstrings', 'Bodyweight', 0, 'Nordic Hamstring Curl', '6–10', 90, 'Knees on the pad, curl the body up'],
  ['Stability Ball Leg Curl', 'Hamstrings', 'Bodyweight', 0, 'Lying Leg Curl', '10–15', 60, 'Hips up, roll the ball to the glutes'],
  ['Kettlebell Swing', 'Hamstrings', 'Dumbbell', 0, 'Cable Pull-Through', '12–20', 90, 'Snap the hips, arms are just ropes'],

  ['Sumo Deadlift', 'Glutes', 'Barbell', 3, 'Trap Bar Deadlift', '3–6', 180, 'Wide stance, knees out, chest up'],
  ['Machine Hip Thrust', 'Glutes', 'Machine', 1, 'Hip Thrust', '8–12', 120, 'Chin tucked, lock the hips out, pause'],
  ['B-Stance Hip Thrust', 'Glutes', 'Barbell', 1, 'Single-Leg Glute Bridge', '8–12 / leg', 90, 'Most weight on the front leg'],
  ['Cable Pull-Through', 'Glutes', 'Cable', 0, 'Kettlebell Swing', '12–15', 60, 'Rope between the legs, hips back, stand tall'],
  ['Cable Glute Kickback', 'Glutes', 'Cable', 0, 'Single-Leg Glute Bridge', '12–15 / leg', 60, 'Kick back and up, no low-back arch'],
  ['Hip Abduction Machine', 'Glutes', 'Machine', 0, 'Lateral Lunge', '12–20', 60, 'Lean forward slightly, push out, pause'],
  ['Curtsy Lunge', 'Glutes', 'Dumbbell', 0, 'Reverse Lunge', '10–12 / leg', 60, 'Step back and across, hips square'],
  ['Frog Pump', 'Glutes', 'Bodyweight', 0, 'Glute Bridge', '20–30', 60, 'Soles together, drive the hips up'],

  ['Seated Calf Raise', 'Calves', 'Machine', 1, 'Standing Calf Raise', '12–20', 60, 'Pause in the stretch, slow up and down'],
  ['Smith Machine Calf Raise', 'Calves', 'Machine', 1, 'Standing Calf Raise', '10–15', 60, 'Balls of the feet on a plate, full range'],
  ['Leg Press Calf Raise', 'Calves', 'Machine', 1, 'Standing Calf Raise', '12–15', 60, 'Toes on the bottom edge, knees soft'],
  ['Single-Leg Dumbbell Calf Raise', 'Calves', 'Dumbbell', 0, 'Single-Leg Calf Raise', '10–15 / leg', 60, 'Dumbbell in one hand, on a step, full range'],
  ['Donkey Calf Raise', 'Calves', 'Machine', 0, 'Standing Calf Raise', '12–15', 60, 'Hinged forward, big stretch at the bottom'],
  ['Tibialis Raise', 'Calves', 'Bodyweight', 0, 'Calf Raise on a Step', '15–25', 60, 'Back on a wall, lift the toes high'],

  ['EZ-Bar Curl', 'Biceps', 'Barbell', 1, 'Barbell Curl', '8–12', 90, 'Grip the angled part, elbows still'],
  ['EZ-Bar Preacher Curl', 'Biceps', 'Barbell', 1, 'Machine Preacher Curl', '8–12', 90, 'Armpits on the pad, full stretch, no bounce'],
  ['Dumbbell Preacher Curl', 'Biceps', 'Dumbbell', 0, 'EZ-Bar Preacher Curl', '10–12 / arm', 60, 'One arm, slow at the bottom'],
  ['Machine Preacher Curl', 'Biceps', 'Machine', 0, 'EZ-Bar Preacher Curl', '10–15', 60, 'Elbows on the pad, squeeze at the top'],
  ['Concentration Curl', 'Biceps', 'Dumbbell', 0, 'Dumbbell Preacher Curl', '10–12 / arm', 60, 'Elbow on the inner thigh, turn the pinky up'],
  ['Spider Curl', 'Biceps', 'Dumbbell', 0, 'Concentration Curl', '10–15', 60, 'Chest on an incline bench, arms hang straight down'],
  ['Bayesian Cable Curl', 'Biceps', 'Cable', 0, 'Incline Dumbbell Curl', '10–15 / arm', 60, 'Face away from the cable, arm behind you'],
  ['Cross-Body Hammer Curl', 'Biceps', 'Dumbbell', 0, 'Hammer Curl', '10–12', 60, 'Neutral grip, curl to the opposite chest'],
  ['Rope Hammer Curl', 'Biceps', 'Cable', 0, 'Hammer Curl', '10–15', 60, 'Rope on a low cable, thumbs up, elbows still'],
  ['Drag Curl', 'Biceps', 'Barbell', 0, 'Barbell Curl', '8–12', 90, 'Elbows travel back, bar drags up the body'],
  ['Zottman Curl', 'Biceps', 'Dumbbell', 0, 'Hammer Curl', '10–12', 60, 'Curl palms up, turn over, lower palms down'],

  ['Rope Pushdown', 'Triceps', 'Cable', 1, 'Triceps Pushdown', '10–15', 60, 'Spread the rope at the bottom, elbows pinned'],
  ['Overhead Cable Extension', 'Triceps', 'Cable', 0, 'Overhead Dumbbell Extension', '10–15', 60, 'Face away, elbows by the ears, big stretch'],
  ['Single-Arm Cable Pushdown', 'Triceps', 'Cable', 0, 'Triceps Pushdown', '12–15 / arm', 60, 'Reverse grip, lock out fully'],
  ['Incline Dumbbell Skull Crusher', 'Triceps', 'Dumbbell', 0, 'Skull Crushers', '10–12', 60, 'Bench at 30°, lower beside the head'],
  ['Dumbbell Skull Crusher', 'Triceps', 'Dumbbell', 0, 'Skull Crushers', '10–12', 60, 'Palms facing, lower to the temples'],
  ['Seated EZ-Bar Overhead Extension', 'Triceps', 'Barbell', 1, 'Overhead Cable Extension', '8–12', 90, 'Back supported, elbows in, deep stretch'],
  ['JM Press', 'Triceps', 'Barbell', 1, 'Close-Grip Bench Press', '8–10', 120, 'Close grip, bar lowers toward the chin'],
  ['Dumbbell Kickback', 'Triceps', 'Dumbbell', 0, 'Cable Kickback', '12–15', 60, 'Upper arm still and level with the body'],
  ['Cable Kickback', 'Triceps', 'Cable', 0, 'Dumbbell Kickback', '12–15 / arm', 60, 'Hinged over, straighten the arm back'],
  ['Machine Dip', 'Triceps', 'Machine', 1, 'Dips', '8–12', 90, 'Upright, elbows back, press to lockout'],

  ['Reverse Barbell Curl', 'Forearms', 'Barbell', 0, 'Reverse EZ-Bar Curl', '10–12', 60, 'Overhand grip, wrists straight'],
  ['Reverse EZ-Bar Curl', 'Forearms', 'Barbell', 0, 'Reverse Barbell Curl', '10–12', 60, 'Overhand on the EZ bar, easier on the wrists'],
  ['Dumbbell Wrist Curl', 'Forearms', 'Dumbbell', 0, 'Reverse Wrist Curl', '12–20', 45, 'Forearms on the thighs, roll the weight up'],
  ['Reverse Wrist Curl', 'Forearms', 'Dumbbell', 0, 'Dumbbell Wrist Curl', '12–20', 45, 'Palms down, lift the knuckles'],
  ['Dead Hang', 'Forearms', 'Bar', 0, "Farmer's Carry", '30–60s hold', 60, 'Full grip, shoulders slightly engaged'],

  ['Hanging Leg Raise', 'Core', 'Bar', 0, 'Hanging Knee Raise', '8–12', 60, 'Legs straight, lift to hip height, no swing'],
  ['Ab Wheel Rollout', 'Core', 'Bodyweight', 0, 'Plank', '6–12', 60, 'From the knees, ribs down, roll out only as far as you control'],
  ['Side Plank', 'Core', 'Bodyweight', 0, 'Plank', '20–45s / side', 45, 'Hips high, body in one line'],
  ['Crunch', 'Core', 'Bodyweight', 0, 'Reverse Crunch', '15–20', 45, 'Curl the ribs to the hips, chin off the chest'],
  ['Bicycle Crunch', 'Core', 'Bodyweight', 0, 'Crunch', '12–20 / side', 45, 'Slow, elbow toward the opposite knee'],
  ['Russian Twist', 'Core', 'Bodyweight', 0, 'Cable Woodchop', '10–15 / side', 45, 'Lean back, turn the chest, not just the arms'],
  ['Hollow Body Hold', 'Core', 'Bodyweight', 0, 'Dead Bug', '20–40s hold', 45, 'Lower back pressed down, arms and legs long'],
  ['Mountain Climbers', 'Core', 'Bodyweight', 0, 'Plank', '20–40 / side', 45, 'Hips low, knees drive to the chest'],
  ['Cable Woodchop', 'Core', 'Cable', 0, 'Pallof Press', '10–12 / side', 45, 'Turn from the hips, arms stay long'],
  ['Machine Crunch', 'Core', 'Machine', 0, 'Cable Crunch', '10–15', 60, 'Curl the spine, no pulling with the arms'],
  ['Suitcase Carry', 'Core', 'Dumbbell', 0, "Farmer's Carry", '30–45s walk', 60, 'One heavy dumbbell, stay perfectly upright']
];

LIBRARY_ROWS.push(...LIBRARY_MORE);

const LIBRARY = new Map(LIBRARY_ROWS.map(([name, muscle, equipment, warmup, alt, reps, rest, cue]) =>
  [name, { name, muscle, equipment, warmup, alt, reps, rest, cue }]));

const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Legs', 'Hamstrings', 'Glutes', 'Calves', 'Biceps', 'Triceps', 'Forearms', 'Core'];

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
