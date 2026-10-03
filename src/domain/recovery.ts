import { computeResults } from './results';
import type { Session, SegmentResult, TrackPoint, Workout } from './types';

/**
 * Crash recovery.
 *
 * Tech Spec section 8 (Storage, crash safety as a should-have): "write an
 * in-progress snapshot every 30 s so a crash does not lose a whole session."
 *
 * The snapshot written while a session runs is turned back into a real Session
 * here, so the recorded segments survive a crash instead of being discarded.
 * Pure, so the conversion is testable without storage.
 */

export interface InProgressSnapshot {
  workoutId: string;
  /** Epoch ms the snapshot was written. */
  savedAt: number;
  results: SegmentResult[];
  track: TrackPoint[];
}

/** A snapshot worth offering to recover: it must contain something. */
export function isRecoverable(snapshot: InProgressSnapshot | null): boolean {
  return Boolean(snapshot && snapshot.results.length > 0);
}

/** Short label for the recovery prompt, e.g. "4 segments, 1.8 km". */
export function describeSnapshot(snapshot: InProgressSnapshot): string {
  const { totals } = computeResults(snapshot.results, snapshot.track);
  const segments = snapshot.results.length;
  const distanceM = totals.distanceM;
  const km =
    distanceM >= 1000 ? `${(distanceM / 1000).toFixed(2)} km` : `${Math.round(distanceM)} m`;
  return `${segments} segment${segments === 1 ? '' : 's'}, ${km}`;
}

/**
 * Turn a snapshot into a Session that can be shown in history.
 * The workout snapshot is copied, so later edits cannot rewrite history.
 */
export function recoverSession(
  snapshot: InProgressSnapshot,
  workout: Workout,
  id: string,
): Session {
  const { results, totals } = computeResults(snapshot.results, snapshot.track);

  return {
    id,
    workoutId: workout.id,
    workoutSnapshot: JSON.parse(JSON.stringify(workout)) as Workout,
    startedAt: results[0]?.startedAt ?? snapshot.savedAt,
    endedAt: snapshot.savedAt,
    results,
    totals,
    track: snapshot.track,
  };
}
