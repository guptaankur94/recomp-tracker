// Workout: pick the day (today's or the next one is picked for you), log each set, then save.
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import { dayExercises, dayProgress, hasDraft, removeExtra } from '@/core/draft';
import { fmtClock } from '@/core/format';
import { daysDoneThisWeek, todaysSession } from '@/core/history';
import { isRestDay, nextScheduled, planSchedule, scheduledDay, upNextDayIdx, weekdayIdx, weekdaysFor, WEEKDAY_NAMES } from '@/core/schedule';
import { shortDayTitle } from '@/core/workout';
import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';
import { Button } from '@/ui/button';
import { nowMs } from '@/ui/clock';
import { ExerciseCard } from '@/ui/exercise-card';
import { haptic } from '@/ui/haptics';
import { Header } from '@/ui/parts';
import { Card, Screen } from '@/ui/screen';
import { Body, Mono } from '@/ui/text';
import { useToast } from '@/ui/toast';

export default function WorkoutScreen() {
  const { activePlan, history, drafts, swaps, restTimer, dayAt, setDraft, setSwaps, saveDay } = useData();
  const { theme } = useTheme();
  const toast = useToast();
  const c = theme.colors;
  const days = activePlan.days;
  const customIdx = days.length;
  const schedule = planSchedule(activePlan, days.length);
  const next = upNextDayIdx(days, schedule, history);
  // Open on a day with unsaved sets, else the next one in the plan
  const [picked, setPicked] = useState<number | null>(() => {
    for (let i = 0; i <= days.length; i++) if (hasDraft(drafts[i] ?? null)) return i;
    return null;
  });
  // Plan → Start opens a given day
  const { day: dayParam } = useLocalSearchParams<{ day?: string }>();
  const [lastParam, setLastParam] = useState<string | undefined>(undefined);
  if (dayParam !== lastParam) {
    setLastParam(dayParam);
    if (dayParam !== undefined && Number(dayParam) <= customIdx) setPicked(Number(dayParam));
  }
  const dayIdx = picked !== null && picked <= customIdx ? picked : next;
  const day = dayAt(dayIdx);
  const isCustom = dayIdx === customIdx;
  const draft = drafts[dayIdx] ?? null;
  const daySwaps = new Set(swaps[dayIdx] || []);
  const exercises = dayExercises(day, draft, daySwaps);
  const progress = dayProgress(draft, exercises);
  const unsaved = hasDraft(draft);
  const done = daysDoneThisWeek(days, history);
  const today = scheduledDay(weekdayIdx(), schedule, days.length);
  const trainedToday = !!todaysSession(history);
  const rest = isRestDay(schedule, days.length) && picked === null && !unsaved;
  const upcoming = rest ? nextScheduled(schedule, days.length) : null;
  const wd = isCustom ? [] : weekdaysFor(dayIdx, schedule, days.length);

  const pick = (i: number) => { setPicked(i); haptic('light'); };
  const toggleSwap = (exIdx: number) => {
    const s = new Set(daySwaps);
    if (s.has(exIdx)) s.delete(exIdx);
    else s.add(exIdx);
    setSwaps(dayIdx, s);
    haptic('light');
  };
  const removeExercise = (exIdx: number) => {
    if (!draft) return;
    const before = { draft, swaps: daySwaps };
    const after = removeExtra(draft, exIdx, day.exercises.length, daySwaps, nowMs());
    setDraft(dayIdx, after.draft);
    setSwaps(dayIdx, after.swaps);
    toast(`${exercises[exIdx].name} removed`, { actionLabel: 'Undo', onAction: () => { setDraft(dayIdx, before.draft); setSwaps(dayIdx, before.swaps); } });
  };
  const saveAndContinue = async () => {
    const session = await saveDay(dayIdx);
    if (!session) {
      haptic('error');
      toast('Log at least one set first', { error: true });
      return;
    }
    haptic('success');
    toast(`Saved. Today: ${session.exercises.length} exercise${session.exercises.length === 1 ? '' : 's'} logged`);
  };
  const finish = async () => {
    const saved = await saveDay(dayIdx);
    const session = saved ?? todaysSession(history);
    if (!session) {
      haptic('error');
      toast('Log at least one set before saving', { error: true });
      return;
    }
    if (!saved && draft) setDraft(dayIdx, null);
    haptic('success');
    setPicked(null);
    router.push({ pathname: '/summary/[id]', params: { id: String(session.id) } });
  };
  const clear = () => {
    const before = draft;
    setDraft(dayIdx, null);
    toast('Unsaved sets cleared', { actionLabel: 'Undo', onAction: () => setDraft(dayIdx, before) });
  };

  return (
    <Screen>
      {(unsaved || restTimer) && <KeepAwake />}
      <Header eyebrow={`Workout · ${activePlan.planName}`} title={day.title}
        sub={isCustom ? 'Build it from any exercises. It saves to History without changing your plan.' : `${day.day}${wd.length ? ` · ${wd.join(' / ')}` : ''} · ${exercises.length} exercises`} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }} style={{ marginHorizontal: -20, flexGrow: 0 }}>
        {[...days, null].map((d, i) => {
          const on = i === dayIdx;
          const draftDot = hasDraft(drafts[i] ?? null);
          if (!d) {
            return (
              <Pressable key="custom" onPress={() => pick(customIdx)} accessibilityRole="tab" aria-selected={on} accessibilityLabel={`Custom workout${draftDot ? ', unsaved sets' : ''}`}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius, borderWidth: 1, borderStyle: 'dashed', borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : 'transparent', justifyContent: 'center' }}>
                <Body bold={on} style={{ fontSize: 14 }}>{draftDot ? '● ' : ''}+ Custom</Body>
              </Pressable>
            );
          }
          const badge = draftDot ? 'Unsaved' : i === today && !trainedToday ? 'Today' : i === next && !done.has(d.day) ? 'Next' : '';
          const w = weekdaysFor(i, schedule, days.length);
          return (
            <Pressable key={d.day} onPress={() => pick(i)} accessibilityRole="tab" aria-selected={on}
              accessibilityLabel={`${d.day}, ${d.title}${done.has(d.day) ? ', done this week' : ''}${badge ? `, ${badge}` : ''}`}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius, borderWidth: 1, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : c.surface, minWidth: 92, gap: 2 }}>
              <Mono style={{ fontSize: 11 }} color={draftDot ? c.record : on ? c.accent : c.muted}>{done.has(d.day) ? '✓ ' : ''}{w.length ? w.join('/') : `D${i + 1}`}{badge ? ` · ${badge}` : ''}</Mono>
              <Body bold={on} style={{ fontSize: 14 }} numberOfLines={1}>{shortDayTitle(d.title)}</Body>
            </Pressable>
          );
        })}
      </ScrollView>
      {rest && (
        <Card>
          <Body bold>Rest day</Body>
          <Body color={c.inkSoft}>{upcoming ? `Next up: ${days[upcoming.dayIdx].title} on ${WEEKDAY_NAMES[upcoming.w]}. ` : ''}Recovery is when the muscle gets built. Want to train anyway? This is the next day in your plan.</Body>
        </Card>
      )}
      {progress.done > 0 && <Progress done={progress.done} total={progress.total} startedAt={draft?.startedAt ?? null} />}
      {exercises.map((ex, i) => (
        <ExerciseCard key={`${dayIdx}-${i}-${ex.name}`} dayIdx={dayIdx} exIdx={i} ex={ex} exercises={exercises} draft={draft} history={history}
          onSwap={() => toggleSwap(i)} onRemove={ex.isExtra ? () => removeExercise(i) : undefined} />
      ))}
      {isCustom && !exercises.length && (
        <Card>
          <Body color={c.inkSoft}>Add exercises from your plan or the library to start.</Body>
        </Card>
      )}
      <Button label="+ Add exercise" onPress={() => router.push({ pathname: '/add-exercise', params: { day: String(dayIdx) } })} />
      {unsaved && (
        <View style={{ gap: 8, marginTop: 6 }}>
          <Button label="Finish workout" kind="primary" onPress={finish} />
          <Button label="Save and keep going" onPress={saveAndContinue} />
          <Button label="Clear unsaved sets" kind="danger" onPress={clear} />
        </View>
      )}
      {!unsaved && trainedToday && (
        <Button label="See today's summary" onPress={() => router.push({ pathname: '/summary/[id]', params: { id: String(todaysSession(history)!.id) } })} />
      )}
    </Screen>
  );
}

/** Keeps the screen on during a workout (not available in every browser) */
function KeepAwake() {
  if (Platform.OS === 'web') return null;
  return <KeepAwakeNative />;
}

function KeepAwakeNative() {
  useKeepAwake();
  return null;
}

function Progress({ done, total, startedAt }: { done: number; total: number; startedAt: number | null }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [now, setNow] = useState(() => nowMs());
  useEffect(() => {
    const id = setInterval(() => setNow(nowMs()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = startedAt && now - startedAt < 5 * 3600e3 ? (now - startedAt) / 1000 : null;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Mono color={c.ink}>{done} / {total} sets</Mono>
        {elapsed !== null && <Mono accessibilityLabel={`Workout time ${fmtClock(elapsed)}`}>{fmtClock(elapsed)}</Mono>}
      </View>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: c.line, overflow: 'hidden' }}>
        <View style={{ height: 4, width: `${Math.min(100, (done / Math.max(1, total)) * 100)}%`, backgroundColor: c.accent }} />
      </View>
    </View>
  );
}
