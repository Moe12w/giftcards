// src/lib/navigation.ts
// Guards against accidental double taps pushing the same screen twice.
import { router } from 'expo-router';

const DOUBLE_TAP_MS = 700;

let lastHref: string | null = null;
let lastPushedAt = 0;

/**
 * Push a route once. A second tap on the same route within `windowMs` is
 * ignored, so a quick double tap can't stack two identical screens.
 */
export function pushOnce(href: string, windowMs = DOUBLE_TAP_MS): void {
  const now = Date.now();
  if (href === lastHref && now - lastPushedAt < windowMs) return;
  lastHref = href;
  lastPushedAt = now;
  router.push(href as never);
}
