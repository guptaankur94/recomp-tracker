// Short messages at the bottom of the screen, optionally with one action (Undo). The app never uses system pop-ups.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme-context';

import { Body } from './text';

interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void;
  error?: boolean;
  durationMs?: number;
}

type Toast = ToastOptions & { id: number; message: string };

const Ctx = createContext<(message: string, options?: ToastOptions) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((message: string, options: ToastOptions = {}) => {
    if (timer.current) clearTimeout(timer.current);
    const id = Date.now();
    setToast({ id, message, ...options });
    timer.current = setTimeout(() => setToast(t => (t && t.id === id ? null : t)), options.durationMs ?? (options.actionLabel ? 5000 : 3000));
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && <ToastView key={toast.id} toast={toast} onDone={() => setToast(null)} />}
    </Ctx.Provider>
  );
}

function ToastView({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const c = theme.colors;
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', alignItems: 'center', paddingBottom: Math.max(insets.bottom, 12) + 80 }]}>
      <Animated.View entering={FadeInDown.duration(220)} exiting={FadeOutDown.duration(180)} accessibilityRole="alert" accessibilityLiveRegion="polite"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, maxWidth: '92%', paddingVertical: 12, paddingHorizontal: 16, borderRadius: theme.radius, backgroundColor: c.surfaceHigh, borderWidth: 1, borderColor: toast.error ? c.danger : c.line }}>
        <Body style={{ flexShrink: 1, fontSize: 14 }}>{toast.message}</Body>
        {toast.actionLabel && (
          <Pressable onPress={() => { toast.onAction?.(); onDone(); }} accessibilityRole="button" hitSlop={10}>
            <Body bold style={{ fontSize: 14 }} color={c.accent}>{toast.actionLabel}</Body>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

export function useToast() {
  return useContext(Ctx);
}
