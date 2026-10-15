// Progress: bodyweight trend and exercise charts.
import { dateStrMs, fmtClock } from './format';
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
