import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { TEMPLATES, cloneWorkout, copyTemplateAsWorkout } from '@/domain/templates';
import type { Workout, WorkoutItem } from '@/domain/types';

/**
 * Workout store: user workouts plus the built-in templates.
 *
 * Tech Spec section 1: "State | Zustand | Plus `persist` middleware for local
 * saving". Section 8: "workouts: user workouts plus built-in templates
 * (templates seeded on first launch)".
 *
 * Templates are re-seeded on every load rather than persisted, so restoring a
 * built-in after it has been edited is just a matter of not persisting edits
 * (US-4).
 */

interface WorkoutState {
  /** User-authored workouts. Templates are not stored here. */
  workouts: Workout[];
  saveWorkout: (workout: Workout) => void;
  deleteWorkout: (id: string) => void;
  /** US-4: editing a template creates a copy the user owns. */
  createFromTemplate: (templateId: string) => string | null;
  /** All templates, always present. */
  templates: Workout[];
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      workouts: [],
      templates: TEMPLATES.map((t) => cloneWorkout(t)),

      saveWorkout: (workout) =>
        set((state) => {
          const exists = state.workouts.some((w) => w.id === workout.id);
          return {
            workouts: exists
              ? state.workouts.map((w) => (w.id === workout.id ? workout : w))
              : [...state.workouts, workout],
          };
        }),

      deleteWorkout: (id) =>
        set((state) => ({
          workouts: state.workouts.filter((w) => w.id !== id),
        })),

      createFromTemplate: (templateId) => {
        const template = get().templates.find((t) => t.id === templateId);
        if (!template) return null;
        const copy = copyTemplateAsWorkout(template);
        set((state) => ({ workouts: [...state.workouts, copy] }));
        return copy.id;
      },
    }),
    {
      name: 'workouts',
      storage: createJSONStorage(() => AsyncStorage),
      // Templates are derived, so only the user's workouts are persisted.
      partialize: (state) => ({ workouts: state.workouts }) as unknown as WorkoutState,
    },
  ),
);

/** Look up a workout or template by id. */
export function findWorkout(state: WorkoutState, id: string): Workout | undefined {
  return (
    state.workouts.find((w) => w.id === id) ?? state.templates.find((t) => t.id === id)
  );
}

/** Builder helper: replace one item at an index. */
export function replaceItem(items: WorkoutItem[], index: number, item: WorkoutItem): WorkoutItem[] {
  const next = [...items];
  next[index] = item;
  return next;
}