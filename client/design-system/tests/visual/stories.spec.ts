import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

interface IndexEntry {
  id: string;
  type: "story" | "docs";
  title: string;
  name: string;
  tags?: string[];
}

// Every story of the static build. A story tagged "no-screenshot" (an interaction test whose end
// state depends on timing) is left out.
const index = JSON.parse(readFileSync(path.join(import.meta.dirname, "../../storybook-static/index.json"), "utf8")) as {
  entries: Record<string, IndexEntry>;
};
const stories = Object.values(index.entries).filter((entry) => entry.type === "story" && !entry.tags?.includes("no-screenshot"));

interface ViewportOption {
  styles?: { width?: string; height?: string };
}

type PreviewWindow = Window & {
  __STORYBOOK_PREVIEW__?: {
    currentRender?: {
      phase?: string;
      story?: {
        storyGlobals?: { viewport?: { value?: string } };
        parameters?: { viewport?: { options?: Record<string, ViewportOption> } };
      };
    };
  };
};

/**
 * Waits until the story has rendered and its play function has finished, so the screenshot is of
 * the settled final state. The render phase is the signal: a story may render only into a portal
 * (an open dialog), leaving the story root empty.
 */
async function renderStory(page: Page) {
  await page.waitForFunction(() => {
    const phase = (window as PreviewWindow).__STORYBOOK_PREVIEW__?.currentRender?.phase;
    return phase === "finished" || phase === "errored" || phase === "aborted";
  });
}

for (const story of stories) {
  test(`${story.title} / ${story.name}`, async ({ page }) => {
    await page.goto(`/iframe.html?id=${story.id}&viewMode=story`);
    await renderStory(page);
    // A story can ask for a viewport (globals.viewport, as the Storybook toolbar sets it): render it
    // again at that size, as the Vitest story tests do.
    const size = await page.evaluate(() => {
      const story = (window as PreviewWindow).__STORYBOOK_PREVIEW__?.currentRender?.story;
      const name = story?.storyGlobals?.viewport?.value;
      const styles = name ? story?.parameters?.viewport?.options?.[name]?.styles : undefined;
      return styles?.width && styles.height ? { width: Number.parseInt(styles.width, 10), height: Number.parseInt(styles.height, 10) } : null;
    });
    if (size) {
      await page.setViewportSize(size);
      await page.reload();
      await renderStory(page);
    }
    // Web fonts in, so text is measured in the real faces.
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${story.id}.png`, { fullPage: true });
  });
}
