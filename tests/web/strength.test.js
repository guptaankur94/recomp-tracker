// The exercise library and recommended starting weights (from your log, Profile strength or bodyweight)
const { serve, counter, openApp, seedHistory, launch } = require('./helpers');

const OWNER = { name: 'A', sex: 'male', heightCm: 174, weightKg: 71, birthDate: '1994-01-01' };

(async () => {
  const server = await serve();
  const browser = await launch();
  const { ok, done } = counter('strength');

  // 1. The library: every muscle covered, every swap real, every weighted exercise has a starting weight
  let { page, ctx } = await openApp(browser, server.url, { profile: { ...OWNER, strength: { press: { w: 50, r: 12 }, curl: { w: 12.5, r: 12 } } }, time: '2026-11-25T18:00:00' });
  const lib = await page.evaluate(() => ({
    size: LIBRARY.size,
    perMuscle: MUSCLES.map(m => [m, [...LIBRARY.values()].filter(e => e.muscle === m).length]),
    badAlt: [...LIBRARY.values()].filter(e => e.alt && !LIBRARY.has(e.alt)).map(e => e.name),
    badMuscle: [...LIBRARY.values()].filter(e => !MUSCLES.includes(e.muscle)).map(e => e.name),
    noRatio: [...LIBRARY.values()].filter(e => !['Bodyweight', 'Bar'].includes(e.equipment) && STRENGTH[e.name] === undefined).map(e => e.name),
    strayRatio: Object.keys(STRENGTH).filter(n => STRENGTH[n] && !LIBRARY.has(n))
  }));
  ok(lib.size >= 170, `1 the library has ${lib.size} exercises`);
  ok(lib.perMuscle.every(([, n]) => n >= 5), `1 every muscle has 5+ exercises (${lib.perMuscle.map(([m, n]) => `${m} ${n}`).join(', ')})`);
  ok(!lib.badAlt.length && !lib.badMuscle.length, `1 every alternative is in the library, every muscle is known ${lib.badAlt.concat(lib.badMuscle).join(', ')}`);
  ok(!lib.noRatio.length && !lib.strayRatio.length, `1 every weighted exercise has a strength ratio ${lib.noRatio.concat(lib.strayRatio).join(', ')}`);

  // 2. The plan's own names find their library exercise
  const names = await page.evaluate(() => ['Incline DB Curls (45°)', 'Barbell Bicep Curls', 'Close-Grip Barbell Bench Press', 'Standing DB Lateral Raises',
    'Seated 60° Incline DB Overhead Ext', 'Incline DB Skullcrushers (30°)', 'Heavy DB Farmer’s Carries', 'Leg Press Machine', 'Barbell Romanian Deadlifts', 'Single-Leg DB Calf Raise'].map(strengthName));
  ok(JSON.stringify(names) === JSON.stringify(['Incline Dumbbell Curl', 'Barbell Curl', 'Close-Grip Bench Press', 'Dumbbell Lateral Raise', 'Overhead Dumbbell Extension',
    'Incline Dumbbell Skull Crusher', "Farmer's Carry", 'Leg Press', 'Romanian Deadlift', 'Single-Leg Dumbbell Calf Raise']), `2 plan names resolve: ${names.join(' | ')}`);

  // 3. From Profile strength (chest press 50 × 12, curls 12.5 × 12): sensible weights, inside the plan's ranges
  const rec = n => page.evaluate(n => { const r = recommendSet({ name: n, repTarget: (LIBRARY.get(n) || {}).reps || '8–10 reps' }); return r && { w: r.w, r: r.r, why: r.why, label: recLabel(r) }; }, n);
  const bench = await rec('Barbell Bench Press');
  ok(bench && bench.w >= 40 && bench.w <= 55 && /chest press/.test(bench.why), `3 bench ${bench && bench.label} (${bench && bench.why}): 40–55 kg`);
  const curl = await rec('Barbell Curl');
  ok(curl && curl.w >= 20 && curl.w <= 27.5 && /curls/.test(curl.why), `3 barbell curl ${curl && curl.label}: 20–27.5 kg`);
  const lat = await rec('Dumbbell Lateral Raise');
  ok(lat && lat.w >= 5 && lat.w <= 10 && /each/.test(lat.label), `3 lateral raise ${lat && lat.label}: per dumbbell, 5–10 kg`);
  const rdl = await rec('Romanian Deadlift');
  ok(rdl && rdl.w >= 45 && rdl.w <= 60 && /^est\./.test(rdl.why), `3 RDL ${rdl && rdl.label} (${rdl && rdl.why}): estimated, 45–60 kg`);
  const ez = await rec('EZ-Bar Preacher Curl');
  ok(ez && ez.w >= 10 && ez.w % 2.5 === 0, `3 EZ preacher ${ez && ez.label}: 2.5 kg steps, at least the EZ bar`);
  ok(await rec('Push-ups') === null, '3 bodyweight exercises get no weight');

  // 4. Add Exercise shows it; once added, the first set's placeholder and hint use it, and ✓ logs it
  await page.evaluate(() => { selectDay(0); startWorkout(); addCustomExercise(); filterAddMuscle('Biceps'); });
  await page.waitForTimeout(400);
  const rowText = await page.evaluate(() => [...document.querySelectorAll('#add-ex-list .choice')].find(b => b.textContent.includes('EZ-Bar Curl')).textContent);
  ok(/For you: \d/.test(rowText) && /each|×/.test(rowText), `4 the library row shows a weight for you: "${rowText.replace(/\s+/g, ' ').trim()}"`);
  await page.evaluate(() => [...document.querySelectorAll('#add-ex-list .choice')].find(b => b.textContent.includes('Spider Curl')).click());
  await page.waitForTimeout(500);
  const added = await page.evaluate(() => {
    const exs = getAllExercisesForDay(currentDayIdx);
    const i = exs.findIndex(e => e.name === 'Spider Curl');
    focusExercise(i);
    const w = document.getElementById(setKey(currentDayIdx, i, 1, 'w'));
    const hint = w.closest('.set-block').querySelector('.set-hint');
    return { i, ph: w.placeholder, hint: hint ? hint.textContent : '', want: recommendSet(exs[i]).w };
  });
  ok(Number(added.ph) === added.want && /First time: try \d/.test(added.hint) && /from your curls/.test(added.hint), `4 the new exercise's set 1: placeholder ${added.ph}, hint "${added.hint}"`);
  await page.evaluate(i => completeSet(i, 1), added.i);
  await page.waitForTimeout(300);
  const logged = await page.evaluate(i => localStorage.getItem(setKey(currentDayIdx, i, 1, 'w')), added.i);
  ok(Number(logged) === added.want, `4 ✓ on the empty set logs the starting weight (${logged} kg)`);
  ok(!page.errors.length, `4 no page errors or native pop-ups ${page.errors.join(' | ')}`);
  await ctx.close();

  // 5. Your log wins over Profile: a heavier chest press logged → heavier bench; the reason names it
  ({ page, ctx } = await openApp(browser, server.url, { profile: { ...OWNER, strength: { press: { w: 50, r: 12 } } }, time: '2026-11-25T18:00:00' }));
  await page.evaluate(() => {
    const id = Date.now() - 3 * 864e5;
    localStorage.setItem('recomp_history', JSON.stringify([{ id, dateStr: localDateStr(new Date(id)), day: 'Day 1', title: 'x', exercises: [{ name: 'Machine Chest Press', effort: 9, sets: [{ set: 1, weight: 70, reps: 10 }, { set: 2, weight: 70, reps: 9 }] }] }]));
  });
  await page.reload(); await page.waitForTimeout(500);
  const fromLog = await rec('Barbell Bench Press');
  ok(fromLog && fromLog.w >= 60 && /Machine Chest Press/.test(fromLog.why), `5 from the log: bench ${fromLog && fromLog.label} (${fromLog && fromLog.why})`);
  const own = await rec('Machine Chest Press');
  ok(own && own.w >= 65 && own.w <= 75 && /last session/.test(own.why), `5 the exercise itself: from its last session (${own && own.label}), no 10 % cut`);
  await ctx.close();

  // 6. Only bodyweight known: a careful start; nothing known: the old "First time" hint
  ({ page, ctx } = await openApp(browser, server.url, { profile: OWNER, time: '2026-11-25T18:00:00' }));
  const bw = await rec('Barbell Bench Press');
  ok(bw && bw.w >= 30 && bw.w <= 50 && /bodyweight/.test(bw.why), `6 from bodyweight only: bench ${bw && bw.label} (${bw && bw.why})`);
  await ctx.close();
  ({ page, ctx } = await openApp(browser, server.url, { time: '2026-11-25T18:00:00' }));
  ok(await rec('Barbell Bench Press') === null, '6 no profile, no log: no guess');
  await page.evaluate(() => { selectDay(0); startWorkout(); focusExercise(0); });
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => document.querySelector('#ex-card-0 .set-hint').textContent.startsWith('First time: enter')), '6 the hint still asks for weight and reps');

  // 7. Profile: strength fields save into the profile and come back
  await page.evaluate(() => openProfileSheet()); await page.waitForTimeout(400);
  await page.fill('#pf-s-press-w', '55'); await page.fill('#pf-s-press-r', '10');
  await page.dispatchEvent('#pf-s-press-r', 'change');
  await page.waitForTimeout(200);
  const saved = await page.evaluate(() => getProfile().strength);
  ok(saved && saved.press && saved.press.w === 55 && saved.press.r === 10, `7 strength saved in the profile: ${JSON.stringify(saved)}`);
  await page.fill('#pf-s-curl-w', '12'); await page.dispatchEvent('#pf-s-curl-w', 'change');
  await page.waitForTimeout(200);
  ok(!(await page.evaluate(() => getProfile().strength.curl)), '7 a weight without reps is refused');
  ok(await page.evaluate(() => getProfile().name) === 'Test', '7 the rest of the profile is kept');
  ok(!page.errors.length, `7 no page errors ${page.errors.join(' | ')}`);
  await ctx.close();

  await browser.close();
  server.stop();
  process.exit(done() ? 1 : 0);
})();
