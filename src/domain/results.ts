import { distanceBetween } from './geo';
import type { KmSplit, SegmentResult, SegmentType, SessionTotals, TrackPoint } from './types';

/**
 * Results calculation.
 *
 * From .specs/Running Training Companion_ Tech Spec.md section 7:
 *
 *   "Computed once when the session ends, from the recorded track plus segment
 *    timestamps.
 *
 *    - Per segment: duration is the segment's active time; distance is the sum of
 *      accepted point distances inside its time window; avg pace =
 *      duration / (distance / 1000).
 *    - Warm-up and cool-down: walk the cumulative distance and interpolate the
 *      time at each full kilometre to produce per-km splits; a final partial km
 *      is shown with its own distance.
 *    - Interval segments are not split per km, only per set segment, as in the
 *      user stories.
 *    - Totals: sum of all segments, including rest."
 */

/** Only these segment types get per-km splits (section 7). */
export function splitsPerKm(type: SegmentType): boolean {
  return type === 'warmup' || type === 'cooldown';
}

/**
 * Points whose timestamps fall inside a segment's window.
 *
 * The window is half-open, (start, end], so a point recorded exactly at the
 * moment a segment began belongs to the previous segment and cannot be counted
 * twice across a boundary.
 */
export function pointsInWindow(
  track: TrackPoint[],
  startMs: number,
  endMs: number,
): TrackPoint[] {
  return track.filter((p) => p.t > startMs && p.t <= endMs);
}

/**
 * Per-kilometre splits by walking the cumulative distance and interpolating the
 * time at each full kilometre.
 *
 * Interpolation matters because fixes arrive roughly once a second, so the exact
 * moment the runner passes a kilometre boundary falls between two points.
 */
export function computeKmSplits(points: TrackPoint[]): KmSplit[] {
  if (points.length < 2) return [];

  // Absolute time at which each whole kilometre was reached.
  const crossings: number[] = [];

  let cumulativeM = 0;
  let nextKm = 1;

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const legM = distanceBetween(prev, curr);
    if (legM <= 0) continue;

    // A single leg may cross more than one boundary if GPS jumps.
    let legStartM = cumulativeM;
    let legEndM = cumulativeM + legM;

    while (legEndM >= nextKm * 1000) {
      const boundaryM = nextKm * 1000;
      // Fraction of the leg at which the boundary sits.
      const fraction = (boundaryM - legStartM) / legM;
      crossings.push(prev.t + (curr.t - prev.t) * fraction);
      nextKm += 1;
      legStartM = boundaryM;
      // Avoid a pathological loop if legM is enormous but finite.
      if (legEndM - legStartM <= 0) break;
    }

    cumulativeM = legEndM;
  }

  if (crossings.length === 0) return [];

  const splits: KmSplit[] = [];

  // Whole kilometres: pace is the time between consecutive boundaries.
  for (let k = 1; k <= crossings.length; k += 1) {
    const startMs = k === 1 ? points[0].t : crossings[k - 2];
    const endMs = crossings[k - 1];
    const sec = (endMs - startMs) / 1000;
    if (sec > 0) splits.push({ km: k, paceSecPerKm: sec });
  }

  // A final partial kilometre is shown with its own distance (section 7).
  const lastPoint = points[points.length - 1];
  const totalM = cumulativeM;
  const remainderM = totalM - crossings.length * 1000;

  if (remainderM > 50) {
    const startMs = crossings[crossings.length - 1];
    const sec = (lastPoint.t - startMs) / 1000;
    if (sec > 0) {
      splits.push({ km: crossings.length + 1, paceSecPerKm: sec / (remainderM / 1000) });
    }
  }

  return splits;
}
/**
 * Attach per-km splits to warm-up and cool-down results.
 *
 * Section 7: interval segments are NOT split per km, only per set segment.
 */
export function withKmSplits(
  results: SegmentResult[],
  track: TrackPoint[],
): SegmentResult[] {
  return results.map((result) => {
    if (!splitsPerKm(result.type)) return result;

    const points = pointsInWindow(track, result.startedAt, result.endedAt);
    const kmSplits = computeKmSplits(points);
    if (kmSplits.length === 0) return result;

    return { ...result, kmSplits };
  });
}

/** Session totals. Section 7: "Totals: sum of all segments, including rest." */
export function computeTotals(results: SegmentResult[]): SessionTotals {
  const durationSec = results.reduce((a, r) => a + r.durationSec, 0);
  const distanceM = results.reduce((a, r) => a + r.distanceM, 0);

  return {
    durationSec,
    distanceM,
    avgPaceSecPerKm: distanceM > 0 ? durationSec / (distanceM / 1000) : null,
  };
}

/**
 * Fastest and slowest run segment within a set, so the results screen can mark
 * them in words (UI Style Guide section 6: "the fastest and slowest set are
 * marked with words, not only color").
 */
export function fastestSlowestRuns(
  results: SegmentResult[],
): { fastest?: SegmentResult; slowest?: SegmentResult } {
  const runs = results.filter(
    (r) => r.type === 'run' && r.avgPaceSecPerKm !== null,
  );
  if (runs.length < 2) return { fastest: runs[0], slowest: runs[0] };

  const sorted = [...runs].sort((a, b) => a.avgPaceSecPerKm! - b.avgPaceSecPerKm!);
  return { fastest: sorted[0], slowest: sorted[sorted.length - 1] };
}

/**
 * Build the final results for a finished session: attach per-km splits and
 * recompute totals. Section 7: "Computed once when the session ends."
 */
export function computeResults(
  results: SegmentResult[],
  track: TrackPoint[],
): { results: SegmentResult[]; totals: SessionTotals } {
  const withSplits = withKmSplits(results, track);
  return { results: withSplits, totals: computeTotals(withSplits) };
}
