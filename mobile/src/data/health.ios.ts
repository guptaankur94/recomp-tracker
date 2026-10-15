// Apple Health (iPhone builds): reads body weight into the app and saves weigh-ins typed here.
import {
  isHealthDataAvailable, queryQuantitySamples, requestAuthorization, saveQuantitySample
} from '@kingstinct/react-native-healthkit';
import Constants from 'expo-constants';

import { HEALTH_SYNC_DAYS, type HealthWeight } from '@/core/health';
import { dateStrMs } from '@/core/format';
import type { BodyweightEntry } from '@/core/types';

const BODY_MASS = 'HKQuantityTypeIdentifierBodyMass';

export const OWN_SOURCE = Constants.expoConfig?.ios?.bundleIdentifier ?? 'com.guptaankur.recomp';

export function healthAvailable(): boolean {
  try {
    return isHealthDataAvailable();
  } catch {
    return false;
  }
}

/** Asks for permission (iPhone shows its sheet the first time); false when it couldn't be asked */
export async function connectHealth(): Promise<boolean> {
  return requestAuthorization({ toRead: [BODY_MASS], toShare: [BODY_MASS] });
}

export async function readHealthWeights(sinceMs: number = Date.now() - HEALTH_SYNC_DAYS * 864e5): Promise<HealthWeight[]> {
  // Asking again is free once answered, and reading without having asked would crash
  await connectHealth();
  const samples = await queryQuantitySamples(BODY_MASS, { limit: 0, unit: 'kg', filter: { date: { startDate: new Date(sinceMs) } } });
  return samples.map(s => ({ kg: s.quantity, at: s.startDate, source: s.sourceRevision?.source?.bundleIdentifier }));
}

/** Saves a weigh-in at midday on its date (Health needs a time; the app only keeps the day) */
export async function saveHealthWeight(entry: BodyweightEntry): Promise<void> {
  await connectHealth();
  const at = new Date(dateStrMs(entry.dateStr) + 12 * 3600e3);
  await saveQuantitySample(BODY_MASS, 'kg', entry.kg, at, at);
}
