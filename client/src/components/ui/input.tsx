import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/** A9 Input — leading icon slot, optional clear affordance, error state. */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  error?: boolean;
  inputSize?: "sm" | "md";
  onClear?: () => void;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, error, inputSize = "md", onClear, value, ...props }, ref) => {
    const showClear = onClear && value != null && String(value).length > 0;
    return (
      <div className="relative w-full">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-4">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          value={value}
          aria-invalid={error || undefined}
          className={cn(
            "w-full rounded-md border bg-card font-sans text-foreground transition-colors duration-150",
            "placeholder:text-muted-foreground/70",
            "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-45 disabled:bg-muted",
            inputSize === "sm" ? "h-9 text-[13px]" : "h-10 text-[14px]",
            icon ? "pl-9" : "pl-3",
            showClear ? "pr-9" : "pr-3",
            error ? "border-destructive" : "border-border",
            className
          )}
          {...props}
        />
        {showClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear"
            className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }
>(({ className, error, ...props }, ref) => (
  <textarea
    ref={ref}
    aria-invalid={error || undefined}
    className={cn(
      "min-h-24 w-full resize-y rounded-md border bg-card px-3 py-2 font-sans text-[14px] text-foreground transition-colors",
      "placeholder:text-muted-foreground/70",
      "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
      "disabled:cursor-not-allowed disabled:opacity-45 disabled:bg-muted",
      error ? "border-destructive" : "border-border",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
