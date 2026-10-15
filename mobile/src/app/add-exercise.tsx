// Add an exercise to today's workout: from another day of your plan (it brings its sets, reps, rest and
// swap), the exercise library, ones you've logged before, or a new one by name.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { addExtra, type ExtraExercise } from '@/core/draft';
import { fmtClock } from '@/core/format';
import { libExercise, LIBRARY, MUSCLES } from '@/core/library';
import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';
import { haptic } from '@/ui/haptics';
import { Header, SectionLabel } from '@/ui/parts';
import { Screen } from '@/ui/screen';
import { Body, Mono } from '@/ui/text';
import { useToast } from '@/ui/toast';

export default function AddExerciseScreen() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const dayIdx = Number(day) || 0;
  const { activePlan, history, drafts, dayAt, setDraft } = useData();
  const { theme } = useTheme();
  const toast = useToast();
  const c = theme.colors;
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const matches = (name: string) => !q || name.toLowerCase().includes(q);
  const target = dayAt(dayIdx);

  const add = (ex: ExtraExercise) => {
    setDraft(dayIdx, addExtra(drafts[dayIdx] ?? null, ex, Date.now()));
    haptic('success');
    toast(`${ex.name} added${ex.fromDay ? ` from ${ex.fromDay}` : ''}`);
    router.back();
  };

  const planDays = muscle ? [] : activePlan.days.map((d, i) => ({ d, i })).filter(({ i }) => i !== dayIdx)
    .map(({ d }) => ({ d, list: d.exercises.filter(e => matches(e.name)) })).filter(x => x.list.length);
  const library = [...LIBRARY.values()].filter(e => (!muscle || e.muscle === muscle) && matches(e.name));
  const known = new Set([...LIBRARY.keys(), ...activePlan.days.flatMap(d => d.exercises.map(e => e.name))]);
  const logged = muscle ? [] : [...new Set(history.flatMap(s => s.exercises.map(e => e.name)))].filter(n => !known.has(n) && matches(n)).sort();
  const exact = [...known, ...logged].some(n => n.toLowerCase() === q);

  return (
    <Screen tabBar={false}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={10} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
        <Body color={c.accent}>‹ Cancel</Body>
      </Pressable>
      <Header eyebrow={`Add to ${target.day === 'Custom' ? 'your custom workout' : target.day}`} title="Add exercise" />
      <TextInput value={query} onChangeText={setQuery} placeholder="Search or type a new exercise" placeholderTextColor={c.muted} autoFocus={false}
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
        <Row title={`Add “${query.trim()}”`} sub="A new exercise: 3 × 8–12 reps, rest 1:30. Change sets and rest as you go."
          onPress={() => add({ name: query.trim().replace(/\s+/g, ' '), repTarget: '8–12 reps', weightTarget: 'Custom', rest: 90, sets: 3 })} />
      )}
      {planDays.map(({ d, list }) => (
        <View key={d.day} style={{ gap: 6 }}>
          <SectionLabel>{`${d.day} · ${d.title}`}</SectionLabel>
          {list.map(e => (
            <Row key={e.name} title={e.name} sub={`${e.warmup ? `${e.warmup} warm-up + ` : ''}${e.sets} × ${e.repTarget} · ${e.weightTarget} · rest ${fmtClock(e.rest)}`}
              onPress={() => add({ ...e, fromDay: d.day })} />
          ))}
        </View>
      ))}
      {logged.length > 0 && (
        <View style={{ gap: 6 }}>
          <SectionLabel>Logged before</SectionLabel>
          {logged.map(n => <Row key={n} title={n} sub="3 × 8–12 reps · rest 1:30" onPress={() => add({ name: n, repTarget: '8–12 reps', weightTarget: 'Custom', rest: 90, sets: 3 })} />)}
        </View>
      )}
      <SectionLabel right={`${library.length}`}>{muscle ? `Library · ${muscle}` : 'Library'}</SectionLabel>
      {library.map(e => (
        <Row key={e.name} title={e.name} sub={`${e.muscle} · ${e.equipment} · ${e.reps} · rest ${fmtClock(e.rest)}`} onPress={() => add(libExercise(e.name))} />
      ))}
      {!library.length && !planDays.length && !logged.length && <Mono color={c.muted}>Nothing matches. Add it as a new exercise above.</Mono>}
    </Screen>
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
