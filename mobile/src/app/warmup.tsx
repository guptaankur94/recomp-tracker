// Edit an exercise's warm-up: your own sets (weight and reps), or back to the automatic ramp that follows
// your working weight. Saved by exercise name, so it applies on every day the exercise appears.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { MAX_WARMUP_SETS, parseWarmupRows, type WarmupRow } from '@/core/warmups';
import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';
import { Button } from '@/ui/button';
import { haptic } from '@/ui/haptics';
import { Header } from '@/ui/parts';
import { Card, Screen } from '@/ui/screen';
import { Body, Mono } from '@/ui/text';
import { useToast } from '@/ui/toast';

export default function WarmupScreen() {
  // name: the exercise; rows: the warm-up shown on it now, to start from
  const params = useLocalSearchParams<{ name: string; rows?: string }>();
  const name = params.name ?? '';
  const { warmups, setWarmup } = useData();
  const { theme } = useTheme();
  const toast = useToast();
  const c = theme.colors;
  const own = !!warmups && Object.prototype.hasOwnProperty.call(warmups, name);
  const [rows, setRows] = useState<WarmupRow[]>(() => {
    try {
      const parsed = JSON.parse(params.rows || '[]');
      return Array.isArray(parsed) ? parsed.map(r => ({ kg: String(r.kg ?? ''), reps: String(r.reps ?? '') })) : [];
    } catch {
      return [];
    }
  });
  const field = (i: number, key: keyof WarmupRow, value: string) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  const save = async () => {
    const result = parseWarmupRows(rows);
    if ('error' in result) {
      haptic('error');
      toast(result.error, { error: true });
      return;
    }
    await setWarmup(name, result.sets);
    haptic('success');
    toast(result.sets.length ? `Warm-up saved for ${name}` : `No warm-up for ${name}`);
    router.back();
  };
  const automatic = async () => {
    await setWarmup(name, null);
    haptic('success');
    toast(`${name} is back to the automatic warm-up`);
    router.back();
  };
  const input = { height: 46, flex: 1, minWidth: 0, borderRadius: theme.radius, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, color: c.ink, fontFamily: theme.fonts.mono, fontSize: 17, textAlign: 'center' as const };
  return (
    <Screen tabBar={false}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={10} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
        <Body color={c.accent}>‹ Cancel</Body>
      </Pressable>
      <Header eyebrow="Warm-up" title={name} sub="Used every time you do this exercise, on any day. Leave the weight empty for a light set." />
      <Card>
        {rows.length ? rows.map((r, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Mono style={{ width: 16 }} color={c.muted}>{i + 1}</Mono>
            <TextInput value={r.kg} onChangeText={v => field(i, 'kg', v)} keyboardType="decimal-pad" placeholder="Light" placeholderTextColor={c.muted}
              accessibilityLabel={`Warm-up ${i + 1} weight in kg`} style={input} />
            <Mono color={c.inkSoft}>kg ×</Mono>
            <TextInput value={r.reps} onChangeText={v => field(i, 'reps', v)} keyboardType="number-pad" placeholder="reps" placeholderTextColor={c.muted}
              accessibilityLabel={`Warm-up ${i + 1} reps`} style={input} />
            <Pressable onPress={() => { setRows(rs => rs.filter((_, j) => j !== i)); haptic('light'); }} accessibilityRole="button" accessibilityLabel={`Remove warm-up ${i + 1}`} hitSlop={8}
              style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
              <Body color={c.muted}>×</Body>
            </Pressable>
          </View>
        )) : <Body color={c.inkSoft}>No warm-up for this exercise.</Body>}
        {rows.length < MAX_WARMUP_SETS && (
          <Button label="+ Add warm-up set" onPress={() => setRows(rs => [...rs, { kg: '', reps: rs[rs.length - 1]?.reps || '8' }])} />
        )}
      </Card>
      <Mono color={c.muted} style={{ fontSize: 12 }}>Warm-ups aren&apos;t logged, so they never count toward volume or records.</Mono>
      <Button label="Save warm-up" kind="primary" onPress={save} />
      {own && <Button label="Use automatic warm-up" onPress={automatic} />}
    </Screen>
  );
}
