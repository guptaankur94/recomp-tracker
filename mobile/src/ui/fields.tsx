// Form controls: a labelled text field, a − value + stepper, and a row of choices.
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme/theme-context';

import { Body, Mono } from './text';

export function Field({ label, style, ...input }: TextInputProps & { label: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <Mono style={{ fontSize: 11, letterSpacing: 1 }} color={c.muted}>{label.toUpperCase()}</Mono>
      <TextInput accessibilityLabel={label} placeholderTextColor={c.muted} {...input}
        style={[{ minHeight: 46, paddingHorizontal: 14, paddingVertical: 10, borderRadius: theme.radius, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, color: c.ink, fontFamily: theme.fonts.body, fontSize: 16, minWidth: 0 }, style]} />
    </View>
  );
}

export function Stepper({ label, value, onMinus, onPlus, minusDisabled, plusDisabled }: {
  label: string; value: string; onMinus: () => void; onPlus: () => void; minusDisabled?: boolean; plusDisabled?: boolean;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const btn = (text: string, onPress: () => void, disabled: boolean | undefined, name: string) => (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={`${label}: ${name}`} aria-disabled={!!disabled} hitSlop={6}
      style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: pressed ? c.accentSoft : 'transparent', opacity: disabled ? 0.35 : 1 })}>
      <Body bold style={{ fontSize: 20 }} color={c.accent}>{text}</Body>
    </Pressable>
  );
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <Mono style={{ fontSize: 11, letterSpacing: 1 }} color={c.muted}>{label.toUpperCase()}</Mono>
      <View accessible={false} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: theme.radius, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, height: 46 }}>
        {btn('−', onMinus, minusDisabled, 'less')}
        <Mono bold color={c.ink} style={{ fontSize: 16 }} accessibilityLabel={`${label}: ${value}`}>{value}</Mono>
        {btn('+', onPlus, plusDisabled, 'more')}
      </View>
    </View>
  );
}

/** Choice chips; options with a second line (sub) show as cards, `columns` to a row */
export function Choices<T extends string | number>({ label, options, value, onChange, columns }: {
  label?: string; options: { value: T; label: string; sub?: string }[]; value: T | null | undefined; onChange: (v: T) => void; columns?: number;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={{ gap: 6 }}>
      {label && <Mono style={{ fontSize: 11, letterSpacing: 1 }} color={c.muted}>{label.toUpperCase()}</Mono>}
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: columns ? 8 : 6 }}>
        {options.map(o => {
          const on = o.value === value;
          if (columns) {
            return (
              <Pressable key={String(o.value)} onPress={() => onChange(o.value)} accessibilityRole="radio" aria-checked={on} accessibilityLabel={o.sub ? `${o.label}. ${o.sub}` : o.label}
                style={{ flexBasis: `${100 / columns - 3}%`, flexGrow: 1, minHeight: 56, padding: columns >= 3 ? 8 : 12, gap: 2, justifyContent: 'center', borderRadius: theme.radius, borderWidth: on ? 2 : 1, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : c.surface }}>
                <Body bold style={{ fontSize: columns >= 3 ? 13 : 15 }} color={c.ink} numberOfLines={1} adjustsFontSizeToFit>{o.label}</Body>
                {o.sub ? <Body style={{ fontSize: 12 }} color={c.inkSoft}>{o.sub}</Body> : null}
              </Pressable>
            );
          }
          return (
            <Pressable key={String(o.value)} onPress={() => onChange(o.value)} accessibilityRole="radio" aria-checked={on}
              style={{ paddingHorizontal: 14, minHeight: 38, justifyContent: 'center', borderRadius: 19, borderWidth: 1, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : 'transparent' }}>
              <Body style={{ fontSize: 14 }} bold={on} color={on ? c.ink : c.inkSoft}>{o.label}</Body>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
