import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { color, copy, radius, segmentColor, space, type } from '@/theme';
import { describeLength, describePaceRange, makeSegmentItem, newSegmentId, SEGMENT_LABEL } from '@/domain/describe';
import { flatten } from '@/domain/flatten';
import type { Segment, Workout, WorkoutItem } from '@/domain/types';
import { useWorkoutStore } from '@/store/workouts';
import { SessionStrip } from '@/components/SessionStrip';
import { SegmentSheet } from '@/components/SegmentSheet';

/**
 * Workout builder.
 *
 * UI Style Guide section 6 (Builder): "Session strip at the top. Tapping a
 * block opens a bottom sheet to edit it. Buttons: 'Add segment', 'Add set'
 * (repeat group), 'Save workout'."
 *
 * Covers US-2 (build a custom workout), US-3 (set a target pace) and US-4
 * (editing a template creates a copy).
 */

const NEW_WORKOUT: Workout = {
  id: '',
  name: 'New workout',
  isTemplate: false,
  items: [],
};

/** Replace one segment inside a workout's items, wherever it lives. */
function updateSegmentInItems(
  items: WorkoutItem[],
  targetId: string,
  next: Segment,
): WorkoutItem[] {
  return items.map((item) => {
    if (item.kind === 'segment') {
      return item.segment.id === targetId ? { kind: 'segment', segment: next } : item;
    }
    if (item.kind === 'repeat') {
      return {
        ...item,
        segments: item.segments.map((s) => (s.id === targetId ? next : s)),
      };
    }
    return item;
  });
}

/** Remove one segment from wherever it lives. */
function removeSegmentFromItems(items: WorkoutItem[], targetId: string): WorkoutItem[] {
  return items
    .map((item) => {
      if (item.kind === 'segment') {
        return item.segment.id === targetId ? null : item;
      }
      if (item.kind === 'repeat') {
        const kept = item.segments.filter((s) => s.id !== targetId);
        return kept.length === 0 ? null : { ...item, segments: kept };
      }
      return item;
    })
    .filter((i): i is WorkoutItem => i !== null);
}

export default function BuilderScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const workouts = useWorkoutStore((s) => s.workouts);
  const templates = useWorkoutStore((s) => s.templates);
  const saveWorkout = useWorkoutStore((s) => s.saveWorkout);

  const [draft, setDraft] = useState<Workout>(() => {
    const existing = id ? [...workouts, ...templates].find((w) => w.id === id) : undefined;
    if (!existing) return NEW_WORKOUT;
    // US-4: editing a template produces a copy the user owns.
    if (existing.isTemplate) {
      return { ...JSON.parse(JSON.stringify(existing)), id: '', isTemplate: false };
    }
    return JSON.parse(JSON.stringify(existing)) as Workout;
  });

  const [editing, setEditing] = useState<Segment | null>(null);
  const [name, setName] = useState(draft.name);

  const runtime = useMemo(() => flatten(draft), [draft]);

  const save = () => {
    const finalName = name.trim() || 'Untitled workout';
    const workout: Workout = {
      id: draft.id || `workout-${Date.now().toString(36)}`,
      name: finalName,
      isTemplate: false,
      items: draft.items,
    };
    saveWorkout(workout);
    router.replace(`/workout/${workout.id}`);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TextInput
          accessibilityLabel="Workout name"
          value={name}
          onChangeText={setName}
          style={[type.title, styles.name, { color: color.ink }]}
          placeholder="Workout name"
          placeholderTextColor={color.inkMuted}
        />
      </View>

      <View style={styles.strip}>
        {runtime.length > 0 ? (
          <SessionStrip segments={runtime} height={24} />
        ) : (
          <Text style={[type.caption, { color: color.inkMuted }]}>
            No segments yet. Add one below.
          </Text>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {runtime.map((entry) => (
          <Pressable
            key={`${entry.segment.id}-${entry.index}`}
            accessibilityRole="button"
            accessibilityLabel={`${SEGMENT_LABEL[entry.segment.type]}, ${describeLength(
              entry.segment.length,
            )}. Tap to edit.`}
            onPress={() => setEditing(entry.segment)}
            style={styles.row}
          >
            <View
              style={[styles.swatch, { backgroundColor: segmentColor[entry.segment.type].bg }]}
            />
            <View style={styles.rowLabel}>
              <Text style={[type.body, { color: color.ink }]}>
                {SEGMENT_LABEL[entry.segment.type]}
                {entry.setNumber !== undefined && entry.setTotal !== undefined
                  ? ` · Set ${entry.setNumber} of ${entry.setTotal}`
                  : ''}
              </Text>
              {describePaceRange(entry.segment) ? (
                <Text style={[type.caption, { color: color.inkMuted }]}>
                  target {describePaceRange(entry.segment)}
                </Text>
              ) : null}
            </View>
            <Text style={[type.caption, { color: color.ink }]}>
              {describeLength(entry.segment.length)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.actions}>
        <View style={styles.addRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add segment"
            onPress={() =>
              setDraft((d) => ({
                ...d,
                items: [
                  ...d.items,
                  makeSegmentItem('run', { kind: 'time', seconds: 240 }, {
                    fastSecPerKm: 270,
                    slowSecPerKm: 285,
                  }),
                ],
              }))
            }
            style={styles.secondary}
          >
            <Text style={[type.caption, { color: color.ink }]}>Add segment</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add set"
            onPress={() =>
              setDraft((d) => ({
                ...d,
                items: [
                  ...d.items,
                  {
                    kind: 'repeat',
                    count: 4,
                    segments: [
                      {
                        id: newSegmentId(),
                        type: 'run',
                        length: { kind: 'time', seconds: 240 },
                        paceRange: { fastSecPerKm: 270, slowSecPerKm: 285 },
                      },
                      {
                        id: newSegmentId(),
                        type: 'rest',
                        length: { kind: 'time', seconds: 180 },
                      },
                    ],
                  },
                ],
              }))
            }
            style={styles.secondary}
          >
            <Text style={[type.caption, { color: color.ink }]}>Add set</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.saveWorkout}
          onPress={save}
          style={styles.primary}
        >
          <Text style={[type.body, { color: color.white }]}>{copy.saveWorkout}</Text>
        </Pressable>
      </View>

      {editing ? (
        <SegmentSheet
          segment={editing}
          onCancel={() => setEditing(null)}
          onSave={(next) => {
            setDraft((d) => ({ ...d, items: updateSegmentInItems(d.items, next.id, next) }));
            setEditing(null);
          }}
          onDelete={() => {
            setDraft((d) => ({ ...d, items: removeSegmentFromItems(d.items, editing.id) }));
            setEditing(null);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  header: { paddingHorizontal: space.xl, paddingTop: space.xxl },
  name: { minHeight: 48, paddingVertical: space.s },
  strip: { paddingHorizontal: space.xl, paddingBottom: space.m },
  list: { paddingHorizontal: space.xl, paddingBottom: space.l },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.m,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  swatch: { width: 4, height: 28, borderRadius: 2, marginRight: space.s },
  rowLabel: { flex: 1 },
  actions: {
    paddingHorizontal: space.xl,
    paddingTop: space.m,
    paddingBottom: space.xl,
    borderTopWidth: 1,
    borderTopColor: color.line,
    gap: space.m,
  },
  addRow: { flexDirection: 'row', gap: space.s },
  secondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.button,
    borderWidth: 2,
    borderColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    minHeight: 48,
    backgroundColor: color.run,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
