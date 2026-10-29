// Plan: your plan (its week, days and exercises; edit anything) and ways to start a different one.
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { localDateStr } from '@/core/format';
import { PROGRAM_WEEKS, programStatus } from '@/core/goals';
import { dayColor } from '@/core/history';
import { changePlanPrompt, dayMinutes } from '@/core/plan-edit';
import { extractJson, normalizePlan } from '@/core/plan-import';
import { planSchedule, weekdaysFor, WEEKDAYS, WEEKDAY_NAMES } from '@/core/schedule';
import type { Plan } from '@/core/types';
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
  const { activePlan, setPendingPlan, setProgram } = useData();
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
      <ProgramCard program={activePlan.program} onStart={async weeks => {
        await setProgram({ weeks, startDate: localDateStr(new Date()) });
        haptic('success');
        toast(`Week 1 of ${weeks}. Your goals are on every exercise.`);
      }} onEnd={async () => { await setProgram(null); toast('Program ended. Your goals stay on each exercise.'); }} />

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
      <Button label="How Recomp works" onPress={() => router.push('/guide')} />
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

/** Train to a goal: start a program (8, 12 or 16 weeks), or see the week you're in */
function ProgramCard({ program, onStart, onEnd }: { program: Plan['program']; onStart: (weeks: number) => void; onEnd: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [choosing, setChoosing] = useState(false);
  const status = programStatus(program);
  const card = { padding: 16, gap: 10, borderRadius: theme.radius, borderWidth: 1, borderColor: c.record, backgroundColor: c.surface };
  if (!status || status.ended) {
    return (
      <View style={card}>
        <Body bold style={{ fontSize: 18 }} color={c.record}>{status?.ended ? 'Program complete' : 'Train to a goal'}</Body>
        <Body style={{ fontSize: 14 }} color={c.inkSoft}>{status?.ended ? 'See how close you got on each exercise, then start the next block.' : 'Start a 12-week program and every exercise shows the weight to reach by the end, with how close you are.'}</Body>
        {choosing ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {PROGRAM_WEEKS.map(w => <Button key={w} label={`${w} weeks`} kind={w === 12 ? 'primary' : 'secondary'} onPress={() => { setChoosing(false); onStart(w); }} style={{ flex: 1 }} />)}
          </View>
        ) : (
          <Button label={status?.ended ? 'Start the next program' : 'Start a program'} kind="primary" onPress={() => setChoosing(true)} />
        )}
        {status?.ended && <Button label="Clear" onPress={onEnd} />}
      </View>
    );
  }
  const [y, m, d] = status.endDate.split('-').map(Number);
  const end = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return (
    <View style={card}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Body bold style={{ fontSize: 18, flex: 1 }} color={c.record}>Week {status.week} of {status.weeks}</Body>
        <Mono style={{ fontSize: 12 }} color={c.inkSoft}>ends {end}</Mono>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: c.line, overflow: 'hidden' }}>
        <View style={{ height: 6, width: `${Math.round(((status.week - 1) / status.weeks) * 100)}%`, borderRadius: 3, backgroundColor: c.record }} />
      </View>
      <Body style={{ fontSize: 14 }} color={c.inkSoft}>Your goal for the end is on every exercise.</Body>
      <Button label="End program" onPress={onEnd} />
    </View>
  );
}
