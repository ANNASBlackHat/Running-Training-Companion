/**
 * Smoke test: every route module must import cleanly. Unit tests render
 * screens individually, so an unused route with a bad import would otherwise
 * only fail when a user navigated to it.
 */
import Home from '@/app/index';
import History from '@/app/history';
import Settings from '@/app/settings';
import RunRoute from '@/app/run';
import WorkoutDetail from '@/app/workout/[id]';
import Builder from '@/app/workout/edit';
import ResultsRoute from '@/app/results/[sessionId]';

it('every route module imports without error', () => {
  for (const [name, route] of Object.entries({
    Home,
    History,
    Settings,
    RunRoute,
    WorkoutDetail,
    Builder,
    ResultsRoute,
  })) {
    expect(typeof route).toBe('function');
    expect(name.length).toBeGreaterThan(0);
  }
});
