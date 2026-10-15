// The exercise library: muscles, equipment, warm-ups, swaps, reps, rest and cues.
// Data comes from data/exercises.json (exported from the web app by scripts/export-web-data.js).
import data from './data/exercises.json';
import type { PlanExercise } from './types';

export interface LibraryEntry {
  name: string;
  muscle: string;
  equipment: string;
  warmup: number;
  /** The usual swap */
  alt: string;
  reps: string;
  rest: number;
  cue: string;
}

export type EquipmentKind = 'gym' | 'dumbbells' | 'bodyweight';

export const MUSCLES: string[] = data.muscles;

export const LIBRARY = new Map<string, LibraryEntry>(data.exercises.map(e => [e.name, e]));

/** Loads are effort-based: the first session asks for a weight and suggestions take over from there. */
export function libraryTarget(entry: LibraryEntry): string {
  return entry.equipment === 'Bodyweight' || entry.equipment === 'Bar' ? 'Bodyweight' : '2 reps in reserve';
}

export function repLabel(reps: string): string {
  return /reps|hold|walk|s\b/.test(reps) ? reps : `${reps} reps`;
}

/** Equipment each kind of plan's alternatives may use (null: anything) */
export const EQUIPMENT_ALLOWED: Record<EquipmentKind, string[] | null> = {
  gym: null,
  dumbbells: ['Dumbbell', 'Bodyweight'],
  bodyweight: ['Bodyweight']
};

/** An alternative the user can actually do: the named one, else the first same-muscle exercise with allowed equipment */
export function pickAlternative(e: LibraryEntry, wanted: string, allowed: string[] | null): LibraryEntry | null {
  const a = LIBRARY.get(wanted);
  if (!allowed || (a && allowed.includes(a.equipment))) return a ?? null;
  return [...LIBRARY.values()].find(x => x.muscle === e.muscle && x.name !== e.name && allowed.includes(x.equipment)) ?? null;
}

export interface ExerciseOverrides {
  sets?: number;
  reps?: string;
  rest?: number;
  warmup?: number;
  alt?: string;
}

/** A plan exercise from the library, alternative included; `o` overrides sets, reps, rest, warm-up or alt. */
export function libExercise(name: string, o: ExerciseOverrides = {}, allowed: string[] | null = null): PlanExercise {
  const e = LIBRARY.get(name);
  if (!e) throw new Error(`Unknown exercise: ${name}`);
  const ex: PlanExercise = {
    name, warmup: o.warmup ?? e.warmup, sets: o.sets ?? 3, repTarget: repLabel(o.reps || e.reps),
    weightTarget: libraryTarget(e), rest: o.rest ?? e.rest, cue: e.cue
  };
  const a = pickAlternative(e, o.alt || e.alt, allowed);
  if (a) ex.alt = { name: a.name, warmup: Math.min(a.warmup, ex.warmup ?? 0), sets: ex.sets, repTarget: repLabel(a.reps), weightTarget: libraryTarget(a), rest: a.rest, cue: a.cue };
  return ex;
}
