// How hard was today? Four choices (tap the chosen one again to clear it), each with bars, a name and a hint,
// so the choice never rests on colour alone.
import { Pressable, View } from 'react-native';

import { EFFORT_LEVELS } from '@/core/effort';
import { useTheme } from '@/theme/theme-context';

import { haptic } from './haptics';
import { Body, Mono } from './text';

export function EffortPicker({ value, onChange, label = 'HOW HARD WAS TODAY?' }: { value: number | null; onChange: (v: number | null) => void; label?: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={{ gap: 8 }}>
      <Mono bold style={{ fontSize: 11, letterSpacing: 1 }} color={c.muted}>{label}</Mono>
      <View accessibilityRole="radiogroup" accessibilityLabel="Effort" style={{ flexDirection: 'row', gap: 8 }}>
        {EFFORT_LEVELS.map((l, i) => {
          const on = l.value === value;
          return (
            <Pressable key={l.value} onPress={() => { haptic('light'); onChange(on ? null : l.value); }} accessibilityRole="radio" aria-checked={on} accessibilityLabel={`${l.label}: ${l.hint}`}
              style={({ pressed }) => ({ flex: 1, minHeight: 76, paddingVertical: 8, paddingHorizontal: 4, gap: 3, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius, borderWidth: 1.5, borderColor: on ? c.todo : c.line, backgroundColor: on ? c.accentSoft : c.surfaceHigh, opacity: pressed ? 0.8 : 1 })}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 16 }}>
                {[6, 9, 12, 16].map((h, j) => <View key={j} style={{ width: 5, height: h, borderRadius: 2, backgroundColor: j <= i ? (on ? c.todo : c.inkSoft) : c.line }} />)}
              </View>
              <Body bold style={{ fontSize: 13 }} color={on ? c.todo : c.ink}>{l.label}</Body>
              <Mono style={{ fontSize: 10, textAlign: 'center' }} color={c.muted}>{l.hint}</Mono>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
