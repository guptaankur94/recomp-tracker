/// <reference types="jest" />
// History grouping and the main-lift summaries, checked against the web app's rendering rules.
import { shortDate } from '../format';
import { dayColor, groupByWeek, sessionStats, startOfWeek, volumeChangePct } from '../history';
import { estOneRepMax } from '../records';
import { liftSummaries } from '../progress';
import { NOW, sampleHistory } from '../testing/fixtures';

const history = sampleHistory();
const now = new Date(NOW);

test('weeks are Monday to Sunday, newest first, with every session once', () => {
  const groups = groupByWeek(history, now, shortDate);
  expect(groups.flatMap(g => g.sessions)).toEqual(history);
  groups.forEach(g => {
    g.sessions.forEach(s => expect(startOfWeek(s.id).getTime()).toBe(g.key));
    expect(g.volume).toBeCloseTo(g.sessions.reduce((v, s) => v + sessionStats(s).volume, 0));
  });
  for (let i = 1; i < groups.length; i++) expect(groups[i].key).toBeLessThan(groups[i - 1].key);
  expect(groups.some(g => g.label === 'Last week')).toBe(true);
  expect(groups[groups.length - 1].label).toMatch(/^[A-Z][a-z]{2} \d+ – [A-Z][a-z]{2} \d+$/);
});

test('day colours cycle through seven and skip unnumbered days', () => {
  expect(dayColor('Day 1')).toBe(dayColor('Day 8'));
  expect(dayColor('Day 2')).not.toBe(dayColor('Day 1'));
  expect(dayColor('Custom')).toBeNull();
});

test('volume change compares with the previous session of the same day', () => {
  const s = history[0];
  const r = volumeChangePct(s, history);
  const prev = history.find(h => h.day === s.day && h.id < s.id)!;
  expect(r?.previous).toBe(prev);
  expect(r?.pct).toBe(Math.round((sessionStats(s).volume - sessionStats(prev).volume) / sessionStats(prev).volume * 100));
  expect(volumeChangePct(history[history.length - 1], history)).toBeNull();
});

test('main lifts: six most-logged, estimated 1RM trend, latest best set', () => {
  const lifts = liftSummaries(history);
  expect(lifts.length).toBeLessThanOrEqual(6);
  const counts = (name: string) => history.filter(s => s.exercises.some(e => e.name === name)).length;
  for (let i = 1; i < lifts.length; i++) expect(counts(lifts[i].name)).toBeLessThanOrEqual(counts(lifts[i - 1].name));
  const top = lifts[0];
  const sessions = history.filter(s => s.exercises.some(e => e.name === top.name)).reverse();
  expect(top.values).toHaveLength(sessions.length);
  const first = sessions[0].exercises.find(e => e.name === top.name)!.sets;
  expect(top.values[0]).toBeCloseTo(Math.max(...first.map(s => estOneRepMax(s.weight, s.reps))));
  expect(top.change).toBeCloseTo(top.values[top.values.length - 1] - top.values[0]);
});

test('bodyweight summary wording', () => {
  const { bodyweightSummary } = jest.requireActual('../progress');
  const days = (n: number, start: number, step: number) => Array.from({ length: n }, (_, i) => ({ dateStr: `2026-03-${String(i + 1).padStart(2, '0')}`, kg: Math.round((start + i * step) * 10) / 10 }));
  expect(bodyweightSummary([], null)).toMatchObject({ trend: null, rate: null, rateLabel: 'Need 1 week of data', goalLabel: 'Set a goal in your profile' });
  const losing = days(21, 85, -0.1);
  const s = bodyweightSummary(losing, 80, new Date(2026, 2, 21));
  expect(s.rate).toBeCloseTo(-0.7, 2); // dates are local, and clocks change in March
  expect(s.rateTone).toBe('good');
  expect(s.goalLabel).toMatch(/^~[A-Z][a-z]{2} \d+ at this rate$/);
  expect(bodyweightSummary(losing, 90).rateTone).toBe('bad');
  expect(bodyweightSummary(losing, null).rateLabel).toBe('Last 4 weeks');
  expect(bodyweightSummary(days(3, 80, 0), 80).goalLabel).toBe('At goal');
});

test('backup reminder matches the web app', () => {
  const { backupAgeDays, backupOverdue, backupStatus } = jest.requireActual('../backup');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { loadWebApp } = require('../../../scripts/web-app');
  const now = new Date(2026, 3, 15, 12).getTime();
  [null, now - 3600e3, now - 864e5, now - 13 * 864e5, now - 14 * 864e5, now - 90 * 864e5].forEach(last => [0, 2, 3, 40].forEach(n => {
    const store: Record<string, string> = { recomp_history: JSON.stringify(Array.from({ length: n }, (_, i) => ({ id: now - (i + 1) * 864e5, dateStr: '', day: 'Day 1', title: 'x', exercises: [] }))) };
    if (last) store.recomp_last_backup = String(last);
    const web = loadWebApp({ store, now });
    const age = backupAgeDays(last, now);
    expect(age).toBe(web.ctx.backupAgeDays());
    expect(backupOverdue(n, age)).toBe(web.ctx.backupOverdue());
    expect(backupAgeDays(now + 5000, now)).toBe(0);
    expect(backupStatus(n, age)).toBe(age === null ? (n ? 'Never backed up' : 'Nothing to back up yet') : age === 0 ? 'Last backup today' : `Last backup ${age} day${age === 1 ? '' : 's'} ago`);
  }));
});

test('week summary and weight change match the web app header', () => {
  const { weekSummary } = jest.requireActual('../history');
  const { weightChange } = jest.requireActual('../progress');
  const { templatePlan, TEMPLATES } = jest.requireActual('../templates');
  const { sampleBodyweight } = jest.requireActual('../testing/fixtures');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { loadWebApp } = require('../../../scripts/web-app');
  const bw = sampleBodyweight();
  [null, [0, null, 1, null, 2, null, null]].forEach(sched => [0, 5, 20].forEach(cut => [80, 90, null].forEach(goal => {
    const plan = { ...templatePlan(TEMPLATES[0]), ...(sched ? { schedule: sched } : { schedule: undefined }) };
    const hist = history.slice(cut);
    const entries = bw.slice(0, bw.length - cut);
    const hero = { id: 'hero', innerHTML: '' };
    const web = loadWebApp({
      store: { recomp_history: JSON.stringify(hist), recomp_bodyweight: JSON.stringify(entries), recomp_plan: JSON.stringify(plan), ...(goal ? { recomp_profile: JSON.stringify({ goalKg: goal }) } : {}) },
      now: NOW, fields: { hero }, stubs: { icon: () => '' }
    });
    web.run('loadActivePlan()');
    web.original('updateStats')();
    const html = hero.innerHTML;
    const s = weekSummary(hist, plan.days.length, sched, new Date(NOW));
    expect(html).toContain(`${s.done}<span>/${s.target}</span>`);
    expect(html).toContain(`<div class="hero-val">${s.streak}<small>wk</small>`);
    expect(html).toContain(`<div class="hero-val">${s.workouts}</div>`);
    const w = weightChange(entries, goal);
    const label = !w ? 'Log weight' : w.diff === null ? 'Weight' : w.diff === 0 ? '±0 · 7d' : `${w.diff > 0 ? '↑' : '↓'}${Math.abs(w.diff).toFixed(1).replace(/\.0$/, '')} · 7d`;
    expect(html).toContain(`<div class="hero-lbl ${w?.tone ?? ''}">${label}</div>`);
  })));
});
