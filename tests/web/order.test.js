// Exercise state colours (untouched grey, in progress yellow, done green) and moving exercises for today
const { serve, counter, openApp, seedHistory, logSet, launch, completeExercise } = require('./helpers');

(async () => {
  const server = await serve();
  const browser = await launch();
  const { ok, done } = counter('order');
  const { page } = await openApp(browser, server.url, { time: '2026-11-23T18:00:00' });
  await seedHistory(page, [{ daysAgo: 7, day: 0, sets: { 0: [[50, 8], [50, 8], [50, 8]] } }]);
  await page.evaluate(() => { selectDay(0); startWorkout(); });
  await page.waitForTimeout(300);
  const st = i => page.evaluate(i => { const c = document.getElementById(`ex-card-${i}`); return c.classList.contains('collapsed') ? 'done' : c.classList.contains('st-progress') ? 'progress' : c.classList.contains('st-new') ? 'new' : '?'; }, i);
  const edge = i => page.evaluate(i => getComputedStyle(document.getElementById(`ex-card-${i}`)).borderLeftColor, i);
  const order = () => page.evaluate(() => [...document.querySelectorAll('#workout-content .ex-card')].map(c => +c.id.replace('ex-card-', '')));

  // 1. States
  ok(await st(0) === 'new' && await st(1) === 'new', '1 untouched: grey');
  const grey = await edge(1);
  await page.evaluate(() => toggleWarmup(0, 0)); await page.waitForTimeout(300);
  ok(await st(0) === 'progress', '1 a warm-up ticked: in progress (yellow)');
  const yellow = await edge(0);
  ok(yellow !== grey && yellow === await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--progress').trim().replace(/^#(..)(..)(..)$/, (m, r, g, b) => `rgb(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)})`)), `1 the edge is the theme's yellow (${yellow}), untouched is grey (${grey})`);
  for (let s = 1; s <= 3; s++) await logSet(page, 0, s, 50, 8);
  ok(await st(0) === 'progress', '1 all sets ticked but not called done: still in progress');
  await completeExercise(page, 0); await page.waitForTimeout(1300);
  ok(await st(0) === 'done', '1 called done: the green Done row');
  ok(await st(1) === 'new' && await page.evaluate(() => getComputedStyle(document.querySelector('#ex-card-2 .ex-name')).color) !== await page.evaluate(() => getComputedStyle(document.querySelector('#ex-card-0 .ex-name')).color), '1 untouched previews are greyed');

  // 2. An exercise added for today lands at the bottom; Move… puts it next to the chest work
  await page.evaluate(() => { const c = getCustomExercises(0); c.push({ ...libExercise('Cable Fly'), isCustom: true }); localStorage.setItem('custom_ex_d0', JSON.stringify(c)); renderWorkout(); });
  await page.waitForTimeout(300);
  const added = await page.evaluate(() => getAllExercisesForDay(0).length - 1);
  ok((await order()).pop() === added, '2 an added exercise starts at the bottom');
  await page.evaluate(added => { focusExercise(added); }, added); await page.waitForTimeout(300);
  await page.evaluate(added => { openExerciseMenu(added); }, added); await page.waitForTimeout(300);
  await page.click('#dialog-sheet >> text=Move…'); await page.waitForTimeout(300);
  const first = await page.evaluate(() => getAllExercisesForDay(0)[0].name);
  await page.click(`#dialog-sheet >> text=After ${first}`); await page.waitForTimeout(400);
  const o2 = await order();
  ok(o2[0] === 0 && o2[1] === added, `2 "After ${first}": now second (${o2.join(',')})`);
  ok(await page.evaluate(() => getCustomPlan() === null || getCustomPlan().days[0].exercises.length === programData[0].exercises.length), '2 the plan is unchanged');

  // 3. The reorder sheet: ↑ / ↓, a superset moves as one, back to the plan's order
  await page.evaluate(() => { openDayMenu(); }); await page.waitForTimeout(300);
  await page.click('#dialog-sheet >> text=Reorder exercises'); await page.waitForTimeout(400);
  ok((await page.locator('#reorder-list .ro-row').count()) === await page.evaluate(() => getAllExercisesForDay(0).length), '3 one row per exercise');
  ok(await page.evaluate(() => document.querySelector('#reorder-list .ro-row').classList.contains('ro-done')), '3 rows show their state');
  await page.click('#reorder-list .ro-row:nth-child(2) [aria-label$="down"]'); await page.waitForTimeout(300);
  const o3 = await order();
  ok(o3[2] === added, `3 ↓ moves it down one (${o3.join(',')})`);
  await page.evaluate(() => { closeSheet('reorder-sheet'); toggleSuperset(2); }); await page.waitForTimeout(300);
  await page.evaluate(() => { openReorderSheet(); }); await page.waitForTimeout(300);
  ok(/\+/.test(await page.textContent('#reorder-list')) && /Superset/.test(await page.textContent('#reorder-list')), '3 a superset pair is one row');
  const pairRow = await page.evaluate(() => [...document.querySelectorAll('#reorder-list .ro-row')].findIndex(r => /Superset/.test(r.textContent)));
  await page.click(`#reorder-list .ro-row:nth-child(${pairRow + 1}) [aria-label$="up"]`); await page.waitForTimeout(300);
  const o4 = await order();
  const at = o4.indexOf(2);
  ok(o4[at + 1] === 3, `3 the pair moved together (${o4.join(',')})`);
  await page.click('#reorder-sheet >> text=Back to the plan\'s order'); await page.waitForTimeout(300);
  ok((await order()).slice(0, -1).every((v, i) => v === i), '3 back to the plan\'s order');
  await page.evaluate(() => { closeSheet('reorder-sheet'); toggleSuperset(2); });

  // 4. Today only
  await page.evaluate(added => moveExerciseTo(added, 0), added);
  ok((await order())[0] === added, '4 moved to the top today');
  await page.clock.setSystemTime(new Date('2026-11-24T18:00:00'));
  await page.evaluate(() => renderWorkout()); await page.waitForTimeout(200);
  ok((await order())[0] === 0, '4 the next day: the plan\'s order again');

  ok(page.errors.length === 0, 'no errors or native pop-ups ' + page.errors.join(' | '));
  await browser.close();
  server.stop();
  process.exit(done() ? 1 : 0);
})();
