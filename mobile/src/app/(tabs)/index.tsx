// Workout: the plan's days with today's (or the next) one picked, and what to aim for in each exercise
// based on last time. Logging sets arrives in the next update.
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { fmtClock, fmtNum } from '@/core/format';
import { daysDoneThisWeek, getLastPerformance, todaysSession } from '@/core/history';
import { isRestDay, nextScheduled, planSchedule, scheduledDay, weekdayIdx, weekdaysFor, WEEKDAY_NAMES, upNextDayIdx } from '@/core/schedule';
import type { PlanExercise, Session } from '@/core/types';
import { avgRest, lastSetFor, progressionTip, roundRest, shortDayTitle, suggestSet, warmupSets } from '@/core/workout';
import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';
import { Header } from '@/ui/parts';
import { Card, Screen } from '@/ui/screen';
import { Body, Mono, Title } from '@/ui/text';

export default function WorkoutScreen() {
  const { activePlan, history } = useData();
  const { theme } = useTheme();
  const c = theme.colors;
  const days = activePlan.days;
  const schedule = planSchedule(activePlan, days.length);
  const next = upNextDayIdx(days, schedule, history);
  const [picked, setPicked] = useState<number | null>(null);
  const dayIdx = picked !== null && picked < days.length ? picked : next;
  const day = days[dayIdx];
  const done = daysDoneThisWeek(days, history);
  const today = scheduledDay(weekdayIdx(), schedule, days.length);
  const trainedToday = !!todaysSession(history);
  const rest = isRestDay(schedule, days.length) && picked === null;
  const upcoming = rest ? nextScheduled(schedule, days.length) : null;
  return (
    <Screen>
      <Header eyebrow={`Workout · ${activePlan.planName}`} title={day.title}
        sub={`${day.day}${weekdaysFor(dayIdx, schedule, days.length).length ? ` · ${weekdaysFor(dayIdx, schedule, days.length).join(' / ')}` : ''} · ${day.exercises.length} exercises`} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -20 }}>
        <View style={{ width: 12 }} />
        {days.map((d, i) => {
          const on = i === dayIdx;
          const badge = i === today && !trainedToday ? 'Today' : i === next && !done.has(d.day) ? 'Next' : '';
          const wd = weekdaysFor(i, schedule, days.length);
          return (
            <Pressable key={d.day} onPress={() => setPicked(i)} accessibilityRole="tab" aria-selected={on}
              accessibilityLabel={`${d.day}, ${d.title}${done.has(d.day) ? ', done this week' : ''}${badge ? `, ${badge}` : ''}`}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius, borderWidth: 1, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : c.surface, minWidth: 92, gap: 2 }}>
              <Mono style={{ fontSize: 11 }} color={on ? c.accent : c.muted}>{done.has(d.day) ? '✓ ' : ''}{wd.length ? wd.join('/') : `D${i + 1}`}{badge ? ` · ${badge}` : ''}</Mono>
              <Body bold={on} style={{ fontSize: 14 }} numberOfLines={1}>{shortDayTitle(d.title)}</Body>
            </Pressable>
          );
        })}
        <View style={{ width: 12 }} />
      </ScrollView>
      {rest && (
        <Card>
          <Body bold>Rest day</Body>
          <Body color={c.inkSoft}>{upcoming ? `Next up: ${days[upcoming.dayIdx].title} on ${WEEKDAY_NAMES[upcoming.w]}. ` : ''}Recovery is when the muscle gets built. Want to train anyway? This is the next day in your plan.</Body>
        </Card>
      )}
      {day.exercises.map((ex, i) => <ExerciseCard key={`${ex.name}-${i}`} ex={ex} index={i} history={history} />)}
      <Body color={c.muted} style={{ textAlign: 'center', fontSize: 13 }}>Logging sets arrives in the next update. Until then, keep logging in the web app and import your backup in Settings.</Body>
    </Screen>
  );
}

function ExerciseCard({ ex, index, history }: { ex: PlanExercise; index: number; history: Session[] }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const last = getLastPerformance(ex.name, history);
  const first = lastSetFor(last, 1);
  const suggestion = suggestSet(ex, first);
  const warmups = warmupSets(ex, index, 0, suggestion);
  const tip = progressionTip(ex, first, last ? roundRest(avgRest(last.sets)) : 0);
  return (
    <Card accent={index === 0}>
      <Title size={22}>{ex.name}</Title>
      <Mono color={c.accent}>{ex.sets} × {ex.repTarget} · {ex.weightTarget} · rest {fmtClock(ex.rest)}</Mono>
      {last ? (
        <Mono>Last time: {last.sets.map(s => (s.weight > 0 ? `${fmtNum(s.weight)}×${s.reps}` : `BW×${s.reps}`)).join(', ')}</Mono>
      ) : (
        <Mono color={c.muted}>First time: pick a weight you could lift 2 more reps with.</Mono>
      )}
      {suggestion && <Mono color={c.ink}>Aim: {suggestion.w > 0 ? `${fmtNum(suggestion.w)} kg` : 'BW'} × {suggestion.r}{tip ? ` · ${tip}` : ''}</Mono>}
      {warmups.length > 0 && <Mono>Warm-up: {warmups.map(w => w.label).join(' → ')}</Mono>}
      {ex.cue && <Body color={c.inkSoft}>{ex.cue}</Body>}
      {ex.alt && <Mono style={{ fontSize: 12 }} color={c.muted}>Swap: {ex.alt.name}</Mono>}
    </Card>
  );
}
