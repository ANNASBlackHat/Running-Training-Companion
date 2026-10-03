import {
  createCueFlags,
  createPaceAlertState,
  msToNextCountdown,
  onFinish,
  onSegmentEndCue,
  onSegmentStart,
  onTickCues,
  paceAlertCue,
  PACE_CONTINUOUS_SEC,
  PACE_GRACE_SEC,
  remainingDistancePhrase,
  segmentStartPhrase,
  setAnnouncementPhrase,
  setsLeftPhrase,
} from '../cues';
import type { RuntimeSegment, TrackPoint } from '../types';
import { flatten } from '../flatten';
import { distSeg, repeatGroup, timeSeg, workout } from './fixtures';

const T0 = 1_700_000_000_000;
const M_PER_DEG_LAT = 111_195;
const RANGE = { fastSecPerKm: 270, slowSecPerKm: 285 };

const run = (items: Parameters<typeof workout>[0]): RuntimeSegment[] =>
  flatten(workout(items));

/** Constant-speed points covering the last `seconds` before `atSec`. */
function trackEndingAt(atSec: number, seconds: number, secPerKm: number): TrackPoint[] {
  const speed = 1000 / secPerKm;
  const points: TrackPoint[] = [];
  for (let s = atSec - seconds; s <= atSec; s += 1) {
    points.push({
      t: T0 + s * 1000,
      lat: ((s - (atSec - seconds)) * speed) / M_PER_DEG_LAT,
      lon: -0.1278,
      acc: 5,
    });
  }
  return points;
}

describe('cue phrases (section 6 cue table)', () => {
  it('announces run, rest and easy segments with their length', () => {
    expect(segmentStartPhrase(run([timeSeg('r', 'run', 240)])[0])).toBe('Run. Four minutes.');
    expect(segmentStartPhrase(run([timeSeg('s', 'rest', 180)])[0])).toBe('Rest. Three minutes.');
    expect(segmentStartPhrase(run([timeSeg('w', 'warmup', 600)])[0])).toBe('Easy. Ten minutes.');
    expect(segmentStartPhrase(run([distSeg('d', 'run', 400)])[0])).toBe('Run. Four hundred meters.');
  });

  it('announces the set number', () => {
    const segs = run([
      repeatGroup(4, [
        { id: 'r', type: 'run', length: { kind: 'time', seconds: 240 } },
        { id: 's', type: 'rest', length: { kind: 'time', seconds: 180 } },
      ]),
    ]);
    expect(setAnnouncementPhrase(segs[0])).toBe('Set first of four.');
    expect(setAnnouncementPhrase(segs[2])).toBe('Set second of four.');
  });

  it('announces sets remaining after a rest', () => {
    const segs = run([
      repeatGroup(4, [
        { id: 'r', type: 'run', length: { kind: 'time', seconds: 240 } },
        { id: 's', type: 'rest', length: { kind: 'time', seconds: 180 } },
      ]),
    ]);
    const restOf = (n: number) => segs.find((s) => s.segment.id === 's' && s.setNumber === n)!;
    expect(setsLeftPhrase(restOf(1))).toBe('Three sets left.');
    expect(setsLeftPhrase(restOf(3))).toBe('One set left.');
    // After the final rest there is nothing left to announce.
    expect(onSegmentEndCue(restOf(4), T0)).toBeNull();
  });

  it('says "One hundred left." for a distance segment', () => {
    expect(remainingDistancePhrase(100)).toBe('One hundred left.');
  });

  it('emits the finish cue', () => {
    expect(onFinish(9, T0).text).toBe('Workout complete.');
  });
});

describe('onSegmentStart', () => {
  it('marks the segment start as high priority', () => {
    const [event] = onSegmentStart(run([timeSeg('r', 'run', 240)])[0], T0);
    expect(event.kind).toBe('segmentStart');
    expect(event.priority).toBe('high');
  });

  it('adds a set announcement only for runs inside a repeat', () => {
    const segs = run([
      timeSeg('w', 'warmup', 60),
      repeatGroup(2, [
        { id: 'r', type: 'run', length: { kind: 'time', seconds: 60 } },
        { id: 's', type: 'rest', length: { kind: 'time', seconds: 30 } },
      ]),
    ]);

    expect(onSegmentStart(segs[0], T0).map((e) => e.kind)).toEqual(['segmentStart']);
    expect(onSegmentStart(segs[1], T0).map((e) => e.kind)).toEqual([
      'segmentStart',
      'setAnnouncement',
    ]);
    expect(onSegmentStart(segs[2], T0).map((e) => e.kind)).toEqual(['segmentStart']);
  });
});

describe('onTickCues: countdown', () => {
  const seg = run([timeSeg('r', 'run', 240)])[0];

  it('emits three beeps then a long switch beep, each exactly once', () => {
    const flags = createCueFlags();
    const kinds: string[] = [];

    for (let remaining = 240; remaining > 0; remaining -= 1) {
      const elapsed = 240 - remaining;
      const events = onTickCues(seg, flags, remaining, null, elapsed, T0 + elapsed * 1000);
      kinds.push(...events.map((e) => e.kind));
    }

    expect(kinds.filter((k) => k.startsWith('countdown'))).toEqual([
      'countdownBeep',
      'countdownBeep',
      'countdownSwitch',
    ]);
  });

  it('does not repeat a beep if the same remaining value is seen twice', () => {
    const flags = createCueFlags();
    const countdowns = (events: { kind: string }[]) =>
      events.filter((e) => e.kind.startsWith('countdown'));

    const first = onTickCues(seg, flags, 3, null, 237, T0 + 237_000);
    const second = onTickCues(seg, flags, 3, null, 237, T0 + 238_000);
    expect(countdowns(first)).toHaveLength(1);
    expect(countdowns(second)).toHaveLength(0);
  });

  it('emits no countdown for a distance segment', () => {
    const dseg = run([distSeg('d', 'run', 400)])[0];
    const flags = createCueFlags();
    expect(onTickCues(dseg, flags, null, 398, 0, T0)).toEqual([]);
  });
});

describe('onTickCues: halfway and remaining', () => {
  it('emits halfway once for a segment of 2 minutes or longer', () => {
    const seg = run([timeSeg('r', 'run', 240)])[0];
    const flags = createCueFlags();

    expect(onTickCues(seg, flags, 130, null, 110, T0).map((e) => e.kind)).not.toContain(
      'halfway',
    );

    expect(onTickCues(seg, flags, 118, null, 122, T0).map((e) => e.kind)).toContain('halfway');
    expect(onTickCues(seg, flags, 100, null, 140, T0).map((e) => e.kind)).not.toContain('halfway');
  });

  it('skips halfway for a short segment', () => {
    const seg = run([timeSeg('s', 'rest', 90)])[0];
    const flags = createCueFlags();
    expect(onTickCues(seg, flags, 45, null, 45, T0).map((e) => e.kind)).not.toContain('halfway');
  });

  it('emits halfway for a 400 m distance segment', () => {
    const seg = run([distSeg('d', 'run', 400)])[0];
    const flags = createCueFlags();
    expect(onTickCues(seg, flags, null, 195, 0, T0).map((e) => e.kind)).toContain('halfway');
  });

  it('emits one minute left only on segments over 3 minutes, once', () => {
    const seg = run([timeSeg('r', 'run', 240)])[0];
    const flags = createCueFlags();

    const kinds = (e: { kind: string }[]) => e.map((x) => x.kind);
    expect(kinds(onTickCues(seg, flags, 61, null, 179, T0))).not.toContain('remainingTime');
    expect(kinds(onTickCues(seg, flags, 59, null, 181, T0))).toContain('remainingTime');
    expect(kinds(onTickCues(seg, flags, 30, null, 210, T0))).not.toContain('remainingTime');
  });

  it('does not emit one minute left on a 3 minute segment', () => {
    const seg = run([timeSeg('s', 'rest', 180)])[0];
    const flags = createCueFlags();
    expect(onTickCues(seg, flags, 60, null, 120, T0).map((e) => e.kind)).not.toContain(
      'remainingTime',
    );
  });

  it('emits the distance remaining cue on segments over 400 m', () => {
    const seg = run([distSeg('d', 'run', 800)])[0];
    const flags = createCueFlags();
    const events = onTickCues(seg, flags, null, 98, 0, T0);
    expect(events.filter((e) => e.kind === 'remainingDistance').map((e) => e.text)).toEqual([
      'Ninety-eight left.',
    ]);
  });
});

describe('pace alert rules (section 6)', () => {
  const seg = run([timeSeg('r', 'run', 240, RANGE)])[0];

  it('never alerts when the segment has no pace range', () => {
    const noTarget = run([timeSeg('r', 'run', 240)])[0];
    const state = createPaceAlertState();
    const points = trackEndingAt(60, 12, 200); // clearly too fast

    for (let s = 20; s <= 60; s += 1) {
      const out = paceAlertCue(noTarget, trackEndingAt(s, 12, 200), state, s, T0 + s * 1000, 1000);
      expect(out.cue).toBeNull();
    }
    expect(points.length).toBeGreaterThan(0);
  });

  it('does not alert in the first 15 s of a segment', () => {
    const state = createPaceAlertState();
    const out = paceAlertCue(
      seg,
      trackEndingAt(14, 12, 200),
      state,
      14,
      T0 + 14_000,
      1000,
    );
    expect(out.cue).toBeNull();
    expect(out.state.outOfRangeMs).toBe(0);
  });

  it('does not alert until out of range for 5 continuous seconds', () => {
    let state = createPaceAlertState();
    const at = 30;

    // 4 s out of range is not enough.
    let out = paceAlertCue(seg, trackEndingAt(at, 12, 200), state, at, T0 + at * 1000, 4000);
    expect(out.cue).toBeNull();
    state = out.state;

    // The 5th second triggers the alert.
    out = paceAlertCue(seg, trackEndingAt(at + 1, 12, 200), state, at + 1, T0 + (at + 1) * 1000, 1000);
    expect(out.cue?.text).toBe('Too fast.');
  });

  it('resets the counter when the pace returns to the range', () => {
    let state = createPaceAlertState();
    const at = 30;

    state = paceAlertCue(seg, trackEndingAt(at, 12, 200), state, at, T0 + at * 1000, 4000).state;
    // Back in range for a moment.
    state = paceAlertCue(seg, trackEndingAt(at + 1, 12, 278), state, at + 1, T0 + (at + 1) * 1000, 1000).state;
    expect(state.outOfRangeMs).toBe(0);

    // Starting again from zero needs the full 5 s.
    const out = paceAlertCue(seg, trackEndingAt(at + 2, 12, 200), state, at + 2, T0 + (at + 2) * 1000, 1000);
    expect(out.cue).toBeNull();
  });

  it('says "Too slow." when below the range', () => {
    let state = createPaceAlertState();
    const at = 30;
    state = paceAlertCue(seg, trackEndingAt(at, 12, 340), state, at, T0 + at * 1000, 4000).state;
    const out = paceAlertCue(seg, trackEndingAt(at + 1, 12, 340), state, at + 1, T0 + (at + 1) * 1000, 1000);
    expect(out.cue?.text).toBe('Too slow.');
  });

  it('emits at most one alert every 20 seconds', () => {
    let state = createPaceAlertState();
    const alerts: number[] = [];

    for (let s = 20; s <= 120; s += 1) {
      const out = paceAlertCue(seg, trackEndingAt(s, 12, 200), state, s, T0 + s * 1000, 1000);
      state = out.state;
      if (out.cue) alerts.push(s);
    }

    expect(alerts.length).toBeGreaterThan(0);
    for (let i = 1; i < alerts.length; i += 1) {
      expect(alerts[i] - alerts[i - 1]).toBeGreaterThanOrEqual(20);
    }
  });

  it('does not alert when a high-priority cue is due within 2 seconds', () => {
    let state = createPaceAlertState();
    const at = 30;
    state = paceAlertCue(seg, trackEndingAt(at, 12, 200), state, at, T0 + at * 1000, 4000).state;

    const out = paceAlertCue(
      seg,
      trackEndingAt(at + 1, 12, 200),
      state,
      at + 1,
      T0 + (at + 1) * 1000,
      1000,
      1500,
    );
    expect(out.cue).toBeNull();
  });

  it('does not alert when the runner is standing still', () => {
    let state = createPaceAlertState();
    const still: TrackPoint[] = Array.from({ length: 12 }, (_, i) => ({
      t: T0 + (30 + i) * 1000,
      lat: 51.5,
      lon: -0.1278,
      acc: 5,
    }));

    for (let s = 20; s <= 60; s += 1) {
      const out = paceAlertCue(seg, still, state, s, T0 + s * 1000, 1000);
      state = out.state;
      expect(out.cue).toBeNull();
    }
  });

  it('uses the documented thresholds', () => {
    expect(PACE_GRACE_SEC).toBe(15);
    expect(PACE_CONTINUOUS_SEC).toBe(5);
  });
});

describe('msToNextCountdown', () => {
  it('reports time until the countdown begins', () => {
    expect(msToNextCountdown(10)).toBe(7000);
    expect(msToNextCountdown(3)).toBe(0);
    expect(msToNextCountdown(null)).toBe(Number.POSITIVE_INFINITY);
  });
});
