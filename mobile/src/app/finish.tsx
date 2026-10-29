// Finish: what's being saved (time, sets, volume, days), how hard it was (one tap, optional) and calories.
// Then the summary. "Keep training" goes back to the workout.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { clockActiveMs, collectSets, dayExercises, freshClock, hasDraft } from '@/core/draft';
import { fmtVolume, localDateStr } from '@/core/format';
import { MAX_CALORIES, parseCalories, sessionStats, todaysSession } from '@/core/history';
import { setVolume } from '@/core/workout';
import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';
import { EffortPicker } from '@/ui/effort-picker';
import { haptic } from '@/ui/haptics';
import { Header } from '@/ui/parts';
import { Screen } from '@/ui/screen';
import { Body, Mono } from '@/ui/text';
import { useToast } from '@/ui/toast';

export default function FinishScreen() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const dayIdx = Number(day) || 0;
  const { activePlan, history, drafts, swaps, clock, dayAt, finishWorkout } = useData();
  const { theme } = useTheme();
  const toast = useToast();
  const c = theme.colors;
  const [now] = useState(() => Date.now());
  const today = todaysSession(history, new Date(now));
  const [effort, setEffort] = useState<number | null>(today?.effort ?? null);
  const [kcal, setKcal] = useState(today?.calories ? String(today.calories) : '');

  // What will be saved: today's sets on every day (and what's already saved today)
  const todayStr = localDateStr(new Date(now));
  const customIdx = activePlan.days.length;
  const days = [...activePlan.days.map((_, i) => i), customIdx].filter(d => {
    const dr = drafts[d];
    return dr && hasDraft(dr) && localDateStr(new Date(dr.startedAt)) === todayStr;
  });
  let sets = today ? sessionStats(today).sets : 0;
  let volume = today ? sessionStats(today).volume : 0;
  days.forEach(d => {
    const dr = drafts[d] ?? null;
    const exercises = dayExercises(dayAt(d), dr, new Set(swaps[d] || []));
    collectSets(dr, exercises, dayAt(d).day, d === customIdx).forEach(ex => ex.sets.forEach(s => { sets++; volume += setVolume(s); }));
  });
  const running = freshClock(clock, now);
  const minutes = Math.max(1, Math.round(((today?.durationSec ?? 0) + (running ? Math.max(0, clockActiveMs(running, now) - (running.creditedMs || 0)) / 1000 : 0)) / 60));

  const finish = async () => {
    const parsed = parseCalories(kcal);
    if (!parsed.ok) {
      haptic('error');
      toast(`Enter calories between 1 and ${MAX_CALORIES}, or leave it empty`, { error: true });
      return;
    }
    const session = await finishWorkout(dayIdx, { effort, calories: parsed.kcal });
    if (!session) {
      router.back();
      return;
    }
    haptic('success');
    router.replace({ pathname: '/summary/[id]', params: { id: String(session.id) } });
  };
  const stat = (value: string, label: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
      <Mono bold style={{ fontSize: 18 }} color={c.ink}>{value}</Mono>
      <Body style={{ fontSize: 13 }} color={c.inkSoft}>{label}</Body>
    </View>
  );
  return (
    <Screen tabBar={false}>
      <Header eyebrow="Finish" title="Finish workout?" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        {stat(String(minutes), 'min')}
        {stat(String(sets), sets === 1 ? 'set' : 'sets')}
        {volume > 0 && stat(fmtVolume(volume), '')}
        {days.length > 0 && <Body style={{ fontSize: 13, alignSelf: 'center' }} color={c.inkSoft}>{days.map(d => (d === customIdx ? 'Custom' : `D${d + 1}`)).join(' + ')}</Body>}
      </View>
      <EffortPicker value={effort} onChange={setEffort} />
      <View style={{ gap: 8 }}>
        <Mono bold style={{ fontSize: 11, letterSpacing: 1 }} color={c.muted}>CALORIES BURNED · OPTIONAL</Mono>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TextInput value={kcal} onChangeText={setKcal} keyboardType="number-pad" placeholder="—" placeholderTextColor={c.muted} maxLength={4} accessibilityLabel="Calories burned, kcal"
            style={{ width: 100, height: 48, paddingHorizontal: 12, borderRadius: theme.radius, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, color: c.ink, fontFamily: theme.fonts.mono, fontSize: 18, textAlign: 'right', minWidth: 0 }} />
          <Body style={{ fontSize: 13, flex: 1 }} color={c.inkSoft}>kcal, active, from your watch</Body>
        </View>
      </View>
      <Pressable onPress={finish} accessibilityRole="button" accessibilityLabel="Finish workout"
        style={({ pressed }) => ({ height: 56, marginTop: 6, borderRadius: theme.radius, backgroundColor: c.done, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
        <Body bold style={{ fontSize: 18 }} color={c.onAccent}>✓ Finish workout</Body>
      </Pressable>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Keep training" style={{ alignSelf: 'center', padding: 10 }}>
        <Body color={c.inkSoft}>Keep training</Body>
      </Pressable>
    </Screen>
  );
}
