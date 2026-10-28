/* Storage keys and app-wide state. */

// Storage keys are kept identical to earlier versions so existing data carries over.
const HISTORY_KEY = 'recomp_history';

const BODYWEIGHT_KEY = 'recomp_bodyweight';

const PROFILE_KEY = 'recomp_profile';

const PLAN_KEY = 'recomp_plan';
// Your own warm-up sets, by exercise name: { 'Barbell Bench Press': [{ kg: 20, reps: 10 }, { reps: 5 }] }
const WARMUPS_KEY = 'recomp_warmups';

let programData = DEFAULT_PLAN;

let currentDayIdx = 0;

let calendarMonthOffset = 0;

let justCompletedBlock = null;

let progressExercise = null;

let progressMetric = 'top';

// A draft untouched for this long is treated as a new workout when edited again.
const DRAFT_STALE_MS = 12 * 60 * 60 * 1000;
// The workout clock: one for the whole app, whichever plan days you train
const CLOCK_KEY = 'recomp_clock';
