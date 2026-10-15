// Personal records: a set is compared with saved history plus the other finished sets of today's workout.
import type { PrType, Session } from './types';

export const PR_LABELS: Record<PrType, string> = { weight: 'Heaviest weight', e1rm: 'Best est. 1RM', reps: 'Most reps', rest: 'Less rest' };

/** Epley estimate */
export function estOneRepMax(w: number, r: number): number {
  return w > 0 && r > 0 ? (r === 1 ? w : w * (1 + r / 30)) : 0;
}

export interface WorkSet {
  w: number;
  r: number;
  /** Rest in seconds (0 when unknown) */
  rest: number;
}

export interface PrCheck {
  name: string;
  history: Session[];
  /** Today's other finished sets of this exercise */
  otherSets: WorkSet[];
  w: number;
  r: number;
  rest: number;
}

export function detectPr({ name, history, otherSets, w, r, rest }: PrCheck): PrType | null {
  const past: WorkSet[] = [];
  history.forEach(s => s.exercises.forEach(e => {
    if (e.name === name) e.sets.forEach(x => past.push({ w: x.weight || 0, r: x.reps || 0, rest: Number(x.restSec) || 0 }));
  }));
  // A first-ever session sets the baseline; it isn't a record yet.
  if (!past.length || !(r > 0)) return null;
  past.push(...otherSets);
  const valid = past.filter(x => x.r > 0);
  if (!valid.length) return null;
  if (w > 0 && w > Math.max(...valid.map(x => x.w))) return 'weight';
  if (w > 0 && estOneRepMax(w, r) > Math.max(...valid.map(x => estOneRepMax(x.w, x.r))) + 0.01) return 'e1rm';
  const sameOrHeavier = valid.filter(x => x.w >= w);
  if (sameOrHeavier.length && r > Math.max(...sameOrHeavier.map(x => x.r))) return 'reps';
  // Same work as a saved set (at least its weight and reps) on less rest than ever before
  const matched = valid.filter(x => x.rest > 0 && x.r > 0 && w >= x.w && r >= x.r);
  if (matched.length && rest < Math.min(...matched.map(x => x.rest))) return 'rest';
  return null;
}
