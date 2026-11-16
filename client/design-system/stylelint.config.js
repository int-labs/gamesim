// Lint for hand-written CSS (the generated files come from the tokens). Colours, type, shadows,
// layers and durations must come from token variables; Tailwind's at-rules are allowed.
export default {
  extends: ["stylelint-config-standard"],
  plugins: ["stylelint-declaration-strict-value"],
  ignoreFiles: ["src/styles/generated/**", "storybook-static/**", "node_modules/**"],
  rules: {
    "at-rule-no-unknown": [true, { ignoreAtRules: ["theme", "source", "utility", "variant", "custom-variant", "apply", "reference", "slot", "tailwind"] }],
    // Tailwind resolves string imports; @custom-variant bodies use & without a scoping rule.
    "import-notation": "string",
    "nesting-selector-no-missing-scoping-root": null,
    "at-rule-no-deprecated": [true, { ignoreAtRules: ["apply"] }],
    "function-no-unknown": [true, { ignoreFunctions: ["--theme", "--spacing", "--alpha", "--value", "--modifier"] }],
    "color-no-hex": true,
    "color-named": "never",
    "function-disallowed-list": ["rgb", "rgba", "hsl", "hsla", "hwb", "lab", "lch", "oklab", "oklch", "color", "color-mix"],
    "scale-unlimited/declaration-strict-value": [
      [
        "/color$/",
        "background",
        "fill",
        "stroke",
        "box-shadow",
        "font-family",
        "font-size",
        "font-weight",
        "line-height",
        "letter-spacing",
        "z-index",
        "transition-duration",
        "animation-duration",
      ],
      {
        ignoreValues: ["currentcolor", "transparent", "inherit", "initial", "unset", "none", "normal", "0"],
        ignoreFunctions: false,
        disableFix: true,
      },
    ],
  },
};
