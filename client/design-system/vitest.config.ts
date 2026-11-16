import path from "node:path";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          // Logic and component behaviour in jsdom: npm test.
          extends: true,
          test: {
            name: "unit",
            environment: "jsdom",
            globals: true,
            include: ["src/**/*.test.{ts,tsx}", "tests/node/**/*.test.ts", "scripts/**/*.test.mjs"],
            setupFiles: ["./tests/setup-unit.ts"],
          },
        },
        {
          // Every story rendered in Chromium, with its play function and an axe check: npm run test:stories.
          extends: true,
          plugins: [storybookTest({ configDir: path.join(import.meta.dirname, ".storybook") })],
          test: {
            name: "storybook",
            browser: {
              enabled: true,
              headless: true,
              provider: playwright(),
              instances: [{ browser: "chromium" }],
            },
          },
        },
      ],
    },
  }),
);
