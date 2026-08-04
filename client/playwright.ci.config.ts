import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/**
 * CI variant, referenced by `npm run test:client:ci` from the repo root.
 *
 * This file was named in package.json for a long time without existing, so
 * `npm run test:ci` failed on a missing config rather than on a test. It only
 * differs from the local config where CI genuinely needs it: no reuse of a
 * stray dev server, retries on, and artifacts written for the run summary.
 */
export default defineConfig({
  ...base,
  retries: 2,
  workers: 1,
  forbidOnly: true,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    ...base.use,
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
});
