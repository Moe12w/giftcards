// src/lib/perf.ts
// Tiny timing marks for cold/warm startup and cache-versus-network navigations.
// The data stays on the device: in development it is logged so we can see where
// the time goes, in production the marks are still available to tooling.
const marks = new Map<string, number>();

/** Records a point in time from process start. */
export function perfMark(name: string): void {
  const at = performance.now();
  marks.set(name, at);
  if (__DEV__) console.debug(`[perf] ${name} @ ${Math.round(at)}ms`);
}

/** Milliseconds between two marks, or null when either is missing. */
export function perfBetween(from: string, to: string): number | null {
  const start = marks.get(from);
  const end = marks.get(to);
  return start === undefined || end === undefined ? null : Math.round(end - start);
}

/** A copy of every mark, for diagnostics. */
export function perfMarks(): Record<string, number> {
  return Object.fromEntries(marks);
}
