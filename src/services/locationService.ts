import * as Location from 'expo-location';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import type { TrackPoint } from '@/domain/types';

/**
 * GPS wrapper.
 *
 * Tech Spec section 2 lists `locationService.ts` under /services with
 * "start(), stop(), onPosition(cb)", and section 3 says the GPS sits "Behind
 * `locationService` wrapper".
 *
 * This is the ONLY file that needs to change for the later background-location
 * refactor (section 10, step 3: "Rewrite only `locationService.ts` to use a
 * registered background task plus a foreground-service notification, forwarding
 * positions to the same `onPosition` callback"). Nothing above this file knows
 * whether tracking is foreground or background.
 *
 * Section 5 request: "high accuracy, time interval 1000 ms, distance interval 0
 * (use time)."
 */

export type PositionCallback = (point: TrackPoint) => void;
export type LocationErrorCallback = (message: string) => void;

export type PermissionState =
  | 'unknown'
  | 'granted'
  | 'denied'
  | 'servicesOff';

let subscription: Location.LocationSubscription | null = null;
let keepAwakeActive = false;

/**
 * Section 5 warm-up: the first few seconds of fixes are ignored while accuracy
 * settles, and the start screen shows a "GPS ready" state meanwhile.
 */
export const GPS_SETTLING_SEC = 5;

/**
 * A fix at least this accurate is trusted immediately. Matches the domain
 * filter in geo.ts (MAX_ACCURACY_M), kept here so the wrapper can decide when
 * the runner is safe to start on.
 */
export const GOOD_FIX_ACCURACY_M = 25;

let startedAtMs = 0;
let firstFixMs: number | null = null;

/** True once a fix good enough to run on has arrived. */
export function isGpsReady(nowMs: number): boolean {
  return firstFixMs !== null && nowMs - firstFixMs >= 0;
}

/** Seconds remaining in the settling window, for the start screen copy. */
export function gpsSettlingRemainingSec(nowMs: number): number {
  if (firstFixMs !== null) return 0;
  const elapsed = (nowMs - startedAtMs) / 1000;
  return Math.max(0, Math.ceil(GPS_SETTLING_SEC - elapsed));
}

/** Whether location services are enabled at the OS level. */
export async function hasServicesEnabled(): Promise<boolean> {
  try {
    return await Location.hasServicesEnabledAsync();
  } catch {
    return false;
  }
}

/**
 * Request foreground-only permission.
 *
 * US-5: "App asks for location permission if missing." Background permission is
 * deliberately not requested here; that belongs to the section 10 refactor.
 */
export async function requestPermission(): Promise<PermissionState> {
  try {
    const existing = await Location.getForegroundPermissionsAsync();
    if (existing.granted) return 'granted';

    const requested = await Location.requestForegroundPermissionsAsync();
    return requested.granted ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export type StartResult =
  | { ok: true }
  | { ok: false; reason: 'servicesOff' | 'denied' };

/**
 * Begin tracking. Calls `onPosition` for each accepted device fix.
 *
 * The runner's own filters (accuracy, speed, drift) are NOT applied here: the
 * domain applies them in `applyPosition`, which is what keeps the logic
 * testable. This wrapper only translates the native object shape.
 */
export async function start(
  onPosition: PositionCallback,
  onError?: LocationErrorCallback,
): Promise<StartResult> {
  await stop();

  startedAtMs = Date.now();
  firstFixMs = null;

  if (!(await hasServicesEnabled())) {
    return { ok: false, reason: 'servicesOff' };
  }

  const permission = await requestPermission();
  if (permission !== 'granted') {
    return { ok: false, reason: 'denied' };
  }

  // Section 5: keep the screen on for the first session, because Expo Go may
  // pause GPS and speech when the screen locks.
  try {
    await activateKeepAwakeAsync('session');
    keepAwakeActive = true;
  } catch {
    // Not fatal; the run still works, but the screen may sleep.
  }

  try {
    subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        // Use time, not distance, so distance segments stay accurate.
        distanceInterval: 0,
      },
      (position) => {
        // Section 5: wait for accuracy to settle, not merely for the first
        // fix. A 40 m fix is what the warm-up exists to discard.
        if (firstFixMs === null && (position.coords.accuracy ?? 999) <= GOOD_FIX_ACCURACY_M) {
          firstFixMs = Date.now();
        }
        onPosition({
          t: position.timestamp,
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          acc: position.coords.accuracy ?? 999,
        });
      },
      (error) => {
        onError?.(String(error));
      },
    );
    return { ok: true };
  } catch (error) {
    onError?.(error instanceof Error ? error.message : String(error));
    await releaseKeepAwake();
    return { ok: false, reason: 'servicesOff' };
  }
}

/** Stop tracking and release the keep-awake lock. */
export async function stop(): Promise<void> {
  if (subscription) {
    try {
      subscription.remove();
    } catch {
      // Ignore removal failures.
    }
    subscription = null;
  }
  await releaseKeepAwake();
  firstFixMs = null;
}

async function releaseKeepAwake(): Promise<void> {
  if (!keepAwakeActive) return;
  keepAwakeActive = false;
  try {
    await deactivateKeepAwake('session');
  } catch {
    // Ignore.
  }
}

export function isTracking(): boolean {
  return subscription !== null;
}

/** Test seam: reset module state without touching the native module. */
export function resetLocationService(): void {
  subscription = null;
  keepAwakeActive = false;
  startedAtMs = 0;
  firstFixMs = null;
}