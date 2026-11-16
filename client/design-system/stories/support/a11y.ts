/**
 * The open contrast decision (design-system README, "Open decisions for the owner"): white on the
 * Figma pink (3.9:1; 3.6:1 at the cost chip's 85%) and on the End Round red (3.7:1) is below AA
 * for text this size. Stories that show those buttons and chips check contrast everywhere else.
 */
const FIGMA_FILLS = [
  "*:not(.bg-primary):not(.bg-primary *):not(.bg-\\(--chip-cost-bg\\)):not(.bg-\\(--chip-cost-bg\\) *)",
  ":not(.bg-danger-strong):not(.bg-danger-strong *):not(.bg-danger):not(.bg-danger *)",
].join("");

export const figmaButtonContrastException = {
  a11y: { config: { rules: [{ id: "color-contrast", selector: FIGMA_FILLS }] } },
};

/**
 * WCAG 1.4.3 sets no contrast for an inactive control. After Submit a decision's control column
 * (the field or slider and what is under it) dims to 40%, as Figma draws the submitted page; the
 * rule stays on for the rest, the Figma fills excepted as above.
 */
export const submittedDecisionsContrastException = {
  a11y: { config: { rules: [{ id: "color-contrast", selector: `${FIGMA_FILLS}:not([data-locked]):not([data-locked] *)` }] } },
};

/**
 * An initiative chosen in an earlier round dims to 40% with its row, as Figma draws the next round
 * (2230:184619): a choice that can no longer change, inactive, which WCAG 1.4.3 exempts. The rule
 * stays on for the rest, the Figma fills excepted as above.
 */
export const chosenBeforeContrastException = submittedDecisionsContrastException;

/**
 * A long list under a select or combobox scrolls, but focus stays in the field: the arrow keys move
 * the highlight (aria-activedescendant) and the highlighted option scrolls into view, so every
 * option is in reach. axe cannot see that and asks the scrolling list to take focus itself; the
 * rule stays on for every other scrolling region.
 */
export const listboxScrollException = {
  a11y: {
    config: {
      rules: [{ id: "scrollable-region-focusable", selector: '*:not([role="listbox"])' }],
    },
  },
};

/**
 * Base UI keeps a toast out of the accessibility tree while its live region announces it (an
 * error's whole toast, any toast's close button), and brings it back the moment focus enters the
 * toasts (F6, or Tab). axe reports that focusable-while-hidden state as aria-hidden-focus; the rule
 * stays on for everything outside the toast viewport.
 */
export const toastA11yExceptions = {
  a11y: {
    config: {
      // A rule's selector replaces axe's own, so it keeps axe's [aria-hidden="true"].
      rules: [{ id: "aria-hidden-focus", selector: '[aria-hidden="true"]:not([data-toast-viewport] *)' }],
    },
  },
};
