// Calories burned on a workout, typed from a fitness watch: on the summary after Finish and in a workout's details.
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { MAX_CALORIES, parseCalories } from '@/core/history';
import type { Session } from '@/core/types';
import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';
import { Button } from '@/ui/button';
import { haptic } from '@/ui/haptics';
import { Card } from '@/ui/screen';
import { Body, Mono } from '@/ui/text';
import { useToast } from '@/ui/toast';

/** Give it key={session.id} so the box starts from that workout's number */
export function CaloriesField({ session }: { session: Session }) {
  const { setCalories } = useData();
  const { theme } = useTheme();
  const toast = useToast();
  const c = theme.colors;
  const initial = session.calories ? String(session.calories) : '';
  const [text, setText] = useState(initial);
  const [shown, setShown] = useState(initial);
  // What's saved, read when saving so Save and leaving the box don't both save
  const saved = useRef(initial);
  const dirty = text.trim() !== shown;
  const commit = async () => {
    if (text.trim() === saved.current) return;
    const parsed = parseCalories(text);
    if (!parsed.ok) {
      haptic('error');
      toast(`Enter calories between 1 and ${MAX_CALORIES}`, { error: true });
      return;
    }
    saved.current = parsed.kcal ? String(parsed.kcal) : '';
    setText(saved.current);
    setShown(saved.current);
    await setCalories(session.id, parsed.kcal);
    haptic('light');
    toast(parsed.kcal ? `Saved ${parsed.kcal} kcal` : 'Calories cleared');
  };
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Body bold>Calories burned</Body>
          <Body style={{ fontSize: 13 }} color={c.inkSoft}>Active calories from your watch · optional</Body>
        </View>
        <TextInput value={text} onChangeText={setText} onBlur={commit} onSubmitEditing={commit}
          keyboardType="number-pad" returnKeyType="done" placeholder="—" placeholderTextColor={c.muted} maxLength={4}
          accessibilityLabel="Calories burned, kcal" selectTextOnFocus
          style={{ width: 84, height: 44, paddingHorizontal: 12, borderRadius: theme.radius, borderWidth: 1, borderColor: c.line, backgroundColor: c.bg, color: c.ink, fontFamily: theme.fonts.mono, fontSize: 17, textAlign: 'right', minWidth: 0 }} />
        <Mono color={c.inkSoft}>kcal</Mono>
      </View>
      {dirty && <Button label="Save calories" kind="primary" onPress={commit} />}
    </Card>
  );
}
