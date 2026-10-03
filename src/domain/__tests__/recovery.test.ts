import {
  describeSnapshot,
  isRecoverable,
  recoverSession,
  type InProgressSnapshot,
} from '../recovery';
import { TEMPLATE_NORWEGIAN_4X4 } from '../templates';
import type { SegmentResult } from '../types';

const T0 = 1_700_000_000_000;

const seg = (over: Partial<SegmentResult> = {}): SegmentResult => ({
  index: 0,
  type: 'warmup',
  startedAt: T0,
  endedAt: T0 + 600_000,
  durationSec: 600,
  distanceM: 2000,
  avgPaceSecPerKm: 300,
  ...over,
});

const snapshot = (over: Partial<InProgressSnapshot> = {}): InProgressSnapshot => ({
  workoutId: TEMPLATE_NORWEGIAN_4X4.id,
  savedAt: T0 + 600_000,
  results: [seg()],
  track: [],
  ...over,
});

describe('isRecoverable (section 8)', () => {
  it('rejects a missing snapshot', () => {
    expect(isRecoverable(null)).toBe(false);
  });

  it('rejects an empty one, since nothing would be kept', () => {
    expect(isRecoverable(snapshot({ results: [] }))).toBe(false);
  });

  it('accepts a snapshot with recorded segments', () => {
    expect(isRecoverable(snapshot())).toBe(true);
  });
});

describe('describeSnapshot', () => {
  it('summarises segments and distance', () => {
    expect(describeSnapshot(snapshot())).toBe('1 segment, 2.00 km');
  });

  it('pluralises segments', () => {
    const many = snapshot({ results: [seg(), seg({ index: 1 }), seg({ index: 2 })] });
    expect(describeSnapshot(many)).toBe('3 segments, 6.00 km');
  });

  it('reports short distances in meters', () => {
    expect(describeSnapshot(snapshot({ results: [seg({ distanceM: 400 })] }))).toBe(
      '1 segment, 400 m',
    );
  });
});

describe('recoverSession', () => {
  it('turns a snapshot into a real session', () => {
    const session = recoverSession(snapshot(), TEMPLATE_NORWEGIAN_4X4, 'recovered-1');

    expect(session.id).toBe('recovered-1');
    expect(session.workoutId).toBe(TEMPLATE_NORWEGIAN_4X4.id);
    expect(session.results).toHaveLength(1);
    expect(session.totals.durationSec).toBe(600);
  });

  it('uses the snapshot timestamp as the end time', () => {
    const session = recoverSession(snapshot({ savedAt: T0 + 999_000 }), TEMPLATE_NORWEGIAN_4X4, 'r');
    expect(session.endedAt).toBe(T0 + 999_000);
  });

  it('copies the workout so later edits cannot rewrite history', () => {
    const session = recoverSession(snapshot(), TEMPLATE_NORWEGIAN_4X4, 'r');
    session.workoutSnapshot.name = 'Renamed later';
    expect(TEMPLATE_NORWEGIAN_4X4.name).toBe('Norwegian 4x4');
  });

  it('recomputes per-km splits for a recovered warm-up', () => {
    // A 3 km track at 5:00/km inside the warm-up window.
    const points = Array.from({ length: 901 }, (_, s) => ({
      t: T0 + (s + 1) * 1000,
      lat: (s * (1000 / 300)) / 111_195,
      lon: -0.1278,
      acc: 5,
    }));

    const session = recoverSession(
      snapshot({ results: [seg({ startedAt: T0, endedAt: T0 + 900_000 })], track: points }),
      TEMPLATE_NORWEGIAN_4X4,
      'r',
    );

    expect(session.results[0].kmSplits?.length).toBe(3);
  });
});
