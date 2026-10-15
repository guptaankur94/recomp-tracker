// Writes the web app's data (exercise library, ready-made plans, the creator's plan) to JSON for the
// new app, so nothing is retyped by hand. Run again after changing the data in ../js/data.
//   node scripts/export-web-data.js
const fs = require('fs');
const path = require('path');
const { loadWebApp } = require('./web-app');

const OUT = path.join(__dirname, '..', 'src', 'core', 'data');
const web = loadWebApp();

const exercises = web.get('LIBRARY_ROWS').map(([name, muscle, equipment, warmup, alt, reps, rest, cue]) =>
  ({ name, muscle, equipment, warmup, alt, reps, rest, cue }));

// Each template's days as [title, [[exercise, overrides?]]]; the creator's plan has none (it is built from default-plan.json)
const templates = web.get('TEMPLATES').map(({ build, ...t }) => ({
  ...t,
  plan: build ? build().map(([title, list]) => ({ title, exercises: list.map(([name, o]) => (o ? { name, ...o } : { name })) })) : null
}));

const write = (file, data) => {
  fs.writeFileSync(path.join(OUT, file), JSON.stringify(data, null, 2) + '\n');
  console.log(`${file}: ${Array.isArray(data) ? data.length : Object.keys(data).length} entries`);
};
fs.mkdirSync(OUT, { recursive: true });
write('exercises.json', { muscles: web.get('MUSCLES'), exercises });
write('templates.json', templates);
write('default-plan.json', web.get('DEFAULT_PLAN'));
