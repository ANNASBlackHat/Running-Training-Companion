import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Guards the central architectural rule from the Tech Spec section 2:
 *
 *   "Rule: /domain never imports from Expo or React. The runner receives
 *    positions and ticks as inputs and emits cue events as outputs. This is
 *    what makes the later background-location refactor small: only
 *    locationService.ts changes."
 *
 * A violation here would silently make the domain untestable off-device and
 * would couple the logic to native modules, so it is worth a failing test.
 */

const DOMAIN_DIR = join(__dirname, '..');
const SRC_DIR = join(__dirname, '..', '..');

const FORBIDDEN = [
  /from\s+['"]expo[^'"]*['"]/,
  /from\s+['"]react[^'"]*['"]/,
  /from\s+['"]react-native[^'"]*['"]/,
  /require\(\s*['"]expo/,
  /require\(\s*['"]react/,
  /from\s+['"]\.\.\/(services|store|components|app)\//,
];

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('/domain purity', () => {
  const files = collectTsFiles(DOMAIN_DIR);

  it('finds domain source files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [f.slice(SRC_DIR.length + 1), f]))(
    '%s does not import Expo or React',
    (_name, file) => {
      const source = readFileSync(file as string, 'utf8');
      for (const pattern of FORBIDDEN) {
        expect(source).not.toMatch(pattern);
      }
    },
  );
});