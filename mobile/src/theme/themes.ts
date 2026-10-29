// The app's themes. Layout is shared; each theme sets colours, type and a few motifs.
// Vitruvian Machine is the default; Neon District and Codex are picked in Settings → Appearance.

export type ThemeId = 'vitruvian' | 'neon' | 'codex';

export interface Theme {
  id: ThemeId;
  name: string;
  /** One line under the name in the theme picker */
  tagline: string;
  colors: {
    /** Screen background */
    bg: string;
    /** Cards and sheets */
    surface: string;
    /** Pressed or raised surface */
    surfaceHigh: string;
    /** Main text */
    ink: string;
    /** Secondary text */
    inkSoft: string;
    /** Labels, hints, disabled */
    muted: string;
    /** Hairlines and borders */
    line: string;
    /** The live, interactive colour: the active set, the timer, the selected tab */
    accent: string;
    /** Accent tint for fills behind accent text */
    accentSoft: string;
    /** Text on an accent fill */
    onAccent: string;
    /** Personal records, and goals */
    record: string;
    /** Still to do (and Start): a to-do bar on exercises, outlined ticks */
    todo: string;
    /** Done (and Finish): filled ticks, finished exercises. Always with a ✓ or "Done" too, never colour alone */
    done: string;
    danger: string;
    /** The tab bar's frosted fill */
    bar: string;
  };
  fonts: {
    /** Screen titles and exercise names */
    display: string;
    /** Body text */
    body: string;
    bodyBold: string;
    /** Weights, reps, timers and small caps labels */
    mono: string;
    monoBold: string;
  };
  /** Display titles in capitals (Neon) */
  displayUpper: boolean;
  /** Corner radius of cards */
  radius: number;
  /** Faint blueprint grid behind screens (Vitruvian) */
  grid: string | null;
}

export const THEMES: Record<ThemeId, Theme> = {
  vitruvian: {
    id: 'vitruvian',
    name: 'Vitruvian Machine',
    tagline: 'Default · ink + HUD',
    colors: {
      bg: '#0B0C0E', surface: '#111316', surfaceHigh: '#171A1E', ink: '#EDE6D6', inkSoft: '#B9B3A5', muted: '#8A8578',
      line: 'rgba(237,230,214,0.12)', accent: '#5EE7F0', accentSoft: 'rgba(94,231,240,0.12)', onAccent: '#0B0C0E',
      record: '#D9B45A', todo: '#5EE7F0', done: '#7DD68E', danger: '#E5484D', bar: 'rgba(17,19,22,0.97)'
    },
    fonts: {
      display: 'CormorantGaramond_600SemiBold', body: 'SpaceGrotesk_400Regular', bodyBold: 'SpaceGrotesk_700Bold',
      mono: 'JetBrainsMono_400Regular', monoBold: 'JetBrainsMono_700Bold'
    },
    displayUpper: false,
    radius: 12,
    grid: 'rgba(94,231,240,0.035)'
  },
  neon: {
    id: 'neon',
    name: 'Neon District',
    tagline: 'Cyberpunk',
    colors: {
      bg: '#07060D', surface: '#100E1A', surfaceHigh: '#181528', ink: '#F2F0FF', inkSoft: '#BDB8D6', muted: '#8C87A8',
      line: 'rgba(242,240,255,0.12)', accent: '#19F0FF', accentSoft: 'rgba(25,240,255,0.12)', onAccent: '#07060D',
      record: '#FF2E88', todo: '#19F0FF', done: '#B4FF4A', danger: '#FF5470', bar: 'rgba(16,14,26,0.97)'
    },
    fonts: {
      display: 'ChakraPetch_700Bold', body: 'ChakraPetch_400Regular', bodyBold: 'ChakraPetch_700Bold',
      mono: 'IBMPlexMono_400Regular', monoBold: 'IBMPlexMono_700Bold'
    },
    displayUpper: true,
    radius: 4,
    grid: null
  },
  codex: {
    id: 'codex',
    name: 'Codex',
    tagline: 'Renaissance notebook',
    colors: {
      bg: '#1A140D', surface: '#221A11', surfaceHigh: '#2B2116', ink: '#EAD9B4', inkSoft: '#D8C69E', muted: '#A8987A',
      line: 'rgba(234,217,180,0.18)', accent: '#C2593A', accentSoft: 'rgba(194,89,58,0.16)', onAccent: '#1A140D',
      record: '#C9A24A', todo: '#DB7552', done: '#A3C46C', danger: '#D9534F', bar: 'rgba(34,26,17,0.97)'
    },
    fonts: {
      display: 'Cinzel_600SemiBold', body: 'EBGaramond_400Regular', bodyBold: 'EBGaramond_600SemiBold',
      mono: 'EBGaramond_500Medium', monoBold: 'Cinzel_700Bold'
    },
    displayUpper: false,
    radius: 6,
    grid: null
  }
};

export const THEME_ORDER: ThemeId[] = ['vitruvian', 'neon', 'codex'];

/** Themes planned after launch, shown in the picker as coming soon */
export const COMING_THEMES = [
  { name: 'Spartan HUD', tagline: 'Military sci-fi' },
  { name: 'Alchemist', tagline: 'Dark fantasy · steel, amber' },
  { name: 'Cubist', tagline: 'Bold shapes, primaries' }
];
