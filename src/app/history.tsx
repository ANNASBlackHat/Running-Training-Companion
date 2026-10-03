import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { color, copy, space, type } from '@/theme';
import { formatClock, formatDistance, formatPace } from '@/domain/format';
import { computeTotals } from '@/domain/results';
import { useSessionStore } from '@/store/sessions';

/**
 * History.
 *
 * User Stories US-17: "List of sessions with date, workout name, distance.
 * Opening one shows its results. Stored on the device only."
 *
 * UI Style Guide section 8 supplies the empty-state copy.
 */

function formatDate(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export default function HistoryScreen() {
  const router = useRouter();
  const sessions = useSessionStore((s) => s.sessions);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={[type.title, { color: color.ink }]}>History</Text>

      {sessions.length === 0 ? (
        <Text style={[type.body, styles.empty, { color: color.inkMuted }]}>
          {copy.emptyHistory}
        </Text>
      ) : (
        sessions.map((session) => {
          const totals = computeTotals(session.results);
          return (
            <Pressable
              key={session.id}
              accessibilityRole="button"
              accessibilityLabel={`${session.workoutSnapshot.name} on ${formatDate(
                session.startedAt,
              )}, ${formatDistance(totals.distanceM)}`}
              onPress={() => router.push(`/results/${session.id}`)}
              style={styles.row}
            >
              <View style={styles.rowLabel}>
                <Text style={[type.body, { color: color.ink }]}>
                  {session.workoutSnapshot.name}
                </Text>
                <Text style={[type.caption, { color: color.inkMuted }]}>
                  {formatDate(session.startedAt)} · {formatClock(totals.durationSec)} ·{' '}
                  {formatPace(totals.avgPaceSecPerKm)}
                </Text>
              </View>
              <Text style={[type.caption, { color: color.ink }]}>
                {formatDistance(totals.distanceM)}
              </Text>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  content: { padding: space.xl },
  empty: { marginTop: space.l },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.m,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  rowLabel: { flex: 1 },
});
