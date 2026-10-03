import { fireEvent, render, screen } from '@testing-library/react-native';

import HomeScreen from '@/app/index';
import { TEMPLATE_400M, TEMPLATE_NORWEGIAN_4X4 } from '@/domain/templates';
import type { Workout } from '@/domain/types';
import { useWorkoutStore } from '@/store/workouts';
import { useSessionStore } from '@/store/sessions';

// jest.mock factories may only reference mock-prefixed bindings.
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

/** UI Style Guide section 6 (Home) and User Stories US-1, US-2. */

beforeEach(() => {
  mockPush.mockClear();
  useWorkoutStore.setState({ workouts: [] });
  useSessionStore.setState({ sessions: [] });
});

describe('HomeScreen', () => {
  it('is titled Workouts', () => {
    render(<HomeScreen />);
    expect(screen.getByText('Workouts')).toBeTruthy();
  });

  it('shows both groups', () => {
    render(<HomeScreen />);
    expect(screen.getByText('Templates')).toBeTruthy();
    expect(screen.getByText('My workouts')).toBeTruthy();
  });

  it('lists the built-in templates (US-1)', () => {
    render(<HomeScreen />);
    expect(screen.getByText('Norwegian 4x4')).toBeTruthy();
    expect(screen.getByText('400 m repeats')).toBeTruthy();
  });

  it('shows the total as a caption', () => {
    render(<HomeScreen />);
    // 600 + 4*(240+180) + 600 = 2880 s = 48:00, and 4 sets.
    expect(screen.getByText('48:00 · 4 sets')).toBeTruthy();
  });

  it('opens a template when tapped', () => {
    render(<HomeScreen />);
    fireEvent.press(screen.getByLabelText(/Norwegian 4x4/));
    expect(mockPush).toHaveBeenCalledWith(`/workout/${TEMPLATE_NORWEGIAN_4X4.id}`);
  });

  it('explains an empty My workouts list', () => {
    render(<HomeScreen />);
    expect(screen.getByText(/No workouts yet/)).toBeTruthy();
  });

  it('lists user workouts once they exist', () => {
    const mine: Workout = { id: 'w1', name: 'My 5k', isTemplate: false, items: [] };
    useWorkoutStore.setState({ workouts: [mine] });

    render(<HomeScreen />);
    expect(screen.getByText('My 5k')).toBeTruthy();
    expect(screen.queryByText(/No workouts yet/)).toBeNull();
  });

  it('opens a user workout', () => {
    const mine: Workout = { id: 'w1', name: 'My 5k', isTemplate: false, items: [] };
    useWorkoutStore.setState({ workouts: [mine] });

    render(<HomeScreen />);
    fireEvent.press(screen.getByLabelText(/My 5k/));
    expect(mockPush).toHaveBeenCalledWith('/workout/w1');
  });

  it('offers a New workout button', () => {
    render(<HomeScreen />);
    fireEvent.press(screen.getByLabelText('New workout'));
    expect(mockPush).toHaveBeenCalledWith('/workout/edit');
  });

  it('links to history and to the 400 m template', () => {
    render(<HomeScreen />);
    fireEvent.press(screen.getByLabelText('History'));
    expect(mockPush).toHaveBeenCalledWith('/history');

    fireEvent.press(screen.getByLabelText(/400 m repeats/));
    expect(mockPush).toHaveBeenCalledWith(`/workout/${TEMPLATE_400M.id}`);
  });
});
