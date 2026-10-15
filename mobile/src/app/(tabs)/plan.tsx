// Plan: the plan in use (its days and when they fall) and the ready-made plans to switch to.
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { fmtClock } from '@/core/format';
import { planSchedule, weekdaysFor } from '@/core/schedule';
import { templatePlan, templateType, TEMPLATES, TEMPLATE_TYPES, type Template, type TemplateType } from '@/core/templates';
import type { PlanDay } from '@/core/types';
import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';
import { Button } from '@/ui/button';
import { Header, SectionLabel } from '@/ui/parts';
import { Card, Screen } from '@/ui/screen';
import { Body, Mono, Title } from '@/ui/text';
import { useToast } from '@/ui/toast';

export default function PlanScreen() {
  const { activePlan } = useData();
  const { theme } = useTheme();
  const [filter, setFilter] = useState<TemplateType | 'all'>('all');
  const [openDay, setOpenDay] = useState<number | null>(null);
  const c = theme.colors;
  const schedule = planSchedule(activePlan, activePlan.days.length);
  const shown = TEMPLATES.filter(t => filter === 'all' || templateType(t) === filter);
  return (
    <Screen>
      <Header eyebrow="Plan" title={activePlan.planName} sub={`${activePlan.days.length} training day${activePlan.days.length === 1 ? '' : 's'} a week`} />
      {activePlan.days.map((d, i) => (
        <DayCard key={d.day} day={d} weekdays={weekdaysFor(i, schedule, activePlan.days.length)} open={openDay === i} onToggle={() => setOpenDay(o => (o === i ? null : i))} />
      ))}
      <SectionLabel>Ready-made plans</SectionLabel>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {TEMPLATE_TYPES.map(([id, label]) => {
          const on = filter === id;
          return (
            <Pressable key={id} onPress={() => setFilter(id)} accessibilityRole="radio" aria-checked={on}
              style={{ paddingHorizontal: 14, height: 34, justifyContent: 'center', borderRadius: 17, borderWidth: 1, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : 'transparent' }}>
              <Body bold={on} style={{ fontSize: 14 }} color={on ? c.ink : c.inkSoft}>{label}</Body>
            </Pressable>
          );
        })}
      </View>
      {shown.map(t => <TemplateCard key={t.id} t={t} />)}
    </Screen>
  );
}

function DayCard({ day, weekdays, open, onToggle }: { day: PlanDay; weekdays: string[]; open: boolean; onToggle: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable onPress={onToggle} accessibilityRole="button" aria-expanded={open}
      style={({ pressed }) => ({ backgroundColor: pressed ? c.surfaceHigh : c.surface, borderRadius: theme.radius, borderWidth: 1, borderColor: c.line, padding: 16, gap: 6 })}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Mono color={c.accent}>{day.day}{weekdays.length ? ` · ${weekdays.join(' / ')}` : ''}</Mono>
        <Mono>{day.exercises.length} exercises</Mono>
      </View>
      <Title size={21}>{day.title}</Title>
      {open && day.exercises.map(ex => (
        <View key={ex.name} style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 8, gap: 2 }}>
          <Body bold>{ex.name}</Body>
          <Mono style={{ fontSize: 12 }}>{ex.sets} × {ex.repTarget} · {ex.weightTarget} · rest {fmtClock(ex.rest)}</Mono>
          {ex.alt && <Mono style={{ fontSize: 12 }} color={c.muted}>Swap: {ex.alt.name}</Mono>}
        </View>
      ))}
    </Pressable>
  );
}

function TemplateCard({ t }: { t: Template }) {
  const { activePlan, plan, choosePlan } = useData();
  const { theme } = useTheme();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const c = theme.colors;
  const current = activePlan.templateId === t.id;
  const days = open ? templatePlan(t).days : [];
  const use = async () => {
    const previous = plan;
    await choosePlan(templatePlan(t));
    setOpen(false);
    toast(`Now using ${t.name}`, { actionLabel: 'Undo', onAction: () => { choosePlan(previous); } });
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
          {days.map(d => (
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
