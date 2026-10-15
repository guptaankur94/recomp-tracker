// Number, time and date formatting shared by every screen.

export function fmtNum(n: number): string {
  return (Math.round(n * 10) / 10).toLocaleString('en-US');
}

/** Seconds as m:ss */
export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtVolume(kg: number): string {
  return kg >= 10000 ? `${fmtNum(kg / 1000)} t` : `${fmtNum(Math.round(kg))} kg`;
}

export function fmtDuration(sec: number): string {
  const min = Math.max(1, Math.round(sec / 60));
  return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`;
}

/** Local calendar date (YYYY-MM-DD). toISOString() is UTC and would shift early-morning workouts to the previous day. */
export function localDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Session ids are creation times, so the local date comes from them (this also corrects older UTC-dated logs). */
export function sessionDateStr(session: { id: unknown; dateStr: string }): string {
  return typeof session.id === 'number' ? localDateStr(new Date(session.id)) : session.dateStr;
}

/** Local midnight of a YYYY-MM-DD date, in ms */
export function dateStrMs(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
