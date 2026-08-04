/**
 * ESLint has never actually run on the console either.
 *
 * The config lived in `eslintrc.js` — no leading dot — so nothing discovered
 * it, and it listed `import`/`simple-import-sort` plugins that were never in
 * package.json. This is the flat config ESLint 9 finds by default, with only
 * the plugins that are really installed.
 *
 * The rule that earns its keep here is `react-hooks/exhaustive-deps`: a stale
 * closure in a dashboard that polls is exactly the bug types can't see.
 * `npx tsc --noEmit` is still the correctness gate.
 */
import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

// Folded in from .eslintignore, which ESLint 9 no longer reads.
const IGNORES = ["build/**", "coverage/**", "dist/**", "node_modules/**", "public/**"];

export default [
  { ignores: IGNORES },

  js.configs.recommended,

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        navigator: "readonly",
        location: "readonly",
        console: "readonly",
        fetch: "readonly",
        FormData: "readonly",
        Blob: "readonly",
        File: "readonly",
        FileReader: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        AbortController: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        matchMedia: "readonly",
        ResizeObserver: "readonly",
        IntersectionObserver: "readonly",
        MutationObserver: "readonly",
        HTMLElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLTextAreaElement: "readonly",
        HTMLSelectElement: "readonly",
        HTMLDivElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLFormElement: "readonly",
        HTMLAnchorElement: "readonly",
        HTMLImageElement: "readonly",
        HTMLSpanElement: "readonly",
        HTMLParagraphElement: "readonly",
        HTMLHeadingElement: "readonly",
        HTMLTableElement: "readonly",
        SVGSVGElement: "readonly",
        Element: "readonly",
        Event: "readonly",
        KeyboardEvent: "readonly",
        MouseEvent: "readonly",
        CustomEvent: "readonly",
        Image: "readonly",
        Intl: "readonly",
        crypto: "readonly",
        performance: "readonly",
      },
    },
    plugins: { "@typescript-eslint": tsPlugin, "react-hooks": reactHooks },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // The console talks to an untyped API surface on purpose; the row shapes
      // come from Mongoose documents, not from a generated client.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],

      // TypeScript reports these better.
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-redeclare": "off",
    },
  },

  // Cypress augments the global Cypress namespace; that is the documented way
  // to add custom commands, so the rule is wrong here rather than the code.
  {
    files: ["cypress/**/*.{ts,tsx}"],
    rules: { "@typescript-eslint/no-namespace": "off" },
  },

  // Jest's config and setup are CommonJS, unlike everything else in src/.
  {
    files: ["jest.config.js", "jest.setup.js", "**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        module: "writable",
        require: "readonly",
        process: "readonly",
        console: "readonly",
        global: "writable",
        jest: "readonly",
      },
    },
  },

  {
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { process: "readonly", console: "readonly", URL: "readonly", __dirname: "readonly" },
    },
  },

  prettier,
];
