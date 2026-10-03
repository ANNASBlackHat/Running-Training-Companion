import * as Location from 'expo-location';

import {
  gpsSettlingRemainingSec,
  isGpsReady,
  resetLocationService,
  start,
  stop,
} from '../locationService';

/**
 * Section 5: a fix is only trusted once accuracy has settled. A first fix at
 * 40 m is exactly what the warm-up exists to discard, so it must not mark the
 * runner ready.
 */

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  hasServicesEnabledAsync: jest.fn(async () => true),
  getForegroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
  watchPositionAsync: jest.fn(),
}));

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
}));

const LocationMock = Location as jest.Mocked<typeof Location>;

/** Capture the callback expo-location would call, then feed fixes to it. */
function captureWatchCallback(): (pos: unknown) => void {
  let captured: (pos: unknown) => void = () => {};
  LocationMock.watchPositionAsync.mockImplementation(
    async (_options, callback) => {
      captured = callback as (pos: unknown) => void;
      return { remove: jest.fn() } as never;
    },
  );
  return (pos) => captured(pos);
}

const fix = (accuracy: number) => ({
  timestamp: Date.now(),
  coords: { latitude: 51.5, longitude: -0.12, accuracy },
});

beforeEach(() => {
  resetLocationService();
  jest.clearAllMocks();
});

describe('GPS settling behaviour', () => {
  it('is not ready before tracking starts', () => {
    expect(isGpsReady(Date.now())).toBe(false);
  });

  it('stays not-ready when only a poor fix has arrived', async () => {
    const emit = captureWatchCallback();
    await start(() => {});

    emit(fix(40));

    // A 40 m fix is discarded, so the runner is still settling.
    expect(isGpsReady(Date.now())).toBe(false);
    expect(gpsSettlingRemainingSec(Date.now())).toBeGreaterThanOrEqual(0);
  });

  it('becomes ready once an accurate fix arrives', async () => {
    const emit = captureWatchCallback();
    await start(() => {});

    emit(fix(40));
    expect(isGpsReady(Date.now())).toBe(false);

    emit(fix(8));
    expect(isGpsReady(Date.now())).toBe(true);
  });

  it('forwards every fix to the callback, good or bad', async () => {
    const seen: number[] = [];
    const emit = captureWatchCallback();
    await start((point) => seen.push(point.acc));

    emit(fix(40));
    emit(fix(8));

    // Filtering is the domain's job, so the wrapper must not drop either.
    expect(seen).toEqual([40, 8]);
  });

  it('resets readiness when tracking stops', async () => {
    const emit = captureWatchCallback();
    await start(() => {});
    emit(fix(8));
    expect(isGpsReady(Date.now())).toBe(true);

    await stop();
    expect(isGpsReady(Date.now())).toBe(false);
  });

  it('requests high accuracy on a one second interval, using time', async () => {
    captureWatchCallback();
    await start(() => {});

    const options = LocationMock.watchPositionAsync.mock.calls[0][0];
    expect(options.timeInterval).toBe(1000);
    expect(options.distanceInterval).toBe(0);
  });
});
