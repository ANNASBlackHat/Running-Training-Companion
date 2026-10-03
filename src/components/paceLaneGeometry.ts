import type { PaceRange } from '@/domain/types';
import type { PaceStatus } from '@/domain/pace';

/**
 * Pace lane geometry.
 *
 * UI Style Guide section 5 (Pace lane): "A horizontal lane about 56 dp tall.
 * The lane's full range is the target pace range plus a margin (about 30 s/km
 * each side). The target range is a lighter band with solid edges. Faster pace
 * is to the right, slower to the left."
 *
 * Pure so the mapping can be tested without rendering, which matters because
 * "you see 'off pace' by position, with no numbers to compare" is the core
 * idea of the live screen.
 */

/** Margin either side of the target range, in s/km. */
export const LANE_MARGIN_SEC = 30;

export interface LaneGeometry {
  /** Smallest value on the lane, i.e. the fastest pace shown. s/km. */
  minSecPerKm: number;
  /** Largest value on the lane, i.e. the slowest pace shown. s/km. */
  maxSecPerKm: number;
  /** Position of the fast bound, 0..1 from the left. */
  bandStart: number;
  /** Position of the slow bound, 0..1 from the left. */
  bandEnd: number;
}

/**
 * Build the lane scale for a target range. Falls back to a sensible window when
 * the segment has no target range.
 *
 * Lower sec/km is faster, so `fastSecPerKm` is the smaller number and sits on
 * the right. The lane therefore spans from (fast - margin) to (slow + margin).
 */
export function laneGeometry(range: PaceRange | undefined): LaneGeometry {
  if (!range) {
    // No target: show a generic 3:00 to 8:00 window so pace still has a home.
    return { minSecPerKm: 180, maxSecPerKm: 480, bandStart: 0, bandEnd: 1 };
  }

  // The lane must always be wider than the target band, otherwise the band
  // fills it and the marker has nowhere to travel. A narrow target such as
  // 4:30-4:45 would otherwise collapse the scale.
  const targetSpan = range.slowSecPerKm - range.fastSecPerKm;
  const margin = Math.max(LANE_MARGIN_SEC, targetSpan);

  const minSecPerKm = Math.max(range.fastSecPerKm - margin, 30);
  const maxSecPerKm = range.slowSecPerKm + margin;
  const span = maxSecPerKm - minSecPerKm;

  if (span <= 0) {
    // Degenerate range; fall back to a plain window.
    return { minSecPerKm: 0, maxSecPerKm: 1, bandStart: 0, bandEnd: 1 };
  }

  // Faster pace is to the right, so position falls as the pace value rises.
  const bandStart = (maxSecPerKm - range.fastSecPerKm) / span;
  const bandEnd = (maxSecPerKm - range.slowSecPerKm) / span;

  return { minSecPerKm, maxSecPerKm, bandStart, bandEnd };
}

/**
 * Marker position 0..1 from the left. Faster pace sits to the right, so the
 * position decreases as pace gets faster.
 */
export function markerPosition(
  paceSecPerKm: number | null,
  geometry: LaneGeometry,
): number | null {
  if (paceSecPerKm === null || !Number.isFinite(paceSecPerKm)) return null;
  if (paceSecPerKm <= 0) return null;

  const span = geometry.maxSecPerKm - geometry.minSecPerKm;
  if (span <= 0) return 0.5;

  const raw = (geometry.maxSecPerKm - paceSecPerKm) / span;
  // Clamp, so an outlier outside the window stays visible at the edge.
  return Math.min(1, Math.max(0, raw));
}

/** Whether the marker uses the alert colour, per section 5. */
export function markerIsAlert(status: PaceStatus): boolean {
  return status === 'tooFast' || status === 'tooSlow';
}

/** Arrow shown in the alert pill: which way to correct. */
export function alertDirection(status: PaceStatus): 'right' | 'left' | null {
  if (status === 'tooFast') return 'left';
  if (status === 'tooSlow') return 'right';
  return null;
}