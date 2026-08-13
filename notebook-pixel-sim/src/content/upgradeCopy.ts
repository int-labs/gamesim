// Improved upgrade names + descriptions. Each entry explains:
//   - what the upgrade does (mechanic)
//   - what it costs (cash + energy)
//   - what it unlocks (if any prereq)
//   - which game variable it affects
//
// Used as overrides on top of `src/data/upgrades.ts` so the data
// shape stays the same but the player-facing copy is clearer.

export interface UpgradeCopy {
  /** Short clear name. */
  name: string;
  /** One-sentence "what it does + when to buy" pitch. */
  description: string;
  /** Locked-state hint shown when prereqs aren't met. */
  lockedHint?: string;
}

export const UPGRADE_COPY: Record<string, UpgradeCopy> = {
  hire_helper: {
    name: 'Hire Part-Time Helper',
    description:
      '+4 production capacity. Pays a $360 wage per phase. Buy when stock keeps hitting zero.',
  },
  hire_second: {
    name: 'Hire Second Helper',
    description:
      'A second hire stacks on the first. +5 capacity, $420 wage per phase. Consider after Phase 2.',
    lockedHint: 'Requires: Hire Part-Time Helper first.',
  },
  tool_basic: {
    name: 'Bench Press Tool',
    description:
      'A small bindery rig. +6 capacity, −2% defect rate. Pays for itself if you sell ~20 units.',
  },
  tool_pro: {
    name: 'Production Press',
    description:
      'Industrial press. +12 capacity, −4% defects. Best for high-volume late-game runs.',
    lockedHint: 'Requires: Bench Press Tool first.',
  },
  process_qa: {
    name: 'Quality Check Process',
    description:
      'Adds a QA pass before sale. −5% defects, slight retention lift. Cheap risk reducer.',
  },
  supplier_premium: {
    name: 'Premium Supplier',
    description:
      'Higher-quality paper. Material cost +12%, lead time +1 day, but lifts perceived quality.',
  },
  supplier_bulk: {
    name: 'Bulk Supplier Deal',
    description:
      'Bigger orders, smaller per-unit cost. −10% material cost. Min order size +20 units.',
    lockedHint: 'Requires: Premium Supplier first.',
  },
  finance_loan: {
    name: 'Short-term Loan',
    description:
      '+$500 cash today. Repay $560 by Day 90. Useful only if it unlocks a moneymaker now.',
  },
  marketing_campaign: {
    name: 'Marketing Campaign',
    description:
      '14-day demand boost (+20%). Wasted unless you have stock and segment fit ready.',
  },
  marketing_loyalty: {
    name: 'Loyalty Program',
    description:
      '+10% retention, -$60 per phase on marketing. Best after a strong launch.',
    lockedHint: 'Requires: Marketing Campaign first.',
  },
};
