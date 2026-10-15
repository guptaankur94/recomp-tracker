// Picking an exercise: from another day of your plan (it brings its sets, reps, rest and swap), the exercise
// library, ones you've logged before, or a new one by name. Used for today's workout and the plan editor.
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import type { ExtraExercise } from '@/core/draft';
import { fmtClock } from '@/core/format';
import { libExercise, LIBRARY, MUSCLES } from '@/core/library';
import type { PlanDay, Session } from '@/core/types';
import { useTheme } from '@/theme/theme-context';

import { SectionLabel } from './parts';
import { Body, Mono } from './text';

interface Props {
  /** Plan days offered as a source (with their index, so a day can leave itself out) */
  planDays: { day: PlanDay; idx: number }[];
  history: Session[];
  onPick: (ex: ExtraExercise) => void;
}

export function ExercisePicker({ planDays, history, onPick }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const matches = (name: string) => !q || name.toLowerCase().includes(q);

  const fromPlan = muscle ? [] : planDays.map(({ day }) => ({ day, list: day.exercises.filter(e => matches(e.name)) })).filter(x => x.list.length);
  const library = [...LIBRARY.values()].filter(e => (!muscle || e.muscle === muscle) && matches(e.name));
  const known = new Set([...LIBRARY.keys(), ...planDays.flatMap(({ day }) => day.exercises.map(e => e.name))]);
  const logged = muscle ? [] : [...new Set(history.flatMap(s => s.exercises.map(e => e.name)))].filter(n => !known.has(n) && matches(n)).sort();
  const exact = [...known, ...logged].some(n => n.toLowerCase() === q);
  const generic = (name: string): ExtraExercise => ({ name, repTarget: '8–12 reps', weightTarget: 'Custom', rest: 90, sets: 3 });

  return (
    <>
      <TextInput value={query} onChangeText={setQuery} placeholder="Search or type a new exercise" placeholderTextColor={c.muted}
        accessibilityLabel="Search exercises" returnKeyType="search" autoCorrect={false}
        style={{ height: 46, paddingHorizontal: 14, borderRadius: theme.radius, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, color: c.ink, fontFamily: theme.fonts.body, fontSize: 16 }} />
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {MUSCLES.map(m => {
          const on = muscle === m;
          return (
            <Pressable key={m} onPress={() => setMuscle(on ? null : m)} accessibilityRole="radio" aria-checked={on}
              style={{ paddingHorizontal: 12, height: 32, justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : 'transparent' }}>
              <Body style={{ fontSize: 13 }} bold={on} color={on ? c.ink : c.inkSoft}>{m}</Body>
            </Pressable>
          );
        })}
      </View>
      {q.length > 1 && !exact && (
        <Row title={`Add “${query.trim()}”`} sub="A new exercise: 3 × 8–12 reps, rest 1:30. Change it any time." onPress={() => onPick(generic(query.trim().replace(/\s+/g, ' ')))} />
      )}
      {fromPlan.map(({ day, list }) => (
        <View key={day.day} style={{ gap: 6 }}>
          <SectionLabel>{`${day.day} · ${day.title}`}</SectionLabel>
          {list.map(e => (
            <Row key={e.name} title={e.name} sub={`${e.warmup ? `${e.warmup} warm-up + ` : ''}${e.sets} × ${e.repTarget} · ${e.weightTarget} · rest ${fmtClock(e.rest)}`}
              onPress={() => onPick({ ...e, fromDay: day.day })} />
          ))}
        </View>
      ))}
      {logged.length > 0 && (
        <View style={{ gap: 6 }}>
          <SectionLabel>Logged before</SectionLabel>
          {logged.map(n => <Row key={n} title={n} sub="3 × 8–12 reps · rest 1:30" onPress={() => onPick(generic(n))} />)}
        </View>
      )}
      <SectionLabel right={`${library.length}`}>{muscle ? `Library · ${muscle}` : 'Library'}</SectionLabel>
      {library.map(e => (
        <Row key={e.name} title={e.name} sub={`${e.muscle} · ${e.equipment} · ${e.reps} · rest ${fmtClock(e.rest)}`} onPress={() => onPick(libExercise(e.name))} />
      ))}
      {!library.length && !fromPlan.length && !logged.length && <Mono color={c.muted}>Nothing matches. Add it as a new exercise above.</Mono>}
    </>
  );
}

function Row({ title, sub, onPress }: { title: string; sub: string; onPress: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Add ${title}. ${sub}`}
      style={({ pressed }) => ({ padding: 12, borderRadius: theme.radius, borderWidth: 1, borderColor: c.line, backgroundColor: pressed ? c.surfaceHigh : c.surface, gap: 2 })}>
      <Body bold>{title}</Body>
      <Mono style={{ fontSize: 12 }}>{sub}</Mono>
    </Pressable>
  );
}
