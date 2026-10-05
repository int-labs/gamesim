/**
 * MainPage — the simulation's top-level section ids.
 *
 * The MainNav COMPONENT that used to live here is retired: the switch is the
 * docked tab row rendered by SimulationScreen (`PageTabs`).
 *
 * These SIX replaced product/business/finance/results on 2026-10-05. The old
 * four were containers that each held a stack of unrelated panels behind their
 * own sub-tabs — two levels of tabs to reach one decision. These are the
 * decisions themselves, one level deep, and each fills the left rail while the
 * notebook stays on screen beside it.
 */
export type MainPage =
  | 'market'
  | 'financial'
  | 'notebook'
  | 'inventory'
  | 'capacity'
  | 'sales';
