// Hands the latest snapshot to the home-screen widget (iPhone builds).
import type { WidgetSnapshot } from '@/core/widget';

import { weekWidget } from './week-widget';

export function updateWidget(snapshot: WidgetSnapshot) {
  try {
    weekWidget.updateSnapshot(snapshot);
  } catch {
    // The widget is a nicety: the app works without it
  }
}
