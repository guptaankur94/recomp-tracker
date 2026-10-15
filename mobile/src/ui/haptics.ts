// Taps you can feel. Quietly does nothing where there's no vibration motor (the browser preview).
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export function haptic(kind: 'light' | 'success' | 'error' = 'light') {
  if (Platform.OS === 'web') return;
  const done = kind === 'light'
    ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    : Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
  done.catch(() => {});
}
