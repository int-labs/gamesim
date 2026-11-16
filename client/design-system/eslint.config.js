// Lint for the design system. Besides code quality it enforces the design rules:
//   - Tailwind classes must exist in the locked theme (tokens only) and must not use arbitrary
//     values, the ! modifier, bare numbers where tokens have names, or alpha steps outside the scale;
//   - a CSS variable used in a class must be a token;
//   - no raw colours in TypeScript: colours come from tokens;
//   - no MUI, emotion, framer-motion or other class helpers.
import { readFileSync } from "node:fs";
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import { getDefaultSelectors } from "eslint-plugin-better-tailwindcss/defaults";
import reactHooks from "eslint-plugin-react-hooks";
import storybook from "eslint-plugin-storybook";
import globals from "globals";
import tseslint from "typescript-eslint";

// Every CSS variable the tokens define (theme and root), for the variable-reference rule.
const tokenVariables = [...readFileSync(new URL("./src/styles/generated/theme.css", import.meta.url), "utf8").matchAll(/^\s*(--[a-z0-9-]+):/gm)].map(
  (match) => match[1],
);

// Opacity and alpha steps allowed on colours: the alphas the Figma file uses.
const ALPHA_STEPS = "0|4|8|12|16|24|32|40|48|50|64|80|100";
// Variants: named ones (hover:, md:, data-open:), and bracketed data or aria states (data-[side=top]:).
const VARIANT = String.raw`(?:[\w-]+|(?:(?:group|peer|has|not|in)-)*(?:data|aria)-\[[^\]]*\](?:\/[\w-]+)?)`;
const VARIANTS = String.raw`(?:${VARIANT}:)*`;
const COLOUR_UTILITIES = "bg|text|border(?:-[trblxyse])?|ring|outline|fill|stroke|from|via|to|shadow|inset-shadow|decoration|divide|placeholder|caret|accent";

const restrictedClasses = [
  {
    // Any bracket outside a data or aria state variant: arbitrary values, properties, variants, breakpoints.
    pattern: String.raw`^(?!${VARIANTS}[^\[]*$).*\[`,
    message: "Arbitrary values bypass the tokens. Use a token utility, or a token variable such as h-(--button-height-md).",
  },
  { pattern: String.raw`^!|!$`, message: "The ! modifier fights the cascade. Use a variant or the component's recipe." },
  { pattern: String.raw`^${VARIANTS}-?z-\d+$`, message: "Use a layer token: z-dropdown, z-modal, z-popover, z-toast, z-tooltip." },
  { pattern: String.raw`^${VARIANTS}(?:duration|delay)-\d+$`, message: "Use a duration token: duration-micro, duration-fast, duration-base, duration-slow." },
  {
    pattern: String.raw`^${VARIANTS}opacity-(?!(?:${ALPHA_STEPS})$)\d+$`,
    message: `Opacity must be one of the alpha steps (${ALPHA_STEPS.replaceAll("|", ", ")}).`,
  },
  {
    pattern: String.raw`^${VARIANTS}(?:${COLOUR_UTILITIES})-[^/]+\/(?!(?:${ALPHA_STEPS})$)[^/]+$`,
    message: `A colour's alpha must be one of the steps (${ALPHA_STEPS.replaceAll("|", ", ")}); a text size takes its line height from a type role.`,
  },
  {
    pattern: String.raw`\((?!(?:${tokenVariables.join("|")})\))(--[\w-]+)\)`,
    message: "$1 is not a design token.",
  },
];

const RAW_COLOUR = String.raw`/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-zA-Z])|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/`;

export default defineConfig(
  {
    ignores: ["storybook-static/", "test-results/", "playwright-report/", "blob-report/", "node_modules/"],
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Destructuring a prop out next to a rest element is how a component keeps it off the DOM.
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
    },
  },
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["scripts/**/*.test.mjs"],
    languageOptions: { globals: { ...globals.vitest } },
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat["recommended-latest"]],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ["src/**/*.{ts,tsx}", "stories/**/*.{ts,tsx}", ".storybook/**/*.{ts,tsx}"],
    plugins: { "better-tailwindcss": betterTailwindcss },
    settings: {
      "better-tailwindcss": {
        entryPoint: "src/styles/index.css",
        // Also lint class maps kept in objects named ...Tones or ...Classes.
        selectors: [...getDefaultSelectors(), { kind: "variable", name: "^.+(?:Tones|Classes)$", match: [{ type: "objectValues" }] }],
      },
    },
    rules: {
      ...betterTailwindcss.configs["correctness-error"].rules,
      "better-tailwindcss/no-restricted-classes": ["error", { restrict: restrictedClasses }],
      "better-tailwindcss/no-duplicate-classes": "error",
      "better-tailwindcss/no-unnecessary-whitespace": "error",
      "better-tailwindcss/no-deprecated-classes": "error",
      "better-tailwindcss/enforce-shorthand-classes": "error",
      "better-tailwindcss/enforce-canonical-classes": "error",
      "no-restricted-syntax": [
        "error",
        { selector: `Literal[value=${RAW_COLOUR}]`, message: "Raw colour: use a token (a class, a CSS variable, or tokens.color from the design system)." },
        { selector: `TemplateElement[value.raw=${RAW_COLOUR}]`, message: "Raw colour: use a token (a class, a CSS variable, or tokens.color from the design system)." },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@mui/*", "@emotion/*"], message: "The design system replaces MUI and emotion." },
          ],
          paths: [
            { name: "mui-nested-menu", message: "Use the design system's Menu." },
            { name: "framer-motion", message: "Import from motion/react." },
            { name: "motion/react", importNames: ["motion"], message: "Use m, which loads its features lazily (MotionProvider)." },
            { name: "tailwind-merge", message: "Use cn or tv from the design system (they know the token names)." },
            { name: "clsx", message: "Use cn from the design system." },
            { name: "classnames", message: "Use cn from the design system." },
          ],
        },
      ],
    },
  },
  {
    // Generated token values and tests that check them may spell colours out.
    files: ["src/tokens/generated/**", "stories/generated/**", "**/*.test.{ts,tsx}"],
    rules: { "no-restricted-syntax": "off" },
  },
  ...storybook.configs["flat/recommended"],
);
