// Editing a plan: a working copy changed day by day and exercise by exercise, then checked and saved in one go.
// Same rules as the web app's plan editor.
import { defaultSchedule, WEEKDAY_NAMES } from './schedule';
import type { Plan, PlanDay, PlanExercise, PlanExerciseBase, Schedule } from './types';

/** A plan being edited: always has a 7-day schedule (all rest = rotate through the days in order) */
export interface EditablePlan {
  planName: string;
  days: PlanDay[];
  schedule: Schedule;
  templateId?: string;
  /** A program under way: editing the plan keeps it */
  program?: Plan['program'];
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export function editablePlan(plan: Plan): EditablePlan {
  const copy = clone(plan);
  return {
    planName: copy.planName,
    days: copy.days,
    schedule: Array.isArray(copy.schedule) && copy.schedule.length === 7 ? [...copy.schedule] : Array(7).fill(null),
    ...(copy.templateId ? { templateId: copy.templateId } : {}),
    ...(copy.program ? { program: copy.program } : {})
  };
}

/** "Build my own": empty days on the usual weekdays, named after them */
export function emptyPlan(dayCount: number): EditablePlan {
  const n = Math.min(7, Math.max(1, dayCount));
  const schedule = defaultSchedule(n);
  const weekdays = schedule.map((d, w) => (d === null ? -1 : w)).filter(w => w >= 0);
  return { planName: 'My Plan', schedule, days: weekdays.map((w, i) => ({ day: `Day ${i + 1}`, title: WEEKDAY_NAMES[w], exercises: [] })) };
}

/** An exercise for the plan from a picked one (library, another day or a new name) */
export function exerciseFromTemplate(t: Partial<PlanExercise> & { name: string }): PlanExercise {
  const ex: PlanExercise = {
    name: String(t.name).trim(),
    repTarget: t.repTarget || '8–12 reps',
    weightTarget: t.weightTarget || '2 reps in reserve',
    rest: t.rest || 90,
    sets: t.sets || 3
  };
  if (t.cue) ex.cue = t.cue;
  if (t.warmup !== undefined) ex.warmup = t.warmup;
  if (t.alt && typeof t.alt === 'object' && t.alt.name) {
    const alt: PlanExerciseBase = { name: t.alt.name, repTarget: t.alt.repTarget, weightTarget: t.alt.weightTarget, rest: t.alt.rest, sets: t.alt.sets };
    if (t.alt.warmup !== undefined) alt.warmup = t.alt.warmup;
    if (t.alt.cue) alt.cue = t.alt.cue;
    ex.alt = alt;
  }
  return ex;
}

/** "8-12" → "8–12 reps"; leaves holds, walks, failure and per-side wording alone */
export function normalizeReps(v: string): string {
  const t = String(v).trim().replace(/(\d)\s*-\s*(\d)/, '$1–$2');
  if (!t) return '8–12 reps';
  return /reps|hold|walk|failure|s\b|\/ /i.test(t) ? t : `${t} reps`;
}

function move<T>(list: T[], i: number, delta: number): T[] {
  const j = i + delta;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Swaps two days; each weekday keeps pointing at the same workout */
export function moveDay(plan: EditablePlan, i: number, delta: number): EditablePlan {
  const j = i + delta;
  if (j < 0 || j >= plan.days.length) return plan;
  return { ...plan, days: move(plan.days, i, delta), schedule: plan.schedule.map(v => (v === i ? j : v === j ? i : v)) };
}

export function moveExercise(plan: EditablePlan, dayIdx: number, i: number, delta: number): EditablePlan {
  return updateDay(plan, dayIdx, d => ({ ...d, exercises: move(d.exercises, i, delta) }));
}

export function addDay(plan: EditablePlan): EditablePlan {
  if (plan.days.length >= 7) return plan;
  return { ...plan, days: [...plan.days, { day: '', title: `Day ${plan.days.length + 1}`, exercises: [] }] };
}

/** Removes a day; weekdays that pointed at it become rest days and later days shift down */
export function deleteDay(plan: EditablePlan, idx: number): EditablePlan {
  return {
    ...plan,
    days: plan.days.filter((_, i) => i !== idx),
    schedule: plan.schedule.map(v => (v === idx ? null : v !== null && v > idx ? v - 1 : v))
  };
}

export function updateDay(plan: EditablePlan, dayIdx: number, fn: (d: PlanDay) => PlanDay): EditablePlan {
  return { ...plan, days: plan.days.map((d, i) => (i === dayIdx ? fn(clone(d)) : d)) };
}

export function updateExercise(plan: EditablePlan, dayIdx: number, exIdx: number, fn: (e: PlanExercise) => PlanExercise): EditablePlan {
  return updateDay(plan, dayIdx, d => ({ ...d, exercises: d.exercises.map((e, i) => (i === exIdx ? fn(e) : e)) }));
}

export function setWeekday(plan: EditablePlan, w: number, dayIdx: number | null): EditablePlan {
  const schedule = [...plan.schedule];
  schedule[w] = dayIdx;
  return { ...plan, schedule };
}

export type PlanCheck = { ok: true; plan: Plan } | { ok: false; message: string; dayIdx?: number };

/** Checks the plan and returns it in the stored format: days renumbered, names tidied, schedule only if one is set */
export function finishPlan(plan: EditablePlan): PlanCheck {
  if (!plan.days.length) return { ok: false, message: 'Add at least one day' };
  const empty = plan.days.findIndex(d => !d.exercises.length);
  if (empty !== -1) return { ok: false, message: `Day ${empty + 1} needs at least one exercise`, dayIdx: empty };
  const nameless = plan.days.findIndex(d => d.exercises.some(e => !String(e.name).trim()));
  if (nameless !== -1) return { ok: false, message: 'Every exercise needs a name', dayIdx: nameless };
  const days = plan.days.map((d, i) => ({ day: `Day ${i + 1}`, title: (d.title || '').trim() || `Day ${i + 1}`, exercises: d.exercises }));
  const schedule = plan.schedule.some(v => Number.isInteger(v)) ? plan.schedule : undefined;
  return { ok: true, plan: { planName: (plan.planName || '').trim() || 'My Plan', days, ...(schedule ? { schedule } : {}), ...(plan.program ? { program: plan.program } : {}) } };
}

/** Rough length of a day: sets × (rest + 40 s) plus a minute per warm-up set, to the nearest 5 minutes */
export function dayMinutes(day: PlanDay): number {
  const sec = day.exercises.reduce((t, ex) => t + (parseInt(String(ex.sets), 10) || 3) * ((parseInt(String(ex.rest), 10) || 90) + 40) + (parseInt(String(ex.warmup), 10) || 0) * 60, 0);
  return Math.max(10, Math.round(sec / 60 / 5) * 5);
}

function exerciseOut(ex: PlanExerciseBase) {
  const out: Record<string, unknown> = { name: ex.name, warmup: ex.warmup, sets: ex.sets, reps: ex.repTarget, weight: ex.weightTarget, rest: ex.rest };
  if (out.warmup === undefined) delete out.warmup;
  if (ex.goal) out.goal = ex.goal;
  if (ex.cue) out.cue = ex.cue;
  return out;
}

/** The plan in the friendly format the AI prompt asks for (to share or ask a chatbot to change) */
export function planToJson(plan: Plan): string {
  return JSON.stringify({
    planName: plan.planName,
    days: plan.days.map(d => ({
      title: d.title,
      exercises: d.exercises.map(ex => (ex.alt ? { ...exerciseOut(ex), alt: exerciseOut(ex.alt) } : exerciseOut(ex)))
    }))
  }, null, 2);
}

/** The message for asking a chatbot to change the current plan */
export function changePlanPrompt(plan: Plan): string {
  return `Here is my current workout plan. Please adjust it as I describe below and send the updated plan back as a downloadable file named my-plan.json in the same JSON format (if you can't create files, reply with only the JSON in one code block).\n\nMy changes: \n\n${planToJson(plan)}`;
}
