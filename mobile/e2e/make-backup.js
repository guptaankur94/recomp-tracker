// A web-app style backup: eight weeks of workouts on the creator's plan, ending yesterday, plus weigh-ins
const plan = require('../src/core/data/default-plan.json');
let seed = 7; const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pad = n => String(n).padStart(2, '0');
const ds = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const history = [], bodyweight = [];
const now = new Date(); now.setHours(18, 0, 0, 0);
let i = 0;
for (let back = 56; back >= 1; back -= 1 + (rand() < 0.5 ? 1 : 0)) {
  const t = new Date(now.getTime() - back * 864e5); t.setHours(7, 30);
  const day = plan[i++ % plan.length];
  history.push({ id: t.getTime(), dateStr: ds(t), displayDate: t.toDateString(), day: day.day, title: day.title, durationSec: 3000 + Math.floor(rand() * 1500),
    exercises: day.exercises.map(ex => ({ name: ex.name, day: day.day, sets: [1, 2, 3].map(s => ({ set: s, weight: 20 + Math.round((56 - back) / 7) * 2.5 + (s === 1 ? 2.5 : 0), reps: 6 + Math.floor(rand() * 5), restSec: 90 + Math.floor(rand() * 4) * 15, ...(rand() < 0.04 ? { pr: 'reps' } : {}) })) })) });
}
for (let back = 50; back >= 0; back -= 2) { const d = new Date(now.getTime() - back * 864e5); bodyweight.push({ dateStr: ds(d), kg: Math.round((84 - (50 - back) * 0.05 + (rand() - 0.5)) * 10) / 10 }); }
process.stdout.write(JSON.stringify({ app: 'recomp-tracker', version: 2, exportedAt: new Date().toISOString(), history, bodyweight, profile: { name: 'Test', sex: 'male', heightCm: 178, goalKg: 80 }, plan: null }, null, 2));
