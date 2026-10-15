import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { DataProvider } from '@/data/store';
import { FONTS } from '@/theme/fonts';
import { useTheme } from '@/theme/theme-context';
import { ToastProvider } from '@/ui/toast';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONTS);
  // A font that fails to load falls back to the system font rather than blocking the app
  if (!fontsLoaded && !fontError) return null;
  return (
    <DataProvider fallback={error => <Loading error={error} />}>
      <ToastProvider>
        <Screens />
      </ToastProvider>
    </DataProvider>
  );
}

function Screens() {
  const { theme } = useTheme();
  useEffect(() => { SplashScreen.hideAsync(); }, []);
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="session/[id]" />
        <Stack.Screen name="add-exercise" options={{ presentation: 'modal' }} />
        <Stack.Screen name="summary/[id]" options={{ presentation: 'modal', gestureEnabled: false }} />
        <Stack.Screen name="plan-editor" options={{ presentation: 'modal', gestureEnabled: false }} />
        <Stack.Screen name="ai-plan" options={{ presentation: 'modal' }} />
        <Stack.Screen name="plan-preview" options={{ presentation: 'modal' }} />
        <Stack.Screen name="templates" />
        <Stack.Screen name="setup" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}

/** Shown while the database opens (normally hidden by the splash screen), or if it can't */
function Loading({ error }: { error: Error | null }) {
  useEffect(() => { if (error) SplashScreen.hideAsync(); }, [error]);
  if (!error) return null;
  return (
    <View style={{ flex: 1, backgroundColor: '#0B0C0E', justifyContent: 'center', padding: 24 }}>
      <Text style={{ color: '#EDE6D6', fontSize: 17, marginBottom: 8 }}>Couldn&apos;t open your data</Text>
      <Text style={{ color: '#8A8578', fontSize: 14 }}>{error.message}</Text>
    </View>
  );
}
