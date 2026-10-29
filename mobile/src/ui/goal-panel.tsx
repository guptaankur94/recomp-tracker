// The goal on an exercise card: the number to reach by the end of the program, big and gold, with where you are
// and what's left. Tap it to change it. With no number in the plan ("Moderate" machines), it asks you to set one.
import { Pressable, View } from 'react-native';

import { exerciseGoal, goalLabel, goalProgress, programStatus } from '@/core/goals';
import type { Plan, PlanExerciseBase, SavedSet } from '@/core/types';
import { useTheme } from '@/theme/theme-context';

import { Body, Mono } from './text';

interface Props {
  ex: Pick<PlanExerciseBase, 'name' | 'repTarget' | 'weightTarget' | 'goal'>;
  last: { sets: Pick<SavedSet, 'weight' | 'reps'>[] } | null;
  program: Plan['program'];
  /** Missing for exercises added for today only (not on the plan) */
  onEdit?: () => void;
}

export function GoalPanel({ ex, last, program, onEdit }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const gold = c.record;
  const goal = exerciseGoal(ex);
  if (!goal) {
    if (!onEdit) return null;
    return (
      <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Set your goal for ${ex.name}`}
        style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: theme.radius, borderWidth: 1, borderStyle: 'dashed', borderColor: gold, opacity: pressed ? 0.7 : 1 })}>
        <Body bold style={{ fontSize: 14 }} color={gold}>↑ Set your goal for {ex.name}</Body>
      </Pressable>
    );
  }
  const prog = goalProgress(goal, last);
  const status = programStatus(program);
  const label = status ? (status.ended ? 'PROGRAM GOAL' : `GOAL BY WEEK ${status.weeks}`) : 'YOUR GOAL';
  const pct = prog ? Math.round(prog.pct * 100) : 0;
  const now = prog ? (prog.best.weight > 0 ? `${prog.best.weight} kg × ${prog.best.reps}` : `${prog.best.reps}${goal.unit === 'sec' ? ' s' : ' reps'}`) : '';
  const sub = !prog ? 'First time: build towards it' : prog.reached ? 'Goal reached. Time to raise it.' : `Now ${now} · ${prog.toGo}`;
  return (
    <Pressable onPress={onEdit} disabled={!onEdit} accessibilityRole={onEdit ? 'button' : undefined}
      accessibilityLabel={`${label.toLowerCase()}: ${goalLabel(goal)}. ${sub}${onEdit ? '. Change goal' : ''}`}
      style={({ pressed }) => ({ padding: 14, gap: 6, borderRadius: theme.radius, borderWidth: 1, borderColor: gold, backgroundColor: c.surfaceHigh, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Mono bold style={{ fontSize: 11, letterSpacing: 1.2, flex: 1 }} color={gold}>{label}</Mono>
        {status && !status.ended && (
          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: c.accentSoft }}>
            <Mono bold style={{ fontSize: 11 }} color={c.ink}>Week {status.week} of {status.weeks}</Mono>
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
        <Mono bold style={{ fontSize: 30, flex: 1 }} color={gold}>{prog?.reached ? '✓ ' : ''}{goalLabel(goal)}</Mono>
        {prog && <Mono bold style={{ fontSize: 17 }} color={c.ink}>{pct}%</Mono>}
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: c.line, overflow: 'hidden' }}>
        <View style={{ height: 6, width: `${pct}%`, borderRadius: 3, backgroundColor: gold }} />
      </View>
      <Body style={{ fontSize: 13 }} color={c.inkSoft}>{sub}</Body>
    </Pressable>
  );
}
