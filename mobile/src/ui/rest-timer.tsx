// The rest timer: a bar above the tab bar while resting. It counts to an end time, so it stays right
// with the app in the background or closed; a timer that ran out meanwhile ends quietly.
import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { fmtClock } from '@/core/format';
import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';

import { nowMs } from './clock';
import { syncRestActivity } from '@/widgets/rest-live';

import { syncRestAlert } from './rest-alert';
import { playSound } from './sound';
import { haptic } from './haptics';
import { Body, Mono } from './text';
import { useToast } from './toast';

const RING_R = 22;
const RING_C = 2 * Math.PI * RING_R;

export function RestTimerBar() {
  const { restTimer, setRestTimer, settings } = useData();
  const soundOn = settings.sound !== false;
  // The last second a tick played (not drawn, so a ref)
  const lastTick = useRef<number | null>(null);
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
  useEffect(() => { syncRestAlert(restTimer, soundOn); }, [restTimer, soundOn]);
  // The same countdown on the Lock Screen, Dynamic Island and Apple Watch
  useEffect(() => { syncRestActivity(restTimer); }, [restTimer]);

  const remaining = restTimer ? Math.max(0, restTimer.endAt - now) : 0;
  // A tick for each of the last three seconds
  const secLeft = Math.ceil(remaining / 1000);
  useEffect(() => {
    if (!restTimer || !soundOn || secLeft > 3 || secLeft < 1 || secLeft === lastTick.current || AppState.currentState !== 'active') return;
    lastTick.current = secLeft;
    playSound('tick');
  }, [restTimer, soundOn, secLeft]);

  useEffect(() => {
    if (!restTimer || remaining > 0) return;
    setRestTimer(null);
    lastTick.current = null;
    // Only announce it if the person is looking at the app
    if (AppState.currentState === 'active') {
      if (soundOn) playSound('chime');
      haptic('success');
      toast('Rest over. Time for your next set.');
    }
  }, [restTimer, remaining, setRestTimer, toast, soundOn]);

  if (!restTimer || remaining <= 0) return null;
  const sec = Math.ceil(remaining / 1000);
  const fraction = remaining / (restTimer.total * 1000);
  const ending = sec <= 3;
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
        style={{ width: 360, maxWidth: '92%', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 36, borderWidth: 1, borderColor: ending ? c.record : c.line, backgroundColor: c.bar }}>
        {/* The ring empties as rest runs down */}
        <View style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={52} height={52} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
            <Circle cx={26} cy={26} r={RING_R} stroke={c.line} strokeWidth={4} fill="none" />
            <Circle cx={26} cy={26} r={RING_R} stroke={ending ? c.record : c.accent} strokeWidth={4} fill="none" strokeLinecap="round"
              strokeDasharray={`${RING_C} ${RING_C}`} strokeDashoffset={RING_C * (1 - Math.max(0, Math.min(1, fraction)))} />
          </Svg>
          <Mono bold style={{ fontSize: 14 }} color={ending ? c.record : c.ink}>{fmtClock(sec)}</Mono>
        </View>
        <Body style={{ flex: 1, fontSize: 12 }} color={c.inkSoft} numberOfLines={2}>{restTimer.next}</Body>
        {btn('−15', () => adjust(-15), 'Rest 15 seconds less')}
        {btn('+15', () => adjust(15), 'Rest 15 seconds more')}
        {btn('Skip', () => { setRestTimer(null); haptic('light'); }, 'Skip rest')}
      </View>
    </Animated.View>
  );
}
