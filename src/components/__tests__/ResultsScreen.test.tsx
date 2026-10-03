import { fireEvent, render, screen } from '@testing-library/react-native';

import ResultsScreen from '../ResultsScreen';
import { computeResults } from '@/domain/results';
import { TEMPLATE_NORWEGIAN_4X4 } from '@/domain/templates';
import type { SegmentResult, Session, TrackPoint } from '@/domain/types';
import { useSessionStore } from '@/store/sessions';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ sessionId: 's1' }),
}));

const M_PER_DEG_LAT = 111_195;
const T0 = 1_700_000_000_000;

function track(durationSec: number, speedMps: number): TrackPoint[] {
  return Array.from({ length: durationSec + 1 }, (_, s) => ({
    t: T0 + s * 1000,
    lat: (s * speedMps) / M_PER_DEG_LAT,
    lon: -0.1278,
    acc: 5,
  }));
}

const seg = (over: Partial<SegmentResult>): SegmentResult => ({
  index: 0,
  type: 'warmup',
  startedAt: T0 - 1000,
  endedAt: T0 + 1000,
  durationSec: 100,
  distanceM: 500,
  avgPaceSecPerKm: 200,
  ...over,
});

function seedSession(results: SegmentResult[], points: TrackPoint[]) {
  const { results: computed } = computeResults(results, points);
  useSessionStore.setState({
    sessions: [
      {
        id: 's1',
        workoutId: TEMPLATE_NORWEGIAN_4X4.id,
        workoutSnapshot: TEMPLATE_NORWEGIAN_4X4,
        startedAt: T0,
        endedAt: T0 + 1000,
        results: computed,
        totals: { durationSec: 0, distanceM: 0, avgPaceSecPerKm: null },
        track: points,
      } satisfies Session,
    ],
  });
}

beforeEach(() => useSessionStore.setState({ sessions: [] }));

describe('ResultsScreen', () => {
  it('shows session totals that include rest (US-15)', () => {
    seedSession(
      [
        seg({ index: 0, type: 'warmup', durationSec: 300, distanceM: 1000 }),
        seg({ index: 1, type: 'run', durationSec: 240, distanceM: 850 }),
        seg({ index: 2, type: 'rest', durationSec: 180, distanceM: 0 }),
      ],
      track(600, 1000 / 300),
    );
    render(<ResultsScreen />);

    // Totals sum every segment, rest included: 300 + 240 + 180.
    expect(screen.getAllByText('12:00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1.85 km').length).toBeGreaterThan(0);
  });

  it('lists a row per segment (US-13)', () => {
    seedSession(
      [
        seg({ index: 0, type: 'warmup' }),
        seg({ index: 1, type: 'run', setNumber: 1 }),
        seg({ index: 2, type: 'rest', setNumber: 1 }),
      ],
      track(600, 1000 / 300),
    );
    render(<ResultsScreen />);

    expect(screen.getByText(/Warm-up/)).toBeTruthy();
    expect(screen.getByText(/Run · Set 1/)).toBeTruthy();
    expect(screen.getByText(/Rest · Set 1/)).toBeTruthy();
  });

  it('does not split an interval run per km (section 7)', () => {
    seedSession(
      [seg({ index: 0, type: 'run', startedAt: T0 - 1000, endedAt: T0 + 900_000 })],
      track(900, 1000 / 300),
    );
    render(<ResultsScreen />);

    // No toggle affordance means no per-km table.
    expect(screen.queryByText('km')).toBeNull();
  });

  it('expands a warm-up to show per-km splits (US-14)', () => {
    seedSession(
      [seg({ index: 0, type: 'warmup', startedAt: T0 - 1000, endedAt: T0 + 900_000 })],
      track(900, 1000 / 300),
    );
    render(<ResultsScreen />);

    expect(screen.queryByText('km')).toBeNull();
    fireEvent.press(screen.getByLabelText(/show per kilometre splits/));

    expect(screen.getByText('km')).toBeTruthy();
    // Three whole kilometres at 5:00.
    expect(screen.getAllByText('5:00').length).toBeGreaterThan(0);
  });

  it('marks the fastest and slowest set in words, not colour alone', () => {
    seedSession(
      [
        seg({ index: 1, type: 'run', avgPaceSecPerKm: 280 }),
        seg({ index: 3, type: 'run', avgPaceSecPerKm: 265 }),
        seg({ index: 5, type: 'run', avgPaceSecPerKm: 300 }),
      ],
      track(600, 1000 / 300),
    );
    render(<ResultsScreen />);

    expect(screen.getByText('Fastest')).toBeTruthy();
    expect(screen.getByText('Slowest')).toBeTruthy();
  });

  it('explains itself when the session is not saved', () => {
    render(<ResultsScreen />);
    expect(screen.getByText('This session is not saved on the device.')).toBeTruthy();
  });
});
