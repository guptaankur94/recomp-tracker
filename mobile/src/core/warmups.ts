// Your own warm-up for an exercise, as typed in the warm-up editor (the same checks as the web app's editor).
import type { OwnWarmups, OwnWarmupSet } from './types';

export const MAX_WARMUP_SETS = 6;

export interface WarmupRow {
  kg: string;
  reps: string;
}

/** The rows as warm-up sets, or a message saying what to fix. Rows left empty are dropped. */
export function parseWarmupRows(rows: WarmupRow[]): { sets: OwnWarmupSet[] } | { error: string } {
  const sets: OwnWarmupSet[] = [];
  for (let i = 0; i < rows.length; i++) {
    const kgText = String(rows[i].kg).trim();
    const repsText = String(rows[i].reps).trim();
    if (!kgText && !repsText) continue;
    const reps = parseInt(repsText, 10);
    if (!(reps >= 1 && reps <= 50)) return { error: `Warm-up ${i + 1}: enter reps between 1 and 50` };
    const kg = kgText ? Math.round(parseFloat(kgText) * 100) / 100 : 0;
    if (kgText && !(kg >= 0 && kg <= 500)) return { error: `Warm-up ${i + 1}: enter a weight up to 500 kg, or leave it empty for a light set` };
    sets.push(kg > 0 ? { kg, reps } : { reps });
  }
  return { sets };
}

/** Warm-ups from a backup: added for exercises that don't have one here. Returns how many were added. */
export function mergeWarmups(current: OwnWarmups, imported: unknown): { warmups: OwnWarmups; added: number } {
  const warmups = { ...current };
  let added = 0;
  if (!imported || typeof imported !== 'object' || Array.isArray(imported)) return { warmups, added };
  Object.entries(imported as Record<string, unknown>).forEach(([name, list]) => {
    if (Object.prototype.hasOwnProperty.call(warmups, name) || !Array.isArray(list)) return;
    warmups[name] = list.filter(w => w && w.reps > 0).map(w => (w.kg > 0 ? { kg: Number(w.kg), reps: Number(w.reps) } : { reps: Number(w.reps) }));
    added++;
  });
  return { warmups, added };
}
