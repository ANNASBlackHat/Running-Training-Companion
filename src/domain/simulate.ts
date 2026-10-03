import { generateTrack, type FakeTrackOptions } from './fakeLocation';
import {
  createSessionRun,
  feedPosition,
  startSession,
  tickSession,
  type SessionRun,
} from './session';
import type { RuntimeSegment, TrackPoint } from './types';

/**
 * Headless session simulation.
 *
 * Tech Spec section 11: "A fake location provider that replays a recorded or
 * generated track at accelerated speed. This lets you test a whole 4x4
 * session at your desk, including pace alerts."
 *
 * The loop is the same one the live screen runs: feed a position, then tick.
 * Only the clock and the position source are fake.
 */

export interface SimulationResult {
  run: SessionRun;
  /** Simulated epoch ms when the session started. */
  startedAt: number;
  /** Simulated epoch ms when it finished. */
  endedAt: number;
}

export interface SimulateOptions extends FakeTrackOptions {
  /** Simulated ms at which the session starts. */
  startMs?: number;
  /** Tick interval in simulated seconds. Default 1. */
  tickSec?: number;
  /** Safety cap on simulated duration, in seconds. */
  maxSec?: number;
  /** Called after each tick; use it to drive a clock or assert mid-session. */
  onTick?: (run: SessionRun, nowMs: number) => void;
}

const DEFAULT_START_MS = 1_700_000_000_000;

/**
 * Run a whole workout against a generated track and return the finished run
 * including the full cue log.
 */
export function simulate(
  segments: RuntimeSegment[],
  options: SimulateOptions = {},
): SimulationResult {
  const {
    startMs = DEFAULT_START_MS,
    tickSec = 1,
    maxSec = 60 * 60 * 4,
    onTick,
    ...trackOptions
  } = options;

  const track = generateTrack(segments, startMs, trackOptions);

  let run = createSessionRun(segments);
  run = startSession(run, startMs);

  const byTime = new Map<number, TrackPoint[]>();
  for (const p of track.points) {
    const second = Math.floor(p.t / 1000);
    const bucket = byTime.get(second);
    if (bucket) bucket.push(p);
    else byTime.set(second, [p]);
  }

  // Run until the track is exhausted plus a margin, or the safety cap.
  const trackEndMs =
    track.points.length > 0 ? track.points[track.points.length - 1].t : startMs;
  const endMs = Math.min(trackEndMs + 30_000, startMs + maxSec * 1000);

  let nowMs = startMs;
  while (nowMs <= endMs) {
    const points = byTime.get(Math.floor(nowMs / 1000));
    if (points) {
      for (const p of points) {
        run = feedPosition(run, p);
      }
    }

    run = tickSession(run, nowMs);
    onTick?.(run, nowMs);

    if (run.runner.state === 'finished') break;
    nowMs += tickSec * 1000;
  }

  return { run, startedAt: startMs, endedAt: nowMs };
}

/** Ordered, human-readable cue transcript of a simulated run. */
export function transcript(run: SessionRun, startedAt: number): string[] {
  return run.events.map(
    (e) => `${Math.round((e.at - startedAt) / 1000)}s [${e.kind}] ${e.text ?? '(beep)'}`,
  );
}