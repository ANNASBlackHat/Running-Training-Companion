import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { HOLD_MS, HoldToStop } from '../HoldToStop';
import { copy } from '@/theme';

/**
 * UI Style Guide section 5: stop "require[s] holding for one second, with a
 * visible fill showing the hold progress, to avoid accidental taps".
 */

describe('HoldToStop', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the exact label from the copy table', () => {
    render(<HoldToStop onStop={jest.fn()} />);
    expect(screen.getByText(copy.holdToStop)).toBeTruthy();
  });

  it('does not fire on a quick tap', () => {
    const onStop = jest.fn();
    render(<HoldToStop onStop={onStop} />);

    fireEvent(screen.getByLabelText(copy.holdToStop), 'pressIn');
    act(() => {
      jest.advanceTimersByTime(300);
    });
    fireEvent(screen.getByLabelText(copy.holdToStop), 'pressOut');

    expect(onStop).not.toHaveBeenCalled();
  });

  it('does not fire when the hold is released early', () => {
    const onStop = jest.fn();
    render(<HoldToStop onStop={onStop} />);

    fireEvent(screen.getByLabelText(copy.holdToStop), 'pressIn');
    act(() => {
      jest.advanceTimersByTime(HOLD_MS - 200);
    });
    fireEvent(screen.getByLabelText(copy.holdToStop), 'pressOut');
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(onStop).not.toHaveBeenCalled();
  });

  it('fires after a full one second hold', () => {
    const onStop = jest.fn();
    render(<HoldToStop onStop={onStop} />);

    fireEvent(screen.getByLabelText(copy.holdToStop), 'pressIn');
    act(() => {
      jest.advanceTimersByTime(HOLD_MS);
    });
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('exposes an accessible label and hint', () => {
    render(<HoldToStop onStop={jest.fn()} />);
    const button = screen.getByLabelText(copy.holdToStop);
    expect(button.props.accessibilityHint).toContain('one second');
  });
});
