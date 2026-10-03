# Running Training Companion: UI Style Guide

Platform: Android, React Native (Expo). Light theme only for the MVP.

## 1. Design direction

**Subject:** an interval-training coach used outdoors, mid-effort, in bright sun, with sweaty hands and a glance of one to two seconds at the screen.

**Primary job:** the live run screen. Everything else supports it.

**Core idea:** the screen's color tells you what to do before you read anything. Each segment type owns a color, and the live screen is flooded with it. A strong color change means a new instruction: run, rest, or easy running.

**The memorable element:** the **pace lane**. The target pace range is drawn as a highlighted lane, and your current pace is a marker inside or outside it. You see "off pace" by position, with no numbers to compare.

**Second structural device:** the **session strip**, a horizontal row of blocks whose widths match segment length. It appears in templates, the builder, the live screen, and results, so one shape teaches the user what a workout is.

Everything else stays quiet: flat color, no shadows, no gradients, no decorative icons.

## 2. Color tokens

| Token | Hex | Use |
| --- | --- | --- |
| ink | `#101B3B` | Primary text, outlines, rest-screen text |
| run | `#2340E6` | Run segments (live screen background, strip blocks, primary buttons) |
| rest | `#CFE6DB` | Rest segments |
| base | `#55657A` | Warm-up and cool-down |
| paper | `#F4F6F9` | Background of non-run screens |
| alert | `#FFB200` | Out-of-range pace marker and alert pill only |

Derived: `inkMuted #4B587A` for secondary text, `line #D5DAE2` for dividers.

Text on run and base uses white. Text on rest and paper uses ink. Alert is never used as text color; alert pills carry ink text.

Contrast (approx.): white on run 7:1, white on base 6:1, ink on rest 13:1, ink on alert 9:1, inkMuted on paper 6.5:1.

Color is never the only signal. Segment type is also written as a word, and out-of-range pace also shows an arrow and the words "Too fast" or "Too slow".

## 3. Typography

| Role | Face | Notes |
| --- | --- | --- |
| Numbers and headings | Barlow Condensed (SemiBold, Bold) | Tall and narrow, so large digits fit one line |
| Body and labels | Barlow (Regular, Medium) | Same family, normal width |

All numbers use tabular figures (`fontVariant: ['tabular-nums']`) so digits don't jitter as the timer ticks.

Scale (sp):

| Style | Size | Weight | Where |
| --- | --- | --- | --- |
| timerXL | 132 | Bold | Segment time or distance remaining on the live screen |
| paceL | 64 | SemiBold | Live pace |
| title | 28 | SemiBold | Screen titles |
| heading | 20 | SemiBold | Section headings, segment name on live screen |
| body | 16 | Regular | General text, list rows |
| caption | 13 | Medium | Units, secondary info |

Sentence case everywhere. No all-caps labels, no eyebrow text above headings. Line length stays short on a phone, so no extra rules needed.

Verify the font package names when installing (`@expo-google-fonts/barlow` and `@expo-google-fonts/barlow-condensed`).

## 4. Shape, space, surface

- 4 dp spacing grid: 4, 8, 12, 16, 24, 32.
- Screen padding 20 dp. Live screen padding 24 dp.
- Radii differ by role: strip blocks 3 dp, buttons 14 dp, bottom sheets 24 dp top corners. No other rounding.
- No shadows. Separation comes from color fields and 1 dp `line` dividers.
- Lists use rows with dividers, not stacks of identical cards.
- Touch targets: 48 dp minimum; live-screen controls 64 dp tall.

## 5. Signature components

### Session strip

A horizontal bar of blocks. Block width is proportional to segment duration. Distance segments use an estimated duration from the target pace, or from 5:30/km if none is set, and the strip is only a visual guide.

- Block fill follows segment type (run, rest, base).
- Rest blocks get a 1.5 dp ink outline so they read on the paper background.
- Repeated sets sit side by side with a 2 dp gap between blocks.
- Live screen: finished blocks are dimmed, the current block shows a progress fill, upcoming blocks are full color.
- Results screen: block height scales with pace for run segments, so slow and fast sets are visible at a glance (optional, after the first session).

### Pace lane

A horizontal lane about 56 dp tall.

- The lane's full range is the target pace range plus a margin (about 30 s/km each side).
- The target range is a lighter band with solid edges.
- Faster pace is to the right, slower to the left.
- A round marker slides along the lane as the rolling pace changes, with gentle smoothing.
- In range: marker is white on the run screen.
- Out of range: marker turns alert, and an alert pill appears next to it with an arrow and "Too fast" or "Too slow".
- When there is no target range, the lane is hidden and pace shows as plain text.
- When pace is unknown (GPS settling or standing still), the lane shows a dashed marker and the pace reads "No pace yet".

### Buttons

- Primary: filled with `run`, white text, 14 dp radius, 56 to 64 dp tall.
- Secondary: 2 dp ink outline, ink text.
- Destructive actions on the live screen (stop) require holding for one second, with a visible fill showing the hold progress, to avoid accidental taps.

## 6. Screen layouts

### Live run

Background is the active segment's color.

```
+--------------------------------+
| Run                    Set 2 of 4 |
|                                |
|            3:12                |
|         of 4:00                |
|                                |
|   4:38 /km                     |
|   [  lane with marker  ]       |
|   target 4:30 to 4:45          |
|                                |
|   [ session strip         ]    |
|   1.84 km          18:22       |
|                                |
|  [Pause]  [Skip]  [Hold to stop] |
+--------------------------------+
```

- Content is left-aligned except the timer, which is centered.
- Segment name uses heading, set count uses caption.
- On rest segments, the lane is hidden and the timer counts down in ink on the mint background.
- On distance segments, the timer shows remaining distance (e.g. "260 m").

### Home

- Title "Workouts".
- Two groups: "Templates" and "My workouts". Each row shows the name, total time or distance as caption, and the session strip below the name.
- Primary button "New workout" fixed at the bottom.
- History opens from a text button at the top right.

### Workout detail

- Name, session strip at full width, list of segments underneath (type, length, pace range).
- "Start workout" fixed at the bottom. Secondary "Edit" at the top right.

### Builder

- Session strip at the top. Tapping a block opens a bottom sheet to edit it.
- Sheet fields: type, length mode (time or distance), length value, pace range (optional), repeat count when the block is part of a set.
- Buttons: "Add segment", "Add set" (repeat group), "Save workout".

### Results

- Top: totals (time, distance, average pace).
- Strip: the session strip with per-block results visible.
- Table of segments: name, duration, distance, pace. Run segments in a set are grouped, and the fastest and slowest set are marked with words, not only color.
- Warm-up and cool-down expand to show per-km splits.

### Settings

Two toggles: voice cues, beep cues. A cue test button: "Play test cue".

## 7. Motion and feedback

- Only motion that answers an action or conveys state: the pace marker sliding, the segment color changing, the hold-to-stop fill.
- Segment change: the background color transitions over 250 ms. This is the one deliberate animation moment.
- No entrance animations on lists or screens.
- Respect the system "remove animations" setting: colors switch instantly and the marker moves without easing.
- Every voice cue is paired with a short vibration pattern and, for pace alerts, the alert pill. This covers the case where audio is quiet or the phone is in a pocket.

## 8. Copy

Plain verbs, sentence case, no apologies in errors. An action keeps the same name throughout.

| Place | Text |
| --- | --- |
| Start button | Start workout |
| Pause / resume | Pause, Resume |
| Skip | Skip segment |
| Stop | Hold to stop |
| Save in builder | Save workout |
| Finish confirmation | Workout saved |
| GPS settling | Waiting for GPS. Stay outside until the signal is ready. |
| Location off | Location is off. Turn it on to track pace and distance. |
| Location denied | Location permission is needed to track pace. Open settings to allow it. |
| Empty history | No sessions yet. Start a workout to see results here. |
| Pace unknown | No pace yet |

Voice cues use short, spoken phrasing: "Run. Four minutes." "Set two of four." "Too slow." "Workout complete."

## 9. Accessibility

- Text contrast at least 4.5:1, and live-screen text at least 7:1 (values in section 2).
- Support system font scaling on regular screens. The live-screen timer has a fixed layout and is capped so it never wraps.
- Minimum touch target 48 dp.
- Segment type, set count, and pace status always have a text form.
- Screen reader labels on controls and on the live values (e.g. "Pace 4 minutes 38 seconds per kilometre, too slow").
- Light theme chosen for daytime outdoor readability. Dark mode is out of scope for the MVP.

## 10. Review of the plan against common defaults

First drafts that were rejected:

- Near-black background with a bright acid-green accent. This is the default look of running apps, so it would not be distinct. Replaced with segment-driven color fields.
- A warm track-red as the main color. Too close to the terracotta tint that generated designs fall into. Replaced with cobalt for effort and mint for recovery.
- Identical rounded cards for workouts. Replaced with divided rows plus the session strip, which carries real information.

## 11. Implementation notes

Theme tokens as a single file, so styling stays consistent:

```ts
// theme.ts
export const color = {
  ink: '#101B3B',
  inkMuted: '#4B587A',
  run: '#2340E6',
  rest: '#CFE6DB',
  base: '#55657A',
  paper: '#F4F6F9',
  line: '#D5DAE2',
  alert: '#FFB200',
  white: '#FFFFFF',
};

export const segmentColor = {
  run: { bg: color.run, fg: color.white },
  rest: { bg: color.rest, fg: color.ink },
  warmup: { bg: color.base, fg: color.white },
  cooldown: { bg: color.base, fg: color.white },
};

export const radius = { block: 3, button: 14, sheet: 24 };
export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };

export const type = {
  timerXL: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 132, fontVariant: ['tabular-nums'] },
  paceL:   { fontFamily: 'BarlowCondensed_600SemiBold', fontSize: 64, fontVariant: ['tabular-nums'] },
  title:   { fontFamily: 'BarlowCondensed_600SemiBold', fontSize: 28 },
  heading: { fontFamily: 'BarlowCondensed_600SemiBold', fontSize: 20 },
  body:    { fontFamily: 'Barlow_400Regular', fontSize: 16 },
  caption: { fontFamily: 'Barlow_500Medium', fontSize: 13 },
} as const;
```

Build the live screen and the session strip first. They carry the identity of the app, and the other screens follow from them.