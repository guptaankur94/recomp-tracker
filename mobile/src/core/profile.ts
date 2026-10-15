// Profile and nutrition targets.
import type { ActivityLevel, BodyweightEntry, GoalType, Profile } from './types';

export const ACTIVITY_LEVELS: Record<ActivityLevel, { label: string; factor: number }> = {
  desk: { label: 'Desk job + training', factor: 1.45 },
  feet: { label: 'On my feet a lot + training', factor: 1.6 },
  physical: { label: 'Physical job + training', factor: 1.75 }
};

export const GOAL_TYPES: Record<GoalType, { label: string; calories: number; proteinPerKg: number }> = {
  recomp: { label: 'Body recomposition', calories: 0.93, proteinPerKg: 2.0 },
  lose: { label: 'Fat loss', calories: 0.8, proteinPerKg: 2.2 },
  gain: { label: 'Muscle gain', calories: 1.1, proteinPerKg: 1.8 }
};

export function calcAge(birthDate: string | undefined, now: Date = new Date()): number | null {
  if (!birthDate) return null;
  const b = new Date(`${birthDate}T00:00:00`);
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age > 0 && age < 120 ? age : null;
}

/** Age from the birth date or, when only an age was given at setup, that age */
export function profileAge(profile: Profile | null, now: Date = new Date()): number | null {
  return (profile && (calcAge(profile.birthDate, now) || profile.age)) || null;
}

/** The latest weigh-in (bodyweight oldest first), else the profile's weight */
export function currentWeightKg(profile: Profile | null, bodyweight: BodyweightEntry[]): number | null {
  return bodyweight.length ? bodyweight[bodyweight.length - 1].kg : (profile && profile.weightKg) || null;
}

export interface NutritionTargets {
  maintenance: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

/** Mifflin-St Jeor resting burn × activity, adjusted for the goal. Estimates, not prescriptions. */
export function nutritionTargets(profile: Profile, bodyweight: BodyweightEntry[], now: Date = new Date()): NutritionTargets | null {
  const weight = currentWeightKg(profile, bodyweight);
  const age = profileAge(profile, now);
  if (!profile.sex || !age || !profile.heightCm || !weight) return null;
  const bmr = 10 * weight + 6.25 * profile.heightCm - 5 * age + (profile.sex === 'male' ? 5 : -161);
  const maintenance = bmr * (ACTIVITY_LEVELS[profile.activity as ActivityLevel] || ACTIVITY_LEVELS.desk).factor;
  const goal = GOAL_TYPES[profile.goalType as GoalType] || GOAL_TYPES.recomp;
  const round = (n: number, step: number) => Math.round(n / step) * step;
  const calories = round(maintenance * goal.calories, 50);
  const protein = round(weight * goal.proteinPerKg, 5);
  const fat = round(weight * 0.9, 5);
  const carbs = Math.max(0, round((calories - protein * 4 - fat * 9) / 4, 5));
  return { maintenance: round(maintenance, 50), calories, protein, fat, carbs };
}
