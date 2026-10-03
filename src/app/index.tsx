import { StyleSheet, Text, View } from 'react-native';
import { color, copy, space, type } from '@/theme';

/**
 * Temporary home screen. Replaced in Phase 6 with templates + my workouts
 * (UI Style Guide section 6, "Home").
 */
export default function HomeScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Workouts</Text>
      <Text style={styles.note}>{copy.gpsSettling}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.paper,
    padding: space.xl,
  },
  title: {
    ...type.title,
    color: color.ink,
  },
  note: {
    ...type.body,
    color: color.inkMuted,
    marginTop: space.m,
  },
});