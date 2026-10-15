/* Storage keys and app-wide state. */

// Storage keys are kept identical to earlier versions so existing data carries over.
const HISTORY_KEY = 'recomp_history';

const BODYWEIGHT_KEY = 'recomp_bodyweight';

const PROFILE_KEY = 'recomp_profile';

const PLAN_KEY = 'recomp_plan';

let programData = DEFAULT_PLAN;

let currentDayIdx = 0;

let calendarMonthOffset = 0;

let justCompletedBlock = null;

let progressExercise = null;

let progressMetric = 'top';

// A draft untouched for this long is treated as a new workout when edited again.
const DRAFT_STALE_MS = 12 * 60 * 60 * 1000;
