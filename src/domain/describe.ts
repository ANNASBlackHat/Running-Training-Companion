import { flatten } from './flatten';
import { formatClock, formatDistance, spokenLength } from './format';
import type {
  Length,
  Segment,
  SegmentType,
  Workout,
  WorkoutItem,
} from './types';

/**
 * Workout description helpers.
 *
 * Used by the home rows, the workout detail list and the builder, so that
 * "total time or distance as caption" (UI Style Guide section 6, Home) is
 * derived in one place.
 */

export const SEGMENT_LABEL: Record<SegmentType, string> = {
  warmup: 'Warm-up',
  run: 'Run',
  rest: 'Rest',
  cooldown: 'Cool-down',
};

/** Human label for one segment's length, e.g. "4 min" or "400 m". */
export function describeLength(length: Length): string {
  if (length.kind === 'distance') return formatDistance(length.meters);
  const sec = length.seconds;
  if (sec >= 60 && sec % 60 === 0) return `${sec / 60} min`;
  if (sec < 60) return `${sec} s`;
  return formatClock(sec);
}

/** Spoken length, used when the builder previews a segment. */
export function spokenLengthFor(length: Length): string {
  return length.kind === 'time'
    ? spokenLength(length.seconds, 0)
    : `${Math.round(length.meters)} meters`;
}

/**
 * Total of a workout for display: a time total when every segment is time-based,
 * otherwise a distance total. Mixed workouts report both.
 */
export function describeWorkoutTotal(workout: Workout): string {
  let timeSec = 0;
  let distanceM = 0;
  let hasTime = false;
  let hasDistance = false;

  for (const seg of flatten(workout)) {
    if (seg.segment.length.kind === 'time') {
      hasTime = true;
      timeSec += seg.segment.length.seconds;
    } else {
      hasDistance = true;
      distanceM += seg.segment.length.meters;
    }
  }

  if (hasTime && hasDistance) {
    return `${formatClock(timeSec)} · ${formatDistance(distanceM)}`;
  }
  if (hasDistance) return formatDistance(distanceM);
  if (hasTime) return formatClock(timeSec);
  return 'Empty';
}

/** Target pace range as text, or null when the segment has none (US-3). */
export function describePaceRange(segment: Segment): string | null {
  if (!segment.paceRange) return null;
  const { fastSecPerKm, slowSecPerKm } = segment.paceRange;
  return `${formatClock(fastSecPerKm)} to ${formatClock(slowSecPerKm)} /km`;
}

/** Count of repeated sets, for the row caption on a template. */
export function describeSetCount(workout: Workout): number | null {
  const repeat = workout.items.find((i) => i.kind === 'repeat');
  return repeat && repeat.kind === 'repeat' ? repeat.count : null;
}

/** True when the workout has no segments at all, so it cannot be started. */
export function isEmptyWorkout(workout: Workout): boolean {
  return flatten(workout).length === 0;
}

/** Every distinct segment in a workout, for the builder list. */
export function allSegments(workout: Workout): Segment[] {
  return flatten(workout).map((r) => r.segment);
}

/** A fresh id for a new segment. */
let idCounter = 0;
export function newSegmentId(): string {
  idCounter += 1;
  return `seg-${Date.now().toString(36)}-${idCounter}`;
}

/** Build a single-segment workout item. */
export function makeSegmentItem(
  type: SegmentType,
  length: Length,
  paceRange?: Segment['paceRange'],
): WorkoutItem {
  return {
    kind: 'segment',
    segment: { id: newSegmentId(), type, length, paceRange },
  };
}