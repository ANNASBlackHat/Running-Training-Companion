import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { color, radius, space, type } from '@/theme';
import { useSettingsStore } from '@/store/settings';
import { setBeepsEnabled } from '@/services/beepService';
import { dispatchCue, prepareSessionAudio } from '@/services/cueService';
import type { CueEvent } from '@/domain/cues';

/**
 * Settings.
 *
 * UI Style Guide section 6: "Two toggles: voice cues, beep cues. A cue test
 * button: 'Play test cue'." User Stories US-12 keeps the two independent.
 */

const TEST_CUE: CueEvent = {
  kind: 'segmentStart',
  text: 'Run. Four minutes.',
  priority: 'high',
  segmentIndex: 0,
  at: 0,
  vibrate: 'long',
};

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={[type.body, { color: color.ink }]}>{label}</Text>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} />
    </View>
  );
}

export default function SettingsScreen() {
  const voiceEnabled = useSettingsStore((s) => s.voiceEnabled);
  const beepsEnabled = useSettingsStore((s) => s.beepsEnabled);
  const setVoiceEnabled = useSettingsStore((s) => s.setVoiceEnabled);
  const setBeepsEnabledStored = useSettingsStore((s) => s.setBeepsEnabled);

  const setBeeps = (v: boolean) => {
    setBeepsEnabledStored(v);
    setBeepsEnabled(v);
  };

  const testCue = async () => {
    await prepareSessionAudio();
    setBeepsEnabled(beepsEnabled);
    await dispatchCue(TEST_CUE, { voiceEnabled, beepsEnabled });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={[type.title, { color: color.ink }]}>Settings</Text>

      <ToggleRow
        label="Voice cues"
        value={voiceEnabled}
        onChange={setVoiceEnabled}
      />
      <ToggleRow label="Beep cues" value={beepsEnabled} onChange={setBeeps} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Play test cue"
        onPress={testCue}
        style={styles.test}
      >
        <Text style={[type.body, { color: color.white }]}>Play test cue</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  content: { padding: space.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.m,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
    minHeight: 56,
  },
  test: {
    marginTop: space.xl,
    minHeight: 48,
    backgroundColor: color.run,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
