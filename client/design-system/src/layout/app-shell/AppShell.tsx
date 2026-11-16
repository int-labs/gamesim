import { Drawer } from "@base-ui/react/drawer";
import { Menu } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { IconButton } from "../../primitives/icon-button/IconButton";
import { tokens } from "../../tokens";
import { SidebarMenuContext } from "../sidebar/SidebarContext";

export interface AppShellProps {
  /** The Sidebar. From 1280 px it sits at the left; below, it opens from the menu button. */
  sidebar: ReactNode;
  /** The brand in the top bar on smaller screens (a Wordmark). */
  mobileBrand?: ReactNode;
  /** At the right of the top bar on smaller screens: the player's energy and Submit. */
  mobileActions?: ReactNode;
  /** A bar above the page on every screen size (the player's KPI bar). */
  topBar?: ReactNode;
  /** The page fills the main area edge to edge, without the page padding: an embedded app frame. */
  fullBleed?: boolean;
  /** Label of the menu button on smaller screens. Default "Open menu". */
  menuLabel?: string;
  /** Name of the menu drawer for assistive technology. Default "Menu". */
  menuTitle?: string;
  /** The link that lets keyboard users jump past the sidebar. Default "Skip to content". */
  skipLabel?: string;
  children: ReactNode;
}

/**
 * The frame of every Admin and player screen: the sidebar, then the page on the slate background
 * with the Figma 16 px margin. Below 1280 px (Figma draws its 1024 px tablet this way) a top bar
 * takes the sidebar's place: the menu button, the brand (centred from 640 px), the page's actions;
 * the sidebar then opens as a drawer over the page.
 *
 * Its own parts (the sidebar, the top bar, the bar above the page, the skip link) are design-system
 * surfaces ([data-ds-root]) wherever it is used; the page keeps whatever its own root gives it. An
 * app still on MUI can so frame its screens with it before their content moves, and nothing of the
 * content changes. Its height is --app-shell-height, the window's.
 */
export function AppShell({
  sidebar,
  mobileBrand,
  mobileActions,
  topBar,
  fullBleed = false,
  menuLabel = "Open menu",
  menuTitle = "Menu",
  skipLabel = "Skip to content",
  children,
}: AppShellProps) {
  const mainId = useId();
  const mainRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // The drawer belongs to smaller screens: widening the window to the sidebar's width closes it.
  useEffect(() => {
    if (!menuOpen || typeof window.matchMedia !== "function") return;
    const wide = window.matchMedia(`(min-width: ${tokens.breakpoint.xl})`);
    const closeWhenWide = () => {
      if (wide.matches) setMenuOpen(false);
    };
    closeWhenWide();
    wide.addEventListener("change", closeWhenWide);
    return () => wide.removeEventListener("change", closeWhenWide);
  }, [menuOpen]);

  return (
    <div className="flex min-h-(--app-shell-height) bg-surface-page">
      {/* Moves focus without adding a #hash to the router's URL. */}
      <a
        data-ds-root=""
        href={`#${mainId}`}
        onClick={(event) => {
          event.preventDefault();
          mainRef.current?.focus();
        }}
        className={cn(
          "rounded-lg bg-surface-card px-4 py-2 type-button text-fg-link shadow-lg not-focus-visible:sr-only",
          "focus-visible:fixed focus-visible:inset-s-4 focus-visible:top-4 focus-visible:z-popover",
          "outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus-ring",
        )}
      >
        {skipLabel}
      </a>
      <div data-ds-root="" className="sticky top-0 hidden h-(--app-shell-height) xl:flex">
        {sidebar}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Figma tablet and phone frames: 64 px, white, the controls 40 px tall. */}
        <header
          data-ds-root=""
          className="sticky top-0 z-header flex h-16 items-center gap-4 border-b border-line bg-surface-card px-4 xl:hidden"
        >
          <div className="flex sm:flex-1">
            <Drawer.Root open={menuOpen} onOpenChange={setMenuOpen} swipeDirection="left">
              <Drawer.Trigger render={<IconButton icon={Menu} label={menuLabel} variant="outline" size="lg" iconSize="sm" stroke="thin" />} />
              <Drawer.Portal data-ds-root="">
                <Drawer.Backdrop className="fixed inset-0 z-drawer scrim bg-surface-overlay backdrop-blur-overlay motion-reduce:transition-none" />
                <Drawer.Viewport className="fixed inset-0 z-drawer flex">
                  <Drawer.Popup className="flex h-(--app-shell-height) w-full sheet-left outline-none motion-reduce:transition-none sm:w-4/5">
                    <Drawer.Title className="sr-only">{menuTitle}</Drawer.Title>
                    <SidebarMenuContext.Provider value={closeMenu}>{sidebar}</SidebarMenuContext.Provider>
                  </Drawer.Popup>
                </Drawer.Viewport>
              </Drawer.Portal>
            </Drawer.Root>
          </div>
          {/* The brand shows whole or not at all: where it is too wide (beside the player's energy and Submit
              on a phone under about 400 px) it wraps onto a second line, under the empty ::before, and this
              one-line box clips it. The menu still shows it. */}
          <div className="flex min-w-0 flex-1 flex-wrap items-center self-stretch overflow-hidden before:h-full sm:flex-initial">
            {mobileBrand}
          </div>
          <div className="flex items-center justify-end gap-2 sm:flex-1">{mobileActions}</div>
        </header>
        {/* No box of its own, so a sticky bar sticks to the page, not to this wrapper. */}
        {topBar ? (
          <div data-ds-root="" className="contents">
            {topBar}
          </div>
        ) : null}
        <main
          ref={mainRef}
          id={mainId}
          tabIndex={-1}
          className={cn("flex min-w-0 flex-1 flex-col outline-none", fullBleed ? undefined : "gap-(--page-gap) p-(--page-padding)")}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
