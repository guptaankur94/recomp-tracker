// Long-press an exercise and drag it to move it (today only); a quick tap or a scroll never starts it
const { serve, counter, openApp, seedHistory, logSet, launch } = require('./helpers');

(async () => {
  const server = await serve();
  const browser = await launch();
  const { ok, done } = counter('drag');
  const { page } = await openApp(browser, server.url, { time: '2026-11-23T18:00:00' });
  await seedHistory(page, [{ daysAgo: 7, day: 0, sets: { 0: [[50, 8], [50, 8], [50, 8]] } }]);
  await page.evaluate(() => { selectDay(0); startWorkout(); const c = getCustomExercises(0); c.push({ ...libExercise('Cable Fly'), isCustom: true }); localStorage.setItem('custom_ex_d0', JSON.stringify(c)); renderWorkout(); });
  await page.waitForTimeout(300);
  const order = () => page.evaluate(() => [...document.querySelectorAll('#workout-content .ex-card')].map(c => +c.id.replace('ex-card-', '')));
  const added = await page.evaluate(() => getAllExercisesForDay(0).length - 1);
  const center = id => page.evaluate(id => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top }; }, id);
  await page.evaluate(added => document.getElementById(`ex-card-${added}`).scrollIntoView({ block: 'end' }), added);
  await page.evaluate(() => window.scrollBy(0, 150)); await page.waitForTimeout(300);
  const o0 = await order();

  // 1. A quick tap opens it as before (no drag)
  // 2. Hold and drag the added exercise up two places
  const from = await center(`ex-card-${added}`);
  const target = await center(`ex-card-${o0[o0.length - 3]}`);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.waitForTimeout(600);
  ok(await page.evaluate(added => document.getElementById(`ex-card-${added}`).classList.contains('dragging'), added), '2 holding lifts it');
  for (let k = 1; k <= 12; k++) { await page.mouse.move(from.x, from.y + (target.y - 6 - from.y) * k / 12); await page.waitForTimeout(30); }
  await page.waitForTimeout(250);
  const shifted = await page.evaluate(id => document.getElementById(id).style.transform, `ex-card-${o0[o0.length - 3]}`);
  ok(/translateY\(\d/.test(shifted), '2 the others slide aside while you drag: ' + shifted);
  const dropY = (await center(`ex-card-${added}`)).top;
  await page.mouse.up(); await page.waitForTimeout(500);
  const o1 = await order();
  ok(o1.indexOf(added) === o0.length - 3, `2 dropped two places up (${o0.join(',')} → ${o1.join(',')})`);
  const landed = (await center(`ex-card-${added}`)).top;
  ok(Math.abs(landed - dropY) < 30, `2 it lands where you let go (${Math.round(dropY)} → ${Math.round(landed)})`);
  ok(await page.evaluate(() => !document.getElementById('dialog-sheet').classList.contains('open')) && await page.evaluate(added => document.getElementById(`ex-card-${added}`).classList.contains('preview'), added), '2 letting go doesn\'t also open it');
  ok(/moved, for today/.test(await page.evaluate(() => document.getElementById('toast').textContent)), '2 "moved, for today" with Undo');
  ok(await page.evaluate(() => getCustomPlan() === null || getCustomPlan().days[0].exercises.length === programData[0].exercises.length), '2 the plan is unchanged');

  // 3. Moving the finger straight away is a scroll: no drag
  const p2 = await center(`ex-card-${o1[1]}`);
  await page.mouse.move(p2.x, p2.y); await page.mouse.down();
  await page.mouse.move(p2.x, p2.y + 40); await page.waitForTimeout(600);
  ok(!(await page.evaluate(() => !!document.querySelector('.ex-card.dragging'))), '3 moving before the hold ends: no drag');
  await page.mouse.up(); await page.waitForTimeout(200);

  // 4. A set row or a field never starts it
  await page.evaluate(() => focusExercise(0)); await page.waitForTimeout(300);
  const field = await center('active_d0_e0_s1_r');
  await page.mouse.move(field.x, field.y); await page.mouse.down(); await page.waitForTimeout(600);
  ok(!(await page.evaluate(() => !!document.querySelector('.ex-card.dragging'))), '4 holding a set field never starts a drag');
  await page.mouse.up(); await page.waitForTimeout(200);
  await page.evaluate(() => closePad());

  // 5. Holding the open exercise's title drags it; still no errors, still a working set log afterwards
  const head = await center('ex-card-0');
  const h = await page.evaluate(() => { const r = document.querySelector('#ex-card-0 .ex-name').getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; });
  await page.mouse.move(h.x, h.y); await page.mouse.down(); await page.waitForTimeout(600);
  ok(await page.evaluate(() => document.getElementById('ex-card-0').classList.contains('dragging')), '5 holding an open exercise\'s title lifts it');
  await page.mouse.up(); await page.waitForTimeout(300);
  await logSet(page, 0, 1, 50, 8);
  ok(await page.evaluate(() => localStorage.getItem(setKey(0, 0, 1, 'done')) === 'true'), '5 logging still works after');

  // 6. With touch (as on the iPhone): hold, drag, drop; the page doesn't scroll meanwhile; a quick swipe stays a scroll
  await page.evaluate(() => { localStorage.removeItem(todayOrderKey(0)); renderWorkout(); });
  await page.evaluate(added => { document.getElementById(`ex-card-${added}`).scrollIntoView({ block: 'end' }); window.scrollBy(0, 150); }, added);
  await page.waitForTimeout(300);
  const t0 = await order();
  const pos = id => page.evaluate(id => { const r = document.getElementById(id).getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; }, id);
  const a = await pos(`ex-card-${added}`), tgt = await pos(`ex-card-${t0[t0.length - 3]}`);
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const sy = await page.evaluate(() => scrollY);
  await touch('touchStart', a.x, a.y); await page.waitForTimeout(600);
  for (let k = 1; k <= 12; k++) { await touch('touchMove', a.x, Math.round(a.y + (tgt.y - 6 - a.y) * k / 12)); await page.waitForTimeout(30); }
  const during = (await page.evaluate(() => scrollY)) - sy;
  await touch('touchEnd', 0, 0); await page.waitForTimeout(500);
  const t1 = await order();
  ok(t1.indexOf(added) === t0.length - 3 && during === 0, `6 touch: held, dragged two up, page still meanwhile (${t0.join(',')} → ${t1.join(',')})`);
  const b = await pos(`ex-card-${t1[1]}`);
  await touch('touchStart', b.x, b.y);
  for (let k = 1; k <= 6; k++) { await touch('touchMove', b.x, b.y - k * 20); await page.waitForTimeout(16); }
  await touch('touchEnd', 0, 0); await page.waitForTimeout(700);
  ok(!(await page.evaluate(() => !!document.querySelector('.ex-card.dragging'))) && (await order()).join(',') === t1.join(','), '6 touch: a quick swipe is a scroll, nothing moves');

  ok(page.errors.length === 0, 'no errors or native pop-ups ' + page.errors.join(' | '));
  await browser.close();
  server.stop();
  process.exit(done() ? 1 : 0);
})();
