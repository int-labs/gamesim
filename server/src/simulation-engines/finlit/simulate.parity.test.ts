// Parity test: the shared @gamesim/finlit-engine must reproduce notebook-pixel-sim
// origin/V3's real simulatePhase() output byte-for-byte (within float tolerance),
// for the same inputs. Fixtures were captured by running the actual V3 engine
// (see fixtures/notebookV3.json), not derived from this copy.
import { simulatePhase } from '@gamesim/finlit-engine';
import type { FinlitLine, FinlitDecisions } from '@gamesim/finlit-engine';
import fixtures from './fixtures/notebookV3.json';

const EPS = 1e-9;

function assertCloseDeep(actual: unknown, expected: unknown, path: string) {
  if (typeof expected === 'number') {
    expect(typeof actual).toBe('number');
    expect(Math.abs((actual as number) - expected)).toBeLessThanOrEqual(EPS * Math.max(1, Math.abs(expected)));
    return;
  }
  if (Array.isArray(expected)) {
    expect(Array.isArray(actual)).toBe(true);
    expect((actual as unknown[]).length).toBe(expected.length);
    expected.forEach((v, i) => assertCloseDeep((actual as unknown[])[i], v, `${path}[${i}]`));
    return;
  }
  if (expected && typeof expected === 'object') {
    for (const key of Object.keys(expected as object)) {
      assertCloseDeep((actual as Record<string, unknown>)[key], (expected as Record<string, unknown>)[key], `${path}.${key}`);
    }
    return;
  }
  expect(actual).toBe(expected);
}

describe('finlit engine parity with notebook-pixel-sim origin/V3', () => {
  for (const [name, fixture] of Object.entries(fixtures as Record<string, { input: { lines: FinlitLine[]; decisions: FinlitDecisions; phase: 1 | 2 | 3; opts?: { marketShare?: number } }; output: unknown }>)) {
    it(`matches V3 output for fixture: ${name}`, () => {
      const actual = simulatePhase(fixture.input.lines, fixture.input.decisions, fixture.input.phase, fixture.input.opts);
      assertCloseDeep(actual, fixture.output, name);
    });
  }
});
