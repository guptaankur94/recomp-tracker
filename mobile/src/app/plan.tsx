// Plan: the ready-made plans, filtered by type.
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { templateType, TEMPLATES, TEMPLATE_TYPES, type TemplateType } from '@/core/templates';
import { useTheme } from '@/theme/theme-context';
import { Body, Eyebrow, Mono, Title } from '@/ui/text';
import { Card, Screen } from '@/ui/screen';

export default function PlanScreen() {
  const { theme } = useTheme();
  const [filter, setFilter] = useState<TemplateType | 'all'>('all');
  const shown = TEMPLATES.filter(t => filter === 'all' || templateType(t) === filter);
  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <Eyebrow>Plan</Eyebrow>
        <Title>Ready-made plans</Title>
      </View>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {TEMPLATE_TYPES.map(([id, label]) => {
          const on = filter === id;
          return (
            <Pressable key={id} onPress={() => setFilter(id)} accessibilityRole="radio" accessibilityState={{ selected: on }}
              style={{ paddingHorizontal: 14, height: 34, justifyContent: 'center', borderRadius: 17, borderWidth: 1, borderColor: on ? theme.colors.accent : theme.colors.line, backgroundColor: on ? theme.colors.accentSoft : 'transparent' }}>
              <Body bold={on} style={{ fontSize: 14 }} color={on ? theme.colors.ink : theme.colors.inkSoft}>{label}</Body>
            </Pressable>
          );
        })}
      </View>
      {shown.map(t => (
        <Card key={t.id}>
          <Title size={22}>{t.name}</Title>
          <Mono color={t.creator ? theme.colors.record : theme.colors.accent}>{t.creator ? "Creator's plan · " : ''}{t.days} days · ~{t.minutes} min · {t.level}</Mono>
          <Body color={theme.colors.inkSoft}>{t.blurb}</Body>
        </Card>
      ))}
    </Screen>
  );
}
