import {
  createCueFlags,
  createPaceAlertState,
  msToNextCountdown,
  onFinish,
  onSegmentEndCue,
  onSegmentStart,
  onTickCues,
  paceAlertCue,
  type CueEvent,
  type CueFlags,
  type PaceAlertState,
} from './cues';
import {
  applyPosition,
  createRunner,
  elapsedSec,
  pause as pauseRunner,
  progress,
  resume as resumeRunner,
  skip as skipRunner,
  start as startRunner,
  stop as stopRunner,
  tick as tickRunner,
  type RunnerSnapshot,
  type SegmentProgress,
} from './runner';
import { paceStatusFor, type PaceStatus } from './pace';
import type { RuntimeSegment, SegmentResult, Session, TrackPoint } from './types';

/**
 * Session orchestrator: drives the runner and the cue scheduler together and
 * exposes the cues as a flat, ordered event log.
 *
 * This is what the fake location provider replays, and what the live screen
 * subscribes to. It stays pure (no Expo imports) per Tech Spec section 2, and
 * is the seam the Tech Spec section 11 test plan relies on:
 *   "A fake location provider that replays a recorded or generated track at
 *    accelerated speed. This lets you test a whole 4x4 session at your desk,
 *    including pace alerts."
 */

export interface SessionRun {
  segments: RuntimeSegment[];
  runner: RunnerSnapshot;
  flags: CueFlags;
  paceState: PaceAlertState;
  /** Every cue fired this session, in order. */
  events: CueEvent[];
  /** Epoch ms of the last processed tick, used for cue dt accounting. */
  lastTickAt: number;
  /** Epoch ms when the session finished, or null while running. */
  finishedAt: number | null;
  /** True once the GPS warm-up window has elapsed (section 5). */
  gpsReady: boolean;
}

export function createSessionRun(segments: RuntimeSegment[]): SessionRun {
  return {
    segments,
    runner: createRunner(segments),
    flags: createCueFlags(),
    paceState: createPaceAlertState(),
    events: [],
    lastTickAt: 0,
    finishedAt: null,
    gpsReady: false,
  };
}

/** Current segment, or undefined once the session has finished. */
export function currentSegment(run: SessionRun): RuntimeSegment | undefined {
  if (run.runner.state === 'finished') return undefined;
  return run.segments[run.runner.index];
}

export function currentProgress(run: SessionRun, nowMs: number): SegmentProgress {
  return progress(run.runner, run.segments, nowMs);
}

/** Live pace status for the pace lane (UI Style Guide section 5). */
export function currentPace(run: SessionRun, nowMs: number): {
  paceSecPerKm: number | null;
  status: PaceStatus;
} {
  const seg = currentSegment(run);
  if (!seg) return { paceSecPerKm: null, status: 'unknown' };
  return paceStatusFor(run.runner.segmentPoints, nowMs, seg.segment.paceRange);
}

/** Begin the session and emit the first segment's cues. */
export function startSession(run: SessionRun, nowMs: number): SessionRun {
  if (run.runner.state !== 'idle') return run;

  const runner = startRunner(run.runner, run.segments, nowMs);
  const next: SessionRun = {
    ...run,
    runner,
    flags: createCueFlags(),
    paceState: createPaceAlertState(),
    lastTickAt: nowMs,
  };

  const seg = currentSegment(next);
  if (!seg) return next;

  return { ...next, events: [...next.events, ...onSegmentStart(seg, nowMs)] };
}

/**
 * Advance one tick: emit any due mid-segment cues, then close the segment if
 * its condition is met.
 */
export function tickSession(run: SessionRun, nowMs: number): SessionRun {
  if (run.runner.state !== 'running') return run;

  const dtMs = Math.max(0, nowMs - run.lastTickAt);
  let next: SessionRun = { ...run, lastTickAt: nowMs };
  const events: CueEvent[] = [];

  const segBefore = currentSegment(next);
  if (segBefore) {
    const p = progress(next.runner, next.segments, nowMs);

    // Mid-segment one-time cues.
    events.push(
      ...onTickCues(segBefore, next.flags, p.remainingSec, p.remainingM, p.elapsedSec, nowMs),
    );

    // Pace alert, suppressed near a high-priority cue.
    const alert = paceAlertCue(
      segBefore,
      next.runner.segmentPoints,
      next.paceState,
      p.elapsedSec,
      nowMs,
      dtMs,
      msToNextCountdown(p.remainingSec),
    );
    next = { ...next, paceState: alert.state };
    if (alert.cue) events.push(alert.cue);
  }

  next = { ...next, events: [...next.events, ...events] };

  // Then check for a segment boundary.
  const ticked = tickRunner(next.runner, next.segments, nowMs);
  if (!ticked.closed) return { ...next, runner: ticked.runner };

  return advanceAfterClose(next, ticked.runner, ticked.closed, nowMs);
}

/** Shared boundary handling for tick, skip and stop. */
function advanceAfterClose(
  run: SessionRun,
  runner: RunnerSnapshot,
  closed: SegmentResult,
  at: number,
): SessionRun {
  const events = [...run.events];

  // "Sets left" at the end of a rest segment.
  const closing = run.segments[closed.index];
  if (closing) {
    const endCue = onSegmentEndCue(closing, at);
    if (endCue) events.push(endCue);
  }

  if (runner.state === 'finished') {
    events.push(onFinish(closed.index, at));
    return { ...run, runner, events, finishedAt: at };
  }

  // New segment: announce it and reset one-time flags and pace nag state.
  const upcoming = run.segments[runner.index];
  events.push(...onSegmentStart(upcoming, at));

  return {
    ...run,
    runner,
    events,
    flags: createCueFlags(),
    paceState: createPaceAlertState(),
  };
}

export function pauseSession(run: SessionRun, nowMs: number): SessionRun {
  return { ...run, runner: pauseRunner(run.runner, nowMs), lastTickAt: nowMs };
}

export function resumeSession(run: SessionRun, nowMs: number): SessionRun {
  return { ...run, runner: resumeRunner(run.runner, nowMs), lastTickAt: nowMs };
}

/** Skip the current segment, keeping whatever was recorded. */
export function skipSegment(run: SessionRun, nowMs: number): SessionRun {
  if (run.runner.state !== 'running' && run.runner.state !== 'paused') return run;

  const skipped = skipRunner(run.runner, run.segments, nowMs);
  if (!skipped.closed) return run;

  const next: SessionRun = { ...run, runner: skipped.runner, lastTickAt: nowMs };
  return advanceAfterClose(next, skipped.runner, skipped.closed, nowMs);
}

/** Stop the session early and keep the results recorded so far. */
export function stopSession(run: SessionRun, nowMs: number): SessionRun {
  const stopped = stopRunner(run.runner, run.segments, nowMs);
  if (!stopped.closed) {
    return { ...run, runner: stopped.runner, lastTickAt: nowMs };
  }

  const events = [...run.events];
  const closing = run.segments[stopped.closed.index];
  if (closing) {
    const endCue = onSegmentEndCue(closing, nowMs);
    if (endCue) events.push(endCue);
  }

  return { ...run, runner: stopped.runner, events, finishedAt: nowMs };
}

/** Results recorded so far. */
export function currentResults(run: SessionRun): SegmentResult[] {
  return run.runner.results;
}

/** Elapsed seconds of the active segment. */
export function currentElapsed(run: SessionRun, nowMs: number): number {
  return elapsedSec(run.runner, nowMs);
}

/** Build a persistable Session from a finished run. */
export function toSession(
  run: SessionRun,
  meta: { id: string; workoutId: string; snapshot: Session['workoutSnapshot'] },
): Session {
  const results = run.runner.results;
  const durationSec = results.reduce((acc, r) => acc + r.durationSec, 0);
  const distanceM = results.reduce((acc, r) => acc + r.distanceM, 0);

  return {
    id: meta.id,
    workoutId: meta.workoutId,
    workoutSnapshot: meta.snapshot,
    startedAt: results[0]?.startedAt ?? 0,
    endedAt: run.finishedAt ?? 0,
    results,
    totals: {
      durationSec,
      distanceM,
      // Section 7: totals include rest, so pace is over the whole session.
      avgPaceSecPerKm: distanceM > 0 ? durationSec / (distanceM / 1000) : null,
    },
    track: run.runner.track,
  };
}

/** Feed a GPS position into the session. */
export function feedPosition(run: SessionRun, position: TrackPoint): SessionRun {
  const { runner } = applyPosition(run.runner, position);
  return { ...run, runner, gpsReady: runner.gpsReady };
}