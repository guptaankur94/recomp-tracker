// Backups: the same JSON file the web app makes, so a backup from either app restores in the other.
import { localDateStr } from './format';
import { normalizePlan } from './plan-import';
import { sortBodyweight } from './progress';
import { sortHistory } from './history';
import type { BodyweightEntry, Plan, Profile, Session } from './types';

export interface AppData {
  history: Session[];
  bodyweight: BodyweightEntry[];
  profile: Profile | null;
  plan: Plan | null;
}

export function buildBackupJson(data: AppData, now: Date = new Date()): string {
  return JSON.stringify({
    app: 'recomp-tracker',
    version: 2,
    exportedAt: now.toISOString(),
    history: data.history,
    bodyweight: data.bodyweight,
    profile: data.profile,
    plan: data.plan
  }, null, 2);
}

export interface RestoreResult {
  data: AppData;
  added: number;
  addedBw: number;
  /** Sessions in the backup that were already here */
  alreadyHere: number;
  /** What else was restored: 'profile', 'workout plan' */
  extras: string[];
}

/** Merges a backup into the current data. Entries already here are kept, so restoring the same backup
    twice is harmless; the profile and plan are restored only when there isn't one yet. Throws a message for the user. */
export function restoreBackup(text: string, current: AppData, { hasUnsavedSets = false } = {}): RestoreResult {
  let parsed: any;
  try {
    parsed = JSON.parse(String(text).trim());
  } catch {
    throw new Error("That isn't a valid backup. Make sure you copied the whole text, from the first { or [ to the last } or ].");
  }
  // Old backups are a plain array of sessions; new ones are { history, bodyweight, … }
  const importedHistory: any[] | null = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.history) ? parsed.history : null);
  const importedBw: any[] = parsed && Array.isArray(parsed.bodyweight) ? parsed.bodyweight : [];
  if (!importedHistory) throw new Error("This doesn't look like a Recomp backup.");

  const history = [...current.history];
  const knownIds = new Set(history.map(s => s.id));
  let added = 0;
  importedHistory
    .filter(s => s && typeof s.id === 'number' && Array.isArray(s.exercises) && !knownIds.has(s.id))
    .forEach(s => {
      history.push({
        ...s,
        dateStr: s.dateStr || localDateStr(new Date(s.id)),
        displayDate: s.displayDate || new Date(s.id).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        day: s.day || 'Day ?',
        title: s.title || 'Workout'
      });
      knownIds.add(s.id);
      added++;
    });

  const bodyweight = [...current.bodyweight];
  const knownDates = new Set(bodyweight.map(e => e.dateStr));
  let addedBw = 0;
  importedBw
    .filter(e => e && /^\d{4}-\d{2}-\d{2}$/.test(e.dateStr) && typeof e.kg === 'number' && !knownDates.has(e.dateStr))
    .forEach(e => {
      bodyweight.push({ dateStr: e.dateStr, kg: e.kg });
      knownDates.add(e.dateStr);
      addedBw++;
    });

  const extras: string[] = [];
  let { profile, plan } = current;
  if (parsed && parsed.profile && typeof parsed.profile === 'object' && !profile) {
    profile = parsed.profile;
    extras.push('profile');
  }
  if (parsed && parsed.plan && !plan && !hasUnsavedSets) {
    try {
      plan = normalizePlan(parsed.plan);
      extras.push('workout plan');
    } catch {
      // A broken plan in the backup doesn't stop the workouts restoring
    }
  }
  return {
    data: { history: sortHistory(history), bodyweight: sortBodyweight(bodyweight), profile, plan },
    added, addedBw, alreadyHere: importedHistory.length - added, extras
  };
}

export function restoreMessage({ added, addedBw, alreadyHere, extras }: RestoreResult): string {
  return `Backup restored: ${added} workout${added === 1 ? '' : 's'} and ${addedBw} weight entr${addedBw === 1 ? 'y' : 'ies'} added` +
    (extras.length ? `, plus your ${extras.join(' and ')}` : '') + '.' +
    (alreadyHere > 0 ? ` ${alreadyHere} already here.` : '');
}
