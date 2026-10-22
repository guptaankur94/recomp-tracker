// Shapes of the app's data. Field names match what the web app saves, so existing backups load as-is.

export interface PlanExerciseBase {
  name: string;
  /** Light ramp-up sets before the working sets (0–3); missing in older or imported plans. */
  warmup?: number;
  sets: number;
  repTarget: string;
  weightTarget: string;
  /** Rest between sets, in seconds. */
  rest: number;
  cue?: string;
}

export interface PlanExercise extends PlanExerciseBase {
  /** A swap that uses different equipment, tuned for the same effort. */
  alt?: PlanExerciseBase;
}

export interface PlanDay {
  /** "Day 1", "Day 2"… (or "Custom" for a one-off workout) */
  day: string;
  title: string;
  exercises: PlanExercise[];
}

/** Mon = 0 … Sun = 6; each entry is a plan day index, or null for a rest day. */
export type Schedule = (number | null)[];

export interface Plan {
  planName: string;
  templateId?: string;
  days: PlanDay[];
  schedule?: Schedule;
}

export type PrType = 'weight' | 'e1rm' | 'reps' | 'rest';

export interface DropSet {
  weight: number;
  reps: number;
}

export interface SavedSet {
  set: number;
  weight: number;
  reps: number;
  /** Missing on sets logged before rest was recorded. */
  restSec?: number;
  drops?: DropSet[];
  pr?: PrType;
}

export interface SavedExercise {
  name: string;
  /** The plan day it came from; missing on older logs (the session's day applies). */
  day?: string;
  sets: SavedSet[];
}

export interface Session {
  /** Creation time in ms; also the session's identity. */
  id: number;
  dateStr: string;
  displayDate: string;
  day: string;
  title: string;
  days?: string[];
  exercises: SavedExercise[];
  durationSec?: number;
  /** Calories burned, typed from a fitness watch (whole kcal) */
  calories?: number;
  updatedAt?: number;
}

export interface BodyweightEntry {
  dateStr: string;
  kg: number;
}

export type Sex = 'male' | 'female' | '';
export type ActivityLevel = 'desk' | 'feet' | 'physical';
export type GoalType = 'recomp' | 'lose' | 'gain';

export interface Profile {
  name?: string;
  sex?: Sex;
  birthDate?: string;
  /** Given at setup when there's no birth date. */
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  goalKg?: number | null;
  activity?: ActivityLevel;
  goalType?: GoalType;
}
