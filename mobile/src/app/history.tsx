// History: the calendar and saved workouts.
import { View } from 'react-native';

import { Body, Eyebrow, Title } from '@/ui/text';
import { Card, Screen } from '@/ui/screen';
import { useTheme } from '@/theme/theme-context';

export default function HistoryScreen() {
  const { theme } = useTheme();
  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <Eyebrow>History</Eyebrow>
        <Title>Your workouts</Title>
      </View>
      <Card>
        <Body bold>Your workouts will appear here</Body>
        <Body color={theme.colors.inkSoft}>When you finish a workout it lands on the calendar with its sets, volume, duration and personal records.</Body>
      </Card>
    </Screen>
  );
}
