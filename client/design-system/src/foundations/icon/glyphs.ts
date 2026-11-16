import { createLucideIcon } from "lucide-react";

// The design system's own glyphs, for the few Figma icons lucide does not have. They are built
// like lucide icons (24 px grid, stroked, round caps), so Icon treats them the same way.

/**
 * The breadcrumb separator (Figma "slash-bold", a Bootstrap glyph): a steep slash that at 16 px
 * runs from (10, 2) to (6, 14) with a 1 px stroke, exactly like the Figma vector.
 */
export const SlashSeparator = createLucideIcon("slash-separator", [["path", { d: "M15 3 9 21", key: "slash" }]]);
