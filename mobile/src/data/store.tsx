// The app's data in memory, loaded from the database at start-up. Screens read it with useData() and
// change it through the actions here, which write to the database too.
import { openDatabaseAsync } from 'expo-sqlite';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { buildBackupJson, restoreBackup, type AppData, type RestoreResult } from '@/core/backup';
import { CUSTOM_DAY, dayExercises, saveDraft, type Draft } from '@/core/draft';
import { sortHistory } from '@/core/history';
import { sortBodyweight } from '@/core/progress';
import { templatePlan, TEMPLATES } from '@/core/templates';
import type { BodyweightEntry, Plan, PlanDay, Session } from '@/core/types';

import { migrate, type Db } from './db';
import * as repo from './repo';

type State = AppData & repo.Workouts & { settings: repo.Settings };

interface DataContext extends State {
  /** The plan in use: the saved one, else the first ready-made plan (as in the web app) */
  activePlan: Plan;
  /** A plan day, or the custom workout at index days.length */
  dayAt: (dayIdx: number) => PlanDay;
  restore: (text: string) => Promise<RestoreResult>;
  backupJson: () => string;
  /** Switches plan (null: back to the default). Workouts in progress are cleared, since days no longer line up. */
  choosePlan: (plan: Plan | null) => Promise<void>;
  logBodyweight: (entry: BodyweightEntry) => Promise<void>;
  removeBodyweight: (dateStr: string) => Promise<BodyweightEntry | null>;
  removeSession: (id: number) => Promise<void>;
  restoreSession: (session: Session) => Promise<void>;
  updateSettings: (patch: Partial<repo.Settings>) => Promise<void>;
  /** The workout in progress on a day; null removes it */
  setDraft: (dayIdx: number, draft: Draft | null) => void;
  setSwaps: (dayIdx: number, swaps: Set<number>) => void;
  /** Saves a day's sets to history and clears its draft; null when nothing was logged */
  saveDay: (dayIdx: number) => Promise<Session | null>;
  setRestTimer: (timer: repo.RestTimer | null) => void;
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
      setState({ ...(await repo.loadAll(opened)), ...(await repo.loadWorkouts(opened)) });
      setDb(opened);
    })().catch(e => setError(e instanceof Error ? e : new Error(String(e))));
  }, []);

  if (!state || !db) return <>{fallback(error)}</>;

  const activePlan = state.plan ?? DEFAULT_PLAN;
  const dayAt = (i: number) => (i === activePlan.days.length ? CUSTOM_DAY : activePlan.days[i]);
  // Writes that don't block the screen; a failure is logged (the in-memory state stays as the person left it)
  const background = (p: Promise<unknown>) => { p.catch(e => console.warn('Saving failed', e)); };
  const update = (fn: (s: State) => State) => setState(s => (s ? fn(s) : s));

  const value: DataContext = {
    ...state,
    activePlan,
    dayAt,
    restore: async text => {
      const result = restoreBackup(text, state);
      await repo.replaceAll(db, result.data);
      update(s => ({ ...s, ...result.data }));
      return result;
    },
    backupJson: () => buildBackupJson(state),
    choosePlan: async plan => {
      await repo.setKv(db, repo.KEYS.plan, plan);
      await repo.clearWorkouts(db);
      update(s => ({ ...s, plan, drafts: {}, swaps: {} }));
    },
    logBodyweight: async entry => {
      await repo.setBodyweight(db, entry);
      update(s => ({ ...s, bodyweight: sortBodyweight([...s.bodyweight.filter(e => e.dateStr !== entry.dateStr), entry]) }));
    },
    removeBodyweight: async dateStr => {
      const removed = state.bodyweight.find(e => e.dateStr === dateStr) ?? null;
      await repo.deleteBodyweight(db, dateStr);
      update(s => ({ ...s, bodyweight: s.bodyweight.filter(e => e.dateStr !== dateStr) }));
      return removed;
    },
    removeSession: async id => {
      await repo.deleteSession(db, id);
      update(s => ({ ...s, history: s.history.filter(h => h.id !== id) }));
    },
    restoreSession: async session => {
      await repo.saveSession(db, session);
      update(s => ({ ...s, history: sortHistory([...s.history.filter(h => h.id !== session.id), session]) }));
    },
    updateSettings: async patch => {
      const settings = { ...state.settings, ...patch };
      await repo.setKv(db, repo.KEYS.settings, settings);
      update(s => ({ ...s, settings }));
    },
    setDraft: (dayIdx, draft) => {
      update(s => {
        const drafts = { ...s.drafts };
        if (draft) drafts[dayIdx] = draft;
        else delete drafts[dayIdx];
        return { ...s, drafts };
      });
      background(repo.setKv(db, repo.draftKey(dayIdx), draft));
    },
    setSwaps: (dayIdx, swaps) => {
      const list = [...swaps].sort((a, b) => a - b);
      update(s => ({ ...s, swaps: { ...s.swaps, [dayIdx]: list } }));
      background(repo.setKv(db, repo.swapsKey(dayIdx), list.length ? list : null));
    },
    saveDay: async dayIdx => {
      const s = state;
      const draft = s.drafts[dayIdx] ?? null;
      const day = dayAt(dayIdx);
      const exercises = dayExercises(day, draft, new Set(s.swaps[dayIdx] || []));
      const saved = saveDraft({ draft, exercises, day, isCustom: dayIdx === activePlan.days.length, planDays: activePlan.days, history: s.history, now: Date.now() });
      if (!saved) return null;
      await repo.saveSession(db, saved.session);
      await repo.setKv(db, repo.draftKey(dayIdx), null);
      update(x => {
        const drafts = { ...x.drafts };
        delete drafts[dayIdx];
        return { ...x, history: saved.history, drafts };
      });
      return saved.session;
    },
    setRestTimer: timer => {
      update(s => ({ ...s, restTimer: timer }));
      background(repo.setKv(db, repo.KEYS.restTimer, timer));
    }
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useData outside DataProvider');
  return ctx;
}
