// How Recomp works: everything the app does, in two minutes.
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme/theme-context';
import { Button } from '@/ui/button';
import { useTips } from '@/ui/coach-tip';
import { Header } from '@/ui/parts';
import { Screen } from '@/ui/screen';
import { Body } from '@/ui/text';
import { useToast } from '@/ui/toast';

const GUIDE: [string, string][] = [
  ['Your plan', 'The Plan tab holds your training days. Tap a day to change its exercises, sets, reps, rest or warm-ups, or tap Start to train it. You can build your own plan, pick a ready-made one or create one with AI at any time. Your history is always kept.'],
  ['Logging a set', 'Type the weight and reps, then tap ✓. Grey numbers are suggestions from last time; tap ✓ with the boxes empty to accept them. Tap a logged set to edit it, or ✕ to delete it.'],
  ['Rest', 'The rest timer starts on its own after each set, and your phone alerts you when it ends, even when locked. Use − / + under a set to change the rest after it, or the Rest chip to change it for every set. The same weight and reps on less rest is progress too, and earns a Less rest record.'],
  ['Drop sets, warm-ups and swaps', 'Tap + Drop under any set to add a lighter set straight after it. Warm-up chips show suggested ramp-up sets; tick them as you go. Machine taken? Tap ⇄ to swap to the exercise\'s alternative.'],
  ['Getting stronger', 'When you hit the top of the rep range, the tip next to Last suggests adding weight or cutting rest. Record badges mark heavier weight, best estimated 1RM, more reps, or less rest.'],
  ['Finishing', 'Tap Finish workout at the bottom to save and see your summary. Mixing days? Save and keep going stores what you\'ve done and lets you add exercises from another day.'],
  ['History and Progress', 'History shows every workout on a calendar. Progress charts each exercise (top set, 1RM, volume, reps and rest) and your bodyweight trend.'],
  ['Your data', 'Everything stays on this phone. Export a backup from Settings now and then, especially before deleting the app.']
];

export default function GuideScreen() {
  const { theme } = useTheme();
  const { replay } = useTips();
  const toast = useToast();
  const c = theme.colors;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/settings'));
  return (
    <Screen tabBar={false}>
      <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
        <Body color={c.accent}>‹ Back</Body>
      </Pressable>
      <Header eyebrow="Guide" title="How Recomp works" sub="Everything the app does, in two minutes." />
      {GUIDE.map(([title, text], i) => (
        <View key={title} style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentSoft }}>
            <Body bold style={{ fontSize: 13 }} color={c.accent}>{i + 1}</Body>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Body bold>{title}</Body>
            <Body color={c.inkSoft} style={{ fontSize: 14 }}>{text}</Body>
          </View>
        </View>
      ))}
      <Button label="Show the tips again" onPress={async () => { await replay(); toast('Tips will show again as you train'); close(); }} />
      <Button label="Done" kind="primary" onPress={close} />
    </Screen>
  );
}
