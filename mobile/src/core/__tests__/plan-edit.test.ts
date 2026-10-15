/// <reference types="jest" />
// Plan editing: the same results as the web app's editor for the same steps.
import {
  addDay, dayMinutes, deleteDay, editablePlan, emptyPlan, exerciseFromTemplate, finishPlan, moveDay, moveExercise,
  normalizeReps, planToJson, setWeekday, updateDay
} from '../plan-edit';
import { libExercise } from '../library';
import { DEFAULT_PLAN, templatePlan, TEMPLATES } from '../templates';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { loadWebApp } = require('../../../scripts/web-app');

const plain = (v: unknown) => JSON.parse(JSON.stringify(v));

function webEditor(plan: object) {
  const web = loadWebApp({ stubs: { closeSheet: () => {}, openSheet: () => {}, renderEditor: () => {}, editorGo: () => {} }, store: { recomp_plan: JSON.stringify(plan) } });
  web.run('loadActivePlan(); openPlanEditor({})');
  return web;
}

test('reps wording', () => {
  const web = loadWebApp();
  ['8-12', '8 - 12', ' 10 ', '', '30s hold', '12 / leg', 'Failure', '5', '6–8 reps', '40m walk'].forEach(v =>
    expect(normalizeReps(v)).toBe(web.ctx.normalizeReps(v)));
});

test('day lengths', () => {
  const web = loadWebApp();
  [DEFAULT_PLAN, ...TEMPLATES.map(t => templatePlan(t).days)].flat().forEach(d => expect(dayMinutes(d)).toBe(web.ctx.dayMinutes(d)));
});

test('moving and deleting days keeps the weekly schedule pointing at the same workouts', () => {
  const start = { planName: 'Mine', days: DEFAULT_PLAN, schedule: [0, 1, null, 2, 3, null, 4] };
  const steps: [string, (p: ReturnType<typeof editablePlan>) => ReturnType<typeof editablePlan>][] = [
    ['editorMoveDay(0, 1)', p => moveDay(p, 0, 1)],
    ['editorMoveDay(4, -1)', p => moveDay(p, 4, -1)],
    ['editorMoveDay(0, -1)', p => moveDay(p, 0, -1)],
    ['editor.plan.days.splice(2, 1); editor.plan.schedule = editor.plan.schedule.map(v => (v === 2 ? null : v !== null && v > 2 ? v - 1 : v))', p => deleteDay(p, 2)]
  ];
  const web = webEditor(start);
  let ours = editablePlan(start);
  steps.forEach(([code, fn]) => {
    web.run(code);
    ours = fn(ours);
    expect(plain(ours.days)).toEqual(plain(web.run('editor.plan.days')));
    expect(ours.schedule).toEqual(plain(web.run('editor.plan.schedule')));
  });
});

test('picked exercises become plan exercises the same way', () => {
  const web = loadWebApp();
  [libExercise('Barbell Bench Press'), { name: '  New Thing ' }, DEFAULT_PLAN[0].exercises[0], { name: 'X', alt: { name: 'Y', sets: 2, repTarget: '5 reps', weightTarget: 'x', rest: 60, cue: 'c', warmup: 1 }, warmup: 0 }]
    .forEach(t => expect(plain(exerciseFromTemplate(t as never))).toEqual(plain(web.ctx.exerciseFromTemplate(t))));
});

test('saving checks for empty days and nameless exercises, and tidies the plan', () => {
  let p = emptyPlan(3);
  expect(p.days.map(d => d.title)).toEqual(['Monday', 'Wednesday', 'Friday']);
  expect(finishPlan(p)).toEqual({ ok: false, message: 'Day 1 needs at least one exercise', dayIdx: 0 });
  p = [0, 1, 2].reduce((acc, i) => updateDay(acc, i, d => ({ ...d, exercises: [libExercise('Push-ups')] })), p);
  p = updateDay(p, 1, d => ({ ...d, title: '  ' }));
  const done = finishPlan({ ...p, planName: '  ' });
  expect(done.ok && done.plan.days.map(d => [d.day, d.title])).toEqual([['Day 1', 'Monday'], ['Day 2', 'Day 2'], ['Day 3', 'Friday']]);
  expect(done.ok && done.plan.planName).toBe('My Plan');
  const rotating = finishPlan({ ...p, schedule: Array(7).fill(null) });
  expect(rotating.ok && 'schedule' in rotating.plan).toBe(false);
  const nameless = updateDay(p, 2, d => ({ ...d, exercises: [{ ...d.exercises[0], name: ' ' }] }));
  expect(finishPlan(nameless)).toMatchObject({ ok: false, message: 'Every exercise needs a name' });
  expect(addDay(addDay(addDay(addDay(addDay(p))))).days).toHaveLength(7);
  expect(moveExercise(p, 0, 0, 1)).toEqual(p);
  expect(setWeekday(p, 6, 1).schedule[6]).toBe(1);
});

test('plan as a chatbot-friendly file', () => {
  const plan = { planName: 'P', days: DEFAULT_PLAN };
  const web = loadWebApp({ store: { recomp_plan: JSON.stringify(plan) } });
  web.run('loadActivePlan()');
  expect(planToJson(plan)).toBe(web.ctx.planToJson());
});
