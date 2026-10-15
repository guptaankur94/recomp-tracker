// Apple Health weight sync, the parts that don't touch the phone: which weigh-ins from Health to add here.
import { localDateStr } from './format';
import type { BodyweightEntry } from './types';

/** A body-mass reading from Health */
export interface HealthWeight {
  kg: number;
  at: Date;
  /** The app that saved it; readings this app wrote are skipped (they're already here, or were deleted here) */
  source?: string;
}

/** How far back the first sync reads */
export const HEALTH_SYNC_DAYS = 365;

/**
 * Weigh-ins to add from Health: one per day (the latest reading that day), only on days with no weigh-in here,
 * since a weight typed in the app wins. Rounded to 0.1 kg like typed weights.
 */
export function mergeHealthWeights(local: BodyweightEntry[], readings: HealthWeight[], ownSource: string): BodyweightEntry[] {
  const have = new Set(local.map(e => e.dateStr));
  const latest = new Map<string, HealthWeight>();
  for (const r of readings) {
    if (r.source === ownSource || !(r.kg > 0) || r.kg > 500 || Number.isNaN(r.at.getTime())) continue;
    const day = localDateStr(r.at);
    if (have.has(day)) continue;
    const prev = latest.get(day);
    if (!prev || r.at.getTime() > prev.at.getTime()) latest.set(day, r);
  }
  return [...latest].map(([dateStr, r]) => ({ dateStr, kg: Math.round(r.kg * 10) / 10 })).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
}
