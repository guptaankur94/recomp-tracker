// One saved workout: totals, the change from last time, and every set.
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';

import { fmtClock, fmtDuration, fmtNum, fmtVolume, shortDate } from '@/core/format';
import { sessionStats, volumeChangePct } from '@/core/history';
import { PR_LABELS } from '@/core/records';
import { avgRest, setVolume } from '@/core/workout';
import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';
import { Button } from '@/ui/button';
import { CaloriesField } from '@/ui/calories';
import { EffortPicker } from '@/ui/effort-picker';
import { Header, PrBadge, Tiles } from '@/ui/parts';
import { Card, Screen } from '@/ui/screen';
import { Body, Mono } from '@/ui/text';
import { useToast } from '@/ui/toast';

const kg = (w: number) => (Number(w) > 0 ? `${fmtNum(Number(w))} kg` : 'BW');

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { history, removeSession, restoreSession, setEffort } = useData();
  const { theme } = useTheme();
  const toast = useToast();
  const c = theme.colors;
  const session = history.find(s => String(s.id) === id);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/history'));

  if (!session) {
    return (
      <Screen tabBar={false}>
        <BackButton onPress={back} />
        <Body color={c.inkSoft}>This workout isn&apos;t in your history any more.</Body>
      </Screen>
    );
  }
  const st = sessionStats(session);
  const change = volumeChangePct(session, history);
  const when = new Date(session.id);
  const remove = async () => {
    await removeSession(session.id);
    back();
    toast('Workout deleted', { actionLabel: 'Undo', onAction: () => { restoreSession(session); } });
  };
  return (
    <Screen tabBar={false}>
      <BackButton onPress={back} />
      <Header eyebrow={session.day} title={session.title}
        sub={`${when.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · ${when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`} />
      <Tiles tiles={[
        { value: st.durationSec ? fmtDuration(st.durationSec) : '—', label: 'Duration' },
        { value: String(st.sets), label: 'Sets' },
        { value: fmtVolume(st.volume), label: 'Volume' },
        { value: String(st.prs), label: st.prs === 1 ? 'Record' : 'Records', record: st.prs > 0 }
      ]} />
      {change && (
        <Mono color={change.pct > 0 ? c.accent : c.inkSoft}>
          {change.pct === 0 ? 'Same volume as' : `${change.pct > 0 ? '+' : ''}${change.pct}% volume vs`} the previous {session.day} on {shortDate(change.previous.id)}
        </Mono>
      )}
      <Card>
        <EffortPicker label="EFFORT" value={session.effort ?? null} onChange={v => setEffort(session.id, v)} />
      </Card>
      <CaloriesField key={session.id} session={session} />
      {session.exercises.map((ex, i) => (
        <Card key={`${ex.name}-${i}`}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <Body bold style={{ flex: 1 }}>{ex.name}</Body>
            <Mono style={{ fontSize: 12 }}>{fmtVolume(ex.sets.reduce((v, s) => v + setVolume(s), 0))}{avgRest(ex.sets) ? ` · rest ${fmtClock(avgRest(ex.sets))}` : ''}</Mono>
          </View>
          {ex.sets.map((s, j) => (
            <View key={j}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 26 }}>
                <Mono style={{ width: 18 }} color={c.muted}>{j + 1}</Mono>
                <Mono color={c.ink} style={{ flex: 1, fontSize: 14 }}>{kg(s.weight)} × {Number(s.reps) || 0}</Mono>
                {s.pr && <PrBadge label={PR_LABELS[s.pr] ? `PR · ${PR_LABELS[s.pr]}` : 'PR'} />}
                <Mono style={{ fontSize: 12, minWidth: 36, textAlign: 'right' }} color={c.muted}>{s.restSec ? fmtClock(s.restSec) : ''}</Mono>
              </View>
              {(s.drops || []).map((d, k) => (
                <Mono key={k} style={{ marginLeft: 28, fontSize: 12 }}>↳ Drop {k + 1}: {kg(d.weight)} × {Number(d.reps) || 0}</Mono>
              ))}
            </View>
          ))}
        </Card>
      ))}
      <Button label="Delete workout" kind="danger" onPress={remove} style={{ marginTop: 8 }} />
    </Screen>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
      <Body color={theme.colors.accent}>‹ History</Body>
    </Pressable>
  );
}
