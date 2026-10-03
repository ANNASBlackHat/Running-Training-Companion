# Device verification checklist

Items that **cannot** be confirmed from code or unit tests. Each needs a real
Android phone (or emulator for some) and, for some, actual outdoor running.

Track these off as they are confirmed. They are the remaining risk in the MVP:
all 215 automated tests pass, but none of them exercise native audio, native
GPS, or outdoor legibility.

## 1. Countdown beeps with the ringer on vibrate — HIGH

**Why:** `expo-audio` suppresses playback on Android when the ringer is silent or
vibrate, unless `playsInSilentMode: true`. We set it explicitly in
`configureAudioSession()` (`src/services/voiceService.ts`), but the specs never
mention it and it cannot be verified without a device. A runner's phone is very
often on vibrate, so if this is wrong the countdown fails silently outdoors.

**How:** Run a workout with the ringer set to vibrate. Confirm the three countdown
beeps and the switch beep are all audible.

**If it fails:** keep `playsInSilentMode: true` and confirm the config plugin is
actually applied by rebuilding, not reloading.

## 2. Music ducks, it does not stop — MEDIUM

**Why:** Tech Spec section 6 requires "music from other apps ducks during cues,
not stops". Implemented as `interruptionMode: 'duckOthers'`. The Tech Spec itself
says "Verify on device."

**How:** Start music playback, then run a workout with voice cues enabled.
Confirm the music volume drops while a cue speaks and recovers afterwards.

## 3. Daylight legibility — MEDIUM

**Why:** User Stories US-6: "Numbers are readable at arm's length in daylight."
The UI Style Guide specifies `timerXL` at 132 sp and 7:1 contrast, but no test
can judge whether a glance of one to two seconds in bright sun is enough.

**How:** Outdoor, direct sun, sweaty hands. One glance per segment. Confirm the
timer, pace and set count are all readable without holding the phone.

## 4. GPS settling behaviour — LOW

**Why:** Section 5 discards the first few seconds of fixes. The start screen is
meant to show "Waiting for GPS. Stay outside until the signal is ready."
Confirm this actually appears rather than an instant start with bad pace.

**How:** Start a workout indoors or with poor signal, watch the first seconds.

## 5. Battery over a long session — LOW

**Why:** MVP Scope risk table: "Battery drain | Long sessions with GPS and
screen on | Keep the live screen simple."

**How:** Run a full 45+ minute workout. Note battery percentage before and after.

## 6. Screen lock behaviour (Expo Go) — INFORMATIONAL

**Why:** Tech Spec section 10 notes Expo Go may pause GPS and speech when the
screen locks. MVP Scope accepts "keep the screen awake" as the MVP fallback, and
`expo-keep-awake` is wired. Usable out of the box via US-8's fallback, so this is
informational rather than blocking.

**How:** Optionally lock the screen mid-workout and observe.

---

## Deferred, not forgotten

- **US-8 (cues with the screen off)** — the designated sacrifice in the User
  Stories cut line. Requires the Phase 9 dev build.
- **US-16 (elevation gain)** — marked C, and MVP Scope puts it under stretch.
  Deliberately not implemented.
- **US-18 (compare progress across sessions)** — marked C. `sessionsForWorkout`
  exists in `src/store/sessions.ts` as groundwork, but no UI.

## Phase 9 field test

The MVP's actual success criterion (MVP Scope section 7) is one real session,
screen on, then compare the results screen against a watch or another app. Do
this **before** attempting the background-location refactor.
MSGEOF