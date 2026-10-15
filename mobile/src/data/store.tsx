// The app's data in memory, loaded from the database at start-up. Screens read it with useData() and
// change it through the actions here, which write to the database first.
import { openDatabaseAsync } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { buildBackupJson, restoreBackup, type AppData, type RestoreResult } from '@/core/backup';
import { sortHistory } from '@/core/history';
import { sortBodyweight } from '@/core/progress';
import { templatePlan, TEMPLATES } from '@/core/templates';
import type { BodyweightEntry, Plan } from '@/core/types';

import { migrate, type Db } from './db';
import * as repo from './repo';

type State = AppData & { settings: repo.Settings };

interface DataContext extends State {
  /** The plan in use: the saved one, else the first ready-made plan (as in the web app) */
  activePlan: Plan;
  restore: (text: string) => Promise<RestoreResult>;
  backupJson: () => string;
  /** null goes back to the default plan */
  choosePlan: (plan: Plan | null) => Promise<void>;
  logBodyweight: (entry: BodyweightEntry) => Promise<void>;
  removeBodyweight: (dateStr: string) => Promise<BodyweightEntry | null>;
  removeSession: (id: number) => Promise<void>;
  restoreSession: (session: AppData['history'][number]) => Promise<void>;
  updateSettings: (patch: Partial<repo.Settings>) => Promise<void>;
}

const Ctx = createContext<DataContext | null>(null);

const DEFAULT_PLAN = templatePlan(TEMPLATES[0]);

export function DataProvider({ children, fallback }: { children: ReactNode; fallback: (error: Error | null) => ReactNode }) {
  const [db, setDb] = useState<Db | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    (async () => {
      const opened = await openDatabaseAsync('recomp.db');
      await migrate(opened);
      setState(await repo.loadAll(opened));
      setDb(opened);
    })().catch(e => setError(e instanceof Error ? e : new Error(String(e))));
  }, []);

  const restore = useCallback(async (text: string) => {
    if (!db || !state) throw new Error('Still loading');
    const result = restoreBackup(text, state);
    await repo.replaceAll(db, result.data);
    setState({ ...result.data, settings: state.settings });
    return result;
  }, [db, state]);

  const actions = useMemo(() => {
    if (!db || !state) return null;
    return {
      restore,
      backupJson: () => buildBackupJson(state),
      choosePlan: async (plan: Plan | null) => {
        await repo.setKv(db, repo.KEYS.plan, plan);
        setState(s => s && { ...s, plan });
      },
      logBodyweight: async (entry: BodyweightEntry) => {
        await repo.setBodyweight(db, entry);
        setState(s => s && { ...s, bodyweight: sortBodyweight([...s.bodyweight.filter(e => e.dateStr !== entry.dateStr), entry]) });
      },
      removeBodyweight: async (dateStr: string) => {
        const removed = state.bodyweight.find(e => e.dateStr === dateStr) ?? null;
        await repo.deleteBodyweight(db, dateStr);
        setState(s => s && { ...s, bodyweight: s.bodyweight.filter(e => e.dateStr !== dateStr) });
        return removed;
      },
      removeSession: async (id: number) => {
        await repo.deleteSession(db, id);
        setState(s => s && { ...s, history: s.history.filter(h => h.id !== id) });
      },
      restoreSession: async (session: AppData['history'][number]) => {
        await repo.saveSession(db, session);
        setState(s => s && { ...s, history: sortHistory([...s.history.filter(h => h.id !== session.id), session]) });
      },
      updateSettings: async (patch: Partial<repo.Settings>) => {
        const settings = { ...state.settings, ...patch };
        await repo.setKv(db, repo.KEYS.settings, settings);
        setState(s => s && { ...s, settings });
      }
    };
  }, [db, state, restore]);

  if (!state || !actions) return <>{fallback(error)}</>;
  return <Ctx.Provider value={{ ...state, ...actions, activePlan: state.plan ?? DEFAULT_PLAN }}>{children}</Ctx.Provider>;
}

export function useData(): DataContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useData outside DataProvider');
  return ctx;
}
