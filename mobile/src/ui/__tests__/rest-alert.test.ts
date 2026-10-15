/// <reference types="jest" />
// The lock-screen alert follows the rest timer: booked at its end, moved when it changes, cancelled when it stops.
const mockScheduled: Record<string, { body: string; date: number }> = {};
let mockGranted = true;
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => {}),
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  getPermissionsAsync: jest.fn(async () => ({ granted: mockGranted, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: mockGranted })),
  cancelScheduledNotificationAsync: jest.fn(async (id: string) => { delete mockScheduled[id]; }),
  scheduleNotificationAsync: jest.fn(async (req: { identifier: string; content: { body: string }; trigger: { date: number } }) => {
    mockScheduled[req.identifier] = { body: req.content.body, date: req.trigger.date };
    return req.identifier;
  })
}));

// eslint-disable-next-line import/first
import { syncRestAlert } from '../rest-alert';

test('booked, moved and cancelled with the timer', async () => {
  const end = Date.now() + 90_000;
  await syncRestAlert({ endAt: end, total: 90, next: 'Next: Set 2 · 50 kg × 8' });
  expect(mockScheduled['rest-timer']).toEqual({ body: 'Next up: Set 2 · 50 kg × 8', date: end });
  await syncRestAlert({ endAt: end + 15_000, total: 105, next: 'Next: Set 2 · 50 kg × 8' });
  expect(Object.keys(mockScheduled)).toEqual(['rest-timer']);
  expect(mockScheduled['rest-timer'].date).toBe(end + 15_000);
  await syncRestAlert(null);
  expect(mockScheduled).toEqual({});
  // A timer about to end needs no alert
  await syncRestAlert({ endAt: Date.now() + 500, total: 60, next: '' });
  expect(mockScheduled).toEqual({});
});

test('nothing is booked without permission, and nothing breaks', async () => {
  jest.resetModules();
  mockGranted = false;
  const { syncRestAlert: sync } = jest.requireActual('../rest-alert');
  await expect(sync({ endAt: Date.now() + 60_000, total: 60, next: 'x' })).resolves.toBeUndefined();
  expect(mockScheduled).toEqual({});
});
