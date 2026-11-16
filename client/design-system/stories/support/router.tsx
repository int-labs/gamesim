import type { Decorator } from "@storybook/react-vite";

/**
 * Stands in for the app's router: a link to "#somewhere" cancels the browser's navigation, as a
 * router link does, so a story never leaves its page (the Vitest story runner lives in that page).
 */
export const withStoryRouter: Decorator = (Story) => (
  <div
    className="contents"
    onClickCapture={(event) => {
      if (event.target instanceof Element && event.target.closest("a[href^='#']")) event.preventDefault();
    }}
  >
    <Story />
  </div>
);
