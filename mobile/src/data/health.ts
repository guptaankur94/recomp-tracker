// No Apple Health outside iPhone builds (Android and the browser preview).
import type { HealthWeight } from '@/core/health';
import type { BodyweightEntry } from '@/core/types';

export const OWN_SOURCE = '';
export const healthAvailable = (): boolean => false;
export const connectHealth = async (): Promise<boolean> => false;
export const readHealthWeights = async (_sinceMs?: number): Promise<HealthWeight[]> => [];
export const saveHealthWeight = async (_entry: BodyweightEntry): Promise<void> => {};
