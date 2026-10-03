# Running Training Companion: MVP Scope

## Goal

A phone app that guides an interval session by voice and records results per segment. It must be usable at the next training session.

## Success criteria (tomorrow's session)

- Start a Norwegian-style workout (warm-up, 4 x (4 min run / 3 min rest), cool-down) and be guided by voice with the phone in a pocket or hand.
- Hear a cue at every segment change and whenever pace leaves the target range.
- After the run, see results split per segment, not just per km.

## Constraints

- Expo, for fast testing without building an APK each time.
- No backend, no API. All data stored locally on the device.
- Simple MVP. Anything that does not serve the core loop waits.

## In scope (MVP)

**1. Workout model** A workout is an ordered list of segments. Each segment has:

- Type: warm-up, run, rest, cool-down
- Length: by time (min:sec) or distance (m / km)
- Optional target pace range (min/km)
- Repeat count (for sets)

**2. Templates** A few built-in templates on the home screen (Norwegian 4x4, 400 m repeats). Templates are copies the user can edit.

**3. Workout builder** Create or edit a workout: add, remove, reorder segments, set length, pace range, and repeats.

**4. Live run screen**

- Current pace, segment time or distance remaining, total distance
- Set counter: "set 2 of 4", sets done and sets left
- Pause, resume, skip segment, stop
- Large numbers readable at a glance; audio carries most of the guidance

**5. Voice and sound cues**

- Segment start: "Run" or "Rest" plus its length
- Countdown before a switch (beeps for the last few seconds)
- Halfway cue and "X minutes left" / "400 m left"
- Pace too fast or too slow, with a cooldown so it doesn't nag
- Sets remaining after each set

**6. Results**

- Per segment: duration, distance, average pace
- Warm-up and cool-down split per km
- Interval segments split per set segment (e.g. 4 min run pace, 3 min rest pace)
- Session totals

**7. Local history** List of past sessions, saved on the device.

## Stretch (only if the core loop works)

- Elevation gain per segment and session
- Progress comparison across sessions of the same workout type

## Out of scope

- Accounts, login, cloud sync, sharing, social features
- Map or route display, GPX export
- Heart rate sensors, smartwatch support
- Music integration
- Training plans or coaching logic

## Risks

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Background GPS and audio with the screen off may not work in Expo Go | The core experience depends on it | Early test; if needed, a one-time development build. Fallback: keep the screen awake |
| GPS pace is noisy | False pace alerts are annoying | Rolling average (10-15 s) plus a grace period at segment start |
| Distance-based segments depend on GPS accuracy | 400 m splits can drift | Accept small error for the MVP; note it in results |
| Battery drain | Long sessions with GPS and screen on | Keep the live screen simple |

## Open questions

1. Target platform: Android or iOS?
2. Voice language for cues: English, Indonesian, or switchable?
3. Pace unit: min/km only?
4. Should pace alerts be voice, beep, or both?