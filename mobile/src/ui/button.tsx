// Buttons: a filled accent one for the main action, an outlined one for the rest.
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/theme-context';

import { Body } from './text';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  kind?: 'primary' | 'secondary' | 'danger';
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, kind = 'secondary', style, disabled, ...rest }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const primary = kind === 'primary';
  return (
    <Pressable accessibilityRole="button" aria-disabled={!!disabled} disabled={disabled} {...rest}
      style={({ pressed }) => [{
        minHeight: 46, paddingHorizontal: 18, borderRadius: theme.radius, alignItems: 'center', justifyContent: 'center',
        backgroundColor: primary ? c.accent : 'transparent', borderWidth: primary ? 0 : 1, borderColor: kind === 'danger' ? c.danger : c.line,
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1
      }, style]}>
      <Body bold color={primary ? c.onAccent : kind === 'danger' ? c.danger : c.ink}>{label}</Body>
    </Pressable>
  );
}
