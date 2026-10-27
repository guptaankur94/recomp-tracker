// The rest timer on the Lock Screen, in the Dynamic Island and on Apple Watch (Smart Stack): a countdown the
// system keeps ticking by itself, plus what's next. The layout is compiled to text and runs inside the widget,
// where only the SwiftUI components and modifiers exist: it can't use anything else from this file or the app.
import { HStack, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, lineLimit, monospacedDigit, padding, tint } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

export interface RestActivityProps {
  /** When rest started and ends, in ms */
  startAt: number;
  endAt: number;
  /** "Next: Set 2 · 50 kg × 8" */
  next: string;
}

const RestActivity = (props: RestActivityProps) => {
  'widget';
  const INK = '#EDE6D6';
  const MUTED = '#8F8A7D';
  const CYAN = '#5EE7F0';
  const range = { lower: new Date(props.startAt), upper: new Date(props.endAt) };
  const clock = (size: number) => (
    <Text timerInterval={range} countsDown modifiers={[font({ size, weight: 'bold', design: 'monospaced' }), monospacedDigit(), foregroundStyle(CYAN)]} />
  );
  const next = <Text modifiers={[font({ size: 14, design: 'monospaced' }), foregroundStyle(INK), lineLimit(1)]}>{props.next}</Text>;
  return {
    banner: (
      <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 16 })]}>
        <HStack>
          <Text modifiers={[font({ size: 12, weight: 'bold', design: 'monospaced' }), foregroundStyle(MUTED)]}>REST</Text>
          <Spacer />
          {clock(34)}
        </HStack>
        <ProgressView timerInterval={range} countsDown modifiers={[tint(CYAN)]} />
        {next}
      </VStack>
    ),
    // Apple Watch Smart Stack and CarPlay
    bannerSmall: (
      <VStack alignment="leading" spacing={4} modifiers={[padding({ all: 8 })]}>
        <Text modifiers={[font({ size: 11, weight: 'bold', design: 'monospaced' }), foregroundStyle(MUTED)]}>REST</Text>
        {clock(26)}
        <Text modifiers={[font({ size: 12, design: 'monospaced' }), foregroundStyle(INK), lineLimit(1)]}>{props.next.replace(/^Next: /, '')}</Text>
      </VStack>
    ),
    compactLeading: <Text modifiers={[font({ size: 13, weight: 'bold', design: 'monospaced' }), foregroundStyle(MUTED)]}>REST</Text>,
    compactTrailing: clock(15),
    minimal: clock(12),
    expandedLeading: <Text modifiers={[font({ size: 13, weight: 'bold', design: 'monospaced' }), foregroundStyle(MUTED), padding({ leading: 8 })]}>REST</Text>,
    expandedTrailing: clock(28),
    expandedBottom: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ horizontal: 8, bottom: 6 })]}>
        <ProgressView timerInterval={range} countsDown modifiers={[tint(CYAN)]} />
        {next}
      </VStack>
    )
  };
};

export const restActivity = createLiveActivity<RestActivityProps>('RecompRest', RestActivity);
