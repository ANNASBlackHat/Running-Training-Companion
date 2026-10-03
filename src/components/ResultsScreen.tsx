import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { color, radius, segmentColor, space, type } from '@/theme';
import { formatClock, formatDistance, formatPace } from '@/domain/format';
import { computeResults, fastestSlowestRuns } from '@/domain/results';
import { flatten } from '@/domain/flatten';
import type { SegmentResult } from '@/domain/types';
import { useSessionStore } from '@/store/sessions';
import { SessionStrip } from '@/components/SessionStrip';

/**
 * Results screen.
 *
 * UI Style Guide section 6 (Results): "Top: totals (time, distance, average
 * pace). Strip: the session strip with per-block results visible. Table of
 * segments: name, duration, distance, pace. Run segments in a set are grouped,
 * and the fastest and slowest set are marked with words, not only color.
 * Warm-up and cool-down expand to show per-km splits."
 *
 * User Stories US-13 (per-segment rows), US-14 (warm-up and cool-down per km),
 * US-15 (session totals).
 */

const SEGMENT_LABEL: Record<SegmentResult['type'], string> = {
  warmup: 'Warm-up',
  run: 'Run',
  rest: 'Rest',
  cooldown: 'Cool-down',
};

/** One row, with per-km splits behind a toggle for warm-up and cool-down. */
function SegmentRow({
  result,
  fastestIndex,
  slowestIndex,
}: {
  result: SegmentResult;
  fastestIndex: number;
  slowestIndex: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = (result.kmSplits?.length ?? 0) > 0;
  const palette = segmentColor[result.type];

  const marks: string[] = [];
  if (result.index === fastestIndex) marks.push('Fastest');
  if (result.index === slowestIndex) marks.push('Slowest');

  return (
    <View>
      <Pressable
        accessibilityRole={canExpand ? 'button' : 'text'}
        accessibilityState={canExpand ? { expanded } : undefined}
        accessibilityLabel={
          canExpand
            ? `${SEGMENT_LABEL[result.type]}, show per kilometre splits`
            : undefined
        }
        onPress={() => canExpand && setExpanded((v) => !v)}
        style={styles.row}
      >
        <View style={[styles.swatch, { backgroundColor: palette.bg }]} />

        <View style={styles.rowLabel}>
          <Text style={[type.body, { color: color.ink }]}>
            {SEGMENT_LABEL[result.type]}
            {result.setNumber ? ` · Set ${result.setNumber}` : ''}
          </Text>
          {/* Section 2: colour is never the only signal, so marks are words. */}
          {marks.map((m) => (
            <Text key={m} style={[type.caption, { color: color.inkMuted }]}>
              {m}
            </Text>
          ))}
        </View>

        <Text style={[type.caption, styles.cell, { color: color.ink }]}>
          {formatClock(result.durationSec)}
        </Text>
        <Text style={[type.caption, styles.cell, { color: color.ink }]}>
          {formatDistance(result.distanceM)}
        </Text>
        <Text style={[type.caption, styles.cell, { color: color.ink }]}>
          {formatPace(result.avgPaceSecPerKm)}
        </Text>
        {canExpand ? (
          <Text style={[type.caption, styles.chevron, { color: color.inkMuted }]}>
            {expanded ? '−' : '+'}
          </Text>
        ) : null}
      </Pressable>

      {expanded && canExpand ? (
        <View style={styles.splits}>
          <View style={styles.splitRow}>
            <Text style={[type.caption, { color: color.inkMuted }]}>km</Text>
            <Text style={[type.caption, styles.splitValue, { color: color.inkMuted }]}>
              /km
            </Text>
          </View>
          {result.kmSplits!.map((split) => (
            <View key={split.km} style={styles.splitRow}>
              <Text style={[type.caption, { color: color.ink }]}>{split.km}</Text>
              <Text style={[type.caption, styles.splitValue, { color: color.ink }]}>
                {formatPace(split.paceSecPerKm)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
export default function ResultsScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const sessions = useSessionStore((s) => s.sessions);
  const session = sessions.find((s) => s.id === sessionId);

  // Section 7: results are computed once when the session ends. Recomputing
  // here keeps the screen correct for sessions saved by an earlier build.
  const computed = useMemo(() => {
    if (!session) return null;
    return computeResults(session.results, session.track);
  }, [session]);

  if (!session || !computed) {
    return (
      <View style={styles.screen}>
        <Text style={[type.body, { color: color.ink }]}>
          This session is not saved on the device.
        </Text>
      </View>
    );
  }

  const segments = flatten(session.workoutSnapshot);
  const { fastest, slowest } = fastestSlowestRuns(computed.results);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={[type.title, { color: color.ink }]}>
        {session.workoutSnapshot.name}
      </Text>

      {/* Section 6: totals on top. */}
      <View style={styles.totals}>
        <View style={styles.totalBlock}>
          <Text style={[type.caption, { color: color.inkMuted }]}>time</Text>
          <Text style={[type.heading, { color: color.ink }]}>
            {formatClock(computed.totals.durationSec)}
          </Text>
        </View>
        <View style={styles.totalBlock}>
          <Text style={[type.caption, { color: color.inkMuted }]}>distance</Text>
          <Text style={[type.heading, { color: color.ink }]}>
            {formatDistance(computed.totals.distanceM)}
          </Text>
        </View>
        <View style={styles.totalBlock}>
          <Text style={[type.caption, { color: color.inkMuted }]}>avg</Text>
          <Text style={[type.heading, { color: color.ink }]}>
            {formatPace(computed.totals.avgPaceSecPerKm)}
          </Text>
        </View>
      </View>

      <View style={styles.strip}>
        <SessionStrip segments={segments} mode="results" height={28} />
      </View>

      <View style={styles.tableHeader}>
        <Text style={[type.caption, styles.cell, { color: color.inkMuted }]}>time</Text>
        <Text style={[type.caption, styles.cell, { color: color.inkMuted }]}>dist</Text>
        <Text style={[type.caption, styles.cell, { color: color.inkMuted }]}>pace</Text>
      </View>

      {/* Section 4: rows with dividers, not a stack of identical cards. */}
      {computed.results.map((result) => (
        <SegmentRow
          key={result.index}
          result={result}
          fastestIndex={fastest?.index ?? -1}
          slowestIndex={slowest?.index ?? -1}
        />
      ))}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Done"
        onPress={() => router.back()}
        style={styles.done}
      >
        <Text style={[type.body, { color: color.white }]}>Done</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.paper,
  },
  content: {
    padding: space.xl,
    paddingBottom: space.xxl,
  },
  totals: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space.l,
  },
  totalBlock: {
    flex: 1,
  },
  strip: {
    marginVertical: space.l,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: space.s,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
    marginLeft: space.s + 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.m,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  swatch: {
    width: 4,
    height: 28,
    borderRadius: 2,
    marginRight: space.s,
  },
  rowLabel: {
    flex: 1,
  },
  cell: {
    width: 62,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  chevron: {
    width: 20,
    textAlign: 'right',
  },
  splits: {
    paddingLeft: space.s + 4,
    paddingBottom: space.m,
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space.xs,
  },
  splitValue: {
    width: 80,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  done: {
    marginTop: space.xl,
    paddingVertical: space.l,
    borderRadius: radius.button,
    backgroundColor: color.run,
    alignItems: 'center',
  },
});
