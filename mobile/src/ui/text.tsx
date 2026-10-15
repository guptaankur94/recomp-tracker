// Text styles shared by every screen; each reads the current theme's fonts and colours.
import { Text, type TextProps } from 'react-native';

import { useTheme } from '@/theme/theme-context';

type Props = TextProps & { color?: string };

/** Screen and card titles */
export function Title({ style, color, children, size = 34, ...rest }: Props & { size?: number }) {
  const { theme } = useTheme();
  return (
    <Text accessibilityRole="header" {...rest}
      style={[{ fontFamily: theme.fonts.display, fontSize: theme.displayUpper ? size * 0.78 : size, lineHeight: size * 1.12, color: color ?? theme.colors.ink, textTransform: theme.displayUpper ? 'uppercase' : 'none' }, style]}>
      {children}
    </Text>
  );
}

/** Small spaced capitals above a title: "WORKOUT · DAY 1" */
export function Eyebrow({ style, color, ...rest }: Props) {
  const { theme } = useTheme();
  return <Text {...rest} style={[{ fontFamily: theme.fonts.mono, fontSize: 11, letterSpacing: 1.6, color: color ?? theme.colors.accent, textTransform: 'uppercase' }, style]} />;
}

export function Body({ style, color, bold, ...rest }: Props & { bold?: boolean }) {
  const { theme } = useTheme();
  return <Text {...rest} style={[{ fontFamily: bold ? theme.fonts.bodyBold : theme.fonts.body, fontSize: 15, lineHeight: 21, color: color ?? theme.colors.ink }, style]} />;
}

/** Numbers: weights, reps, rest, timers */
export function Mono({ style, color, bold, ...rest }: Props & { bold?: boolean }) {
  const { theme } = useTheme();
  return <Text {...rest} style={[{ fontFamily: bold ? theme.fonts.monoBold : theme.fonts.mono, fontSize: 13, color: color ?? theme.colors.inkSoft, fontVariant: ['tabular-nums'] }, style]} />;
}
