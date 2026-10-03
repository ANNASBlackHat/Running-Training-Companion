import type { RuntimeSegment, SegmentType, TrackPoint } from './types';

/**
 * Fake location provider.
 *
 * From .specs/Running Training Companion_ Tech Spec.md section 11 (Testing):
 *   "A fake location provider that replays a recorded or generated track at
 *    accelerated speed. This lets you test a whole 4x4 session at your desk,
 *    including pace alerts."
 *
 * The generator produces a straight-line track with configurable speed per
 * segment type, optional GPS noise, a GPS settling period, and an optional
 * standing-still phase for rests. Nothing here imports Expo.
 */

const M_PER_DEG_LAT = 111_195;

export interface FakeTrackOptions {
  /** Pace in sec/km used for each segment type, when no override applies. */
  paceByType?: Partial<Record<SegmentType, number>>;
  /**
   * Pace overrides keyed by segment index, e.g. to make one work interval too
   * fast on purpose and trigger a pace alert.
   */
  paceBySegmentIndex?: Record<number, number>;
  /** Simulated GPS accuracy in meters. Default 6. */
  accuracyM?: number;
  /** Probability a generated point is discarded as noise. Default 0. */
  noiseRate?: number;
  /** Random seed for reproducible tests. */
  seed?: number;
  /** True to hold still during rest segments. Default true. */
  stillOnRest?: boolean;
  /** Start latitude. */
  startLat?: number;
}

const DEFAULT_PACE: Record<SegmentType, number> = {
  run: 285, // 4:45 /km
  warmup: 330, // 5:30 /km
  cooldown: 330,
  rest: 0,
};

/** Deterministic pseudo-random generator so tests are reproducible. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export interface GeneratedTrack {
  points: TrackPoint[];
  /** Duration in ms covered by the track. */
  durationMs: number;
}

/**
 * Generate a track for a flattened workout.
 *
 * Time segments run for their full duration at the configured pace.
 * Distance segments produce points until the target distance is covered, so a
 * 400 m segment closes in roughly 400 m / pace.
 */
export function generateTrack(
  segments: RuntimeSegment[],
  startMs: number,
  options: FakeTrackOptions = {},
): GeneratedTrack {
  const {
    paceByType = {},
    paceBySegmentIndex = {},
    accuracyM = 6,
    noiseRate = 0,
    seed = 42,
    stillOnRest = true,
    startLat = 51.5074,
  } = options;

  const rng = makeRng(seed);
  const points: TrackPoint[] = [];

  let lat = startLat;
  let t = startMs;

  // GPS settling: the first fixes are poor and are discarded by the runner.
  const SETTLE_MS = 5000;

  const push = (atMs: number, accuracy: number) => {
    // Simulate a dropped fix.
    if (noiseRate > 0 && rng() < noiseRate) return;
    points.push({ t: atMs, lat, lon: -0.1278, acc: accuracy });
  };

  // Emit the settling window with bad accuracy.
  for (let ms = 0; ms <= SETTLE_MS; ms += 1000) {
    push(t + ms, 40);
  }
  t += SETTLE_MS;

  for (const seg of segments) {
    const pace = paceBySegmentIndex[seg.index] ?? paceByType[seg.segment.type] ?? DEFAULT_PACE[seg.segment.type];
    const isRest = seg.segment.type === 'rest' && stillOnRest;

    if (isRest) {
      const seconds = seg.segment.length.kind === 'time' ? seg.segment.length.seconds : 0;
      for (let s = 1; s <= seconds; s += 1) {
        push(t + s * 1000, accuracyM);
      }
      t += seconds * 1000;
      continue;
    }

    const speedMps = pace > 0 ? 1000 / pace : 0;

    if (seg.segment.length.kind === 'time') {
      const seconds = seg.segment.length.seconds;
      for (let s = 1; s <= seconds; s += 1) {
        lat += speedMps / M_PER_DEG_LAT;
        push(t + s * 1000, accuracyM);
      }
      t += seconds * 1000;
      continue;
    }

    // Distance segment: keep moving until the target is covered.
    const targetM = seg.segment.length.meters;
    let covered = 0;
    let s = 0;
    while (covered < targetM) {
      s += 1;
      lat += speedMps / M_PER_DEG_LAT;
      covered += speedMps;
      push(t + s * 1000, accuracyM);
    }
    t += s * 1000;
  }

  return { points, durationMs: t - startMs };
}

/**
 * Replay a generated track at an accelerated rate.
 *
 * `speedFactor` of 60 means one simulated second per real millisecond, so a
 * 40-minute session runs in about 40 s.
 */
export class FakeLocationProvider {
  private readonly points: TrackPoint[];

  private readonly startMs: number;

  readonly speedFactor: number;

  constructor(points: TrackPoint[], startMs: number, speedFactor = 60) {
    this.points = points;
    this.startMs = startMs;
    this.speedFactor = speedFactor;
  }

  /** Simulated timestamp for a given real elapsed time. */
  simTime(realElapsedMs: number): number {
    return this.startMs + realElapsedMs * this.speedFactor;
  }

  /** All points up to a simulated timestamp. */
  pointsUntil(simMs: number): TrackPoint[] {
    const out: TrackPoint[] = [];
    for (const p of this.points) {
      if (p.t <= simMs) out.push(p);
      else break;
    }
    return out;
  }

  /** Epoch ms of the final point, for bounding the simulation. */
  get endMs(): number {
    return this.points.length > 0 ? this.points[this.points.length - 1].t : this.startMs;
  }

  get startTimeMs(): number {
    return this.startMs;
  }
}