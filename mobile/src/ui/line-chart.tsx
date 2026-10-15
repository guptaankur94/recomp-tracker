// A time-series line chart: one 2px line with a faint wash under it, optional raw points behind it (weigh-ins),
// a target line (goal weight) and record markers. Touch and drag (or hover) to read any point.
import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { nearestIndex, niceTicks } from '@/core/chart';
import { shortDate } from '@/core/format';
import { useTheme } from '@/theme/theme-context';

import { Body, Mono } from './text';

export interface ChartPoint {
  x: number;
  y: number;
  /** A record session, or the all-time best: drawn larger in the record colour */
  record?: boolean;
  best?: boolean;
  /** Extra line for the readout (e.g. "weighed 81.2") */
  note?: string;
}

interface Props {
  points: ChartPoint[];
  /** Raw values drawn as small muted dots (e.g. each weigh-in under the 7-day average) */
  raw?: { x: number; y: number }[];
  target?: number | null;
  targetLabel?: string;
  fmt: (v: number) => string;
  /** Spoken summary of the chart */
  label: string;
  emptyText: string;
  height?: number;
}

const PAD = { top: 14, right: 12, bottom: 24, left: 40 };

export function LineChart({ points, raw = [], target, targetLabel, fmt, label, emptyText, height = 190 }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  // Leaving the chart in the browser clears the readout; touch keeps the last point read
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // Always measured, empty or not, so the chart has its width the moment data arrives
  if (!points.length) {
    return (
      <View onLayout={onLayout} style={{ height: 120, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
        <Body color={c.inkSoft} style={{ textAlign: 'center', fontSize: 14 }}>{emptyText}</Body>
      </View>
    );
  }

  const ys = [...points.map(p => p.y), ...raw.map(p => p.y), ...(target ? [target] : [])];
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys), 4);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const xs = points.map(p => p.x);
  const xMin = Math.min(...xs, ...raw.map(p => p.x));
  const xMax = Math.max(...xs, ...raw.map(p => p.x));
  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const sx = (x: number) => PAD.left + (xMax === xMin ? plotW / 2 : ((x - xMin) / (xMax - xMin)) * plotW);
  const sy = (y: number) => PAD.top + (yMax === yMin ? plotH / 2 : (1 - (y - yMin) / (yMax - yMin)) * plotH);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');
  const area = points.length > 1 ? `${line}L${sx(points[points.length - 1].x).toFixed(1)},${PAD.top + plotH}L${sx(points[0].x).toFixed(1)},${PAD.top + plotH}Z` : '';
  const xLabels = points.length > 1 ? [xMin, (xMin + xMax) / 2, xMax] : [points[0].x];

  // The crosshair snaps to the nearest point in time
  const track = (x: number) => {
    const t = xMin + ((x - PAD.left) / plotW) * (xMax - xMin);
    setActive(nearestIndex(xs, t));
  };
  const a = active !== null ? points[active] : null;

  return (
    <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={label} testID="chart">
      <View style={{ height: 34, justifyContent: 'center' }}>
        {a ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'baseline' }}>
            <Mono bold color={c.ink} style={{ fontSize: 15 }}>{fmt(a.y)}</Mono>
            <Mono style={{ fontSize: 12 }}>{shortDate(a.x)}{a.note ? ` · ${a.note}` : ''}</Mono>
            {(a.best || a.record) && <Mono bold style={{ fontSize: 12 }} color={c.record}>{a.best ? 'Best' : 'Record'}</Mono>}
          </View>
        ) : (
          <Mono style={{ fontSize: 12 }} color={c.muted}>Touch the chart to read a point</Mono>
        )}
      </View>
      {width > 0 && (
        <View onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderGrant={e => track(e.nativeEvent.locationX)}
          onResponderMove={e => track(e.nativeEvent.locationX)} onPointerMove={e => track(e.nativeEvent.offsetX)} onPointerLeave={() => setActive(null)}>
          <Svg width={width} height={height} pointerEvents="none">
            {ticks.map(t => (
              <Line key={`g${t}`} x1={PAD.left} x2={width - PAD.right} y1={sy(t)} y2={sy(t)} stroke={c.line} strokeWidth={1} />
            ))}
            {ticks.map(t => (
              <SvgText key={`t${t}`} x={PAD.left - 6} y={sy(t) + 4} fontSize={10} fill={c.muted} textAnchor="end" fontFamily={theme.fonts.mono}>{fmt(t).replace(/ kg$/, '')}</SvgText>
            ))}
            {xLabels.map((x, i) => (
              <SvgText key={`x${i}`} x={sx(x)} y={height - 6} fontSize={10} fill={c.muted} fontFamily={theme.fonts.mono}
                textAnchor={xLabels.length === 1 ? 'middle' : i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}>{shortDate(x)}</SvgText>
            ))}
            {target ? (
              <>
                <Line x1={PAD.left} x2={width - PAD.right} y1={sy(target)} y2={sy(target)} stroke={c.inkSoft} strokeWidth={1} opacity={0.7} />
                {targetLabel && <SvgText x={width - PAD.right} y={sy(target) - 5} fontSize={10} fill={c.inkSoft} textAnchor="end" fontFamily={theme.fonts.mono}>{targetLabel}</SvgText>}
              </>
            ) : null}
            {raw.map((p, i) => <Circle key={`r${i}`} cx={sx(p.x)} cy={sy(p.y)} r={2.5} fill={c.muted} opacity={0.6} />)}
            {area ? <Path d={area} fill={c.accent} opacity={0.1} /> : null}
            <Path d={line} stroke={c.accent} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => (p.record || p.best) && (
              <Circle key={`p${i}`} cx={sx(p.x)} cy={sy(p.y)} r={5} fill={c.record} stroke={c.surface} strokeWidth={2} />
            ))}
            {!points.some(p => p.record || p.best) || points.length === 1 ? (
              <Circle cx={sx(points[points.length - 1].x)} cy={sy(points[points.length - 1].y)} r={4} fill={c.accent} stroke={c.surface} strokeWidth={2} />
            ) : null}
            {a && (
              <>
                <Line x1={sx(a.x)} x2={sx(a.x)} y1={PAD.top} y2={PAD.top + plotH} stroke={c.inkSoft} strokeWidth={1} />
                <Circle cx={sx(a.x)} cy={sy(a.y)} r={5} fill={a.best || a.record ? c.record : c.accent} stroke={c.surface} strokeWidth={2} />
              </>
            )}
          </Svg>
        </View>
      )}
    </View>
  );
}
