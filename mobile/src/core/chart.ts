// Chart maths: time ranges and clean axis numbers.

/** One time range for every chart on Progress, as in the web app */
export const RANGES = { '1m': { label: '1M', days: 31 }, '3m': { label: '3M', days: 92 }, '6m': { label: '6M', days: 183 }, all: { label: 'All', days: null } } as const;
export type RangeKey = keyof typeof RANGES;

export function rangeStartMs(range: RangeKey, now: number): number {
  const days = RANGES[range].days;
  return days ? now - days * 864e5 : -Infinity;
}

/** Up to about `count` evenly spaced round numbers (1, 2, 2.5 or 5 × a power of ten) covering min–max */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!isFinite(min) || !isFinite(max)) return [];
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1;
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / Math.max(1, count - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? 10 * mag;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.5 && ticks.length < 12; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  if (ticks[ticks.length - 1] < max) ticks.push(Math.round((ticks[ticks.length - 1] + step) * 1e6) / 1e6);
  return ticks;
}

/** The point closest in time to x (points sorted by x) */
export function nearestIndex(xs: number[], x: number): number {
  let best = 0;
  xs.forEach((v, i) => { if (Math.abs(v - x) < Math.abs(xs[best] - x)) best = i; });
  return best;
}
