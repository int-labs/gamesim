import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/query-client";

/** Composition order matters — see spec §12.4. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {/* One line makes every Motion animation honour OS reduced-motion. */}
        <MotionConfig reducedMotion="user">
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster
              position="bottom-right"
              toastOptions={{
                classNames: {
                  toast:
                    "!rounded-md !border-border !bg-card !text-foreground !shadow-pop !font-sans",
                  description: "!text-muted-foreground",
                },
              }}
            />
          </TooltipProvider>
        </MotionConfig>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
