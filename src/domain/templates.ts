import type { Segment, Workout, WorkoutItem } from '@/domain/types';

/**
 * Built-in templates, seeded on first launch.
 *
 * Tech Spec section 8 (Storage): "workouts: user workouts plus built-in
 * templates (templates seeded on first launch)".
 *
 * MVP Scope section 2: "A few built-in templates on the home screen
 * (Norwegian 4x4, 400 m repeats). Templates are copies the user can edit."
 *
 * Built here rather than imported from the test fixtures so the shipped data
 * stays explicit and independent of test-only helpers.
 */

const warmup = (seconds: number): WorkoutItem => ({
  kind: 'segment',
  segment: { id: 'warmup', type: 'warmup', length: { kind: 'time', seconds } },
});

const cooldown = (seconds: number): WorkoutItem => ({
  kind: 'segment',
  segment: { id: 'cooldown', type: 'cooldown', length: { kind: 'time', seconds } },
});

const timeRun = (seconds: number): Segment => ({
  id: 'run',
  type: 'run',
  length: { kind: 'time', seconds },
  // 4:30 to 4:45 per km, the example in User Stories US-3.
  paceRange: { fastSecPerKm: 270, slowSecPerKm: 285 },
});

const timeRest = (seconds: number): Segment => ({
  id: 'rest',
  type: 'rest',
  length: { kind: 'time', seconds },
});

const distanceRun = (meters: number): Segment => ({
  id: 'run',
  type: 'run',
  length: { kind: 'distance', meters },
});

/** MVP Scope section 1: warm-up, 4 x (4 min run / 3 min rest), cool-down. */
export const TEMPLATE_NORWEGIAN_4X4: Workout = {
  id: 'template-norwegian-4x4',
  name: 'Norwegian 4x4',
  isTemplate: true,
  items: [
    warmup(600),
    { kind: 'repeat', count: 4, segments: [timeRun(240), timeRest(180)] },
    cooldown(600),
  ],
};

/** The 400 m repeat workout named in MVP Scope section 2. */
export const TEMPLATE_400M: Workout = {
  id: 'template-400m',
  name: '400 m repeats',
  isTemplate: true,
  items: [
    warmup(600),
    {
      kind: 'repeat',
      count: 6,
      segments: [distanceRun(400), timeRest(90)],
    },
    cooldown(600),
  ],
};

export const TEMPLATES: Workout[] = [TEMPLATE_NORWEGIAN_4X4, TEMPLATE_400M];

/** A fresh deep copy, so an edited template never mutates the built-in. */
export function cloneWorkout(workout: Workout, overrides: Partial<Workout> = {}): Workout {
  return JSON.parse(JSON.stringify(workout)) as Workout;
}

/**
 * US-4: editing a template creates the runner's own copy; the built-in stays
 * restorable.
 */
export function copyTemplateAsWorkout(template: Workout): Workout {
  const copy = cloneWorkout(template);
  return {
    ...copy,
    id: `workout-${Date.now().toString(36)}`,
    name: `${template.name} copy`,
    isTemplate: false,
  };
}
