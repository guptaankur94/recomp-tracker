// Keeps the rest timer's Live Activity in step with the in-app timer (iPhone builds): started when rest starts,
// moved when it's changed (+15 s), ended when it's skipped, finished or cleared.
import type { RestTimer } from '@/data/repo';

import { restActivity } from './rest-activity';

type Activity = ReturnType<typeof restActivity.start>;
let current: Activity | null = null;

export async function syncRestActivity(timer: RestTimer | null): Promise<void> {
  try {
    if (!timer || timer.endAt <= Date.now()) {
      const ending = current ?? restActivity.getInstances()[0] ?? null;
      current = null;
      if (ending) await ending.end('immediate');
      return;
    }
    const props = { startAt: timer.endAt - timer.total * 1000, endAt: timer.endAt, next: timer.next };
    // Left from before the app was closed: take it over rather than start a second one
    current ??= restActivity.getInstances()[0] ?? null;
    if (current) await current.update(props, new Date(timer.endAt));
    else current = restActivity.start(props, 'recomp:///', new Date(timer.endAt));
  } catch {
    // Live Activities can be turned off in Settings; the in-app timer and the alert still work
    current = null;
  }
}
