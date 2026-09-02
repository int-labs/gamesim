// Key scenarios (P5). Major external events that fire before a phase runs and
// force an A/B/C/D decision. Counts: P1:1, P2:2, P3:2 (DEC E). Each response
// spends ENERGY and applies a multiplier to demand and/or sell-rate for the
// coming phase — mostly around the two levers the PDF names: production amount
// and pricing. There is no universally right answer, only the right one for
// your current state.

export interface ScenarioOption {
  id: 'A' | 'B' | 'C' | 'D';
  label: string;
  detail: string;
  energy: number;
  /** Multipliers folded into the phase's demand / sell decisions (default 1). */
  demandMult?: number;
  sellMult?: number;
  /** Immediate one-off cash effect ($, can be negative). */
  cashNow?: number;
}

export interface FinlitScenario {
  id: string;
  phase: 1 | 2 | 3;
  title: string;
  body: string;
  options: ScenarioOption[];
}

export const SCENARIOS: FinlitScenario[] = [
  // ── Phase 1 (×1) ─────────────────────────────────────────────────────────
  {
    id: 'campus_buzz',
    phase: 1,
    title: 'Campus Buzz',
    body: 'A dorm blog just featured your notebooks. Attention is spiking - how hard do you chase it?',
    options: [
      { id: 'A', label: 'Lean in hard', detail: 'Push marketing on the moment. Big demand bump, heavy energy.', energy: 8, demandMult: 1.35 },
      { id: 'B', label: 'Ride it gently', detail: 'A modest nudge - some lift, little cost.', energy: 3, demandMult: 1.12 },
      { id: 'C', label: 'Raise the price', detail: 'Cash in on the hype; demand cools a little.', energy: 3, sellMult: 0.92, cashNow: 120 },
      { id: 'D', label: 'Stay the course', detail: 'Keep your plan. No lift, no cost.', energy: 0 },
    ],
  },
  // ── Phase 2 (×2) ─────────────────────────────────────────────────────────
  {
    id: 'supplier_squeeze',
    phase: 2,
    title: 'Supplier Squeeze',
    body: 'Paper prices jumped overnight. Your margin is under pressure this phase.',
    options: [
      { id: 'A', label: 'Absorb it', detail: 'Eat the cost to hold demand. Small cash hit now.', energy: 4, cashNow: -150 },
      { id: 'B', label: 'Pass to buyers', detail: 'Nudge prices up. Margin holds, demand dips.', energy: 3, demandMult: 0.88 },
      { id: 'C', label: 'Find a new supplier', detail: 'Spend energy to secure cheaper stock. Slight lift.', energy: 7, sellMult: 1.05 },
      { id: 'D', label: 'Cut corners', detail: 'Cheaper materials - buyers notice. Demand falls.', energy: 2, demandMult: 0.8 },
    ],
  },
  {
    id: 'flash_sale',
    phase: 2,
    title: 'Flash Sale',
    body: 'The platform is running a store-wide discount weekend. Do you join the frenzy?',
    options: [
      { id: 'A', label: 'Go all in', detail: 'Deep discount, huge volume - thin margins.', energy: 6, demandMult: 1.45, sellMult: 1.1, cashNow: -80 },
      { id: 'B', label: 'Sit it out', detail: 'Protect your margin; miss the wave.', energy: 0 },
      { id: 'C', label: 'Selective deal', detail: 'A measured markdown. Balanced lift.', energy: 3, demandMult: 1.18 },
      { id: 'D', label: 'Raise price after', detail: 'Skip the sale, ride the post-sale attention.', energy: 4, sellMult: 1.06, cashNow: 100 },
    ],
  },
  // ── Phase 3 (×2) ─────────────────────────────────────────────────────────
  {
    id: 'viral_moment',
    phase: 3,
    title: 'Viral Moment',
    body: 'A post about your shop is blowing up. This is the biggest spotlight yet.',
    options: [
      { id: 'A', label: 'Scale production', detail: 'Throw energy at output to meet the surge.', energy: 9, demandMult: 1.4 },
      { id: 'B', label: 'Cash in on price', detail: 'Charge the premium the hype allows.', energy: 4, sellMult: 0.95, cashNow: 220 },
      { id: 'C', label: 'Balanced push', detail: 'A bit of both - steady, sustainable lift.', energy: 6, demandMult: 1.2 },
      { id: 'D', label: 'Stay humble', detail: 'Protect quality and cash. No change.', energy: 0 },
    ],
  },
  {
    id: 'market_shift',
    phase: 3,
    title: 'Market Shift',
    body: 'Buyer tastes are moving between genres as the season turns. Your niche is wobbling.',
    options: [
      { id: 'A', label: 'Diversify', detail: 'Spread demand across tastes. Resilient, costly.', energy: 7, demandMult: 1.15 },
      { id: 'B', label: 'Double down', detail: 'Bet on your genre. Big if right, exposed if wrong.', energy: 4, demandMult: 1.25, sellMult: 0.9 },
      { id: 'C', label: 'Hold steady', detail: 'Weather it without a big move.', energy: 2 },
      { id: 'D', label: 'Discount to hold share', detail: 'Trade margin to keep buyers.', energy: 3, sellMult: 1.08, cashNow: -120 },
    ],
  },
];

export const scenariosForPhase = (phase: number): FinlitScenario[] =>
  SCENARIOS.filter((s) => s.phase === phase);

export const scenarioById = (id: string): FinlitScenario | undefined =>
  SCENARIOS.find((s) => s.id === id);
