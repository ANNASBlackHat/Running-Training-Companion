import { isAcceptablePoint, distanceBetween, isWarmupComplete } from './geo';
import type { RuntimeSegment, SegmentResult, TrackPoint } from './types';

/**
 * Workout runner state machine.
 *
 * From .specs/Running Training Companion_ Tech Spec.md section 4
 * ("Workout runner (state machine)"):
 *
 *   States: idle, running, paused, finished.
 *   Inputs: start, tick (every 1 s), position, pause, resume, skip, stop.
 *   Outputs: cue events (see section 6) and updated segment progress.
 *
 * Rules implemented here:
 *   - Elapsed time comes from timestamps, never from counting ticks.
 *   - A time segment ends when elapsed >= target.
 *   - A distance segment ends when accumulated segment distance >= target.
 *   - When a segment ends, record its SegmentResult, advance, emit a start cue.
 *   - The last segment ending moves to finished.
 *   - Pause freezes time and ignores positions; distance resumes from the
 *     first new point without adding the gap.
 *   - Skip closes the current segment with whatever was recorded.
 *   - For distance segments the crossing point counts in the finishing
 *     segment; carry-over is not added to the next one.
 *
 * This module is pure: no Expo imports (Tech Spec section 2).
 */

export type RunnerState = 'idle' | 'running' | 'paused' | 'finished';

export interface RunnerSnapshot {
  state: RunnerState;
  /** Index of the current segment, or -1 before start / after finish. */
  index: number;
  /** Epoch ms when the current segment began, excluding paused time. */
  segmentStartMs: number;
  /** Accumulated paused milliseconds, subtracted from elapsed. */
  pausedTotalMs: number;
  /** Epoch ms when pause() was last called. */
  pausedAtMs: number;
  /** Accepted points in the current segment only, for rolling pace. */
  segmentPoints: TrackPoint[];
  /**
   * Distance accumulated in the current segment, in meters. Tracked explicitly
   * rather than derived from segmentPoints, so that resetting the distance
   * reference after a pause does not lose the distance already covered.
   */
  segmentDistanceM: number;
  /** Full accepted track for the session. */
  track: TrackPoint[];
  /** Completed segment results. */
  results: SegmentResult[];
  /** Last accepted point, used as `prev` for the next filter check. */
  lastPoint: TrackPoint | null;
  /**
   * True after a pause: the next accepted point becomes a fresh distance
   * reference, so the paused gap is not added (section 4).
   */
  pendingNewReference: boolean;
  /** GPS settling: false until the warm-up window elapses. */
  gpsReady: boolean;
}

/** Remaining time or distance for the live screen. */
export interface SegmentProgress {
  /** Seconds remaining for a time segment; null for distance segments. */
  remainingSec: number | null;
  /** Meters remaining for a distance segment; null for time segments. */
  remainingM: number | null;
  /** Active elapsed seconds in the current segment. */
  elapsedSec: number;
  /** Distance covered in the current segment. */
  distanceM: number;
}

export const GPS_WARMUP_SEC = 5;

export function createRunner(segments: RuntimeSegment[]): RunnerSnapshot {
  return {
    state: 'idle',
    index: segments.length > 0 ? 0 : -1,
    segmentStartMs: 0,
    pausedTotalMs: 0,
    pausedAtMs: 0,
    segmentPoints: [],
    segmentDistanceM: 0,
    track: [],
    results: [],
    lastPoint: null,
    pendingNewReference: false,
    gpsReady: false,
  };
}

const segmentAt = (segments: RuntimeSegment[], index: number): RuntimeSegment | undefined =>
  segments[index];

function targetMeters(seg: RuntimeSegment): number | null {
  return seg.segment.length.kind === 'distance' ? seg.segment.length.meters : null;
}

function targetSeconds(seg: RuntimeSegment): number | null {
  return seg.segment.length.kind === 'time' ? seg.segment.length.seconds : null;
}

/** Sum of accepted point distances inside the current segment. */
export function segmentDistance(runner: RunnerSnapshot): number {
  return runner.segmentDistanceM;
}

/**
 * Elapsed active seconds in the current segment, computed from timestamps.
 * Section 4: "not by counting ticks. This avoids drift when the JS thread is
 * busy."
 */
export function elapsedSec(runner: RunnerSnapshot, nowMs: number): number {
  if (runner.state !== 'running' && runner.state !== 'paused') return 0;

  const frozenNow = runner.state === 'paused' ? runner.pausedAtMs : nowMs;
  const elapsedMs = frozenNow - runner.segmentStartMs - runner.pausedTotalMs;
  return Math.max(0, elapsedMs / 1000);
}

/** Remaining work for the live screen. */
export function progress(
  runner: RunnerSnapshot,
  segments: RuntimeSegment[],
  nowMs: number,
): SegmentProgress {
  const seg = segmentAt(segments, runner.index);
  const elapsed = elapsedSec(runner, nowMs);
  const distanceM = segmentDistance(runner);

  if (!seg) {
    return { remainingSec: null, remainingM: null, elapsedSec: 0, distanceM: 0 };
  }

  const secs = targetSeconds(seg);
  const meters = targetMeters(seg);

  return {
    remainingSec: secs === null ? null : Math.max(0, secs - elapsed),
    remainingM: meters === null ? null : Math.max(0, meters - distanceM),
    elapsedSec: elapsed,
    distanceM,
  };
}

/** True when the current segment has met its completion condition. */
export function isSegmentComplete(
  runner: RunnerSnapshot,
  segments: RuntimeSegment[],
  nowMs: number,
): boolean {
  const seg = segmentAt(segments, runner.index);
  if (!seg) return true;

  const p = progress(runner, segments, nowMs);

  if (seg.segment.length.kind === 'time') {
    return p.elapsedSec >= seg.segment.length.seconds;
  }
  return p.distanceM >= seg.segment.length.meters;
}

/**
 * Close the current segment into a SegmentResult and advance.
 *
 * Section 4: the point that crosses the target is counted in the segment that
 * finished; carry-over distance is not added to the next one. We therefore
 * record the segment's own accumulated distance as-is.
 */
export function closeSegment(
  runner: RunnerSnapshot,
  segments: RuntimeSegment[],
  endedAtMs: number,
): { runner: RunnerSnapshot; closed: SegmentResult | null } {
  const seg = segmentAt(segments, runner.index);
  if (!seg) return { runner, closed: null };

  const distanceM = segmentDistance(runner);
  const durationSec = elapsedSec(runner, endedAtMs);

  const result: SegmentResult = {
    index: seg.index,
    type: seg.segment.type,
    setNumber: seg.setNumber,
    startedAt: runner.segmentStartMs,
    endedAt: endedAtMs,
    durationSec,
    distanceM,
    avgPaceSecPerKm: distanceM > 0 ? durationSec / (distanceM / 1000) : null,
  };

  const advanced = runner.index + 1;
  const isLast = advanced >= segments.length;

  return {
    runner: {
      ...runner,
      state: isLast ? 'finished' : 'running',
      // Keep index at the last segment when finished, so results stay readable.
      index: isLast ? runner.index : advanced,
      segmentStartMs: endedAtMs,
      pausedTotalMs: 0,
      pausedAtMs: 0,
      segmentPoints: [],
      segmentDistanceM: 0,
      results: [...runner.results, result],
    },
    closed: result,
  };
}

/** Start the session. */
export function start(
  runner: RunnerSnapshot,
  segments: RuntimeSegment[],
  nowMs: number,
): RunnerSnapshot {
  if (segments.length === 0) {
    return { ...runner, state: 'finished', index: -1 };
  }
  return {
    ...runner,
    state: 'running',
    index: 0,
    segmentStartMs: nowMs,
    pausedTotalMs: 0,
    pausedAtMs: 0,
    segmentPoints: [],
    segmentDistanceM: 0,
    results: [],
    track: [],
    lastPoint: null,
    pendingNewReference: false,
    gpsReady: false,
  };
}

export function pause(runner: RunnerSnapshot, nowMs: number): RunnerSnapshot {
  if (runner.state !== 'running') return runner;
  return {
    ...runner,
    state: 'paused',
    pausedAtMs: nowMs,
    pendingNewReference: true,
  };
}

export function resume(runner: RunnerSnapshot, nowMs: number): RunnerSnapshot {
  if (runner.state !== 'paused') return runner;
  const pausedFor = Math.max(0, nowMs - runner.pausedAtMs);
  return {
    ...runner,
    state: 'running',
    // Push the segment start forward so the paused gap is not counted as
    // running time.
    segmentStartMs: runner.segmentStartMs + pausedFor,
  };
}

export interface PositionOutcome {
  runner: RunnerSnapshot;
  accepted: boolean;
  /** Meters added to the current segment by this point. */
  addedM: number;
}

/**
 * Accept a GPS position.
 *
 * Section 4: pause "freezes time and ignores positions. Distance accumulation
 * resumes from the first new point without adding the gap."
 */
export function applyPosition(
  runner: RunnerSnapshot,
  position: TrackPoint,
): PositionOutcome {
  if (runner.state !== 'running') {
    return { runner, accepted: false, addedM: 0 };
  }

  // GPS warm-up: ignore the first few seconds of fixes (section 5).
  if (!runner.gpsReady) {
    if (!isWarmupComplete(position.t, runner.segmentStartMs, GPS_WARMUP_SEC)) {
      return { runner, accepted: false, addedM: 0 };
    }
    runner = { ...runner, gpsReady: true };
  }

  // The first usable point establishes a reference.
  if (!runner.lastPoint) {
    return {
      runner: {
        ...runner,
        lastPoint: position,
        track: [...runner.track, position],
        segmentPoints: [...runner.segmentPoints, position],
      },
      accepted: true,
      addedM: 0,
    };
  }

  if (!isAcceptablePoint(runner.lastPoint, position)) {
    return { runner, accepted: false, addedM: 0 };
  }

  // The first point of a segment, or the first point after a pause, becomes a
  // fresh distance reference so that no gap (boundary or paused time) is added.
  // Section 4: "Distance accumulation resumes from the first new point without
  // adding the gap."
  const needsNewReference = runner.pendingNewReference || runner.segmentPoints.length === 0;
  const addedM = needsNewReference ? 0 : distanceBetween(runner.lastPoint, position);

  const nextPoints = needsNewReference ? [position] : [...runner.segmentPoints, position];

  return {
    runner: {
      ...runner,
      lastPoint: position,
      track: [...runner.track, position],
      segmentPoints: nextPoints,
      segmentDistanceM: runner.segmentDistanceM + addedM,
      pendingNewReference: false,
    },
    accepted: true,
    addedM,
  };
}

/** Stop early, closing the current segment with whatever was recorded. */
export function stop(
  runner: RunnerSnapshot,
  segments: RuntimeSegment[],
  nowMs: number,
): { runner: RunnerSnapshot; closed: SegmentResult | null } {
  if (runner.state === 'idle' || runner.state === 'finished') {
    return { runner: { ...runner, state: 'finished' }, closed: null };
  }
  const effectiveNow = runner.state === 'paused' ? runner.pausedAtMs : nowMs;
  const out = closeSegment(runner, segments, effectiveNow);
  return { runner: { ...out.runner, state: 'finished' }, closed: out.closed };
}

/** Skip the current segment, closing it with whatever was recorded. */
export function skip(
  runner: RunnerSnapshot,
  segments: RuntimeSegment[],
  nowMs: number,
): { runner: RunnerSnapshot; closed: SegmentResult | null } {
  if (runner.state !== 'running' && runner.state !== 'paused') {
    return { runner, closed: null };
  }
  const effectiveNow = runner.state === 'paused' ? runner.pausedAtMs : nowMs;
  return closeSegment(runner, segments, effectiveNow);
}

/**
 * Advance the runner by one tick, closing any segment whose condition is met.
 * Returns the closed result when a boundary was crossed.
 */
export function tick(
  runner: RunnerSnapshot,
  segments: RuntimeSegment[],
  nowMs: number,
): { runner: RunnerSnapshot; closed: SegmentResult | null } {
  if (runner.state !== 'running') return { runner, closed: null };
  if (!isSegmentComplete(runner, segments, nowMs)) return { runner, closed: null };
  return closeSegment(runner, segments, nowMs);
}
