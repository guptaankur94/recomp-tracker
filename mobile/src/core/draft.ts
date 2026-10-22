// A workout in progress ("draft"): what's typed and ticked on a day, before it is saved to history.
// One draft per plan day (plus the custom workout), as in the web app, which kept the same data in
// separate storage keys. Every function here returns a new draft rather than changing the one passed in.
import { localDateStr, sessionDateStr, fmtNum } from './format';
import { getLastPerformance } from './history';
import { detectPr, type WorkSet } from './records';
import type { PlanDay, PlanExercise, PrType, SavedExercise, SavedSet, Session } from './types';
import { applySessionDays, lastSetFor, suggestSet } from './workout';

export interface DraftDrop {
  w: string;
  r: string;
}

export interface DraftSet {
  /** As typed: weight in kg, reps */
  w: string;
  r: string;
  done: boolean;
  /** Rest after this set when it differs from the exercise's */
  rest?: number;
  pr?: PrType;
  /** The rest timer already ran for this set (ticking it again after an edit doesn't restart it) */
  rested?: boolean;
  drops?: DraftDrop[];
}

export interface DraftExercise {
  /** One entry per set; when missing, the exercise has the plan's number of untouched sets */
  sets?: DraftSet[];
  /** Rest between sets for every set of this exercise, when changed from the plan */
  rest?: number;
  /** Warm-up sets ticked off (indexes) */
  warmups?: number[];
}

/** An exercise added for today only; fromDay when it came from another day of the plan */
export type ExtraExercise = PlanExercise & { fromDay?: string };

export interface Draft {
  /** When the workout clock started: Start, or the first edit */
  startedAt: number;
  lastEditAt: number;
  /** Start was tapped (the clock runs before any set is ticked) */
  started?: boolean;
  /** Time already spent paused, in ms */
  pausedMs?: number;
  /** Set while paused */
  pausedAt?: number;
  /** By exercise position in the day (plan exercises, then extras) */
  exercises: Record<number, DraftExercise>;
  extras: ExtraExercise[];
}

/** A draft untouched for this long counts as a new workout when edited again */
export const DRAFT_STALE_MS = 12 * 60 * 60 * 1000;

/** The custom workout: a one-off day after the plan's days, built from scratch */
export const CUSTOM_DAY: PlanDay = { day: 'Custom', title: 'Custom workout', exercises: [] };

export function emptyDraft(now: number): Draft {
  return { startedAt: now, lastEditAt: now, exercises: {}, extras: [] };
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** An exercise as shown on the day: swapped for its alternative when chosen */
export type DayExercise = PlanExercise & { swapped: boolean; otherName: string | null; isExtra: boolean; fromDay?: string };

/** Plan exercises plus today's extras; swaps is the set of swapped positions (remembered between workouts) */
export function dayExercises(day: PlanDay, draft: Draft | null, swaps: Set<number>): DayExercise[] {
  const withSwap = (ex: ExtraExercise, i: number, isExtra: boolean): DayExercise => {
    const alt = ex.alt && typeof ex.alt === 'object' && ex.alt.name ? ex.alt : null;
    const extra = { isExtra, ...(ex.fromDay ? { fromDay: ex.fromDay } : {}) };
    return alt && swaps.has(i)
      ? { ...alt, ...extra, swapped: true, otherName: ex.name }
      : { ...ex, ...extra, swapped: false, otherName: alt ? alt.name : null };
  };
  const base = day.exercises.map((ex, i) => withSwap(ex, i, false));
  return [...base, ...(draft?.extras || []).map((ex, j) => withSwap(ex, base.length + j, true))];
}

const blankSet = (): DraftSet => ({ w: '', r: '', done: false });

/** The exercise's sets, filled out to the plan's count when untouched */
export function draftSets(draft: Draft | null, exIdx: number, ex: { sets: number }): DraftSet[] {
  const sets = draft?.exercises[exIdx]?.sets;
  return sets ? sets : Array.from({ length: ex.sets }, blankSet);
}

export function exerciseRest(draft: Draft | null, exIdx: number, ex: { rest: number }): number {
  const v = draft?.exercises[exIdx]?.rest;
  return v && v > 0 ? v : ex.rest;
}

export function setRest(draft: Draft | null, exIdx: number, setNum: number, ex: { rest: number }): number {
  const v = draftSets(draft, exIdx, { sets: 0 })[setNum - 1]?.rest;
  return v && v > 0 ? v : exerciseRest(draft, exIdx, ex);
}

/** Anything worth keeping: extras, a ticked set, or a typed value */
export function hasDraft(draft: Draft | null): boolean {
  if (!draft) return false;
  if (draft.extras.length) return true;
  return Object.values(draft.exercises).some(e => (e.sets || []).some(s => s.done || s.w || s.r || (s.drops || []).some(d => d.w || d.r)));
}

/** Marks an edit; a draft left for 12 hours starts over as a new workout (its start time moves to now) */
export function touch(draft: Draft | null, now: number): Draft {
  if (!draft) return emptyDraft(now);
  if (now - draft.lastEditAt > DRAFT_STALE_MS) return { ...withoutClock(draft), startedAt: now, lastEditAt: now };
  return { ...draft, lastEditAt: now };
}

/* The workout clock. Only the time between Start (or the first edit) and now, less pauses, counts. */
function withoutClock(draft: Draft): Draft {
  const next = { ...draft };
  delete next.started;
  delete next.pausedMs;
  delete next.pausedAt;
  return next;
}

export function activeMs(draft: Draft | null, now: number): number {
  if (!draft) return 0;
  const paused = (draft.pausedMs || 0) + (draft.pausedAt ? Math.max(0, now - draft.pausedAt) : 0);
  return Math.max(0, now - draft.startedAt - paused);
}

/** Start: the clock starts now (sets already typed stay) */
export function startClock(draft: Draft | null, now: number): Draft {
  return { ...withoutClock(draft ?? emptyDraft(now)), startedAt: now, lastEditAt: now, started: true };
}

export function pauseClock(draft: Draft, now: number): Draft {
  return draft.pausedAt ? draft : { ...draft, pausedAt: now, lastEditAt: now };
}

export function resumeClock(draft: Draft, now: number): Draft {
  if (!draft.pausedAt) return draft;
  const next: Draft = { ...draft, pausedMs: (draft.pausedMs || 0) + Math.max(0, now - draft.pausedAt), lastEditAt: now };
  delete next.pausedAt;
  return next;
}

/** The clock is running (or paused) for a workout started today: Start was tapped, or a set ticked */
export function clockRunning(draft: Draft | null, setsDone: number, now: number): boolean {
  return !!draft && localDateStr(new Date(draft.startedAt)) === localDateStr(new Date(now)) && (setsDone > 0 || !!draft.started);
}

/** Changes one exercise's sets (created from the plan's count if untouched) */
export function updateSets(draft: Draft | null, exIdx: number, ex: { sets: number }, now: number, fn: (sets: DraftSet[]) => DraftSet[]): Draft {
  const next = clone(touch(draft, now));
  const current = next.exercises[exIdx] || {};
  next.exercises[exIdx] = { ...current, sets: fn(clone(draftSets(next, exIdx, ex))) };
  return next;
}

export function updateExercise(draft: Draft | null, exIdx: number, now: number, fn: (e: DraftExercise) => DraftExercise): Draft {
  const next = clone(touch(draft, now));
  next.exercises[exIdx] = fn(next.exercises[exIdx] || {});
  return next;
}

/** Today's other finished sets of an exercise, for record checks */
export function otherDoneSets(draft: Draft | null, exIdx: number, setNum: number, ex: { rest: number; sets: number }): WorkSet[] {
  return draftSets(draft, exIdx, ex)
    .map((s, i) => ({ s, n: i + 1 }))
    .filter(({ s, n }) => n !== setNum && s.done)
    .map(({ s, n }) => ({ w: parseFloat(s.w) || 0, r: parseInt(s.r, 10) || 0, rest: setRest(draft, exIdx, n, ex) }));
}

export type CompleteResult =
  | { ok: false }
  | { ok: true; draft: Draft; pr: PrType | null; finished: boolean; firstCompletion: boolean; w: number; r: number };

/** Ticks a set: empty fields take the suggestion; reps are required. Records are checked against history and today's other sets. */
export function completeSet(draft: Draft | null, exIdx: number, setNum: number, ex: DayExercise, history: Session[], now: number): CompleteResult {
  const sets = draftSets(draft, exIdx, ex);
  const set = sets[setNum - 1] || blankSet();
  const suggestion = suggestSet(ex, lastSetFor(getLastPerformance(ex.name, history), setNum));
  let w = set.w.trim();
  let r = set.r.trim();
  if (!r && suggestion && suggestion.r) r = String(suggestion.r);
  if (!w && suggestion && suggestion.w) w = String(suggestion.w);
  if (!(parseInt(r, 10) > 0)) return { ok: false };
  const wNum = parseFloat(w) || 0;
  const rNum = parseInt(r, 10);
  const pr = detectPr({ name: ex.name, history, otherSets: otherDoneSets(draft, exIdx, setNum, ex), w: wNum, r: rNum, rest: setRest(draft, exIdx, setNum, ex) });
  const firstCompletion = !set.rested;
  const next = updateSets(draft, exIdx, ex, now, s => {
    const updated: DraftSet = { ...s[setNum - 1], w, r, done: true, rested: true };
    if (pr) updated.pr = pr;
    else delete updated.pr;
    s[setNum - 1] = updated;
    return s;
  });
  const finished = draftSets(next, exIdx, ex).every(s => s.done);
  // Ticking a set while paused carries on the clock
  return { ok: true, draft: resumeClock(next, now), pr, finished, firstCompletion, w: wNum, r: rNum };
}

/** Re-checks a finished set's record after its rest changed */
export function recheckPr(draft: Draft, exIdx: number, setNum: number, ex: DayExercise, history: Session[], now: number): Draft {
  const set = draftSets(draft, exIdx, ex)[setNum - 1];
  if (!set || !set.done) return draft;
  const pr = detectPr({ name: ex.name, history, otherSets: otherDoneSets(draft, exIdx, setNum, ex), w: parseFloat(set.w) || 0, r: parseInt(set.r, 10) || 0, rest: setRest(draft, exIdx, setNum, ex) });
  return updateSets(draft, exIdx, ex, now, s => {
    if (pr) s[setNum - 1].pr = pr;
    else delete s[setNum - 1].pr;
    return s;
  });
}

/** Rest for one set; choosing the exercise's own rest clears the override */
export function withSetRest(draft: Draft | null, exIdx: number, setNum: number, ex: DayExercise, sec: number, now: number): Draft {
  const base = exerciseRest(draft, exIdx, ex);
  return updateSets(draft, exIdx, ex, now, s => {
    if (sec === base) delete s[setNum - 1].rest;
    else s[setNum - 1].rest = sec;
    return s;
  });
}

/** Rest for every set of the exercise (clears per-set changes) */
export function withExerciseRest(draft: Draft | null, exIdx: number, ex: DayExercise, sec: number, now: number): Draft {
  const next = updateSets(draft, exIdx, ex, now, s => s.map(x => { const { rest: _rest, ...rest } = x; return rest; }));
  next.exercises[exIdx].rest = sec;
  return next;
}

export function addSet(draft: Draft | null, exIdx: number, ex: DayExercise, now: number): Draft {
  return updateSets(draft, exIdx, ex, now, s => [...s, blankSet()]);
}

/** Removes a set; later sets move up. The last remaining set can't be removed. */
export function removeSet(draft: Draft | null, exIdx: number, setNum: number, ex: DayExercise, now: number): Draft | null {
  if (draftSets(draft, exIdx, ex).length <= 1) return null;
  return updateSets(draft, exIdx, ex, now, s => s.filter((_, i) => i !== setNum - 1));
}

export function addExtra(draft: Draft | null, ex: ExtraExercise, now: number): Draft {
  const next = clone(touch(draft, now));
  next.extras.push(ex);
  return next;
}

/** Removes an extra exercise; later exercises' entries (and swaps) move down a position */
export function removeExtra(draft: Draft, exIdx: number, planCount: number, swaps: Set<number>, now: number): { draft: Draft; swaps: Set<number> } {
  const next = clone(touch(draft, now));
  next.extras.splice(exIdx - planCount, 1);
  const shifted: Record<number, DraftExercise> = {};
  Object.entries(next.exercises).forEach(([k, v]) => {
    const i = Number(k);
    if (i < exIdx) shifted[i] = v;
    else if (i > exIdx) shifted[i - 1] = v;
  });
  next.exercises = shifted;
  const nextSwaps = new Set<number>();
  swaps.forEach(i => { if (i < exIdx) nextSwaps.add(i); else if (i > exIdx) nextSwaps.add(i - 1); });
  return { draft: next, swaps: nextSwaps };
}

/** Sets ticked and total, across the day */
export function dayProgress(draft: Draft | null, exercises: DayExercise[]): { done: number; total: number } {
  let done = 0;
  let total = 0;
  exercises.forEach((ex, i) => {
    const sets = draftSets(draft, i, ex);
    total += sets.length;
    done += sets.filter(s => s.done).length;
  });
  return { done, total };
}

/** "Next: Set 2 · 50 kg × 8", or the next exercise's first open set */
export function nextSetLabel(draft: Draft | null, exercises: DayExercise[], exIdx: number, setNum: number, history: Session[]): string {
  for (let e = exIdx; e < exercises.length; e++) {
    const ex = exercises[e];
    const sets = draftSets(draft, e, ex);
    for (let s = e === exIdx ? setNum + 1 : 1; s <= sets.length; s++) {
      if (sets[s - 1].done) continue;
      const sug = suggestSet(ex, lastSetFor(getLastPerformance(ex.name, history), s));
      const w = parseFloat(sets[s - 1].w) || (sug ? sug.w : 0);
      const r = parseInt(sets[s - 1].r, 10) || (sug ? sug.r : 0);
      const target = r ? ` · ${w > 0 ? `${fmtNum(w)} kg` : 'BW'} × ${r}` : '';
      return `Next: ${e === exIdx ? '' : `${ex.name} · `}Set ${s}${target}`;
    }
  }
  return 'All sets done. Finish when ready.';
}

/** The day's logged sets as saved-history exercises (sets with nothing entered are left out) */
export function collectSets(draft: Draft | null, exercises: DayExercise[], dayLabel: string, isCustom: boolean): SavedExercise[] {
  const logged: SavedExercise[] = [];
  exercises.forEach((ex, exIdx) => {
    const performed: SavedSet[] = [];
    draftSets(draft, exIdx, ex).forEach((s, i) => {
      const weight = parseFloat(s.w || '0');
      const reps = parseInt(s.r || '0', 10);
      const drops = (s.drops || []).map(d => ({ weight: parseFloat(d.w) || 0, reps: parseInt(d.r, 10) || 0 })).filter(d => d.reps > 0);
      if (reps > 0 || weight > 0 || drops.length > 0) {
        const set: SavedSet = { set: i + 1, weight: weight || 0, reps: reps || 0, restSec: setRest(draft, exIdx, i + 1, ex) };
        if (drops.length) set.drops = drops;
        if (s.pr && s.done) set.pr = s.pr;
        performed.push(set);
      }
    });
    // A custom workout stays custom: its exercises never count toward a plan day or the rotation
    if (performed.length) logged.push({ name: ex.name, day: isCustom ? dayLabel : (ex.fromDay || dayLabel), sets: performed });
  });
  return logged;
}

/** Saves the draft into the session for the date it was started on (one workout per date), merging with what's
    already saved that day. Returns the new history (newest first) and the session, or null when nothing was logged. */
export function saveDraft(args: {
  draft: Draft | null; exercises: DayExercise[]; day: PlanDay; isCustom: boolean; planDays: PlanDay[]; history: Session[]; now: number;
}): { history: Session[]; session: Session } | null {
  const { draft, exercises, day, isCustom, planDays, now } = args;
  const logged = collectSets(draft, exercises, day.day, isCustom);
  if (!logged.length) return null;
  // Dated by when logging started, so late sessions and next-morning saves land on the right day
  const startedAt = draft && draft.startedAt <= now ? draft.startedAt : now;
  const workoutDate = localDateStr(new Date(startedAt));
  // Time from Start (or the first logged set) to now, less pauses, when logged in one sitting today; parts add up
  const elapsedSec = Math.round(activeMs(draft && { ...draft, startedAt }, now) / 1000);
  const durationSec = draft && workoutDate === localDateStr(new Date(now)) && elapsedSec < 5 * 3600 ? elapsedSec : 0;

  const history = clone(args.history);
  const existing = history.find(s => sessionDateStr(s) === workoutDate);
  let session: Session;
  if (existing) {
    session = existing;
    logged.forEach(ex => {
      const target = session.exercises.find(e => e.name === ex.name);
      if (target) {
        const offset = Math.max(0, ...target.sets.map(s => s.set));
        ex.sets.forEach((s, i) => target.sets.push({ ...s, set: offset + i + 1 }));
      } else {
        session.exercises.push(ex);
      }
    });
    session.updatedAt = now;
    if (durationSec) session.durationSec = (session.durationSec || 0) + durationSec;
  } else {
    session = {
      id: startedAt,
      dateStr: workoutDate,
      displayDate: new Date(startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      day: day.day,
      title: day.title,
      exercises: logged,
      ...(durationSec ? { durationSec } : {})
    };
    history.unshift(session);
  }
  const named = applySessionDays(session, planDays);
  const out = history.map(s => (s === session ? named : s)).sort((a, b) => b.id - a.id);
  return { history: out, session: named };
}
