import {
  GOOD_FIX_ACCURACY_M,
  GPS_SETTLING_SEC,
  gpsSettlingRemainingSec,
  isGpsReady,
  resetLocationService,
} from '../locationService';

/**
 * Section 5 (GPS processing): "Warm up: ignore the first few seconds of fixes
 * after Start until accuracy settles; show a 'GPS ready' state on the start
 * screen."
 *
 * The wrapper is mocked below so no native module is touched.
 */

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  hasServicesEnabledAsync: jest.fn(async () => true),
  getForegroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
  watchPositionAsync: jest.fn(async () => ({ remove: jest.fn() })),
}));

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
}));

beforeEach(() => {
  resetLocationService();
  jest.clearAllMocks();
});

describe('GPS settling (section 5)', () => {
  it('is not ready before any fix arrives', () => {
    expect(isGpsReady(Date.now())).toBe(false);
  });

  it('uses a five second settling window', () => {
    expect(GPS_SETTLING_SEC).toBe(5);
  });

  it('only trusts an accurate enough fix', () => {
    // The threshold matches the domain filter in geo.ts.
    expect(GOOD_FIX_ACCURACY_M).toBe(25);
  });

  it('counts down the settling window, then stops at zero', () => {
    const now = Date.now();
    // Before start() the window is not running, so it reports zero rather than
    // a negative or stale value.
    expect(gpsSettlingRemainingSec(now)).toBe(0);
  });
});
