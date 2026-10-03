import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { color, radius, segmentColor, space, type } from '@/theme';
import { describeLength, describePaceRange, isEmptyWorkout, SEGMENT_LABEL } from '@/domain/describe';
import { flatten } from '@/domain/flatten';
import { useWorkoutStore } from '@/store/workouts';
import { SessionStrip } from '@/components/SessionStrip';

/**
 * Workout detail.
 *
 * UI Style Guide section 6 (Workout detail):
 *   'Name, session strip at full width, list of segments underneath (type,
 *    length, pace range). "Start workout" fixed at the bottom. Secondary "Edit"
 *    at the top right.'
 */

export default function WorkoutDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const workouts = useWorkoutStore((s) => s.workouts);
  const templates = useWorkoutStore((s) => s.templates);

  const workout = [...workouts, ...templates].find((w) => w.id === id);
  if (!workout) return null;

  const segments = flatten(workout);
  const empty = isEmptyWorkout(workout);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={[type.title, styles.name, { color: color.ink }]}>
          {workout.name}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit"
          onPress={() => router.push('/workout/edit')}
        >
          <Text style={[type.body, { color: color.run }]}>Edit</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!empty ? (
          <View style={styles.strip}>
            <SessionStrip segments={segments} height={28} />
          </View>
        ) : null}

        {segments.map((entry) => {
          const palette = segmentColor[entry.segment.type];
          const pace = describePaceRange(entry.segment);

          return (
            <View key={entry.index} style={styles.row}>
              <View style={[styles.swatch, { backgroundColor: palette.bg }]} />
              <View style={styles.rowLabel}>
                <Text style={[type.body, { color: color.ink }]}>
                  {SEGMENT_LABEL[entry.segment.type]}
                  {entry.setNumber !== undefined && entry.setTotal !== undefined
                    ? ` · Set ${entry.setNumber} of ${entry.setTotal}`
                    : ''}
                </Text>
                {pace ? (
                  <Text style={[type.caption, { color: color.inkMuted }]}>
                    target {pace}
                  </Text>
                ) : null}
              </View>
              <Text style={[type.caption, styles.length, { color: color.ink }]}>
                {describeLength(entry.segment.length)}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start workout"
          // US-4: editing a template produces a copy the user owns.
          onPress={() => {
            const target = workout.isTemplate
              ? useWorkoutStore.getState().createFromTemplate(workout.id)
              : workout.id;
            router.push({ pathname: '/run', params: { workoutId: target ?? workout.id } });
          }}
          disabled={empty}
          style={({ pressed }) => [
            styles.primary,
            empty && styles.primaryDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[type.body, { color: color.white }]}>
            {empty ? 'Add a segment to start' : 'Start workout'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
    paddingBottom: space.m,
  },
  name: { flex: 1, marginRight: space.m },
  content: { paddingHorizontal: space.xl, paddingBottom: space.xxl },
  strip: { marginBottom: space.l },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.m,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  swatch: { width: 4, height: 28, borderRadius: 2, marginRight: space.s },
  rowLabel: { flex: 1 },
  length: { fontVariant: ['tabular-nums'] },
  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.m,
    paddingBottom: space.xl,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  primary: {
    backgroundColor: color.run,
    borderRadius: radius.button,
    paddingVertical: space.l,
    alignItems: 'center',
  },
  primaryDisabled: { backgroundColor: color.line },
  pressed: { opacity: 0.7 },
});
