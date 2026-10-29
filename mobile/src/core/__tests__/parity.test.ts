/// <reference types="jest" />
// The new core must give the same answers as today's web app. Each test runs the web app's own code
// (../js, loaded by scripts/web-app.js) on the same inputs and compares.
import { buildAiPrompt } from '../ai-prompt';
import { restoreBackup, restoreMessage } from '../backup';
import { fmtClock, fmtDuration, fmtNum, fmtVolume } from '../format';
import { calcWeekStreak, daysDoneThisWeek, sessionStats } from '../history';
import { LIBRARY, MUSCLES } from '../library';
import { extractJson, normalizePlan } from '../plan-import';
import { calcAge, nutritionTargets } from '../profile';
import { exerciseSessions, markRecords, METRICS, movingAverage, weeklyRate, type MetricKey } from '../progress';
import { detectPr } from '../records';
import { nextScheduled, planSchedule, upNextDayIdx, weekdaysFor } from '../schedule';
import { creatorPlanDays, DEFAULT_PLAN, pickForFilter, recommendTemplate, templatePlan, TEMPLATES, TEMPLATE_TYPES } from '../templates';
import type { BodyweightEntry, Plan, PlanDay, PlanExercise, Profile, Session } from '../types';
import {
  applySessionDays, avgRest, mainDayLabel, progressionTip, restChoices, restDelta, roundRest, shortDayTitle,
  suggestSet, warmupSets
} from '../workout';
import { NOW, sampleBodyweight, sampleHistory } from '../testing/fixtures';
import { parseWarmupRows } from '../warmups';
import { EFFORT_LEVELS, effortLabel } from '../effort';
import { exerciseGoal, goalLabel, goalProgress, parseGoalText, programStatus } from '../goals';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { loadWebApp } = require('../../../scripts/web-app');

/** Compare across the sandbox boundary: plain JSON on both sides */
const plain = (v: unknown) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v, (_, x) => (Object.prototype.toString.call(x) === '[object Set]' ? [...x].sort() : x))));
const same = (ours: unknown, theirs: unknown) => expect(plain(ours)).toEqual(plain(theirs));

const history = sampleHistory();
const bodyweight = sampleBodyweight();
const allPlans: PlanDay[][] = [DEFAULT_PLAN, creatorPlanDays(), ...TEMPLATES.map(t => templatePlan(t).days)];
const allExercises: PlanExercise[] = allPlans.flatMap(days => days.flatMap(d => d.exercises.flatMap(e => (e.alt ? [e, { ...e.alt }] : [e]))));

function webWith({ plan, hist = history, bw = bodyweight, profile, now = NOW, extra = {} }: {
  plan?: Plan | null; hist?: Session[]; bw?: BodyweightEntry[]; profile?: Profile | null; now?: number; extra?: Record<string, string>;
} = {}) {
  const store: Record<string, string> = { recomp_history: JSON.stringify(hist), recomp_bodyweight: JSON.stringify(bw), ...extra };
  if (plan) store.recomp_plan = JSON.stringify(plan);
  if (profile) store.recomp_profile = JSON.stringify(profile);
  const web = loadWebApp({ store, now });
  web.run('loadActivePlan()');
  return web;
}

describe('data exported from the web app', () => {
  const web = webWith();
  test('exercise library', () => {
    same([...LIBRARY.values()], [...web.get('LIBRARY').values()]);
    same(MUSCLES, web.get('MUSCLES'));
  });
  test('every ready-made plan builds the same', () => {
    TEMPLATES.forEach(t => same(templatePlan(t), web.ctx.templatePlan(web.ctx.templateById(t.id))));
    same(TEMPLATE_TYPES, web.get('TEMPLATE_TYPES'));
  });
  test('template picking', () => {
    for (const days of [1, 2, 3, 4, 5, 6, 7]) for (const equipment of ['gym', 'dumbbells', 'bodyweight'] as const) for (const level of ['Beginner', 'Intermediate']) {
      expect(recommendTemplate({ days, equipment, level })).toBe(web.ctx.recommendTemplate({ days, equipment, level }));
    }
    TEMPLATES.forEach(t => TEMPLATE_TYPES.forEach(([type]) => ['full-body-3', 'ppl-6', 'nope'].forEach(rec =>
      expect(pickForFilter(t.id, type, rec)).toBe(web.ctx.pickForFilter(t.id, type, rec)))));
  });
});

describe('workout logic', () => {
  const web = webWith({ plan: { planName: 'Mine', days: DEFAULT_PLAN } });
  test('warm-up ramps for every exercise in every plan', () => {
    const lastSets = [null, { set: 1, weight: 0, reps: 10 }, { set: 1, weight: 22.5, reps: 12 }, { set: 1, weight: 60, reps: 8 }, { set: 1, weight: 140, reps: 5 }];
    allExercises.forEach((ex, i) => [0, 1, 4].forEach(exIdx => [0, 12.5, 37.5, 100].forEach(typed => lastSets.forEach(last => {
      const suggestion = suggestSet(ex, last);
      web.store[`active_d0_e${exIdx}_s1_w`] = typed ? String(typed) : '';
      same(warmupSets(ex, exIdx, typed, suggestion), web.ctx.warmupSets(ex, exIdx, web.ctx.suggestSet(ex, last)));
    }))));
  });
  test('your own warm-ups, and the editor\'s checks', () => {
    const own = [{ kg: 20, reps: 10 }, { reps: 8 }, { kg: 42.5, reps: 3 }];
    const w = webWith({ plan: { planName: 'Mine', days: DEFAULT_PLAN }, extra: { recomp_warmups: JSON.stringify({ [allExercises[0].name]: own, [allExercises[1].name]: [] }) } });
    same(warmupSets(allExercises[0], 0, 0, null, own), w.ctx.warmupSets(allExercises[0], 0, null));
    same(warmupSets(allExercises[1], 0, 0, null, []), w.ctx.warmupSets(allExercises[1], 0, null));
    const rows = [
      [{ kg: '20', reps: '10' }, { kg: '', reps: '8' }, { kg: '', reps: '' }], [{ kg: '20', reps: '0' }], [{ kg: '600', reps: '5' }],
      [{ kg: '-5', reps: '5' }], [{ kg: '12.345', reps: '6.7' }], [{ kg: 'abc', reps: '5' }], []
    ];
    rows.forEach(r => same(parseWarmupRows(r), w.ctx.parseWarmupRows(r)));
  });
  test('goals: from the plan, how close you are, the program week, typed goals', () => {
    const lasts = [null, { sets: [{ weight: 0, reps: 12 }] }, { sets: [{ weight: 20, reps: 10 }, { weight: 22.5, reps: 8 }] }, { sets: [{ weight: 45, reps: 8 }] }, { sets: [{ weight: 60, reps: 12 }] }, { sets: [{ weight: 140, reps: 3 }] }];
    const withGoals = [...allExercises, { ...allExercises[0], goal: { weight: 60, reps: 8 } }, { ...allExercises[0], repTarget: '30–45s hold', weightTarget: 'Bodyweight', goal: { reps: 90 } }, { ...allExercises[0], weightTarget: 'Moderate' }, { ...allExercises[0], repTarget: 'Failure' }];
    withGoals.forEach(ex => {
      const g = exerciseGoal(ex);
      same(g, web.ctx.exerciseGoal(ex));
      if (g) expect(goalLabel(g)).toBe(web.ctx.goalLabel(g));
      lasts.forEach(last => same(goalProgress(g, last), web.ctx.goalProgress(g, last)));
    });
    for (let back = -3; back < 120; back += 4) {
      const start = new Date(2026, 9, 28 - back);
      const program = { weeks: back % 3 ? 12 : 8, startDate: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}` };
      same(programStatus(program, new Date(2026, 9, 28, 18)), web.ctx.programStatus(program, new Date(2026, 9, 28, 18)));
    }
    same(programStatus(null), web.ctx.programStatus(null));
    ['60 kg × 8', '60x8', '60 8', '62.5 kg x 6', '15', '90 s', 'abc', '0 x 5', '60 kg', '2000 x 5', ' 40 X 12 reps '].forEach(t => same(parseGoalText(t), web.ctx.parseGoalText(t)));
  });
  test('effort levels and their names', () => {
    same(EFFORT_LEVELS, web.get('EFFORT_LEVELS'));
    [undefined, null, 0, -1, 1, 3, 4, 5, 6, 7, 8, 8.5, 9, 10, 12].forEach(v => expect(effortLabel(v as number)).toBe(web.ctx.effortLabel(v)));
  });
  test('suggestions and progression tips', () => {
    allExercises.forEach(ex => [0, 10, 25, 52.5].forEach(weight => [1, 5, 8, 10, 12, 15, 20].forEach(reps => [0, 30, 45, 90, 137].forEach(rest => {
      const last = { set: 1, weight, reps, restSec: rest };
      same(suggestSet(ex, last), web.ctx.suggestSet(ex, last));
      expect(progressionTip(ex, last, rest)).toBe(web.ctx.progressionTip(ex, last, rest));
    }))));
  });
  test('rest helpers and formatting', () => {
    for (let s = -20; s < 800; s += 7) {
      expect(fmtClock(s)).toBe(web.ctx.fmtClock(s));
      expect(roundRest(s)).toBe(web.ctx.roundRest(s));
      expect(restDelta(s, 90)).toBe(web.ctx.restDelta(s, 90));
      expect(fmtDuration(s * 13)).toBe(web.ctx.fmtDuration(s * 13));
      expect(fmtVolume(s * 31.7)).toBe(web.ctx.fmtVolume(s * 31.7));
      expect(fmtNum(s / 3)).toBe(web.ctx.fmtNum(s / 3));
    }
    allExercises.slice(0, 20).forEach(ex => [60, 95, 120].forEach(cur => [0, 90, 150].forEach(last =>
      same(restChoices(ex, cur, last, [42]), web.ctx.restChoices(ex, cur, last, [42])))));
    history.forEach(s => s.exercises.forEach(e => expect(avgRest(e.sets)).toBe(web.ctx.avgRest(e.sets))));
  });
  test('day names and session labels', () => {
    allPlans.flat().forEach(d => expect(shortDayTitle(d.title)).toBe(web.ctx.shortDayTitle(d.title)));
    ['Push – Chest, Shoulders & Triceps', 'Legs - Quads', 'A really long single-word-ish title here'].forEach(t =>
      expect(shortDayTitle(t)).toBe(web.ctx.shortDayTitle(t)));
    history.forEach(s => {
      expect(mainDayLabel(s)).toBe(web.ctx.mainDayLabel(s));
      const copy = plain(s);
      web.ctx.applySessionDays(copy);
      same(applySessionDays(s, DEFAULT_PLAN), copy);
    });
  });
});

describe('records', () => {
  test('every set of recent sessions, against the history before it', () => {
    history.slice(0, 12).forEach((session, k) => {
      const before = history.slice(k + 1);
      session.exercises.forEach((ex, exIdx) => {
        const planEx = { name: ex.name, sets: ex.sets.length, rest: 90 };
        // Today's draft: every set of this exercise ticked done, as the web app stores it
        const extra: Record<string, string> = { [`d0_e${exIdx}_setcount`]: String(ex.sets.length) };
        ex.sets.forEach((s, i) => {
          extra[`active_d0_e${exIdx}_s${i + 1}_w`] = String(s.weight);
          extra[`active_d0_e${exIdx}_s${i + 1}_r`] = String(s.reps);
          extra[`active_d0_e${exIdx}_s${i + 1}_done`] = 'true';
          if (s.restSec) extra[`active_d0_e${exIdx}_s${i + 1}_rest`] = String(s.restSec);
        });
        const web = webWith({ hist: before, extra });
        ex.sets.forEach((s, i) => {
          const rest = s.restSec || 90;
          const otherSets = ex.sets.filter((_, j) => j !== i).map(x => ({ w: x.weight, r: x.reps, rest: x.restSec || 90 }));
          expect(detectPr({ name: ex.name, history: before, otherSets, w: s.weight, r: s.reps, rest }))
            .toBe(web.ctx.detectPr(planEx, exIdx, i + 1, s.weight, s.reps));
        });
      });
    });
  });
});

describe('history, schedule and streaks', () => {
  const plans: (Plan | null)[] = [
    null,
    { planName: 'Mine', days: DEFAULT_PLAN },
    { planName: 'Mine', days: DEFAULT_PLAN, schedule: [0, null, 1, 2, null, 3, 4] },
    { planName: 'Mine', days: DEFAULT_PLAN, schedule: [null, null, null, null, null, null, 9] },
    templatePlan(TEMPLATES[0])
  ];
  test('up next, next scheduled day, weekdays and done this week, on every day of a fortnight', () => {
    plans.forEach(plan => [history, history.slice(5), []].forEach(hist => {
      for (let d = 0; d < 14; d++) {
        const now = NOW + d * 864e5 - 9 * 3600e3;
        const web = webWith({ plan, hist, now });
        const days: PlanDay[] = plan ? plan.days : templatePlan(TEMPLATES[0]).days;
        const sched = planSchedule(plan, days.length);
        const at = new Date(now);
        expect(upNextDayIdx(days, sched, hist, at)).toBe(web.ctx.upNextDayIdx());
        same(nextScheduled(sched, days.length, at), web.ctx.nextScheduled());
        days.forEach((_, i) => same(weekdaysFor(i, sched, days.length), web.ctx.weekdaysFor(i)));
        same(daysDoneThisWeek(days, hist, at), web.ctx.daysDoneThisWeek());
        expect(calcWeekStreak(hist, at)).toBe(web.ctx.calcWeekStreak(web.ctx.getHistory()));
      }
    }));
  });
  test('session stats', () => {
    const web = webWith();
    history.forEach(s => same(sessionStats(s), web.ctx.sessionStats(s)));
  });
});

describe('progress', () => {
  const web = webWith();
  test('bodyweight trend and weekly rate', () => {
    same(movingAverage(bodyweight), web.ctx.movingAverage(bodyweight));
    for (let n = 0; n <= bodyweight.length; n += 3) {
      const part = bodyweight.slice(0, n);
      expect(weeklyRate(part)).toBe(web.ctx.weeklyRate(part));
    }
  });
  test('exercise charts on every metric', () => {
    const names = [...new Set(history.flatMap(s => s.exercises.map(e => e.name)))];
    const metrics = web.get('METRICS');
    names.forEach(name => (Object.keys(METRICS) as MetricKey[]).forEach(key => {
      const rows = exerciseSessions(name, history);
      same(rows, web.ctx.exerciseSessions(name, history));
      const points = rows.map(r => ({ x: r.session.id, y: METRICS[key].calc(r.ex.sets) as number, pr: r.ex.sets.some(s => s.pr) })).filter(p => p.y != null);
      const theirs = rows.map(r => ({ x: r.session.id, y: metrics[key].calc(r.ex.sets), pr: r.ex.sets.some(s => s.pr) })).filter(p => p.y != null);
      same(markRecords(points, METRICS[key].lowerBetter), web.ctx.markRecords(theirs, metrics[key].lowerBetter));
    }));
  });
});

describe('profile', () => {
  test('nutrition targets', () => {
    const profiles: Profile[] = [];
    for (const sex of ['male', 'female', ''] as const) for (const activity of ['desk', 'feet', 'physical', undefined] as const) for (const goalType of ['recomp', 'lose', 'gain', undefined] as const) {
      profiles.push({ sex, activity, goalType, birthDate: '1990-04-16', heightCm: 178, weightKg: 80 });
      profiles.push({ sex, activity, goalType, age: 52, heightCm: 160, weightKg: 61.5 });
    }
    profiles.push({ sex: 'male', heightCm: 180 }, { sex: 'female', birthDate: '2000-04-15', heightCm: 165, weightKg: 58 });
    profiles.forEach(p => [bodyweight, []].forEach(bw => {
      const web = webWith({ bw, profile: p });
      same(nutritionTargets(p, bw, new Date(NOW)), web.ctx.nutritionTargets(p));
      expect(calcAge(p.birthDate, new Date(NOW))).toBe(web.ctx.calcAge(p.birthDate));
    }));
  });
});

describe('plans from a chatbot', () => {
  const web = webWith();
  const outcome = (fn: () => unknown) => {
    try { return { ok: plain(fn()) }; } catch (e) { return { error: (e as Error).message }; }
  };
  const replies = [
    'Here you go:\n```json\n{"planName":"Push Pull","days":[{"title":"Push","exercises":[{"name":"Bench","sets":4,"reps":8,"weight":"60 kg","rest":"120","warmup":"2","alt":{"name":"DB Bench"}}]}]}\n```\nEnjoy!',
    '{“planName”: “Curly”, “days”: [{“name”: “A”, “workout”: [{“name”: “Squat”, “restSec”: 999, “sets”: 0, “warmups”: 7}]}]}',
    '{"days":[{"focus":"Legs","exercises":[{"name":" Leg Press ","repTarget":"10–12 reps","weightTarget":"Heavy","cue":" Slow "}]}],"schedule":[0,null,0,5,"x",0,null]}',
    '[{"title":"Only days","exercises":[{"name":"Row"}]}]',
    'no json here', '{"days": [}', '{"days": []}', '{"days":[{"title":"Empty","exercises":[]}]}',
    '{"days":[{"exercises":[{"sets":3}]}]}',
    JSON.stringify({ days: Array.from({ length: 8 }, () => ({ exercises: [{ name: 'X' }] })) }),
    JSON.stringify({ days: [{ exercises: Array.from({ length: 16 }, () => ({ name: 'X' })) }] }),
    JSON.stringify(templatePlan(TEMPLATES[3])),
    // Goals in every shape, and a program under way (or a broken one)
    JSON.stringify({ planName: 'G', program: { weeks: 12, startDate: '2026-10-01' }, days: [{ title: 'A', exercises: [
      { name: 'Bench', reps: '8–10 reps', weight: '40–50 kg', goal: { weight: 60, reps: 8 }, alt: { name: 'DB Bench', goal: '22.5 kg × 10' } },
      { name: 'Squat', goal: '80 kg x 5' }, { name: 'Plank', reps: '30–45s hold', goal: { reps: 90 } }, { name: 'Curl', goal: 'junk' },
      { name: 'Dip', goal: 15 }, { name: 'Row', goal: { weight: -5, reps: 8 } }, { name: 'Press', goal: { weight: 2000, reps: 5 } }] }] }),
    JSON.stringify({ program: { weeks: 99, startDate: '2026-10-01' }, days: [{ exercises: [{ name: 'X' }] }] }),
    JSON.stringify({ program: { weeks: 12, startDate: 'soon' }, days: [{ exercises: [{ name: 'X' }] }] })
  ];
  test('read the same way, with the same messages', () => {
    replies.forEach(text => same(outcome(() => normalizePlan(extractJson(text))), outcome(() => web.ctx.normalizePlan(web.ctx.extractJson(text)))));
  });
  test('the prompt', () => {
    const inputs = [
      { sex: 'male', age: '34', height: '180', weight: '82', goal: 'recomp', days: '4', level: 'Intermediate', equipment: '', notes: 'Bad left knee' },
      { sex: '', age: '', height: '', weight: '', goal: 'strength', days: '3', level: 'Beginner', equipment: 'Home gym with a rack', notes: '' }
    ];
    const profiles: (Profile | null)[] = [null, { goalKg: 75, activity: 'feet' }];
    inputs.forEach(input => profiles.forEach(profile => {
      const fields: Record<string, { value: string }> = {};
      Object.entries(input).forEach(([k, v]) => { fields[`ai-${k}`] = { value: v }; });
      const store: Record<string, string> = profile ? { recomp_profile: JSON.stringify(profile) } : {};
      const w = loadWebApp({ store, now: NOW, fields });
      expect(buildAiPrompt({ ...input, goalKg: profile?.goalKg, activity: profile?.activity })).toBe(w.ctx.buildAiPrompt());
    }));
  });
});

describe('backups', () => {
  test('restore merges the same way as the web app', () => {
    const mine = { 'Barbell Bench Press': [{ kg: 20, reps: 10 }] };
    const current = { history: history.slice(0, 10), bodyweight: bodyweight.slice(0, 5), profile: null, plan: null, warmups: mine };
    const backups = [
      JSON.stringify({ app: 'recomp-tracker', version: 2, history, bodyweight, profile: { name: 'A', sex: 'male' }, plan: templatePlan(TEMPLATES[2]) }),
      JSON.stringify(history.slice(4, 20).map(s => ({ id: s.id, exercises: s.exercises }))),
      JSON.stringify({ history: [{ id: 'bad' }, { id: 5, exercises: [] }], bodyweight: [{ dateStr: '2026-1-1', kg: 80 }, { dateStr: '2026-01-01', kg: '80' }], plan: { days: [] } }),
      'not json', '{"hello":1}',
      // Warm-ups: added for exercises without one here; junk is skipped
      JSON.stringify({ history: [], warmups: { 'Barbell Bench Press': [{ reps: 3 }], 'Lat Pulldown': [{ reps: 10 }, { kg: '30', reps: 6 }, { kg: 5, reps: 0 }, null], Plank: 'x' } }),
      JSON.stringify({ history: [], warmups: [1, 2] })
    ];
    backups.forEach(text => {
      let toast = '';
      let error = '';
      const web = loadWebApp({
        store: { recomp_history: JSON.stringify(current.history), recomp_bodyweight: JSON.stringify(current.bodyweight), recomp_warmups: JSON.stringify(mine) },
        now: NOW,
        stubs: { showToast: (m: string) => { toast = m; }, reportTextError: (m: string) => { error = m; }, anyUnsavedSets: () => false }
      });
      web.run('loadActivePlan()');
      const ok = web.ctx.restoreBackupText(text);
      let ours;
      try {
        ours = restoreBackup(text, current);
      } catch (e) {
        expect(ok).toBe(false);
        expect((e as Error).message).toBe(error);
        return;
      }
      expect(ok).toBe(true);
      expect(restoreMessage(ours)).toBe(toast);
      same(ours.data.history, web.ctx.getHistory());
      same(ours.data.bodyweight, web.ctx.getBodyweight());
      same(ours.data.profile, web.ctx.getProfile());
      same(ours.data.plan, web.ctx.getCustomPlan());
      same(ours.data.warmups, web.ctx.getWarmups());
    });
  });
});
