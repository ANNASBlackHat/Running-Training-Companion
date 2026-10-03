import {
  applyPosition,
  createRunner,
  elapsedSec,
  isSegmentComplete,
  pause,
  progress,
  resume,
  segmentDistance,
  skip,
  start,
  stop,
  tick,
} from '../runner';
import type { TrackPoint } from '../types';
import { distSeg, repeatGroup, runtime, timeSeg, workout } from './fixtures';

const M_PER_DEG_LAT = 111_195;
const T0 = 1_700_000_000_000;

/** A position at the given second offset along a straight north line. */
const pos = (sec: number, metersFromStart: number, acc = 5): TrackPoint => ({
  t: T0 + sec * 1000,
  lat: metersFromStart / M_PER_DEG_LAT,
  lon: -0.1278,
  acc,
});

describe('runner: time segments', () => {
  const segs = runtime(workout([timeSeg('a', 'run', 240)]));

  it('starts idle and does not advance until started', () => {
    const r = createRunner(segs);
    expect(r.state).toBe('idle');
    expect(elapsedSec(r, T0 + 10_000)).toBe(0);
  });

  it('computes elapsed from timestamps, not tick counts', () => {
    const r = start(createRunner(segs), segs, T0);
    // No ticks at all: a single jump of 60 s must report 60 s elapsed.
    expect(elapsedSec(r, T0 + 60_000)).toBe(60);
  });

  it('reports remaining time', () => {
    const r = start(createRunner(segs), segs, T0);
    const p = progress(r, segs, T0 + 90_000);
    expect(p.remainingSec).toBe(150);
    expect(p.elapsedSec).toBe(90);
  });

  it('completes a time segment when elapsed reaches the target', () => {
    const r = start(createRunner(segs), segs, T0);
    expect(isSegmentComplete(r, segs, T0 + 239_000)).toBe(false);

    const out = tick(r, segs, T0 + 240_000);
    expect(out.closed).not.toBeNull();
    expect(out.closed!.durationSec).toBeCloseTo(240, 1);
    expect(out.runner.state).toBe('finished');
  });

  it('does not close early', () => {
    const r = start(createRunner(segs), segs, T0);
    expect(tick(r, segs, T0 + 239_999).closed).toBeNull();
  });

  it('resets per-segment state after closing', () => {
    const out = tick(start(createRunner(segs), segs, T0), segs, T0 + 240_000);
    expect(out.runner.segmentPoints).toEqual([]);
  });
});

describe('runner: multi-segment advance', () => {
  const segs = runtime(
    workout([timeSeg('w', 'warmup', 60), timeSeg('r', 'run', 240), timeSeg('c', 'cooldown', 60)]),
  );

  it('moves to finished only after the last segment', () => {
    let r = start(createRunner(segs), segs, T0);

    const first = tick(r, segs, T0 + 60_000);
    expect(first.closed!.type).toBe('warmup');
    expect(first.runner.state).toBe('running');
    expect(first.runner.index).toBe(1);

    const second = tick(first.runner, segs, T0 + 300_000);
    expect(second.closed!.type).toBe('run');
    expect(second.runner.state).toBe('running');

    const third = tick(second.runner, segs, T0 + 360_000);
    expect(third.closed!.type).toBe('cooldown');
    expect(third.runner.state).toBe('finished');
    expect(third.runner.results).toHaveLength(3);
  });
  it('records results in segment order', () => {
    let r = start(createRunner(segs), segs, T0);
    r = tick(r, segs, T0 + 60_000).runner;
    r = tick(r, segs, T0 + 300_000).runner;
    r = tick(r, segs, T0 + 360_000).runner;
    expect(r.results.map((x) => x.type)).toEqual(['warmup', 'run', 'cooldown']);
  });
});


describe('runner: pause and resume', () => {
  const segs = runtime(workout([timeSeg('a', 'run', 300)]));

  it('freezes elapsed time while paused', () => {
    const r = pause(start(createRunner(segs), segs, T0), T0 + 60_000);
    expect(r.state).toBe('paused');
    // 100 s of wall clock later, elapsed is still 60 s.
    expect(elapsedSec(r, T0 + 160_000)).toBeCloseTo(60, 3);
  });

  it('does not count the paused gap after resuming', () => {
    let r = start(createRunner(segs), segs, T0);
    r = pause(r, T0 + 60_000);
    r = resume(r, T0 + 160_000);
    expect(r.state).toBe('running');
    expect(elapsedSec(r, T0 + 160_000)).toBeCloseTo(60, 3);
  });

  it('ignores positions while paused', () => {
    let r = start(createRunner(segs), segs, T0);
    r = pause(r, T0 + 30_000);
    const before = r.segmentPoints.length;
    const out = applyPosition(r, pos(40, 40));
    expect(out.accepted).toBe(false);
    expect(out.runner.segmentPoints.length).toBe(before);
  });

  it('does not add the paused gap to distance', () => {
    let r = start(createRunner(segs), segs, T0);
    for (let s = 1; s <= 60; s += 1) r = applyPosition(r, pos(s, s)).runner;
    const beforePause = segmentDistance(r);
    expect(beforePause).toBeGreaterThan(50);

    r = pause(r, T0 + 60_000);
    // Resume 100 s later but 500 m further along: that gap is discarded.
    r = resume(r, T0 + 160_000);
    const out = applyPosition(r, pos(170, 560));
    expect(out.accepted).toBe(true);
    expect(out.addedM).toBe(0);
    expect(segmentDistance(out.runner)).toBeCloseTo(beforePause, 3);
  });

  it('resumes accumulating from the next point after the gap', () => {
    let r = start(createRunner(segs), segs, T0);
    for (let s = 1; s <= 60; s += 1) r = applyPosition(r, pos(s, s)).runner;
    r = pause(r, T0 + 60_000);
    r = resume(r, T0 + 160_000);
    r = applyPosition(r, pos(170, 560)).runner;
    expect(applyPosition(r, pos(171, 561)).addedM).toBeCloseTo(1, 1);
  });
});

describe('runner: GPS warm-up', () => {
  const segs = runtime(workout([timeSeg('a', 'run', 300)]));

  it('ignores the first few seconds of fixes', () => {
    const first = applyPosition(start(createRunner(segs), segs, T0), pos(1, 1));
    expect(first.accepted).toBe(false);
    expect(first.runner.gpsReady).toBe(false);

    const later = applyPosition(first.runner, pos(8, 8));
    expect(later.accepted).toBe(true);
    expect(later.runner.gpsReady).toBe(true);
  });

  it('drops points with poor accuracy', () => {
    let r = start(createRunner(segs), segs, T0);
    r = applyPosition(r, pos(8, 8)).runner;
    expect(applyPosition(r, pos(9, 9, 40)).accepted).toBe(false);
  });

  it('drops a jump implying an implausible speed', () => {
    let r = start(createRunner(segs), segs, T0);
    r = applyPosition(r, pos(8, 8)).runner;
    expect(applyPosition(r, pos(9, 500)).accepted).toBe(false);
  });
});

describe('runner: distance segments', () => {
  const segs = runtime(workout([distSeg('d', 'run', 400)]));

  it('closes when accumulated distance reaches the target', () => {
    let r = start(createRunner(segs), segs, T0);
    for (let s = 1; s <= 390; s += 1) r = applyPosition(r, pos(s, s)).runner;
    expect(isSegmentComplete(r, segs, T0 + 390_000)).toBe(false);

    for (let s = 406; s <= 415; s += 1) r = applyPosition(r, pos(s, s)).runner;
    const out = tick(r, segs, T0 + 415_000);
    expect(out.closed).not.toBeNull();
    expect(out.closed!.distanceM).toBeGreaterThanOrEqual(400);
  });

  it('counts the crossing point in the finishing segment', () => {
    let r = start(createRunner(segs), segs, T0);
    for (let s = 1; s <= 415; s += 1) r = applyPosition(r, pos(s, s)).runner;
    const out = tick(r, segs, T0 + 415_000);
    // Distance may slightly exceed 400 by up to one point interval; the
    // Tech Spec section 13 accepts this drift for the MVP.
    expect(out.closed!.distanceM).toBeGreaterThanOrEqual(400);
    expect(out.closed!.distanceM).toBeLessThan(420);
  });

  it('does not carry the overshoot into the next segment', () => {
    const pair = runtime(workout([distSeg('d1', 'run', 400), distSeg('d2', 'run', 400)]));
    let r = start(createRunner(pair), pair, T0);
    for (let s = 1; s <= 415; s += 1) r = applyPosition(r, pos(s, s)).runner;

    const out = tick(r, pair, T0 + 415_000);
    expect(out.runner.segmentPoints).toEqual([]);
    expect(out.runner.results[0].distanceM).toBeGreaterThanOrEqual(400);
  });

  it('reports remaining distance, not time', () => {
    let r = start(createRunner(segs), segs, T0);
    for (let s = 1; s <= 100; s += 1) r = applyPosition(r, pos(s, s)).runner;
    const p = progress(r, segs, T0 + 100_000);
    expect(p.remainingM).toBeGreaterThan(290);
    expect(p.remainingM).toBeLessThan(310);
    expect(p.remainingSec).toBeNull();
  });
});

describe('runner: skip and stop', () => {
  const segs = runtime(workout([timeSeg('a', 'run', 240), timeSeg('b', 'run', 240)]));

  it('skip closes the segment with partial data', () => {
    const out = skip(start(createRunner(segs), segs, T0), segs, T0 + 60_000);
    expect(out.closed!.durationSec).toBeCloseTo(60, 1);
    expect(out.runner.index).toBe(1);
  });

  it('skip on the last segment finishes the session', () => {
    let r = start(createRunner(segs), segs, T0);
    r = skip(r, segs, T0 + 10_000).runner;
    const out = skip(r, segs, T0 + 20_000);
    expect(out.runner.state).toBe('finished');
    expect(out.runner.results).toHaveLength(2);
  });

  it('stop ends the session and keeps what was recorded', () => {
    let r = start(createRunner(segs), segs, T0);
    for (let s = 1; s <= 30; s += 1) r = applyPosition(r, pos(s, s)).runner;
    const out = stop(r, segs, T0 + 30_000);
    expect(out.runner.state).toBe('finished');
    expect(out.closed!.durationSec).toBeCloseTo(30, 1);
  });

  it('stop on an idle session is a no-op with no result', () => {
    const out = stop(createRunner(segs), segs, T0);
    expect(out.closed).toBeNull();
    expect(out.runner.state).toBe('finished');
  });

  it('stop while paused does not count the paused gap', () => {
    let r = start(createRunner(segs), segs, T0);
    r = pause(r, T0 + 30_000);
    expect(stop(r, segs, T0 + 300_000).closed!.durationSec).toBeCloseTo(30, 1);
  });
});

describe('runner: average pace', () => {
  const segs = runtime(workout([timeSeg('a', 'run', 240)]));

  it('computes avg pace from duration and distance', () => {
    let r = start(createRunner(segs), segs, T0);
    for (let s = 1; s <= 240; s += 1) {
      r = applyPosition(r, pos(s, (s / 240) * 1000)).runner;
    }
    const out = tick(r, segs, T0 + 240_000);
    // 240 s of elapsed time but only ~995 m of accepted points (the 5 s GPS
    // warm-up discards the first fixes), so pace lands a little over 4:00/km.
    expect(out.closed!.avgPaceSecPerKm).toBeGreaterThan(235);
    expect(out.closed!.avgPaceSecPerKm).toBeLessThan(250);
  });

  it('reports null pace when there is no distance', () => {
    expect(tick(start(createRunner(segs), segs, T0), segs, T0 + 240_000).closed!.avgPaceSecPerKm).toBeNull();
  });
});

describe('runner: sets', () => {
  const segs = runtime(
    workout([
      repeatGroup(2, [
        { id: 'r', type: 'run', length: { kind: 'time', seconds: 60 } },
        { id: 's', type: 'rest', length: { kind: 'time', seconds: 30 } },
      ]),
    ]),
  );

  it('carries set numbers into the results', () => {
    let r = start(createRunner(segs), segs, T0);
    r = tick(r, segs, T0 + 60_000).runner;
    r = tick(r, segs, T0 + 90_000).runner;
    r = tick(r, segs, T0 + 150_000).runner;
    r = tick(r, segs, T0 + 180_000).runner;

    expect(r.results.map((x) => [x.type, x.setNumber])).toEqual([
      ['run', 1],
      ['rest', 1],
      ['run', 2],
      ['rest', 2],
    ]);
  });
});
