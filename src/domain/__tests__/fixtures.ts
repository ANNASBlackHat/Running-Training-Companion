import { flatten } from '../flatten';
import type { Segment, Workout, WorkoutItem } from '../types';

/**
 * The built-in Norwegian 4x4 template from the MVP Scope section 2:
 * "warm-up, 4 x (4 min run / 3 min rest), cool-down".
 */
export const norwegian4x4: Workout = {
  id: 'template-norwegian-4x4',
  name: 'Norwegian 4x4',
  isTemplate: true,
  items: [
    { kind: 'segment', segment: { id: 'w', type: 'warmup', length: { kind: 'time', seconds: 600 } } },
    {
      kind: 'repeat',
      count: 4,
      segments: [
        { id: 'r', type: 'run', length: { kind: 'time', seconds: 240 }, paceRange: { fastSecPerKm: 270, slowSecPerKm: 285 } },
        { id: 's', type: 'rest', length: { kind: 'time', seconds: 180 } },
      ],
    },
    { kind: 'segment', segment: { id: 'c', type: 'cooldown', length: { kind: 'time', seconds: 600 } } },
  ],
};

/** The 400 m repeat template from the MVP Scope section 2. */
export const repeats400m: Workout = {
  id: 'template-400m',
  name: '400 m repeats',
  isTemplate: true,
  items: [
    { kind: 'segment', segment: { id: 'w', type: 'warmup', length: { kind: 'time', seconds: 600 } } },
    {
      kind: 'repeat',
      count: 6,
      segments: [
        { id: 'd', type: 'run', length: { kind: 'distance', meters: 400 } },
        { id: 'j', type: 'rest', length: { kind: 'time', seconds: 90 } },
      ],
    },
    { kind: 'segment', segment: { id: 'c', type: 'cooldown', length: { kind: 'time', seconds: 600 } } },
  ],
};

/** Build an ad-hoc workout from items. */
export const workout = (items: WorkoutItem[], name = 'Test'): Workout => ({
  id: 'w-test',
  name,
  isTemplate: false,
  items,
});

export const timeSeg = (
  id: string,
  type: Segment['type'],
  seconds: number,
  paceRange?: Segment['paceRange'],
): WorkoutItem => ({
  kind: 'segment',
  segment: { id, type, length: { kind: 'time', seconds }, paceRange },
});

export const distSeg = (
  id: string,
  type: Segment['type'],
  meters: number,
  paceRange?: Segment['paceRange'],
): WorkoutItem => ({
  kind: 'segment',
  segment: { id, type, length: { kind: 'distance', meters }, paceRange },
});

export const repeatGroup = (
  count: number,
  segments: Segment[],
): WorkoutItem => ({ kind: 'repeat', count, segments });

/** Flattened runtime segments for a workout, the runner's input. */
export const runtime = (w: Workout) => flatten(w);