import type { RuntimeSegment, Workout } from './types';

/**
 * Flatten a workout into the ordered list of segments actually performed.
 *
 * From .specs/Running Training Companion_ Tech Spec.md section 3
 * ("A workout item is a single segment or a repeated group of segments") and
 * section 2 (/flatten.ts: workout -> list of runtime segments).
 */

/** Expand repeat groups so each set is listed in order: R R R R, rest, R R R R, rest ... */
export function flatten(workout: Workout): RuntimeSegment[] {
  const out: RuntimeSegment[] = [];
  let index = 0;

  for (const item of workout.items) {
    if (item.kind === 'segment') {
      out.push({ index, segment: item.segment });
      index += 1;
      continue;
    }

    // count < 1 means the group contributes nothing.
    for (let set = 1; set <= item.count; set += 1) {
      for (const segment of item.segments) {
        out.push({
          index,
          segment,
          setNumber: set,
          setTotal: item.count,
        });
        index += 1;
      }
    }
  }

  return out;
}

/** Total number of segments that will be performed. */
export function totalSegments(workout: Workout): number {
  return flatten(workout).length;
}

/**
 * Sets remaining after the given runtime segment, counted from the segment's
 * own set number. Used by the "N sets left" cue at the end of a rest segment.
 *
 * For a rest segment that is set 1 of 4, this returns 3 ("Three sets left").
 */
export function setsRemainingAfter(segment: RuntimeSegment): number {
  const { setTotal, setNumber } = segment;
  if (setTotal === undefined || setNumber === undefined) return 0;
  return Math.max(0, setTotal - setNumber);
}

/** True when the runtime segment is a run inside a repeated set. */
export function isSetRun(segment: RuntimeSegment): boolean {
  return segment.segment.type === 'run' && segment.setNumber !== undefined;
}