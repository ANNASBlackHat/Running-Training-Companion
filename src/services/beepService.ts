import { createAudioPlayer, preload, type AudioPlayer } from 'expo-audio';

/**
 * Countdown beeps.
 *
 * Tech Spec section 1 lists "Short bundled sound files for countdown", and the
 * section 6 cue table requires: "Countdown | Last 3 s of a time segment |
 * Three beeps, long beep on switch".
 *
 * The two assets are generated 16-bit PCM tones in assets/sounds. Players are
 * created once and reused so playback has no loading delay, which matters
 * because the beeps land on exact seconds.
 */

export type BeepKind = 'tick' | 'switch' | 'alert';

const TICK = require('../../assets/sounds/beep.wav') as number;
const SWITCH = require('../../assets/sounds/switch.wav') as number;

/**
 * The alert reuses the switch tone; it is distinguished by the alert pill and
 * a warning vibration (UI Style Guide section 7) rather than a separate sound.
 */
const SOURCES: Record<BeepKind, number> = {
  tick: TICK,
  switch: SWITCH,
  alert: SWITCH,
};

let players: Partial<Record<BeepKind, AudioPlayer>> = {};
let preloaded = false;
let enabled = true;

export function setBeepsEnabled(value: boolean): void {
  enabled = value;
}

/** Warm the sources so the first beep is instant. Call at session start. */
export async function prepareBeeps(): Promise<void> {
  if (preloaded) return;
  try {
    await Promise.all([preload(TICK), preload(SWITCH)]);
    preloaded = true;
  } catch {
    // Preload is an optimisation; playback still works without it.
  }
}

function playerFor(kind: BeepKind): AudioPlayer | null {
  const existing = players[kind];
  if (existing) return existing;

  try {
    const created = createAudioPlayer(SOURCES[kind], {
      // Bundled assets are already local, so downloadFirst is unnecessary.
      downloadFirst: false,
    });
    players[kind] = created;
    return created;
  } catch {
    return null;
  }
}

/** Play a beep. Silently does nothing when beeps are switched off. */
export function beep(kind: BeepKind): void {
  if (!enabled) return;
  const player = playerFor(kind);
  if (!player) return;

  try {
    // Rewind so a rapid repeat still produces a full tone.
    void player.seekTo(0);
    player.volume = 1;
    player.play();
  } catch {
    // Never let a missing sound interrupt a running session.
  }
}

/** Release players; called when a session ends to free memory. */
export function releaseBeeps(): void {
  for (const kind of Object.keys(players) as BeepKind[]) {
    try {
      players[kind]?.remove();
    } catch {
      // Ignore removal failures.
    }
  }
  players = {};
  preloaded = false;
}

/** Test seam: forget cached players and flags without touching the native module. */
export function resetBeepService(): void {
  players = {};
  preloaded = false;
  enabled = true;
}