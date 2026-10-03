import {
  describeLength,
  describePaceRange,
  describeSetCount,
  describeWorkoutTotal,
  isEmptyWorkout,
  makeSegmentItem,
  SEGMENT_LABEL,
} from '../describe';
import {
  applyDraft,
  draftFromSegment,
  draftIsValid,
  lengthFromDraft,
  paceRangeFromDraft,
  parsePace,
  type SegmentDraft,
} from '../segmentDraft';
import { TEMPLATE_400M, TEMPLATE_NORWEGIAN_4X4 } from '../templates';
import type { Segment, Workout } from '../types';

const seg = (over: Partial<Segment> = {}): Segment => ({
  id: 's1',
  type: 'run',
  length: { kind: 'time', seconds: 240 },
  ...over,
});

const workout = (items: Workout['items']): Workout => ({
  id: 'w',
  name: 'Test',
  isTemplate: false,
  items,
});

describe('describeLength', () => {
  it('renders whole minutes', () => {
    expect(describeLength({ kind: 'time', seconds: 240 })).toBe('4 min');
    expect(describeLength({ kind: 'time', seconds: 600 })).toBe('10 min');
  });

  it('renders seconds under a minute', () => {
    expect(describeLength({ kind: 'time', seconds: 45 })).toBe('45 s');
  });

  it('renders a clock when seconds are present', () => {
    expect(describeLength({ kind: 'time', seconds: 90 })).toBe('1:30');
  });

  it('renders distance', () => {
    expect(describeLength({ kind: 'distance', meters: 400 })).toBe('400 m');
    expect(describeLength({ kind: 'distance', meters: 1840 })).toBe('1.84 km');
  });
});

describe('describeWorkoutTotal (UI section 6, Home)', () => {
  it('totals a time-based workout', () => {
    expect(describeWorkoutTotal(TEMPLATE_NORWEGIAN_4X4)).toBe('48:00');
  });

  it('reports both time and distance for the 400 m template', () => {
    // The 400 m template mixes distance runs with a time warm-up, cooldown and
    // rests, so the caption shows both rather than picking one.
    expect(describeWorkoutTotal(TEMPLATE_400M)).toBe('29:00 · 2.40 km');
  });

  it('reports both for a mixed workout', () => {
    const mixed = workout([
      { kind: 'segment', segment: seg({ length: { kind: 'time', seconds: 600 } }) },
      { kind: 'segment', segment: seg({ length: { kind: 'distance', meters: 400 } }) },
    ]);
    expect(describeWorkoutTotal(mixed)).toBe('10:00 · 400 m');
  });

  it('counts repeated sets in the total', () => {
    // 4 x (240 + 180) s.
    const one = workout([
      {
        kind: 'repeat',
        count: 4,
        segments: [
          seg({ id: 'r' }),
          seg({ id: 's', type: 'rest', length: { kind: 'time', seconds: 180 } }),
        ],
      },
    ]);
    expect(describeWorkoutTotal(one)).toBe('28:00');
  });

  it('says Empty for a workout with no segments', () => {
    expect(describeWorkoutTotal(workout([]))).toBe('Empty');
    expect(isEmptyWorkout(workout([]))).toBe(true);
  });

  it('reports the set count', () => {
    expect(describeSetCount(TEMPLATE_NORWEGIAN_4X4)).toBe(4);
    expect(describeSetCount(workout([]))).toBeNull();
  });
});

describe('describePaceRange (US-3)', () => {
  it('formats a range', () => {
    expect(describePaceRange(seg({ paceRange: { fastSecPerKm: 270, slowSecPerKm: 285 } }))).toBe(
      '4:30 to 4:45 /km',
    );
  });

  it('is null when the segment has no range', () => {
    expect(describePaceRange(seg())).toBeNull();
  });
});

describe('SEGMENT_LABEL', () => {
  it('names every segment type', () => {
    expect(Object.keys(SEGMENT_LABEL).sort()).toEqual(['cooldown', 'rest', 'run', 'warmup']);
  });
});

describe('parsePace', () => {
  it('reads min:sec', () => {
    expect(parsePace('4:30')).toBe(270);
    expect(parsePace('4:45')).toBe(285);
  });

  it('reads bare minutes', () => {
    expect(parsePace('5')).toBe(300);
  });

  it('rejects unusable input', () => {
    expect(parsePace('')).toBeNull();
    expect(parsePace('abc')).toBeNull();
    expect(parsePace('4:99')).toBeNull();
    expect(parsePace('0')).toBeNull();
  });
});

describe('draftFromSegment', () => {
  it('round-trips a time segment', () => {
    const original = seg({ length: { kind: 'time', seconds: 240 } });
    const draft = draftFromSegment(original);
    expect(draft.mode).toBe('time');
    expect(draft.minutes).toBe('4');
    expect(draft.seconds).toBe('');
    expect(applyDraft(original, draft)?.length).toEqual({ kind: 'time', seconds: 240 });
  });

  it('round-trips a distance segment', () => {
    const original = seg({ length: { kind: 'distance', meters: 400 } });
    const draft = draftFromSegment(original);
    expect(draft.mode).toBe('distance');
    expect(draft.meters).toBe('400');
    expect(applyDraft(original, draft)?.length).toEqual({ kind: 'distance', meters: 400 });
  });

  it('round-trips a pace range from the US-3 example', () => {
    const original = seg({ paceRange: { fastSecPerKm: 270, slowSecPerKm: 285 } });
    const draft = draftFromSegment(original);
    expect(draft.hasPace).toBe(true);
    expect(draft.paceFrom).toBe('4:30');
    expect(draft.paceTo).toBe('4:45');
    expect(applyDraft(original, draft)?.paceRange).toEqual({ fastSecPerKm: 270, slowSecPerKm: 285 });
  });

  it('keeps seconds when the duration has them', () => {
    const draft = draftFromSegment(seg({ length: { kind: 'time', seconds: 90 } }));
    expect(draft.minutes).toBe('1');
    expect(draft.seconds).toBe('30');
  });
});

describe('lengthFromDraft', () => {
  const base: SegmentDraft = {
    type: 'run',
    mode: 'time',
    minutes: '4',
    seconds: '',
    meters: '',
    hasPace: false,
    paceFrom: '',
    paceTo: '',
  };

  it('builds minutes', () => {
    expect(lengthFromDraft(base)).toEqual({ kind: 'time', seconds: 240 });
  });

  it('adds seconds', () => {
    expect(lengthFromDraft({ ...base, seconds: '30' })).toEqual({ kind: 'time', seconds: 270 });
  });

  it('builds distance', () => {
    expect(
      lengthFromDraft({ ...base, mode: 'distance', meters: '400' }),
    ).toEqual({ kind: 'distance', meters: 400 });
  });

  it('rejects empty and zero values', () => {
    expect(lengthFromDraft({ ...base, minutes: '' })).toBeNull();
    expect(lengthFromDraft({ ...base, minutes: '0' })).toBeNull();
    expect(lengthFromDraft({ ...base, mode: 'distance', meters: '' })).toBeNull();
    expect(lengthFromDraft({ ...base, mode: 'distance', meters: '0' })).toBeNull();
  });

  it('rejects invalid seconds', () => {
    expect(lengthFromDraft({ ...base, seconds: '75' })).toBeNull();
  });

  it('reports validity for the Apply button', () => {
    expect(draftIsValid(base)).toBe(true);
    expect(draftIsValid({ ...base, minutes: '' })).toBe(false);
  });
});

describe('paceRangeFromDraft', () => {
  const base: SegmentDraft = {
    type: 'run',
    mode: 'time',
    minutes: '4',
    seconds: '',
    meters: '',
    hasPace: true,
    paceFrom: '4:30',
    paceTo: '4:45',
  };

  it('builds a range', () => {
    expect(paceRangeFromDraft(base)).toEqual({ fastSecPerKm: 270, slowSecPerKm: 285 });
  });

  it('normalises reversed input so fast is always smaller', () => {
    expect(paceRangeFromDraft({ ...base, paceFrom: '4:45', paceTo: '4:30' })).toEqual({
      fastSecPerKm: 270,
      slowSecPerKm: 285,
    });
  });

  it('is null when the toggle is off (US-3: no range, no alerts)', () => {
    expect(paceRangeFromDraft({ ...base, hasPace: false })).toBeNull();
  });

  it('is null when a bound is unusable', () => {
    expect(paceRangeFromDraft({ ...base, paceTo: '' })).toBeNull();
  });
});

describe('applyDraft', () => {
  it('keeps the segment id so the builder can find it', () => {
    const original = seg({ id: 'keep-me' });
    const draft = draftFromSegment(original);
    expect(applyDraft(original, draft)?.id).toBe('keep-me');
  });

  it('changes the type', () => {
    const original = seg();
    const draft = { ...draftFromSegment(original), type: 'rest' as const };
    expect(applyDraft(original, draft)?.type).toBe('rest');
  });

  it('clears the pace range when the toggle goes off', () => {
    const original = seg({ paceRange: { fastSecPerKm: 270, slowSecPerKm: 285 } });
    const draft = { ...draftFromSegment(original), hasPace: false };
    expect(applyDraft(original, draft)?.paceRange).toBeUndefined();
  });

  it('returns null when the length is unusable', () => {
    const original = seg();
    const draft = { ...draftFromSegment(original), minutes: '' };
    expect(applyDraft(original, draft)).toBeNull();
  });
});

describe('makeSegmentItem', () => {
  it('gives each new segment a unique id', () => {
    const a = makeSegmentItem('run', { kind: 'time', seconds: 60 });
    const b = makeSegmentItem('run', { kind: 'time', seconds: 60 });
    const idA = a.kind === 'segment' ? a.segment.id : '';
    const idB = b.kind === 'segment' ? b.segment.id : '';
    expect(idA).not.toBe(idB);
  });
});
