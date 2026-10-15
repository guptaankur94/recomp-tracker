// Settings: Appearance (theme picker) and app version.
import Constants from 'expo-constants';
import { Pressable, View } from 'react-native';

import { THEME_ORDER, THEMES, COMING_THEMES, type Theme } from '@/theme/themes';
import { useTheme } from '@/theme/theme-context';
import { Body, Eyebrow, Mono, Title } from '@/ui/text';
import { Screen } from '@/ui/screen';

/** A small sample of the theme: an exercise name, a set and a rest time in its own type and colours */
function Swatch({ t }: { t: Theme }) {
  return (
    <View style={{ height: 88, backgroundColor: t.colors.bg, padding: 10, justifyContent: 'space-between' }}>
      <Title size={20} color={t.colors.ink} style={{ fontFamily: t.fonts.display, textTransform: t.displayUpper ? 'uppercase' : 'none' }}>Bench</Title>
      <Mono style={{ fontFamily: t.fonts.mono }} color={t.colors.accent}>50 × 8 <Mono style={{ fontFamily: t.fonts.mono }} color={t.colors.record}>2:45</Mono></Mono>
    </View>
  );
}

export default function SettingsScreen() {
  const { theme, setTheme } = useTheme();
  const c = theme.colors;
  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <Eyebrow>Settings</Eyebrow>
        <Title>Appearance</Title>
        <Body color={c.inkSoft}>Pick a theme. Layout stays the same; colours, type, motion and sound change.</Body>
      </View>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {THEME_ORDER.map(id => {
          const t = THEMES[id];
          const on = theme.id === id;
          return (
            <Pressable key={id} onPress={() => setTheme(id)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${t.name} theme`}
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
      <Mono color={c.muted} style={{ textAlign: 'center', marginTop: 12 }}>Recomp {Constants.expoConfig?.version ?? ''}</Mono>
    </Screen>
  );
}
