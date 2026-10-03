/**
 * Core data model.
 *
 * Verbatim from .specs/Running Training Companion_ Tech Spec.md section 3
 * ("Data model"). Keep these shapes aligned with the spec.
 *
 * Time is stored in seconds, distance in meters, pace in seconds per km.
 * Formatting (4:30 /km) is a display concern only -- see src/domain/format.ts.
 */

export type SegmentType = 'warmup' | 'run' | 'rest' | 'cooldown';

export type Length =
  | { kind: 'time'; seconds: number }
  | { kind: 'distance'; meters: number };

export interface PaceRange {
  fastSecPerKm: number;
  slowSecPerKm: number;
}

export interface Segment {
  id: string;
  type: SegmentType;
  length: Length;
  paceRange?: PaceRange;
}

/** A workout item is a single segment or a repeated group of segments. */
export type WorkoutItem =
  | { kind: 'segment'; segment: Segment }
  | { kind: 'repeat'; count: number; segments: Segment[] };

export interface Workout {
  id: string;
  name: string;
  isTemplate: boolean;
  items: WorkoutItem[];
}

/**
 * Flattened at session start. One entry per actual segment to perform.
 * See src/domain/flatten.ts.
 */
export interface RuntimeSegment {
  index: number;
  segment: Segment;
  /** 1-based, if inside a repeat. */
  setNumber?: number;
  setTotal?: number;
}

export interface SegmentResult {
  index: number;
  type: SegmentType;
  setNumber?: number;
  /** Epoch ms. */
  startedAt: number;
  endedAt: number;
  /** Excludes paused time. */
  durationSec: number;
  distanceM: number;
  avgPaceSecPerKm: number | null;
  /** Warm-up and cool-down only. */
  kmSplits?: KmSplit[];
  /** Stretch feature -- not implemented in the MVP. */
  elevationGainM?: number;
}

export interface KmSplit {
  km: number;
  paceSecPerKm: number;
}

export interface TrackPoint {
  /** Epoch ms. */
  t: number;
  lat: number;
  lon: number;
  /** Reported horizontal accuracy in meters. */
  acc: number;
}

export interface SessionTotals {
  durationSec: number;
  distanceM: number;
  avgPaceSecPerKm: number | null;
}

export interface Session {
  id: string;
  workoutId: string;
  /** Copy, so later edits don't change history. */
  workoutSnapshot: Workout;
  /** Epoch ms. */
  startedAt: number;
  endedAt: number;
  results: SegmentResult[];
  totals: SessionTotals;
  track: TrackPoint[];
}