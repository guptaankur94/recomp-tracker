// Goals: each exercise's target for the end of the program, how close you are, and the program itself (e.g. 12
// weeks from a start date). An AI plan can give each exercise a goal; otherwise it's worked out from the plan's
// targets: the top of the weight range for the low end of the reps (all sets at the top weight). Same answers as
// the web app's js/goals.js.
import { fmtNum, localDateStr } from './format';
import { estOneRepMax } from './records';
import type { PlanExerciseBase, SavedSet } from './types';

export const PROGRAM_WEEKS = [8, 12, 16];

export interface Goal {
  kg: number;
  reps: number;
  unit: 'reps' | 'sec';
  fromPlan: boolean;
}

function rangeNumbers(text: string | undefined): number[] {
  return (String(text || '').match(/\d+(?:\.\d+)?/g) || []).map(Number);
}

/** The goal, or null when the plan has no number to aim for ("Moderate" on a machine: you set it yourself) */
export function exerciseGoal(ex: Pick<PlanExerciseBase, 'repTarget' | 'weightTarget' | 'goal'>): Goal | null {
  const timed = /\d\s*(s|sec|secs|seconds)\b/i.test(ex.repTarget || '');
  if (ex.goal && ex.goal.reps > 0) return { kg: ex.goal.weight && ex.goal.weight > 0 ? ex.goal.weight : 0, reps: ex.goal.reps, unit: timed ? 'sec' : 'reps', fromPlan: true };
  const reps = rangeNumbers(ex.repTarget);
  if (!reps.length) return null;
  const kgMatch = String(ex.weightTarget || '').match(/(\d+(?:\.\d+)?)(?:\s*[–-]\s*(\d+(?:\.\d+)?))?\s*kg/i);
  const kg = kgMatch ? Number(kgMatch[2] || kgMatch[1]) : 0;
  if (!kg && !timed && !/\bBW\b|bodyweight/i.test(ex.weightTarget || '')) return null;
  return { kg, reps: kg ? Math.min(...reps) : Math.max(...reps), unit: timed ? 'sec' : 'reps', fromPlan: false };
}

export function goalLabel(goal: Pick<Goal, 'kg' | 'reps' | 'unit'>): string {
  const amount = goal.unit === 'sec' ? `${goal.reps} s` : `${goal.reps}`;
  return goal.kg ? `${fmtNum(goal.kg)} kg × ${amount}` : goal.unit === 'sec' ? `${goal.reps} s hold` : `${goal.reps} reps`;
}

export interface GoalProgress {
  best: { weight: number; reps: number };
  pct: number;
  reached: boolean;
  toGo: string;
}

/** Where you are against the goal, from your best set last time (null before the first time) */
export function goalProgress(goal: Goal | null, last: { sets: Pick<SavedSet, 'weight' | 'reps'>[] } | null | undefined): GoalProgress | null {
  if (!goal || !last || !last.sets || !last.sets.length) return null;
  const best = last.sets.reduce((a, s) => (Number(s.weight) > Number(a.weight) || (Number(s.weight) === Number(a.weight) && Number(s.reps) > Number(a.reps)) ? s : a));
  const w = Number(best.weight) || 0;
  const r = Number(best.reps) || 0;
  let pct: number;
  let toGo = '';
  if (goal.kg) {
    pct = estOneRepMax(w, r) / estOneRepMax(goal.kg, goal.reps);
    if (w < goal.kg) toGo = `${fmtNum(Math.round((goal.kg - w) * 100) / 100)} kg to go`;
    else if (r < goal.reps) toGo = `${goal.reps - r} more rep${goal.reps - r === 1 ? '' : 's'} at ${fmtNum(goal.kg)} kg`;
  } else {
    pct = r / goal.reps;
    if (r < goal.reps) toGo = `${goal.reps - r} more ${goal.unit === 'sec' ? 's' : `rep${goal.reps - r === 1 ? '' : 's'}`}`;
  }
  const reached = goal.kg ? w >= goal.kg && r >= goal.reps : r >= goal.reps;
  return { best: { weight: w, reps: r }, pct: Math.max(0, Math.min(1, reached ? 1 : pct)), reached, toGo };
}

export interface ProgramStatus {
  week: number;
  weeks: number;
  endDate: string;
  ended: boolean;
}

export function programStatus(program: { weeks: number; startDate: string } | null | undefined, now: Date = new Date()): ProgramStatus | null {
  if (!program || !(program.weeks > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(program.startDate || '')) return null;
  const [y, m, d] = program.startDate.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today.getTime() - start.getTime()) / 864e5);
  const end = new Date(y, m - 1, d + program.weeks * 7 - 1);
  return { week: Math.max(1, Math.min(program.weeks, Math.floor(days / 7) + 1)), weeks: program.weeks, endDate: localDateStr(end), ended: days >= program.weeks * 7 };
}

/** A typed goal: "60 kg × 8", "60x8", "60 8", or just reps ("15") for bodyweight and timed moves */
export function parseGoalText(text: string): { weight?: number; reps: number } | null {
  const t = String(text || '').trim();
  const both = t.match(/^(\d+(?:\.\d+)?)\s*(?:kg)?\s*(?:[×x*]|\s)\s*(\d+)\s*(?:reps?|s|sec)?$/i);
  if (both) {
    const weight = Math.round(parseFloat(both[1]) * 100) / 100;
    const reps = parseInt(both[2], 10);
    return weight > 0 && weight <= 1000 && reps > 0 && reps <= 500 ? { weight, reps } : null;
  }
  const only = t.match(/^(\d+)\s*(?:reps?|s|sec|seconds)?$/i);
  return only && +only[1] > 0 && +only[1] <= 500 ? { reps: parseInt(only[1], 10) } : null;
}
