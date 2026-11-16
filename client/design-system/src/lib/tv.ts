import { createTV } from "tailwind-variants";
import { twMergeConfig } from "./generated/merge-config";

/**
 * Variant recipes for components (slots, variants, compound variants), with class conflicts
 * resolved against the token names. See https://www.tailwind-variants.org.
 */
export const tv = createTV({ twMergeConfig });

export type { VariantProps } from "tailwind-variants";
