import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';

import type { CueEvent, CuePriority } from '@/domain/cues';

/**
 * Voice, vibration and cue dispatch.
 *
 * Tech Spec section 6 (Voice queue):
 *   "segment changes and countdown beeps are high priority and interrupt
 *    speech. Other cues are low priority and are dropped, not queued, if
 *    something is already playing."
 *
 * UI Style Guide section 7: "Every voice cue is paired with a short vibration
 * pattern and, for pace alerts, the alert pill. This covers the case where
 * audio is quiet or the phone is in a pocket."
 *
 * English only for now; the phrases live in src/theme.ts so adding a language
 * is a data change rather than a refactor.
 */

export type CueChannel = 'voice' | 'beeps';

export interface SpeakOptions {
  /** Interrupt whatever is currently being spoken. */
  interrupt?: boolean;
  /** Skip if speech is already in progress (the low-priority drop rule). */
  skipIfBusy?: boolean;
}

/** True while a voice cue is being spoken. */
let speaking = false;
let configured = false;

export function isSpeaking(): boolean {
  return speaking;
}

export function resetSpeakingState(): void {
  speaking = false;
}

/** Speak a cue. Returns true when speech was actually started. */
export async function speak(
  text: string,
  options: SpeakOptions = {},
): Promise<boolean> {
  const { interrupt = false, skipIfBusy = false } = options;

  // Low-priority cues are dropped rather than queued (section 6).
  if (skipIfBusy && speaking) return false;

  try {
    if (interrupt) {
      await Speech.stop();
      speaking = false;
    }

    speaking = true;
    Speech.speak(text, {
      rate: 1.0,
      // The flag must follow the real speech lifecycle, otherwise every cue
      // after the first would be treated as "already speaking" and dropped.
      onDone: () => {
        speaking = false;
      },
      onStopped: () => {
        speaking = false;
      },
      onError: () => {
        speaking = false;
      },
    });
    return true;
  } catch {
    speaking = false;
    return false;
  }
}

/** Mark speech finished; called by the audio completion callback in Phase 4. */
export function markSpeechFinished(): void {
  speaking = false;
}

export function stopSpeaking(): void {
  speaking = false;
  Speech.stop();
}

/** Short vibration paired with a voice cue (UI Style Guide section 7). */
export async function vibrate(
  pattern: CueEvent['vibrate'],
): Promise<void> {
  if (!pattern) return;
  try {
    if (pattern === 'alert') {
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Warning,
      );
      return;
    }
    await Haptics.impactAsync(
      pattern === 'long'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light,
    );
  } catch {
    // Vibration is a nicety; never let it break a session.
  }
}

/** Stop all audio output, used when a session is paused or stopped. */
export async function silence(): Promise<void> {
  stopSpeaking();
}

/**
 * Configure the audio session once per session.
 *
 * Tech Spec section 6: "Audio focus: configure so music from other apps ducks
 * during cues, not stops."
 *
 * playsInSilentMode is set because a runner's phone is often on vibrate, and on
 * Android playback is otherwise suppressed in that state. Without it the
 * countdown beeps would silently fail outdoors.
 */
export async function configureAudioSession(): Promise<void> {
  if (configured) return;
  try {
    const { setAudioModeAsync } = await import('expo-audio');
    await setAudioModeAsync({
      interruptionMode: 'duckOthers',
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    });
    configured = true;
  } catch {
    // Audio focus is best effort; the session still works without it.
  }
}

export function resetAudioSession(): void {
  configured = false;
}