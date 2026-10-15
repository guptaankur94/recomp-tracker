// Workout: today's plan day. (Preview: the first ready-made plan, until saved data arrives.)
import { View } from 'react-native';

import { fmtClock } from '@/core/format';
import { upNextDayIdx } from '@/core/schedule';
import { templatePlan, TEMPLATES } from '@/core/templates';
import { warmupSets } from '@/core/workout';
import { useTheme } from '@/theme/theme-context';
import { Body, Eyebrow, Mono, Title } from '@/ui/text';
import { Card, Screen } from '@/ui/screen';

const plan = templatePlan(TEMPLATES[0]);

export default function WorkoutScreen() {
  const { theme } = useTheme();
  const dayIdx = upNextDayIdx(plan.days, null, []);
  const day = plan.days[dayIdx];
  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <Eyebrow>Workout · {day.day}</Eyebrow>
        <Title>{day.title}</Title>
        <Mono>{plan.planName} · {day.exercises.length} exercises</Mono>
      </View>
      {day.exercises.map((ex, i) => {
        const warmups = warmupSets(ex, i, 0, null);
        return (
          <Card key={ex.name} accent={i === 0}>
            <Title size={22}>{ex.name}</Title>
            <Mono color={theme.colors.accent}>{ex.sets} × {ex.repTarget} · rest {fmtClock(ex.rest)}</Mono>
            {warmups.length > 0 && <Mono>Warm-up: {warmups.map(w => w.label).join(' → ')}</Mono>}
            {ex.cue && <Body color={theme.colors.inkSoft}>{ex.cue}</Body>}
          </Card>
        );
      })}
    </Screen>
  );
}
