// The rest timer: a bar above the tab bar while resting. It counts to an end time, so it stays right
// with the app in the background or closed; a timer that ran out meanwhile ends quietly.
import { useEffect, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fmtClock } from '@/core/format';
import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';

import { nowMs } from './clock';
import { syncRestAlert } from './rest-alert';
import { haptic } from './haptics';
import { Body, Mono } from './text';
import { useToast } from './toast';

export function RestTimerBar() {
  const { restTimer, setRestTimer } = useData();
  const { theme } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(() => nowMs());
  const c = theme.colors;

  useEffect(() => {
    if (!restTimer) return;
    const id = setInterval(() => setNow(nowMs()), 250);
    return () => clearInterval(id);
  }, [restTimer]);

  // The lock-screen alert follows the timer: booked when it starts, moved by −15/+15, cancelled by Skip
  useEffect(() => { syncRestAlert(restTimer); }, [restTimer]);

  const remaining = restTimer ? Math.max(0, restTimer.endAt - now) : 0;
  useEffect(() => {
    if (!restTimer || remaining > 0) return;
    setRestTimer(null);
    // Only announce it if the person is looking at the app
    if (AppState.currentState === 'active') {
      haptic('success');
      toast('Rest over. Time for your next set.');
    }
  }, [restTimer, remaining, setRestTimer, toast]);

  if (!restTimer || remaining <= 0) return null;
  const sec = Math.ceil(remaining / 1000);
  const fraction = remaining / (restTimer.total * 1000);
  const adjust = (delta: number) => {
    const endAt = restTimer.endAt + delta * 1000;
    haptic('light');
    if (endAt <= nowMs()) setRestTimer(null);
    else setRestTimer({ ...restTimer, endAt, total: Math.max(restTimer.total, (endAt - nowMs()) / 1000) });
  };
  const btn = (label: string, onPress: () => void, a11y: string) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} hitSlop={4}
      style={({ pressed }) => ({ height: 36, minWidth: 44, paddingHorizontal: 8, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.accentSoft : c.surfaceHigh })}>
      <Mono bold color={c.ink}>{label}</Mono>
    </Pressable>
  );
  return (
    <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOutDown.duration(160)} pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom, 12) + 74, alignItems: 'center' }}>
      <View accessibilityRole="timer" accessibilityLabel={`Rest: ${fmtClock(sec)} left. ${restTimer.next}`}
        style={{ width: 360, maxWidth: '92%', borderRadius: theme.radius + 6, borderWidth: 1, borderColor: sec <= 3 ? c.record : c.accent, backgroundColor: c.bar, overflow: 'hidden' }}>
        <View style={{ height: 3, width: `${Math.max(0, Math.min(1, fraction)) * 100}%`, backgroundColor: sec <= 3 ? c.record : c.accent }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
          <Mono bold style={{ fontSize: 24, minWidth: 64 }} color={sec <= 3 ? c.record : c.accent}>{fmtClock(sec)}</Mono>
          <Body style={{ flex: 1, fontSize: 12 }} color={c.inkSoft} numberOfLines={2}>{restTimer.next}</Body>
          {btn('−15', () => adjust(-15), 'Rest 15 seconds less')}
          {btn('+15', () => adjust(15), 'Rest 15 seconds more')}
          {btn('Skip', () => { setRestTimer(null); haptic('light'); }, 'Skip rest')}
        </View>
      </View>
    </Animated.View>
  );
}
