/**
 * Display formatting and spoken-phrase helpers.
 *
 * From .specs/Running Training Companion_ Tech Spec.md section 3:
 *   "Formatting (4:30 /km) is a display concern only."
 *
 * Voice text follows the UI Style Guide section 8 examples:
 *   "Run. Four minutes."  "Set two of four."  "Too slow."  "Workout complete."
 */

const MINUTE_WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
  'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
  'sixteen', 'seventeen', 'eighteen', 'nineteen',
];

const TENS_WORDS = [
  '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy',
  'eighty', 'ninety',
];

const ORDINAL_WORDS = [
  'zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh',
  'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth',
  'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth',
  'nineteenth',
];

const clampInt = (n: number): number => Math.max(0, Math.round(n));

/** English number words up to 999. Enough for segment lengths and set counts. */
export function numberToWords(n: number): string {
  const v = clampInt(n);
  if (v < 20) return MINUTE_WORDS[v];
  if (v < 100) {
    const tens = Math.floor(v / 10);
    const ones = v % 10;
    return ones === 0 ? TENS_WORDS[tens] : `${TENS_WORDS[tens]}-${MINUTE_WORDS[ones]}`;
  }
  const hundreds = Math.floor(v / 100);
  const rest = v % 100;
  const head = `${MINUTE_WORDS[hundreds]} hundred`;
  return rest === 0 ? head : `${head} ${numberToWords(rest)}`;
}

const ORDINAL_EXCEPTIONS: Record<string, string> = {
  one: 'first',
  two: 'second',
  three: 'third',
  five: 'fifth',
  eight: 'eighth',
  nine: 'ninth',
  twelve: 'twelfth',
};

/** Ordinal words up to 999, e.g. 2 -> "second" (used by "Set two of four"). */
export function ordinalWords(n: number): string {
  const v = clampInt(n);
  if (v < 20) return ORDINAL_WORDS[v];

  const words = numberToWords(v).split('-');
  const last = words[words.length - 1];
  const suffix = ORDINAL_EXCEPTIONS[last] ?? `${last}th`;
  words[words.length - 1] = suffix;
  return words.join('-');
}

/** "4:38" style clock from seconds. Rounds to the nearest second. */
export function formatClock(totalSec: number): string {
  const s = clampInt(totalSec);
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

/** Pace as "4:38" per km. Returns "n/a" when pace is unknown. */
export function formatPace(secPerKm: number | null): string {
  if (secPerKm === null || !Number.isFinite(secPerKm) || secPerKm <= 0) {
    return 'n/a';
  }
  return formatClock(secPerKm);
}

/** Distance in meters, switching to km with one decimal above 1000 m. */
export function formatDistance(meters: number): string {
  const m = Math.max(0, meters);
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

/** Spoken length of a segment: "four minutes" / "four hundred meters". */
export function spokenLength(seconds: number, meters: number): string {
  const secs = clampInt(seconds);
  if (secs === 0) return 'zero seconds';
  const min = Math.floor(secs / 60);
  const rest = secs % 60;
  const parts: string[] = [];

  if (min > 0) parts.push(`${numberToWords(min)} ${min === 1 ? 'minute' : 'minutes'}`);
  if (rest > 0) parts.push(`${numberToWords(rest)} ${rest === 1 ? 'second' : 'seconds'}`);

  return parts.join(' ');
}

/** Spoken distance, e.g. 400 -> "four hundred meters". Matches the spec's cue examples. */
export function spokenDistance(meters: number): string {
  const m = clampInt(meters);
  return `${numberToWords(m)} ${m === 1 ? 'meter' : 'meters'}`;
}