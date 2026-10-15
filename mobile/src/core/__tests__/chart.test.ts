/// <reference types="jest" />
import { nearestIndex, niceTicks, rangeStartMs } from '../chart';

test('axis numbers are round and cover the data', () => {
  const cases: [number, number][] = [[78.2, 84.9], [0, 137], [40, 40], [1200, 18750], [0.3, 0.9], [62.5, 65]];
  cases.forEach(([lo, hi]) => {
    const t = niceTicks(lo, hi);
    expect(t[0]).toBeLessThanOrEqual(lo);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(hi);
    expect(t.length).toBeGreaterThanOrEqual(2);
    expect(t.length).toBeLessThanOrEqual(7);
    const step = t[1] - t[0];
    t.forEach((v, i) => i && expect(v - t[i - 1]).toBeCloseTo(step));
    expect([1, 2, 2.5, 5].some(m => Math.abs(step / 10 ** Math.floor(Math.log10(step)) - m) < 1e-9)).toBe(true);
  });
  expect(niceTicks(78.2, 84.9)).toEqual([77.5, 80, 82.5, 85]);
  expect(niceTicks(NaN, 3)).toEqual([]);
});

test('ranges and nearest point', () => {
  expect(rangeStartMs('all', 1e12)).toBe(-Infinity);
  expect(rangeStartMs('1m', 31 * 864e5 + 5)).toBe(5);
  expect(nearestIndex([0, 10, 20, 30], 14)).toBe(1);
  expect(nearestIndex([0, 10, 20, 30], 26)).toBe(3);
});
