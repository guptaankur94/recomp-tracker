// Add an exercise to today's workout only (the plan stays as it is).
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable } from 'react-native';

import { addExtra, type ExtraExercise } from '@/core/draft';
import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';
import { nowMs } from '@/ui/clock';
import { ExercisePicker } from '@/ui/exercise-picker';
import { haptic } from '@/ui/haptics';
import { Header } from '@/ui/parts';
import { Screen } from '@/ui/screen';
import { Body } from '@/ui/text';
import { useToast } from '@/ui/toast';

export default function AddExerciseScreen() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const dayIdx = Number(day) || 0;
  const { activePlan, history, drafts, dayAt, setDraft } = useData();
  const { theme } = useTheme();
  const toast = useToast();
  const target = dayAt(dayIdx);
  const add = (ex: ExtraExercise) => {
    setDraft(dayIdx, addExtra(drafts[dayIdx] ?? null, ex, nowMs()));
    haptic('success');
    toast(`${ex.name} added${ex.fromDay ? ` from ${ex.fromDay}` : ''}`);
    router.back();
  };
  return (
    <Screen tabBar={false}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={10} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
        <Body color={theme.colors.accent}>‹ Cancel</Body>
      </Pressable>
      <Header eyebrow={`Add to ${target.day === 'Custom' ? 'your custom workout' : target.day}`} title="Add exercise" sub="For today only. Your plan stays as it is." />
      <ExercisePicker planDays={activePlan.days.map((d, i) => ({ day: d, idx: i })).filter(x => x.idx !== dayIdx)} history={history} onPick={add} />
    </Screen>
  );
}
