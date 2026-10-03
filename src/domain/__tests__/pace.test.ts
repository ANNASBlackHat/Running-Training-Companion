import {
  checkPaceRange,
  MIN_WINDOW_METERS,
  paceStatusFor,
  ROLLING_WINDOW_SEC,
  rollingPaceSecPerKm,
  windowPoints,
} from '../pace';
import type { PaceRange, TrackPoint } from '../types';

const M_PER_DEG_LAT = 111_195;

/**
 * Build a straight, constant-speed track ending at nowSec.
 * speedMps is the speed to hold.
 */
const straightTrack = (
  durationSec: number,
  speedMps: number,
  nowSec: number,
): TrackPoint[] => {
  const points: TrackPoint[] = [];
  for (let s = 0; s <= durationSec; s += 1) {
    points.push({ t: (nowSec - durationSec + s) * 1000, lat: 0, lon: 0, acc: 5 });
  }
  // Displace each point along the track according to speed.
  return points.map((p, i) => ({ ...p, lat: (i * speedMps) / M_PER_DEG_LAT }));
};

/** A track that accelerates from rest up to speedMps over accelSec. */
const acceleratingTrack = (durationSec: number, speedMps: number, nowSec: number): TrackPoint[] => {
  const points: TrackPoint[] = [];
  let meters = 0;
  for (let s = 0; s <= durationSec; s += 1) {
    points.push({ t: (nowSec - durationSec + s) * 1000, lat: 0, lon: 0, acc: 5 });
    if (s > 0) meters += (s / durationSec) * speedMps;
    points[points.length - 1] = {
      ...points[points.length - 1],
      lat: meters / M_PER_DEG_LAT,
    };
  }
  return points;
};

describe('windowPoints', () => {
  it('keeps only points inside the rolling window', () => {
    const points = straightTrack(30, 3, 30);
    const win = windowPoints(points, 30_000, 12);
    expect(win.length).toBeLessThanOrEqual(13);
    expect(win[win.length - 1].t).toBe(30_000);
  });
});

describe('rollingPaceSecPerKm', () => {
  it('converges to the expected pace at a constant 4:00/km', () => {
    // 4:00 per km == 1000/240 == 4.1667 m/s
    const speed = 1000 / 240;
    const points = straightTrack(60, speed, 60);
    const pace = rollingPaceSecPerKm(points, 60_000);

    expect(pace).not.toBeNull();
    expect(pace!).toBeGreaterThan(238);
    expect(pace!).toBeLessThan(242);
  });

  it('returns null for a stationary runner, so no alert fires', () => {
    const points: TrackPoint[] = Array.from({ length: 20 }, (_, i) => ({
      t: i * 1000,
      lat: 51.5,
      lon: -0.12,
      acc: 5,
    }));
    expect(rollingPaceSecPerKm(points, 19_000)).toBeNull();
  });

  it('returns null with fewer than two points', () => {
    expect(rollingPaceSecPerKm([{ t: 0, lat: 0, lon: 0, acc: 5 }], 0)).toBeNull();
    expect(rollingPaceSecPerKm([], 0)).toBeNull();
  });

  it('stays near n/a during acceleration from a standing start', () => {
    // This is what makes the "no alerts in the first 15 s" rule safe.
    const points = acceleratingTrack(15, 1000 / 240, 15);
    const pace = rollingPaceSecPerKm(points, 15_000);
    expect(pace === null || pace > 300).toBe(true);
  });

  it('respects the window length', () => {
    const speed = 1000 / 300; // 5:00 /km
    const points = straightTrack(120, speed, 120);
    const pace = rollingPaceSecPerKm(points, 120_000, ROLLING_WINDOW_SEC);
    expect(pace!).toBeGreaterThan(295);
    expect(pace!).toBeLessThan(305);
  });
});

describe('checkPaceRange', () => {
  const range: PaceRange = { fastSecPerKm: 270, slowSecPerKm: 285 }; // 4:30 to 4:45

  it('is in range between the bounds', () => {
    expect(checkPaceRange(275, range)).toBe('in');
    expect(checkPaceRange(280, range)).toBe('in');
  });

  it('treats the boundaries as in range, not out', () => {
    expect(checkPaceRange(270, range)).toBe('in');
    expect(checkPaceRange(285, range)).toBe('in');
  });

  it('flags faster than the fast bound', () => {
    expect(checkPaceRange(269, range)).toBe('tooFast');
  });

  it('flags slower than the slow bound', () => {
    expect(checkPaceRange(286, range)).toBe('tooSlow');
  });

  it('reports unknown when there is no pace', () => {
    expect(checkPaceRange(null, range)).toBe('unknown');
  });

  it('reports noTarget when the segment has no pace range', () => {
    expect(checkPaceRange(280, undefined)).toBe('noTarget');
  });
});

describe('paceStatusFor', () => {
  const range: PaceRange = { fastSecPerKm: 270, slowSecPerKm: 285 };

  it('combines pace and status', () => {
    const tooFast = straightTrack(60, 1000 / 250, 60); // 4:10 /km
    const { status } = paceStatusFor(tooFast, 60_000, range);
    expect(status).toBe('tooFast');
  });

  it('reports unknown for a stationary track regardless of target', () => {
    const still: TrackPoint[] = Array.from({ length: 20 }, (_, i) => ({
      t: i * 1000,
      lat: 51.5,
      lon: -0.12,
      acc: 5,
    }));
    expect(paceStatusFor(still, 19_000, range).status).toBe('unknown');
  });

  it('has a sane minimum window distance', () => {
    expect(MIN_WINDOW_METERS).toBeGreaterThan(0);
  });
});