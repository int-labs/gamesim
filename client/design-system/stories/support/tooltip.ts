import { expect, screen, waitFor } from "storybook/test";

/**
 * Waits for the tooltip that says `text` (all of it, or one of its lines, as a chart tooltip's
 * value) to show. A tooltip mounts in a transparent first frame (its starting style) and fades
 * in, so finding it is not yet seeing it.
 */
export async function expectTooltip(text: string) {
  const match = await screen.findByText(text, { selector: "[data-open], [data-open] *" });
  const tooltip = match.closest<HTMLElement>("[data-open]") ?? match;
  await waitFor(() => expect(tooltip).toBeVisible());
  return tooltip;
}
