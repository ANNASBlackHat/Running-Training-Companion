import type { CueEvent } from '@/domain/cues';
import { beep, prepareBeeps } from './beepService';
import {
  configureAudioSession,
  isSpeaking,
  speak,
  vibrate,
} from './voiceService';

/**
 * Cue dispatcher: turns domain cue events into sound and vibration.
 *
 * Tech Spec section 6 (Voice queue): "segment changes and countdown beeps are
 * high priority and interrupt speech. Other cues are low priority and are
 * dropped, not queued, if something is already playing."
 *
 * Every cue also fires a vibration (UI Style Guide section 7), which is what
 * makes the app usable when the phone is in a pocket or the ringer is on
 * vibrate.
 */

export interface CueDispatchOptions {
  /** Respect the voice toggle in settings (US-12). */
  voiceEnabled?: boolean;
  /** Respect the beep toggle in settings (US-12). */
  beepsEnabled?: boolean;
}

/** Which beep, if any, a cue produces. */
function beepFor(event: CueEvent): 'tick' | 'switch' | 'alert' | null {
  switch (event.kind) {
    case 'countdownBeep':
      return 'tick';
    case 'countdownSwitch':
      return 'switch';
    case 'paceAlert':
      return 'alert';
    default:
      return null;
  }
}

/** Dispatch a single cue. */
export async function dispatchCue(
  event: CueEvent,
  options: CueDispatchOptions = {},
): Promise<void> {
  const { voiceEnabled = true } = options;

  // Vibration accompanies every cue, independent of the audio toggles.
  void vibrate(event.vibrate);

  const sound = beepFor(event);
  if (sound && options.beepsEnabled !== false) {
    beep(sound);
  }

  if (!voiceEnabled || event.text === null) return;

  if (event.priority === 'high') {
    // Segment changes interrupt; countdown beeps are silent and handled above.
    if (event.kind === 'segmentStart' || event.kind === 'setAnnouncement') {
      await speak(event.text, { interrupt: true });
    } else {
      await speak(event.text, { interrupt: false });
    }
    return;
  }

  // Low priority: dropped, not queued, if speech is already playing.
  await speak(event.text, { interrupt: false, skipIfBusy: isSpeaking() });
}

/** Dispatch a batch of cues in order. */
export async function dispatchCues(
  events: CueEvent[],
  options: CueDispatchOptions = {},
): Promise<void> {
  for (const event of events) {
    // eslint-disable-next-line no-await-in-loop
    await dispatchCue(event, options);
  }
}

/** Prepare audio for a session: warm assets and set the audio focus mode. */
export async function prepareSessionAudio(): Promise<void> {
  await Promise.all([configureAudioSession(), prepareBeeps()]);
}