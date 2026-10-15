// Ready-made plans, filtered by type, with each one's days before you use it.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { templatePlan, templateType, TEMPLATES, TEMPLATE_TYPES, type Template, type TemplateType } from '@/core/templates';
import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';
import { Button } from '@/ui/button';
import { Choices } from '@/ui/fields';
import { haptic } from '@/ui/haptics';
import { Header } from '@/ui/parts';
import { Card, Screen } from '@/ui/screen';
import { Body, Mono, Title } from '@/ui/text';
import { useToast } from '@/ui/toast';

export default function TemplatesScreen() {
  const { theme } = useTheme();
  const [filter, setFilter] = useState<TemplateType | 'all'>('all');
  const shown = TEMPLATES.filter(t => filter === 'all' || templateType(t) === filter);
  return (
    <Screen tabBar={false}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
        <Body color={theme.colors.accent}>‹ Plan</Body>
      </Pressable>
      <Header eyebrow="New plan" title="Ready-made plans" sub="Proven programmes. Switching keeps your history and records." />
      <Choices value={filter} onChange={setFilter} options={TEMPLATE_TYPES.map(([value, label]) => ({ value, label }))} />
      {shown.map(t => <TemplateCard key={t.id} t={t} />)}
    </Screen>
  );
}

function TemplateCard({ t }: { t: Template }) {
  const { activePlan, plan, choosePlan } = useData();
  const { theme } = useTheme();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const c = theme.colors;
  const current = activePlan.templateId === t.id;
  const use = async () => {
    const previous = plan;
    await choosePlan(templatePlan(t));
    haptic('success');
    toast(`Now using ${t.name}`, { actionLabel: 'Undo', onAction: () => { choosePlan(previous); } });
    router.back();
  };
  // Only the top part toggles the card, so the Use button isn't a button inside a button
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: theme.radius, borderWidth: 1, borderColor: current ? c.accent : c.line, overflow: 'hidden' }}>
      <Pressable onPress={() => setOpen(o => !o)} accessibilityRole="button" aria-expanded={open}
        style={({ pressed }) => ({ backgroundColor: pressed ? c.surfaceHigh : 'transparent', padding: 16, gap: 6 })}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <Title size={22} style={{ flex: 1 }}>{t.name}</Title>
          {current && <Mono style={{ fontSize: 11 }} color={c.accent}>IN USE</Mono>}
        </View>
        <Mono color={t.creator ? c.record : c.accent}>{t.creator ? "Creator's plan · " : ''}{t.days} days · ~{t.minutes} min · {t.level}</Mono>
        <Body color={c.inkSoft}>{t.blurb}</Body>
      </Pressable>
      {open && (
        <View style={{ gap: 8, paddingHorizontal: 16, paddingBottom: 16 }}>
          {templatePlan(t).days.map(d => (
            <Card key={d.day}>
              <Mono color={c.accent}>{d.day} · {d.title}</Mono>
              <Body style={{ fontSize: 14 }} color={c.inkSoft}>{d.exercises.map(e => e.name).join(' · ')}</Body>
            </Card>
          ))}
          <Button label={current ? `Restart ${t.name}` : `Use ${t.name}`} kind="primary" onPress={use} />
        </View>
      )}
    </View>
  );
}
