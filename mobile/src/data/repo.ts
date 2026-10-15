// Reading and writing the app's data. Every write goes through here.
import type { AppData } from '@/core/backup';
import { sessionDateStr } from '@/core/format';
import { sortHistory } from '@/core/history';
import { validStoredPlan } from '@/core/plan-import';
import type { BodyweightEntry, Plan, Profile, Session } from '@/core/types';

import type { Db } from './db';

/** Keys in the kv table. Profile and plan keep the web app's names. */
export const KEYS = { profile: 'recomp_profile', plan: 'recomp_plan', settings: 'settings' } as const;

export interface Settings {
  theme?: string;
}

function parse<T>(text: string | undefined | null, fallback: T): T {
  try {
    return text ? (JSON.parse(text) as T) ?? fallback : fallback;
  } catch {
    return fallback;
  }
}

export async function getKv<T>(db: Db, key: string, fallback: T): Promise<T> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  return parse(row?.value, fallback);
}

export async function setKv(db: Db, key: string, value: unknown): Promise<void> {
  if (value === null || value === undefined) await db.runAsync('DELETE FROM kv WHERE key = ?', key);
  else await db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, JSON.stringify(value));
}

export async function loadAll(db: Db): Promise<AppData & { settings: Settings }> {
  const rows = await db.getAllAsync<{ data: string }>('SELECT data FROM sessions');
  const history = sortHistory(rows.map(r => parse<Session | null>(r.data, null)).filter(Boolean));
  const bodyweight = await db.getAllAsync<BodyweightEntry>('SELECT date_str AS dateStr, kg FROM bodyweight ORDER BY date_str');
  const profile = await getKv<Profile | null>(db, KEYS.profile, null);
  const plan = validStoredPlan(await getKv<Plan | null>(db, KEYS.plan, null));
  const settings = await getKv<Settings>(db, KEYS.settings, {});
  return { history, bodyweight, profile: profile && typeof profile === 'object' ? profile : null, plan, settings };
}

export async function saveSession(db: Db, session: Session): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO sessions (id, date_str, data) VALUES (?, ?, ?)', session.id, sessionDateStr(session), JSON.stringify(session));
}

export async function deleteSession(db: Db, id: number): Promise<void> {
  await db.runAsync('DELETE FROM sessions WHERE id = ?', id);
}

export async function setBodyweight(db: Db, entry: BodyweightEntry): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO bodyweight (date_str, kg) VALUES (?, ?)', entry.dateStr, entry.kg);
}

export async function deleteBodyweight(db: Db, dateStr: string): Promise<void> {
  await db.runAsync('DELETE FROM bodyweight WHERE date_str = ?', dateStr);
}

/** Writes merged data (after a backup restore) in one transaction: all of it lands, or none */
export async function replaceAll(db: Db, data: AppData): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM sessions');
    for (const s of data.history) await saveSession(db, s);
    await db.runAsync('DELETE FROM bodyweight');
    for (const e of data.bodyweight) await setBodyweight(db, e);
    await setKv(db, KEYS.profile, data.profile);
    await setKv(db, KEYS.plan, data.plan);
  });
}
