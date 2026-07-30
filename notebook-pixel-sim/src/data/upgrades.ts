import type { UpgradeDef } from '@/types';

// User-facing names + descriptions are the rewritten copy from
// src/content/upgradeCopy.ts — kept inline here so existing engine
// imports (which read .name and .description directly) stay
// unchanged.

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'hire_helper',
    name: 'Hire Part-Time Helper',
    category: 'hire',
    description:
      '+4 daily production capacity. Pays a $12/day wage. Buy when stock keeps hitting zero.',
    costs: { time: 1, energy: 4, cash: 80 },
    unlockDay: 10,
    effects: ['Capacity +4/day', 'Daily wage −$12', 'Defect rate slight ↓'],
  },
  {
    id: 'hire_second',
    name: 'Hire Second Helper',
    category: 'hire',
    description:
      'A second hire stacks on the first. +5 capacity, $14/day wage. Consider after Phase 2.',
    costs: { time: 1, energy: 4, cash: 100 },
    unlockDay: 35,
    requires: ['hire_helper'],
    effects: ['Capacity +5/day', 'Daily wage −$14'],
  },
  {
    id: 'tool_basic',
    name: 'Bench Press Tool',
    category: 'tool',
    description:
      'A small bindery rig. +6 capacity, −2% defect rate. Pays for itself if you sell ~20 units.',
    costs: { time: 1, energy: 5, cash: 220 },
    unlockDay: 18,
    effects: ['Capacity +6/day', 'Defect rate −2%'],
  },
  {
    id: 'tool_pro',
    name: 'Production Press',
    category: 'tool',
    description:
      'Industrial press. +12 capacity, −4% defects. Best for high-volume late-game runs.',
    costs: { time: 1, energy: 6, cash: 480 },
    unlockDay: 40,
    requires: ['tool_basic'],
    effects: ['Capacity +12/day', 'Defect rate −4%'],
  },
  {
    id: 'process_qa',
    name: 'Quality Check Process',
    category: 'process',
    description:
      'Adds a QA pass before sale. −5% defects, slight retention lift. Cheap risk reducer.',
    costs: { time: 1, energy: 5, cash: 150 },
    unlockDay: 22,
    effects: ['Defect rate −5%', 'Retention slight ↑'],
  },
  {
    id: 'supplier_premium',
    name: 'Premium Supplier',
    category: 'supplier',
    description:
      'Higher-quality paper. Material cost +12%, lead time +1 day, but lifts perceived quality.',
    costs: { time: 1, energy: 6, cash: 250 },
    unlockDay: 30,
    effects: ['Paper quality lift', 'Material cost +12%', 'Lead time +1d'],
  },
  {
    id: 'supplier_bulk',
    name: 'Bulk Supplier Deal',
    category: 'supplier',
    description:
      'Bigger orders, smaller per-unit cost. −10% material cost. Min order size +20 units.',
    costs: { time: 1, energy: 5, cash: 200 },
    unlockDay: 45,
    requires: ['supplier_premium'],
    effects: ['Material cost −10%', 'Min order +20 units'],
  },
  {
    id: 'finance_loan',
    name: 'Short-term Loan',
    category: 'finance',
    description:
      '+$500 cash today. Repay $560 by Day 90. Useful only if it unlocks a moneymaker now.',
    costs: { time: 0, energy: 4, cash: -500 },
    unlockDay: 60,
    effects: ['Cash +$500 now', 'Repay $560 by Day 90'],
  },
  {
    id: 'marketing_campaign',
    name: 'Marketing Campaign',
    category: 'marketing',
    description:
      '14-day demand boost (+20%). Wasted unless you have stock and segment fit ready.',
    costs: { time: 1, energy: 3, cash: 60 },
    unlockDay: 8,
    effects: ['Demand +20% (14d)', 'Brand +'],
  },
  {
    id: 'marketing_loyalty',
    name: 'Loyalty Program',
    category: 'marketing',
    description:
      '+10% retention, −$2/day on marketing. Best after a strong launch.',
    costs: { time: 1, energy: 3, cash: 50 },
    unlockDay: 35,
    requires: ['marketing_campaign'],
    effects: ['Retention +10%', 'Daily cost −$2'],
  },
];

export const upgradeById = (id: string) => UPGRADES.find((u) => u.id === id);
