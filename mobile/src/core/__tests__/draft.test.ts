/// <reference types="jest" />
// A workout in progress: saving must give exactly the history the web app gives for the same sets.
// Each draft is written into the web app's own storage keys and saved by its own code.
import {
  addExtra, addSet, completeSet, CUSTOM_DAY, dayExercises, emptyDraft, hasDraft, nextSetLabel, removeExtra, removeSet,
  saveDraft, setRest, touch, updateSets, withExerciseRest, withSetRest, type Draft
} from '../draft';
import { templatePlan, TEMPLATES, DEFAULT_PLAN } from '../templates';
import type { PlanDay, Session } from '../types';
import { NOW, rng, sampleHistory } from '../testing/fixtures';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { loadWebApp } = require('../../../scripts/web-app');

const plain = (v: unknown) => JSON.parse(JSON.stringify(v));

/** The draft as the web app stores it */
function webKeys(draft: Draft, d: number, day: PlanDay, swaps: Set<number>): Record<string, string> {
  const store: Record<string, string> = { [`active_d${d}_meta`]: JSON.stringify({ startedAt: draft.startedAt, lastEditAt: draft.lastEditAt }) };
  if (draft.extras.length) store[`custom_ex_d${d}`] = JSON.stringify(draft.extras.map(e => ({ ...e, isCustom: true })));
  swaps.forEach(i => { store[`swap_d${d}_e${i}`] = 'true'; });
  Object.entries(draft.exercises).forEach(([i, e]) => {
    if (e.rest) store[`active_d${d}_e${i}_rest`] = String(e.rest);
    if (!e.sets) return;
    store[`d${d}_e${i}_setcount`] = String(e.sets.length);
    e.sets.forEach((s, j) => {
      const k = (f: string) => `active_d${d}_e${i}_s${j + 1}_${f}`;
      store[k('w')] = s.w;
      store[k('r')] = s.r;
      store[k('done')] = String(s.done);
      if (s.rest) store[k('rest')] = String(s.rest);
      if (s.pr) store[k('pr')] = s.pr;
      if (s.drops) store[k('drops')] = JSON.stringify(s.drops);
    });
  });
  return store;
}

/** A draft with random sets on a day: typed, ticked, half-typed, drop sets, rest changes, an extra exercise */
function randomDraft(seed: number, day: PlanDay, startedAt: number, swaps: Set<number>): Draft {
  const rand = rng(seed);
  let draft = emptyDraft(startedAt);
  if (rand() < 0.5) draft = addExtra(draft, { name: rand() < 0.5 ? 'Cable Crunch' : day.exercises[0]?.name ?? 'Plank', sets: 2, repTarget: '10–15 reps', weightTarget: 'Custom', rest: 60, ...(rand() < 0.5 ? { fromDay: 'Day 3' } : {}) }, startedAt);
  const exercises = dayExercises(day, draft, swaps);
  exercises.forEach((ex, i) => {
    if (rand() < 0.2) return;
    if (rand() < 0.3) draft = withExerciseRest(draft, i, ex, 45 + Math.floor(rand() * 8) * 15, startedAt);
    if (rand() < 0.2) draft = addSet(draft, i, ex, startedAt);
    draft = updateSets(draft, i, ex, startedAt, sets => sets.map(() => {
      const kind = rand();
      return kind < 0.15 ? { w: '', r: '', done: false }
        : kind < 0.25 ? { w: '40', r: '', done: false }
          : {
            w: rand() < 0.1 ? '' : String(20 + Math.round(rand() * 20) * 2.5), r: String(5 + Math.floor(rand() * 8)), done: rand() < 0.85,
            ...(rand() < 0.2 ? { rest: 60 + Math.floor(rand() * 6) * 15 } : {}),
            ...(rand() < 0.15 ? { drops: [{ w: '20', r: '10' }, { w: '', r: rand() < 0.5 ? '6' : '' }] } : {}),
            ...(rand() < 0.1 ? { pr: 'weight' as const } : {})
          };
    }));
  });
  return draft;
}

describe('saving matches the web app', () => {
  const plans: PlanDay[][] = [DEFAULT_PLAN, templatePlan(TEMPLATES[0]).days];
  const cases: { name: string; history: Session[]; startedAt: number; now: number }[] = [
    { name: 'a new workout today', history: sampleHistory().filter(s => s.id < NOW - 2 * 864e5), startedAt: NOW - 3600e3, now: NOW },
    { name: "added to today's saved workout", history: sampleHistory(), startedAt: NOW - 1800e3, now: NOW },
    { name: 'started last night, saved this morning', history: sampleHistory(), startedAt: NOW - 14 * 3600e3, now: NOW - 3 * 3600e3 },
    { name: 'left open for days', history: sampleHistory(), startedAt: NOW - 3 * 864e5, now: NOW }
  ];
  // Today's saved workout, for the "added to" case
  cases[1].history = [{ id: NOW - 5 * 3600e3, dateStr: '2026-04-15', displayDate: '', day: 'Day 2', title: 'x', days: ['Day 2'], durationSec: 900, exercises: [{ name: 'Leg Press Machine', day: 'Day 2', sets: [{ set: 1, weight: 100, reps: 10, restSec: 120 }] }] }, ...cases[1].history];

  cases.forEach(c => plans.forEach((days, p) => {
    test(`${c.name} (plan ${p + 1})`, () => {
      for (let seed = 1; seed <= 12; seed++) {
        const custom = seed % 6 === 0;
        const d = custom ? days.length : seed % days.length;
        const day = custom ? CUSTOM_DAY : days[d];
        const swaps = new Set(seed % 3 === 0 ? [0, 2] : []);
        let draft = randomDraft(seed * 31 + p, day, c.startedAt, swaps);
        if (custom && !draft.extras.length) draft = addExtra(draft, { name: 'Goblet Squat', sets: 3, repTarget: '8–12 reps', weightTarget: 'Custom', rest: 90 }, c.startedAt);
        if (custom) draft = updateSets(draft, 0, { sets: 3 }, c.startedAt, s => [{ ...s[0], w: '24', r: '10', done: true }, ...s.slice(1)]);
        const exercises = dayExercises(day, draft, swaps);
        const ours = saveDraft({ draft, exercises, day, isCustom: custom, planDays: days, history: c.history, now: c.now });

        const web = loadWebApp({ store: { recomp_history: JSON.stringify(c.history), recomp_plan: JSON.stringify({ planName: 'P', days }), ...webKeys(draft, d, day, swaps) }, now: c.now });
        web.run('loadActivePlan()');
        const theirs = web.ctx.saveDayToLog(d);
        expect(plain(ours?.session ?? null)).toEqual(plain(theirs));
        expect(plain(ours ? ours.history : c.history)).toEqual(plain(web.ctx.getHistory()));
      }
    });
  }));
});

describe('ticking sets', () => {
  const history = sampleHistory();
  const day = DEFAULT_PLAN[0];
  const swaps = new Set<number>();

  test('empty fields take the suggestion; reps are needed', () => {
    const exercises = dayExercises(day, null, swaps);
    const done = completeSet(null, 0, 1, exercises[0], history, NOW);
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    const web = loadWebApp({ store: { recomp_history: JSON.stringify(history), recomp_plan: JSON.stringify({ planName: 'P', days: DEFAULT_PLAN }) }, now: NOW });
    web.run('loadActivePlan()');
    const sug = web.ctx.suggestSet(exercises[0], web.ctx.lastSetFor(web.ctx.getLastPerformance(exercises[0].name, web.ctx.getHistory()), 1));
    expect([done.w, done.r]).toEqual([sug.w, sug.r]);
    expect(done.firstCompletion).toBe(true);
    // No history for this name and no reps typed: nothing to fill in
    const fresh = completeSet(null, 0, 1, { ...exercises[0], name: 'Brand New Lift' }, history, NOW);
    expect(fresh.ok).toBe(false);
  });

  test('editing and re-ticking a set does not restart the rest timer; finishing the last set is reported', () => {
    const exercises = dayExercises(day, null, swaps);
    const ex = exercises[1];
    let draft: Draft | null = null;
    for (let s = 1; s <= ex.sets; s++) {
      draft = updateSets(draft, 1, ex, NOW, sets => { sets[s - 1] = { ...sets[s - 1], w: '30', r: '10' }; return sets; });
      const r = completeSet(draft, 1, s, ex, history, NOW);
      if (!r.ok) throw new Error('not ok');
      expect(r.finished).toBe(s === ex.sets);
      draft = r.draft;
    }
    draft = updateSets(draft, 1, ex, NOW, sets => { sets[0].done = false; return sets; });
    const again = completeSet(draft, 1, 1, ex, history, NOW);
    expect(again.ok && again.firstCompletion).toBe(false);
  });

  test('records match the web app, including against today\'s other sets', () => {
    const exercises = dayExercises(day, null, swaps);
    const ex = exercises[0];
    let draft: Draft | null = null;
    const store: Record<string, string> = { recomp_history: JSON.stringify(history), recomp_plan: JSON.stringify({ planName: 'P', days: DEFAULT_PLAN }) };
    [['70', '8'], ['72.5', '8'], ['72.5', '9'], ['60', '12']].forEach(([w, r], i) => {
      draft = updateSets(draft, 0, ex, NOW, sets => { while (sets.length <= i) sets.push({ w: '', r: '', done: false }); sets[i] = { ...sets[i], w, r }; return sets; });
      const ours = completeSet(draft, 0, i + 1, ex, history, NOW);
      if (!ours.ok) throw new Error('not ok');
      const web = loadWebApp({ store: { ...store, ...webKeys(draft!, 0, day, swaps) }, now: NOW });
      web.run('loadActivePlan(); currentDayIdx = 0');
      expect(ours.pr).toBe(web.ctx.detectPr(ex, 0, i + 1, parseFloat(w), parseInt(r, 10)));
      draft = ours.draft;
    });
  });

  test('next set label matches the web app', () => {
    const draft = randomDraft(5, day, NOW, swaps);
    const exercises = dayExercises(day, draft, swaps);
    const web = loadWebApp({ store: { recomp_history: JSON.stringify(history), recomp_plan: JSON.stringify({ planName: 'P', days: DEFAULT_PLAN }), ...webKeys(draft, 0, day, swaps) }, now: NOW });
    web.run('loadActivePlan(); currentDayIdx = 0');
    exercises.forEach((ex, i) => [1, 2, 3].forEach(s => expect(nextSetLabel(draft, exercises, i, s, history)).toBe(web.ctx.nextSetLabel(i, s))));
  });
});

describe('editing a draft', () => {
  const day = DEFAULT_PLAN[0];
  test('rest: per set, per exercise, and back to the plan', () => {
    const exercises = dayExercises(day, null, new Set());
    const ex = exercises[0];
    let draft = withSetRest(null, 0, 2, ex, 150, NOW);
    expect(setRest(draft, 0, 2, ex)).toBe(150);
    expect(setRest(draft, 0, 1, ex)).toBe(ex.rest);
    draft = withSetRest(draft, 0, 2, ex, ex.rest, NOW);
    expect(draft.exercises[0].sets![1].rest).toBeUndefined();
    draft = withSetRest(draft, 0, 3, ex, 75, NOW);
    draft = withExerciseRest(draft, 0, ex, 120, NOW);
    expect([1, 2, 3].map(s => setRest(draft, 0, s, ex))).toEqual([120, 120, 120]);
  });

  test('sets and extras can be added and removed', () => {
    const exercises = dayExercises(day, null, new Set());
    let draft: Draft | null = addSet(null, 1, exercises[1], NOW);
    expect(draft.exercises[1].sets).toHaveLength(exercises[1].sets + 1);
    draft = updateSets(draft, 1, exercises[1], NOW, s => { s[1].w = 'second'; return s; });
    draft = removeSet(draft, 1, 1, exercises[1], NOW);
    expect(draft!.exercises[1].sets![0].w).toBe('second');
    expect(removeSet(updateSets(null, 0, { sets: 1 }, NOW, s => s), 0, 1, { ...exercises[0], sets: 1 }, NOW)).toBeNull();

    const n = day.exercises.length;
    draft = addExtra(draft, { name: 'A', sets: 2, repTarget: '10 reps', weightTarget: 'x', rest: 60 }, NOW);
    draft = addExtra(draft, { name: 'B', sets: 2, repTarget: '10 reps', weightTarget: 'x', rest: 60 }, NOW);
    draft = updateSets(draft, n + 1, { sets: 2 }, NOW, s => { s[0].w = 'from B'; return s; });
    const { draft: after, swaps } = removeExtra(draft!, n, n, new Set([0, n + 1]), NOW);
    expect(after.extras.map(e => e.name)).toEqual(['B']);
    expect(after.exercises[n].sets![0].w).toBe('from B');
    expect([...swaps]).toEqual([0, n]);
  });

  test('what counts as a draft, and a stale draft starts over', () => {
    expect(hasDraft(null)).toBe(false);
    expect(hasDraft(updateSets(null, 0, { sets: 3 }, NOW, s => s))).toBe(false);
    expect(hasDraft(updateSets(null, 0, { sets: 3 }, NOW, s => { s[0].r = '5'; return s; }))).toBe(true);
    const old = emptyDraft(NOW - 13 * 3600e3);
    expect(touch(old, NOW).startedAt).toBe(NOW);
    expect(touch(emptyDraft(NOW - 3600e3), NOW).startedAt).toBe(NOW - 3600e3);
  });
});
