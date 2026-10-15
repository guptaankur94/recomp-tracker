// Workout logic: set volume, warm-ups, rest choices, progression and how a saved session is named.
import { fmtClock, fmtNum } from './format';
import type { PlanDay, PlanExerciseBase, SavedSet, Session } from './types';

/** Total kg moved in a set, including its drop sets */
export function setVolume(set: Pick<SavedSet, 'weight' | 'reps' | 'drops'>): number {
  return set.weight * set.reps + (set.drops || []).reduce((sum, d) => sum + d.weight * d.reps, 0);
}

export function fmtSetLine(set: Pick<SavedSet, 'weight' | 'reps'>): string {
  return `${fmtNum(set.weight)} kg × ${set.reps}`;
}

/* Warm-up sets: a short ramp to the working weight before the working sets. They are ticked off, not
   logged: they never count toward history, volume or records. */
const WARMUP_RAMPS: Record<number, { pct: number; reps: number }[]> = {
  1: [{ pct: 0.5, reps: 8 }],
  2: [{ pct: 0.5, reps: 8 }, { pct: 0.75, reps: 4 }],
  3: [{ pct: 0.4, reps: 8 }, { pct: 0.6, reps: 5 }, { pct: 0.8, reps: 2 }]
};

const COMPOUND_RE = /press|squat|deadlift|\bRDL|row|pull-?down|pull-?up|chin-?up|dip|lunge|leg press|hip thrust/i;

/** Plans without warm-up counts (older or imported ones): 2 before the day's first exercise,
    1 before a later compound lift, none for isolation work. */
export function defaultWarmup(ex: Pick<PlanExerciseBase, 'name'>, exIdx: number): number {
  if (exIdx === 0) return 2;
  return COMPOUND_RE.test(ex.name) ? 1 : 0;
}

export function warmupCount(ex: Pick<PlanExerciseBase, 'name' | 'warmup'>, exIdx: number): number {
  const n = parseInt(String(ex.warmup), 10);
  return Math.min(3, Number.isNaN(n) ? defaultWarmup(ex, exIdx) : Math.max(0, n));
}

export interface Suggestion {
  w: number;
  r: number;
}

/** The weight the ramp builds to: what's typed in set 1, else the suggestion, else the plan's target. */
export function workingWeight(ex: Pick<PlanExerciseBase, 'weightTarget'>, typedWeight: number, suggestion: Suggestion | null): number {
  if (typedWeight > 0) return typedWeight;
  if (suggestion && suggestion.w > 0) return suggestion.w;
  if (/\bBW\b|bodyweight/i.test(ex.weightTarget)) return 0;
  // Only a target with a weight in it counts ("40–55 kg", "12.5 kg DBs"), not "2 reps in reserve"
  const m = String(ex.weightTarget).match(/(\d+(?:\.\d+)?)\s*(?:[–-]\s*\d+(?:\.\d+)?\s*)?kg/i);
  return m ? parseFloat(m[1]) : 0;
}

export interface WarmupSet {
  label: string;
  kg?: number;
  reps: number;
}

export function warmupSets(ex: PlanExerciseBase, exIdx: number, typedWeight: number, suggestion: Suggestion | null): WarmupSet[] {
  const n = warmupCount(ex, exIdx);
  if (!n) return [];
  const work = workingWeight(ex, typedWeight, suggestion);
  const barbell = /barbell|\bbar\b|bench press|squat|deadlift|\bRDL/i.test(`${ex.name} ${ex.weightTarget}`) && !/\bDBs?\b/.test(ex.name);
  const dumbbell = /\bDBs?\b/.test(`${ex.name} ${ex.weightTarget}`);
  return WARMUP_RAMPS[n].map(({ pct, reps }) => {
    // No number to work from (machines "Moderate", bodyweight): name the effort instead
    if (!work) return { label: `${pct < 0.55 ? 'Light' : pct < 0.7 ? 'Moderate' : 'Heavier'} × ${reps}`, reps };
    let kg = work * pct;
    kg = dumbbell ? Math.max(1, Math.round(kg)) : Math.max(barbell ? 20 : 2.5, Math.round(kg / 2.5) * 2.5);
    // Too close to the working weight to be a warm-up (e.g. a 20 kg curl): just go light
    if (kg >= work * 0.85) return { label: `Light × ${reps}`, reps };
    if (barbell && kg <= 20) return { label: `Bar × ${reps}`, kg: 20, reps };
    return { label: `${fmtNum(kg)} kg × ${reps}`, kg, reps };
  });
}

/* Rest is a chosen setting, not a stopwatch. Cutting it while keeping weight and reps is a form of
   progressive overload. */

/** 0:30 to 5:00 in 15-second steps */
export const REST_CHOICES = Array.from({ length: 19 }, (_, i) => 30 + i * 15);

export function roundRest(sec: number): number {
  return Math.round(sec / 15) * 15;
}

/** Average rest across saved sets (sets from before rest was logged are skipped) */
export function avgRest(sets: Pick<SavedSet, 'restSec'>[] | null | undefined): number {
  const rests = (sets || []).map(x => Number(x.restSec)).filter(v => v > 0);
  return rests.length ? Math.round(rests.reduce((a, b) => a + b, 0) / rests.length) : 0;
}

export function restDelta(sec: number, ref: number): string {
  const d = sec - ref;
  return d === 0 ? '' : `${d < 0 ? '−' : '+'}${fmtClock(Math.abs(d))}`;
}

export interface RestChoice {
  label: string;
  value: number;
  selected: boolean;
  tag: '' | 'Plan' | 'Last' | 'Plan·Last';
}

export function restChoices(ex: Pick<PlanExerciseBase, 'rest'>, current: number, lastRest: number, extra: number[] = []): RestChoice[] {
  const values = [...new Set([...REST_CHOICES, current, ex.rest, lastRest, ...extra].filter(v => v > 0))].sort((a, b) => a - b);
  return values.map(sec => ({
    label: fmtClock(sec),
    value: sec,
    selected: sec === current,
    tag: sec === ex.rest && sec === lastRest ? 'Plan·Last' : sec === ex.rest ? 'Plan' : sec === lastRest ? 'Last' : ''
  }));
}

/** The − / + rest stepper under a set moves 15 s at a time, within 0:15–10:00 */
export function nudgeRest(current: number, delta: number): number {
  return Math.min(600, Math.max(15, current + delta));
}

/* Double progression: once the top of the rep range is hit, add load (or slow the tempo when the DB is maxed). */
export function repRange(ex: Pick<PlanExerciseBase, 'repTarget'>): [number, number] | null {
  const m = String(ex.repTarget).match(/(\d+)\s*[–-]\s*(\d+)/);
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : null;
}

export function isDumbbellExercise(ex: Pick<PlanExerciseBase, 'name' | 'weightTarget'>): boolean {
  return /\bDBs?\b/.test(ex.name) || /\bDBs?\b/.test(ex.weightTarget);
}

/** The same set number last time (or the set in that position) */
export function lastSetFor(last: { sets: SavedSet[] } | null, setNum: number): SavedSet | null {
  return last ? (last.sets.find(x => x.set === setNum) || last.sets[setNum - 1] || null) : null;
}

/** What to aim for in a set, based on the same set last time. Shown as placeholders, and used when ✓ is tapped with empty fields. */
export function suggestSet(ex: PlanExerciseBase, lastSet: SavedSet | null): Suggestion | null {
  if (!lastSet) return null;
  const range = repRange(ex);
  if (range && lastSet.weight > 0 && lastSet.reps >= range[1] && !isDumbbellExercise(ex)) {
    return { w: lastSet.weight + 2.5, r: range[0] };
  }
  return { w: lastSet.weight, r: lastSet.reps };
}

/** At the top of the rep range: add load, or keep it and cut 15 s of rest */
export function progressionTip(ex: PlanExerciseBase, lastSet: SavedSet | null, lastRest: number): string {
  const range = repRange(ex);
  if (!range || !lastSet || !lastSet.weight || lastSet.reps < range[1]) return '';
  const cut = lastRest - 15 >= 30 ? ` or cut rest to ${fmtClock(roundRest(lastRest) - 15)}` : '';
  return isDumbbellExercise(ex) ? `Go heavier, slower${cut}` : `Try ${fmtNum(lastSet.weight + 2.5)} kg${cut}`;
}

/* Day names. One workout per date: everything saved on a date goes into that date's session, whichever
   day it came from; each exercise remembers its plan day, and the session is named after those days. */
export function shortDayTitle(title: string): string {
  const t = String(title).replace(/\bfocus\b/i, '').split(/\s*[&,–—+/]\s*|\s+-\s+/)[0].trim();
  return t.length > 16 ? `${t.slice(0, 15)}…` : t;
}

export function dayNumber(label: string): number {
  const m = String(label).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 99;
}

export function sessionDayLabels(s: Pick<Session, 'day' | 'days'>): string[] {
  return s.days && s.days.length ? s.days : [s.day];
}

/** The plan day this session mostly trained (by sets); drives "Up next" */
export function mainDayLabel(s: Pick<Session, 'day' | 'exercises'>): string {
  const counts: Record<string, number> = {};
  s.exercises.forEach(e => { const d = e.day || s.day; counts[d] = (counts[d] || 0) + e.sets.length; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1] || dayNumber(a[0]) - dayNumber(b[0]))[0];
  return top ? top[0] : s.day;
}

/** The session with its days, label and title worked out from its exercises' plan days */
export function applySessionDays(session: Session, planDays: PlanDay[]): Session {
  const first = sessionDayLabels(session)[0];
  const exercises = session.exercises.map(e => (e.day ? e : { ...e, day: first }));
  const days = [...new Set(exercises.map(e => e.day as string))].sort((a, b) => dayNumber(a) - dayNumber(b));
  const titleOf = (label: string) => planDays.find(d => d.day === label)?.title || '';
  return days.length === 1
    ? { ...session, exercises, days, day: days[0], title: titleOf(days[0]) || session.title }
    : { ...session, exercises, days, day: days.join(' + '), title: days.map(d => shortDayTitle(titleOf(d) || d)).join(' + ') };
}
