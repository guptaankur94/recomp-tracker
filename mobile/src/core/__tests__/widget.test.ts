/// <reference types="jest" />
import { DEFAULT_PLAN } from '../templates';
import { NOW, sampleHistory } from '../testing/fixtures';
import { widgetSnapshot } from '../widget';

// NOW is Wednesday 15 April 2026, 6 p.m.
const plan = { planName: 'P', days: DEFAULT_PLAN };
const history = sampleHistory();

test('rotation: the next day in order, this week and the last workout', () => {
  const s = widgetSnapshot(plan, history, new Date(NOW));
  expect(s.nextWhen).toBe('Up next');
  expect(DEFAULT_PLAN.map(d => d.title)).toContain(s.nextTitle);
  expect(s.target).toBe(5);
  expect(s.lastWorkout).toMatch(/^(Today|Yesterday|\d+ days ago)$/);
});

test('schedule: today, then the next scheduled day once trained, and rest days', () => {
  const scheduled = { ...plan, schedule: [0, null, 1, null, 2, null, null] };
  // Wednesday is Day 2, nothing logged today yet
  const before = widgetSnapshot(scheduled, history.filter(s => s.id < new Date(2026, 3, 15).getTime()), new Date(NOW));
  expect(before).toMatchObject({ nextWhen: 'Today', nextTitle: DEFAULT_PLAN[1].title, target: 3 });
  // Trained today: Friday's workout is next
  const trained = [{ id: NOW - 3600e3, dateStr: '2026-04-15', displayDate: '', day: 'Day 2', title: 'x', exercises: [] }, ...history];
  expect(widgetSnapshot(scheduled, trained, new Date(NOW))).toMatchObject({ nextWhen: 'Next Friday', nextTitle: DEFAULT_PLAN[2].title, lastWorkout: 'Today' });
  // Thursday is a rest day
  expect(widgetSnapshot(scheduled, history, new Date(NOW + 864e5))).toMatchObject({ nextWhen: 'Rest day · next Friday', nextTitle: DEFAULT_PLAN[2].title });
});

test('a new user', () => {
  expect(widgetSnapshot(plan, [], new Date(NOW))).toEqual({ nextTitle: DEFAULT_PLAN[0].title, nextWhen: 'Up next', done: 0, target: 5, streak: 0, lastWorkout: '' });
});
