// Coach tips: one short hint at the moment a feature becomes useful, each shown once.
// People who already have workouts saved start with all of them marked seen.
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';

import { haptic } from './haptics';
import { Button } from './button';
import { Body } from './text';

export const TIP_IDS = ['rest', 'drop', 'swap', 'records'] as const;
export type TipId = (typeof TIP_IDS)[number];

export function useTips() {
  const { settings, history, updateSettings } = useData();
  const seen = settings.tipsSeen ?? (history.length ? [...TIP_IDS] : []);
  return {
    unseen: (id: TipId) => !seen.includes(id),
    dismiss: (id: TipId) => { haptic('light'); updateSettings({ tipsSeen: [...new Set([...seen, id])] }); },
    replay: () => updateSettings({ tipsSeen: [] })
  };
}

export function CoachTip({ id, title, text }: { id: TipId; title: string; text: string }) {
  const { theme } = useTheme();
  const { dismiss } = useTips();
  const c = theme.colors;
  return (
    <Animated.View entering={FadeIn.duration(250)} accessibilityRole="summary"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: theme.radius, borderWidth: 1, borderColor: c.accent, backgroundColor: c.accentSoft }}>
      <View style={{ flex: 1 }}>
        <Body style={{ fontSize: 14 }}><Body bold style={{ fontSize: 14 }}>{title}</Body> {text}</Body>
      </View>
      <Button label="Got it" onPress={() => dismiss(id)} style={{ minHeight: 36, paddingHorizontal: 12 }} />
    </Animated.View>
  );
}
