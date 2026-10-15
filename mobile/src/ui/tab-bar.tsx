// The floating capsule tab bar: Plan, History, Workout (centre), Progress, Settings.
import { TabList, TabSlot, Tabs, TabTrigger, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme-context';

type Tab = { name: string; href: '/' | '/plan' | '/history' | '/progress' | '/settings'; label: string; icon: SymbolViewProps['name'] };

const TABS: Tab[] = [
  { name: 'plan', href: '/plan', label: 'Plan', icon: { ios: 'list.bullet.rectangle', android: 'list_alt', web: 'list_alt' } },
  { name: 'history', href: '/history', label: 'History', icon: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' } },
  { name: 'index', href: '/', label: 'Workout', icon: { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' } },
  { name: 'progress', href: '/progress', label: 'Progress', icon: { ios: 'chart.line.uptrend.xyaxis', android: 'show_chart', web: 'show_chart' } },
  { name: 'settings', href: '/settings', label: 'Settings', icon: { ios: 'gearshape', android: 'settings', web: 'settings' } }
];

// The triggers must be direct children of the TabList's child: that is where Expo Router looks for the tabs
export function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        <Bar>
          {TABS.map(tab => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton tab={tab} />
            </TabTrigger>
          ))}
        </Bar>
      </TabList>
    </Tabs>
  );
}

function Bar({ children, style, ...props }: TabListProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <View {...props} accessibilityRole="tablist" style={[styles.bar, { backgroundColor: theme.colors.bar, borderColor: theme.colors.line }]}>
        {children}
      </View>
    </View>
  );
}

function TabButton({ tab, isFocused, ...props }: TabTriggerSlotProps & { tab: Tab }) {
  const { theme } = useTheme();
  const centre = tab.name === 'index';
  const color = centre ? theme.colors.onAccent : isFocused ? theme.colors.accent : theme.colors.muted;
  return (
    <Pressable {...props} accessibilityRole="tab" accessibilityLabel={tab.label} aria-selected={!!isFocused}
      style={({ pressed }) => [styles.tab, pressed && { opacity: 0.7 }]}>
      <View style={centre
        ? [styles.centre, { backgroundColor: theme.colors.accent, borderColor: isFocused ? theme.colors.ink : 'transparent' }]
        : [styles.icon, isFocused && { backgroundColor: theme.colors.accentSoft }]}>
        <SymbolView name={tab.icon} size={centre ? 24 : 21} tintColor={color} />
      </View>
      {!centre && <Text style={[styles.label, { color, fontFamily: theme.fonts.mono }]}>{tab.label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', height: 66, paddingHorizontal: 6, borderRadius: 33, borderWidth: 1, width: 360, maxWidth: '92%' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, height: '100%' },
  icon: { width: 44, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  centre: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  label: { fontSize: 10, letterSpacing: 0.3 }
});
