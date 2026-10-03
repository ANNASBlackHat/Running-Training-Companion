import type { TrackPoint } from './types';

/**
 * GPS processing.
 *
 * From .specs/Running Training Companion_ Tech Spec.md section 5
 * ("GPS processing"). Pure math, no Expo imports (section 2 rule).
 */

const EARTH_RADIUS_M = 6371008.8;

/** Drop points with accuracy worse than about 25 m. */
export const MAX_ACCURACY_M = 25;

/** Drop points implying speed above about 10 m/s (physically unlikely for running). */
export const MAX_SPEED_MPS = 10;

/** Ignore displacement below about 1 m when the speed reading is near zero. */
export const MIN_DISPLACEMENT_M = 1;

/** Below this, treat implied speed as "near zero" for the jitter filter. */
export const NEAR_ZERO_SPEED_MPS = 0.5;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance in meters between two coordinates (haversine). */
export function haversineMeters(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);

  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distance in meters between two track points. */
export function distanceBetween(a: TrackPoint, b: TrackPoint): number {
  return haversineMeters(a.lat, a.lon, b.lat, b.lon);
}

/** Implied speed in m/s between two points, or null if the gap is not usable. */
export function speedMps(a: TrackPoint, b: TrackPoint): number | null {
  const dtSec = (b.t - a.t) / 1000;
  if (dtSec <= 0) return null;
  return distanceBetween(a, b) / dtSec;
}

/**
 * Point filtering, applied before distance is accumulated.
 * Returns true when the point may be added to the track.
 */
export function isAcceptablePoint(prev: TrackPoint, next: TrackPoint): boolean {
  // Accuracy gate.
  if (next.acc > MAX_ACCURACY_M) return false;

  const speed = speedMps(prev, next);
  if (speed === null) return false;

  // Implausible speed gate.
  if (speed > MAX_SPEED_MPS) return false;

  // Standing-still drift gate.
  if (speed < NEAR_ZERO_SPEED_MPS && distanceBetween(prev, next) < MIN_DISPLACEMENT_M) {
    return false;
  }

  return true;
}

/**
 * Warm-up: ignore the first few seconds of fixes after Start until accuracy
 * settles. Returns the timestamp after which points are trusted.
 */
export function warmupUntilMs(startedAtMs: number, warmupSec = 5): number {
  return startedAtMs + warmupSec * 1000;
}

/** True once the GPS warm-up window has elapsed. */
export function isWarmupComplete(
  nowMs: number,
  startedAtMs: number,
  warmupSec = 5,
): boolean {
  return nowMs >= warmupUntilMs(startedAtMs, warmupSec);
}

/**
 * Haversine distance summed over consecutive accepted points.
 * Points must already be filtered (see isAcceptablePoint).
 */
export function totalDistanceMeters(points: TrackPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += distanceBetween(points[i - 1], points[i]);
  }
  return total;
}