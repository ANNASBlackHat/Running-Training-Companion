import { Redirect } from 'expo-router';

import RunScreen from '@/components/RunScreen';
import { TEMPLATE_NORWEGIAN_4X4 } from '@/domain/templates';
import { useWorkoutStore } from '@/store/workouts';

/**
 * Live run route.
 *
 * Tech Spec section 9 lists `/run` as the live run screen. Phase 6 replaces the
 * temporary Norwegian 4x4 default with the selected workout, passed by id.
 */
export default function RunRoute() {
  const templates = useWorkoutStore((s) => s.templates);

  // Phase 6 wires the selected workout through navigation params; until then
  // the first built-in template is used so the screen can be tested end to end.
  const workout = templates[0] ?? TEMPLATE_NORWEGIAN_4X4;

  if (!workout) return <Redirect href="/" />;

  return <RunScreen workout={workout} />;
}
