import type { Length, PaceRange, Segment, SegmentType } from './types';

/**
 * Segment editing state.
 *
 * Kept as a pure reducer so the builder's field handling can be tested without
 * rendering a sheet. This covers User Stories US-2 (length by time or distance)
 * and US-3 (optional target pace range).
 */

export type LengthMode = 'time' | 'distance';

export interface SegmentDraft {
  type: SegmentType;
  mode: LengthMode;
  /** Minutes, used when mode is time. */
  minutes: string;
  /** Seconds, used when mode is time. */
  seconds: string;
  /** Metres, used when mode is distance. */
  meters: string;
  /** True when the user chose to set a target pace. */
  hasPace: boolean;
  paceFrom: string;
  paceTo: string;
}

/** Build a draft from an existing segment. */
export function draftFromSegment(segment: Segment): SegmentDraft {
  const { length } = segment;
  const pace = segment.paceRange;

  // Pace is entered as min:sec per the US-3 example "4:30 to 4:45".
  const toClock = (secPerKm: number | undefined): string => {
    if (secPerKm === undefined) return '';
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    return s === 0 ? String(m) : `${m}:${String(s).padStart(2, '0')}`;
  };

  // Branching on `kind` narrows the union, unlike a boolean flag.
  if (length.kind === 'time') {
    return {
      type: segment.type,
      mode: 'time',
      minutes: String(Math.floor(length.seconds / 60)),
      seconds: length.seconds % 60 !== 0 ? String(length.seconds % 60) : '',
      meters: '',
      hasPace: Boolean(pace),
      paceFrom: toClock(pace?.fastSecPerKm),
      paceTo: toClock(pace?.slowSecPerKm),
    };
  }

  return {
    type: segment.type,
    mode: 'distance',
    minutes: '',
    seconds: '',
    meters: String(length.meters),
    hasPace: Boolean(pace),
    paceFrom: toClock(pace?.fastSecPerKm),
    paceTo: toClock(pace?.slowSecPerKm),
  };
}

/** Parse "4:30" style input into seconds; null when unusable. */
export function parsePace(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const [minPart, secPart] = trimmed.split(':');
  const minutes = Number(minPart);
  if (!Number.isFinite(minutes) || minutes < 0) return null;

  if (secPart === undefined) {
    // Bare digits are read as minutes.
    return minutes > 0 ? Math.round(minutes * 60) : null;
  }

  const seconds = Number(secPart);
  if (!Number.isFinite(seconds) || seconds < 0 || seconds >= 60) return null;
  return minutes * 60 + seconds;
}

/** Build the length from the draft, or null when the fields are unusable. */
export function lengthFromDraft(draft: SegmentDraft): Length | null {
  if (draft.mode === 'distance') {
    const meters = Number(draft.meters);
    if (!Number.isFinite(meters) || meters <= 0) return null;
    return { kind: 'distance', meters: Math.round(meters) };
  }

  const minutes = Number(draft.minutes || '0');
  const seconds = Number(draft.seconds || '0');
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  if (minutes < 0 || seconds < 0 || seconds >= 60) return null;

  const total = Math.round(minutes * 60 + seconds);
  return total > 0 ? { kind: 'time', seconds: total } : null;
}

/** Build the pace range from the draft, or null when unset or unusable. */
export function paceRangeFromDraft(draft: SegmentDraft): PaceRange | null {
  if (!draft.hasPace) return null;

  const from = parsePace(draft.paceFrom);
  const to = parsePace(draft.paceTo);
  if (from === null || to === null) return null;
  if (from <= 0 || to <= 0) return null;

  // The fast bound must be the smaller of the two, whatever order was typed.
  return {
    fastSecPerKm: Math.min(from, to),
    slowSecPerKm: Math.max(from, to),
  };
}

/** True when the draft can be applied to a segment. */
export function draftIsValid(draft: SegmentDraft): boolean {
  return lengthFromDraft(draft) !== null;
}

/** Apply a draft to an existing segment, keeping its id. */
export function applyDraft(segment: Segment, draft: SegmentDraft): Segment | null {
  const length = lengthFromDraft(draft);
  if (!length) return null;

  return {
    ...segment,
    type: draft.type,
    length,
    paceRange: paceRangeFromDraft(draft) ?? undefined,
  };
}