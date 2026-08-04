import * as React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { CommandPalette } from "@/components/layout/command-palette";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { useHotkey } from "@/hooks/use-hotkey";

const SIDEBAR_KEY = "il-sidebar-collapsed";

export function AppShell() {
  const [collapsed, setCollapsed] = React.useState(
    () => localStorage.getItem(SIDEBAR_KEY) === "1"
  );
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const location = useLocation();
  const mainRef = React.useRef<HTMLElement>(null);

  const toggle = React.useCallback(() => {
    setCollapsed((c) => {
      localStorage.setItem(SIDEBAR_KEY, c ? "0" : "1");
      return !c;
    });
  }, []);

  useHotkey("k", () => setPaletteOpen((o) => !o), { meta: true, allowInInput: true });
  useHotkey("t", () => {
    const btn = document.querySelector<HTMLButtonElement>('[aria-label^="Theme:"]');
    btn?.click();
  });

  // Route change moves focus to the page heading (spec §15).
  React.useEffect(() => {
    const h1 = mainRef.current?.querySelector<HTMLElement>("h1");
    h1?.focus();
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <div className="sticky top-0 hidden h-dvh lg:block">
        <Sidebar
          collapsed={collapsed}
          onToggle={toggle}
          onOpenPalette={() => setPaletteOpen(true)}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenPalette={() => setPaletteOpen(true)} />
        <main id="main" ref={mainRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1440px] px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
