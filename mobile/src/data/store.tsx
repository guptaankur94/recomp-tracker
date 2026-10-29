// The app's data in memory, loaded from the database at start-up. Screens read it with useData() and
// change it through the actions here, which write to the database too.
import { openDatabaseAsync } from 'expo-sqlite';
import { createContext, useContext, useEffect, useEffectEvent, useState, type ReactNode } from 'react';

import { localDateStr } from '@/core/format';
import { mergeHealthWeights } from '@/core/health';
import { buildBackupJson, restoreBackup, type AppData, type RestoreResult } from '@/core/backup';
import { CUSTOM_DAY, dayExercises, finishClock, hasDraft, saveDraft, type Draft, type WorkoutClock } from '@/core/draft';
import { sortHistory, todaysSession } from '@/core/history';
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
  /** Starts a program on the active plan (null ends it); workouts in progress stay */
  setProgram: (program: Plan['program'] | null) => Promise<void>;
  /** Your goal for an exercise on the plan (on its swap, when swapped); workouts in progress stay */
  setGoal: (dayIdx: number, exIdx: number, swapped: boolean, goal: { weight?: number; reps: number }) => Promise<void>;
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
  /** The workout clock (one for the whole app); null stops it */
  setClock: (clock: WorkoutClock | null) => void;
  /** Finish: saves today's sets from every day (this one first; or only this one's, when they're from an earlier
      date), stops the clock and returns the workout to show, or null when nothing was logged */
  finishWorkout: (dayIdx: number, extra?: { effort?: number | null; calories?: number | null }) => Promise<Session | null>;
  /** How hard a saved workout felt (0–10); null clears it */
  setEffort: (id: number, effort: number | null) => Promise<void>;
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

  // Saves days' sets one after another (they merge into the date's workout), adding the clock's time once
  const saveDays = (dayIdxs: number[], now: number) => {
    let history = state.history;
    let clock = state.clock;
    let saved: Session | null = null;
    const cleared: number[] = [];
    for (const d of dayIdxs) {
      const draft = state.drafts[d] ?? null;
      const day = dayAt(d);
      const exercises = dayExercises(day, draft, new Set(state.swaps[d] || []));
      const out = saveDraft({ draft, exercises, day, isCustom: d === activePlan.days.length, planDays: activePlan.days, history, now, clock });
      if (!out) continue;
      ({ history, clock } = out);
      saved = out.session;
      cleared.push(d);
    }
    return { history, clock, saved, cleared };
  };
  // Writes the workouts that changed (saving only ever changes the date's workout: today's, or an earlier one)
  const commitSaved = async (r: { history: Session[]; clock: WorkoutClock | null; cleared: number[]; saved: Session | null }) => {
    const changed = new Set([r.saved?.id, todaysSession(r.history)?.id]);
    for (const s of r.history) if (changed.has(s.id)) await repo.saveSession(db, s);
    for (const d of r.cleared) await repo.setKv(db, repo.draftKey(d), null);
    await repo.setKv(db, repo.KEYS.clock, r.clock);
    update(x => {
      const drafts = { ...x.drafts };
      r.cleared.forEach(d => delete drafts[d]);
      return { ...x, history: r.history, drafts, clock: r.clock };
    });
  };

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
    setProgram: async program => {
      const plan: Plan = JSON.parse(JSON.stringify(activePlan));
      if (program) plan.program = program;
      else delete plan.program;
      await repo.setKv(db, repo.KEYS.plan, plan);
      update(s => ({ ...s, plan }));
    },
    setGoal: async (dayIdx, exIdx, swapped, goal) => {
      const plan: Plan = JSON.parse(JSON.stringify(activePlan));
      const target = plan.days[dayIdx]?.exercises[exIdx];
      if (!target) return;
      if (swapped && target.alt) target.alt.goal = goal;
      else target.goal = goal;
      await repo.setKv(db, repo.KEYS.plan, plan);
      update(s => ({ ...s, plan }));
    },
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
    setEffort: async (id, effort) => {
      const found = state.history.find(h => h.id === id);
      if (!found) return;
      const session = { ...found };
      if (effort) session.effort = effort;
      else delete session.effort;
      await repo.saveSession(db, session);
      update(s => ({ ...s, history: s.history.map(h => (h.id === id ? session : h)) }));
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
      const result = saveDays([dayIdx], Date.now());
      if (!result.saved) return null;
      await commitSaved(result);
      return result.saved;
    },
    setClock: clock => {
      update(s => ({ ...s, clock }));
      background(repo.setKv(db, repo.KEYS.clock, clock));
    },
    finishWorkout: async (dayIdx, extra = {}) => {
      const now = Date.now();
      const today = localDateStr(new Date(now));
      const draftDate = (d: number) => (state.drafts[d] ? localDateStr(new Date(state.drafts[d].startedAt)) : null);
      const fromEarlier = hasDraft(state.drafts[dayIdx] ?? null) && draftDate(dayIdx) !== today;
      const others = Object.keys(state.drafts).map(Number).filter(d => d !== dayIdx && hasDraft(state.drafts[d]) && draftDate(d) === today);
      const result = saveDays(fromEarlier ? [dayIdx] : [dayIdx, ...others], now);
      if (!fromEarlier) {
        // Time since the last save still belongs to today's workout; then the clock stops
        result.history = finishClock(result.history, result.clock, now);
        result.clock = null;
      }
      // A day with nothing logged keeps no draft
      if (!hasDraft(state.drafts[dayIdx] ?? null) && state.drafts[dayIdx]) result.cleared.push(dayIdx);
      // From the Finish screen: how hard it was, and calories
      const target = result.saved ? result.history.find(h => h.id === result.saved!.id) : todaysSession(result.history, new Date(now));
      if (target && (extra.effort || extra.calories)) {
        const withExtra = { ...target, ...(extra.effort ? { effort: extra.effort } : {}), ...(extra.calories ? { calories: extra.calories } : {}) };
        result.history = result.history.map(h => (h.id === target.id ? withExtra : h));
        if (!result.saved) result.saved = withExtra;
      }
      await commitSaved(result);
      return result.saved ? result.history.find(h => h.id === result.saved!.id) ?? result.saved : todaysSession(result.history, new Date(now));
    },
    updateProfile: async patch => {
      const profile = { ...(state.profile || {}), ...patch };
      await repo.setKv(db, repo.KEYS.profile, profile);
      update(s => ({ ...s, profile }));
    },
    resetAll: async () => {
      await repo.resetAll(db);
      setState({ history: [], bodyweight: [], profile: null, plan: null, warmups: {}, settings: {}, drafts: {}, swaps: {}, restTimer: null, clock: null });
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
