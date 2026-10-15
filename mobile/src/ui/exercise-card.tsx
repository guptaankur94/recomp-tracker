// One exercise on the Workout screen: targets, last time, warm-ups, and a row per set to log weight and
// reps, with its rest and drop sets underneath. A finished exercise folds into a one-line summary.
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import {
  addSet, completeSet, draftSets, exerciseRest, nextSetLabel, recheckPr, removeSet, setRest, updateExercise, updateSets,
  withExerciseRest, withSetRest, type DayExercise, type Draft, type DraftSet
} from '@/core/draft';
import { fmtClock, fmtNum, fmtVolume } from '@/core/format';
import { getLastPerformance } from '@/core/history';
import { PR_LABELS } from '@/core/records';
import type { Session } from '@/core/types';
import { avgRest, lastSetFor, nudgeRest, progressionTip, roundRest, setVolume, suggestSet, warmupSets } from '@/core/workout';
import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';

import { nowMs } from './clock';
import { haptic } from './haptics';
import { PrBadge } from './parts';
import { Body, Mono, Title } from './text';
import { useToast } from './toast';

/** Record kinds short enough to sit beside a set */
const PR_SHORT = { weight: 'Weight', e1rm: '1RM', reps: 'Reps', rest: 'Rest' } as const;

interface Props {
  dayIdx: number;
  exIdx: number;
  ex: DayExercise;
  exercises: DayExercise[];
  draft: Draft | null;
  history: Session[];
  onSwap: () => void;
  onRemove?: () => void;
}

export function ExerciseCard({ dayIdx, exIdx, ex, exercises, draft, history, onSwap, onRemove }: Props) {
  const { setDraft, setRestTimer } = useData();
  const { theme } = useTheme();
  const toast = useToast();
  const c = theme.colors;
  const sets = draftSets(draft, exIdx, ex);
  const finished = sets.length > 0 && sets.every(s => s.done);
  const [folded, setFolded] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const last = getLastPerformance(ex.name, history);
  const firstLast = lastSetFor(last, 1);
  const suggestion1 = suggestSet(ex, firstLast);
  const tip = progressionTip(ex, firstLast, last ? roundRest(avgRest(last.sets)) : 0);
  const typed1 = parseFloat(sets[0]?.w ?? '') || 0;
  const ramp = warmupSets(ex, exIdx, typed1, suggestion1);
  const warmupsDone = new Set(draft?.exercises[exIdx]?.warmups || []);
  const now = () => nowMs();
  const save = (next: Draft | null) => setDraft(dayIdx, next);

  const setField = (setNum: number, field: 'w' | 'r', value: string) =>
    save(updateSets(draft, exIdx, ex, now(), s => { s[setNum - 1] = { ...s[setNum - 1], [field]: value }; return s; }));

  const tick = (setNum: number) => {
    const result = completeSet(draft, exIdx, setNum, ex, history, now());
    if (!result.ok) {
      haptic('error');
      toast('Enter the reps you did first', { error: true });
      return;
    }
    save(result.draft);
    haptic('success');
    if (result.pr) {
      const restNote = result.pr === 'rest' ? ` · rest ${fmtClock(setRest(result.draft, exIdx, setNum, ex))}` : '';
      toast(`New PR · ${ex.name}: ${result.w > 0 ? `${fmtNum(result.w)} kg` : 'BW'} × ${result.r}${restNote}`);
    }
    if (result.finished) setFolded(true);
    if (result.firstCompletion) {
      const total = setRest(result.draft, exIdx, setNum, ex);
      setRestTimer({ endAt: nowMs() + total * 1000, total, next: nextSetLabel(result.draft, exercises, exIdx, setNum, history) });
    }
  };

  const edit = (setNum: number) => {
    haptic('light');
    save(updateSets(draft, exIdx, ex, now(), s => { const { pr: _pr, ...rest } = s[setNum - 1]; s[setNum - 1] = { ...rest, done: false }; return s; }));
  };

  const deleteSet = (setNum: number) => {
    const next = removeSet(draft, exIdx, setNum, ex, now());
    if (!next) return;
    const before = draft;
    save(next);
    haptic('light');
    toast(`Set ${setNum} deleted`, { actionLabel: 'Undo', onAction: () => save(before) });
  };

  const bumpSetRest = (setNum: number, delta: number) => {
    const sec = nudgeRest(setRest(draft, exIdx, setNum, ex), delta);
    save(recheckPr(withSetRest(draft, exIdx, setNum, ex, sec, now()), exIdx, setNum, ex, history, now()));
    haptic('light');
  };

  const bumpExerciseRest = (delta: number) => {
    save(withExerciseRest(draft, exIdx, ex, nudgeRest(exerciseRest(draft, exIdx, ex), delta), now()));
    haptic('light');
  };

  const setDrops = (setNum: number, fn: (drops: NonNullable<DraftSet['drops']>) => NonNullable<DraftSet['drops']>) =>
    save(updateSets(draft, exIdx, ex, now(), s => {
      const drops = fn([...(s[setNum - 1].drops || [])]);
      const next: DraftSet = { ...s[setNum - 1], drops };
      if (!drops.length) delete next.drops;
      s[setNum - 1] = next;
      return s;
    }));

  const toggleWarmup = (i: number) => {
    const done = warmupsDone.has(i);
    save(updateExercise(draft, exIdx, now(), e => ({ ...e, warmups: done ? (e.warmups || []).filter(x => x !== i) : [...(e.warmups || []), i] })));
    haptic(done ? 'light' : 'success');
    if (!done) {
      const nextIdx = ramp.findIndex((_, j) => j > i && !warmupsDone.has(j));
      setRestTimer({ endAt: nowMs() + 60000, total: 60, next: nextIdx !== -1 ? `Next: warm-up ${nextIdx + 1} · ${ramp[nextIdx].label}` : nextSetLabel(draft, exercises, exIdx, 0, history) });
    }
  };

  if (finished && folded) {
    const best = sets.reduce((a, s) => {
      const w = parseFloat(s.w) || 0;
      const r = parseInt(s.r, 10) || 0;
      return !a || w > a.w || (w === a.w && r > a.r) ? { w, r } : a;
    }, null as { w: number; r: number } | null);
    const volume = sets.reduce((v, s) => v + setVolume({ weight: parseFloat(s.w) || 0, reps: parseInt(s.r, 10) || 0, drops: (s.drops || []).map(d => ({ weight: parseFloat(d.w) || 0, reps: parseInt(d.r, 10) || 0 })) }), 0);
    const prs = sets.filter(s => s.pr).length;
    return (
      <Pressable onPress={() => setFolded(false)} accessibilityRole="button" accessibilityLabel={`${ex.name}, done. Show sets`}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: theme.radius, borderWidth: 1, borderColor: c.line, backgroundColor: pressed ? c.surfaceHigh : c.surface })}>
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Body bold color={c.onAccent}>✓</Body>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Body bold numberOfLines={1}>{ex.name}</Body>
          <Mono style={{ fontSize: 12 }}>{sets.length} sets · best {best && best.w > 0 ? `${fmtNum(best.w)} kg` : 'BW'} × {best?.r ?? 0} · {fmtVolume(volume)}</Mono>
        </View>
        {prs > 0 && <PrBadge label={`${prs} PR`} />}
      </Pressable>
    );
  }

  return (
    <View style={{ backgroundColor: c.surface, borderRadius: theme.radius, borderWidth: 1, borderColor: c.line, padding: 16, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <Pressable onPress={() => setShowInfo(v => !v)} style={{ flex: 1 }} accessibilityRole="button" aria-expanded={showInfo} accessibilityLabel={`${ex.name}, ${ex.sets} by ${ex.repTarget}. ${showInfo ? 'Hide' : 'Show'} tips`}>
          <Title size={22}>{ex.name}</Title>
          <Mono color={c.accent} style={{ marginTop: 4 }}>{ex.repTarget} · {ex.weightTarget}</Mono>
        </Pressable>
        {finished && <SmallButton label="Fold" onPress={() => setFolded(true)} />}
      </View>
      {showInfo && ex.cue ? <Body color={c.inkSoft}>{ex.cue}</Body> : null}
      {last ? (
        <Mono style={{ fontSize: 12 }}>Last: {last.sets.map(s => (s.weight > 0 ? `${fmtNum(s.weight)}×${s.reps}` : `BW×${s.reps}`)).join(', ')}{tip ? `  ·  ${tip}` : ''}</Mono>
      ) : (
        <Mono style={{ fontSize: 12 }} color={c.muted}>First time: pick a weight you could lift 2 more reps with.</Mono>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {ex.otherName && <SmallButton label={`⇄ ${ex.otherName}`} onPress={onSwap} a11y={`Swap to ${ex.otherName}`} />}
        <RestStepper label={`Rest ${fmtClock(exerciseRest(draft, exIdx, ex))}`} a11y="Rest for every set" onMinus={() => bumpExerciseRest(-15)} onPlus={() => bumpExerciseRest(15)} />
        {onRemove && <SmallButton label="Remove" onPress={onRemove} danger />}
      </View>
      {ramp.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <Mono style={{ fontSize: 11 }} color={c.muted}>WARM-UP</Mono>
          {ramp.map((w, i) => {
            const on = warmupsDone.has(i);
            return (
              <Pressable key={i} onPress={() => toggleWarmup(i)} accessibilityRole="checkbox" aria-checked={on} accessibilityLabel={`Warm-up ${i + 1}: ${w.label}`}
                style={{ paddingHorizontal: 10, height: 30, justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : 'transparent' }}>
                <Mono style={{ fontSize: 12 }} color={on ? c.ink : c.inkSoft}>{on ? '✓ ' : ''}{w.label}</Mono>
              </Pressable>
            );
          })}
        </View>
      )}
      {sets.map((s, i) => {
        const setNum = i + 1;
        const sug = suggestSet(ex, lastSetFor(last, setNum));
        return (
          <SetRow key={i} setNum={setNum} set={s} suggestion={sug} rest={setRest(draft, exIdx, setNum, ex)} canDelete={sets.length > 1}
            onField={(f, v) => setField(setNum, f, v)} onTick={() => tick(setNum)} onEdit={() => edit(setNum)} onDelete={() => deleteSet(setNum)}
            onRest={d => bumpSetRest(setNum, d)}
            onAddDrop={() => setDrops(setNum, d => [...d, { w: '', r: '' }])}
            onDrop={(j, f, v) => setDrops(setNum, d => { d[j] = { ...d[j], [f]: v }; return d; })}
            onRemoveDrop={j => setDrops(setNum, d => d.filter((_, k) => k !== j))} />
        );
      })}
      <SmallButton label="+ Add set" onPress={() => { save(addSet(draft, exIdx, ex, now())); haptic('light'); }} />
    </View>
  );
}

function SetRow(props: {
  setNum: number; set: DraftSet; suggestion: { w: number; r: number } | null; rest: number; canDelete: boolean;
  onField: (f: 'w' | 'r', v: string) => void; onTick: () => void; onEdit: () => void; onDelete: () => void; onRest: (delta: number) => void;
  onAddDrop: () => void; onDrop: (j: number, f: 'w' | 'r', v: string) => void; onRemoveDrop: (j: number) => void;
}) {
  const { setNum, set, suggestion, rest } = props;
  const { theme } = useTheme();
  const c = theme.colors;
  const done = set.done;
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: c.line, paddingTop: 8, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable onLongPress={props.canDelete ? props.onDelete : undefined} accessibilityRole="text" accessibilityLabel={`Set ${setNum}`}
          accessibilityActions={props.canDelete ? [{ name: 'delete', label: 'Delete set' }] : []} onAccessibilityAction={e => { if (e.nativeEvent.actionName === 'delete') props.onDelete(); }}
          style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: done ? c.accent : c.line, alignItems: 'center', justifyContent: 'center' }}>
          <Mono bold color={done ? c.accent : c.inkSoft}>{setNum}</Mono>
        </Pressable>
        {done ? (
          <Pressable onPress={props.onEdit} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }} accessibilityRole="button"
            accessibilityLabel={`Set ${setNum}: ${parseFloat(set.w) > 0 ? `${set.w} kg` : 'bodyweight'} times ${set.r}${set.pr ? `, record: ${PR_LABELS[set.pr]}` : ''}. Edit`}>
            <Mono bold color={c.ink} style={{ fontSize: 17, flexShrink: 1 }} numberOfLines={1}>{parseFloat(set.w) > 0 ? `${fmtNum(parseFloat(set.w))} kg` : 'BW'} × {set.r}</Mono>
            {set.pr && <PrBadge label={`PR · ${PR_SHORT[set.pr]}`} />}
          </Pressable>
        ) : (
          <>
            <NumberField value={set.w} placeholder={suggestion && suggestion.w > 0 ? fmtNum(suggestion.w) : 'kg'} unit="kg" decimal onChange={v => props.onField('w', v)} label={`Set ${setNum} weight in kg`} />
            <Mono color={c.muted}>×</Mono>
            <NumberField value={set.r} placeholder={suggestion ? String(suggestion.r) : 'reps'} unit="reps" onChange={v => props.onField('r', v)} label={`Set ${setNum} reps`} onSubmit={props.onTick} />
          </>
        )}
        <Pressable onPress={done ? props.onEdit : props.onTick} accessibilityRole="button" accessibilityLabel={done ? `Set ${setNum} done. Edit` : `Done with set ${setNum}`}
          style={({ pressed }) => ({ width: 48, height: 44, borderRadius: theme.radius, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? c.accent : 'transparent', borderWidth: done ? 0 : 1.5, borderColor: c.accent, opacity: pressed ? 0.7 : 1 })}>
          <Body bold style={{ fontSize: 18 }} color={done ? c.onAccent : c.accent}>✓</Body>
        </Pressable>
      </View>
      {(set.drops || []).map((d, j) => (
        <View key={j} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 36 }}>
          <Mono style={{ fontSize: 12, width: 52 }} numberOfLines={1}>↳ Drop</Mono>
          <NumberField value={d.w} placeholder="kg" unit="kg" decimal small onChange={v => props.onDrop(j, 'w', v)} label={`Drop ${j + 1} weight`} />
          <Mono color={c.muted}>×</Mono>
          <NumberField value={d.r} placeholder="reps" unit="reps" small onChange={v => props.onDrop(j, 'r', v)} label={`Drop ${j + 1} reps`} />
          <Pressable onPress={() => props.onRemoveDrop(j)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove drop ${j + 1}`} style={{ width: 32, alignItems: 'center' }}>
            <Body color={c.muted}>✕</Body>
          </Pressable>
        </View>
      ))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginLeft: 36 }}>
        <RestStepper label={`Rest ${fmtClock(rest)}`} a11y={`Rest after set ${setNum}`} onMinus={() => props.onRest(-15)} onPlus={() => props.onRest(15)} />
        <SmallButton label="+ Drop" onPress={props.onAddDrop} a11y={`Add a drop set to set ${setNum}`} />
        {props.canDelete && <SmallButton label="✕" onPress={props.onDelete} a11y={`Delete set ${setNum}`} />}
      </View>
    </View>
  );
}

function NumberField({ value, placeholder, onChange, label, decimal, small, onSubmit }: {
  value: string; placeholder: string; unit: string; onChange: (v: string) => void; label: string; decimal?: boolean; small?: boolean; onSubmit?: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <TextInput value={value} placeholder={placeholder} placeholderTextColor={c.muted} accessibilityLabel={label}
      onChangeText={t => onChange(t.replace(',', '.').replace(decimal ? /[^0-9.]/g : /[^0-9]/g, ''))}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'} inputMode={decimal ? 'decimal' : 'numeric'} returnKeyType="done" onSubmitEditing={onSubmit} selectTextOnFocus
      style={{ ...(small ? { width: 72, flexGrow: 0, flexShrink: 0 } : { flex: 1, minWidth: 0 }), height: small ? 36 : 44, paddingHorizontal: 10, borderRadius: theme.radius, borderWidth: 1, borderColor: c.line, backgroundColor: c.bg, color: c.ink, fontFamily: theme.fonts.monoBold, fontSize: small ? 14 : 17, textAlign: 'center' }} />
  );
}

/** − 2:00 + : 15 seconds a tap */
function RestStepper({ label, a11y, onMinus, onPlus }: { label: string; a11y: string; onMinus: () => void; onPlus: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const btn = (text: string, onPress: () => void, name: string) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${a11y}: ${name} 15 seconds`} hitSlop={6}
      style={({ pressed }) => ({ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: pressed ? c.accentSoft : 'transparent' })}>
      <Body bold color={c.accent}>{text}</Body>
    </Pressable>
  );
  return (
    <View accessibilityLabel={`${a11y}: ${label}`} style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: c.line, height: 32 }}>
      {btn('−', onMinus, 'less')}
      <Mono style={{ fontSize: 12, minWidth: 64, textAlign: 'center' }} color={c.ink}>{label}</Mono>
      {btn('+', onPlus, 'more')}
    </View>
  );
}

function SmallButton({ label, onPress, danger, a11y }: { label: string; onPress: () => void; danger?: boolean; a11y?: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y ?? label} hitSlop={4}
      style={({ pressed }) => ({ height: 32, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: danger ? c.danger : c.line, backgroundColor: pressed ? c.surfaceHigh : 'transparent', alignSelf: 'flex-start' })}>
      <Mono style={{ fontSize: 12 }} color={danger ? c.danger : c.inkSoft} numberOfLines={1}>{label}</Mono>
    </Pressable>
  );
}
