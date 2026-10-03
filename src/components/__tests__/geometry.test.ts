import { flatten } from '@/domain/flatten';
import { norwegian, RANGE, TIME_SEG } from './fixtures';
import {
  blockFractions,
  buildBlocks,
  DEFAULT_PACE_SEC_PER_KM,
  estimateSegmentSec,
  needsOutline,
} from '../stripGeometry';
import {
  alertDirection,
  LANE_MARGIN_SEC,
  laneGeometry,
  markerIsAlert,
  markerPosition,
} from '../paceLaneGeometry';

describe('session strip geometry (UI guide section 5)', () => {
  it('uses the real duration for a time segment', () => {
    const [seg] = flatten({ ...norwegian(), items: [TIME_SEG('a', 'run', 240)] });
    expect(estimateSegmentSec(seg)).toBe(240);
  });

  it('estimates a distance segment from its target pace', () => {
    const [seg] = flatten({
      ...norwegian(),
      items: [
        { kind: 'segment', segment: { id: 'd', type: 'run', length: { kind: 'distance', meters: 1000 }, paceRange: RANGE } },
      ],
    });
    // 1 km at the fast bound, 4:30/km.
    expect(estimateSegmentSec(seg)).toBeCloseTo(270, 0);
  });

  it('falls back to 5:30 per km when a distance segment has no target', () => {
    const [seg] = flatten({
      ...norwegian(),
      items: [{ kind: 'segment', segment: { id: 'd', type: 'run', length: { kind: 'distance', meters: 1000 } } }],
    });
    expect(DEFAULT_PACE_SEC_PER_KM).toBe(330);
    expect(estimateSegmentSec(seg)).toBeCloseTo(330, 0);
  });

  it('makes block widths proportional to duration and summing to one', () => {
    const segments = flatten(
      norwegian({
        items: [TIME_SEG('w', 'warmup', 60), TIME_SEG('r', 'run', 180), TIME_SEG('c', 'cooldown', 60)],
      }),
    );
    const fractions = blockFractions(buildBlocks(segments));

    expect(fractions).toHaveLength(3);
    expect(fractions.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    // 60:180:60
    expect(fractions[0]).toBeCloseTo(0.2, 6);
    expect(fractions[1]).toBeCloseTo(0.6, 6);
    expect(fractions[2]).toBeCloseTo(0.2, 6);
  });

  it('gives a longer segment a wider block', () => {
    const segments = flatten(
      norwegian({ items: [TIME_SEG('a', 'run', 60), TIME_SEG('b', 'run', 300)] }),
    );
    const [first, second] = blockFractions(buildBlocks(segments));
    expect(second).toBeGreaterThan(first);
  });

  it('outlines rest blocks only (section 5)', () => {
    expect(needsOutline('rest')).toBe(true);
    expect(needsOutline('run')).toBe(false);
    expect(needsOutline('warmup')).toBe(false);
    expect(needsOutline('cooldown')).toBe(false);
  });

  it('survives an empty workout', () => {
    expect(buildBlocks([])).toEqual([]);
    expect(blockFractions([])).toEqual([]);
  });
});

describe('pace lane geometry (UI guide section 5)', () => {
  it('extends the target range by the margin on both sides', () => {
    const g = laneGeometry(RANGE); // 4:30 to 4:45 -> 270..285
    expect(LANE_MARGIN_SEC).toBe(30);
    // The 4:30-4:45 target is only 15 s/km wide, so the lane widens the margin
    // to match; the band must always have room to sit inside the lane.
    const span = RANGE.slowSecPerKm - RANGE.fastSecPerKm;
    const margin = Math.max(LANE_MARGIN_SEC, span);
    expect(g.minSecPerKm).toBe(270 - margin); // fastest shown
    expect(g.maxSecPerKm).toBe(285 + margin); // slowest shown
    expect(g.maxSecPerKm).toBeGreaterThan(g.minSecPerKm);
  });

  it('widens the margin for a wide target so the band never fills the lane', () => {
    const wide = { fastSecPerKm: 240, slowSecPerKm: 360 }; // 120 s/km wide
    const g = laneGeometry(wide);

    // A 30 s margin would be narrower than the 120 s/km target, leaving the
    // band flush against the lane edge. The margin widens to the target span.
    const span = wide.slowSecPerKm - wide.fastSecPerKm;
    expect(span).toBeGreaterThan(LANE_MARGIN_SEC);
    expect(g.minSecPerKm).toBe(wide.fastSecPerKm - span);
    expect(g.maxSecPerKm).toBe(wide.slowSecPerKm + span);

    // The band must sit strictly inside the lane on both sides.
    expect(g.bandStart).toBeGreaterThan(0);
    expect(g.bandEnd).toBeLessThan(1);
  });

  it('centres the target band in the lane', () => {
    const g = laneGeometry(RANGE);
    expect((g.bandStart + g.bandEnd) / 2).toBeCloseTo(0.5, 6);
    // The fast bound sits to the right of the slow bound.
    expect(g.bandStart).toBeGreaterThan(g.bandEnd);
  });

  it('puts faster pace to the right and slower to the left', () => {
    const g = laneGeometry(RANGE);
    const fast = markerPosition(250, g)!;
    const target = markerPosition(277, g)!;
    const slow = markerPosition(310, g)!;

    expect(fast).toBeGreaterThan(target);
    expect(target).toBeGreaterThan(slow);
  });

  it('places the exact target bounds at the band edges', () => {
    const g = laneGeometry(RANGE);
    // The fast bound (smaller number) is the right edge of the band.
    expect(markerPosition(RANGE.fastSecPerKm, g)).toBeCloseTo(g.bandStart, 6);
    expect(markerPosition(RANGE.slowSecPerKm, g)).toBeCloseTo(g.bandEnd, 6);
  });

  it('returns null when there is no pace, for the dashed marker', () => {
    expect(markerPosition(null, laneGeometry(RANGE))).toBeNull();
  });

  it('clamps an outlier to the lane edge instead of hiding it', () => {
    const g = laneGeometry(RANGE);
    expect(markerPosition(60, g)).toBe(1);
    expect(markerPosition(9999, g)).toBe(0);
  });

  it('flags out-of-range statuses for the alert marker', () => {
    expect(markerIsAlert('tooFast')).toBe(true);
    expect(markerIsAlert('tooSlow')).toBe(true);
    expect(markerIsAlert('in')).toBe(false);
    expect(markerIsAlert('unknown')).toBe(false);
    expect(markerIsAlert('noTarget')).toBe(false);
  });

  it('points the arrow the way the runner must correct', () => {
    expect(alertDirection('tooFast')).toBe('left');
    expect(alertDirection('tooSlow')).toBe('right');
    expect(alertDirection('in')).toBeNull();
  });

  it('falls back to a generic window with no target range', () => {
    const g = laneGeometry(undefined);
    expect(g.bandStart).toBe(0);
    expect(g.bandEnd).toBe(1);
  });
});
