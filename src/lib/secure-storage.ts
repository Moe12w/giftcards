// src/lib/secure-storage.ts
// Storage adapter for the Supabase session.
//
// The session contains a refresh token, so it belongs in the Keychain (iOS) or
// the Keystore-backed encrypted preferences (Android), not in AsyncStorage
// where a rooted device or a backup can read it.
//
// `expo-secure-store` is not available on web and the native stores reject very
// large values (historically ~2 KB on iOS), while a Supabase session with an
// access token, refresh token and user object is routinely larger. So values
// are split into chunks with a small counter entry, and the web build keeps
// using AsyncStorage, which is its equivalent (browser storage the web app
// already relies on).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Comfortably under the documented ~2 KB native limit. */
const CHUNK_SIZE = 1800;
/** 64 chunks is ~115 KB, far more than any session. */
const MAX_CHUNKS = 64;

const countKey = (key: string) => `${key}.__count`;
const chunkKey = (key: string, index: number) => `${key}.__chunk.${index}`;

let secureAvailable: boolean | null = null;

async function canUseSecureStore(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (secureAvailable !== null) return secureAvailable;
  try {
    secureAvailable = await SecureStore.isAvailableAsync();
  } catch {
    secureAvailable = false;
  }
  return secureAvailable;
}

async function readCount(key: string): Promise<number> {
  try {
    const raw = await SecureStore.getItemAsync(countKey(key));
    const count = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(count) && count > 0 ? count : 0;
  } catch {
    return 0;
  }
}

async function getItem(key: string): Promise<string | null> {
  if (!(await canUseSecureStore())) {
    return AsyncStorage.getItem(key);
  }

  const count = await readCount(key);
  if (count > 0) {
    // A previous interrupted migration may have left a plaintext copy even
    // though the secure-store chunks are complete. Clear it on every read.
    void AsyncStorage.removeItem(key).catch(() => undefined);
    const parts = await Promise.all(
      Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(chunkKey(key, index))),
    );
    if (parts.some((part) => part === null)) return null;
    return parts.join('');
  }

  // A session written by an older build lives in AsyncStorage in plaintext.
  // Move it into the secure store on first read so existing users stay signed
  // in and the old copy is removed.
  const legacy = await AsyncStorage.getItem(key);
  if (legacy !== null) {
    try {
      await setItem(key, legacy);
      await AsyncStorage.removeItem(key);
    } catch {
      // If the secure store refuses, keep serving the legacy value rather than
      // signing the user out on an upgrade.
      return legacy;
    }
  }
  return legacy;
}

async function setItem(key: string, value: string): Promise<void> {
  if (!(await canUseSecureStore())) {
    await AsyncStorage.setItem(key, value);
    return;
  }

  // An empty value still needs one chunk, otherwise it would be stored as
  // "nothing" and read back as null.
  const chunks: string[] = [];
  if (value.length === 0) {
    chunks.push('');
  } else {
    for (let offset = 0; offset < value.length; offset += CHUNK_SIZE) {
      chunks.push(value.slice(offset, offset + CHUNK_SIZE));
    }
  }
  if (chunks.length > MAX_CHUNKS) {
    throw new Error('secure-storage: value is too large to store securely');
  }

  const previous = await readCount(key);
  await Promise.all(chunks.map((chunk, index) => SecureStore.setItemAsync(chunkKey(key, index), chunk)));
  await SecureStore.setItemAsync(countKey(key), String(chunks.length));
  // Once the secure copy is committed, any legacy plaintext is redundant.
  void AsyncStorage.removeItem(key).catch(() => undefined);

  if (previous > chunks.length) {
    await Promise.all(
      Array.from({ length: previous - chunks.length }, (_, offset) =>
        SecureStore.deleteItemAsync(chunkKey(key, chunks.length + offset)),
      ),
    );
  }
}

async function removeItem(key: string): Promise<void> {
  if (!(await canUseSecureStore())) {
    await AsyncStorage.removeItem(key);
    return;
  }

  const count = await readCount(key);
  await Promise.all([
    ...Array.from({ length: count }, (_, index) => SecureStore.deleteItemAsync(chunkKey(key, index))),
    SecureStore.deleteItemAsync(countKey(key)),
    // Also clear any plaintext copy left by an older build.
    AsyncStorage.removeItem(key),
  ]);
}

export const secureStorage = { getItem, setItem, removeItem };
