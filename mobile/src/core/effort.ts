// Effort: how hard the whole workout felt, asked at Finish. Stored on the 0–10 scale used for session RPE
// (effort × minutes is the session's training load); the four choices are the points people actually use.
// Same as the web app's EFFORT_LEVELS.
export const EFFORT_LEVELS = [
  { value: 3, label: 'Easy', hint: 'could do lots more' },
  { value: 5, label: 'Moderate', hint: 'solid work' },
  { value: 7, label: 'Hard', hint: 'pushed it' },
  { value: 10, label: 'All out', hint: 'nothing left' }
] as const;

/** The closest level's name ("Hard"), or '' when none was given */
export function effortLabel(value: number | null | undefined): string {
  if (!(value && value > 0)) return '';
  return EFFORT_LEVELS.reduce<(typeof EFFORT_LEVELS)[number]>((a, l) => (Math.abs(l.value - value) < Math.abs(a.value - value) ? l : a), EFFORT_LEVELS[0]).label;
}
