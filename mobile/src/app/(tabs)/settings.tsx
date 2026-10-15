// Settings: your data (import from the web app, back up), appearance, and the app version.
import Constants from 'expo-constants';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { restoreMessage } from '@/core/backup';
import { localDateStr } from '@/core/format';
import { pickTextFile, shareTextFile } from '@/data/files';
import { useData } from '@/data/store';
import { COMING_THEMES, THEME_ORDER, THEMES, type Theme } from '@/theme/themes';
import { useTheme } from '@/theme/theme-context';
import { Button } from '@/ui/button';
import { Header, SectionLabel } from '@/ui/parts';
import { Card, Screen } from '@/ui/screen';
import { Body, Mono, Title } from '@/ui/text';
import { useToast } from '@/ui/toast';

export default function SettingsScreen() {
  const { theme } = useTheme();
  return (
    <Screen>
      <Header eyebrow="Settings" title="Settings" />
      <YourData />
      <SectionLabel>Appearance</SectionLabel>
      <Body color={theme.colors.inkSoft}>Pick a theme. Layout stays the same; colours, type, motion and sound change.</Body>
      <ThemePicker />
      <Mono color={theme.colors.muted} style={{ textAlign: 'center', marginTop: 12 }}>Recomp {Constants.expoConfig?.version ?? ''}</Mono>
    </Screen>
  );
}

function YourData() {
  const { history, bodyweight, restore, backupJson } = useData();
  const { theme } = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const c = theme.colors;
  const importBackup = async () => {
    setBusy(true);
    try {
      const text = await pickTextFile();
      if (text !== null) toast(restoreMessage(await restore(text)), { durationMs: 6000 });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't read that file.", { error: true, durationMs: 6000 });
    } finally {
      setBusy(false);
    }
  };
  const exportBackup = async () => {
    try {
      await shareTextFile(`recomp-backup-${localDateStr(new Date())}.json`, backupJson());
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't make the backup.", { error: true });
    }
  };
  return (
    <>
      <SectionLabel>Your data</SectionLabel>
      <Card>
        <Body bold>{history.length} workout{history.length === 1 ? '' : 's'} · {bodyweight.length} weigh-in{bodyweight.length === 1 ? '' : 's'}</Body>
        <Body color={c.inkSoft} style={{ fontSize: 14 }}>
          Stored on this phone. Coming from the web app? In its Settings tap Export Backup, then import that file here. Workouts already here are kept, so importing twice is safe.
        </Body>
        <View style={{ gap: 8, marginTop: 6 }}>
          <Button label={busy ? 'Importing…' : 'Import backup'} kind="primary" onPress={importBackup} disabled={busy} />
          <Button label="Export backup" onPress={exportBackup} disabled={!history.length && !bodyweight.length} />
        </View>
      </Card>
    </>
  );
}

/** A small sample of the theme: an exercise name, a set and a rest time in its own type and colours */
function Swatch({ t }: { t: Theme }) {
  return (
    <View style={{ height: 88, backgroundColor: t.colors.bg, padding: 10, justifyContent: 'space-between' }}>
      <Title size={20} color={t.colors.ink} style={{ fontFamily: t.fonts.display, textTransform: t.displayUpper ? 'uppercase' : 'none' }}>Bench</Title>
      <Mono style={{ fontFamily: t.fonts.mono }} color={t.colors.accent}>50 × 8 <Mono style={{ fontFamily: t.fonts.mono }} color={t.colors.record}>2:45</Mono></Mono>
    </View>
  );
}

function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const c = theme.colors;
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {THEME_ORDER.map(id => {
        const t = THEMES[id];
        const on = theme.id === id;
        return (
          <Pressable key={id} onPress={() => setTheme(id)} accessibilityRole="radio" aria-checked={on} accessibilityLabel={`${t.name} theme`}
            style={({ pressed }) => ({ width: '47%', flexGrow: 1, borderRadius: 10, overflow: 'hidden', borderWidth: on ? 2 : 1, borderColor: on ? c.accent : c.line, backgroundColor: c.surface, opacity: pressed ? 0.8 : 1 })}>
            <Swatch t={t} />
            <View style={{ padding: 10 }}>
              <Body bold style={{ fontSize: 14 }}>{t.name}</Body>
              <Body style={{ fontSize: 12 }} color={c.muted}>{t.tagline}</Body>
            </View>
          </Pressable>
        );
      })}
      {COMING_THEMES.map(t => (
        <View key={t.name} accessibilityLabel={`${t.name} theme, coming soon`}
          style={{ width: '47%', flexGrow: 1, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: c.line, padding: 10, minHeight: 130, justifyContent: 'flex-end', opacity: 0.7 }}>
          <Mono style={{ fontSize: 10, letterSpacing: 1.4 }} color={c.muted}>COMING SOON</Mono>
          <Body bold style={{ fontSize: 14 }}>{t.name}</Body>
          <Body style={{ fontSize: 12 }} color={c.muted}>{t.tagline}</Body>
        </View>
      ))}
    </View>
  );
}
