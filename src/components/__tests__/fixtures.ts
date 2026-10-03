import type { PaceRange, Segment, Workout, WorkoutItem } from '@/domain/types';

/** A 4:30 to 4:45 target, the example from User Stories US-3. */
export const RANGE: PaceRange = { fastSecPerKm: 270, slowSecPerKm: 285 };

export const TIME_SEG = (
  id: string,
  type: Segment['type'],
  seconds: number,
  paceRange?: PaceRange,
): WorkoutItem => ({
  kind: 'segment',
  segment: { id, type, length: { kind: 'time', seconds }, paceRange },
});

export const DIST_SEG = (
  id: string,
  type: Segment['type'],
  meters: number,
  paceRange?: PaceRange,
): WorkoutItem => ({
  kind: 'segment',
  segment: { id, type, length: { kind: 'distance', meters }, paceRange },
});

export const REPEAT = (count: number, segments: Segment[]): WorkoutItem => ({
  kind: 'repeat',
  count,
  segments,
});

/** Minimal workout builder for component tests. */
export const norwegian = (overrides: Partial<Workout> = {}): Workout => ({
  id: 'w1',
  name: 'Test',
  isTemplate: false,
  items: [],
  ...overrides,
});
