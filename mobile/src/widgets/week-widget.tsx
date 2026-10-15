// The home-screen widget (iPhone): this week's workouts as a ring, the next workout, the streak and when you last
// trained, in Vitruvian Machine colours. The layout is compiled to text and runs inside the widget, where only
// the SwiftUI components and modifiers exist: it can't use anything else from this file or the app.
import { Gauge, HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, gaugeStyle, lineLimit, padding, tint, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WidgetSnapshot } from '@/core/widget';

const WeekWidget = (props: WidgetSnapshot, env: WidgetEnvironment) => {
  'widget';
  const INK = '#EDE6D6';
  const MUTED = '#8F8A7D';
  const CYAN = '#5EE7F0';
  const BG = '#0B0C0E';
  const ring = (
    <Gauge value={Math.min(props.done, Math.max(1, props.target))} min={0} max={Math.max(1, props.target)}
      currentValueLabel={<Text modifiers={[font({ size: 13, weight: 'bold', design: 'monospaced' })]}>{`${props.done}/${props.target}`}</Text>}
      modifiers={[gaugeStyle('circularCapacity'), tint(CYAN)]} />
  );
  if (env.widgetFamily === 'accessoryCircular') {
    return <VStack modifiers={[widgetURL('recomp:///')]}>{ring}</VStack>;
  }
  const next = (
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={[font({ size: 11, weight: 'medium', design: 'monospaced' }), foregroundStyle(CYAN)]}>{props.nextWhen.toUpperCase()}</Text>
      <Text modifiers={[font({ size: 17, weight: 'semibold', design: 'serif' }), foregroundStyle(INK), lineLimit(2)]}>{props.nextTitle}</Text>
    </VStack>
  );
  const background = [containerBackground(BG, 'widget'), widgetURL('recomp:///')];
  if (env.widgetFamily === 'systemSmall') {
    return (
      <VStack alignment="leading" spacing={8} modifiers={background}>
        {ring}
        <Spacer />
        {next}
      </VStack>
    );
  }
  return (
    <HStack spacing={16} modifiers={[...background, padding({ all: 4 })]}>
      <VStack spacing={6}>
        {ring}
        <Text modifiers={[font({ size: 10, design: 'monospaced' }), foregroundStyle(MUTED)]}>THIS WEEK</Text>
      </VStack>
      <VStack alignment="leading" spacing={8}>
        {next}
        <Text modifiers={[font({ size: 12, design: 'monospaced' }), foregroundStyle(MUTED)]}>
          {`${props.streak} wk streak${props.lastWorkout ? ` · last ${props.lastWorkout.toLowerCase()}` : ''}`}
        </Text>
      </VStack>
      <Spacer />
    </HStack>
  );
};

export const weekWidget = createWidget<WidgetSnapshot>('RecompWeek', WeekWidget);
