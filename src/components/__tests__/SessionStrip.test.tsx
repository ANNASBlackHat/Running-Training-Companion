import { render } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';


import { flatten } from '@/domain/flatten';
import { SessionStrip } from '../SessionStrip';
import { color, segmentColor } from '@/theme';
import { DIST_SEG, norwegian, REPEAT, TIME_SEG } from './fixtures';

/**
 * UI Style Guide section 5: block fill follows segment type, rest blocks get a
 * 1.5 dp ink outline, and in live mode finished blocks are dimmed while the
 * current block shows a progress fill.
 */

const renderStrip = (props: Parameters<typeof SessionStrip>[0]) => {
  const tree = render(<SessionStrip {...props} />);
  // Each block is a direct child View of the row.
  const row = tree.toJSON() as { children: View[] } | null;
  return { tree, blocks: row?.children ?? [] };
};

describe('SessionStrip', () => {
  it('renders nothing for an empty workout', () => {
    const { tree } = renderStrip({ segments: [] });
    expect(tree.toJSON()).toBeNull();
  });

  it('renders one block per runtime segment', () => {
    const segments = flatten(
      norwegian({
        items: [
          TIME_SEG('w', 'warmup', 600),
          REPEAT(4, [
            { id: 'r', type: 'run', length: { kind: 'time', seconds: 240 } },
            { id: 's', type: 'rest', length: { kind: 'time', seconds: 180 } },
          ]),
          TIME_SEG('c', 'cooldown', 600),
        ],
      }),
    );

    const { blocks } = renderStrip({ segments });
    expect(blocks).toHaveLength(10);
  });

  it('fills blocks by segment type (section 2)', () => {
    const segments = flatten(
      norwegian({
        items: [TIME_SEG('w', 'warmup', 600), TIME_SEG('r', 'run', 240), TIME_SEG('s', 'rest', 180)],
      }),
    );

    const { blocks } = renderStrip({ segments });
    const fills = blocks.map((b) => StyleSheet.flatten(b.props.style).backgroundColor);

    // Warm-up and cool-down share base; run is cobalt; rest is mint.
    expect(fills[0]).toBe(segmentColor.warmup.bg);
    expect(fills[1]).toBe(segmentColor.run.bg);
    expect(fills[2]).toBe(segmentColor.rest.bg);
  });

  it('outlines rest blocks with ink so they read on paper', () => {
    const segments = flatten(norwegian({ items: [TIME_SEG('s', 'rest', 180)] }));
    const { blocks } = renderStrip({ segments });

    const style = StyleSheet.flatten(blocks[0].props.style);
    expect(style.borderWidth).toBe(1.5);
    expect(style.borderColor).toBe(color.ink);
  });

  it('does not outline run blocks', () => {
    const segments = flatten(norwegian({ items: [TIME_SEG('r', 'run', 240)] }));
    const { blocks } = renderStrip({ segments });

    expect(StyleSheet.flatten(blocks[0].props.style).borderWidth).toBeUndefined();
  });

  it('dims finished blocks and colours upcoming ones in live mode', () => {
    const segments = flatten(
      norwegian({ items: [TIME_SEG('a', 'run', 240), TIME_SEG('b', 'run', 240), TIME_SEG('c', 'run', 240)] }),
    );

    const { blocks } = renderStrip({ segments, mode: 'live', currentIndex: 1, progress: 0 });
    const fills = blocks.map((b) => StyleSheet.flatten(b.props.style).backgroundColor);

    expect(fills[0]).toBe(color.line); // finished
    expect(fills[1]).toBe(segmentColor.run.bg); // current
    expect(fills[2]).toBe(segmentColor.run.bg); // upcoming
  });

  it('shows a progress fill on the current block only', () => {
    const segments = flatten(
      norwegian({ items: [TIME_SEG('a', 'run', 240), TIME_SEG('b', 'run', 240)] }),
    );

    const { blocks } = renderStrip({ segments, mode: 'live', currentIndex: 1, progress: 0.5 });

    // The progress fill is the only child rendered inside a block: a filled
    // block reports children, an empty one reports null.
    const hasFill = (b: { children?: unknown }): boolean =>
      Array.isArray(b.children) ? b.children.length > 0 : !!b.children;

    expect(hasFill(blocks[0])).toBe(false); // finished
    expect(hasFill(blocks[1])).toBe(true); // current
  });

  it('gives each block a width proportional to its duration', () => {
    const segments = flatten(
      norwegian({ items: [TIME_SEG('a', 'run', 60), TIME_SEG('b', 'run', 180)] }),
    );

    const { blocks } = renderStrip({ segments });
    const grows = blocks.map((b) => StyleSheet.flatten(b.props.style).flexGrow);

    expect(grows[0]).toBeCloseTo(0.25, 6);
    expect(grows[1]).toBeCloseTo(0.75, 6);
  });

  it('estimates a distance segment so mixed workouts still render', () => {
    const segments = flatten(
      norwegian({ items: [DIST_SEG('d', 'run', 400), TIME_SEG('r', 'run', 240)] }),
    );

    const { blocks } = renderStrip({ segments });
    expect(blocks).toHaveLength(2);

    const grows: number[] = blocks.map(
      (b) => (StyleSheet.flatten(b.props.style) as { flexGrow: number }).flexGrow,
    );
    expect(grows[0]).toBeGreaterThan(0);
    expect(grows.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
  });
});
