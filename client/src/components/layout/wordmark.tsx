import { cn } from "@/lib/utils";

/**
 * The Int Labs wordmark: `int labs.` — lowercase, single space, terminating
 * period, Poppins Bold (brand guidelines §3.1). The period is part of the logo
 * and is never dropped.
 *
 * Rendered as TEXT rather than the shipped PNG:
 *  - stays crisp at every size (the asset is 8245px wide)
 *  - recolours per surface without shipping four files
 *  - the brand guide explicitly sanctions setting it as Poppins Bold text
 *    for stationery/dark surfaces (§3.4)
 *
 * Variants follow the surface table in §3.4:
 *   light surface → official gradient (#E14673 → #7651B3)
 *   navy surface  → yellow (the stationery treatment) or white
 */
export function Wordmark({
  variant = "gradient",
  className,
}: {
  variant?: "gradient" | "white" | "yellow" | "ink";
  className?: string;
}) {
  const tone = {
    gradient: "wordmark-gradient",
    white: "text-white",
    yellow: "text-yellow-500",
    ink: "text-foreground",
  }[variant];

  return (
    <span
      className={cn(
        "select-none font-display text-[19px] font-bold leading-none tracking-[-0.02em]",
        tone,
        className
      )}
    >
      int labs<span className={variant === "gradient" ? "" : "text-pink-500"}>.</span>
    </span>
  );
}

/** Square mark for collapsed rails and favicons — stacked `int` / `labs.` */
export function WordmarkMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 flex-col items-center justify-center rounded-md bg-navy-700 leading-[0.9] text-white",
        className
      )}
      aria-hidden
    >
      <span className="font-display text-[10px] font-bold">int</span>
      <span className="font-display text-[10px] font-bold">
        labs<span className="text-yellow-500">.</span>
      </span>
    </span>
  );
}
