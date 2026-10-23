// The app's data in memory, loaded from the database at start-up. Screens read it with useData() and
// change it through the actions here, which write to the database too.
import { openDatabaseAsync } from 'expo-sqlite';
import { createContext, useContext, useEffect, useEffectEvent, useState, type ReactNode } from 'react';

import { mergeHealthWeights } from '@/core/health';
import { buildBackupJson, restoreBackup, type AppData, type RestoreResult } from '@/core/backup';
import { CUSTOM_DAY, dayExercises, saveDraft, type Draft } from '@/core/draft';
import { sortHistory } from '@/core/history';
import { sortBodyweight } from '@/core/progress';
import { templatePlan, TEMPLATES } from '@/core/templates';
import type { BodyweightEntry, OwnWarmupSet, Plan, PlanDay, Profile, Session } from '@/core/types';
import { widgetSnapshot } from '@/core/widget';
import { updateWidget } from '@/widgets/update-widget';

import { migrate, type Db } from './db';
import { OWN_SOURCE, readHealthWeights, saveHealthWeight } from './health';
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
  /** Adds weigh-ins from Apple Health on days with none here; returns how many were added */
  importHealthWeights: () => Promise<number>;
  removeBodyweight: (dateStr: string) => Promise<BodyweightEntry | null>;
  removeSession: (id: number) => Promise<void>;
  /** Your own warm-up for an exercise (by name); null goes back to the automatic one */
  setWarmup: (name: string, sets: OwnWarmupSet[] | null) => Promise<void>;
  /** Calories burned on a saved workout; null clears them */
  setCalories: (id: number, kcal: number | null) => Promise<void>;
  restoreSession: (session: Session) => Promise<void>;
  updateSettings: (patch: Partial<repo.Settings>) => Promise<void>;
  /** The workout in progress on a day; null removes it */
  setDraft: (dayIdx: number, draft: Draft | null) => void;
  setSwaps: (dayIdx: number, swaps: Set<number>) => void;
  /** Saves a day's sets to history and clears its draft; null when nothing was logged */
  saveDay: (dayIdx: number) => Promise<Session | null>;
  setRestTimer: (timer: repo.RestTimer | null) => void;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  /** Deletes everything on this phone; setup runs again */
  resetAll: () => Promise<void>;
  /** A plan read from a file or chatbot, waiting to be previewed and used (not saved until chosen) */
  pendingPlan: Plan | null;
  setPendingPlan: (plan: Plan | null) => void;
}

const Ctx = createContext<DataContext | null>(null);

const DEFAULT_PLAN = templatePlan(TEMPLATES[0]);

export function DataProvider({ children, fallback }: { children: ReactNode; fallback: (error: Error | null) => ReactNode }) {
  const [db, setDb] = useState<Db | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [pendingPlan, setPendingPlan] = useState<Plan | null>(null);

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
      if (state.settings.healthSync) background(saveHealthWeight(entry));
    },
    importHealthWeights: async () => {
      const added = mergeHealthWeights(state.bodyweight, await readHealthWeights(), OWN_SOURCE);
      for (const entry of added) await repo.setBodyweight(db, entry);
      if (added.length) update(s => ({ ...s, bodyweight: sortBodyweight([...s.bodyweight, ...added.filter(a => !s.bodyweight.some(e => e.dateStr === a.dateStr))]) }));
      return added.length;
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
    setWarmup: async (name, sets) => {
      const warmups = { ...(state.warmups ?? {}) };
      if (sets) warmups[name] = sets;
      else delete warmups[name];
      await repo.setKv(db, repo.KEYS.warmups, warmups);
      update(s => ({ ...s, warmups }));
    },
    setCalories: async (id, kcal) => {
      const found = state.history.find(h => h.id === id);
      if (!found) return;
      const session = { ...found };
      if (kcal) session.calories = kcal;
      else delete session.calories;
      await repo.saveSession(db, session);
      update(s => ({ ...s, history: s.history.map(h => (h.id === id ? session : h)) }));
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
    updateProfile: async patch => {
      const profile = { ...(state.profile || {}), ...patch };
      await repo.setKv(db, repo.KEYS.profile, profile);
      update(s => ({ ...s, profile }));
    },
    resetAll: async () => {
      await repo.resetAll(db);
      setState({ history: [], bodyweight: [], profile: null, plan: null, warmups: {}, settings: {}, drafts: {}, swaps: {}, restTimer: null });
    },
    pendingPlan,
    setPendingPlan,
    setRestTimer: timer => {
      update(s => ({ ...s, restTimer: timer }));
      background(repo.setKv(db, repo.KEYS.restTimer, timer));
    }
  };
  return <Ctx.Provider value={value}><Sync />{children}</Ctx.Provider>;
}

/** Keeps the home-screen widget current, and pulls new weigh-ins from Apple Health at start-up when sync is on */
function Sync() {
  const { activePlan, history, settings, importHealthWeights } = useData();
  useEffect(() => {
    updateWidget(widgetSnapshot(activePlan, history));
  }, [activePlan, history]);
  const healthImport = useEffectEvent(() => { importHealthWeights().catch(e => console.warn('Apple Health sync failed', e)); });
  useEffect(() => {
    if (settings.healthSync) healthImport();
  }, [settings.healthSync]);
  return null;
}

export function useData(): DataContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useData outside DataProvider');
  return ctx;
}
