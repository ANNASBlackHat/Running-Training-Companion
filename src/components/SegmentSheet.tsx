import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { color, radius, space, type } from '@/theme';
import {
  applyDraft,
  draftFromSegment,
  draftIsValid,
  type SegmentDraft,
} from '@/domain/segmentDraft';
import { SEGMENT_LABEL } from '@/domain/describe';
import type { Segment, SegmentType } from '@/domain/types';

/**
 * Segment editor sheet.
 *
 * UI Style Guide section 6 (Builder): "Tapping a block opens a bottom sheet to
 * edit it. Sheet fields: type, length mode (time or distance), length value,
 * pace range (optional), repeat count when the block is part of a set."
 *
 * Section 4 gives bottom sheets 24 dp top corners and 48 dp touch targets.
 */

const TYPES: SegmentType[] = ['warmup', 'run', 'rest', 'cooldown'];

export interface SegmentSheetProps {
  segment: Segment;
  onCancel: () => void;
  onSave: (segment: Segment) => void;
  onDelete?: () => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={[type.caption, styles.label, { color: color.inkMuted }]}>{label}</Text>
      {children}
    </View>
  );
}

export function SegmentSheet({ segment, onCancel, onSave, onDelete }: SegmentSheetProps) {
  const [draft, setDraft] = useState<SegmentDraft>(() => draftFromSegment(segment));
  const set = (patch: Partial<SegmentDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const valid = draftIsValid(draft);

  return (
    <View style={styles.sheet}>
      <View style={styles.grabber} />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={[type.heading, { color: color.ink }]}>Segment</Text>

        <Field label="type">
          <View style={styles.chips}>
            {TYPES.map((t) => (
              <Pressable
                key={t}
                accessibilityRole="radio"
                accessibilityState={{ selected: draft.type === t }}
                accessibilityLabel={SEGMENT_LABEL[t]}
                onPress={() => set({ type: t })}
                style={[styles.chip, draft.type === t && styles.chipActive]}
              >
                <Text
                  style={[
                    type.caption,
                    { color: draft.type === t ? color.white : color.ink },
                  ]}
                >
                  {SEGMENT_LABEL[t]}
                </Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <Field label="length">
          <View style={styles.chips}>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: draft.mode === 'time' }}
              accessibilityLabel="By time"
              onPress={() => set({ mode: 'time' })}
              style={[styles.chip, draft.mode === 'time' && styles.chipActive]}
            >
              <Text
                style={[
                  type.caption,
                  { color: draft.mode === 'time' ? color.white : color.ink },
                ]}
              >
                Time
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: draft.mode === 'distance' }}
              accessibilityLabel="By distance"
              onPress={() => set({ mode: 'distance' })}
              style={[styles.chip, draft.mode === 'distance' && styles.chipActive]}
            >
              <Text
                style={[
                  type.caption,
                  { color: draft.mode === 'distance' ? color.white : color.ink },
                ]}
              >
                Distance
              </Text>
            </Pressable>
          </View>
        </Field>

        {draft.mode === 'time' ? (
          <View style={styles.inline}>
            <Field label="min">
              <TextInput
                accessibilityLabel="Minutes"
                value={draft.minutes}
                onChangeText={(v) => set({ minutes: v.replace(/[^0-9]/g, '') })}
                keyboardType="number-pad"
                style={styles.input}
              />
            </Field>
            <Field label="sec">
              <TextInput
                accessibilityLabel="Seconds"
                value={draft.seconds}
                onChangeText={(v) => set({ seconds: v.replace(/[^0-9]/g, '') })}
                keyboardType="number-pad"
                style={styles.input}
              />
            </Field>
          </View>
        ) : (
          <Field label="meters">
            <TextInput
              accessibilityLabel="Meters"
              value={draft.meters}
              onChangeText={(v) => set({ meters: v.replace(/[^0-9]/g, '') })}
              keyboardType="number-pad"
              style={styles.input}
            />
          </Field>
        )}

        {/* US-3: a segment without a range gives no pace alerts. */}
        <View style={styles.paceRow}>
          <Text style={[type.body, { color: color.ink }]}>Target pace</Text>
          <Switch
            accessibilityLabel="Set a target pace"
            value={draft.hasPace}
            onValueChange={(v) => set({ hasPace: v })}
          />
        </View>

        {draft.hasPace ? (
          <View style={styles.inline}>
            <Field label="from min:sec /km">
              <TextInput
                accessibilityLabel="Pace from"
                value={draft.paceFrom}
                onChangeText={(v) => set({ paceFrom: v })}
                placeholder="4:30"
                placeholderTextColor={color.inkMuted}
                style={styles.input}
              />
            </Field>
            <Field label="to min:sec /km">
              <TextInput
                accessibilityLabel="Pace to"
                value={draft.paceTo}
                onChangeText={(v) => set({ paceTo: v })}
                placeholder="4:45"
                placeholderTextColor={color.inkMuted}
                style={styles.input}
              />
            </Field>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        {onDelete ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete segment"
            onPress={onDelete}
            style={styles.destructive}
          >
            <Text style={[type.body, { color: color.ink }]}>Delete</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={onCancel}
          style={styles.secondary}
        >
          <Text style={[type.body, { color: color.ink }]}>Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Apply"
          accessibilityState={{ disabled: !valid }}
          disabled={!valid}
          onPress={() => {
            const next = applyDraft(segment, draft);
            if (next) onSave(next);
          }}
          style={[styles.primary, !valid && styles.disabled]}
        >
          <Text style={[type.body, { color: color.white }]}>Apply</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: color.paper,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    maxHeight: '85%',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.line,
    marginTop: space.m,
  },
  body: { padding: space.xl, paddingBottom: space.l },
  field: { marginTop: space.m, flex: 1 },
  label: { marginBottom: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  chip: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: space.l,
    borderRadius: radius.button,
    borderWidth: 2,
    borderColor: color.ink,
  },
  chipActive: { backgroundColor: color.run, borderColor: color.run },
  inline: { flexDirection: 'row', gap: space.m },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.block,
    paddingHorizontal: space.m,
    color: color.ink,
    backgroundColor: color.white,
  },
  paceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.l,
    minHeight: 48,
  },
  actions: {
    flexDirection: 'row',
    gap: space.s,
    padding: space.xl,
    paddingTop: space.m,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  primary: {
    flex: 1,
    minHeight: 48,
    backgroundColor: color.run,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    minHeight: 48,
    paddingHorizontal: space.l,
    borderRadius: radius.button,
    borderWidth: 2,
    borderColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destructive: {
    minHeight: 48,
    paddingHorizontal: space.l,
    justifyContent: 'center',
  },
  disabled: { backgroundColor: color.line },
});
