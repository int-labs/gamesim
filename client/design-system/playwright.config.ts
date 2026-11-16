import { defineConfig, devices } from "@playwright/test";

// Screenshots of every story of the static Storybook build (npm run build-storybook first).
// Baselines are rendered in the Playwright Linux image, locally and in CI, so they match exactly:
//   docker run --rm --ipc=host -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v1.63.0-noble \
//     npx playwright test [--update-snapshots]
const PORT = 6107;

export default defineConfig({
  testDir: "tests/visual",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  },
  expect: {
    // The palette and token reference pages are long; a full-page capture takes a few seconds.
    timeout: 30_000,
    toHaveScreenshot: { animations: "disabled", caret: "hide", scale: "css" },
  },
  webServer: {
    command: `node tests/visual/serve.mjs ${PORT}`,
    url: `http://localhost:${PORT}/index.json`,
    reuseExistingServer: !process.env.CI,
  },
});
