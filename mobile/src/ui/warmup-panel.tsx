// Warm-up on an exercise card: a panel of rows to tick, like the working sets. Once every warm-up is ticked
// (or set 1 is done) it folds to one line; tap it to open again. With no warm-up, a quiet line offers to add one.
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { WarmupSet } from '@/core/workout';
import { useTheme } from '@/theme/theme-context';

import { haptic } from './haptics';
import { Body, Mono } from './text';

interface Props {
  name: string;
  ramp: WarmupSet[];
  done: Set<number>;
  /** The weight the ramp builds to, for the "~50%" hints (0 when unknown) */
  work: number;
  set1Done: boolean;
  onToggle: (i: number) => void;
  onEdit: () => void;
}

export function WarmupPanel({ name, ramp, done, work, set1Done, onToggle, onEdit }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [open, setOpen] = useState(false);
  const panel = { borderRadius: theme.radius, backgroundColor: c.surfaceHigh };
  if (!ramp.length) {
    return (
      <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Add a warm-up for ${name}`}
        style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', borderRadius: theme.radius, borderWidth: 1, borderColor: c.line, backgroundColor: pressed ? c.surfaceHigh : 'transparent' })}>
        <Body style={{ fontSize: 14 }} color={c.inkSoft}>+ Add warm-up</Body>
      </Pressable>
    );
  }
  const count = ramp.filter((_, i) => done.has(i)).length;
  const allDone = count === ramp.length;
  const foldable = allDone || set1Done;
  const toggleOpen = () => { setOpen(o => !o); haptic('light'); };
  if (foldable && !open) {
    const summary = ramp.map(w => w.label.replace(/ kg × /, '×').replace(/ × /, '×')).join(' · ');
    return (
      <Pressable onPress={toggleOpen} accessibilityRole="button" aria-expanded={false}
        accessibilityLabel={`Warm-up ${allDone ? 'done' : `${count} of ${ramp.length} done`}. Show warm-up sets`}
        style={{ ...panel, minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surfaceHigh, borderLeftWidth: 4, borderLeftColor: allDone ? c.done : c.todo }}>
        <Body bold style={{ fontSize: 14 }} color={allDone ? c.done : c.ink}>{allDone ? '✓ Warm-up done' : `Warm-up · ${count}/${ramp.length}`}</Body>
        <Mono style={{ fontSize: 13, flex: 1 }} color={c.inkSoft} numberOfLines={1}>{summary}</Mono>
        <Body color={c.inkSoft}>›</Body>
      </Pressable>
    );
  }
  const pill = { height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: c.line, justifyContent: 'center' as const, alignItems: 'center' as const };
  return (
    <View accessibilityLabel="Warm-up sets" style={{ ...panel, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 38 }}>
        <Mono bold style={{ fontSize: 12, letterSpacing: 1 }} color={c.ink}>WARM-UP</Mono>
        <Mono style={{ fontSize: 12, flex: 1 }} color={c.inkSoft}>{count}/{ramp.length}</Mono>
        <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Edit warm-up for ${name}`} style={pill}>
          <Mono style={{ fontSize: 12 }} color={c.inkSoft}>✎ Edit</Mono>
        </Pressable>
        {foldable && (
          <Pressable onPress={toggleOpen} accessibilityRole="button" aria-expanded accessibilityLabel="Hide warm-up sets" style={{ ...pill, width: 34, paddingHorizontal: 0 }}>
            <Mono style={{ fontSize: 12 }} color={c.inkSoft}>⌃</Mono>
          </Pressable>
        )}
      </View>
      {ramp.map((w, i) => {
        const on = done.has(i);
        const hint = [w.label.startsWith('Bar') && w.kg ? `${w.kg} kg` : '', w.kg && work > 0 ? `~${Math.round((w.kg / work) * 100)}%` : ''].filter(Boolean).join(' · ');
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: on ? c.done : c.todo, backgroundColor: on ? c.done : 'transparent' }}>
              <Mono bold style={{ fontSize: 11 }} color={on ? c.onAccent : c.todo}>W{i + 1}</Mono>
            </View>
            <Mono bold style={{ fontSize: 18 }} color={on ? c.muted : c.ink}>{w.label}</Mono>
            {hint ? <Mono style={{ fontSize: 12, flex: 1 }} color={on ? c.muted : c.inkSoft} numberOfLines={1}>{hint}</Mono> : <View style={{ flex: 1 }} />}
            <Pressable onPress={() => onToggle(i)} accessibilityRole="checkbox" aria-checked={on} accessibilityLabel={`Warm-up ${i + 1}: ${w.label}`}
              style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: on ? c.done : c.todo, backgroundColor: on ? c.done : 'transparent' }}>
              <Body bold color={on ? c.onAccent : c.todo}>✓</Body>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
