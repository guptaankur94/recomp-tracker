// The chosen theme, saved with the rest of the app's settings.
import { useData } from '@/data/store';

import { THEMES, type Theme, type ThemeId } from './themes';

export function useTheme(): { theme: Theme; setTheme: (id: ThemeId) => void } {
  const { settings, updateSettings } = useData();
  const id = settings.theme && settings.theme in THEMES ? (settings.theme as ThemeId) : 'vitruvian';
  return { theme: THEMES[id], setTheme: next => { updateSettings({ theme: next }); } };
}
