# Running Training Companion: Tech Spec (MVP)

Platform: Android. Framework: Expo (managed), TypeScript. Development in Expo Go first; background location is added later via a development build. Data is local only, with no backend.

## 1. Stack

| Concern | Choice | Notes |
| --- | --- | --- |
| Framework | Expo + TypeScript | Use the current SDK; verify package names in the Expo docs when installing |
| Navigation | expo-router | File-based routes |
| State | Zustand | Plus `persist` middleware for local saving |
| Storage | AsyncStorage | Fine for workouts and sessions at this size. Upgrade path: expo-sqlite |
| GPS | expo-location (foreground `watchPositionAsync`) | Behind `locationService` wrapper |
| Voice | expo-speech | English only for now |
| Beeps | expo-audio | Short bundled sound files for countdown |
| Screen on | expo-keep-awake | Required while GPS is foreground only |
| Tests | Jest | For all pure logic |

## 2. Architecture

Pure logic is separated from device APIs so it can be tested without running outside.

```
/src
  /domain        pure TS, no Expo imports
    types.ts
    flatten.ts        workout -> list of runtime segments
    geo.ts            haversine, point filtering
    pace.ts           rolling pace, range check
    runner.ts         workout state machine
    cues.ts           cue scheduler
    results.ts        segment results and km splits
  /services      thin wrappers over device APIs
    locationService.ts   start(), stop(), onPosition(cb)
    voiceService.ts      speak(text, priority)
    beepService.ts       beep(kind)
    storage.ts
  /store         Zustand stores (workouts, sessions, settings)
  /app           expo-router screens
  /components
```

Rule: `/domain` never imports from Expo or React. The runner receives positions and ticks as inputs and emits cue events as outputs. This is what makes the later background-location refactor small: only `locationService.ts` changes.

## 3. Data model

```ts
type SegmentType = 'warmup' | 'run' | 'rest' | 'cooldown';

type Length =
  | { kind: 'time'; seconds: number }
  | { kind: 'distance'; meters: number };

interface Segment {
  id: string;
  type: SegmentType;
  length: Length;
  paceRange?: { fastSecPerKm: number; slowSecPerKm: number };
}

// A workout item is a single segment or a repeated group of segments
type WorkoutItem =
  | { kind: 'segment'; segment: Segment }
  | { kind: 'repeat'; count: number; segments: Segment[] };

interface Workout {
  id: string;
  name: string;
  isTemplate: boolean;
  items: WorkoutItem[];
}

// Flattened at session start. One entry per actual segment to perform.
interface RuntimeSegment {
  index: number;
  segment: Segment;
  setNumber?: number;   // 1-based, if inside a repeat
  setTotal?: number;
}
```

Result data:

```ts
interface SegmentResult {
  index: number;
  type: SegmentType;
  setNumber?: number;
  startedAt: number;       // epoch ms
  endedAt: number;
  durationSec: number;     // excludes paused time
  distanceM: number;
  avgPaceSecPerKm: number | null;
  kmSplits?: { km: number; paceSecPerKm: number }[]; // warm-up and cool-down only
  elevationGainM?: number; // stretch
}

interface Session {
  id: string;
  workoutId: string;
  workoutSnapshot: Workout;   // copy, so later edits don't change history
  startedAt: number;
  endedAt: number;
  results: SegmentResult[];
  totals: { durationSec: number; distanceM: number; avgPaceSecPerKm: number | null };
  track: { t: number; lat: number; lon: number; acc: number }[];
}
```

Time is stored in seconds, distance in meters, pace in seconds per km. Formatting (4:30 /km) is a display concern only.

## 4. Workout runner (state machine)

States: `idle`, `running`, `paused`, `finished`.

Inputs: `start`, `tick` (every 1 s), `position`, `pause`, `resume`, `skip`, `stop`. Outputs: cue events (see section 6) and updated segment progress.

Rules:

- Elapsed time is computed from timestamps (`now - segmentStart - pausedTotal`), not by counting ticks. This avoids drift when the JS thread is busy.
- A time segment ends when elapsed >= target.
- A distance segment ends when accumulated segment distance >= target.
- When a segment ends, the runner records its `SegmentResult`, advances the index, and emits a segment-start cue.
- Last segment ending moves to `finished` and emits a finish cue.
- Pause freezes time and ignores positions. Distance accumulation resumes from the first new point without adding the gap.
- Skip closes the current segment with whatever was recorded.

Segment boundaries for distance: the point that crosses the target is counted in the segment; carry-over distance is not added to the next one. This is an acceptable error at MVP accuracy.

## 5. GPS processing

Request: high accuracy, time interval 1000 ms, distance interval 0 (use time).

Point filtering before distance is accumulated:

- Drop points with accuracy worse than about 25 m.
- Drop points implying speed above about 10 m/s (physically unlikely for running).
- Ignore displacement below about 1 m when the speed reading is near zero, to reduce standing-still drift.
- Warm up: ignore the first few seconds of fixes after Start until accuracy settles; show a "GPS ready" state on the start screen.

Distance: haversine between consecutive accepted points, summed.

Pace (live): rolling window of the last 10 to 15 s of accepted points; pace = windowSeconds / (windowMeters / 1000). If windowMeters is near zero, pace is "n/a" and no alerts fire.

## 6. Cue scheduler

Cues are generated per segment as a set of one-time triggers with fired flags, so none repeat.

| Cue | Trigger | Output |
| --- | --- | --- |
| Segment start | Segment begins | Voice: "Run, four minutes" / "Rest, three minutes" / "Run, four hundred meters" |
| Set announcement | Start of a run segment in a repeat | Voice: "Set two of four" |
| Countdown | Last 3 s of a time segment | Three beeps, long beep on switch |
| Halfway | 50% of a segment that is 2 min or longer, or 400 m or longer | Voice: "Halfway" |
| Remaining (time) | 60 s left on segments over 3 min | Voice: "One minute left" |
| Remaining (distance) | 100 m left on segments over 400 m | Voice: "One hundred meters left" |
| Pace alert | See below | Voice: "Too fast" / "Too slow" |
| Sets left | End of a rest segment | Voice: "Two sets left" |
| Finish | Workout ends | Voice: "Workout complete" |

Pace alert rules:

- Only when the active segment has a pace range and a live pace exists.
- No alerts during the first 15 s of a segment (acceleration and GPS settling).
- Pace must be outside the range continuously for about 5 s.
- At most one alert every 20 s; the same direction repeats no sooner than that.
- Alerts are skipped when a higher-priority cue is due within a couple of seconds.

Voice queue: segment changes and countdown beeps are high priority and interrupt speech. Other cues are low priority and are dropped, not queued, if something is already playing.

Audio focus: configure so music from other apps ducks during cues, not stops. Verify on device.

## 7. Results calculation

Computed once when the session ends, from the recorded track plus segment timestamps.

- Per segment: duration is the segment's active time; distance is the sum of accepted point distances inside its time window; avg pace = duration / (distance / 1000).
- Warm-up and cool-down: walk the cumulative distance and interpolate the time at each full kilometre to produce per-km splits; a final partial km is shown with its own distance.
- Interval segments are not split per km, only per set segment, as in the user stories.
- Totals: sum of all segments, including rest.
- Elevation gain (stretch): sum of positive deltas of smoothed altitude per segment; only shown when accuracy is acceptable.

## 8. Storage

- `workouts`: user workouts plus built-in templates (templates seeded on first launch).
- `sessions`: array of Session objects. Track points are stored at 1 per second at most.
- Zustand `persist` with AsyncStorage handles saving.
- A session is saved automatically when the runner reaches `finished` or the user stops.
- Crash safety (should-have): write an in-progress snapshot every 30 s so a crash does not lose a whole session.

## 9. Screens (expo-router)

| Route | Purpose |
| --- | --- |
| `/` | Home: templates, my workouts, history link |
| `/workout/[id]` | Workout detail, segment list, Start |
| `/workout/edit` | Builder |
| `/run` | Live run screen |
| `/results/[sessionId]` | Segment results, km splits, totals |
| `/history` | Past sessions |
| `/settings` | Voice and beep toggles |

## 10. Expo Go limitations and later refactor

Under Expo Go, tracking and cues work while the app is in the foreground. Keep the screen awake and the app open. Locking the screen may pause GPS and speech on Android.

Later refactor to support background location:

1. Build a development build (EAS or local) so native config is included.
2. Add background location permission and the foreground service settings in `app.json`.
3. Rewrite only `locationService.ts` to use a registered background task plus a foreground-service notification, forwarding positions to the same `onPosition` callback.
4. Move the runner tick to a mechanism that survives backgrounding (timestamp-based timing already covers this).
5. Test cues with the screen off.

Everything in `/domain`, the stores, and the screens stays as is.

## 11. Testing

- Unit tests (Jest) for `flatten`, `geo`, `pace`, `runner`, `cues`, `results`.
- A fake location provider that replays a recorded or generated track at accelerated speed. This lets you test a whole 4x4 session at your desk, including pace alerts.
- Field test: one real session with the screen on, then review the results screen against your watch or another app if you have one.

## 12. Suggested build order

1. Domain types, `flatten`, `geo`, `pace` with tests.
2. Runner and cue scheduler against the fake location provider.
3. Voice and beep services; hear a full simulated session.
4. Real `locationService` (foreground) and the live run screen.
5. Results calculation and screen.
6. Home, templates, and the workout builder.
7. History and settings.

## 13. Risks

- GPS noise on short distance segments (400 m) may shift splits by a few seconds. Accepted for the MVP.
- Expo Go behavior with the screen locked is not guaranteed. Mitigation: screen stays on for the first session.
- Android battery optimization can suspend background work in the later refactor. Plan to prompt the user to exempt the app.
- AsyncStorage size limits are generous for this use, but long histories with dense tracks may need SQLite later.