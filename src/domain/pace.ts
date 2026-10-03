import { distanceBetween } from './geo';
import type { PaceRange, TrackPoint } from './types';

/**
 * Rolling pace and pace-range checking.
 *
 * From .specs/Running Training Companion_ Tech Spec.md section 5:
 *   "Pace (live): rolling window of the last 10 to 15 s of accepted points;
 *    pace = windowSeconds / (windowMeters / 1000). If windowMeters is near
 *    zero, pace is 'n/a' and no alerts fire."
 */

export const ROLLING_WINDOW_SEC = 12;

/** Below this many meters in the window, pace is unknown. */
export const MIN_WINDOW_METERS = 3;

export type PaceStatus = 'in' | 'tooFast' | 'tooSlow' | 'unknown' | 'noTarget';

/**
 * Points inside the rolling window ending at (and including) `nowMs`.
 * Points must already be filtered (see geo.isAcceptablePoint).
 */
export function windowPoints(
  points: TrackPoint[],
  nowMs: number,
  windowSec = ROLLING_WINDOW_SEC,
): TrackPoint[] {
  const cutoff = nowMs - windowSec * 1000;
  let start = points.length;

  for (let i = points.length - 1; i >= 0; i -= 1) {
    if (points[i].t < cutoff) break;
    start = i;
  }

  return points.slice(start);
}

/** Live pace in sec/km, or null when it cannot be determined. */
export function rollingPaceSecPerKm(
  points: TrackPoint[],
  nowMs: number,
  windowSec = ROLLING_WINDOW_SEC,
): number | null {
  const win = windowPoints(points, nowMs, windowSec);
  if (win.length < 2) return null;

  const first = win[0];
  const last = win[win.length - 1];

  const windowSec2 = (last.t - first.t) / 1000;
  if (windowSec2 <= 0) return null;

  let meters = 0;
  for (let i = 1; i < win.length; i += 1) {
    meters += distanceBetween(win[i - 1], win[i]);
  }

  if (meters < MIN_WINDOW_METERS) return null;

  return windowSec2 / (meters / 1000);
}

/**
 * Classify a pace against a target range.
 * Lower sec/km is faster, so fastSecPerKm is the lower bound.
 * Boundaries are inclusive -- exactly on target counts as "in".
 */
export function checkPaceRange(
  paceSecPerKm: number | null,
  range: PaceRange | undefined,
): PaceStatus {
  if (paceSecPerKm === null) return 'unknown';
  if (!range) return 'noTarget';
  if (paceSecPerKm < range.fastSecPerKm) return 'tooFast';
  if (paceSecPerKm > range.slowSecPerKm) return 'tooSlow';
  return 'in';
}

/** Convenience: rolling pace plus its status in one call. */
export function paceStatusFor(
  points: TrackPoint[],
  nowMs: number,
  range: PaceRange | undefined,
  windowSec = ROLLING_WINDOW_SEC,
): { paceSecPerKm: number | null; status: PaceStatus } {
  const paceSecPerKm = rollingPaceSecPerKm(points, nowMs, windowSec);
  return { paceSecPerKm, status: checkPaceRange(paceSecPerKm, range) };
}