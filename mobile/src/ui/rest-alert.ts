// The "rest over" alert for when the phone is locked or another app is open. Rest is a timestamp, so the alert
// is booked for that moment and moved or cancelled whenever the timer changes. While Recomp is on screen the
// alert stays silent: the timer bar and a toast already say it.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { RestTimer } from '@/data/repo';

const ID = 'rest-timer';
const CHANNEL = 'rest';
const native = Platform.OS !== 'web';

if (native) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false })
  });
}

let ready: Promise<boolean> | null = null;

/** Asks once (the first time rest starts); afterwards the answer is remembered by the system */
function allowed(): Promise<boolean> {
  ready ??= (async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Rest timer', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 200, 100, 200] });
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  })().catch(() => false);
  return ready;
}

export async function syncRestAlert(timer: RestTimer | null): Promise<void> {
  if (!native) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(ID);
    if (!timer || timer.endAt <= Date.now() + 1000 || !(await allowed())) return;
    await Notifications.scheduleNotificationAsync({
      identifier: ID,
      content: { title: 'Rest over', body: timer.next.replace(/^Next: /, 'Next up: '), sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: timer.endAt, channelId: CHANNEL }
    });
  } catch {
    // Alerts are a nicety: the in-app timer still works without them
  }
}
