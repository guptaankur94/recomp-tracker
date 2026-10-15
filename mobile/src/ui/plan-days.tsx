// A plan's days at a glance: name, weekdays and exercises (preview before using a plan).
import { View } from 'react-native';

import { dayColor } from '@/core/history';
import { planSchedule, weekdaysFor } from '@/core/schedule';
import type { Plan } from '@/core/types';
import { useTheme } from '@/theme/theme-context';

import { Card } from './screen';
import { Body, Mono } from './text';

export function PlanDays({ plan }: { plan: Plan }) {
  const { theme } = useTheme();
  const schedule = planSchedule(plan, plan.days.length);
  return (
    <View style={{ gap: 8 }}>
      {plan.days.map((d, i) => {
        const wd = weekdaysFor(i, schedule, plan.days.length);
        return (
          <Card key={i}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dayColor(d.day) ?? theme.colors.accent }} />
              <Mono color={theme.colors.accent}>{d.day}{wd.length ? ` · ${wd.join(' / ')}` : ''}</Mono>
            </View>
            <Body bold>{d.title}</Body>
            <Body style={{ fontSize: 14 }} color={theme.colors.inkSoft}>{d.exercises.map(e => e.name).join(' · ')}</Body>
          </Card>
        );
      })}
    </View>
  );
}
