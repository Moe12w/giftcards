// src/lib/cache.ts
// A tiny stale-while-revalidate cache for catalog data.
//
// Screens render from memory immediately, the network refreshes in the
// background, and the last good copy is persisted to disk so a cold launch
// shows real content instead of an empty skeleton. Only public catalog data
// and non-sensitive profile display fields belong here — never vouchers, codes
// or payment data.
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Entry<T> {
  value: T;
  at: number;
}

const PREFIX = '@giftly/cache/v1/';
const memory = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
const pendingWrites = new Map<string, Entry<unknown>>();
const pendingRemovals = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let hydration: Promise<void> | null = null;

function flushWrites() {
  flushTimer = null;
  if (pendingWrites.size === 0) return;
  const pairs: [string, string][] = [];
  for (const [key, entry] of pendingWrites) {
    pairs.push([`${PREFIX}${key}`, JSON.stringify(entry)]);
  }
  pendingWrites.clear();
  AsyncStorage.multiSet(pairs).catch(() => {
    // A full disk must never break the screen.
  });
  if (pendingRemovals.size > 0) {
    const keys = [...pendingRemovals].map((key) => `${PREFIX}${key}`);
    pendingRemovals.clear();
    AsyncStorage.multiRemove(keys).catch(() => undefined);
  }
}

function schedulePersist(key: string, entry: Entry<unknown>) {
  pendingWrites.set(key, entry);
  if (flushTimer) return;
  flushTimer = setTimeout(flushWrites, 250);
}

function readEntry<T>(key: string): Entry<T> | undefined {
  return memory.get(key) as Entry<T> | undefined;
}

/** Puts a value in the cache, e.g. after a list screen already has the data. */
export function primeCache<T>(key: string, value: T): void {
  const entry: Entry<T> = { value, at: Date.now() };
  memory.set(key, entry);
  schedulePersist(key, entry);
}

/** Reads whatever is in memory, fresh or stale. */
export function peekCache<T>(key: string): T | undefined {
  return readEntry<T>(key)?.value;
}

/**
 * Drops cached data after a write (profile edit, product change, sign-out).
 * Everything beginning with `prefix` is removed from memory and disk, so the
 * next screen that needs it fetches a fresh copy.
 */
export function invalidateCache(prefix: string): void {
  for (const key of [...memory.keys()]) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
  for (const key of [...pendingWrites.keys()]) {
    if (key.startsWith(prefix)) pendingWrites.delete(key);
  }
  for (const key of [...pendingRemovals]) {
    if (key.startsWith(prefix)) pendingRemovals.delete(key);
  }
  void AsyncStorage.getAllKeys()
    .then((keys) => {
      const stale = keys.filter(
        (key) => key.startsWith(PREFIX) && key.slice(PREFIX.length).startsWith(prefix),
      );
      return stale.length ? AsyncStorage.multiRemove(stale) : undefined;
    })
    .catch(() => undefined);
}

/**
 * Loads the persisted catalog from the previous launch. Called once from the
 * root layout before the splash screen is dismissed.
 */
export function hydrateCache(): Promise<void> {
  if (hydration) return hydration;
  hydration = (async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const ours = keys.filter((key) => key.startsWith(PREFIX));
      if (ours.length > 0) {
        const pairs = await AsyncStorage.multiGet(ours);
        for (const [storageKey, raw] of pairs) {
          if (!raw) continue;
          const key = storageKey.slice(PREFIX.length);
          if (memory.has(key)) continue;
          try {
            const parsed = JSON.parse(raw) as Entry<unknown>;
            if (parsed && typeof parsed.at === 'number') memory.set(key, parsed);
          } catch {
            // Ignore a corrupt entry.
          }
        }
      }
    } catch {
      // Storage is optional; the app still works from the network.
    }
  })();
  return hydration;
}

/**
 * Returns cached data straight away when it is fresh. When it is stale the
 * cached value is returned and a refresh runs in the background, so a repeat
 * visit never waits on the network.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const entry = readEntry<T>(key);
  const fresh = entry ? Date.now() - entry.at < ttlMs : false;

  const refresh = () => {
    const running = inflight.get(key) as Promise<T> | undefined;
    if (running) return running;
    const promise = load()
      .then((value) => {
        primeCache(key, value);
        return value;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  };

  if (entry && fresh) return entry.value;
  if (entry) {
    // Stale-while-revalidate: paint now, refresh quietly.
    void refresh().catch(() => undefined);
    return entry.value;
  }
  return refresh();
}
