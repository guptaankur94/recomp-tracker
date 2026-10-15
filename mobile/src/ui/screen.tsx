// A tab screen: themed background, safe-area top, and room at the bottom for the floating tab bar.
import { memo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme-context';

export const TAB_BAR_SPACE = 110;

/** Vitruvian's faint blueprint grid, 24 pt squares */
const Grid = memo(function Grid({ color }: { color: string }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: 60 }, (_, i) => <View key={`h${i}`} style={{ position: 'absolute', left: 0, right: 0, top: i * 24, height: 1, backgroundColor: color }} />)}
      {Array.from({ length: 40 }, (_, i) => <View key={`v${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: i * 24, width: 1, backgroundColor: color }} />)}
    </View>
  );
});

/** tabBar: leave room for the floating tab bar (off for pages opened over the tabs) */
export function Screen({ children, tabBar = true }: { children: ReactNode; tabBar?: boolean }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg, overflow: 'hidden' }}>
      {theme.grid && <Grid color={theme.grid} />}
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + (tabBar ? TAB_BAR_SPACE : 32), paddingHorizontal: 20, gap: 14 }}>
        {children}
      </ScrollView>
    </View>
  );
}

export function Card({ children, accent }: { children: ReactNode; accent?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius, borderWidth: 1, borderColor: accent ? theme.colors.accent : theme.colors.line, padding: 16, gap: 6 }}>
      {children}
    </View>
  );
}
