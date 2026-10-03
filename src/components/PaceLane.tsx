import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { color, radius, space, type } from '@/theme';
import type { PaceStatus } from '@/domain/pace';
import type { PaceRange } from '@/domain/types';
import { copy } from '@/theme';
import {
  alertDirection,
  laneGeometry,
  markerIsAlert,
  markerPosition,
} from './paceLaneGeometry';

/**
 * Pace lane.
 *
 * UI Style Guide section 1: "The memorable element: the pace lane. The target
 * pace range is drawn as a highlighted lane, and your current pace is a marker
 * inside or outside it. You see 'off pace' by position, with no numbers to
 * compare."
 *
 * Section 5 rules implemented here:
 *   - hidden entirely on rest segments and when there is no target range,
 *   - dashed marker and "No pace yet" when pace is unknown,
 *   - marker turns alert out of range, with a pill carrying an arrow and
 *     "Too fast" / "Too slow" -- colour is never the only signal (section 2).
 */

export const LANE_HEIGHT = 56;

export interface PaceLaneProps {
  paceSecPerKm: number | null;
  status: PaceStatus;
  /** The active segment's target range; null hides the lane. */
  range: PaceRange | undefined;
  /** Show the target bounds as text beneath the lane. */
  showTarget?: boolean;
  onDark?: boolean;
}

function formatBound(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function PaceLaneComponent({
  paceSecPerKm,
  status,
  range,
  showTarget = true,
  onDark = false,
}: PaceLaneProps) {
  // Section 5: the lane is hidden when there is no target range.
  if (!range) return null;

  const geometry = laneGeometry(range);
  const position = markerPosition(paceSecPerKm, geometry);
  const isAlert = markerIsAlert(status);
  const direction = alertDirection(status);
  const trackColor = onDark ? 'rgba(255,255,255,0.28)' : color.line;

  const markerColor = position === null
    ? color.inkMuted
    : isAlert
      ? color.alert
      : onDark
        ? color.white
        : color.ink;

  const paceText = position === null
    ? copy.noPaceYet
    : `${formatBound(paceSecPerKm!)} /km`;

  const pillText =
    status === 'tooFast' ? copy.tooFast : status === 'tooSlow' ? copy.tooSlow : null;

  return (
    <View style={styles.wrapper}>
      <View style={[styles.lane, { backgroundColor: trackColor }]}>
        {/* Target band with solid edges (section 5). */}
        <View
          style={[
            styles.band,
            {
              left: `${geometry.bandStart * 100}%`,
              width: `${Math.max(2, (geometry.bandEnd - geometry.bandStart) * 100)}%`,
            },
          ]}
        />

        {/* Pace marker. */}
        <View
          style={[
            styles.marker,
            position === null && styles.markerDashed,
            {
              backgroundColor: markerColor,
              left: position === null ? 0 : `${position * 100}%`,
            },
          ]}
        />
      </View>

      <View style={styles.footer}>
        <Text
          style={[
            type.caption,
            styles.paceText,
            { color: onDark ? color.white : color.ink },
          ]}
          accessibilityLabel={
            position === null
              ? 'Pace not yet available'
              : `Pace ${formatBound(paceSecPerKm!)} per kilometre${
                  status === 'tooFast' ? ', too fast' : status === 'tooSlow' ? ', too slow' : ''
                }`
          }
        >
          {paceText}
        </Text>

        {pillText && direction ? (
          <View style={styles.pill} accessibilityRole="alert">
            <Text style={styles.pillArrow}>{direction === 'left' ? '←' : '→'}</Text>
            <Text style={styles.pillText}>{pillText}</Text>
          </View>
        ) : null}

        {showTarget ? (
          <Text style={[type.caption, styles.target, { color: onDark ? 'rgba(255,255,255,0.75)' : color.inkMuted }]}>
            target {formatBound(range.fastSecPerKm)} to {formatBound(range.slowSecPerKm)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  lane: {
    height: LANE_HEIGHT,
    borderRadius: radius.block,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  band: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  marker: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: -5,
  },
  markerDashed: {
    opacity: 0.5,
    borderWidth: 2,
    borderColor: color.inkMuted,
    backgroundColor: 'transparent',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.s,
  },
  paceText: {
    fontVariant: ['tabular-nums'],
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: space.s,
    paddingHorizontal: space.s,
    paddingVertical: 2,
    borderRadius: radius.button,
    backgroundColor: color.alert,
  },
  pillArrow: {
    ...type.caption,
    color: color.ink,
    marginRight: space.xs,
  },
  pillText: {
    // Section 2: alert pills carry ink text; alert is never a text colour.
    ...type.caption,
    color: color.ink,
  },
  target: {
    marginLeft: 'auto',
    fontVariant: ['tabular-nums'],
  },
});

export const PaceLane = memo(PaceLaneComponent);