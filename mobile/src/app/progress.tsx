// Progress: bodyweight trend and lift charts.
import { View } from 'react-native';

import { Body, Eyebrow, Title } from '@/ui/text';
import { Card, Screen } from '@/ui/screen';
import { useTheme } from '@/theme/theme-context';

export default function ProgressScreen() {
  const { theme } = useTheme();
  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <Eyebrow>Progress</Eyebrow>
        <Title>How you&apos;re doing</Title>
      </View>
      <Card>
        <Body bold>Bodyweight</Body>
        <Body color={theme.colors.inkSoft}>Log your weight a few times a week. The app averages it, so day-to-day swings don&apos;t mislead you.</Body>
      </Card>
      <Card>
        <Body bold>Lifts</Body>
        <Body color={theme.colors.inkSoft}>Finish your first workout and your lifts will be charted here, with personal records marked.</Body>
      </Card>
    </Screen>
  );
}
