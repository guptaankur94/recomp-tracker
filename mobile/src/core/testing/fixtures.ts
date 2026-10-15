// Deterministic sample data: ten weeks of training on the creator's plan, plus weigh-ins.
import { DEFAULT_PLAN } from '../templates';
import { localDateStr } from '../format';
import type { BodyweightEntry, Session } from '../types';

/** Small seeded random numbers, so every run sees the same data */
export function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Wednesday 15 April 2026, 6 p.m. local time */
export const NOW = new Date(2026, 3, 15, 18, 0).getTime();

export function sampleHistory(seed = 1): Session[] {
  const rand = rng(seed);
  const sessions: Session[] = [];
  let t = new Date(2026, 1, 2, 7, 30).getTime();
  let dayIdx = 0;
  while (t < NOW - 864e5) {
    const day = DEFAULT_PLAN[dayIdx % DEFAULT_PLAN.length];
    const week = sessions.length / 4;
    const exercises = day.exercises.slice(0, 3 + Math.floor(rand() * 3)).map(ex => ({
      name: rand() < 0.15 && ex.alt ? ex.alt.name : ex.name,
      day: rand() < 0.1 ? 'Day 2' : day.day,
      sets: Array.from({ length: 2 + Math.floor(rand() * 3) }, (_, i) => {
        const set: Session['exercises'][0]['sets'][0] = {
          set: i + 1,
          weight: rand() < 0.08 ? 0 : 20 + Math.round((week * 1.25 + rand() * 10) / 2.5) * 2.5,
          reps: 6 + Math.floor(rand() * 7),
          restSec: rand() < 0.1 ? undefined : 60 + Math.floor(rand() * 9) * 15
        };
        if (rand() < 0.1) set.drops = [{ weight: set.weight - 5, reps: 8 }];
        if (rand() < 0.08) set.pr = 'reps';
        if (set.restSec === undefined) delete set.restSec;
        return set;
      })
    }));
    sessions.push({
      id: t, dateStr: localDateStr(new Date(t)), displayDate: '', day: day.day, title: day.title, exercises,
      ...(rand() < 0.7 ? { durationSec: 2400 + Math.floor(rand() * 2400) } : {})
    });
    dayIdx += rand() < 0.85 ? 1 : 2;
    // Mostly every 1–2 days, sometimes late at night, sometimes a week off
    t += (rand() < 0.05 ? 7 : 1 + Math.floor(rand() * 2)) * 864e5 + Math.floor((rand() - 0.5) * 6) * 3600e3;
  }
  return sessions.sort((a, b) => b.id - a.id);
}

export function sampleBodyweight(seed = 2): BodyweightEntry[] {
  const rand = rng(seed);
  const out: BodyweightEntry[] = [];
  for (let d = 0; d < 70; d++) {
    if (rand() < 0.45) continue;
    out.push({ dateStr: localDateStr(new Date(2026, 1, 4 + d)), kg: Math.round((82 - d * 0.04 + (rand() - 0.5) * 2) * 10) / 10 });
  }
  return out;
}
