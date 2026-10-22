// After Finish: the whole day's workout, its records and how it compares with last time.
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { fmtClock, fmtDuration, fmtNum, fmtVolume, shortDate } from '@/core/format';
import { sessionStats, volumeChangePct } from '@/core/history';
import { PR_LABELS } from '@/core/records';
import { bestSet } from '@/core/progress';
import { avgRest, fmtSetLine } from '@/core/workout';
import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';
import { Button } from '@/ui/button';
import { CaloriesField } from '@/ui/calories';
import { Header, SectionLabel, Tiles } from '@/ui/parts';
import { Card, Screen } from '@/ui/screen';
import { Body, Mono } from '@/ui/text';

export default function SummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { history } = useData();
  const { theme } = useTheme();
  const c = theme.colors;
  const session = history.find(s => String(s.id) === id);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  if (!session) {
    return (
      <Screen tabBar={false}>
        <Body color={c.inkSoft}>This workout isn&apos;t in your history any more.</Body>
        <Button label="Done" onPress={close} />
      </Screen>
    );
  }
  const st = sessionStats(session);
  const change = volumeChangePct(session, history);
  const prs = session.exercises.flatMap(e => e.sets.filter(s => s.pr).map(s => ({ name: e.name, set: s })));
  return (
    <Screen tabBar={false}>
      <Animated.View entering={FadeInDown.duration(320)} style={{ gap: 14 }}>
        <Header eyebrow="Workout complete" title={`${session.day} · ${session.title}`}
          sub={new Date(session.id).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} />
        <Tiles tiles={[
          { value: st.durationSec ? String(Math.max(1, Math.round(st.durationSec / 60))) : '—', unit: st.durationSec ? 'min' : undefined, label: 'Duration' },
          { value: String(st.sets), label: st.sets === 1 ? 'Set' : 'Sets' },
          { value: fmtVolume(st.volume), label: 'Volume' },
          { value: String(prs.length), label: prs.length === 1 ? 'Personal record' : 'Personal records', record: prs.length > 0 }
        ]} />
        {change && (
          <Mono color={change.pct > 0 ? c.accent : c.inkSoft}>
            {change.pct === 0 ? `Same volume as your last ${session.day} on ${shortDate(change.previous.id)}` : `${change.pct > 0 ? '+' : ''}${change.pct}% volume vs your last ${session.day} on ${shortDate(change.previous.id)}`}
          </Mono>
        )}
      </Animated.View>
      <CaloriesField key={session.id} session={session} />
      {prs.length > 0 && (
        <>
          <SectionLabel>Personal records</SectionLabel>
          <Card>
            {prs.map((p, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 2 }}>
                <Body bold style={{ flex: 1 }}>{p.name}</Body>
                <Mono color={c.record}>{fmtSetLine(p.set)} · {PR_LABELS[p.set.pr!]}{p.set.pr === 'rest' && p.set.restSec ? ` (${fmtClock(p.set.restSec)})` : ''}</Mono>
              </View>
            ))}
          </Card>
        </>
      )}
      <SectionLabel>Exercises</SectionLabel>
      <Card>
        {session.exercises.map((e, i) => {
          const best = bestSet(e.sets);
          return (
            <View key={i} style={{ paddingVertical: 4, gap: 2, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
              <Body bold>{e.name}</Body>
              <Mono style={{ fontSize: 12 }}>{e.sets.length} × · best {best.weight > 0 ? `${fmtNum(best.weight)} kg × ${best.reps}` : `BW × ${best.reps}`}{avgRest(e.sets) ? ` · rest ${fmtClock(avgRest(e.sets))}` : ''}</Mono>
            </View>
          );
        })}
      </Card>
      {st.durationSec > 0 && <Mono color={c.muted} style={{ textAlign: 'center' }}>Total time {fmtDuration(st.durationSec)}</Mono>}
      <Button label="Done" kind="primary" onPress={close} />
      <Button label="See it in History" onPress={() => { router.dismissAll(); router.push('/history'); }} />
    </Screen>
  );
}
