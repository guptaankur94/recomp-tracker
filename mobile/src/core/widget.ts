// What the home-screen widget shows: the next workout, this week against the plan, the streak and when you
// last trained. Worked out in the app and handed to the widget, which only draws it.
import { sessionDateStr, localDateStr, dateStrMs } from './format';
import { weekSummary } from './history';
import { isRestDay, nextScheduled, planSchedule, upNextDayIdx, WEEKDAY_NAMES } from './schedule';
import type { Plan, Session } from './types';

export interface WidgetSnapshot {
  /** "Full Body B" */
  nextTitle: string;
  /** "Today", "Rest day · next Wednesday", "Up next" */
  nextWhen: string;
  done: number;
  target: number;
  streak: number;
  /** "Today", "Yesterday", "3 days ago", or "" before the first workout */
  lastWorkout: string;
}

export function widgetSnapshot(plan: Plan, history: Session[], now: Date = new Date()): WidgetSnapshot {
  const days = plan.days;
  const schedule = planSchedule(plan, days.length);
  const week = weekSummary(history, days.length, schedule, now);
  const today = localDateStr(now);
  const trainedToday = history.some(s => sessionDateStr(s) === today);
  const rest = isRestDay(schedule, days.length, now);
  let nextIdx = upNextDayIdx(days, schedule, history, now);
  let nextWhen = schedule ? (trainedToday ? 'Up next' : 'Today') : 'Up next';
  if (rest || (schedule && trainedToday)) {
    const upcoming = nextScheduled(schedule, days.length, now);
    if (upcoming) {
      nextIdx = upcoming.dayIdx;
      nextWhen = `${rest && !trainedToday ? 'Rest day · next' : 'Next'} ${WEEKDAY_NAMES[upcoming.w]}`;
    }
  }
  const last = history[0];
  let lastWorkout = '';
  if (last) {
    const ago = Math.round((dateStrMs(today) - dateStrMs(sessionDateStr(last))) / 864e5);
    lastWorkout = ago <= 0 ? 'Today' : ago === 1 ? 'Yesterday' : `${ago} days ago`;
  }
  return { nextTitle: days[nextIdx]?.title ?? '', nextWhen, done: week.done, target: week.target, streak: week.streak, lastWorkout };
}
