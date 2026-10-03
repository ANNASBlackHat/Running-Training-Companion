/**
 * Design tokens.
 *
 * Copied verbatim from .specs/Running Training Companion_ UI Style Guide.md
 * section 11 ("Implementation notes").
 *
 * Rules from section 2: "Alert is never used as text color; alert pills carry
 * ink text." and "Color is never the only signal."
 */

import { numberToWords, ordinalWords } from './domain/format';

export const color = {
  ink: '#101B3B',
  inkMuted: '#4B587A',
  run: '#2340E6',
  rest: '#CFE6DB',
  base: '#55657A',
  paper: '#F4F6F9',
  line: '#D5DAE2',
  alert: '#FFB200',
  white: '#FFFFFF',
} as const;

export type SegmentTypeColors = {
  bg: string;
  fg: string;
};

export const segmentColor = {
  run: { bg: color.run, fg: color.white },
  rest: { bg: color.rest, fg: color.ink },
  warmup: { bg: color.base, fg: color.white },
  cooldown: { bg: color.base, fg: color.white },
} as const satisfies Record<string, SegmentTypeColors>;

export const radius = { block: 3, button: 14, sheet: 24 } as const;

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;

/** Screen padding per UI Style Guide section 4. */
export const SCREEN_PADDING = 20;
export const LIVE_PADDING = 24;

/** Section 4: touch targets 48 dp minimum; live-screen controls 64 dp tall. */
export const TOUCH_TARGET = 48;
export const LIVE_CONTROL_HEIGHT = 64;

export const type = {
  timerXL: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 132, fontVariant: ['tabular-nums'] },
  paceL: { fontFamily: 'BarlowCondensed_600SemiBold', fontSize: 64, fontVariant: ['tabular-nums'] },
  title: { fontFamily: 'BarlowCondensed_600SemiBold', fontSize: 28 },
  heading: { fontFamily: 'BarlowCondensed_600SemiBold', fontSize: 20 },
  body: { fontFamily: 'Barlow_400Regular', fontSize: 16 },
  caption: { fontFamily: 'Barlow_500Medium', fontSize: 13 },
} as const;

/**
 * Voice cue copy, from UI Style Guide section 8:
 *   "Run. Four minutes."  "Set two of four."  "Too slow."  "Workout complete."
 *
 * Kept as data (English only for now) so adding a language later is a data
 * change rather than a refactor of the cue scheduler.
 */
export const copy = {
  startWorkout: 'Start workout',
  pause: 'Pause',
  resume: 'Resume',
  skipSegment: 'Skip segment',
  holdToStop: 'Hold to stop',
  saveWorkout: 'Save workout',
  workoutSaved: 'Workout saved',
  newWorkout: 'New workout',
  gpsSettling: 'Waiting for GPS. Stay outside until the signal is ready.',
  locationOff: 'Location is off. Turn it on to track pace and distance.',
  locationDenied:
    'Location permission is needed to track pace. Open settings to allow it.',
  emptyHistory: 'No sessions yet. Start a workout to see results here.',
  noPaceYet: 'No pace yet',
  tooFast: 'Too fast',
  tooSlow: 'Too slow',
  halfway: 'Halfway',
  oneMinuteLeft: 'One minute left',
  finish: 'Workout complete',
} as const;

/**
 * Spoken cue phrases, built from UI Style Guide section 8 examples:
 *   "Run. Four minutes."  "Set two of four."  "Too slow."  "Workout complete."
 *
 * English only for now. Centralised here so a language switch later is a data
 * change rather than a refactor of the cue scheduler.
 */
export const voice = {
  segmentTime: (label: string, len: string): string => `${label}. ${len}.`,
  segmentDistance: (label: string, len: string): string => `${label}. ${len}.`,
  setOf: (n: number, of: number): string =>
    `Set ${ordinalWords(n)} of ${numberToWords(of)}.`,
  setsLeft: (n: number): string =>
    n === 1 ? 'One set left.' : `${numberToWords(n)} sets left.`,
  oneMinuteLeft: 'One minute left.',
  distanceLeft: (spokenMetres: string): string => `${spokenMetres} left.`,
  halfway: 'Halfway.',
  tooFast: 'Too fast.',
  tooSlow: 'Too slow.',
  finish: 'Workout complete.',
} as const;