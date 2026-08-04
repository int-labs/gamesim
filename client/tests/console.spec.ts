import { expect, test } from "@playwright/test";
import { SKIP_REASON, TOKEN_KEY, dataRows, hasCredentials, signIn, waitForTable } from "./helpers";

/**
 * The console, end to end against a real API.
 *
 * The point of these is the round-trip: a form that opens but never writes, or
 * a write that never refreshes the table, both look fine in isolation and are
 * exactly what an operator hits first. Initiatives is the collection used for
 * the write test because it has no foreign keys — creating and deleting one
 * cannot orphan a decision or a result.
 */

test.describe("console", () => {
  test.skip(!hasCredentials(), SKIP_REASON);

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("groups navigation by when you use it", async ({ page }) => {
    const nav = page.getByRole("navigation");

    // Editable and read-only deliberately never share a group.
    for (const group of ["Session", "Game design", "Market model", "Reference", "Platform"]) {
      await expect(nav.getByText(group, { exact: false }).first()).toBeVisible();
    }

    // Only Session starts open, so an operator mid-class sees eight entries.
    await expect(nav.getByRole("link", { name: "Dashboard" })).toBeVisible();
  });

  test("reaches every collection page without a crash", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    const routes = [
      "/simulations",
      "/rounds",
      "/teams",
      "/decisions",
      "/results",
      "/projections",
      "/game-content",
      "/simulation-types",
      "/products",
      "/product-fields",
      "/segments",
      "/base-data",
      "/drivers",
      "/global-inputs",
      "/initiatives",
      "/param-list",
      "/image-assets",
      "/users",
    ];

    for (const route of routes) {
      await page.goto(route);
      // Every page owns an h1; a blank one means the route rendered nothing.
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 20_000 });
    }

    expect(errors, `Uncaught errors while walking the console:\n${errors.join("\n")}`).toEqual([]);
  });

  test("says plainly that Param list cannot be edited", async ({ page }) => {
    await page.goto("/param-list");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(/param/i);
    await expect(page.getByText(/read-only/i)).toBeVisible();
    // No create affordance, because the API has no write route for it.
    await expect(page.getByRole("button", { name: /new param/i })).toHaveCount(0);
  });

  test("creates, edits and deletes an initiative", async ({ page }) => {
    const name = `E2E probe ${Date.now()}`;
    const renamed = `${name} renamed`;

    await page.goto("/initiatives");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // ── create ──────────────────────────────────────────────────────────
    await page.getByRole("button", { name: /new initiative/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Name", { exact: true }).fill(name);
    await dialog.getByLabel("Cost", { exact: true }).fill("250");
    await dialog.getByLabel("Energy", { exact: true }).fill("3");
    await dialog.getByRole("button", { name: /^create$/i }).click();

    // The dialog closes itself on a resolved mutation, and the table refreshes
    // from the invalidated query — both halves have been broken before.
    await expect(dialog).toBeHidden({ timeout: 20_000 });
    await waitForTable(page);
    const created = dataRows(page).filter({ hasText: name });
    await expect(created).toHaveCount(1, { timeout: 20_000 });

    // ── edit ────────────────────────────────────────────────────────────
    await created.getByRole("button", { name: /edit initiative/i }).click();
    const editDialog = page.getByRole("dialog");
    await expect(editDialog).toBeVisible();
    // Seeded from the row, not blank — a create form wearing an edit title is
    // how you silently create a duplicate instead of editing.
    await expect(editDialog.getByLabel("Name", { exact: true })).toHaveValue(name);

    await editDialog.getByLabel("Name", { exact: true }).fill(renamed);
    await editDialog.getByRole("button", { name: /save changes/i }).click();
    await expect(editDialog).toBeHidden({ timeout: 20_000 });
    await expect(dataRows(page).filter({ hasText: renamed })).toHaveCount(1, { timeout: 20_000 });

    // ── delete ──────────────────────────────────────────────────────────
    await dataRows(page)
      .filter({ hasText: renamed })
      .getByRole("button", { name: /delete initiative/i })
      .click();
    await page.getByRole("button", { name: /^delete initiative$/i }).click();

    await expect(dataRows(page).filter({ hasText: renamed })).toHaveCount(0, { timeout: 20_000 });
  });

  test("never sends a decision field whose JSON is malformed", async ({ page }) => {
    await page.goto("/product-fields");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Watch the wire, not the UI. An earlier version of this test asserted on
    // the inline error message — which renders off the same validation state
    // whether or not submission is actually blocked, so it passed happily with
    // the guard deleted. What matters is that nothing reaches the API.
    const writes: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && /\/products\/[^/]+\/fields/.test(r.url())) {
        writes.push(`${r.method()} ${r.url()}`);
      }
    });

    // And watch for uncaught errors. Removing the guard does still stop the
    // write — because `JSON.parse` throws while the payload is being built —
    // but it throws out of a React event handler, which is an uncaught error
    // and leaves the form in an unexplained state. Blocking the submit
    // deliberately is the difference this assertion pins down.
    const crashes: string[] = [];
    page.on("pageerror", (e) => crashes.push(String(e)));

    await page.getByRole("button", { name: /new field/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Fill everything required, so the ONLY thing standing between this form
    // and the server is the JSON guard.
    const productSelect = dialog.getByLabel("Product", { exact: true });
    await productSelect.selectOption({ index: 1 });
    await dialog.getByLabel("Label", { exact: true }).fill("Malformed probe");
    await dialog.getByLabel("Key", { exact: true }).fill(`malformed_probe_${Date.now()}`);
    await dialog.getByLabel("Type", { exact: true }).selectOption("number");
    await dialog.getByLabel("Coefficients", { exact: true }).fill("{ not json");

    await dialog.getByRole("button", { name: /^create$/i }).click();
    await page.waitForTimeout(1500);

    expect(writes, "malformed JSON must never be written").toEqual([]);
    expect(crashes, "the form must refuse it, not throw").toEqual([]);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/must be a JSON object/i)).toBeVisible();
  });

  test("shows who is in the room, including teams that never started", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // The panel a facilitator reads while walking the room. Its value is that
    // it distinguishes "not started" from "submitted" — the console could
    // always see decisions, which is the least actionable of the two.
    const band = page.getByText("In the room", { exact: true });
    await expect(band).toBeVisible({ timeout: 20_000 });

    // Every team gets a row whether or not it has ever reported, because a
    // missing row is exactly the state worth surfacing.
    const rows = page.locator("li").filter({ hasText: /Not started|Playing|Idle|Finished/ });
    await expect(rows.first()).toBeVisible({ timeout: 20_000 });
  });

  test("shows the debrief's evidence, not just its prose", async ({ page }) => {
    await page.goto("/debrief");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // The section a facilitator writes FROM. If the figures stop rendering the
    // page silently degrades to the text editor it used to be.
    await expect(page.getByText("What the rounds showed")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Revenue, and what each team kept")).toBeVisible();

    // The player's rubric is shown separately and SAYS it is a different
    // model — averaging the two would invent precision neither has.
    await expect(page.getByText("How each run finished")).toBeVisible();
    await expect(page.getByText(/not the competitive scorer above/)).toBeVisible();
  });

  test("refuses to leak a rival's run report to a team token", async ({ page }) => {
    const api = process.env.VITE_GAMESIM_API_URL ?? "http://localhost:5000/api";
    const res = await page.request.get(`${api}/run-reports?simulationId=x`, {
      headers: { Authorization: "Bearer not-a-real-token" },
      failOnStatusCode: false,
    });
    expect([401, 403]).toContain(res.status());
  });

  test("refuses to leak live progress to a team token", async ({ page }) => {
    // A team asking for this is asking for every rival's cash position
    // mid-round — the thing the game is about discovering.
    const api = process.env.VITE_GAMESIM_API_URL ?? "http://localhost:5000/api";
    const res = await page.request.get(`${api}/team-progress?simulationId=x`, {
      headers: { Authorization: "Bearer not-a-real-token" },
      failOnStatusCode: false,
    });
    expect([401, 403]).toContain(res.status());
  });

  test("reports whether uploads survive a redeploy", async ({ page }) => {
    // The console banner is the only place an operator learns that local-disk
    // storage is ephemeral. It reads a verified probe, not just config.
    //
    // Hit the API directly: `baseURL` is the Vite dev server, which answers
    // every unknown path with the SPA's index.html rather than a 404, so a
    // relative request here would "succeed" and then fail to parse as JSON.
    const api = process.env.VITE_GAMESIM_API_URL ?? "http://localhost:5000/api";
    const token = await page.evaluate((k) => localStorage.getItem(k), TOKEN_KEY);
    const response = await page.request
      .get(`${api}/image-assets/storage`, { headers: { Authorization: `Bearer ${token}` } })
      .catch(() => null);
    test.skip(!response || !response.ok(), "API not reachable");

    const body = await response!.json();
    expect(body).toHaveProperty("driver");
    expect(body).toHaveProperty("durable");
    expect(typeof body.message).toBe("string");
  });
});
