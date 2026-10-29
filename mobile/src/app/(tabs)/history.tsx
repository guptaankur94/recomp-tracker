// History: a month calendar and every saved workout, grouped by week.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { fmtDuration, fmtNum, fmtVolume, localDateStr, sessionDateStr, shortDate } from '@/core/format';
import { effortLabel } from '@/core/effort';
import { calcWeekStreak, dayColor, groupByWeek, sessionStats, totalCalories } from '@/core/history';
import type { Session } from '@/core/types';
import { sessionDayLabels } from '@/core/workout';
import { useData } from '@/data/store';
import { useTheme } from '@/theme/theme-context';
import { Header, PrBadge, SectionLabel, Tiles } from '@/ui/parts';
import { Card, Screen } from '@/ui/screen';
import { Body, Mono } from '@/ui/text';

const openSession = (s: Session) => router.push({ pathname: '/session/[id]', params: { id: String(s.id) } });

export default function HistoryScreen() {
  const { history } = useData();
  const { theme } = useTheme();
  const c = theme.colors;
  const now = new Date();
  const groups = groupByWeek(history, now, shortDate);
  const thisMonth = localDateStr(now).slice(0, 8);
  return (
    <Screen>
      <Header eyebrow="History" title="Your workouts" />
      <Tiles tiles={[
        { value: String(history.length), label: history.length === 1 ? 'Workout' : 'Workouts' },
        { value: String(history.filter(s => sessionDateStr(s).startsWith(thisMonth)).length), label: 'This month' },
        { value: `${calcWeekStreak(history, now)} wk`, label: 'Week streak' }
      ]} />
      <Calendar history={history} />
      {!history.length && (
        <Card>
          <Body bold>Your workouts will appear here</Body>
          <Body color={c.inkSoft}>When you finish a workout it lands on the calendar with its sets, volume, duration and personal records. Coming from the web app? Import your backup in Settings.</Body>
        </Card>
      )}
      {groups.map(g => (
        <View key={g.key} style={{ gap: 8 }}>
          <SectionLabel right={`${g.sessions.length} workout${g.sessions.length === 1 ? '' : 's'} · ${fmtVolume(g.volume)}${totalCalories(g.sessions) ? ` · ${fmtNum(totalCalories(g.sessions))} kcal` : ''}`}>{g.label}</SectionLabel>
          {g.sessions.map(s => <SessionRow key={s.id} session={s} />)}
        </View>
      ))}
    </Screen>
  );
}

function SessionRow({ session }: { session: Session }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const st = sessionStats(session);
  const meta = [
    new Date(session.id).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    st.durationSec ? fmtDuration(st.durationSec) : '',
    `${st.sets} set${st.sets === 1 ? '' : 's'}`,
    st.volume ? fmtVolume(st.volume) : '',
    session.calories ? `${fmtNum(session.calories)} kcal` : '',
    effortLabel(session.effort)
  ].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={() => openSession(session)} accessibilityRole="button" accessibilityLabel={`${session.day} ${session.title}, ${meta}${st.prs ? `, ${st.prs} records` : ''}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: theme.radius, borderWidth: 1, borderColor: c.line, backgroundColor: pressed ? c.surfaceHigh : c.surface })}>
      <View style={{ gap: 3 }}>
        {sessionDayLabels(session).slice(0, 3).map(d => <View key={d} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dayColor(d) ?? c.muted }} />)}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Body bold numberOfLines={1}>{session.day} · {session.title}</Body>
        <Mono style={{ fontSize: 12 }} numberOfLines={2}>{meta}</Mono>
      </View>
      {st.prs > 0 && <PrBadge label={`${st.prs} PR`} />}
      <Body color={c.muted}>›</Body>
    </Pressable>
  );
}

/** Monday-first month grid; days with a workout are marked and open it */
function Calendar({ history }: { history: Session[] }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [offset, setOffset] = useState(0);
  const now = new Date();
  const shown = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year = shown.getFullYear();
  const month = shown.getMonth();
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
  const byDate: Record<string, Session[]> = {};
  history.forEach(s => { (byDate[sessionDateStr(s)] = byDate[sessionDateStr(s)] || []).push(s); });
  const today = localDateStr(now);
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const arrow = (label: string, delta: number, a11y: string) => (
    <Pressable onPress={() => setOffset(o => o + delta)} accessibilityRole="button" accessibilityLabel={a11y} hitSlop={8}
      style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.surfaceHigh : 'transparent' })}>
      <Body style={{ fontSize: 20 }} color={c.inkSoft}>{label}</Body>
    </Pressable>
  );
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {arrow('‹', -1, 'Previous month')}
        <Body bold>{shown.toLocaleString('en-US', { month: 'long' })} {year}</Body>
        {arrow('›', 1, 'Next month')}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <View key={`h${i}`} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 }}><Mono style={{ fontSize: 11 }} color={c.muted}>{d}</Mono></View>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, height: 42 }} />;
          const dateStr = `${prefix}${String(d).padStart(2, '0')}`;
          const sessions = byDate[dateStr];
          const isToday = dateStr === today;
          return (
            <Pressable key={dateStr} disabled={!sessions} onPress={() => sessions && openSession(sessions[sessions.length - 1])}
              accessibilityRole={sessions ? 'button' : undefined} accessibilityLabel={sessions ? `${d}: ${sessions.map(s => `${s.day} ${s.title}`).join(', ')}` : undefined}
              style={{ width: `${100 / 7}%`, height: 42, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: sessions ? c.accentSoft : 'transparent', borderWidth: isToday ? 1 : 0, borderColor: c.accent }}>
                <Mono style={{ fontSize: 13 }} color={sessions ? c.ink : c.inkSoft} bold={!!sessions}>{d}</Mono>
              </View>
              {sessions && (
                <View style={{ position: 'absolute', bottom: 2, flexDirection: 'row', gap: 2 }}>
                  {sessions.flatMap(sessionDayLabels).slice(0, 3).map((l, j) => <View key={j} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: dayColor(l) ?? c.accent }} />)}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}
