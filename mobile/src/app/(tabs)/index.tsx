// Workout: pick the day (today's or the next one is picked for you), log each set, then save.
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import { clockActiveMs, dayExercises, dayProgress, draftSets, freshClock, hasDraft, pauseClock, removeExtra, resumeClock, startClock, type WorkoutClock as Clock } from '@/core/draft';
import { fmtClock, localDateStr } from '@/core/format';
import { daysDoneThisWeek, todaysSession } from '@/core/history';
import { isRestDay, nextScheduled, planSchedule, scheduledDay, upNextDayIdx, weekdayIdx, weekdaysFor, WEEKDAY_NAMES } from '@/core/schedule';
import { shortDayTitle } from '@/core/workout';
import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';
import { Button } from '@/ui/button';
import { nowMs } from '@/ui/clock';
import { CoachTip, useTips, type TipId } from '@/ui/coach-tip';
import { ExerciseCard } from '@/ui/exercise-card';
import { WeekHero } from '@/ui/week-hero';
import { haptic } from '@/ui/haptics';
import { Header } from '@/ui/parts';
import { Card, Screen } from '@/ui/screen';
import { Body, Mono } from '@/ui/text';
import { useToast } from '@/ui/toast';

export default function WorkoutScreen() {
  const { activePlan, history, drafts, swaps, restTimer, clock: storedClock, dayAt, setDraft, setSwaps, saveDay, setClock, finishWorkout } = useData();
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
  const now = nowMs();
  // One clock for the whole app: started on any day, it shows on every day
  const clock = freshClock(storedClock, now);
  const running = !!clock;
  // Sets left from an earlier date: Start would move them to today, so it waits until they're saved or cleared
  const fromEarlier = unsaved && !!draft && localDateStr(new Date(draft.startedAt)) !== localDateStr(new Date(now));
  const done = daysDoneThisWeek(days, history);
  const today = scheduledDay(weekdayIdx(), schedule, days.length);
  const trainedToday = !!todaysSession(history);
  const rest = isRestDay(schedule, days.length) && picked === null && !unsaved;
  const upcoming = rest ? nextScheduled(schedule, days.length) : null;
  const wd = isCustom ? [] : weekdaysFor(dayIdx, schedule, days.length);

  // One coach tip at a time: rest after the first logged set, drop sets once an exercise is done, then swaps
  const { unseen } = useTips();
  let tip: { at: number; id: TipId } | null = null;
  for (let i = 0; i < exercises.length && !tip; i++) {
    const sets = draftSets(draft, i, exercises[i]);
    if (unseen('rest') && sets.some(x => x.done)) tip = { at: i, id: 'rest' };
    else if (unseen('drop') && sets.every(x => x.done)) tip = { at: i, id: 'drop' };
  }
  if (!tip && !unseen('rest') && unseen('swap')) {
    const i = exercises.findIndex(e => e.otherName && !e.swapped);
    if (i !== -1) tip = { at: i, id: 'swap' };
  }
  const TIPS: Record<TipId, [string, string]> = {
    rest: ['Logged. Rest timer started.', 'Tap − or + under a set to change the rest after it. The same weight on less rest is progress too.'],
    drop: ['One more push?', '+ Drop under any set adds a lighter set straight after it, to squeeze out the last reps.'],
    swap: ['Machine taken?', `Tap ⇄ to swap ${tip ? exercises[tip.at].name : ''} for ${tip ? exercises[tip.at].otherName : ''}. It has its own targets and history, and you can swap back any time.`],
    records: ['', '']
  };

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
  const start = () => {
    setClock(startClock(nowMs()));
    setPicked(dayIdx);
    haptic('success');
  };
  const pauseOrResume = () => {
    if (!clock) return;
    setClock(clock.pausedAt ? resumeClock(clock, nowMs()) : pauseClock(clock, nowMs()));
    haptic('light');
  };
  // Finish saves today's sets from every day you trained, and stops the clock
  const finish = async () => {
    const session = await finishWorkout(dayIdx);
    if (!session) {
      if (running) {
        setPicked(null);
        toast('Workout ended. Nothing was logged, so nothing was saved.');
        return;
      }
      haptic('error');
      toast('Log at least one set before saving', { error: true });
      return;
    }
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
      {(unsaved || running || restTimer) && <KeepAwake />}
      <Header eyebrow={`Workout · ${activePlan.planName}`} title={day.title}
        sub={isCustom ? 'Build it from any exercises. It saves to History without changing your plan.' : `${day.day}${wd.length ? ` · ${wd.join(' / ')}` : ''} · ${exercises.length} exercises`} />
      {!unsaved && !running && <WeekHero />}
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
      {clock ? (
        <WorkoutClock clock={clock} done={progress.done} total={progress.total} savedSec={todaysSession(history)?.durationSec ?? 0}
          onPauseOrResume={pauseOrResume} onFinish={finish} />
      ) : exercises.length > 0 && !fromEarlier ? (
        <View style={{ gap: 6 }}>
          <Button label="Start workout" kind="primary" onPress={start} />
          <Mono color={c.muted} style={{ textAlign: 'center', fontSize: 12 }}>Starts the clock. Ticking your first set starts it too.</Mono>
        </View>
      ) : null}
      {exercises.map((ex, i) => (
        <View key={`${dayIdx}-${i}-${ex.name}`} style={{ gap: 8 }}>
          {tip && tip.at === i && tip.id === 'swap' && <CoachTip id="swap" title={TIPS.swap[0]} text={TIPS.swap[1]} />}
          <ExerciseCard dayIdx={dayIdx} exIdx={i} ex={ex} exercises={exercises} draft={draft} history={history}
            onSwap={() => toggleSwap(i)} onRemove={ex.isExtra ? () => removeExercise(i) : undefined}
            coachTip={tip && tip.at === i && tip.id === 'rest' ? { node: <CoachTip id="rest" title={TIPS.rest[0]} text={TIPS.rest[1]} />, afterSet: draftSets(draft, i, ex).findIndex(x => x.done) + 1 } : null} />
          {/* A finished exercise is folded to one line, so the drop-set tip sits under it */}
          {tip && tip.at === i && tip.id === 'drop' && <CoachTip id="drop" title={TIPS.drop[0]} text={TIPS.drop[1]} />}
        </View>
      ))}
      {isCustom && !exercises.length && (
        <Card>
          <Body color={c.inkSoft}>Add exercises from your plan or the library to start.</Body>
        </Card>
      )}
      <Button label="+ Add exercise" onPress={() => router.push({ pathname: '/add-exercise', params: { day: String(dayIdx) } })} />
      {(unsaved || running) && (
        <View style={{ gap: 8, marginTop: 6 }}>
          <Button label="Finish workout" kind="primary" onPress={finish} />
          {unsaved && <Button label="Save and keep going" onPress={saveAndContinue} />}
          {unsaved && <Button label="Clear unsaved sets" kind="danger" onPress={clear} />}
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

/** The workout clock: time so far (plus what's already saved today), sets done, Pause / Resume and Finish */
function WorkoutClock({ clock, done, total, savedSec, onPauseOrResume, onFinish }: {
  clock: Clock; done: number; total: number; savedSec: number; onPauseOrResume: () => void; onFinish: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [now, setNow] = useState(() => nowMs());
  useEffect(() => {
    const id = setInterval(() => setNow(nowMs()), 1000);
    return () => clearInterval(id);
  }, []);
  const paused = !!clock.pausedAt;
  // Time already saved today, plus the clock's time since
  const active = clockActiveMs(clock, now);
  const elapsed = savedSec + (active < 5 * 3600e3 ? Math.max(0, active - (clock.creditedMs || 0)) / 1000 : 0);
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Mono bold color={paused ? c.muted : c.ink} style={{ fontSize: 26 }} accessibilityLabel={`Workout time ${fmtClock(elapsed)}${paused ? ', paused' : ''}`}>{fmtClock(elapsed)}</Mono>
          <Mono style={{ fontSize: 12 }} color={paused ? c.record : c.muted}>{paused ? 'PAUSED' : `${done} / ${total} sets`}</Mono>
        </View>
        <Button label={paused ? 'Resume' : 'Pause'} onPress={onPauseOrResume} style={{ minWidth: 96 }} />
        <Button label="Finish" kind="primary" onPress={onFinish} style={{ minWidth: 88 }} />
      </View>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: c.line, overflow: 'hidden', opacity: paused ? 0.5 : 1 }}>
        <View style={{ height: 4, width: `${Math.min(100, (done / Math.max(1, total)) * 100)}%`, backgroundColor: c.accent }} />
      </View>
    </Card>
  );
}
