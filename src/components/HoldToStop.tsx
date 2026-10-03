import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { color, LIVE_CONTROL_HEIGHT, radius, space, type } from '@/theme';
import { copy } from '@/theme';

/**
 * Hold-to-stop.
 *
 * UI Style Guide section 5: "Destructive actions on the live screen (stop)
 * require holding for one second, with a visible fill showing the hold progress,
 * to avoid accidental taps."
 *
 * The fill is the only motion on this control, and it is one of the three
 * sanctioned motion moments in section 7.
 */

export const HOLD_MS = 1000;

export interface HoldToStopProps {
  onStop: () => void;
  /** Dark text on the run background, ink on light. */
  onDark?: boolean;
}

export function HoldToStop({ onStop, onDark = false }: HoldToStopProps) {
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startAt = useRef(0);

  const clear = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    setProgress(0);
  }, []);

  const start = useCallback(() => {
    startAt.current = Date.now();
    timer.current = setInterval(() => {
      const elapsed = Date.now() - startAt.current;
      const next = Math.min(1, elapsed / HOLD_MS);
      setProgress(next);
      if (next >= 1) {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        // Defer so the final fill paints before the screen changes.
        setTimeout(onStop, 120);
      }
    }, 16);
  }, [onStop]);

  // A cancel mid-hold must not fire.
  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const fillColor = onDark ? color.white : color.ink;
  const textColor = onDark ? color.ink : color.white;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copy.holdToStop}
      accessibilityHint="Press and hold for one second to stop the workout"
      onPressIn={start}
      onPressOut={clear}
      style={styles.touch}
    >
      <View style={[styles.button, { backgroundColor: color.white }]}>
        {progress > 0 ? (
          <View
            style={[
              styles.fill,
              { width: `${progress * 100}%`, backgroundColor: fillColor },
            ]}
          />
        ) : null}
        <Text style={[type.caption, styles.label, { color: textColor }]}>
          {copy.holdToStop}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touch: {
    flex: 1,
    height: LIVE_CONTROL_HEIGHT,
  },
  button: {
    flex: 1,
    borderRadius: radius.button,
    borderWidth: 2,
    borderColor: color.ink,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.s,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.18,
  },
  label: {
    textAlign: 'center',
  },
});