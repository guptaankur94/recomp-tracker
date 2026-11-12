// Measurements and photos, Progress jump chips and the shorter Coach, History search and Repeat
const { serve, counter, openApp, seedHistory, launch } = require('./helpers');
const zlib = require('zlib');

// A small solid-colour PNG, for photo uploads
function png(w, h, rgb) {
  const crc = buf => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.concat(Array(w).fill(Buffer.from(rgb)))]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(Array(h).fill(row)))), chunk('IEND', Buffer.alloc(0))]);
}

(async () => {
  const server = await serve();
  const browser = await launch();
  const { ok, done } = counter('batch3');
  const { page } = await openApp(browser, server.url, { profile: { name: 'T', sex: 'male', age: 32, heightCm: 178, weightKg: 82, goalType: 'recomp' } });
  await seedHistory(page, [
    { daysAgo: 9, day: 0, sets: { 0: [[50, 8], [50, 8]], 1: [[20, 12]] } },
    { daysAgo: 5, day: 1, sets: { 0: [[80, 5]] } },
    { daysAgo: 2, day: 0, sets: { 0: [[52.5, 8], [52.5, 8]] } }
  ]);
  const names = await page.evaluate(() => [programData[0].exercises[0].name, programData[1].exercises[0].name]);

  // 1. Measurements
  await page.evaluate(() => switchView('progress')); await page.waitForTimeout(500);
  await page.click('.measure-btn'); await page.waitForTimeout(300);
  await page.fill('#measure-waist', '5');
  await page.click('#measure-sheet .btn-primary'); await page.waitForTimeout(300);
  ok(await page.isVisible('#measure-sheet .sheet') && /looks off/.test(await page.textContent('#toast')), '1 waist 5 cm is refused');
  await page.fill('#measure-waist', '86,5'); await page.fill('#measure-arm', '36');
  await page.click('#measure-sheet .btn-primary'); await page.waitForTimeout(400);
  const m = await page.evaluate(() => getMeasurements());
  ok(m.length === 1 && m[0].waist === 86.5 && m[0].arm === 36, '1 saved (comma decimal ok): ' + JSON.stringify(m));
  ok(/86.5/.test(await page.textContent('#body-stats')) && /Arm/.test(await page.textContent('#body-others')), '1 card shows waist and the others');
  // Same date again replaces; four weeks of waist going down, weight holding → recomp tip
  await page.evaluate(() => {
    const D = 864e5, now = Date.now();
    saveMeasurements([0, 14, 28].map(k => ({ dateStr: localDateStr(new Date(now - (28 - k) * D)), waist: 88 - k / 14 * 0.9 })));
    localStorage.setItem('recomp_bodyweight', JSON.stringify([0, 7, 14, 21, 28].map(k => ({ dateStr: localDateStr(new Date(now - (28 - k) * D)), kg: 82 + (k % 2) * 0.2 }))));
    renderProgress();
  });
  await page.waitForTimeout(300);
  ok(/−1.8\s*cm|−1\.8/.test(await page.textContent('#body-stats')), '1 waist change over 4 weeks: ' + (await page.textContent('#body-stats')).replace(/\s+/g, ' '));
  ok(await page.evaluate(() => coachTips().some(t => /Recomp is working/.test(t.title))), '1 Coach: "Recomp is working: waist down, weight holding"');
  ok(await page.evaluate(() => JSON.parse(buildBackupJson()).measurements.length === 3), '1 measurements are in backups');
  ok(await page.evaluate(() => /Measurements: /.test(aiCoachPrompt())), '1 and in the AI coach text');

  // 2. Photos
  await page.setInputFiles('#photo-file', { name: 'a.png', mimeType: 'image/png', buffer: png(60, 90, [200, 120, 80]) });
  await page.waitForTimeout(800);
  ok(/Which view/.test(await page.textContent('#dialog-sheet')), '2 asks which view');
  await page.click('#dialog-sheet >> text=Front'); await page.waitForTimeout(800);
  ok((await page.locator('.photo-thumb').count()) === 1, '2 thumbnail appears');
  const stored = await page.evaluate(async () => { const p = await listPhotos(); return { n: p.length, type: p[0].blob.type, size: p[0].blob.size }; });
  ok(stored.n === 1 && stored.type === 'image/jpeg', '2 stored on the phone as a JPEG: ' + JSON.stringify(stored));
  await page.setInputFiles('#photo-file', { name: 'b.png', mimeType: 'image/png', buffer: png(60, 90, [80, 120, 200]) });
  await page.waitForTimeout(800); await page.click('#dialog-sheet >> text=Front'); await page.waitForTimeout(800);
  await page.locator('.photo-thumb').first().click(); await page.waitForTimeout(500);
  ok(await page.isVisible('#photo-sheet .sheet'), '2 tap opens it');
  await page.click('#photo-view >> text=Compare with…'); await page.waitForTimeout(400);
  await page.locator('#dialog-choices .choice').first().click(); await page.waitForTimeout(600);
  ok((await page.locator('#photo-view figure').count()) === 2, '2 side-by-side compare');
  await page.click('#photo-view >> text=Delete photo'); await page.waitForTimeout(300);
  await page.click('#dialog-confirm-btn'); await page.waitForTimeout(600);
  ok((await page.locator('.photo-thumb').count()) === 1, '2 delete (after confirming)');

  // 3. Jump chips and the shorter Coach
  const chips = await page.locator('.jump-chip').allTextContents();
  ok(chips.includes('Coach') && chips.includes('Body') && chips.includes('Weight'), '3 jump chips: ' + chips.join(' · '));
  await page.click('.jump-chip >> text=Body'); await page.waitForTimeout(900);
  const pos = await page.evaluate(() => ({ card: document.getElementById('body-card').getBoundingClientRect().top, bar: document.querySelector('.progress-top').getBoundingClientRect().bottom }));
  ok(pos.card >= pos.bar - 2 && pos.card - pos.bar < 40, `3 "Body" scrolls its card to just under the sticky bar (${Math.round(pos.card)} vs ${Math.round(pos.bar)})`);
  const nTips = await page.evaluate(() => coachTips().length);
  const shown = await page.locator('#coach-list .cc-item').count() - await page.evaluate(() => coachSuggestions().length);
  ok(nTips <= 2 ? shown === nTips : shown === 2 && await page.isVisible('.cc-more'), `3 Coach shows its top 2 of ${nTips} with "Show more"`);
  if (nTips > 2) {
    await page.click('.cc-more'); await page.waitForTimeout(300);
    ok(await page.locator('#coach-list .cc-item').count() - await page.evaluate(() => coachSuggestions().length) === nTips, '3 "Show more" shows them all');
  }

  // 4. History search
  await page.evaluate(() => switchView('history')); await page.waitForTimeout(500);
  await page.fill('#history-search', names[0].toLowerCase());
  await page.waitForTimeout(300);
  const found = await page.locator('#history-list-container .history-card').count();
  ok(found === 2, `4 searching "${names[0].toLowerCase()}" finds the 2 workouts with it (${found})`);
  ok(/best 52.5 kg × 8/.test(await page.textContent('#history-list-container')), '4 shows that exercise\'s best set in each');
  await page.fill('#history-search', 'zzz'); await page.waitForTimeout(200);
  ok(/Nothing found/.test(await page.textContent('#history-list-container')), '4 nothing found says so');
  await page.fill('#history-search', ''); await page.waitForTimeout(200);

  // 5. Repeat this workout
  await page.locator('.history-card').first().click(); await page.waitForTimeout(400);
  ok(await page.isVisible('#modal-repeat-btn'), '5 "Repeat this workout" in the workout sheet');
  await page.click('#modal-repeat-btn'); await page.waitForTimeout(600);
  ok(await page.evaluate(() => !document.getElementById('view-workout').hidden && currentDayIdx === 0), '5 opens its plan day on the Workout tab');
  // A mixed workout (exercises from two days) → a one-off workout with them
  await page.evaluate(names => {
    const h = getHistory();
    h.unshift({ id: Date.now() - 3600e3, dateStr: localDateStr(new Date()), day: 'Day 1 + Day 2', title: 'Mixed', exercises: [{ name: names[0], sets: [{ set: 1, weight: 50, reps: 8 }] }, { name: names[1], sets: [{ set: 1, weight: 80, reps: 5 }, { set: 2, weight: 80, reps: 5 }] }] });
    localStorage.setItem('recomp_history', JSON.stringify(h));
  }, names);
  await page.evaluate(() => { switchView('history'); }); await page.waitForTimeout(400);
  await page.evaluate(() => repeatWorkout(getHistory()[0].id)); await page.waitForTimeout(500);
  const custom = await page.evaluate(() => ({ isCustom: isCustomDay(), exs: getAllExercisesForDay(currentDayIdx).map(e => `${e.name}:${e.sets}`) }));
  ok(custom.isCustom && custom.exs.length === 2 && custom.exs[1] === `${names[1]}:2`, '5 mixed workout → one-off with the same exercises and set counts: ' + custom.exs.join(', '));

  // 6. Themes
  for (const t of ['vitruvian', 'neon', 'codex', 'classic']) {
    await page.evaluate(id => localStorage.setItem('recomp_theme', id), t);
    await page.reload(); await page.waitForTimeout(500);
    for (const v of ['progress', 'history']) {
      await page.evaluate(v => switchView(v), v); await page.waitForTimeout(400);
      const w = await page.evaluate(() => document.documentElement.scrollWidth);
      if (w > 390) ok(false, `6 ${t} ${v}: sideways scroll ${w}`);
    }
  }
  ok(true, '6 Progress and History fit in all themes');
  ok(page.errors.length === 0, 'no errors or native pop-ups ' + page.errors.join(' | '));
  await browser.close();
  server.stop();
  process.exit(done() ? 1 : 0);
})();
