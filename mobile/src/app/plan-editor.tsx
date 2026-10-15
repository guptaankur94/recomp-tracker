// The plan editor: a working copy of the plan, edited across views (the plan, a day, an exercise, picking an
// exercise) and saved in one go. Opened to edit the current plan, at one of its days, or to build a new one.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { hasDraft, type ExtraExercise } from '@/core/draft';
import { fmtClock } from '@/core/format';
import { dayColor } from '@/core/history';
import {
  addDay, deleteDay, editablePlan, emptyPlan, exerciseFromTemplate, finishPlan, moveDay, moveExercise, normalizeReps,
  setWeekday, updateDay, updateExercise, type EditablePlan
} from '@/core/plan-edit';
import { WEEKDAY_NAMES } from '@/core/schedule';
import type { PlanExercise, PlanExerciseBase } from '@/core/types';
import { nudgeRest, warmupCount } from '@/core/workout';
import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';
import { Button } from '@/ui/button';
import { ExercisePicker } from '@/ui/exercise-picker';
import { Choices, Field, Stepper } from '@/ui/fields';
import { haptic } from '@/ui/haptics';
import { Header, SectionLabel } from '@/ui/parts';
import { Card, Screen } from '@/ui/screen';
import { Body, Mono } from '@/ui/text';
import { useToast } from '@/ui/toast';

type View_ =
  | { kind: 'plan' }
  | { kind: 'day'; d: number }
  | { kind: 'exercise'; d: number; e: number }
  | { kind: 'pick'; d: number; e?: number };

function summary(ex: PlanExerciseBase & { alt?: PlanExerciseBase }) {
  return `${ex.warmup ? `${ex.warmup} warm-up + ` : ''}${ex.sets} × ${ex.repTarget} · rest ${fmtClock(ex.rest)}${ex.alt ? ` · swap ${ex.alt.name}` : ''}`;
}

export default function PlanEditorScreen() {
  const params = useLocalSearchParams<{ day?: string; build?: string; setup?: string }>();
  const { activePlan, drafts, history, choosePlan } = useData();
  const { theme } = useTheme();
  const toast = useToast();
  const c = theme.colors;
  const building = params.build !== undefined;
  const [plan, setPlan] = useState<EditablePlan>(() => (building ? emptyPlan(Number(params.build) || 3) : editablePlan(activePlan)));
  const [view, setView] = useState<View_>(() => (building ? { kind: 'day', d: 0 } : params.day !== undefined ? { kind: 'day', d: Number(params.day) } : { kind: 'plan' }));
  const [dirty, setDirty] = useState(building);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const unsaved = Object.values(drafts).some(d => hasDraft(d));

  const change = (fn: (p: EditablePlan) => EditablePlan) => { setPlan(fn); setDirty(true); setConfirmDiscard(false); };
  const go = (v: View_) => { setView(v); setConfirmDiscard(false); };
  // From setup, both saving and backing out go on to setup's finish screen
  const fromSetup = params.setup !== undefined;
  const close = (saved = false) => {
    if (fromSetup) router.replace({ pathname: '/setup', params: { finish: saved ? 'saved' : 'fallback' } });
    else if (router.canGoBack()) router.back();
    else router.replace('/plan');
  };

  const save = async () => {
    const checked = finishPlan(plan);
    if (!checked.ok) {
      haptic('error');
      toast(checked.message, { error: true });
      if (checked.dayIdx !== undefined) go({ kind: 'day', d: checked.dayIdx });
      return;
    }
    await choosePlan(checked.plan);
    haptic('success');
    toast(building ? `“${checked.plan.planName}” is now your plan` : 'Plan saved');
    close(true);
  };

  const cancel = () => {
    if (dirty && !confirmDiscard) { setConfirmDiscard(true); return; }
    close();
  };

  // Picking an exercise for a day, or a swap for an exercise
  if (view.kind === 'pick') {
    const forAlt = view.e !== undefined;
    const pick = (t: ExtraExercise) => {
      const picked = exerciseFromTemplate(t);
      if (forAlt) {
        const { alt: _alt, ...alt } = picked;
        change(p => updateExercise(p, view.d, view.e!, ex => ({ ...ex, alt })));
        go({ kind: 'exercise', d: view.d, e: view.e! });
      } else {
        change(p => updateDay(p, view.d, d => ({ ...d, exercises: [...d.exercises, picked] })));
        toast(`${picked.name} added to Day ${view.d + 1}`);
        go({ kind: 'day', d: view.d });
      }
      haptic('success');
    };
    return (
      <Screen tabBar={false}>
        <BackLink label={forAlt ? 'Exercise' : `Day ${view.d + 1}`} onPress={() => go(forAlt ? { kind: 'exercise', d: view.d, e: view.e! } : { kind: 'day', d: view.d })} />
        <Header eyebrow={forAlt ? 'Swap' : `Day ${view.d + 1}`} title={forAlt ? 'Pick a swap' : 'Add exercise'} sub={forAlt ? 'Used when you tap Swap, e.g. when the equipment is busy.' : undefined} />
        <ExercisePicker planDays={plan.days.map((d, i) => ({ day: { ...d, day: `Day ${i + 1}` }, idx: i })).filter(x => x.idx !== view.d)} history={history} onPick={pick} />
      </Screen>
    );
  }

  if (view.kind === 'exercise') {
    const ex = plan.days[view.d]?.exercises[view.e];
    if (!ex) return null;
    const set = (fn: (e: PlanExercise) => PlanExercise) => change(p => updateExercise(p, view.d, view.e, fn));
    const remove = () => {
      const before = plan;
      change(p => updateDay(p, view.d, d => ({ ...d, exercises: d.exercises.filter((_, i) => i !== view.e) })));
      go({ kind: 'day', d: view.d });
      toast(`${ex.name} removed`, { actionLabel: 'Undo', onAction: () => setPlan(before) });
    };
    return (
      <Screen tabBar={false}>
        <BackLink label={`Day ${view.d + 1}`} onPress={() => go({ kind: 'day', d: view.d })} />
        <Header eyebrow={`Day ${view.d + 1} · exercise ${view.e + 1}`} title={ex.name || 'Exercise'} />
        <Field label="Name" value={ex.name} onChangeText={name => set(e => ({ ...e, name }))} autoCorrect={false} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Stepper label="Working sets" value={String(ex.sets)} onMinus={() => set(e => ({ ...e, sets: Math.max(1, e.sets - 1) }))} onPlus={() => set(e => ({ ...e, sets: Math.min(8, e.sets + 1) }))} minusDisabled={ex.sets <= 1} plusDisabled={ex.sets >= 8} />
          <Stepper label="Rest" value={fmtClock(ex.rest)} onMinus={() => set(e => ({ ...e, rest: nudgeRest(e.rest, -15) }))} onPlus={() => set(e => ({ ...e, rest: nudgeRest(e.rest, 15) }))} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field label="Reps" value={ex.repTarget} onChangeText={repTarget => set(e => ({ ...e, repTarget }))} onEndEditing={() => set(e => ({ ...e, repTarget: normalizeReps(e.repTarget) }))} />
          <Field label="Weight target" value={ex.weightTarget} placeholder="e.g. 40 kg" onChangeText={weightTarget => set(e => ({ ...e, weightTarget }))} onEndEditing={() => set(e => ({ ...e, weightTarget: e.weightTarget.trim() || '2 reps in reserve' }))} />
        </View>
        <Choices label="Warm-up sets" value={warmupCount(ex, view.e)} onChange={v => set(e => ({ ...e, warmup: v }))}
          options={[{ value: 0, label: 'None' }, { value: 1, label: '1 light' }, { value: 2, label: '2 ramp up' }, { value: 3, label: '3 heavy lift' }]} />
        <Field label="Technique cue" value={ex.cue || ''} placeholder="Optional, e.g. 3s lowering" onChangeText={cue => set(e => ({ ...e, cue }))} />
        <SectionLabel>Swap · used when you tap Swap</SectionLabel>
        <Pressable onPress={() => go({ kind: 'pick', d: view.d, e: view.e })} accessibilityRole="button" accessibilityLabel={ex.alt ? `Swap: ${ex.alt.name}. Change` : 'Add a swap'}
          style={({ pressed }) => ({ padding: 14, borderRadius: theme.radius, borderWidth: 1, borderColor: c.line, backgroundColor: pressed ? c.surfaceHigh : c.surface, flexDirection: 'row', alignItems: 'center', gap: 10 })}>
          <View style={{ flex: 1, gap: 2 }}>
            <Body bold>{ex.alt ? ex.alt.name : 'No swap'}</Body>
            <Mono style={{ fontSize: 12 }}>{ex.alt ? summary(ex.alt) : 'Pick one for when the equipment is busy'}</Mono>
          </View>
          <Body color={c.accent}>{ex.alt ? 'Change' : 'Add'}</Body>
        </Pressable>
        {ex.alt && <Button label="Remove swap" onPress={() => set(e => { const { alt: _a, ...rest } = e; return rest; })} />}
        <Button label="Delete exercise" kind="danger" onPress={remove} />
        <Button label="Done" kind="primary" onPress={() => go({ kind: 'day', d: view.d })} />
      </Screen>
    );
  }

  if (view.kind === 'day') {
    const d = plan.days[view.d];
    if (!d) return null;
    const remove = () => {
      const before = plan;
      change(p => deleteDay(p, view.d));
      go({ kind: 'plan' });
      toast(`${d.title || `Day ${view.d + 1}`} deleted`, { actionLabel: 'Undo', onAction: () => setPlan(before) });
    };
    return (
      <Screen tabBar={false}>
        <BackLink label={building ? 'Plan' : 'Edit plan'} onPress={() => go({ kind: 'plan' })} />
        <Header eyebrow={`Day ${view.d + 1}`} title={d.title || `Day ${view.d + 1}`} />
        <Field label="Day name" value={d.title} placeholder="e.g. Push, Upper A, Legs" onChangeText={title => change(p => updateDay(p, view.d, x => ({ ...x, title })))} />
        <SectionLabel>Exercises · in order</SectionLabel>
        {!d.exercises.length && <Body color={c.inkSoft}>No exercises yet. Add the first one.</Body>}
        {d.exercises.map((ex, i) => (
          <ListRow key={`${ex.name}-${i}`} title={ex.name} sub={summary(ex)} onPress={() => go({ kind: 'exercise', d: view.d, e: i })}
            onUp={i > 0 ? () => change(p => moveExercise(p, view.d, i, -1)) : undefined}
            onDown={i < d.exercises.length - 1 ? () => change(p => moveExercise(p, view.d, i, 1)) : undefined} />
        ))}
        <Button label="+ Add exercise" onPress={() => go({ kind: 'pick', d: view.d })} />
        {plan.days.length > 1 && <Button label="Delete this day" kind="danger" onPress={remove} />}
        <Button label="Done" kind="primary" onPress={() => go({ kind: 'plan' })} />
      </Screen>
    );
  }

  const dayName = (i: number) => `Day ${i + 1} · ${plan.days[i]?.title || 'Untitled'}`;
  return (
    <Screen tabBar={false}>
      <BackLink label="Cancel" onPress={cancel} />
      <Header eyebrow="Plan" title={building ? 'Build your plan' : 'Edit plan'} />
      <Field label="Plan name" value={plan.planName} onChangeText={planName => change(p => ({ ...p, planName }))} />
      <SectionLabel>Days · in the order you train them</SectionLabel>
      {plan.days.map((d, i) => {
        const weekdays = WEEKDAY_NAMES.filter((_, w) => plan.schedule[w] === i).map(n => n.slice(0, 3));
        return (
          <ListRow key={i} dot={dayColor(`Day ${i + 1}`)} title={dayName(i)} sub={`${d.exercises.length} exercise${d.exercises.length === 1 ? '' : 's'}${weekdays.length ? ` · ${weekdays.join(', ')}` : ''}`}
            onPress={() => go({ kind: 'day', d: i })}
            onUp={i > 0 ? () => change(p => moveDay(p, i, -1)) : undefined}
            onDown={i < plan.days.length - 1 ? () => change(p => moveDay(p, i, 1)) : undefined} />
        );
      })}
      {plan.days.length < 7 && <Button label="+ Add day" onPress={() => { change(addDay); go({ kind: 'day', d: plan.days.length }); }} />}
      <SectionLabel>Weekly schedule</SectionLabel>
      <Body color={c.inkSoft} style={{ fontSize: 14 }}>The app opens on today&apos;s day. Leave every day on Rest to go through the days in order instead.</Body>
      {WEEKDAY_NAMES.map((name, w) => (
        <Choices key={name} label={name} value={plan.schedule[w] ?? -1}
          onChange={v => change(p => setWeekday(p, w, v === -1 ? null : v))}
          options={[{ value: -1, label: 'Rest' }, ...plan.days.map((_, i) => ({ value: i, label: `Day ${i + 1}` }))]} />
      ))}
      {unsaved && (
        <Card>
          <Body color={c.inkSoft} style={{ fontSize: 14 }}>Saving clears the unsaved sets in your current workout, since days and exercises may have moved. Saved history is kept.</Body>
        </Card>
      )}
      <Button label={building ? 'Use this plan' : 'Save plan'} kind="primary" onPress={save} style={{ marginTop: 8 }} />
      {confirmDiscard ? (
        <Card>
          <Body bold>Discard your changes?</Body>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            <Button label="Keep editing" onPress={() => setConfirmDiscard(false)} style={{ flex: 1 }} />
            <Button label="Discard" kind="danger" onPress={() => close()} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : (
        <Button label="Cancel" onPress={cancel} />
      )}
    </Screen>
  );
}

function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label === 'Cancel' ? 'Cancel' : `Back to ${label}`} hitSlop={10} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
      <Body color={theme.colors.accent}>‹ {label}</Body>
    </Pressable>
  );
}

/** A tappable row with optional move up / down buttons */
function ListRow({ title, sub, dot, onPress, onUp, onDown }: { title: string; sub: string; dot?: string | null; onPress: () => void; onUp?: () => void; onDown?: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const arrow = (label: string, fn: (() => void) | undefined, a11y: string) => (
    <Pressable onPress={fn} disabled={!fn} accessibilityRole="button" accessibilityLabel={`${a11y}: ${title}`} aria-disabled={!fn} hitSlop={4}
      style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', opacity: fn ? 1 : 0.25, backgroundColor: pressed ? c.accentSoft : 'transparent' })}>
      <Body color={c.inkSoft}>{label}</Body>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: theme.radius, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface }}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${sub}. Edit`}
        style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, opacity: pressed ? 0.7 : 1 })}>
        {dot && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />}
        <View style={{ flex: 1, gap: 2 }}>
          <Body bold numberOfLines={1}>{title}</Body>
          <Mono style={{ fontSize: 12 }} numberOfLines={2}>{sub}</Mono>
        </View>
      </Pressable>
      {(onUp || onDown) && <View style={{ flexDirection: 'row', paddingRight: 6 }}>{arrow('↑', onUp, 'Move up')}{arrow('↓', onDown, 'Move down')}</View>}
    </View>
  );
}
