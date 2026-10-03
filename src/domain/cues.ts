import { numberToWords, ordinalWords, spokenDistance, spokenLength } from './format';
import { setsRemainingAfter } from './flatten';
import { paceStatusFor, type PaceStatus } from './pace';
import type { RuntimeSegment, SegmentType, TrackPoint } from './types';

/**
 * Cue scheduler.
 *
 * From .specs/Running Training Companion_ Tech Spec.md section 6
 * ("Cue scheduler"):
 *
 *   "Cues are generated per segment as a set of one-time triggers with fired
 *    flags, so none repeat."
 *
 * Pace alert rules (section 6):
 *   - Only when the active segment has a pace range and a live pace exists.
 *   - No alerts during the first 15 s of a segment.
 *   - Pace must be outside the range continuously for about 5 s.
 *   - At most one alert every 20 s.
 *   - Alerts are skipped when a higher-priority cue is due within a couple of
 *     seconds.
 *
 * Voice queue (section 6): segment changes and countdown beeps are high
 * priority and interrupt speech. Other cues are low priority and are dropped,
 * not queued, if something is already playing.
 */

export type CueKind =
  | 'segmentStart'
  | 'setAnnouncement'
  | 'countdownBeep'
  | 'countdownSwitch'
  | 'halfway'
  | 'remainingTime'
  | 'remainingDistance'
  | 'paceAlert'
  | 'setsLeft'
  | 'finish';

export type CuePriority = 'high' | 'low';

export interface CueEvent {
  kind: CueKind;
  /** Spoken text, or null for beep-only cues. */
  text: string | null;
  priority: CuePriority;
  segmentIndex: number;
  /** Epoch ms the cue fired. */
  at: number;
  /** Vibration pattern tag, per UI Style Guide section 7. */
  vibrate: 'short' | 'long' | 'alert' | null;
  /** Extra payload for the live screen, e.g. the pace alert direction. */
  data?: Record<string, unknown>;
}

/* Thresholds from section 6. */
export const COUNTDOWN_LEAD_SEC = 3;
export const HALFWAY_MIN_SEC = 120;
export const HALFWAY_MIN_M = 400;
export const REMAINING_TIME_SEC = 60;
export const REMAINING_TIME_MIN_SEC = 180;
export const REMAINING_DISTANCE_M = 100;
export const REMAINING_DISTANCE_MIN_M = 400;
export const PACE_GRACE_SEC = 15;
export const PACE_CONTINUOUS_SEC = 5;
export const PACE_ALERT_COOLDOWN_SEC = 20;

const SEGMENT_LABEL: Record<SegmentType, string> = {
  run: 'Run',
  rest: 'Rest',
  warmup: 'Easy',
  cooldown: 'Easy',
};

/** Capitalise the first letter so a cue reads as a sentence. */
function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Spoken length of a segment, from its length kind. */
export function lengthPhrase(seg: RuntimeSegment): string {
  const { length } = seg.segment;
  return length.kind === 'time'
    ? spokenLength(length.seconds, 0)
    : spokenDistance(length.meters);
}

/** "Run. Four minutes." / "Rest. Three minutes." / "Easy. Four hundred meters." */
export function segmentStartPhrase(seg: RuntimeSegment): string {
  return `${SEGMENT_LABEL[seg.segment.type]}. ${sentence(lengthPhrase(seg))}.`;
}

/** "Set two of four." */
export function setAnnouncementPhrase(seg: RuntimeSegment): string {
  const { setNumber, setTotal } = seg;
  if (setNumber === undefined || setTotal === undefined) {
    throw new Error('setAnnouncementPhrase called on a segment outside a repeat');
  }
  return `Set ${ordinalWords(setNumber)} of ${numberToWords(setTotal)}.`;
}

/** "Three sets left." / "One set left." */
export function setsLeftPhrase(seg: RuntimeSegment): string {
  const remaining = setsRemainingAfter(seg);
  return remaining === 1 ? 'One set left.' : `${sentence(numberToWords(remaining))} sets left.`;
}

/** "One hundred meters left." */
export function remainingDistancePhrase(remainingM: number): string {
  // spokenDistance gives "one hundred meters"; the cue drops the unit noun and
  // says "One hundred left."
  const spoken = spokenDistance(remainingM);
  const base = spoken.replace(/\s+meters?$/, '');
  return `${base.charAt(0).toUpperCase()}${base.slice(1)} left.`;
}

/**
 * Per-segment one-time trigger flags. Reset whenever a new segment begins,
 * so each segment gets its own countdown, halfway and remaining cues.
 */
export interface CueFlags {
  countdown: boolean[];
  halfway: boolean;
  remainingTime: boolean;
  remainingDistance: boolean;
}

export function createCueFlags(): CueFlags {
  return {
    countdown: new Array(COUNTDOWN_LEAD_SEC).fill(false),
    halfway: false,
    remainingTime: false,
    remainingDistance: false,
  };
}

/** Cues emitted when a segment begins. Section 6 cue table, rows 1 and 2. */
export function onSegmentStart(seg: RuntimeSegment, at: number): CueEvent[] {
  const events: CueEvent[] = [
    {
      kind: 'segmentStart',
      text: segmentStartPhrase(seg),
      priority: 'high',
      segmentIndex: seg.index,
      at,
      vibrate: 'long',
    },
  ];

  // Set announcement: start of a run segment in a repeat.
  if (seg.segment.type === 'run' && seg.setNumber !== undefined && seg.setTotal !== undefined) {
    events.push({
      kind: 'setAnnouncement',
      text: setAnnouncementPhrase(seg),
      priority: 'high',
      segmentIndex: seg.index,
      at,
      vibrate: 'short',
    });
  }

  return events;
}


/**
 * Mid-segment cues for a tick: countdown beeps, halfway, and remaining.
 * Returns only cues that are newly due, mutating `flags` as they fire so a
 * one-time trigger never repeats (section 6).
 */
export function onTickCues(
  seg: RuntimeSegment,
  flags: CueFlags,
  remainingSec: number | null,
  remainingM: number | null,
  elapsedSecValue: number,
  at: number,
): CueEvent[] {
  const events: CueEvent[] = [];
  const length = seg.segment.length;
  const isTime = length.kind === 'time';

  // Countdown: last 3 s of a time segment, three beeps then a long beep.
  if (isTime && remainingSec !== null) {
    const remaining = Math.ceil(remainingSec);
    // Chronological: remaining 3 -> first beep, 2 -> second, 1 -> switch beep.
    for (let i = 0; i < COUNTDOWN_LEAD_SEC; i += 1) {
      const firesAt = COUNTDOWN_LEAD_SEC - i;
      if (remaining === firesAt && !flags.countdown[i]) {
        flags.countdown[i] = true;
        const isSwitch = firesAt === 1;
        events.push({
          kind: isSwitch ? 'countdownSwitch' : 'countdownBeep',
          text: null,
          priority: 'high',
          segmentIndex: seg.index,
          at,
          vibrate: isSwitch ? 'long' : 'short',
          data: { beepIndex: i },
        });
      }
    }
  }

  // Halfway: 50% of a segment that is 2 min+ or 400 m+.
  if (!flags.halfway) {
    const qualifies = isTime
      ? length.kind === 'time' && length.seconds >= HALFWAY_MIN_SEC
      : length.kind === 'distance' && length.meters >= HALFWAY_MIN_M;

    if (qualifies) {
      const halfReached = isTime
        ? elapsedSecValue >= (length.kind === 'time' ? length.seconds : 0) / 2
        : remainingM !== null && remainingM <= (length.kind === 'distance' ? length.meters : 0) / 2;

      if (halfReached) {
        flags.halfway = true;
        events.push({
          kind: 'halfway',
          text: 'Halfway.',
          priority: 'low',
          segmentIndex: seg.index,
          at,
          vibrate: 'short',
        });
      }
    }
  }

  // Remaining (time): 60 s left on segments over 3 min.
  if (
    !flags.remainingTime &&
    isTime &&
    length.kind === 'time' &&
    length.seconds > REMAINING_TIME_MIN_SEC &&
    remainingSec !== null &&
    remainingSec <= REMAINING_TIME_SEC
  ) {
    flags.remainingTime = true;
    events.push({
      kind: 'remainingTime',
      text: 'One minute left.',
      priority: 'low',
      segmentIndex: seg.index,
      at,
      vibrate: 'short',
    });
  }

  // Remaining (distance): 100 m left on segments over 400 m.
  if (
    !flags.remainingDistance &&
    !isTime &&
    length.kind === 'distance' &&
    length.meters > REMAINING_DISTANCE_MIN_M &&
    remainingM !== null &&
    remainingM <= REMAINING_DISTANCE_M
  ) {
    flags.remainingDistance = true;
    events.push({
      kind: 'remainingDistance',
      text: remainingDistancePhrase(remainingM),
      priority: 'low',
      segmentIndex: seg.index,
      at,
      vibrate: 'short',
    });
  }

  return events;
}
export interface PaceAlertState {
  /** Consecutive ms the pace has been out of range. */
  outOfRangeMs: number;
  /** Direction currently being nagged about, if any. */
  lastDirection: 'tooFast' | 'tooSlow' | null;
  /** Epoch ms of the last alert fired. */
  lastAlertAt: number | null;
}

export function createPaceAlertState(): PaceAlertState {
  return { outOfRangeMs: 0, lastDirection: null, lastAlertAt: null };
}

/**
 * Milliseconds until the next countdown beep, used to suppress pace alerts
 * near a switch (section 6: "Alerts are skipped when a higher-priority cue is
 * due within a couple of seconds").
 */
export function msToNextCountdown(remainingSec: number | null): number {
  if (remainingSec === null) return Number.POSITIVE_INFINITY;
  const toCountdown = (remainingSec - COUNTDOWN_LEAD_SEC) * 1000;
  return toCountdown > 0 ? toCountdown : 0;
}

/**
 * Decide whether a pace alert should fire now.
 *
 * Section 6 rules, applied in order:
 *   - only with a pace range and a live pace,
 *   - none in the first 15 s of the segment,
 *   - out of range continuously for about 5 s,
 *   - at most one alert every 20 s,
 *   - suppressed when a high-priority cue is due within a couple of seconds.
 *
 * Mutates and returns the state so the caller keeps it across ticks.
 */
export function paceAlertCue(
  seg: RuntimeSegment,
  segmentPoints: TrackPoint[],
  state: PaceAlertState,
  elapsedSecValue: number,
  at: number,
  dtMs: number,
  highPriorityDueWithinMs = Number.POSITIVE_INFINITY,
): { cue: CueEvent | null; state: PaceAlertState } {
  // No target range on this segment: never alert.
  if (!seg.segment.paceRange) {
    return { cue: null, state };
  }

  // Grace period after a segment starts (acceleration and GPS settling).
  if (elapsedSecValue < PACE_GRACE_SEC) {
    return { cue: null, state: { ...state, outOfRangeMs: 0 } };
  }

  const { status, paceSecPerKm } = paceStatusFor(segmentPoints, at, seg.segment.paceRange);

  // Back inside the range: reset the continuous counter and direction.
  if (status !== 'tooFast' && status !== 'tooSlow') {
    return { cue: null, state: { ...state, outOfRangeMs: 0, lastDirection: null } };
  }

  // Must be out of range continuously for about 5 s.
  const outOfRangeMs = state.outOfRangeMs + dtMs;
  if (outOfRangeMs < PACE_CONTINUOUS_SEC * 1000) {
    return { cue: null, state: { ...state, outOfRangeMs } };
  }

  // Cooldown: at most one alert every 20 s.
  if (state.lastAlertAt !== null && at - state.lastAlertAt < PACE_ALERT_COOLDOWN_SEC * 1000) {
    return { cue: null, state: { ...state, outOfRangeMs } };
  }

  // Do not nag when a segment change is imminent.
  if (highPriorityDueWithinMs <= 2000) {
    return { cue: null, state: { ...state, outOfRangeMs } };
  }

  const direction = status === 'tooFast' ? 'tooFast' : 'tooSlow';
  const cue: CueEvent = {
    kind: 'paceAlert',
    text: direction === 'tooFast' ? 'Too fast.' : 'Too slow.',
    priority: 'low',
    segmentIndex: seg.index,
    at,
    vibrate: 'alert',
    data: { status, paceSecPerKm },
  };

  return {
    cue,
    state: { outOfRangeMs: 0, lastDirection: direction, lastAlertAt: at },
  };
}

/** Finish cue, emitted when the last segment ends. */
export function onFinish(segmentIndex: number, at: number): CueEvent {
  return {
    kind: 'finish',
    text: 'Workout complete.',
    priority: 'high',
    segmentIndex,
    at,
    vibrate: 'long',
  };
}

/** Sets left: end of a rest segment inside a repeat. */
export function onSegmentEndCue(seg: RuntimeSegment, at: number): CueEvent | null {
  if (seg.segment.type !== 'rest' || seg.setNumber === undefined) return null;
  const remaining = setsRemainingAfter(seg);
  if (remaining <= 0) return null;
  return {
    kind: 'setsLeft',
    text: setsLeftPhrase(seg),
    priority: 'low',
    segmentIndex: seg.index,
    at,
    vibrate: 'short',
  };
}
