// The current time for event handlers and timers (kept out of render code, which must not read the clock).
export function nowMs(): number {
  return Date.now();
}
