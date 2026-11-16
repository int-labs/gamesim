import type { Decorator, Preview } from "@storybook/react-vite";
import { MotionProvider, tokens } from "../src";
import "./preview.css";

/**
 * The workbench toolbar: "Reset" puts data-ds-root on <html> (the design system owns the page,
 * as in the Admin) or leaves it off (a legacy MUI page, where each migrated screen scopes its own
 * reset); "Effects" is the app's Reduce effects switch.
 */
const withDesignSystemRoot: Decorator = (Story, context) => {
  // Set before the story renders, as an app sets it in its HTML: switched on after the first
  // paint, the reset would start the transitions of every element that animates its size.
  document.documentElement.toggleAttribute("data-ds-root", context.globals.reset !== "off");
  return (
    <MotionProvider reduceEffects={context.globals.effects === "reduced"}>
      <Story />
    </MotionProvider>
  );
};

const preview: Preview = {
  decorators: [withDesignSystemRoot],
  globalTypes: {
    reset: {
      description: "Design-system reset and base styles on the page",
      toolbar: {
        title: "Reset",
        icon: "paintbrush",
        items: [
          { value: "on", title: "Reset on (design-system page)" },
          { value: "off", title: "Reset off (legacy page)" },
        ],
        dynamicTitle: true,
      },
    },
    effects: {
      description: "The app's Reduce effects switch",
      toolbar: {
        title: "Effects",
        icon: "lightning",
        items: [
          { value: "full", title: "Full effects" },
          { value: "reduced", title: "Reduce effects" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { reset: "on", effects: "full", backgrounds: { value: "page" } },
  parameters: {
    layout: "padded",
    controls: { expanded: true, sort: "requiredFirst" },
    backgrounds: {
      options: {
        page: { name: "Page", value: tokens.color.surface.page },
        card: { name: "Card", value: tokens.color.surface.card },
        inverse: { name: "Inverse", value: tokens.color.surface.inverse },
      },
    },
    viewport: {
      options: {
        figma: { name: "Figma frame 1440", styles: { width: "1440px", height: "1024px" }, type: "desktop" },
        laptop: { name: "Laptop 1280", styles: { width: "1280px", height: "800px" }, type: "desktop" },
        figmaTablet: { name: "Figma tablet 1024", styles: { width: "1024px", height: "1366px" }, type: "tablet" },
        tablet: { name: "Tablet 768", styles: { width: "768px", height: "1024px" }, type: "tablet" },
        figmaPhone: { name: "Figma phone 440", styles: { width: "440px", height: "956px" }, type: "mobile" },
        phone: { name: "Phone 375", styles: { width: "375px", height: "812px" }, type: "mobile" },
      },
    },
    a11y: {
      // Violations fail the story's test (npm run test:stories).
      test: "error",
    },
    options: {
      storySort: {
        order: [
          "Introduction",
          "Foundations",
          ["Colours", "Typography", "Text", "Spacing", "Elevation", "Motion", "Icons", "Numbers", "Tokens"],
          "Components",
          "Data",
          "Layout",
        ],
      },
    },
  },
};

export default preview;
