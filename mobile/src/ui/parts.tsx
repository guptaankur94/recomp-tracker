// Small building blocks shared by screens: page header, stat tiles, section labels and badges.
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/theme-context';

import { Body, Eyebrow, Mono, Title } from './text';

export function Header({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Title>{title}</Title>
      {typeof sub === 'string' ? <Mono>{sub}</Mono> : sub}
    </View>
  );
}

export interface TileData {
  value: string;
  /** Drawn smaller after the value */
  unit?: string;
  label: string;
  /** Records are drawn in the theme's record colour */
  record?: boolean;
  tone?: 'good' | 'bad';
}

/** Three tiles share a row; four sit two by two so their numbers have room */
export function Tiles({ tiles }: { tiles: TileData[] }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const grid = tiles.length > 3;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {tiles.map(t => (
        <View key={t.label} accessible accessibilityLabel={`${t.label}: ${t.value}${t.unit ? ` ${t.unit}` : ''}`}
          style={{ flexGrow: 1, flexBasis: grid ? '45%' : 0, backgroundColor: c.surface, borderRadius: theme.radius, borderWidth: 1, borderColor: t.record ? c.record : c.line, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', gap: 2 }}>
          <Mono bold style={{ fontSize: 17 }} color={t.record ? c.record : t.tone === 'good' ? c.accent : t.tone === 'bad' ? c.danger : c.ink} numberOfLines={1}>
            {t.value}{t.unit ? <Mono style={{ fontSize: 11 }} color={c.inkSoft}> {t.unit}</Mono> : null}
          </Mono>
          <Body style={{ fontSize: 11, textAlign: 'center' }} color={c.muted} numberOfLines={2}>{t.label}</Body>
        </View>
      ))}
    </View>
  );
}

export function SectionLabel({ children, right }: { children: string; right?: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10 }}>
      <Eyebrow color={theme.colors.muted}>{children}</Eyebrow>
      {right ? <Mono style={{ fontSize: 11 }} color={theme.colors.muted}>{right}</Mono> : null}
    </View>
  );
}

/** "PR" marker in the record colour */
export function PrBadge({ label = 'PR' }: { label?: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: theme.colors.record }}>
      <Mono bold style={{ fontSize: 10 }} color={theme.colors.record}>{label}</Mono>
    </View>
  );
}
