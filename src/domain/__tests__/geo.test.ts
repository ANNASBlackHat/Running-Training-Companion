import {
  distanceBetween,
  haversineMeters,
  isAcceptablePoint,
  isWarmupComplete,
  MAX_ACCURACY_M,
  MAX_SPEED_MPS,
  speedMps,
  totalDistanceMeters,
  warmupUntilMs,
} from '../geo';
import type { TrackPoint } from '../types';

/** Build a track point. t is seconds from epoch for readability. */
const pt = (tSec: number, lat: number, lon: number, acc = 5): TrackPoint => ({
  t: tSec * 1000,
  lat,
  lon,
  acc,
});

describe('haversineMeters', () => {
  it('measures one degree of latitude as about 111 km', () => {
    const d = haversineMeters(0, 0, 1, 0);
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_300);
  });

  it('is zero for identical points', () => {
    expect(haversineMeters(51.5, -0.12, 51.5, -0.12)).toBe(0);
  });

  it('is symmetric', () => {
    const a = haversineMeters(51.5, -0.12, 51.51, -0.1);
    const b = haversineMeters(51.51, -0.1, 51.5, -0.12);
    expect(a).toBeCloseTo(b, 9);
  });

  it('covers a realistic 100 m step', () => {
    // ~0.0009 degrees latitude is roughly 100 m.
    const d = haversineMeters(0, 0, 0.0009, 0);
    expect(d).toBeGreaterThan(95);
    expect(d).toBeLessThan(105);
  });
});

describe('isAcceptablePoint (section 5 filters)', () => {
  it('rejects a point with accuracy worse than 25 m', () => {
    const prev = pt(0, 0, 0, 5);
    const bad = pt(1, 0.0009, 0, MAX_ACCURACY_M + 5);
    expect(isAcceptablePoint(prev, bad)).toBe(false);
  });

  it('accepts a point at exactly the accuracy limit', () => {
    const prev = pt(0, 0, 0, 5);
    // Accuracy is inclusive at 25 m; the step must also stay under 10 m/s,
    // so use a realistic 3 m stride rather than a 100 m jump.
    const edge = pt(1, 3 / 111_195, 0, MAX_ACCURACY_M);
    expect(isAcceptablePoint(prev, edge)).toBe(true);
  });

  it('rejects a jump implying more than 10 m/s', () => {
    const prev = pt(0, 0, 0, 5);
    // ~0.0018 deg lat = ~200 m in 1 s = 200 m/s.
    const jump = pt(1, 0.0018, 0, 5);
    expect(isAcceptablePoint(prev, jump)).toBe(false);
  });

  it('accepts a clean running step near 3 m/s', () => {
    const prev = pt(0, 0, 0, 5);
    // 3 m in 1 s.
    const step = pt(1, 3 / 111_195, 0, 5);
    expect(speedMps(prev, step)).toBeGreaterThan(2.5);
    expect(isAcceptablePoint(prev, step)).toBe(true);
  });

  it('rejects standing-still drift below 1 m', () => {
    const prev = pt(0, 0, 0, 5);
    const drift = pt(1, 0.4 / 111_195, 0, 5); // 0.4 m
    expect(isAcceptablePoint(prev, drift)).toBe(false);
  });

  it('rejects a point with a non-increasing timestamp', () => {
    const prev = pt(5, 0, 0, 5);
    const sameTime = pt(5, 0.0009, 0, 5);
    expect(isAcceptablePoint(prev, sameTime)).toBe(false);
  });
});

describe('warmup', () => {
  it('marks the first few seconds as settling', () => {
    const start = 1_000_000;
    expect(warmupUntilMs(start, 5)).toBe(start + 5000);
    expect(isWarmupComplete(start + 1000, start, 5)).toBe(false);
    expect(isWarmupComplete(start + 5000, start, 5)).toBe(true);
  });
});

describe('totalDistanceMeters', () => {
  it('sums consecutive legs and ignores a lone point', () => {
    const points = [pt(0, 0, 0), pt(1, 0.0009, 0), pt(2, 0.0018, 0)];
    const total = totalDistanceMeters(points);
    expect(total).toBeGreaterThan(190);
    expect(total).toBeLessThan(210);
  });

  it('returns zero for fewer than two points', () => {
    expect(totalDistanceMeters([])).toBe(0);
    expect(totalDistanceMeters([pt(0, 0, 0)])).toBe(0);
  });

  it('distanceBetween agrees with haversineMeters', () => {
    const a = pt(0, 51.5, -0.12);
    const b = pt(1, 51.51, -0.1);
    expect(distanceBetween(a, b)).toBeCloseTo(haversineMeters(51.5, -0.12, 51.51, -0.1), 9);
  });
});