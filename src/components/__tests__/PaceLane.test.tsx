import { render, screen } from '@testing-library/react-native';

import { PaceLane } from '../PaceLane';
import { copy, color } from '@/theme';
import { RANGE } from './fixtures';

/**
 * UI Style Guide section 5 rules that are worth locking down, because each one
 * is a way the runner could misread the screen at a glance.
 */

describe('PaceLane', () => {
  it('is hidden when the segment has no target range', () => {
    render(
      <PaceLane paceSecPerKm={280} status="noTarget" range={undefined} />,
    );
    expect(screen.queryByText('target 4:30 to 4:45')).toBeNull();
  });

  it('shows the target bounds', () => {
    render(<PaceLane paceSecPerKm={280} status="in" range={RANGE} />);
    expect(screen.getByText('target 4:30 to 4:45')).toBeTruthy();
  });

  it('says "No pace yet" when there is no live pace', () => {
    render(<PaceLane paceSecPerKm={null} status="unknown" range={RANGE} />);
    expect(screen.getByText(copy.noPaceYet)).toBeTruthy();
  });

  it('shows the formatted pace when one exists', () => {
    render(<PaceLane paceSecPerKm={278} status="in" range={RANGE} />);
    expect(screen.getByText('4:38 /km')).toBeTruthy();
  });

  it('shows no alert pill while in range', () => {
    render(<PaceLane paceSecPerKm={278} status="in" range={RANGE} />);
    expect(screen.queryByText(copy.tooFast)).toBeNull();
    expect(screen.queryByText(copy.tooSlow)).toBeNull();
  });

  it('says "Too fast" with a left arrow when above the range', () => {
    render(<PaceLane paceSecPerKm={250} status="tooFast" range={RANGE} />);
    expect(screen.getByText(copy.tooFast)).toBeTruthy();
    expect(screen.getByText('←')).toBeTruthy();
  });

  it('says "Too slow" with a right arrow when below the range', () => {
    render(<PaceLane paceSecPerKm={320} status="tooSlow" range={RANGE} />);
    expect(screen.getByText(copy.tooSlow)).toBeTruthy();
    expect(screen.getByText('→')).toBeTruthy();
  });

  it('describes the pace for a screen reader', () => {
    render(<PaceLane paceSecPerKm={250} status="tooFast" range={RANGE} />);
    expect(
      screen.getByLabelText('Pace 4:10 per kilometre, too fast'),
    ).toBeTruthy();
  });

  it('labels an unknown pace for a screen reader', () => {
    render(<PaceLane paceSecPerKm={null} status="unknown" range={RANGE} />);
    expect(screen.getByLabelText('Pace not yet available')).toBeTruthy();
  });

  it('keeps alert as a fill, never as the pill text colour (section 2)', () => {
    render(<PaceLane paceSecPerKm={250} status="tooFast" range={RANGE} />);
    const pillText = screen.getByText(copy.tooFast);
    // The pill background is alert; the glyph itself must be ink.
    const style = pillText.props.style as { color?: string };
    const flattened = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
    expect(flattened.color).toBe(color.ink);
  });
});
