/**
 * MainPage — the simulation's top-level page ids.
 *
 * The MainNav COMPONENT that used to live here is retired: the page switch is
 * the docked tab row rendered by SimulationScreen (`PageTabs`).
 *
 * `finance` was added 2026-10-05. It holds `BottomStats` — the User Projection
 * and Actual Results sheets — which used to hang below EVERY page in the
 * scroll, so each page carried paperwork that had nothing to do with it.
 */
export type MainPage = 'product' | 'business' | 'finance' | 'results';
