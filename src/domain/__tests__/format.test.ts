import {
  formatClock,
  formatDistance,
  formatPace,
  numberToWords,
  ordinalWords,
  spokenDistance,
  spokenLength,
} from '../format';

describe('numberToWords', () => {
  it('handles the segment lengths the cues actually use', () => {
    expect(numberToWords(400)).toBe('four hundred');
    expect(numberToWords(100)).toBe('one hundred');
    expect(numberToWords(90)).toBe('ninety');
    expect(numberToWords(60)).toBe('sixty');
    expect(numberToWords(4)).toBe('four');
    expect(numberToWords(3)).toBe('three');
  });

  it('handles tens with a unit', () => {
    expect(numberToWords(42)).toBe('forty-two');
    expect(numberToWords(15)).toBe('fifteen');
    expect(numberToWords(20)).toBe('twenty');
  });

  it('handles hundreds with a remainder', () => {
    expect(numberToWords(305)).toBe('three hundred five');
    expect(numberToWords(999)).toBe('nine hundred ninety-nine');
  });
});

describe('ordinalWords', () => {
  it('produces the set announcement phrases from the UI style guide', () => {
    expect(ordinalWords(1)).toBe('first');
    expect(ordinalWords(2)).toBe('second');
    expect(ordinalWords(3)).toBe('third');
    expect(ordinalWords(4)).toBe('fourth');
  });

  it('handles the irregulars above twenty', () => {
    expect(ordinalWords(8)).toBe('eighth');
    expect(ordinalWords(9)).toBe('ninth');
    expect(ordinalWords(12)).toBe('twelfth');
    expect(ordinalWords(21)).toBe('twenty-first');
  });
});

describe('formatClock', () => {
  it('formats the live timer values', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(45)).toBe('0:45');
    expect(formatClock(192)).toBe('3:12');
    expect(formatClock(278)).toBe('4:38');
    expect(formatClock(240)).toBe('4:00');
  });

  it('handles long durations', () => {
    expect(formatClock(3600)).toBe('60:00');
  });
});

describe('formatPace', () => {
  it('formats sec/km as min:sec', () => {
    expect(formatPace(240)).toBe('4:00');
    expect(formatPace(278)).toBe('4:38');
  });

  it('returns n/a when pace is unknown', () => {
    expect(formatPace(null)).toBe('n/a');
    expect(formatPace(0)).toBe('n/a');
  });
});

describe('formatDistance', () => {
  it('uses meters below a kilometre and km above', () => {
    expect(formatDistance(260)).toBe('260 m');
    expect(formatDistance(999)).toBe('999 m');
    expect(formatDistance(1840)).toBe('1.84 km');
    expect(formatDistance(5000)).toBe('5.00 km');
  });
});

describe('spokenLength', () => {
  it('produces the cue text from the cue table', () => {
    expect(spokenLength(240, 0)).toBe('four minutes');
    expect(spokenLength(180, 0)).toBe('three minutes');
    expect(spokenLength(60, 0)).toBe('one minute');
  });

  it('includes seconds when present', () => {
    expect(spokenLength(90, 0)).toBe('one minute thirty seconds');
    expect(spokenLength(1, 0)).toBe('one second');
  });
});

describe('spokenDistance', () => {
  it('matches the spec example "Run, four hundred meters"', () => {
    expect(spokenDistance(400)).toBe('four hundred meters');
    expect(spokenDistance(100)).toBe('one hundred meters');
  });
});