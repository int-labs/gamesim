import { cnMerge, type CnOptions } from "tailwind-variants";
import { twMergeConfig } from "./generated/merge-config";

/**
 * Joins class names (strings, arrays, `{ class: condition }` objects) and resolves conflicts
 * between them: when two classes set the same thing, the later one wins, so
 * `cn("shadow-sm", "shadow-card")` gives `"shadow-card"`.
 */
export function cn(...classes: CnOptions): string {
  return cnMerge(...classes)({ twMergeConfig }) ?? "";
}
