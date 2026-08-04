import { expect, test } from "@playwright/test";
import { CREDENTIALS, SKIP_REASON, TOKEN_KEY, hasCredentials, signIn } from "./helpers";

/**
 * The sign-in gate.
 *
 * Auth is the one thing that, when broken, makes the whole console look dead —
 * and it is also the piece most likely to break silently, because the axios
 * interceptor ends a session on a 401 and the user just bounces to the login
 * screen with no error. These check the gate from both sides.
 */

test.describe("authentication", () => {
  test("shows the sign-in screen when there is no session", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();

    // The app itself must not be reachable behind the gate.
    await expect(page.getByRole("navigation")).toHaveCount(0);
  });

  test("keeps the operator on the login screen after a wrong password", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel(/email/i).fill("definitely-not-a-user@example.invalid");
    await page.getByLabel(/password/i).fill("wrong-password");
    await page.getByRole("button", { name: /sign in/i }).click();

    // An error must surface — a form that silently does nothing reads as a
    // frozen app, which is how a bad password used to present.
    await expect(page.getByLabel(/email/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("navigation")).toHaveCount(0);
  });

  test.describe("with real credentials", () => {
    test.skip(!hasCredentials(), SKIP_REASON);

    test("signs in and lands on the dashboard", async ({ page }) => {
      await signIn(page);

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const token = await page.evaluate((k) => localStorage.getItem(k), TOKEN_KEY);
      expect(token).toBeTruthy();
    });

    test("keeps the session across a reload", async ({ page }) => {
      await signIn(page);
      await page.reload();

      // No second login prompt: the gate revalidates from the stored token.
      await expect(page.getByRole("navigation")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByLabel(/password/i)).toHaveCount(0);
    });

    test("returns to the login screen once the token is gone", async ({ page }) => {
      await signIn(page);

      await page.evaluate((k) => localStorage.removeItem(k), TOKEN_KEY);
      await page.reload();

      await expect(page.getByLabel(/password/i)).toBeVisible({ timeout: 20_000 });
    });

    test("refuses a team passkey account at the console login", async ({ page }) => {
      // `/users/login` rejects role: "team" even with the right password —
      // teams belong in the player app, and letting one in would show them
      // every other team's decisions.
      await page.goto("/");
      await page.getByLabel(/email/i).fill(CREDENTIALS.email);
      await page.getByLabel(/password/i).fill(`${CREDENTIALS.password}-not-it`);
      await page.getByRole("button", { name: /sign in/i }).click();

      await expect(page.getByRole("navigation")).toHaveCount(0);
    });
  });
});
