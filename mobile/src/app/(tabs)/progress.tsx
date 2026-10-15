// Progress: bodyweight (log, 7-day trend, rate, goal) and the main lifts.
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { RANGES, rangeStartMs, type RangeKey } from '@/core/chart';
import { dateStrMs, fmtNum, fmtVolume, localDateStr, shortDate } from '@/core/format';
import { bestSet, bodyweightSummary, exerciseSessions, liftSummaries, markRecords, METRICS, movingAverage, type LiftSummary, type MetricKey } from '@/core/progress';
import { fmtSetLine } from '@/core/workout';
import { CoachTip, useTips } from '@/ui/coach-tip';
import { Choices } from '@/ui/fields';
import { LineChart } from '@/ui/line-chart';
import { nowMs } from '@/ui/clock';
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
  const [range, setRange] = useState<RangeKey>('3m');
  const { unseen } = useTips();
  const [exercise, setExercise] = useState<string | null>(null);
  const [start] = useState(() => nowMs());
  const from = rangeStartMs(range, start);
  const goalKg = profile && profile.goalKg && profile.goalKg > 0 ? profile.goalKg : null;
  const summary = bodyweightSummary(bodyweight, goalKg);
  const lifts = liftSummaries(history);
  const avg = movingAverage(bodyweight).filter(p => p.x >= from);
  return (
    <Screen>
      <Header eyebrow="Progress" title="How you're doing" />
      <Choices value={range} onChange={setRange} options={(Object.keys(RANGES) as RangeKey[]).map(k => ({ value: k, label: RANGES[k].label }))} />
      <SectionLabel>Bodyweight</SectionLabel>
      <LogWeight />
      {bodyweight.length > 0 && (
        <Tiles tiles={[
          { value: fmtNum(summary.trend ?? 0), unit: 'kg', label: '7-day average' },
          { value: summary.rate == null ? '—' : `${summary.rate > 0 ? '+' : summary.rate < 0 ? '−' : ''}${fmtNum(Math.abs(summary.rate))}`, unit: summary.rate == null ? undefined : 'kg/wk', label: summary.rateLabel, tone: summary.rateTone ?? undefined },
          { value: goalKg ? fmtNum(goalKg) : '—', unit: goalKg ? 'kg' : undefined, label: summary.goalLabel }
        ]} />
      )}
      <Card>
        <LineChart points={avg.map(p => ({ x: p.x, y: p.y, note: `weighed ${fmtNum(p.raw)}` }))} raw={avg.map(p => ({ x: p.x, y: p.raw }))}
          target={goalKg} targetLabel={goalKg ? `Goal ${fmtNum(goalKg)}` : undefined} fmt={v => `${fmtNum(v)} kg`}
          label={summary.trend != null ? `Bodyweight, 7-day average ${fmtNum(summary.trend)} kg${summary.rate != null ? `, changing ${fmtNum(summary.rate)} kg per week` : ''}` : 'Bodyweight chart'}
          emptyText={bodyweight.length ? 'No weigh-ins in this range.' : "Log your weight a few times a week. The app averages it, so day-to-day swings don't mislead you."} />
        {avg.length > 0 && <Mono style={{ fontSize: 11 }} color={c.muted}>Line: 7-day average · dots: weigh-ins</Mono>}
      </Card>
      <WeighIns />
      <SectionLabel>Lifts</SectionLabel>
      {history.length > 0 && unseen('records') && (
        <CoachTip id="records" title="Reading the chart." text="Gold dots mark records: heavier weight, more reps, or the same work on less rest. Switch to Rest to see your rest times trend down." />
      )}
      <ExerciseChart name={exercise} onName={setExercise} from={from} />
      {lifts.length > 0 && <SectionLabel right="tap to chart">Most trained</SectionLabel>}
      {lifts.length ? lifts.map(l => <LiftCard key={l.name} lift={l} onPress={() => setExercise(l.name)} />) : (
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

/** One exercise over time on a chosen measure, with records marked and the sessions listed */
function ExerciseChart({ name, onName, from }: { name: string | null; onName: (n: string) => void; from: number }) {
  const { history } = useData();
  const { theme } = useTheme();
  const c = theme.colors;
  const [metric, setMetric] = useState<MetricKey>('top');
  const [showAll, setShowAll] = useState(false);
  const names = [...new Set(history.flatMap(s => s.exercises.map(e => e.name)))].sort((a, b) => a.localeCompare(b));
  if (!names.length) return null;
  const current = name && names.includes(name) ? name : history[0].exercises[0].name;
  const m = METRICS[metric];
  const fmt = (v: number) => (m.fmt ? m.fmt(v) : `${fmtNum(v)} ${m.unit}`);
  const rows = exerciseSessions(current, history);
  const points = markRecords(rows.map(r => ({ x: r.session.id, y: m.calc(r.ex.sets) as number, pr: r.ex.sets.some(s => s.pr) })).filter(p => p.y != null), m.lowerBetter)
    .filter(p => p.x >= from).map(p => ({ x: p.x, y: p.y, record: p.record, best: p.best }));
  const recent = rows.slice().reverse();
  return (
    <Card>
      <Body bold>Exercise progress</Body>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {names.map(n => {
          const on = n === current;
          return (
            <Pressable key={n} onPress={() => { onName(n); setShowAll(false); }} accessibilityRole="radio" aria-checked={on}
              style={{ paddingHorizontal: 12, height: 32, justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : 'transparent' }}>
              <Body style={{ fontSize: 13 }} bold={on} color={on ? c.ink : c.inkSoft}>{n}</Body>
            </Pressable>
          );
        })}
      </ScrollView>
      <Choices value={metric} onChange={setMetric} options={(Object.keys(METRICS) as MetricKey[]).map(k => ({ value: k, label: METRICS[k].label }))} />
      <LineChart points={points} fmt={fmt}
        label={points.length ? `${current} ${m.label}: latest ${fmt(points[points.length - 1].y)}` : `${current} chart`}
        emptyText={!rows.length ? 'Finish a workout to chart it.' : metric === 'rest' ? 'No rest times logged for this exercise yet.' : 'No sessions in this range.'} />
      <Mono style={{ fontSize: 11 }} color={c.muted}>{points.some(p => p.record || p.best) ? `Gold: a record session or the all-time best${m.lowerBetter ? ' · lower is better' : ''}` : m.lowerBetter ? 'Lower is better' : ''}</Mono>
      {recent.slice(0, showAll ? recent.length : 5).map(r => {
        const best = bestSet(r.ex.sets);
        return (
          <View key={r.session.id} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 34, borderTopWidth: 1, borderTopColor: c.line, gap: 8 }}>
            <Mono style={{ width: 56 }}>{shortDate(r.session.id)}</Mono>
            <Mono color={c.ink} style={{ flex: 1 }}>{fmtSetLine(best)}{best.drops ? ` +${best.drops.length} drop` : ''}</Mono>
            {r.ex.sets.some(s => s.pr) && <Mono bold style={{ fontSize: 11 }} color={c.record}>PR</Mono>}
            <Mono style={{ width: 76, textAlign: 'right' }}>{fmtVolume(METRICS.volume.calc(r.ex.sets) as number)}</Mono>
          </View>
        );
      })}
      {recent.length > 5 && (
        <Pressable onPress={() => setShowAll(v => !v)} accessibilityRole="button" style={{ paddingVertical: 6 }}>
          <Body style={{ fontSize: 14 }} color={c.accent}>{showAll ? 'Show fewer' : `Show all ${recent.length} sessions`}</Body>
        </Pressable>
      )}
    </Card>
  );
}

/** Name, latest best set, change, and a small bar trend of estimated 1RM per session; tap to chart it */
function LiftCard({ lift, onPress }: { lift: LiftSummary; onPress: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const lo = Math.min(...lift.values);
  const hi = Math.max(...lift.values);
  const shown = lift.values.slice(-24);
  const flat = Math.abs(lift.change) < 0.05;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${lift.name}. Chart it`}
      style={({ pressed }) => ({ backgroundColor: pressed ? c.surfaceHigh : c.surface, borderRadius: theme.radius, borderWidth: 1, borderColor: c.line, padding: 16, gap: 6 })}>
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
    </Pressable>
  );
}
