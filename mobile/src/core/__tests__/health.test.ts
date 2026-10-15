/// <reference types="jest" />
import { mergeHealthWeights } from '../health';

const at = (s: string) => new Date(s);

test('one reading per day, the latest, rounded', () => {
  const out = mergeHealthWeights([], [
    { kg: 80.04, at: at('2026-10-01T07:00:00') },
    { kg: 79.66, at: at('2026-10-01T21:00:00') },
    { kg: 79.2, at: at('2026-10-03T07:00:00') }
  ], 'me');
  expect(out).toEqual([{ dateStr: '2026-10-01', kg: 79.7 }, { dateStr: '2026-10-03', kg: 79.2 }]);
});

test("weights typed here win, and this app's own readings are skipped", () => {
  const out = mergeHealthWeights([{ dateStr: '2026-10-01', kg: 81 }], [
    { kg: 80, at: at('2026-10-01T07:00:00') },
    { kg: 79.5, at: at('2026-10-02T07:00:00'), source: 'me' },
    { kg: 79.4, at: at('2026-10-04T07:00:00'), source: 'com.scale' }
  ], 'me');
  expect(out).toEqual([{ dateStr: '2026-10-04', kg: 79.4 }]);
});

test('nonsense readings are ignored', () => {
  expect(mergeHealthWeights([], [{ kg: 0, at: at('2026-10-01T07:00:00') }, { kg: 900, at: at('2026-10-02T07:00:00') }, { kg: 80, at: new Date(NaN) }], 'me')).toEqual([]);
});
