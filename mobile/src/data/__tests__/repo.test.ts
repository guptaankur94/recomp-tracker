/// <reference types="jest" />
// The database layer, run on Node's built-in SQLite through the same interface expo-sqlite provides.
import { restoreBackup } from '@/core/backup';
import { templatePlan, TEMPLATES } from '@/core/templates';
import { NOW, sampleBodyweight, sampleHistory } from '@/core/testing/fixtures';

import { migrate, type Db } from '../db';
import * as repo from '../repo';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite');

function nodeDb(): Db {
  const d = new DatabaseSync(':memory:');
  return {
    execAsync: async sql => { d.exec(sql); },
    runAsync: async (sql, ...p) => d.prepare(sql).run(...p),
    getAllAsync: async (sql, ...p) => d.prepare(sql).all(...p),
    getFirstAsync: async (sql, ...p) => d.prepare(sql).get(...p) ?? null,
    withTransactionAsync: async task => {
      d.exec('BEGIN');
      try { await task(); d.exec('COMMIT'); } catch (e) { d.exec('ROLLBACK'); throw e; }
    }
  };
}

const plain = (v: unknown) => JSON.parse(JSON.stringify(v));

test('a fresh database is empty, and migrating twice is harmless', async () => {
  const db = nodeDb();
  await migrate(db);
  await migrate(db);
  expect(await repo.loadAll(db)).toEqual({ history: [], bodyweight: [], profile: null, plan: null, settings: {} });
});

test('a web app backup restores into the database and reads back exactly', async () => {
  const db = nodeDb();
  await migrate(db);
  const history = sampleHistory();
  const bodyweight = sampleBodyweight();
  const plan = templatePlan(TEMPLATES[1]);
  const backup = JSON.stringify({ app: 'recomp-tracker', version: 2, history, bodyweight, profile: { name: 'Ankur', sex: 'male', heightCm: 178 }, plan });
  const result = restoreBackup(backup, await repo.loadAll(db));
  await repo.replaceAll(db, result.data);
  const loaded = await repo.loadAll(db);
  expect(plain(loaded.history)).toEqual(plain(history));
  expect(loaded.bodyweight).toEqual(bodyweight);
  expect(loaded.profile).toEqual({ name: 'Ankur', sex: 'male', heightCm: 178 });
  // Including which ready-made plan it came from
  expect(loaded.plan?.templateId).toBe('full-body-2');
  expect(plain(loaded.plan)).toEqual(plain(plan));
  // Restoring the same backup again adds nothing
  const again = restoreBackup(backup, loaded);
  expect(again.added).toBe(0);
  expect(again.alreadyHere).toBe(history.length);
});

test('single writes: sessions, weigh-ins, settings', async () => {
  const db = nodeDb();
  await migrate(db);
  const [s1, s2] = sampleHistory().slice(0, 2);
  await repo.saveSession(db, s1);
  await repo.saveSession(db, s2);
  await repo.saveSession(db, { ...s1, title: 'Renamed' });
  await repo.deleteSession(db, s2.id);
  await repo.setBodyweight(db, { dateStr: '2026-04-02', kg: 80.4 });
  await repo.setBodyweight(db, { dateStr: '2026-04-01', kg: 80.9 });
  await repo.setBodyweight(db, { dateStr: '2026-04-02', kg: 80.1 });
  await repo.deleteBodyweight(db, '2026-04-01');
  await repo.setKv(db, repo.KEYS.settings, { theme: 'neon' });
  const loaded = await repo.loadAll(db);
  expect(loaded.history.map(s => s.title)).toEqual(['Renamed']);
  expect(loaded.bodyweight).toEqual([{ dateStr: '2026-04-02', kg: 80.1 }]);
  expect(loaded.settings).toEqual({ theme: 'neon' });
});

test('a failed restore leaves the data as it was', async () => {
  const db = nodeDb();
  await migrate(db);
  const history = sampleHistory().slice(0, 3);
  await repo.replaceAll(db, { history, bodyweight: [], profile: null, plan: null });
  const broken = { history: [...history, { id: NOW, dateStr: '2026-04-15', exercises: [], get displayDate(): string { throw new Error('boom'); } }], bodyweight: [], profile: null, plan: null };
  await expect(repo.replaceAll(db, broken as never)).rejects.toThrow('boom');
  expect((await repo.loadAll(db)).history).toHaveLength(3);
});
