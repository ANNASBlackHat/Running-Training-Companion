import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { color, radius, space, type } from '@/theme';
import {
  describeSetCount,
  describeWorkoutTotal,
  isEmptyWorkout,
} from '@/domain/describe';
import { flatten } from '@/domain/flatten';
import type { Workout } from '@/domain/types';
import { useWorkoutStore } from '@/store/workouts';
import { useSessionStore } from '@/store/sessions';
import { SessionStrip } from '@/components/SessionStrip';
import {
  describeSnapshot,
  isRecoverable,
  recoverSession,
  type InProgressSnapshot,
} from '@/domain/recovery';
import { clearInProgressSession, loadInProgressSession } from '@/services/storage';

/**
 * Home.
 *
 * UI Style Guide section 6 (Home):
 *   'Title "Workouts". Two groups: "Templates" and "My workouts". Each row shows
 *    the name, total time or distance as caption, and the session strip below
 *    the name. Primary button "New workout" fixed at the bottom. History opens
 *    from a text button at the top right.'
 *
 * Covers US-1 (pick a template) and US-2/3/4 entry points.
 */

function WorkoutRow({ workout, onPress }: { workout: Workout; onPress: () => void }) {
  const sets = describeSetCount(workout);
  const empty = isEmptyWorkout(workout);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${workout.name}. ${
        empty ? 'No segments yet.' : describeWorkoutTotal(workout)
      }`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Text style={[type.body, styles.rowName, { color: color.ink }]}>
        {workout.name}
      </Text>
      <Text style={[type.caption, { color: color.inkMuted }]}>
        {empty ? 'No segments yet' : describeWorkoutTotal(workout)}
        {sets ? ` · ${sets} sets` : ''}
      </Text>
      {empty ? null : (
        <View style={styles.strip}>
          <SessionStrip segments={flatten(workout)} height={16} />
        </View>
      )}
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const workouts = useWorkoutStore((s) => s.workouts);
  const templates = useWorkoutStore((s) => s.templates);
  const saveSession = useSessionStore((s) => s.saveSession);

  // Section 8: offer to keep a session that a crash interrupted.
  const [snapshot, setSnapshot] = useState<InProgressSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadInProgressSession<InProgressSnapshot>().then((found) => {
      if (!cancelled && isRecoverable(found)) setSnapshot(found);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const go = (workout: Workout) => router.push(`/workout/${workout.id}`);

  const recover = () => {
    if (!snapshot) return;
    const workout = [...workouts, ...templates].find((w) => w.id === snapshot.workoutId);
    if (workout) {
      saveSession(recoverSession(snapshot, workout, `recovered-${snapshot.savedAt}`));
    }
    void clearInProgressSession();
    setSnapshot(null);
  };

  const discard = () => {
    void clearInProgressSession();
    setSnapshot(null);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={[type.title, { color: color.ink }]}>Workouts</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="History"
          onPress={() => router.push('/history')}
        >
          <Text style={[type.body, { color: color.run }]}>History</Text>
        </Pressable>
      </View>

      {/* Section 8: a session interrupted by a crash is offered back. */}
      {snapshot ? (
        <View style={styles.recovery}>
          <Text style={[type.body, { color: color.ink }]}>
            Unfinished workout found
          </Text>
          <Text style={[type.caption, { color: color.inkMuted }]}>
            {describeSnapshot(snapshot)} was recorded before the app closed.
          </Text>
          <View style={styles.recoveryActions}>
            <Pressable
              accessibilityRole='button'
              accessibilityLabel='Keep unfinished workout'
              onPress={recover}
              style={styles.recoveryPrimary}
            >
              <Text style={[type.caption, { color: color.white }]}>Keep</Text>
            </Pressable>
            <Pressable
              accessibilityRole='button'
              accessibilityLabel='Discard unfinished workout'
              onPress={discard}
              style={styles.recoverySecondary}
            >
              <Text style={[type.caption, { color: color.ink }]}>Discard</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.list}>
        <Text style={[type.caption, styles.groupHeading, { color: color.inkMuted }]}>
          Templates
        </Text>
        {templates.map((t) => (
          <WorkoutRow key={t.id} workout={t} onPress={() => go(t)} />
        ))}

        <Text style={[type.caption, styles.groupHeading, { color: color.inkMuted }]}>
          My workouts
        </Text>
        {workouts.length === 0 ? (
          <Text style={[type.body, styles.empty, { color: color.inkMuted }]}>
            No workouts yet. Start from a template or make your own.
          </Text>
        ) : (
          workouts.map((w) => <WorkoutRow key={w.id} workout={w} onPress={() => go(w)} />)
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New workout"
          onPress={() => router.push('/workout/edit')}
          style={({ pressed }) => [styles.primary, pressed && styles.rowPressed]}
        >
          <Text style={[type.body, { color: color.white }]}>New workout</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.paper,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
    paddingBottom: space.m,
  },
  list: {
    paddingHorizontal: space.xl,
    paddingBottom: space.xxl,
  },
  recovery: {
    marginHorizontal: space.xl,
    marginTop: space.m,
    padding: space.m,
    borderRadius: radius.button,
    backgroundColor: color.white,
    borderWidth: 1,
    borderColor: color.line,
  },
  recoveryActions: {
    flexDirection: 'row',
    gap: space.s,
    marginTop: space.m,
  },
  recoveryPrimary: {
    minHeight: 48,
    paddingHorizontal: space.l,
    borderRadius: radius.button,
    backgroundColor: color.run,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recoverySecondary: {
    minHeight: 48,
    paddingHorizontal: space.l,
    borderRadius: radius.button,
    borderWidth: 2,
    borderColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupHeading: {
    marginTop: space.l,
    marginBottom: space.s,
  },
  row: {
    paddingVertical: space.m,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowName: {
    marginBottom: 2,
  },
  strip: {
    marginTop: space.s,
  },
  empty: {
    paddingVertical: space.m,
  },
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
});
