import * as AvatarPrimitive from "@radix-ui/react-avatar";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as LabelPrimitive from "@radix-ui/react-label";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { Minus } from "lucide-react";
import * as React from "react";
import { cn, hashIndex, initials as toInitials } from "@/lib/utils";

/* ------------------------------------------------------------------ A21 misc */

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "font-sans text-[13px] font-semibold text-foreground peer-disabled:opacity-45",
      className
    )}
    {...props}
  />
));
Label.displayName = "Label";

export const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      "shrink-0 bg-border",
      orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
      className
    )}
    {...props}
  />
));
Separator.displayName = "Separator";

export function Eyebrow({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("eyebrow text-muted-foreground", className)} {...props} />;
}

/** A8 Kbd */
export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-border bg-muted px-1.5",
        "font-mono text-[11px] font-medium text-muted-foreground shadow-[inset_0_-1px_0_var(--color-border)]",
        className
      )}
      {...props}
    />
  );
}

/* --------------------------------------------------------------- A11 Checkbox */

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & { indeterminate?: boolean }
>(({ className, indeterminate, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer size-[18px] shrink-0 rounded-[5px] border-[1.5px] border-border bg-card transition-colors duration-150 outline-none",
      "hover:border-primary/60",
      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "data-[state=checked]:border-primary data-[state=checked]:bg-primary",
      "data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary",
      "disabled:opacity-45 disabled:pointer-events-none",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-primary-foreground">
      {indeterminate ? (
        <Minus className="size-3" strokeWidth={3} />
      ) : (
        /* Path-draw check (spec §4.3 #21) */
        <svg viewBox="0 0 14 14" className="size-3.5" fill="none" aria-hidden>
          <path
            d="M2.5 7.5L5.5 10.5L11.5 3.5"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 16,
              strokeDashoffset: 0,
              animation: "checkdraw 200ms cubic-bezier(0.16,1,0.3,1)",
            }}
          />
        </svg>
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = "Checkbox";

/* ----------------------------------------------------------------- A13 Switch */

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-[22px] w-10 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 outline-none",
      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "data-[state=checked]:bg-primary data-[state=unchecked]:bg-neutral-tint",
      "disabled:cursor-not-allowed disabled:opacity-45",
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block size-[18px] rounded-full bg-card shadow-sm ring-0",
        "transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";

/* ----------------------------------------------------------------- A5 Avatar */

const AVATAR_TONES = [
  "bg-pink-100 text-pink-700",
  "bg-navy-100 text-navy-700",
  "bg-peri-100 text-peri-600",
  "bg-yellow-100 text-yellow-700",
  "bg-success-tint text-success",
  "bg-info-tint text-info",
];

const AVATAR_SIZES = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-8 text-[11px]",
  lg: "size-9 text-[12px]",
  xl: "size-10 text-[13px]",
  "2xl": "size-14 text-[18px]",
} as const;

export function Avatar({
  name,
  src,
  size = "md",
  className,
  ring = false,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
  ring?: boolean;
}) {
  const tone = AVATAR_TONES[hashIndex(name || "?", AVATAR_TONES.length)];
  return (
    <AvatarPrimitive.Root
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold",
        AVATAR_SIZES[size],
        tone,
        ring && "ring-2 ring-card",
        className
      )}
    >
      {src && <AvatarPrimitive.Image src={src} alt={name} className="size-full object-cover" />}
      <AvatarPrimitive.Fallback className="flex size-full items-center justify-center">
        {toInitials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

/** A6 AvatarGroup */
export function AvatarGroup({
  names,
  max = 3,
  size = "sm",
}: {
  names: string[];
  max?: number;
  size?: keyof typeof AVATAR_SIZES;
}) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((n) => (
        <Avatar key={n} name={n} size={size} ring />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground ring-2 ring-card",
            AVATAR_SIZES[size]
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- A17/A18 misc */

/** A17 StatusDot — `live` adds the halo ping used by active rounds. */
export function StatusDot({
  tone = "neutral",
  live = false,
  className,
}: {
  tone?: "success" | "warning" | "danger" | "info" | "neutral" | "brand";
  live?: boolean;
  className?: string;
}) {
  const color = {
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-destructive",
    info: "bg-info",
    neutral: "bg-neutral",
    brand: "bg-primary",
  }[tone];

  return (
    <span className={cn("relative inline-flex size-2 shrink-0", className)}>
      <span className={cn("relative inline-flex size-2 rounded-full", color)} />
      {live && (
        <span
          className={cn("absolute inset-0 rounded-full motion-reduce:hidden", color)}
          style={{ animation: "pulse-ring 2s cubic-bezier(0,0,0.2,1) infinite" }}
          aria-hidden
        />
      )}
    </span>
  );
}

/** A18 Skeleton */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-sm bg-muted", className)}
      aria-hidden
      {...props}
    >
      <div
        className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent motion-reduce:hidden"
      />
    </div>
  );
}

/** A21 Spinner */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("size-4 animate-spin text-current", className)} viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"
      />
    </svg>
  );
}
