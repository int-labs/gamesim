import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end config for the operator console.
 *
 * This replaces the untouched `npx playwright init` scaffold, which pointed at
 * a `tests/` directory that did not exist, ran three browser engines, and set
 * `reporter: "null"` — so `npm test` reported "No tests found" and a genuine
 * failure would have printed nothing at all.
 *
 * ── CREDENTIALS ─────────────────────────────────────────────────────────────
 * The console requires a real login, and this repo is public, so the specs read
 * `E2E_EMAIL` / `E2E_PASSWORD` from the environment and skip themselves with an
 * explanation when they are absent. Never inline an account here.
 *
 *   E2E_EMAIL=you@intlabs.io E2E_PASSWORD='…' npm run test:e2e
 *
 * Chromium only: these are smoke tests for an internal tool that runs on a
 * facilitator's laptop, so three engines would triple the runtime for no
 * signal. Add engines here if the console ever faces the public.
 */

const PORT = Number(process.env.E2E_PORT ?? 3001);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // `list` prints each test as it runs; the old "null" reporter meant a red
  // suite and a green suite looked identical from the terminal.
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  /**
   * Boot the dev server automatically so `npm test` works from a cold clone.
   * `reuseExistingServer` keeps it from fighting a server that is already up.
   * The API is NOT started here — these tests talk to a real backend on :5000,
   * which is rather the point of a smoke test.
   */
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm start -- --port ${PORT} --strictPort`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
