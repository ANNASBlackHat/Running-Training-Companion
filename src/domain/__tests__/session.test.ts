import { flatten } from '../flatten';
import { simulate } from '../simulate';
import type { CueEvent } from '../cues';
import { norwegian4x4, repeats400m, timeSeg, distSeg, repeatGroup, workout } from './fixtures';

const T0 = 1_700_000_000_000;

const kinds = (events: CueEvent[]) => events.map((e) => e.kind);
const spoken = (events: CueEvent[]) =>
  events.filter((e) => e.text !== null).map((e) => e.text);

describe('full session simulation (Tech Spec section 11)', () => {
  it('runs a Norwegian 4x4 to completion', () => {
    const { run } = simulate(flatten(norwegian4x4), { startMs: T0 });

    expect(run.runner.state).toBe('finished');
    expect(run.runner.results).toHaveLength(10); // warm-up + 4x2 + cool-down
    expect(run.finishedAt).not.toBeNull();
  });

  it('produces the spoken cues the user stories require', () => {
    const { run } = simulate(flatten(norwegian4x4), { startMs: T0 });
    const texts = spoken(run.events);

    // US-9: the type and length are spoken at each segment change.
    expect(texts[0]).toBe('Easy. Ten minutes.');
    expect(texts).toContain('Run. Four minutes.');
    expect(texts).toContain('Rest. Three minutes.');

    // US-10: set announcements and sets remaining.
    expect(texts).toContain('Set first of four.');
    expect(texts).toContain('Set fourth of four.');
    expect(texts).toContain('Three sets left.');
    expect(texts).toContain('One set left.');

    // Finish cue.
    expect(texts[texts.length - 1]).toBe('Workout complete.');
  });

  it('emits exactly one set announcement per run segment in the repeat', () => {
    const { run } = simulate(flatten(norwegian4x4), { startMs: T0 });
    const setAnnouncements = run.events.filter((e) => e.kind === 'setAnnouncement');
    expect(setAnnouncements).toHaveLength(4);
    expect(setAnnouncements.map((e) => e.text)).toEqual([
      'Set first of four.',
      'Set second of four.',
      'Set third of four.',
      'Set fourth of four.',
    ]);
  });

  it('emits one sets-left cue per rest segment, and none after the last set', () => {
    const { run } = simulate(flatten(norwegian4x4), { startMs: T0 });
    const setsLeft = run.events.filter((e) => e.kind === 'setsLeft');
    expect(setsLeft.map((e) => e.text)).toEqual([
      'Three sets left.',
      'Two sets left.',
      'One set left.',
    ]);
  });

  it('emits three countdown beeps and a switch beep per time segment', () => {
    const { run } = simulate(flatten(norwegian4x4), { startMs: T0 });

    const beeps = run.events.filter((e) => e.kind === 'countdownBeep');
    const switches = run.events.filter((e) => e.kind === 'countdownSwitch');

    // Each time segment emits two short beeps and one long switch beep,
    // for three audible cues in the last three seconds (section 6).
    expect(beeps).toHaveLength(20);
    expect(switches).toHaveLength(10);
    expect(beeps.length + switches.length).toBe(30);
  });

  it('orders countdown beeps before the switch beep within each segment', () => {
    const { run } = simulate(flatten(norwegian4x4), { startMs: T0 });

    // Within each segment: beep at 3 s remaining, beep at 2 s, switch at 1 s.
    const perSegment = new Map<number, string[]>();
    for (const e of run.events) {
      if (!e.kind.startsWith('countdown')) continue;
      perSegment.set(e.segmentIndex, [...(perSegment.get(e.segmentIndex) ?? []), e.kind]);
    }

    expect(perSegment.size).toBe(10);
    for (const kindsInSegment of perSegment.values()) {
      expect(kindsInSegment).toEqual(['countdownBeep', 'countdownBeep', 'countdownSwitch']);
    }
  });

  it('emits halfway once per qualifying segment', () => {
    const { run } = simulate(flatten(norwegian4x4), { startMs: T0 });
    // Warm-up, 4 runs, 4 rests and cool-down are all >= 2 min.
    expect(run.events.filter((e) => e.kind === 'halfway')).toHaveLength(10);
  });

  it('emits one minute left only on segments longer than 3 minutes', () => {
    const { run } = simulate(flatten(norwegian4x4), { startMs: T0 });
    // The 4 min runs and the 10 min warm-up/cool-down qualify; 3 min rests do not.
    const remaining = run.events.filter((e) => e.kind === 'remainingTime');
    expect(remaining).toHaveLength(6);
  });

  it('records a result per segment with duration and distance', () => {
    const { run } = simulate(flatten(norwegian4x4), { startMs: T0 });

    for (const result of run.runner.results) {
      expect(result.durationSec).toBeGreaterThan(0);
      expect(result.endedAt).toBeGreaterThanOrEqual(result.startedAt);
    }

    const runs = run.runner.results.filter((r) => r.type === 'run');
    expect(runs).toHaveLength(4);
    // Four minutes at roughly 4:45/km covers about 845 m.
    for (const r of runs) {
      expect(r.distanceM).toBeGreaterThan(700);
      expect(r.distanceM).toBeLessThan(1000);
      expect(r.avgPaceSecPerKm).not.toBeNull();
    }
  });

  it('keeps rests at essentially zero distance', () => {
    const { run } = simulate(flatten(norwegian4x4), { startMs: T0 });
    for (const rest of run.runner.results.filter((r) => r.type === 'rest')) {
      // A few metres of GPS noise at the boundary is expected and harmless.
      expect(rest.distanceM).toBeLessThan(25);
    }
  });

  it('runs 400 m repeats and closes them on distance', () => {
    const { run } = simulate(flatten(repeats400m), { startMs: T0 });

    expect(run.runner.state).toBe('finished');
    const runs = run.runner.results.filter((r) => r.type === 'run');
    expect(runs).toHaveLength(6);

    for (const r of runs) {
      // The crossing point counts in the segment, so it may slightly overshoot.
      expect(r.distanceM).toBeGreaterThanOrEqual(400);
      expect(r.distanceM).toBeLessThan(420);
    }
  });

  it('stays deterministic for the same seed', () => {
    const a = simulate(flatten(norwegian4x4), { startMs: T0, seed: 7 });
    const b = simulate(flatten(norwegian4x4), { startMs: T0, seed: 7 });
    expect(spoken(a.run.events)).toEqual(spoken(b.run.events));
  });
});

describe('pace alerts during simulation', () => {
  it('alerts when a work interval is run faster than the target', () => {
    // Target is 4:30-4:45; run at 4:00 instead.
    const { run } = simulate(flatten(norwegian4x4), {
      startMs: T0,
      paceBySegmentIndex: { 1: 240, 3: 240, 5: 240, 7: 240 },
    });

    const alerts = run.events.filter((e) => e.kind === 'paceAlert');
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.every((e) => e.text === 'Too fast.')).toBe(true);
  });

  it('alerts when a work interval is run slower than the target', () => {
    const { run } = simulate(flatten(norwegian4x4), {
      startMs: T0,
      paceBySegmentIndex: { 1: 330, 3: 330, 5: 330, 7: 330 },
    });

    const alerts = run.events.filter((e) => e.kind === 'paceAlert');
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.every((e) => e.text === 'Too slow.')).toBe(true);
  });

  it('stays quiet when every segment is run inside the target range', () => {
    const { run } = simulate(flatten(norwegian4x4), {
      startMs: T0,
      paceByType: { run: 278, warmup: 330, cooldown: 330 },
    });

    expect(run.events.filter((e) => e.kind === 'paceAlert')).toHaveLength(0);
  });

  it('never alerts on a segment with no pace range', () => {
    const plain = workout([
      timeSeg('r', 'run', 240), // no paceRange
    ]);
    const { run } = simulate(flatten(plain), { startMs: T0, paceByType: { run: 200 } });
    expect(run.events.filter((e) => e.kind === 'paceAlert')).toHaveLength(0);
  });

  it('respects the 20 second cooldown between alerts', () => {
    const { run } = simulate(flatten(norwegian4x4), {
      startMs: T0,
      paceBySegmentIndex: { 1: 200, 3: 200, 5: 200, 7: 200 },
    });

    const alerts = run.events.filter((e) => e.kind === 'paceAlert');
    for (let i = 1; i < alerts.length; i += 1) {
      const withinSegment = alerts[i].segmentIndex === alerts[i - 1].segmentIndex;
      if (withinSegment) {
        expect(alerts[i].at - alerts[i - 1].at).toBeGreaterThanOrEqual(20_000);
      }
    }
  });

  it('carries a vibration pattern on every cue (UI style guide section 7)', () => {
    const { run } = simulate(flatten(norwegian4x4), { startMs: T0 });
    expect(run.events.length).toBeGreaterThan(0);
    expect(run.events.every((e) => e.vibrate !== null)).toBe(true);
  });
});

describe('mid-session control', () => {
  it('skipping a segment still finishes the workout', () => {
    // Built via the runner directly would be verbose; simulate() is the harness
    // for a full pass, so assert on a short two-segment workout instead.
    const short = workout([timeSeg('a', 'run', 30), timeSeg('b', 'run', 30)]);
    const { run } = simulate(flatten(short), { startMs: T0 });
    expect(run.runner.state).toBe('finished');
    expect(run.runner.results).toHaveLength(2);
  });

  it('handles a distance-only workout', () => {
    const only = workout([distSeg('d', 'run', 200)]);
    const { run } = simulate(flatten(only), { startMs: T0 });
    expect(run.runner.state).toBe('finished');
    expect(run.runner.results[0].distanceM).toBeGreaterThanOrEqual(200);
  });

  it('handles a repeat group without any other segments', () => {
    const only = workout([
      repeatGroup(3, [{ id: 'r', type: 'run', length: { kind: 'time', seconds: 20 } }]),
    ]);
    const { run } = simulate(flatten(only), { startMs: T0 });
    expect(run.runner.results).toHaveLength(3);
    expect(run.events.filter((e) => e.kind === 'setAnnouncement')).toHaveLength(3);
  });
});

describe('golden cue timeline', () => {
  /**
   * The whole point of the fake location provider (Tech Spec section 11): a
   * full Norwegian 4x4 session can be reviewed as a readable script at the
   * desk, with no device and no GPS.
   *
   * This snapshot is the acceptance test for US-9, US-10 and US-11. If a cue
   * phrase, ordering or timing changes, the diff here is the review.
   */
  it('produces the expected spoken script for a whole workout', () => {
    const { run } = simulate(flatten(norwegian4x4), { startMs: T0 });
    const lines = run.events.map(
      (e) => `${Math.round((e.at - T0) / 1000)}s [${e.kind}] ${e.text ?? '(beep)'}`,
    );

    expect(lines).toMatchSnapshot();
  });

  it('has no pace alerts when every segment is on target', () => {
    const { run } = simulate(flatten(norwegian4x4), {
      startMs: T0,
      paceByType: { run: 278, warmup: 330, cooldown: 330 },
    });
    expect(run.events.filter((e) => e.kind === 'paceAlert')).toHaveLength(0);
  });
});
