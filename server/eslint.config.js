/**
 * ESLint has never actually run on this codebase.
 *
 * The config lived in `eslintrc.js` — no leading dot — so ESLint's automatic
 * discovery never found it, and there was no `lint` script to point at it by
 * hand. It also listed `import` and `simple-import-sort` plugins that were
 * never added to package.json, so it could not have loaded even if found.
 *
 * This is the flat config ESLint 9 looks for by default, using only plugins
 * that are genuinely installed. TypeScript itself (`npx tsc --noEmit`) remains
 * the real correctness gate; lint is here for the things types don't catch.
 */
const js = require("@eslint/js");
const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const prettier = require("eslint-config-prettier");

module.exports = [
  // Folded in from .eslintignore, which ESLint 9 no longer reads.
  { ignores: ["build/**", "coverage/**", "dist/**", "node_modules/**", "uploads/**"] },

  js.configs.recommended,

  // Plain JS in this repo is Node — config files, jest setup, and the .mjs
  // ops scripts. Without these globals every `process`/`console` is a
  // no-undef error, which is noise, not a finding.
  {
    files: ["**/*.{js,cjs,mjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        module: "writable",
        exports: "writable",
        require: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        fetch: "readonly",
        URL: "readonly",
        FormData: "readonly",
        Blob: "readonly",
        AbortSignal: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
      },
    },
    rules: { "no-console": "off" },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: { sourceType: "module" },
  },

  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        module: "writable",
        require: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        AbortSignal: "readonly",
        URL: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
      },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,

      // The codebase leans on `any` at the Mongoose and Express boundaries on
      // purpose; flagging every one would bury the findings that matter.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],

      // TypeScript already reports these, with better messages.
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-redeclare": "off",
    },
  },

  // `src/finlit/` is a hand-vendored copy of the player's engine, kept
  // byte-comparable with upstream (see src/test/finlitEngineParity.test.ts).
  // Tidying an "unused" import here is drift, not a cleanup — the parity test
  // will fail, and rightly.
  {
    files: ["src/finlit/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },

  {
    files: ["scripts/**/*.{ts,mjs}", "src/test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-var-requires": "off",
      // The parity test requires its two modules lazily and by path, so a
      // broken import fails inside the test with the path in the message
      // rather than taking the whole suite down at collection time.
      "@typescript-eslint/no-require-imports": "off",
      "no-console": "off",
    },
  },

  // Must stay last: turns off everything that would fight Prettier.
  prettier,
];
