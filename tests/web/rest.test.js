// The rest belongs to its set: planned before the tick, the live timer while it runs (− / + change the timer),
// recorded and locked once it's over; what's saved is the rest actually taken
const { serve, counter, openApp, seedHistory, logSet, launch } = require('./helpers');

(async () => {
  const server = await serve();
  const browser = await launch();
  const { ok, done } = counter('rest');
  const { page } = await openApp(browser, server.url, { time: '2026-11-20T18:00:00' });
  await seedHistory(page, [{ daysAgo: 7, day: 0, sets: { 0: [[50, 8, 120], [50, 8, 120], [50, 8, 120]] } }]);
  await page.evaluate(() => { selectDay(0); startWorkout(); });
  await page.waitForTimeout(300);
  const stage = s => page.evaluate(s => { const b = document.getElementById(`block_d0_e0_s${s}`).closest('.set-swipe').nextElementSibling; return b.querySelector('.rest-taken') ? 'done' : b.querySelector('.rest-stepper.rest-live') ? 'live' : 'planned'; }, s);
  const rest = s => page.evaluate(s => Number(localStorage.getItem(setKey(0, 0, s, 'rest'))) || getSetRest(0, 0, s, getAllExercisesForDay(0)[0]), s);
  const plan = await page.evaluate(() => getSetRest(0, 0, 1, getAllExercisesForDay(0)[0]));

  // 1. Before ticking: planned, and changing it sets the timer that will run
  ok(await stage(1) === 'planned', '1 before the tick: a planned rest');
  await page.evaluate(() => nudgeSetRest(0, 1, 15)); await page.waitForTimeout(200);
  await logSet(page, 0, 1, 50, 8);
  ok(await page.evaluate(p => restLengthSec() === p + 15, plan), `1 the plan (+15 s) is what the timer runs: ${await page.evaluate(() => restLengthSec())} s`);

  // 2. While it runs: the set's control is the timer
  ok(await stage(1) === 'live', '2 after the tick: the set\'s rest shows live');
  ok(await page.evaluate(() => new Set([...document.querySelectorAll('#ex-card-0 .set-link')].map(l => Math.round(l.getBoundingClientRect().height))).size === 1), '2 the live row is the same height as the others');
  await page.clock.runFor(10000);
  ok(/^\d:\d\d$/.test(await page.textContent('#rest-live')) && await page.textContent('#rest-live') === await page.textContent('#rest-time'), '2 it counts down in step with the timer bar: ' + await page.textContent('#rest-live'));
  const len0 = await page.evaluate(() => restLengthSec());
  await page.evaluate(() => nudgeSetRest(0, 1, -15)); await page.waitForTimeout(100);
  ok(await page.evaluate(l => restLengthSec() === l - 15, len0) && await rest(1) === len0 - 15, '2 − on the set shortens the running timer and the set\'s rest together');
  await page.evaluate(() => adjustRestTimer(15)); await page.waitForTimeout(100);
  ok(await rest(1) === len0, '2 +15 on the timer bar changes the set\'s rest too');

  // 3. Skip: the rest taken is what's recorded, and it's locked
  await page.clock.runFor(50000);
  await page.evaluate(() => skipRestTimer()); await page.waitForTimeout(200);
  const taken = await rest(1);
  ok(taken >= 59 && taken <= 62, `3 skipped after about a minute: ${taken} s recorded (the plan was ${plan + 15})`);
  ok(await stage(1) === 'done' && /Rested/.test(await page.evaluate(() => document.getElementById('block_d0_e0_s1').closest('.set-swipe').nextElementSibling.querySelector('.rest-taken').getAttribute('aria-label'))), '3 shown as the rest taken (✓ 1:00), locked');
  ok(await page.evaluate(() => new Set([...document.querySelectorAll('#ex-card-0 .set-link')].map(l => Math.round(l.getBoundingClientRect().height))).size === 1), '3 every stage has the same row height');
  await page.evaluate(() => nudgeSetRest(0, 1, 15)); await page.waitForTimeout(200);
  ok(await rest(1) === taken && /That rest is over/.test(await page.evaluate(() => document.getElementById('toast').textContent)), '3 − / + on a finished rest change nothing and say why');

  // 4. Runs out: the full length is recorded
  await logSet(page, 0, 2, 50, 8);
  const len2 = await page.evaluate(() => restLengthSec());
  await page.clock.runFor((len2 + 2) * 1000); await page.waitForTimeout(200);
  ok(await rest(2) === len2 && await stage(2) === 'done', `4 ran out: ${len2} s recorded, locked`);

  // 5. The next set ticked while resting: the rest lasted until then
  await logSet(page, 0, 3, 50, 8);
  await page.clock.runFor(45000);
  await page.evaluate(() => addSet(0)); await page.waitForTimeout(200);
  await logSet(page, 0, 4, 50, 8);
  ok(Math.abs(await rest(3) - 45) <= 1 && await stage(3) === 'done' && await stage(4) === 'live', `5 next set ticked after 45 s: set 3 rested ${await rest(3)} s; set 4's rest is now live`);

  // 6. The exercise's Rest chip changes plans only, never a rest taken
  await page.evaluate(() => { localStorage.setItem(exRestKey(0, 0), '75'); for (let s = 1; s <= 5; s++) { const over = localStorage.getItem(setKey(0, 0, s, 'restOver')) === 'true'; if (!over && !restIsLive(0, 0, s)) localStorage.removeItem(setKey(0, 0, s, 'rest')); } renderWorkout(); });
  ok(await rest(1) === taken && await rest(3) >= 44, '6 changing the exercise rest keeps the rests already taken');

  // 7. Saved: the rests taken; a rest PR is judged on them
  await page.evaluate(() => { stopRestTimer(); openFinishSheet(); }); await page.waitForTimeout(300);
  await page.evaluate(() => confirmFinish()); await page.waitForTimeout(500);
  const saved = await page.evaluate(() => getHistory()[0].exercises[0].sets.map(s => s.restSec));
  ok(saved[0] === taken && saved[1] === len2, '7 saved with the workout: ' + saved.join(', '));

  ok(page.errors.length === 0, 'no errors or native pop-ups ' + page.errors.join(' | '));
  await browser.close();
  server.stop();
  process.exit(done() ? 1 : 0);
})();
