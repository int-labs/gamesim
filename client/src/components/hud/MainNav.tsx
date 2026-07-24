/**
 * MainPage — the simulation's top-level page ids.
 *
 * The MainNav COMPONENT that used to live here is retired: the page switch is
 * now the floating Product/Business pill rendered by SimulationScreen
 * (`FloatingPageTabs`), and the Results page is hidden — phase debriefs fire
 * inline via PhaseSequenceModal instead.
 */
export type MainPage = 'product' | 'business' | 'results';
