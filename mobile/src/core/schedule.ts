// Weekly schedule: a plan can pin its days to weekdays (Mon = 0 … Sun = 6); the others are rest days.
// Without a schedule the plan rotates through its days in order.
import { todaysSession } from './history';
import { mainDayLabel } from './workout';
import type { Plan, PlanDay, Schedule, Session } from './types';

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DEFAULT_WEEKDAYS: Record<number, number[]> = {
  1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6]
};

export function defaultSchedule(dayCount: number): Schedule {
  const schedule: Schedule = Array(7).fill(null);
  (DEFAULT_WEEKDAYS[dayCount] || []).forEach((w, i) => { schedule[w] = i; });
  return schedule;
}

export function weekdayIdx(date: Date = new Date()): number {
  return (date.getDay() + 6) % 7;
}

/** The plan's schedule when it is usable (7 entries, at least one valid day), else null */
export function planSchedule(plan: Pick<Plan, 'schedule'> | null, dayCount: number): Schedule | null {
  const s = plan && plan.schedule;
  return Array.isArray(s) && s.length === 7 && s.some(v => Number.isInteger(v) && (v as number) < dayCount) ? s : null;
}

export function scheduledDay(w: number, schedule: Schedule | null, dayCount: number): number | null {
  const v = schedule ? schedule[w] : null;
  return Number.isInteger(v) && (v as number) < dayCount ? (v as number) : null;
}

export function weekdaysFor(dayIdx: number, schedule: Schedule | null, dayCount: number): string[] {
  return schedule ? WEEKDAYS.filter((_, w) => scheduledDay(w, schedule, dayCount) === dayIdx) : [];
}

export function isRestDay(schedule: Schedule | null, dayCount: number, now: Date = new Date()): boolean {
  return !!schedule && scheduledDay(weekdayIdx(now), schedule, dayCount) === null;
}

/** The next scheduled training weekday after today */
export function nextScheduled(schedule: Schedule | null, dayCount: number, now: Date = new Date()): { w: number; dayIdx: number } | null {
  if (!schedule) return null;
  for (let k = 1; k <= 7; k++) {
    const w = (weekdayIdx(now) + k) % 7;
    const d = scheduledDay(w, schedule, dayCount);
    if (d !== null) return { w, dayIdx: d };
  }
  return null;
}

/** The plan day to train next. History must be newest first. */
export function upNextDayIdx(planDays: PlanDay[], schedule: Schedule | null, history: Session[], now: Date = new Date()): number {
  if (schedule) {
    // Today's planned day until today's workout is saved, then the next scheduled one
    const start = todaysSession(history, now) ? 1 : 0;
    for (let k = start; k < start + 7; k++) {
      const d = scheduledDay((weekdayIdx(now) + k) % 7, schedule, planDays.length);
      if (d !== null) return d;
    }
  }
  // Rotation: the day after the one most recently trained (custom workouts don't move it)
  const last = history.find(s => planDays.some(d => d.day === mainDayLabel(s)));
  if (!last) return 0;
  const idx = planDays.findIndex(d => d.day === mainDayLabel(last));
  return (idx + 1) % planDays.length;
}
