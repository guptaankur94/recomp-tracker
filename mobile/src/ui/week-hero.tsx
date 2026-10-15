// Top of Workout: this week's workouts against the plan as a ring, the week streak, total workouts and latest
// weight with its 7-day change (toward the goal in the accent, away in the danger colour).
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { fmtNum } from '@/core/format';
import { weekSummary } from '@/core/history';
import { weightChange } from '@/core/progress';
import { planSchedule } from '@/core/schedule';
import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';

import { Body, Mono } from './text';

const R = 33;
const C = 2 * Math.PI * R;

export function WeekHero() {
  const { history, bodyweight, profile, activePlan } = useData();
  const { theme } = useTheme();
  const c = theme.colors;
  const s = weekSummary(history, activePlan.days.length, planSchedule(activePlan, activePlan.days.length));
  const goalKg = profile?.goalKg && profile.goalKg > 0 ? profile.goalKg : null;
  const w = weightChange(bodyweight, goalKg);
  const left = s.target - s.done;
  const weightLabel = !w ? 'Log weight' : w.diff === null ? 'Weight' : w.diff === 0 ? '±0 · 7d' : `${w.diff > 0 ? '↑' : '↓'}${fmtNum(Math.abs(w.diff))} · 7d`;
  const stat = (value: string, unit: string, label: string, color?: string) => (
    <View style={{ flex: 1, gap: 2 }}>
      <Mono bold color={c.ink} style={{ fontSize: 17 }}>{value}{unit ? <Mono style={{ fontSize: 11 }}> {unit}</Mono> : null}</Mono>
      <Body style={{ fontSize: 12 }} color={color ?? c.muted} numberOfLines={1}>{label}</Body>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderRadius: theme.radius, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface }}>
      <View accessible accessibilityLabel={`${s.done} of ${s.target} workouts this week`} style={{ width: 76, height: 76, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={76} height={76} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={38} cy={38} r={R} stroke={c.line} strokeWidth={6} fill="none" />
          <Circle cx={38} cy={38} r={R} stroke={c.accent} strokeWidth={6} fill="none" strokeLinecap="round"
            strokeDasharray={`${C} ${C}`} strokeDashoffset={C * (1 - Math.min(1, s.done / Math.max(1, s.target)))} />
        </Svg>
        <Mono bold color={c.ink} style={{ fontSize: 18 }}>{s.done}<Mono style={{ fontSize: 12 }}>/{s.target}</Mono></Mono>
        <Mono style={{ fontSize: 9 }} color={c.muted}>THIS WEEK</Mono>
      </View>
      <View style={{ flex: 1, gap: 10 }}>
        <Body bold>{left <= 0 ? 'Week complete. Nice work.' : `${left} workout${left === 1 ? '' : 's'} to go this week`}</Body>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {stat(String(s.streak), 'wk', 'Streak')}
          {stat(String(s.workouts), '', 'Workouts')}
          <Pressable onPress={() => router.navigate('/progress')} accessibilityRole="button" accessibilityLabel={w ? `Weight ${fmtNum(w.kg)} kg, ${weightLabel}` : 'Log your weight'} style={{ flex: 1 }}>
            {stat(w ? fmtNum(w.kg) : '—', w ? 'kg' : '', weightLabel, w?.tone === 'good' ? c.accent : w?.tone === 'bad' ? c.danger : undefined)}
          </Pressable>
        </View>
        {!profile && (
          <Pressable onPress={() => router.push('/profile')} accessibilityRole="button">
            <Body style={{ fontSize: 13 }} color={c.accent}>Set up your profile for goal and nutrition targets ›</Body>
          </Pressable>
        )}
      </View>
    </View>
  );
}
