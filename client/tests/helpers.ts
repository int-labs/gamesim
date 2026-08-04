import { expect, type Page } from "@playwright/test";

/**
 * Shared plumbing for the console smoke tests.
 *
 * Credentials come from the environment because this repo is public. A spec
 * that needs a session calls `requireCredentials()` in a `beforeAll` and skips
 * with a readable reason rather than failing with a login timeout.
 */

export const CREDENTIALS = {
  email: process.env.E2E_EMAIL ?? "",
  password: process.env.E2E_PASSWORD ?? "",
};

export const hasCredentials = () => !!CREDENTIALS.email && !!CREDENTIALS.password;

export const SKIP_REASON =
  "Set E2E_EMAIL and E2E_PASSWORD to run the console smoke tests against a real API.";

/** The key `src/lib/auth.ts` owns. Clearing it is how a test signs out. */
export const TOKEN_KEY = "gamesim:console:token";

export async function signIn(page: Page): Promise<void> {
  await page.goto("/");

  await page.getByLabel(/email/i).fill(CREDENTIALS.email);
  await page.getByLabel(/password/i).fill(CREDENTIALS.password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // The gate blocks the app until GET /users/me confirms the session, so the
  // sidebar appearing is the real signal that auth completed — not the click.
  await expect(page.getByRole("navigation")).toBeVisible({ timeout: 20_000 });
}

/**
 * Wait for a table to have finished loading.
 *
 * Every collection page renders skeletons first; asserting on row count too
 * early is the classic flake, and retrying the assertion is not the same as
 * waiting for the skeletons to go.
 */
export async function waitForTable(page: Page): Promise<void> {
  await expect(page.locator("table")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-skeleton]")).toHaveCount(0, { timeout: 20_000 }).catch(() => {
    // Pages that don't mark skeletons still settle on the row assertions below.
  });
}

/** Rows that carry real data, excluding grouping bands and empty states. */
export function dataRows(page: Page) {
  return page.locator("tbody tr").filter({ hasNot: page.locator("td[colspan]") });
}
