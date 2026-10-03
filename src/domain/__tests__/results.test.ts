import {
  computeKmSplits,
  computeResults,
  computeTotals,
  fastestSlowestRuns,
  pointsInWindow,
  splitsPerKm,
  withKmSplits,
} from '../results';
import type { SegmentResult, TrackPoint } from '../types';

const M_PER_DEG_LAT = 111_195;
const T0 = 1_700_000_000_000;

/**
 * Build a straight track at a constant speed, one point per second.
 * speedMps of 1000/300 is 5:00 per km.
 */
function constantTrack(durationSec: number, speedMps: number, startMs = T0): TrackPoint[] {
  const points: TrackPoint[] = [];
  for (let s = 0; s <= durationSec; s += 1) {
    points.push({
      t: startMs + s * 1000,
      lat: (s * speedMps) / M_PER_DEG_LAT,
      lon: -0.1278,
      acc: 5,
    });
  }
  return points;
}

const result = (over: Partial<SegmentResult> = {}): SegmentResult => ({
  index: 0,
  type: 'warmup',
  startedAt: T0,
  endedAt: T0 + 300_000,
  durationSec: 300,
  distanceM: 1000,
  avgPaceSecPerKm: 300,
  ...over,
});

describe('splitsPerKm (section 7)', () => {
  it('splits only warm-up and cool-down', () => {
    expect(splitsPerKm('warmup')).toBe(true);
    expect(splitsPerKm('cooldown')).toBe(true);
    expect(splitsPerKm('run')).toBe(false);
    expect(splitsPerKm('rest')).toBe(false);
  });
});

describe('pointsInWindow', () => {
  const track = constantTrack(10, 3);

  it('is half-open so a boundary point is not counted twice', () => {
    const inside = pointsInWindow(track, T0 + 2000, T0 + 5000);
    expect(inside.every((p) => p.t > T0 + 2000 && p.t <= T0 + 5000)).toBe(true);
    expect(inside[0].t).toBe(T0 + 3000);
  });

  it('excludes the point exactly at the segment start', () => {
    const inside = pointsInWindow(track, T0, T0 + 2000);
    expect(inside[0].t).toBe(T0 + 1000);
  });
});

describe('computeKmSplits', () => {
  it('returns nothing for fewer than two points', () => {
    expect(computeKmSplits([])).toEqual([]);
    expect(computeKmSplits(constantTrack(0, 3).slice(0, 1))).toEqual([]);
  });

  it('returns nothing when the segment is under a kilometre', () => {
    // 100 m in total, no boundary crossed.
    expect(computeKmSplits(constantTrack(30, 1000 / 30 / 5))).toEqual([]);
  });

  it('splits a 5 km run at 5:00 per km into five even splits', () => {
    // 300 s per km, so 5 km takes 1500 s.
    const track = constantTrack(1500, 1000 / 300);
    const splits = computeKmSplits(track);

    expect(splits).toHaveLength(5);
    for (const split of splits) {
      expect(split.paceSecPerKm).toBeCloseTo(300, 0);
    }
    expect(splits.map((s) => s.km)).toEqual([1, 2, 3, 4, 5]);
  });

  it('interpolates the crossing time rather than rounding to a fix', () => {
    // 3 m/s covers 3000 m in 1000 s, so three whole kilometres. A km takes
    // 333.33 s, which never lands on a whole second, so the split can only be
    // right if the crossing time is interpolated.
    const track = constantTrack(1000, 3);
    const splits = computeKmSplits(track);

    expect(splits).toHaveLength(3);
    for (const split of splits) {
      expect(split.paceSecPerKm).toBeCloseTo(1000 / 3, 0);
    }
  });

  it('adds a final partial kilometre with its own distance', () => {
    // At 5:00/km, 1320 s covers 4.4 km: four whole kilometres then 0.4 km.
    const speed = 1000 / 300;
    const track = constantTrack(1320, speed);
    const splits = computeKmSplits(track);

    expect(splits.map((s) => s.km)).toEqual([1, 2, 3, 4, 5]);
    // The whole kilometres are even.
    for (const split of splits.slice(0, 4)) {
      expect(split.paceSecPerKm).toBeCloseTo(300, 0);
    }
    // The remainder is priced per km, so it still reads near 5:00.
    expect(splits[4].paceSecPerKm).toBeCloseTo(300, -1);
  });

  it('shows a slower kilometre when the runner slows', () => {
    // 1 km in 240 s, then 1 km in 360 s.
    const points: TrackPoint[] = [];
    for (let s = 0; s <= 240; s += 1) {
      points.push({ t: T0 + s * 1000, lat: (s * (1000 / 240)) / M_PER_DEG_LAT, lon: -0.1278, acc: 5 });
    }
    const offset = points[points.length - 1].lat;
    for (let s = 1; s <= 360; s += 1) {
      points.push({
        t: T0 + (240 + s) * 1000,
        lat: offset + (s * (1000 / 360)) / M_PER_DEG_LAT,
        lon: -0.1278,
        acc: 5,
      });
    }

    const splits = computeKmSplits(points);
    expect(splits).toHaveLength(2);
    expect(splits[0].paceSecPerKm).toBeCloseTo(240, 0);
    expect(splits[1].paceSecPerKm).toBeCloseTo(360, 0);
    expect(splits[1].paceSecPerKm).toBeGreaterThan(splits[0].paceSecPerKm);
  });
});

describe('withKmSplits', () => {
  it('adds splits to a warm-up', () => {
    // 3 km of track over 900 s, with the result window covering all of it.
    const track = constantTrack(900, 1000 / 300);
    const out = withKmSplits(
      [result({ type: 'warmup', startedAt: T0 - 1000, endedAt: T0 + 900_000 })],
      track,
    );
    expect(out[0].kmSplits?.length).toBe(3);
  });

  it('adds splits to a cool-down', () => {
    const track = constantTrack(900, 1000 / 300);
    const out = withKmSplits(
      [result({ type: 'cooldown', startedAt: T0 - 1000, endedAt: T0 + 900_000 })],
      track,
    );
    expect(out[0].kmSplits?.length).toBe(3);
  });

  it('never splits an interval run per km', () => {
    const track = constantTrack(900, 1000 / 300);
    const out = withKmSplits([result({ type: 'run' })], track);
    expect(out[0].kmSplits).toBeUndefined();
  });

  it('never splits a rest', () => {
    const track = constantTrack(900, 1000 / 300);
    const out = withKmSplits([result({ type: 'rest' })], track);
    expect(out[0].kmSplits).toBeUndefined();
  });

  it('leaves a short warm-up without splits rather than inventing one', () => {
    const track = constantTrack(60, 3); // well under 1 km
    const out = withKmSplits([result({ type: 'warmup' })], track);
    expect(out[0].kmSplits).toBeUndefined();
  });
});

describe('computeTotals (section 7)', () => {
  it('sums every segment, including rest', () => {
    const totals = computeTotals([
      result({ durationSec: 600, distanceM: 2000 }),
      result({ type: 'run', durationSec: 240, distanceM: 900 }),
      result({ type: 'rest', durationSec: 180, distanceM: 0 }),
    ]);

    expect(totals.durationSec).toBe(1020);
    expect(totals.distanceM).toBe(2900);
    expect(totals.avgPaceSecPerKm).toBeCloseTo(1020 / 2.9, 6);
  });

  it('reports null pace when there is no distance', () => {
    expect(computeTotals([result({ distanceM: 0 })]).avgPaceSecPerKm).toBeNull();
  });

  it('handles an empty result set', () => {
    expect(computeTotals([])).toEqual({
      durationSec: 0,
      distanceM: 0,
      avgPaceSecPerKm: null,
    });
  });
});

describe('fastestSlowestRuns', () => {
  it('marks the fastest and slowest run in words', () => {
    const { fastest, slowest } = fastestSlowestRuns([
      result({ index: 1, type: 'run', avgPaceSecPerKm: 280 }),
      result({ index: 3, type: 'run', avgPaceSecPerKm: 265 }),
      result({ index: 5, type: 'run', avgPaceSecPerKm: 295 }),
    ]);

    expect(fastest?.index).toBe(3);
    expect(slowest?.index).toBe(5);
  });

  it('ignores runs with no pace, such as a skipped segment', () => {
    const { fastest } = fastestSlowestRuns([
      result({ index: 1, type: 'run', avgPaceSecPerKm: null }),
      result({ index: 3, type: 'run', avgPaceSecPerKm: 270 }),
    ]);
    expect(fastest?.index).toBe(3);
  });

  it('ignores warm-up and rest segments', () => {
    const { fastest } = fastestSlowestRuns([
      result({ index: 0, type: 'warmup', avgPaceSecPerKm: 400 }),
      result({ index: 1, type: 'run', avgPaceSecPerKm: 275 }),
    ]);
    expect(fastest?.index).toBe(1);
  });
});

describe('computeResults (section 7 end-to-end)', () => {
  it('produces splits and totals in one pass', () => {
    const track = constantTrack(1200, 1000 / 300);
    const { results, totals } = computeResults(
      [
        result({ type: 'warmup', durationSec: 1200, distanceM: 4000, startedAt: T0 - 1000, endedAt: T0 + 1200_000 }),
        result({ index: 1, type: 'run', durationSec: 1200, distanceM: 4000 }),
      ],
      track,
    );

    // The warm-up carries splits; the interval run never does.
    expect(results[0].kmSplits?.length).toBe(4);
    expect(results[1].kmSplits).toBeUndefined();
    expect(totals.durationSec).toBe(2400);
    expect(totals.distanceM).toBe(8000);
  });
});
