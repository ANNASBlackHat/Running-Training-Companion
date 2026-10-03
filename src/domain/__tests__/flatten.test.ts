import { flatten, isSetRun, setsRemainingAfter, totalSegments } from '../flatten';
import type { Segment, Workout, WorkoutItem } from '../types';

const seg = (id: string, type: Segment['type'], seconds: number): Segment => ({
  id,
  type,
  length: { kind: 'time', seconds },
});

const timeSeg = (id: string, type: Segment['type'], seconds: number): Segment =>
  seg(id, type, seconds);

const distSeg = (id: string, type: Segment['type'], meters: number): Segment => ({
  id,
  type,
  length: { kind: 'distance', meters },
});

const workout = (items: WorkoutItem[]): Workout => ({
  id: 'w1',
  name: 'Test',
  isTemplate: false,
  items,
});

describe('flatten', () => {
  it('expands a bare segment with no set fields', () => {
    const out = flatten(workout([{ kind: 'segment', segment: timeSeg('a', 'run', 240) }]));
    expect(out).toHaveLength(1);
    expect(out[0].index).toBe(0);
    expect(out[0].setNumber).toBeUndefined();
    expect(out[0].setTotal).toBeUndefined();
  });

  it('expands a repeat group in order with 1-based set numbers', () => {
    const out = flatten(
      workout([
        {
          kind: 'repeat',
          count: 3,
          segments: [timeSeg('r', 'run', 240), timeSeg('s', 'rest', 180)],
        },
      ]),
    );

    expect(out).toHaveLength(6);
    expect(out.map((s) => `${s.segment.type}${s.setNumber}`)).toEqual([
      'run1',
      'rest1',
      'run2',
      'rest2',
      'run3',
      'rest3',
    ]);
    expect(out.every((s) => s.setTotal === 3)).toBe(true);
  });

  it('assigns contiguous indices across a whole workout', () => {
    const out = flatten(
      workout([
        { kind: 'segment', segment: timeSeg('w', 'warmup', 600) },
        {
          kind: 'repeat',
          count: 2,
          segments: [timeSeg('r', 'run', 240), timeSeg('s', 'rest', 180)],
        },
        { kind: 'segment', segment: timeSeg('c', 'cooldown', 600) },
      ]),
    );

    expect(out).toHaveLength(6);
    expect(out.map((s) => s.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(out[0].setNumber).toBeUndefined();
    expect(out[5].setNumber).toBeUndefined();
  });

  it('returns an empty list for an empty workout', () => {
    expect(flatten(workout([]))).toEqual([]);
    expect(totalSegments(workout([]))).toBe(0);
  });

  it('treats a repeat count below one as an empty group', () => {
    const out = flatten(
      workout([{ kind: 'repeat', count: 0, segments: [timeSeg('r', 'run', 240)] }]),
    );
    expect(out).toEqual([]);
  });

  it('preserves distance segments', () => {
    const out = flatten(workout([{ kind: 'segment', segment: distSeg('d', 'run', 400) }]));
    expect(out[0].segment.length).toEqual({ kind: 'distance', meters: 400 });
  });

  it('handles distance segments inside a repeat (400 m repeats)', () => {
    const out = flatten(
      workout([
        {
          kind: 'repeat',
          count: 4,
          segments: [distSeg('d', 'run', 400), timeSeg('j', 'rest', 90)],
        },
      ]),
    );
    expect(out).toHaveLength(8);
    expect(out.filter((s) => s.segment.type === 'run')).toHaveLength(4);
  });
});

describe('setsRemainingAfter', () => {
  it('counts down through a repeat group', () => {
    const out = flatten(
      workout([
        {
          kind: 'repeat',
          count: 4,
          segments: [timeSeg('r', 'run', 240), timeSeg('s', 'rest', 180)],
        },
      ]),
    );

    const restOf = (setNumber: number) =>
      setsRemainingAfter(out.find((s) => s.segment.id === 's' && s.setNumber === setNumber)!);

    expect(restOf(1)).toBe(3);
    expect(restOf(2)).toBe(2);
    expect(restOf(3)).toBe(1);
    expect(restOf(4)).toBe(0);
  });

  it('returns zero for a segment outside a repeat', () => {
    const out = flatten(workout([{ kind: 'segment', segment: timeSeg('w', 'warmup', 600) }]));
    expect(setsRemainingAfter(out[0])).toBe(0);
  });
});

describe('isSetRun', () => {
  it('is true only for run segments inside a repeat', () => {
    const out = flatten(
      workout([
        { kind: 'segment', segment: timeSeg('w', 'warmup', 600) },
        {
          kind: 'repeat',
          count: 2,
          segments: [timeSeg('r', 'run', 240), timeSeg('s', 'rest', 180)],
        },
      ]),
    );

    expect(out.some(isSetRun)).toBe(true);
    expect(isSetRun(out[0])).toBe(false); // warm-up
    expect(isSetRun(out.find((s) => s.segment.id === 's')!)).toBe(false); // rest
  });
});