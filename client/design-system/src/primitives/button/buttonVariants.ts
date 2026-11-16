import { tv, type VariantProps } from "../../lib/tv";

/**
 * The look of every button, shared by Button and LinkButton.
 *
 * `solid` is the Figma btnPublish, layer for layer, checked pixel by pixel against its render: the
 * fill, a white sheen (swapped for a pink one on hover), the violet and orchid glow (5%, 32% on
 * hover), the 12% dark stroke as inner and outer rings, the cyan glow around the label and the
 * 3 px gradient rim. `outline` and `text` are the Preline buttons in the
 * brand pink; `outline` in `danger` is the team dialog's Delete, white with red text.
 * `secondary` is the list toolbar's Sort and Filter: white with a gray 400 edge outside the box.
 * `flat` is the dialog's Delete: red 500 with a darker edge.
 */
export const buttonVariants = tv({
  slots: {
    root: [
      "group/button relative isolate inline-flex shrink-0 items-center justify-center overflow-hidden whitespace-nowrap select-none",
      "cursor-pointer transition duration-fast ease-standard",
      "outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus-ring",
      "data-disabled:cursor-not-allowed",
    ],
    sheen: "pointer-events-none absolute inset-0 bg-gradient-sheen transition-opacity duration-base",
    sheenHover: "pointer-events-none absolute inset-0 bg-gradient-sheen-hover opacity-0 transition-opacity duration-base",
    glow: "pointer-events-none absolute inset-0 bg-(--button-glow-color) opacity-4 transition-opacity duration-base",
    content: "relative inline-flex items-center justify-center gap-(--button-gap) transition-opacity duration-fast",
    overlay: "absolute inset-0 flex items-center justify-center",
  },
  variants: {
    variant: {
      solid: {
        root: "rim shadow-button inset-shadow-button",
        content: "drop-shadow-glow",
        overlay: "drop-shadow-glow-strong",
      },
      outline: { root: "border border-primary bg-surface-card text-fg-link" },
      text: { root: "text-fg-link" },
      secondary: { root: "bg-surface-card text-fg-muted ring ring-line-control" },
      flat: { root: "shadow-sm inset-ring inset-ring-line-hairline" },
    },
    tone: {
      primary: {},
      energy: {},
      danger: {},
    },
    size: {
      xs: { root: "h-(--button-height-xs) rounded-(--button-radius-xs) px-(--button-padding-x-xs) type-caption" },
      sm: { root: "h-(--button-height-sm) rounded-(--button-radius) px-(--button-padding-x-sm) type-button" },
      md: { root: "h-(--button-height-md) rounded-(--button-radius) px-(--button-padding-x-md) type-button" },
      lg: { root: "h-(--button-height-lg) rounded-(--button-radius) px-(--button-padding-x-lg) type-button" },
    },
    fullWidth: {
      true: { root: "w-full" },
    },
    /** Hover and press feedback, only while the button can be used. */
    interactive: {
      true: { root: "motion-safe:active:scale-98" },
      false: {},
    },
    /** Loading or succeeded: the label fades out under the spinner or the check. */
    busy: {
      true: { content: "opacity-0" },
    },
    disabled: {
      true: { root: "opacity-50" },
    },
  },
  compoundVariants: [
    { variant: "solid", tone: "primary", class: { root: "bg-primary text-fg-on-primary" } },
    { variant: "solid", tone: "energy", class: { root: "bg-energy text-fg-on-energy" } },
    { variant: "solid", tone: "danger", class: { root: "bg-danger-strong text-fg-on-danger" } },
    {
      variant: "solid",
      tone: "primary",
      interactive: true,
      class: {
        sheen: "group-hover/button:opacity-0",
        sheenHover: "group-hover/button:opacity-100",
        glow: "group-hover/button:opacity-32",
      },
    },
    { variant: "solid", tone: ["energy", "danger"], interactive: true, class: { root: "hover:brightness-95" } },
    { variant: ["outline", "text"], interactive: true, class: { root: "hover:bg-primary/8" } },
    // The team dialog's Delete (Figma 2110:245745): white with a gray 200 edge and red text, in red
    // 700 because Figma's red 500 reads 3.8:1 on white.
    { variant: "outline", tone: "danger", class: { root: "border-line text-fg-danger" } },
    { variant: "outline", tone: "danger", interactive: true, class: { root: "hover:bg-danger/8" } },
    // Measured: 40 px, 6 px corners, 12 px at the sides, a Regular 16/24 label (Figma list toolbar);
    // solid lavender while the menu it opens is open. A tooltip also marks its anchor data-popup-open,
    // but only a popup the button expands sets aria-expanded.
    { variant: "secondary", class: { root: "rounded-md px-3 type-body-lg aria-expanded:data-popup-open:bg-surface-expanded" } },
    { variant: "secondary", interactive: true, class: { root: "hover:bg-surface-panel" } },
    // Measured: 8 px corners, the edge black 12% over the fill (#d23c3c on red 500).
    { variant: "flat", class: { root: "rounded-lg" } },
    { variant: "flat", tone: "primary", class: { root: "bg-primary text-fg-on-primary" } },
    { variant: "flat", tone: "energy", class: { root: "bg-energy text-fg-on-energy" } },
    { variant: "flat", tone: "danger", class: { root: "bg-danger text-fg-on-danger" } },
    { variant: "flat", interactive: true, class: { root: "hover:brightness-95" } },
  ],
  defaultVariants: {
    variant: "solid",
    tone: "primary",
    interactive: true,
  },
});

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
export type ButtonTone = NonNullable<VariantProps<typeof buttonVariants>["tone"]>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

/** The Figma size of each kind of button: btnPublish 40, Preline outline 46, text buttons 38. */
export const defaultButtonSize: Record<ButtonVariant, ButtonSize> = {
  solid: "md",
  outline: "lg",
  text: "sm",
  secondary: "md",
  flat: "md",
};
