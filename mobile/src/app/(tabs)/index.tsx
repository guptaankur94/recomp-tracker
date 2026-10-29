// Workout: pick the day (today's or the next one is picked for you), log each set, then save.
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import { clockActiveMs, dayExercises, dayProgress, draftSets, freshClock, hasDraft, pauseClock, removeExtra, resumeClock, startClock, type WorkoutClock as Clock } from '@/core/draft';
import { fmtClock, localDateStr } from '@/core/format';
import { daysDoneThisWeek, sessionStats, todaysSession } from '@/core/history';
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
  const { activePlan, history, drafts, swaps, restTimer, clock: storedClock, dayAt, setDraft, setSwaps, setClock, finishWorkout } = useData();
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
  // Today's ticked sets on each day (unsaved, started today): the live panel's chips and the tab badges
  const todayStr = localDateStr(new Date(now));
  const setsToday = [...days.map((_, i) => i), customIdx].map(d => {
    const dr = drafts[d] ?? null;
    const n = dr && hasDraft(dr) && localDateStr(new Date(dr.startedAt)) === todayStr ? dayProgress(dr, dayExercises(dayAt(d), dr, new Set(swaps[d] || []))).done : 0;
    return { d, n, label: d === customIdx ? 'Custom' : `D${d + 1}` };
  }).filter(x => x.n > 0);
  const savedToday = todaysSession(history);
  // Finish: with sets to save, the Finish screen asks how hard it was; with nothing new, the workout just ends
  const finish = async () => {
    if (setsToday.length || (savedToday && running && !fromEarlier)) {
      router.push({ pathname: '/finish', params: { day: String(dayIdx) } });
      return;
    }
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
    <Screen pinned={clock ? (
      <LivePanel clock={clock} savedSec={savedToday?.durationSec ?? 0} sets={setsToday.reduce((n, x) => n + x.n, 0) + (savedToday ? sessionStats(savedToday).sets : 0)}
        days={setsToday} onPauseOrResume={pauseOrResume} onPick={pick} />
    ) : undefined}>
      {(unsaved || running || restTimer) && <KeepAwake />}
      <Header eyebrow={`Workout · ${activePlan.planName}`} title={day.title}
        sub={isCustom ? 'Build it from any exercises. It saves to History without changing your plan.' : `${day.day}${wd.length ? ` · ${wd.join(' / ')}` : ''} · ${exercises.length} exercises`} />
      {!running && (
        <View style={{ gap: 8 }}>
          {!unsaved && <WeekHero />}
          <BigAction label="Start workout" color={c.todo} onPress={start} />
          <Mono color={c.muted} style={{ textAlign: 'center', fontSize: 12 }}>Then log any day of your plan, and switch between days as you go.</Mono>
        </View>
      )}
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
          const logged = setsToday.find(x => x.d === i)?.n ?? 0;
          const badge = logged ? '' : draftDot ? 'Unsaved' : i === today && !trainedToday ? 'Today' : i === next && !done.has(d.day) ? 'Next' : '';
          const w = weekdaysFor(i, schedule, days.length);
          return (
            <Pressable key={d.day} onPress={() => pick(i)} accessibilityRole="tab" aria-selected={on}
              accessibilityLabel={`${d.day}, ${d.title}${done.has(d.day) ? ', done this week' : ''}${badge ? `, ${badge}` : ''}${logged ? `, ${logged} sets logged` : ''}`}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius, borderWidth: 1, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : c.surface, minWidth: 92, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Mono style={{ fontSize: 11 }} color={draftDot && !logged ? c.record : on ? c.accent : c.muted}>{done.has(d.day) ? '✓ ' : ''}{w.length ? w.join('/') : `D${i + 1}`}{badge ? ` · ${badge}` : ''}</Mono>
                {logged > 0 && (
                  <View style={{ minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: c.done, alignItems: 'center', justifyContent: 'center' }}>
                    <Mono bold style={{ fontSize: 11 }} color={c.onAccent}>{logged}</Mono>
                  </View>
                )}
              </View>
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
      {(running || setsToday.length > 0 || fromEarlier) && (
        <View style={{ gap: 8, marginTop: 10 }}>
          <BigAction label="✓ Finish workout" color={c.done} onPress={finish} />
          <Mono color={c.muted} style={{ textAlign: 'center', fontSize: 12 }}>{setsToday.length ? `Saves today's sets from ${setsToday.map(x => x.label).join(' + ')}` : fromEarlier ? 'Saves these sets to the day you did them' : 'Nothing logged yet'}</Mono>
        </View>
      )}
      {unsaved && <Button label="Clear unsaved sets" kind="danger" onPress={clear} />}
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

/** A big, coloured action: Start (to-do colour) and Finish (done colour) */
function BigAction({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label.replace('✓ ', '')}
      style={({ pressed }) => ({ height: 56, borderRadius: theme.radius, backgroundColor: color, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
      <Body bold style={{ fontSize: 18 }} color={theme.colors.onAccent}>{label}</Body>
    </Pressable>
  );
}

/** The live panel, pinned at the top during a workout: the clock, Pause, and each day trained so far (tap to go) */
function LivePanel({ clock, savedSec, sets, days, onPauseOrResume, onPick }: {
  clock: Clock; savedSec: number; sets: number; days: { d: number; n: number; label: string }[]; onPauseOrResume: () => void; onPick: (d: number) => void;
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
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Mono bold color={paused ? c.muted : c.todo} style={{ fontSize: 30 }} accessibilityLabel={`Workout time ${fmtClock(elapsed)}${paused ? ', paused' : ''}`}>{fmtClock(elapsed)}</Mono>
          <Mono style={{ fontSize: 12 }} color={c.inkSoft}>{paused ? 'PAUSED' : `Workout · ${sets} set${sets === 1 ? '' : 's'}${days.length ? ` · ${days.length} day${days.length === 1 ? '' : 's'}` : ''}`}</Mono>
        </View>
        <Button label={paused ? 'Resume' : 'Pause'} onPress={onPauseOrResume} style={{ minWidth: 100 }} />
      </View>
      {days.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {days.map(x => (
            <Pressable key={x.d} onPress={() => onPick(x.d)} accessibilityRole="button" accessibilityLabel={`${x.label}, ${x.n} sets. Go to this day`}
              style={{ height: 28, paddingHorizontal: 10, borderRadius: 14, justifyContent: 'center', backgroundColor: c.surfaceHigh, borderWidth: 1, borderColor: c.done }}>
              <Mono bold style={{ fontSize: 12 }} color={c.done}>{x.label} · {x.n} set{x.n === 1 ? '' : 's'}</Mono>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
