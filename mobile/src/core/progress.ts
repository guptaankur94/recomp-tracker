// Progress: bodyweight trend and exercise charts.
import { dateStrMs, fmtClock, fmtNum } from './format';
import { estOneRepMax } from './records';
import { avgRest, setVolume } from './workout';
import type { BodyweightEntry, SavedExercise, SavedSet, Session } from './types';

const DAY_MS = 864e5;

/** Oldest first, one entry per date as saved */
export function sortBodyweight(entries: unknown): BodyweightEntry[] {
  return Array.isArray(entries) ? [...entries].sort((a, b) => a.dateStr.localeCompare(b.dateStr)) : [];
}

/** Daily weigh-ins swing 1–2 kg, so the 7-day average is the line to watch */
export function movingAverage(entries: BodyweightEntry[]) {
  return entries.map((e, i) => {
    const t = dateStrMs(e.dateStr);
    const win = entries.slice(0, i + 1).filter(x => t - dateStrMs(x.dateStr) < 7 * DAY_MS);
    return { x: t, y: win.reduce((sum, x) => sum + x.kg, 0) / win.length, raw: e.kg };
  });
}

/** Least-squares slope of the last 28 days of weigh-ins, in kg per week (null with under a week of data) */
export function weeklyRate(entries: BodyweightEntry[]): number | null {
  if (!entries.length) return null;
  const lastT = dateStrMs(entries[entries.length - 1].dateStr);
  const recent = entries.filter(e => lastT - dateStrMs(e.dateStr) <= 28 * DAY_MS);
  if (recent.length < 3) return null;
  const xs = recent.map(e => dateStrMs(e.dateStr) / DAY_MS);
  if (xs[xs.length - 1] - xs[0] < 7) return null;
  const ys = recent.map(e => e.kg);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; });
  return den ? (num / den) * 7 : null;
}

export type MetricKey = 'top' | 'e1rm' | 'volume' | 'reps' | 'rest';

export interface Metric {
  label: string;
  unit: string;
  lowerBetter?: boolean;
  fmt?: (v: number) => string;
  calc: (sets: SavedSet[]) => number | null;
}

export const METRICS: Record<MetricKey, Metric> = {
  top: { label: 'Top Set', unit: 'kg', calc: sets => Math.max(...sets.map(s => s.weight)) },
  e1rm: { label: '1RM', unit: 'kg', calc: sets => Math.max(...sets.map(s => estOneRepMax(s.weight, s.reps))) },
  volume: { label: 'Volume', unit: 'kg', calc: sets => sets.reduce((sum, s) => sum + setVolume(s), 0) },
  reps: { label: 'Reps', unit: 'reps', calc: sets => Math.max(...sets.map(s => s.reps)) },
  // Average rest between sets; going down at the same load is progress
  rest: { label: 'Rest', unit: '', lowerBetter: true, fmt: v => fmtClock(v), calc: sets => avgRest(sets) || null }
};

/** Sessions for one exercise, oldest first (history newest first) */
export function exerciseSessions(name: string, history: Session[]): { session: Session; ex: SavedExercise }[] {
  return history
    .map(s => ({ session: s, ex: s.exercises.find(e => e.name === name) }))
    .filter((r): r is { session: Session; ex: SavedExercise } => !!r.ex && r.ex.sets.length > 0)
    .reverse();
}

/** Gold markers: sessions that logged a record, plus the all-time best on this metric.
    (Marking every new high would turn steady progress into a row of gold dots.) */
export function markRecords<P extends { y: number; pr?: boolean }>(points: P[], lowerBetter = false) {
  const bestIdx = points.reduce((bi, p, i) => ((lowerBetter ? p.y <= points[bi].y : p.y >= points[bi].y) ? i : bi), 0);
  return points.map((p, i) => ({ ...p, record: p.pr || (points.length > 1 && i === bestIdx), best: points.length > 1 && i === bestIdx }));
}

/** The heaviest set (most reps breaks a tie) */
export function bestSet(sets: SavedSet[]): SavedSet {
  return sets.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps)) ? b : a);
}

export interface LiftSummary {
  name: string;
  /** Estimated 1RM per session (or best reps for bodyweight work), oldest first */
  values: number[];
  usesWeight: boolean;
  latest: SavedSet;
  /** Latest minus first value */
  change: number;
}

/** Main lifts: the six most-logged exercises (at least two sessions each) */
export function liftSummaries(history: Session[]): LiftSummary[] {
  const counts = new Map<string, number>();
  history.forEach(s => s.exercises.forEach(e => counts.set(e.name, (counts.get(e.name) || 0) + 1)));
  return [...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name]) => {
    const rows = exerciseSessions(name, history);
    const usesWeight = rows.some(r => r.ex.sets.some(s => s.weight > 0));
    const values = rows.map(r => (usesWeight ? METRICS.e1rm : METRICS.reps).calc(r.ex.sets) as number);
    return { name, values, usesWeight, latest: bestSet(rows[rows.length - 1].ex.sets), change: values[values.length - 1] - values[0] };
  });
}

export interface BodyweightSummary {
  /** Latest 7-day average */
  trend: number | null;
  /** kg per week over the last 4 weeks */
  rate: number | null;
  /** 'good' toward the goal, 'bad' away from it, null when flat or no goal */
  rateTone: 'good' | 'bad' | null;
  rateLabel: string;
  goalLabel: string;
}

/** The three bodyweight tiles, as the web app words them */
export function bodyweightSummary(entries: BodyweightEntry[], goalKg: number | null, now: Date = new Date()): BodyweightSummary {
  const avg = movingAverage(entries);
  const trend = avg.length ? avg[avg.length - 1].y : null;
  const rate = weeklyRate(entries);
  const towardGoal = (r: number) => !!goalKg && trend != null && r !== 0 && Math.sign(goalKg - trend) === Math.sign(r);
  let goalLabel = goalKg ? 'Goal' : 'Set a goal in your profile';
  if (goalKg && trend != null) {
    const left = Math.round((goalKg - trend) * 10) / 10;
    if (Math.abs(left) <= 0.2) {
      goalLabel = 'At goal';
    } else if (rate && towardGoal(rate) && (goalKg - trend) / rate < 104) {
      const weeks = (goalKg - trend) / rate;
      goalLabel = `~${new Date(now.getTime() + weeks * 7 * DAY_MS).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at this rate`;
    } else {
      goalLabel = `${fmtNum(Math.abs(left))} kg to go`;
    }
  }
  const rateTone = rate == null || Math.abs(rate) < 0.05 ? null : towardGoal(rate) ? 'good' : goalKg ? 'bad' : null;
  const rateLabel = rate == null ? 'Need 1 week of data' : rateTone === 'good' ? '↗ Toward goal' : rateTone === 'bad' ? '↘ Away from goal' : 'Last 4 weeks';
  return { trend, rate, rateTone, rateLabel, goalLabel };
}
