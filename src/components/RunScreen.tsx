import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { color, copy, LIVE_CONTROL_HEIGHT, LIVE_PADDING, radius, segmentColor, space, type } from '@/theme';
import { flatten } from '@/domain/flatten';
import { formatClock, formatDistance, formatPace } from '@/domain/format';
import {
  createSessionRun,
  currentPace,
  currentProgress,
  currentSegment,
  feedPosition,
  pauseSession,
  resumeSession,
  skipSegment,
  startSession,
  stopSession,
  tickSession,
  type SessionRun,
} from '@/domain/session';
import type { Workout } from '@/domain/types';
import { dispatchCue, prepareSessionAudio } from '@/services/cueService';
import { setBeepsEnabled } from '@/services/beepService';
import * as locationService from '@/services/locationService';
import {
  clearInProgressSession,
  saveInProgressSession,
  SNAPSHOT_INTERVAL_MS,
} from '@/services/storage';
import { useSettingsStore } from '@/store/settings';
import { useSessionStore } from '@/store/sessions';
import { PaceLane } from '@/components/PaceLane';
import { SessionStrip } from '@/components/SessionStrip';
import { HoldToStop } from '@/components/HoldToStop';

/**
 * Live run screen.
 *
 * UI Style Guide section 6 (Live run): "Background is the active segment's
 * color." The layout below follows that wireframe.
 *
 * Section 7: "Segment change: the background color transitions over 250 ms.
 * This is the one deliberate animation moment."
 */

const TICK_MS = 1000;

export interface RunScreenProps {
  workout: Workout;
  /** Injected in tests; production routes to the results screen. */
  onFinish?: (run: SessionRun) => void;
}

export default function RunScreen({ workout, onFinish }: RunScreenProps) {
  const router = useRouter();
  const segments = useMemo(() => flatten(workout), [workout]);

  const voiceEnabled = useSettingsStore((s) => s.voiceEnabled);
  const beepsEnabled = useSettingsStore((s) => s.beepsEnabled);
  const saveSession = useSessionStore((s) => s.saveSession);

  const [run, setRun] = useState<SessionRun>(() => createSessionRun(segments));
  const [now, setNow] = useState(() => Date.now());
  const [locationError, setLocationError] = useState<string | null>(null);
  // Section 5: stay in a GPS ready state until accuracy settles.
  const [gpsReady, setGpsReady] = useState(false);

  // Cue events already dispatched, so a re-render never repeats a cue.
  const dispatched = useRef(0);
  const startMs = useRef(Date.now());
  // Mirrors the latest run so the snapshot interval can read it without
  // going through setState.
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await prepareSessionAudio();
      setBeepsEnabled(beepsEnabled);

      const started = startSession(createSessionRun(segments), Date.now());
      if (!cancelled) setRun(started);

      setGpsReady(false);

      const result = await locationService.start(
        (point) => {
          setRun((prev) => feedPosition(prev, point));
          if (locationService.isGpsReady(Date.now())) setGpsReady(true);
        },
        (message) => {
          if (!cancelled) setLocationError(message);
        },
      );

      if (!cancelled && !result.ok) setLocationError(result.reason);
    })();

    return () => {
      cancelled = true;
      // Battery hygiene: release the location subscription and the keep-awake
      // lock as soon as the screen goes away.
      void locationService.stop();
    };
    // Start once per workout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One-second tick driving the countdown and cue scheduler.
  useEffect(() => {
    if (run.runner.state !== 'running' && run.runner.state !== 'paused') return;
    const id = setInterval(() => {
      const at = Date.now();
      setNow(at);
      setRun((prev) => tickSession(prev, at));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [run.runner.state]);

  // Section 8 (crash safety, should-have): "write an in-progress snapshot
  // every 30 s so a crash does not lose a whole session."
  useEffect(() => {
    if (run.runner.state !== 'running') return;

    const id = setInterval(() => {
      // Read the latest state from a ref: writing a snapshot is a side effect
      // and must not go through setState, which would re-render for nothing.
      const current = runRef.current;
      void saveInProgressSession({
        workoutId: workout.id,
        savedAt: Date.now(),
        results: current.runner.results,
        track: current.runner.track,
      });
    }, SNAPSHOT_INTERVAL_MS);

    return () => clearInterval(id);
  }, [run.runner.state, workout.id]);

  // Dispatch any new cue events.
  useEffect(() => {
    const pending = run.events.slice(dispatched.current);
    if (pending.length === 0) return;
    dispatched.current = run.events.length;

    for (const event of pending) {
      void dispatchCue(event, { voiceEnabled, beepsEnabled });
    }
  }, [run.events, voiceEnabled, beepsEnabled]);
const finish = useCallback(
    (finalRun: SessionRun) => {
      // Battery hygiene: stop tracking and release the keep-awake lock.
      void locationService.stop();
      // The session is saved below, so the crash snapshot is no longer needed.
      void clearInProgressSession();
      const durationSec = finalRun.runner.results.reduce((a, r) => a + r.durationSec, 0);
      const distanceM = finalRun.runner.results.reduce((a, r) => a + r.distanceM, 0);
      const sessionId = `session-${startMs.current.toString(36)}`;

      saveSession({
        id: sessionId,
        workoutId: workout.id,
        // Section 3: a snapshot, so later edits do not change history.
        workoutSnapshot: JSON.parse(JSON.stringify(workout)) as Workout,
        startedAt: finalRun.runner.results[0]?.startedAt ?? startMs.current,
        endedAt: Date.now(),
        results: finalRun.runner.results,
        totals: {
          durationSec,
          distanceM,
          avgPaceSecPerKm: distanceM > 0 ? durationSec / (distanceM / 1000) : null,
        },
        track: finalRun.runner.track,
      });

      onFinish?.(finalRun);
      router.replace(`/results/${sessionId}`);
    },
    [router, saveSession, workout, onFinish],
  );

  // Save as soon as the last segment completes (section 8).
  useEffect(() => {
    if (run.runner.state === 'finished') finish(run);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.runner.state]);

  const segment = currentSegment(run);
  const progress = currentProgress(run, now);
  const pace = currentPace(run, now);
  const isRest = segment?.segment.type === 'rest';
  const isPaused = run.runner.state === 'paused';

  const palette = segment
    ? segmentColor[segment.segment.type]
    : { bg: color.base, fg: color.white };

  const totalsDistance = run.runner.results.reduce((a, r) => a + r.distanceM, 0);
  const totalsTime = run.runner.results.reduce((a, r) => a + r.durationSec, 0);

  const isDistance = progress.remainingM !== null;
  const targetLength =
    segment?.segment.length.kind === 'distance'
      ? segment.segment.length.meters
      : segment?.segment.length.kind === 'time'
        ? segment.segment.length.seconds
        : 0;

  const remainingLabel = isDistance
    ? formatDistance(progress.remainingM ?? 0)
    : formatClock(progress.remainingSec ?? 0);

  const ofLabel = isDistance
    ? `of ${formatDistance(targetLength)}`
    : `of ${formatClock(targetLength)}`;

  const totalLength = Math.max(1, targetLength);

  const segmentProgress = isDistance
    ? 1 - (progress.remainingM ?? 0) / totalLength
    : 1 - (progress.remainingSec ?? 0) / totalLength;
  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <View style={styles.header}>
        <Text style={[type.heading, styles.segmentName, { color: palette.fg }]}>
          {segment ? capitalise(segment.segment.type) : copy.finish}
        </Text>
        {segment?.setNumber !== undefined && segment.setTotal !== undefined ? (
          <Text style={[type.caption, styles.setCount, { color: palette.fg }]}>
            Set {segment.setNumber} of {segment.setTotal}
          </Text>
        ) : null}
      </View>

      {locationError ? (
        <Text style={[type.caption, styles.error, { color: palette.fg }]}>
          {locationError === 'servicesOff'
            ? copy.locationOff
            : locationError === 'denied'
              ? copy.locationDenied
              : copy.gpsSettling}
        </Text>
      ) : null}

      {/* Section 5: the start screen shows a GPS ready state while accuracy
          settles. The first fixes are discarded, so pace is unknown here. */}
      {!locationError && !gpsReady && run.runner.state === 'running' ? (
        <Text
          style={[type.caption, styles.error, { color: palette.fg }]}
          accessibilityRole='alert'
        >
          {copy.gpsSettling}
        </Text>
      ) : null}

      {/* The timer is centred; everything else is left aligned (section 6). */}
      <View style={styles.timerBlock}>
        <Text
          style={[type.timerXL, styles.timer, { color: palette.fg }]}
          accessibilityLabel={`${remainingLabel} remaining`}
        >
          {isPaused ? copy.pause : remainingLabel}
        </Text>
        <Text style={[type.caption, styles.of, { color: palette.fg }]}>{ofLabel}</Text>
      </View>

      <View style={styles.paceBlock}>
        {isRest || !segment?.segment.paceRange ? (
          <>
            <Text style={[type.paceL, styles.pace, { color: palette.fg }]}>
              {pace.paceSecPerKm === null ? copy.noPaceYet : formatPace(pace.paceSecPerKm)}
            </Text>
            {!isRest && pace.paceSecPerKm !== null ? (
              <Text style={[type.caption, styles.paceUnit, { color: palette.fg }]}>/km</Text>
            ) : null}
          </>
        ) : (
          <PaceLane
            paceSecPerKm={pace.paceSecPerKm}
            status={pace.status}
            range={segment.segment.paceRange}
            onDark
          />
        )}
      </View>

      <View style={styles.stripBlock}>
        <SessionStrip
          segments={segments}
          mode="live"
          currentIndex={segment?.index ?? -1}
          progress={Math.min(1, Math.max(0, segmentProgress))}
          height={20}
        />
      </View>

      <View style={styles.totalsRow}>
        <Text style={[type.caption, styles.total, { color: palette.fg }]}>
          {formatDistance(totalsDistance)}
        </Text>
        <Text style={[type.caption, styles.totalRight, { color: palette.fg }]}>
          {formatClock(totalsTime)}
        </Text>
      </View>

      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isPaused ? copy.resume : copy.pause}
          onPress={() => {
            const at = Date.now();
            setRun((prev) =>
              prev.runner.state === 'paused'
                ? resumeSession(prev, at)
                : pauseSession(prev, at),
            );
          }}
          style={styles.control}
        >
          <View style={styles.controlInner}>
            <Text style={[type.caption, styles.controlLabel, { color: palette.fg }]}>
              {isPaused ? copy.resume : copy.pause}
            </Text>
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.skipSegment}
          onPress={() => setRun((prev) => skipSegment(prev, Date.now()))}
          style={styles.control}
        >
          <View style={styles.controlInner}>
            <Text style={[type.caption, styles.controlLabel, { color: palette.fg }]}>
              {copy.skipSegment}
            </Text>
          </View>
        </Pressable>

        <HoldToStop onStop={() => setRun((prev) => stopSession(prev, Date.now()))} onDark />
      </View>
    </View>
  );
}

const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: LIVE_PADDING,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  segmentName: {
    textTransform: 'capitalize',
  },
  setCount: {
    opacity: 0.85,
  },
  error: {
    marginTop: space.s,
    opacity: 0.9,
  },
  timerBlock: {
    alignItems: 'center',
  },
  timer: {
    textAlign: 'center',
  },
  of: {
    marginTop: space.xs,
    opacity: 0.8,
  },
  paceBlock: {
    minHeight: 96,
    justifyContent: 'center',
  },
  pace: {
    textAlign: 'left',
  },
  paceUnit: {
    opacity: 0.8,
    marginTop: space.xs,
  },
  stripBlock: {
    marginVertical: space.m,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  total: {
    fontVariant: ['tabular-nums'],
  },
  totalRight: {
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    gap: space.s,
    marginTop: space.m,
  },
  control: {
    flex: 1,
    height: LIVE_CONTROL_HEIGHT,
  },
  controlInner: {
    flex: 1,
    borderRadius: radius.button,
    borderWidth: 2,
    borderColor: color.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlLabel: {
    textAlign: 'center',
  },
});
