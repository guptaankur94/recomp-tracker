// Saved workouts: ordering, streaks, last performance and per-session stats.
import { sessionDateStr, localDateStr } from './format';
import { sessionDayLabels, setVolume } from './workout';
import type { PlanDay, Session } from './types';

/** Newest first, as every screen lists them */
export function sortHistory(history: unknown): Session[] {
  return Array.isArray(history) ? [...history].sort((a, b) => b.id - a.id) : [];
}

/** Monday 00:00 of the date's week */
export function startOfWeek(date: Date | number): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** Consecutive weeks (Mon–Sun) with at least one workout. The current week doesn't break the streak until it ends without one. */
export function calcWeekStreak(history: Session[], now: Date = new Date()): number {
  const weeks = new Set(history.map(s => startOfWeek(new Date(s.id)).getTime()));
  const cursor = startOfWeek(now);
  if (!weeks.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 7);
  let streak = 0;
  while (weeks.has(cursor.getTime())) {
    streak++;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

/** Most recent logged sets for an exercise (matched by name, across all days). History must be newest first. */
export function getLastPerformance(exName: string, history: Session[]) {
  for (const session of history) {
    const ex = session.exercises.find(e => e.name === exName);
    if (ex) return { session, sets: ex.sets };
  }
  return null;
}

export function todaysSession(history: Session[], now: Date = new Date()): Session | null {
  const today = localDateStr(now);
  return history.find(s => sessionDateStr(s) === today) || null;
}

export function sessionStats(session: Session) {
  let sets = 0;
  let volume = 0;
  let prs = 0;
  session.exercises.forEach(e => e.sets.forEach(s => {
    sets++;
    volume += setVolume(s);
    if (s.pr) prs++;
  }));
  return { sets, volume, prs, durationSec: session.durationSec || 0 };
}

/** The last session of the same day before this one (newest-first history) */
export function previousSameDay(session: Session, history: Session[]): Session | null {
  return history.find(s => s.day === session.day && s.id < session.id) || null;
}

/** Plan days done this week: at least half of the day's exercises logged since Monday */
export function daysDoneThisWeek(planDays: PlanDay[], history: Session[], now: Date = new Date()): Set<string> {
  const weekStart = startOfWeek(now).getTime();
  const logged: Record<string, Set<string>> = {};
  history.filter(s => s.id >= weekStart).forEach(s => s.exercises.forEach(e => {
    const d = e.day || sessionDayLabels(s)[0];
    (logged[d] = logged[d] || new Set()).add(e.name);
  }));
  const done = new Set<string>();
  planDays.forEach(d => {
    if (logged[d.day] && logged[d.day].size >= Math.ceil(d.exercises.length / 2)) done.add(d.day);
  });
  return done;
}
