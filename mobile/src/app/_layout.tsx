import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { FONTS } from '@/theme/fonts';
import { ThemeProvider } from '@/theme/theme-context';
import { AppTabs } from '@/ui/tab-bar';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts(FONTS);
  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);
  // A font that fails to load falls back to the system font rather than blocking the app
  if (!loaded && !error) return null;
  return (
    <ThemeProvider>
      <StatusBar style="light" />
      <AppTabs />
    </ThemeProvider>
  );
}
