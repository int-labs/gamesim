import { createContext, useContext } from "react";

export interface SidebarState {
  /** The 74 px icon rail instead of the full 268 px sidebar. */
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  /** Set when the sidebar is the mobile menu inside a drawer: it never collapses, and choosing an item closes it. */
  closeMenu?: () => void;
  /**
   * Names may take a second line: the sidebar is full width and has finished widening. While the
   * width moves they keep to one line, so the rows don't change height mid-animation.
   */
  labelsWrap: boolean;
}

export const SidebarContext = createContext<SidebarState>({ collapsed: false, setCollapsed: () => {}, labelsWrap: true });

export function useSidebar(): SidebarState {
  return useContext(SidebarContext);
}

/** Lets AppShell render the same sidebar inside the mobile menu. */
export const SidebarMenuContext = createContext<(() => void) | undefined>(undefined);
