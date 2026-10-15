// Progress: bodyweight (log, 7-day trend, rate, goal) and the main lifts.
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { dateStrMs, fmtNum, localDateStr, shortDate } from '@/core/format';
import { bodyweightSummary, liftSummaries, type LiftSummary } from '@/core/progress';
import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';
import { Button } from '@/ui/button';
import { Header, SectionLabel, Tiles } from '@/ui/parts';
import { Card, Screen } from '@/ui/screen';
import { Body, Mono } from '@/ui/text';
import { useToast } from '@/ui/toast';

export default function ProgressScreen() {
  const { history, bodyweight, profile } = useData();
  const { theme } = useTheme();
  const c = theme.colors;
  const goalKg = profile && profile.goalKg && profile.goalKg > 0 ? profile.goalKg : null;
  const summary = bodyweightSummary(bodyweight, goalKg);
  const lifts = liftSummaries(history);
  return (
    <Screen>
      <Header eyebrow="Progress" title="How you're doing" />
      <SectionLabel>Bodyweight</SectionLabel>
      <LogWeight />
      {bodyweight.length > 0 && (
        <Tiles tiles={[
          { value: fmtNum(summary.trend ?? 0), unit: 'kg', label: '7-day average' },
          { value: summary.rate == null ? '—' : `${summary.rate > 0 ? '+' : summary.rate < 0 ? '−' : ''}${fmtNum(Math.abs(summary.rate))}`, unit: summary.rate == null ? undefined : 'kg/wk', label: summary.rateLabel, tone: summary.rateTone ?? undefined },
          { value: goalKg ? fmtNum(goalKg) : '—', unit: goalKg ? 'kg' : undefined, label: summary.goalLabel }
        ]} />
      )}
      {!bodyweight.length && <Body color={c.inkSoft}>Log your weight a few times a week. The app averages it, so day-to-day swings don&apos;t mislead you.</Body>}
      <WeighIns />
      <SectionLabel>Main lifts</SectionLabel>
      {lifts.length ? lifts.map(l => <LiftCard key={l.name} lift={l} />) : (
        <Card>
          <Body color={c.inkSoft}>Finish your first workouts and your most-trained lifts show here, with how your estimated one-rep max is moving.</Body>
        </Card>
      )}
    </Screen>
  );
}

function LogWeight() {
  const { bodyweight, logBodyweight } = useData();
  const { theme } = useTheme();
  const toast = useToast();
  const c = theme.colors;
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const last = bodyweight[bodyweight.length - 1];
  const save = async () => {
    const kg = parseFloat(text.replace(',', '.'));
    if (isNaN(kg) || kg < 20 || kg > 300) {
      setError('Enter your weight in kg, between 20 and 300.');
      return;
    }
    const dateStr = localDateStr(new Date());
    await logBodyweight({ dateStr, kg: Math.round(kg * 10) / 10 });
    setText('');
    setError('');
    toast(`${fmtNum(kg)} kg logged for today`);
  };
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput value={text} onChangeText={t => { setText(t); setError(''); }} onSubmitEditing={save} returnKeyType="done"
          keyboardType="decimal-pad" inputMode="decimal" placeholder={last ? fmtNum(last.kg) : 'kg'} placeholderTextColor={c.muted}
          accessibilityLabel="Today's weight in kg"
          style={{ flex: 1, minWidth: 0, height: 46, paddingHorizontal: 14, borderRadius: theme.radius, borderWidth: 1, borderColor: error ? c.danger : c.line, backgroundColor: c.surface, color: c.ink, fontFamily: theme.fonts.mono, fontSize: 17 }} />
        <Button label="Log today" kind="primary" onPress={save} />
      </View>
      {error ? <Body style={{ fontSize: 13 }} color={c.danger} accessibilityLiveRegion="polite">{error}</Body> : null}
    </View>
  );
}

function WeighIns() {
  const { bodyweight, removeBodyweight, logBodyweight } = useData();
  const { theme } = useTheme();
  const toast = useToast();
  const c = theme.colors;
  const [open, setOpen] = useState(false);
  if (!bodyweight.length) return null;
  const recent = bodyweight.slice().reverse();
  const remove = async (dateStr: string) => {
    const removed = await removeBodyweight(dateStr);
    if (removed) toast('Weight entry deleted', { actionLabel: 'Undo', onAction: () => { logBodyweight(removed); } });
  };
  return (
    <Card>
      <Pressable onPress={() => setOpen(o => !o)} accessibilityRole="button" aria-expanded={open} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Body bold>Weigh-ins</Body>
        <Mono>{bodyweight.length} · {open ? 'Hide' : 'Show'}</Mono>
      </Pressable>
      {open && recent.map(e => (
        <View key={e.dateStr} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 36, borderTopWidth: 1, borderTopColor: c.line }}>
          <Mono style={{ flex: 1 }}>{shortDate(dateStrMs(e.dateStr))}</Mono>
          <Mono color={c.ink} style={{ width: 80, textAlign: 'right' }}>{fmtNum(e.kg)} kg</Mono>
          <Pressable onPress={() => remove(e.dateStr)} accessibilityRole="button" accessibilityLabel={`Delete ${shortDate(dateStrMs(e.dateStr))} entry`} hitSlop={8} style={{ width: 40, alignItems: 'flex-end' }}>
            <Body color={c.muted}>✕</Body>
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

/** Name, latest best set, change, and a small bar trend of estimated 1RM per session */
function LiftCard({ lift }: { lift: LiftSummary }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const lo = Math.min(...lift.values);
  const hi = Math.max(...lift.values);
  const shown = lift.values.slice(-24);
  const flat = Math.abs(lift.change) < 0.05;
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <Body bold style={{ flex: 1 }} numberOfLines={1}>{lift.name}</Body>
        <Mono color={c.ink}>{lift.latest.weight > 0 ? `${fmtNum(lift.latest.weight)} kg × ${lift.latest.reps}` : `${lift.latest.reps} reps`}</Mono>
      </View>
      <View accessible accessibilityLabel={`${lift.values.length} sessions`} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 32 }}>
        {shown.map((v, i) => (
          <View key={i} style={{ flex: 1, maxWidth: 10, borderRadius: 1, height: hi === lo ? 16 : 6 + (v - lo) / (hi - lo) * 26, backgroundColor: i === shown.length - 1 ? c.accent : c.accentSoft }} />
        ))}
      </View>
      <Mono style={{ fontSize: 12 }} color={!flat && lift.change > 0 ? c.accent : c.inkSoft}>
        {flat ? 'No change yet' : `${lift.change > 0 ? '↑' : '↓'} ${fmtNum(Math.abs(lift.change))} ${lift.usesWeight ? 'kg est. 1RM' : 'reps'} over ${lift.values.length} sessions`}
      </Mono>
    </Card>
  );
}
