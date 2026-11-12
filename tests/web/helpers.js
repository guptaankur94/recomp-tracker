/* Shared set-up for the web app's browser checks: a local server, an iPhone-sized page, seeded data, and a
   pass/fail counter. Run them all with `sh tests/web/run.sh` (needs Playwright with Chromium). */
const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright', process.env.PLAYWRIGHT].filter(Boolean)) {
    try { return require(p); } catch (e) { /* try the next */ }
  }
  throw new Error('Playwright not found: set PLAYWRIGHT to its folder');
}

const freePort = () => new Promise(resolve => {
  const s = net.createServer();
  s.listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

// Serve the repository root (the app) on a free port
async function serve() {
  const port = await freePort();
  const root = path.resolve(__dirname, '../..');
  const proc = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    const up = await new Promise(r => { const c = net.connect(port, '127.0.0.1', () => { c.end(); r(true); }); c.on('error', () => r(false)); });
    if (up) break;
    await new Promise(r => setTimeout(r, 100));
  }
  return { url: `http://127.0.0.1:${port}/`, stop: () => proc.kill() };
}

function counter(name) {
  let fails = 0;
  let passes = 0;
  const ok = (cond, msg) => { if (cond) passes++; else fails++; console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); };
  const done = () => { console.log(`${name}: ${passes} passed, ${fails} failed`); return fails; };
  return { ok, done };
}

// A fresh app at iPhone size, with a profile so setup is skipped; errors and native pop-ups are collected
async function openApp(browser, url, { profile = { name: 'Test' }, time, reducedMotion = 'no-preference', theme } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, reducedMotion });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('dialog', d => { page.errors.push(`native dialog: ${d.message()}`); d.dismiss(); });
  if (time) await page.clock.install({ time: new Date(time) });
  await page.goto(url);
  await page.evaluate(({ profile, theme }) => {
    localStorage.setItem('recomp_profile', JSON.stringify(profile));
    localStorage.setItem('recomp_tips', JSON.stringify(TIP_IDS));
    if (theme) localStorage.setItem('recomp_theme', theme);
  }, { profile, theme });
  await page.reload();
  await page.waitForTimeout(600);
  return { ctx, page };
}

// History for the plan's exercises: sessions = [{ daysAgo, day: dayIdx, sets: { exIdx: [[kg, reps, rest], ...] } }]
async function seedHistory(page, sessions) {
  await page.evaluate(sessions => {
    const D = 864e5;
    const hist = sessions.map(s => {
      const id = Date.now() - s.daysAgo * D;
      const day = programData[s.day || 0];
      return {
        id, dateStr: localDateStr(new Date(id)), displayDate: '', day: day.day, title: day.title,
        ...(s.extra || {}),
        exercises: Object.entries(s.sets).map(([i, sets]) => ({ name: day.exercises[i].name, day: day.day, sets: sets.map(([w, r, rest], k) => ({ set: k + 1, weight: w, reps: r, restSec: rest || day.exercises[i].rest })) }))
      };
    });
    localStorage.setItem('recomp_history', JSON.stringify(hist));
  }, sessions);
  await page.reload();
  await page.waitForTimeout(600);
}

// Type into a set (bypassing the pad) and tick it
async function logSet(page, exIdx, setNum, w, r) {
  await page.evaluate(({ exIdx, setNum, w, r }) => {
    if (!document.getElementById(setKey(currentDayIdx, exIdx, setNum, 'r'))) focusExercise(exIdx);
    const wi = document.getElementById(setKey(currentDayIdx, exIdx, setNum, 'w'));
    const ri = document.getElementById(setKey(currentDayIdx, exIdx, setNum, 'r'));
    if (w !== null) { wi.value = String(w); saveVal(wi.id, wi.value); }
    ri.value = String(r); saveVal(ri.id, ri.value);
    completeSet(exIdx, setNum);
  }, { exIdx, setNum, w, r });
  await page.waitForTimeout(150);
}

async function launch() {
  const { chromium } = loadPlaywright();
  const exe = process.env.CHROMIUM;
  return chromium.launch(exe ? { executablePath: exe } : {});
}

// How far the page can actually be moved sideways (0 is right: nothing pokes out, or it's clipped)
async function sideScroll(page) {
  return page.evaluate(() => { const y = window.scrollY; window.scrollTo(100, y); const x = window.scrollX; window.scrollTo(0, y); return x; });
}

module.exports = { serve, counter, openApp, seedHistory, logSet, launch, sideScroll };
