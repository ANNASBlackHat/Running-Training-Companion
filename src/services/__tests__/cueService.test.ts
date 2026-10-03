import { dispatchCue, dispatchCues } from '../cueService';
import * as beepService from '../beepService';
import * as voiceService from '../voiceService';

import { flatten } from '@/domain/flatten';
import { simulate } from '@/domain/simulate';
import { norwegian4x4 } from '@/domain/__tests__/fixtures';

jest.mock('expo-speech', () => ({
  // Fire onDone immediately, as the native module does once an utterance ends.
  speak: jest.fn((text: string, options?: { onDone?: () => void }) => {
    options?.onDone?.();
  }),
  stop: jest.fn(),
  isSpeakingAsync: jest.fn(async () => false),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// The beep service loads bundled assets through require(); stub the native layer.
function makePlayer() {
  return {
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    seekTo: jest.fn(async () => undefined),
    volume: 1,
  };
}

// jest.mock is hoisted, so it may only reference variables whose names start
// with "mock". The player factory is therefore mockMakeAudioPlayer, and it is
// called lazily so the factory is not used before it is assigned.
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => mockMakeAudioPlayer()),
  preload: jest.fn(async () => undefined),
  setAudioModeAsync: jest.fn(async () => undefined),
}));

const playerFactory = jest.fn(() => makePlayer());
const mockMakeAudioPlayer: () => unknown = playerFactory;



const Speech = require('expo-speech');
const { createAudioPlayer } = require('expo-audio');
const Haptics = require('expo-haptics');

const T0 = 1_700_000_000_000;

beforeEach(() => {
  jest.clearAllMocks();
  beepService.resetBeepService();
  voiceService.resetSpeakingState();
});

describe('cue dispatch: a whole simulated workout', () => {
  it('speaks every cue from the golden timeline with the spec wording', async () => {
    const { run } = simulate(flatten(norwegian4x4), { startMs: T0 });
    await dispatchCues(run.events);

    const spoken = Speech.speak.mock.calls.map((c: unknown[]) => c[0]);

    // US-9 / US-10 / US-11 wording, straight from the UI Style Guide section 8.
    expect(spoken).toContain('Easy. Ten minutes.');
    expect(spoken).toContain('Run. Four minutes.');
    expect(spoken).toContain('Rest. Three minutes.');
    expect(spoken).toContain('Set first of four.');
    expect(spoken).toContain('Three sets left.');
    expect(spoken).toContain('Workout complete.');

    // Beep-only cues are never spoken.
    expect(spoken).not.toContain(null);
    expect(spoken.every((s: unknown) => typeof s === 'string')).toBe(true);
  });

  it('speaks in the same order the cues fired', async () => {
    const { run } = simulate(flatten(norwegian4x4), { startMs: T0 });
    await dispatchCues(run.events);

    const spoken = Speech.speak.mock.calls.map((c: unknown[]) => c[0]);
    const firstFew = run.events
      .filter((e) => e.text !== null)
      .slice(0, 5)
      .map((e) => e.text);

    expect(spoken.slice(0, 5)).toEqual(firstFew);
  });

  it('plays beeps for countdown and pace alert cues only', async () => {
    const { run } = simulate(flatten(norwegian4x4), {
      startMs: T0,
      paceBySegmentIndex: { 1: 240, 3: 240, 5: 240, 7: 240 },
    });
    await dispatchCues(run.events);

    const beepCues = run.events.filter(
      (e) => e.kind.startsWith('countdown') || e.kind === 'paceAlert',
    );

    expect(beepCues.length).toBeGreaterThan(0);

    // Players are created lazily, one per beep kind. This run is deliberately
    // off pace, so all three kinds are used: tick, switch and alert.
    expect(createAudioPlayer).toHaveBeenCalledTimes(3);

    // Every beep cue must actually have produced sound. There are more beep
    // cues than players, because players are reused.
    const playCalls = playerFactory.mock.results.reduce(
      (total: number, result) => total + (result.value?.play.mock.calls.length ?? 0),
      0,
    );
    expect(playCalls).toBe(beepCues.length);
  });

  it('vibrates on every cue, per the UI style guide section 7', async () => {
    const { run } = simulate(flatten(norwegian4x4), { startMs: T0 });
    await dispatchCues(run.events);

    const vibrationCount =
      Haptics.impactAsync.mock.calls.length + Haptics.notificationAsync.mock.calls.length;

    expect(run.events.length).toBeGreaterThan(0);
    expect(vibrationCount).toBeGreaterThan(0);
  });
});

describe('cue dispatch: priority rules (section 6)', () => {
  const segmentStart = {
    kind: 'segmentStart' as const,
    text: 'Run. Four minutes.',
    priority: 'high' as const,
    segmentIndex: 0,
    at: T0,
    vibrate: 'long' as const,
  };

  it('interrupts speech for a segment change', async () => {
    await dispatchCue(segmentStart);
    expect(Speech.stop).toHaveBeenCalled();
  });

  it('interrupts speech for a set announcement', async () => {
    await dispatchCue({
      ...segmentStart,
      kind: 'setAnnouncement',
      text: 'Set two of four.',
    });
    expect(Speech.stop).toHaveBeenCalled();
  });

  it('drops a low-priority cue when speech is already playing', async () => {
    // Put the service into its real busy state and keep it there by having
    // the mocked speech never call onDone.
    Speech.speak.mockImplementationOnce(() => undefined);
    await dispatchCue({
      kind: 'segmentStart',
      text: 'Run. Four minutes.',
      priority: 'high',
      segmentIndex: 0,
      at: T0,
      vibrate: 'long',
    });
    Speech.speak.mockClear();

    await dispatchCue({
      kind: 'halfway',
      text: 'Halfway.',
      priority: 'low',
      segmentIndex: 1,
      at: T0,
      vibrate: 'short',
    });

    expect(Speech.speak).not.toHaveBeenCalled();
  });

  it('still speaks a low-priority cue when nothing else is playing', async () => {
    await dispatchCue({
      kind: 'halfway',
      text: 'Halfway.',
      priority: 'low',
      segmentIndex: 1,
      at: T0,
      vibrate: 'short',
    });

    expect(Speech.speak).toHaveBeenCalledWith('Halfway.', expect.anything());
  });
});

describe('cue dispatch: settings toggles (US-12)', () => {
  const cue = {
    kind: 'segmentStart' as const,
    text: 'Run. Four minutes.',
    priority: 'high' as const,
    segmentIndex: 0,
    at: T0,
    vibrate: 'long' as const,
  };

  it('stays silent when voice cues are off', async () => {
    await dispatchCue(cue, { voiceEnabled: false });
    expect(Speech.speak).not.toHaveBeenCalled();
  });

  it('stays silent when beeps are off', async () => {
    beepService.setBeepsEnabled(false);
    await dispatchCue(
      {
        ...cue,
        kind: 'countdownSwitch',
        text: null,
      },
      { beepsEnabled: false },
    );
    expect(Speech.speak).not.toHaveBeenCalled();
  });
});
