// Set or change an exercise's goal: the weight × reps to reach by the end of the program. Saved on the plan.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput } from 'react-native';

import { dayExercises } from '@/core/draft';
import { exerciseGoal, goalLabel, parseGoalText } from '@/core/goals';
import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';
import { Button } from '@/ui/button';
import { haptic } from '@/ui/haptics';
import { Header } from '@/ui/parts';
import { Screen } from '@/ui/screen';
import { Body, Mono } from '@/ui/text';
import { useToast } from '@/ui/toast';

export default function GoalScreen() {
  const params = useLocalSearchParams<{ day: string; ex: string; swapped?: string }>();
  const dayIdx = Number(params.day) || 0;
  const exIdx = Number(params.ex) || 0;
  const { dayAt, drafts, swaps, setGoal } = useData();
  const { theme } = useTheme();
  const toast = useToast();
  const c = theme.colors;
  const ex = dayExercises(dayAt(dayIdx), drafts[dayIdx] ?? null, new Set(swaps[dayIdx] || []))[exIdx];
  const current = ex ? exerciseGoal(ex) : null;
  const [text, setText] = useState(current ? goalLabel(current) : '');
  if (!ex) {
    return (
      <Screen tabBar={false}>
        <Body color={c.inkSoft}>This exercise isn&apos;t in your plan any more.</Body>
        <Button label="Back" onPress={() => router.back()} />
      </Screen>
    );
  }
  const save = async () => {
    const goal = parseGoalText(text);
    if (!goal) {
      haptic('error');
      toast('Type it like 60 kg × 8, or 15 for reps only', { error: true });
      return;
    }
    await setGoal(dayIdx, exIdx, ex.swapped, goal);
    haptic('success');
    const set = exerciseGoal({ ...ex, goal });
    toast(`Goal set: ${set ? goalLabel(set) : text}`);
    router.back();
  };
  return (
    <Screen tabBar={false}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={10} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
        <Body color={c.accent}>‹ Cancel</Body>
      </Pressable>
      <Header eyebrow="Your goal" title={ex.name} sub="The weight × reps to reach by the end of your program, e.g. 60 kg × 8. For bodyweight moves, just the reps." />
      <TextInput value={text} onChangeText={setText} placeholder="e.g. 60 kg × 8" placeholderTextColor={c.muted} autoFocus accessibilityLabel="Goal"
        onSubmitEditing={save} returnKeyType="done"
        style={{ height: 64, paddingHorizontal: 16, borderRadius: theme.radius, borderWidth: 1, borderColor: c.record, backgroundColor: c.surface, color: c.record, fontFamily: theme.fonts.mono, fontSize: 28, minWidth: 0 }} />
      <Mono color={c.muted} style={{ fontSize: 12 }}>Plan target: {ex.sets} × {ex.repTarget} · {ex.weightTarget}</Mono>
      <Button label="Save goal" kind="primary" onPress={save} />
    </Screen>
  );
}
