import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Settings store.
 *
 * User Stories US-12: "I want to turn voice or beeps on or off, so cues suit
 * my preference." The toggles are independent.
 *
 * UI Style Guide section 6 (Settings): "Two toggles: voice cues, beep cues.
 * A cue test button."
 */

interface SettingsState {
  /** Voice cues on or off. */
  voiceEnabled: boolean;
  /** Beep cues on or off. */
  beepsEnabled: boolean;
  setVoiceEnabled: (value: boolean) => void;
  setBeepsEnabled: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      voiceEnabled: true,
      beepsEnabled: true,
      setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
      setBeepsEnabled: (beepsEnabled) => set({ beepsEnabled }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => AsyncStorage),
      // Only the two flags are persisted, not the setters.
      partialize: (state) => ({
        voiceEnabled: state.voiceEnabled,
        beepsEnabled: state.beepsEnabled,
      }),
    },
  ),
);