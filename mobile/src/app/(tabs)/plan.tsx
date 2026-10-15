// Plan: your plan (its week, days and exercises; edit anything) and ways to start a different one.
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { dayColor } from '@/core/history';
import { changePlanPrompt, dayMinutes } from '@/core/plan-edit';
import { extractJson, normalizePlan } from '@/core/plan-import';
import { planSchedule, weekdaysFor, WEEKDAYS, WEEKDAY_NAMES } from '@/core/schedule';
import { pickTextFile } from '@/data/files';
import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';
import { Button } from '@/ui/button';
import { haptic } from '@/ui/haptics';
import { Header, SectionLabel } from '@/ui/parts';
import { Card, Screen } from '@/ui/screen';
import { Body, Mono, Title } from '@/ui/text';
import { useToast } from '@/ui/toast';

export default function PlanScreen() {
  const { activePlan, setPendingPlan } = useData();
  const { theme } = useTheme();
  const toast = useToast();
  const c = theme.colors;
  const days = activePlan.days;
  const schedule = planSchedule(activePlan, days.length);
  const total = days.reduce((n, d) => n + d.exercises.length, 0);

  const importFile = async () => {
    try {
      const text = await pickTextFile();
      if (text === null) return;
      setPendingPlan(normalizePlan(extractJson(text)));
      router.push('/plan-preview');
    } catch (e) {
      haptic('error');
      toast(e instanceof Error ? e.message : "Couldn't read that file.", { error: true, durationMs: 6000 });
    }
  };
  const copyForChatbot = async () => {
    await Clipboard.setStringAsync(changePlanPrompt(activePlan));
    haptic('success');
    toast('Plan copied. Paste it into a chatbot with your changes, then upload the file in Create with AI.', { durationMs: 6000 });
  };

  return (
    <Screen>
      <Header eyebrow="Plan" title={activePlan.planName}
        sub={`${days.length} day${days.length === 1 ? '' : 's'} · ${total} exercises · ${schedule ? 'weekly schedule' : 'rotates in order'}`} />
      {schedule && (
        <View accessibilityLabel="Weekly schedule" style={{ flexDirection: 'row', gap: 6 }}>
          {WEEKDAYS.map((w, i) => {
            const d = schedule[i];
            const on = Number.isInteger(d) && days[d as number];
            return (
              <View key={w} accessible accessibilityLabel={`${WEEKDAY_NAMES[i]}: ${on ? days[d as number].title : 'Rest'}`}
                style={{ flex: 1, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? dayColor(days[d as number].day) ?? c.accent : 'transparent', borderWidth: on ? 0 : 1, borderColor: c.line }}>
                <Mono bold={!!on} color={on ? '#FFFFFF' : c.muted}>{w[0]}</Mono>
              </View>
            );
          })}
        </View>
      )}
      <Card>
        <Body color={c.inkSoft} style={{ fontSize: 14 }}>This plan is yours. Change any day, exercise, set or rest time. Your history is kept.</Body>
        <Button label="Edit plan" kind="primary" onPress={() => router.push('/plan-editor')} style={{ marginTop: 6 }} />
      </Card>

      <SectionLabel>Days</SectionLabel>
      {days.map((d, i) => {
        const when = weekdaysFor(i, schedule, days.length);
        const names = d.exercises.map(e => e.name);
        return (
          <View key={d.day} style={{ backgroundColor: c.surface, borderRadius: theme.radius, borderWidth: 1, borderColor: c.line }}>
            <Pressable onPress={() => router.push({ pathname: '/plan-editor', params: { day: String(i) } })} accessibilityRole="button" accessibilityLabel={`Edit ${d.day}, ${d.title}`}
              style={({ pressed }) => ({ padding: 16, gap: 6, opacity: pressed ? 0.75 : 1 })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: dayColor(d.day) ?? c.accent }}>
                  <Mono bold color="#FFFFFF">{i + 1}</Mono>
                </View>
                <View style={{ flex: 1 }}>
                  <Title size={20}>{d.title}</Title>
                  <Mono style={{ fontSize: 12 }}>{when.length ? `${when.join(', ')} · ` : ''}{d.exercises.length} exercise{d.exercises.length === 1 ? '' : 's'} · ~{dayMinutes(d)} min</Mono>
                </View>
              </View>
              <Body style={{ fontSize: 14 }} color={c.inkSoft}>{names.slice(0, 4).join(' · ')}{names.length > 4 ? ` · +${names.length - 4} more` : ''}</Body>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 14 }}>
              <Button label="Start" onPress={() => router.navigate({ pathname: '/', params: { day: String(i) } })} style={{ flex: 1, minHeight: 38 }} />
              <Button label="Edit day" onPress={() => router.push({ pathname: '/plan-editor', params: { day: String(i) } })} style={{ flex: 1, minHeight: 38 }} />
            </View>
          </View>
        );
      })}

      <SectionLabel>Start a different plan</SectionLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Tile title="Build my own" sub="Pick days and exercises" onPress={() => router.push({ pathname: '/plan-editor', params: { build: String(Math.max(1, days.length)) } })} />
        <Tile title="Ready-made" sub="Proven programmes" onPress={() => router.push('/templates')} />
        <Tile title="Create with AI" sub="ChatGPT, Claude, Gemini" onPress={() => router.push('/ai-plan')} />
        <Tile title="Import a file" sub=".json or .txt plan" onPress={importFile} />
      </View>
      <Button label="Copy plan for a chatbot to change" onPress={copyForChatbot} />
      <Mono color={c.muted} style={{ textAlign: 'center', fontSize: 12 }}>Switching plans keeps your workout history and records.</Mono>
    </Screen>
  );
}

function Tile({ title, sub, onPress }: { title: string; sub: string; onPress: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`}
      style={({ pressed }) => ({ width: '47%', flexGrow: 1, minHeight: 84, padding: 14, gap: 4, borderRadius: theme.radius, borderWidth: 1, borderColor: c.line, backgroundColor: pressed ? c.surfaceHigh : c.surface, justifyContent: 'flex-end' })}>
      <Body bold>{title}</Body>
      <Body style={{ fontSize: 13 }} color={c.inkSoft}>{sub}</Body>
    </Pressable>
  );
}
