import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Storage wrapper.
 *
 * Tech Spec section 2 lists `storage.ts` under /services. The Zustand stores
 * persist through AsyncStorage directly, so this module exists for the cases
 * that are not store state:
 *
 *   - the in-progress snapshot written every 30 s (section 8, "crash safety
 *     (should-have): write an in-progress snapshot every 30 s so a crash does
 *     not lose a whole session"),
 *   - one-off reads such as the template seed marker.
 *
 * Section 1 notes AsyncStorage is "fine for workouts and sessions at this size.
 * Upgrade path: expo-sqlite".
 */

/** Keys are namespaced so a future migration can find them all. */
export const STORAGE_PREFIX = 'rtc';

export const StorageKeys = {
  /** In-progress session snapshot for crash recovery. */
  inProgress: `${STORAGE_PREFIX}:in-progress-session`,
  /** Whether the built-in templates have been seeded. */
  templatesSeeded: `${STORAGE_PREFIX}:templates-seeded`,
} as const;

export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage failures must not interrupt a running session.
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}

/* In-progress session snapshot (section 8, crash safety). */

export const SNAPSHOT_INTERVAL_MS = 30_000;

export async function saveInProgressSession(snapshot: unknown): Promise<void> {
  await writeJson(StorageKeys.inProgress, snapshot);
}

export async function loadInProgressSession<T>(): Promise<T | null> {
  return readJson<T>(StorageKeys.inProgress);
}

export async function clearInProgressSession(): Promise<void> {
  await removeKey(StorageKeys.inProgress);
}

/* Template seeding marker (section 8). */

export async function hasSeededTemplates(): Promise<boolean> {
  const value = await AsyncStorage.getItem(StorageKeys.templatesSeeded);
  return value === 'true';
}

export async function markTemplatesSeeded(): Promise<void> {
  await AsyncStorage.setItem(StorageKeys.templatesSeeded, 'true');
}