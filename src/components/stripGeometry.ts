import type { RuntimeSegment, SegmentType } from '@/domain/types';

/**
 * Session strip geometry.
 *
 * UI Style Guide section 5 (Session strip):
 *   "A horizontal bar of blocks. Block width is proportional to segment
 *    duration. Distance segments use an estimated duration from the target
 *    pace, or from 5:30/km if none is set, and the strip is only a visual
 *    guide."
 *
 * Kept pure and separate from the component so the proportions can be tested
 * without rendering.
 */

/** Fallback pace for distance segments with no target range: 5:30 per km. */
export const DEFAULT_PACE_SEC_PER_KM = 330;

export interface StripBlock {
  segment: RuntimeSegment;
  /** Estimated duration in seconds, used for the block width. */
  estimatedSec: number;
  type: SegmentType;
  setNumber?: number;
}

/** Estimated seconds for one segment, used only to size the block. */
export function estimateSegmentSec(segment: RuntimeSegment): number {
  const { length, paceRange } = segment.segment;

  if (length.kind === 'time') return length.seconds;

  const pace = paceRange?.fastSecPerKm ?? DEFAULT_PACE_SEC_PER_KM;
  return (length.meters / 1000) * pace;
}

/** All blocks for a workout, in order. */
export function buildBlocks(segments: RuntimeSegment[]): StripBlock[] {
  return segments.map((segment) => ({
    segment,
    estimatedSec: estimateSegmentSec(segment),
    type: segment.segment.type,
    setNumber: segment.setNumber,
  }));
}

/**
 * Width fractions that sum to 1. The 2 dp gap between blocks (section 5) is
 * drawn as spacing, so it does not consume width here.
 */
export function blockFractions(blocks: StripBlock[]): number[] {
  const total = blocks.reduce((sum, b) => sum + b.estimatedSec, 0);
  if (total <= 0) return blocks.map(() => 1 / Math.max(1, blocks.length));
  return blocks.map((b) => b.estimatedSec / total);
}

/** True when the block is a rest, which gets a 1.5 dp ink outline (section 5). */
export function needsOutline(type: SegmentType): boolean {
  return type === 'rest';
}