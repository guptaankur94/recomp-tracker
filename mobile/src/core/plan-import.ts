// Reading a plan from a chatbot's file or reply, or from a backup.
import type { Plan, PlanDay, PlanExercise, PlanExerciseBase } from './types';

/** Chatbots often wrap JSON in ``` fences or add a sentence around it; pull out the JSON object. */
export function extractJson(text: string): unknown {
  let t = String(text).replace(/```(?:json)?/gi, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error("Couldn't find a plan in that. Upload the my-plan.json file from the chatbot, or paste its whole reply.");
  t = t.slice(start, end + 1);
  try {
    return JSON.parse(t);
  } catch {
    try {
      return JSON.parse(t.replace(/[“”]/g, '"'));
    } catch {
      throw new Error('The plan text is incomplete or has a formatting error. Ask the chatbot to "reply with only valid JSON" and try again.');
    }
  }
}

type Raw = Record<string, any>;

/** A plan in the app's format from anything plan-shaped (the AI format, a saved plan, or a bare list of days). Throws a message for the user. */
export function normalizePlan(data: unknown): Plan {
  const d0 = data as Raw;
  const rawDays = Array.isArray(data) ? data : (d0 && d0.days);
  if (!Array.isArray(rawDays) || !rawDays.length) throw new Error('The plan has no training days.');
  if (rawDays.length > 7) throw new Error(`The plan has ${rawDays.length} days; the maximum is 7.`);

  const text = (v: unknown) => (v === undefined || v === null) ? '' : String(v).trim();
  const int = (v: unknown, min: number, max: number, fallback: number) => {
    const n = parseInt(v as string, 10);
    return isNaN(n) ? fallback : Math.min(max, Math.max(min, n));
  };
  const exercise = (raw: Raw, where: string): PlanExerciseBase => {
    if (!raw || typeof raw !== 'object' || !text(raw.name)) throw new Error(`${where} is missing an exercise name.`);
    const reps = raw.reps ?? raw.repTarget;
    const ex: PlanExerciseBase = {
      name: text(raw.name),
      repTarget: typeof reps === 'number' ? `${reps} reps` : (text(reps) || '8–12 reps'),
      weightTarget: text(raw.weight ?? raw.weightTarget) || 'Moderate',
      rest: int(raw.rest ?? raw.restSec, 15, 600, 90),
      sets: int(raw.sets, 1, 10, 3)
    };
    if (text(raw.cue)) ex.cue = text(raw.cue);
    const warmup = raw.warmup ?? raw.warmupSets ?? raw.warmups;
    if (warmup !== undefined && warmup !== null && !Number.isNaN(parseInt(warmup, 10))) ex.warmup = int(warmup, 0, 3, 0);
    // The goal for the end of the program: { weight, reps } or text like "60 kg × 8" / "15 reps"
    const goal = raw.goal ?? raw.target;
    let gw = 0;
    let gr = 0;
    if (goal && typeof goal === 'object') {
      gw = parseFloat(goal.weight ?? goal.kg) || 0;
      gr = parseInt(goal.reps ?? goal.seconds, 10) || 0;
    } else if (typeof goal === 'string' || typeof goal === 'number') {
      const m = String(goal).match(/(\d+(?:\.\d+)?)\s*kg\s*[×x*]\s*(\d+)/i);
      if (m) { gw = parseFloat(m[1]); gr = parseInt(m[2], 10); } else gr = parseInt(String(goal), 10) || 0;
    }
    if (gr > 0 && gr <= 500 && gw >= 0 && gw <= 1000) ex.goal = gw > 0 ? { weight: Math.round(gw * 100) / 100, reps: gr } : { reps: gr };
    return ex;
  };

  const days: PlanDay[] = rawDays.map((d: Raw, i: number) => {
    const exercises = d && (d.exercises || d.workout);
    if (!Array.isArray(exercises) || !exercises.length) throw new Error(`Day ${i + 1} has no exercises.`);
    if (exercises.length > 15) throw new Error(`Day ${i + 1} has ${exercises.length} exercises; the maximum is 15.`);
    return {
      day: `Day ${i + 1}`,
      title: text(d.title || d.name || d.focus) || `Workout ${i + 1}`,
      exercises: exercises.map((raw: Raw, j: number) => {
        const ex: PlanExercise = exercise(raw, `Day ${i + 1}, exercise ${j + 1}`);
        if (raw.alt && typeof raw.alt === 'object' && text(raw.alt.name)) ex.alt = exercise(raw.alt, `Day ${i + 1}, exercise ${j + 1} (alt)`);
        return ex;
      })
    };
  });
  const plan: Plan = { planName: text(d0.planName || d0.name) || 'Custom Plan', days };
  if (Array.isArray(d0.schedule) && d0.schedule.length === 7) {
    plan.schedule = d0.schedule.map((v: unknown) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) < days.length ? v as number : null));
  }
  // A program already under way (kept through backups)
  const program = d0.program;
  if (program && Number.isInteger(program.weeks) && program.weeks >= 1 && program.weeks <= 52 && /^\d{4}-\d{2}-\d{2}$/.test(program.startDate || '')) {
    plan.program = { weeks: program.weeks, startDate: program.startDate };
  }
  return plan;
}

/** The stored plan when it has days, else null (the app then uses the first ready-made plan) */
export function validStoredPlan(plan: unknown): Plan | null {
  const p = plan as Plan | null;
  return p && Array.isArray(p.days) && p.days.length ? p : null;
}
