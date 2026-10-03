import { memo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { color, radius, space, segmentColor } from '@/theme';
import type { RuntimeSegment } from '@/domain/types';
import { blockFractions, buildBlocks, needsOutline } from './stripGeometry';

/**
 * Session strip.
 *
 * UI Style Guide section 5: "A horizontal bar of blocks. Block width is
 * proportional to segment duration." It appears in templates, the builder, the
 * live screen and results, so "one shape teaches the user what a workout is".
 *
 * Live screen states (section 5): "finished blocks are dimmed, the current block
 * shows a progress fill, upcoming blocks are full color."
 */

export type StripMode = 'plan' | 'live' | 'results';

export interface SessionStripProps {
  segments: RuntimeSegment[];
  mode?: StripMode;
  /** Index of the active segment in live mode. */
  currentIndex?: number;
  /** Progress 0..1 through the active segment, for the fill. */
  progress?: number;
  height?: number;
  /** Hide the 2 dp gaps, e.g. inside a tight live-screen header. */
  tight?: boolean;
}

function SessionStripComponent({
  segments,
  mode = 'plan',
  currentIndex = -1,
  progress = 0,
  height = 24,
  tight = false,
}: SessionStripProps) {
  const blocks = buildBlocks(segments);
  const fractions = blockFractions(blocks);

  if (blocks.length === 0) return null;

  return (
    <View
      style={[styles.row, { height }]}
      accessibilityRole="progressbar"
      accessibilityLabel={`Workout with ${blocks.length} segments`}
    >
      {blocks.map((block, i) => {
        const isCurrent = mode === 'live' && i === currentIndex;
        const isDone = mode === 'live' && i < currentIndex;

        // Warm-up and cool-down share the base colour (section 2).
        const fill = segmentColor[block.type].bg;

        const blockStyle: ViewStyle = {
          flexGrow: fractions[i],
          flexBasis: 0,
          backgroundColor: isDone ? color.line : fill,
          borderRadius: radius.block,
        };

        if (needsOutline(block.type) && !isDone) {
          // 1.5 dp ink outline so rest blocks read on the paper background.
          blockStyle.borderWidth = 1.5;
          blockStyle.borderColor = color.ink;
        }

        return (
          <View
            key={`${block.segment.index}-${i}`}
            style={[styles.block, blockStyle, !tight && styles.gap]}
          >
            {isCurrent && progress > 0 ? (
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, Math.max(0, progress * 100))}%` },
                ]}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    width: '100%',
  },
  block: {
    flexShrink: 1,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  gap: {
    marginRight: space.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: color.white,
    opacity: 0.45,
  },
});

export const SessionStrip = memo(SessionStripComponent);