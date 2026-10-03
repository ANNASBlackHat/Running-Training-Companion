# Running Training Companion: User Stories

Platform: Android. Data: local only. Priority: **M** = must have for the first session, **S** = should have, **C** = could have (stretch).

## 1. Templates and workout builder

**US-1 (M): Pick a template** As a runner, I want to see ready-made workouts when I open the app, so I can start training quickly.

- Home screen lists templates (Norwegian 4x4, 400 m repeats).
- Tapping a template shows its segments and a Start button.

**US-2 (M): Build a custom workout** As a runner, I want to create my own workout from segments, so I can train however I want.

- I can add segments of type warm-up, run, rest, cool-down.
- Each segment has a length by time (min:sec) or distance (m or km).
- I can set a repeat count for a group of run + rest segments.
- I can reorder and delete segments.
- I can name and save the workout locally.

**US-3 (M): Set a target pace** As a runner, I want to set a pace range on a segment, so the app tells me when I'm off target.

- Pace range is entered as min/km (e.g. 4:30 to 4:45).
- A segment without a range gives no pace alerts.

**US-4 (S): Edit a template copy** As a runner, I want to change a template without losing the original, so I can adapt it.

- Editing a template creates my own copy.
- Built-in templates can be restored.

## 2. Live run

**US-5 (M): Start a session** As a runner, I want to start a workout and have the app track me by GPS, so I get live pace and distance.

- App asks for location permission if missing.
- Run begins at the first segment.
- Screen stays on during the session.

**US-6 (M): See what matters at a glance** As a runner, I want a big, simple live screen, so I can read it while moving.

- Shows current segment type, time or distance remaining, current pace, and total distance.
- Shows "set X of Y".
- Numbers are readable at arm's length in daylight.

**US-7 (M): Control the session** As a runner, I want to pause, resume, skip, or stop, so I can handle real life.

- Pause freezes the timer and distance.
- Skip ends the current segment and moves to the next.
- Stop asks for confirmation, then saves what was recorded.

**US-8 (S): Survive a locked screen** As a runner, I want cues to keep working with the screen off, so I can run with the phone in a pocket.

- Tracking and voice cues continue in the background.
- If unsupported in the current setup, the app says so rather than silently failing.

## 3. Voice and sound cues

**US-9 (M): Hear segment changes** As a runner, I want to be told when to run or rest, so I don't watch a clock.

- At each segment start, a voice says the type and length (e.g. "Run, four minutes").
- A short countdown beep plays before each switch.

**US-10 (M): Hear progress** As a runner, I want to know how much is left, so I can pace the effort.

- Cue at halfway and for "one minute left" or "100 metres left" (by segment length).
- After each set, a cue says sets done and sets left.

**US-11 (M): Be warned when pace is off** As a runner, I want an alert when my pace leaves the range, so I can correct it.

- "Too fast" or "too slow" is spoken when pace is out of range.
- Pace uses a short rolling average, and no alert fires in the first seconds of a segment.
- Alerts repeat no more often than a set interval.

**US-12 (S): Choose cue style** As a runner, I want to turn voice or beeps on or off, so cues suit my preference.

- Settings for voice and beeps are separate.
- Volume follows the phone.

## 4. Results

**US-13 (M): See results per segment** As a runner, I want results split the way I set the workout, so I can judge each effort.

- Interval segments show duration, distance, and average pace each (e.g. the 4 min run and the 3 min rest are separate rows).
- 400 m / 1:30 style workouts split the same way.

**US-14 (M): See warm-up and cool-down per km** As a runner, I want easy running split per km, like a normal run.

- Warm-up and cool-down show a per-km pace table.

**US-15 (M): See session totals** As a runner, I want an overall summary.

- Total time, total distance, average pace.

**US-16 (C): See elevation gain**

- Elevation gain per segment and per session where GPS allows.

## 5. History and progress

**US-17 (S): Browse past sessions** As a runner, I want to see what I did before.

- List of sessions with date, workout name, distance.
- Opening one shows its results.
- Stored on the device only.

**US-18 (C): Compare progress by workout type** As a runner, I want to compare sessions of the same workout over time.

- Pick a workout and see average run pace per set across sessions.

## Cut line for the first session

Must-haves: US-1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15. If US-8 (screen off) can't be made to work in time, the session runs with the screen on.