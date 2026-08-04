import { Command as CommandPrimitive } from "cmdk";
import { Moon, Search } from "lucide-react";
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/components/theme-provider";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { Kbd } from "@/components/ui/primitives";
import { ALL_NAV } from "@/lib/nav";

/** O15 CommandPalette — pages + actions, fuzzy-scored by cmdk. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { cycle } = useTheme();

  const run = React.useCallback(
    (fn: () => void) => {
      onOpenChange(false);
      // Let the dialog close before navigating so focus restoration behaves.
      requestAnimationFrame(fn);
    },
    [onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        width="max-w-[560px]"
        className="top-[12vh] translate-y-0 p-0"
        aria-label="Command palette"
      >
        <CommandPrimitive
          loop
          className="[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-muted-foreground"
        >
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <CommandPrimitive.Input
              autoFocus
              placeholder="Search pages and actions…"
              className="h-14 flex-1 bg-transparent text-[16px] text-foreground outline-none placeholder:text-muted-foreground/70"
            />
            <Kbd>Esc</Kbd>
          </div>

          <CommandPrimitive.List className="max-h-[52vh] overflow-y-auto p-2">
            <CommandPrimitive.Empty className="py-10 text-center text-[13px] text-muted-foreground">
              Nothing matches that search.
            </CommandPrimitive.Empty>

            <CommandPrimitive.Group heading="Pages">
              {ALL_NAV.map((entry) => {
                const Icon = entry.icon;
                return (
                  <CommandPrimitive.Item
                    key={entry.to}
                    value={`${entry.label} ${entry.to}`}
                    onSelect={() => run(() => navigate(entry.to))}
                    className="flex h-10 cursor-pointer items-center gap-3 rounded-sm px-3 text-[13.5px] font-medium text-body transition-colors data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                  >
                    <Icon className="size-4 shrink-0" />
                    {entry.label}
                  </CommandPrimitive.Item>
                );
              })}
            </CommandPrimitive.Group>

            <CommandPrimitive.Group heading="Actions">
              <CommandPrimitive.Item
                value="toggle theme dark light"
                onSelect={() => run(cycle)}
                className="flex h-10 cursor-pointer items-center gap-3 rounded-sm px-3 text-[13.5px] font-medium text-body transition-colors data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
              >
                <Moon className="size-4 shrink-0" />
                Toggle theme
              </CommandPrimitive.Item>
            </CommandPrimitive.Group>
          </CommandPrimitive.List>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  );
}
