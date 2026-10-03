import { Redirect, useLocalSearchParams } from 'expo-router';

import RunScreen from '@/components/RunScreen';
import { useWorkoutStore } from '@/store/workouts';

/**
 * Live run route.
 *
 * Tech Spec section 9 lists `/run` as the live run screen. The workout arrives
 * as a navigation param from the detail screen; when it is missing we fall back
 * to the first built-in template so the screen can still be opened directly
 * during development.
 */
export default function RunRoute() {
  const { workoutId } = useLocalSearchParams<{ workoutId?: string }>();
  const workouts = useWorkoutStore((s) => s.workouts);
  const templates = useWorkoutStore((s) => s.templates);

  const workout = workoutId
    ? [...workouts, ...templates].find((w) => w.id === workoutId)
    : templates[0];

  if (!workout) return <Redirect href="/" />;

  return <RunScreen workout={workout} />;
}
