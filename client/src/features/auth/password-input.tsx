import { Eye, EyeOff } from "lucide-react";
import * as React from "react";
import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Password field with a reveal toggle and a Caps Lock warning.
 *
 * Caps Lock is worth the code: it is the single most common cause of a
 * "correct" password being rejected, and the server deliberately cannot tell
 * the user which half of the credential was wrong.
 */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<InputProps, "type"> & { capsHint?: boolean }
>(({ className, capsHint = true, onKeyDown, onKeyUp, onBlur, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);
  const [caps, setCaps] = React.useState(false);

  // getModifierState is only meaningful on a real key event, so read it on both
  // down and up — otherwise toggling Caps Lock without typing goes unnoticed.
  const readCaps = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!capsHint) return;
    setCaps(e.getModifierState?.("CapsLock") ?? false);
  };

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-10", className)}
          onKeyDown={(e) => {
            readCaps(e);
            onKeyDown?.(e);
          }}
          onKeyUp={(e) => {
            readCaps(e);
            onKeyUp?.(e);
          }}
          onBlur={(e) => {
            setCaps(false);
            onBlur?.(e);
          }}
          {...props}
        />
        <button
          type="button"
          // Not focusable: it holds no information a screen-reader user needs,
          // and it would otherwise sit between the password field and Sign in.
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => setVisible((v) => !v)}
          title={visible ? "Hide password" : "Show password"}
          className={cn(
            "absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md",
            "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            "focus-visible:ring-2 focus-visible:ring-ring outline-none"
          )}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>

      {caps && (
        <p className="flex items-center gap-1.5 text-[12px] leading-4 text-warning">
          <span aria-hidden className="inline-block size-1.5 rounded-full bg-warning" />
          Caps Lock is on
        </p>
      )}
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";
