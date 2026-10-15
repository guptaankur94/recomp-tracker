// The chosen theme, remembered on the device.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { THEMES, type Theme, type ThemeId } from './themes';

const THEME_KEY = 'recomp_theme';

const ThemeContext = createContext<{ theme: Theme; setTheme: (id: ThemeId) => void }>({ theme: THEMES.vitruvian, setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<ThemeId>('vitruvian');
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(saved => {
      if (saved && saved in THEMES) setId(saved as ThemeId);
    }).catch(() => {});
  }, []);
  const setTheme = (next: ThemeId) => {
    setId(next);
    AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
  };
  return <ThemeContext.Provider value={{ theme: THEMES[id], setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
