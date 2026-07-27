import type { InsightCheck } from '@/types';

export const INSIGHTS: InsightCheck[] = [
  {
    id: 'phase1_demand_driver',
    phase: 1,
    question: 'In Phase 1, what drove your demand the most?',
    options: [
      { id: 'A', text: 'Picking a clear target segment', correct: true },
      { id: 'B', text: 'Buying lots of raw materials', correct: false },
      { id: 'C', text: 'Setting a very high price', correct: false },
      { id: 'D', text: 'Adding many decorative items', correct: false },
    ],
  },
  {
    id: 'phase2_cash_dip',
    phase: 2,
    question: 'Why did your cash dip mid-Phase 2 even though revenue grew?',
    options: [
      { id: 'A', text: 'Customer payments arrived late', correct: true },
      { id: 'B', text: 'Energy was low', correct: false },
      { id: 'C', text: 'Mascot was sad', correct: false },
      { id: 'D', text: 'You changed segment', correct: false },
    ],
  },
  {
    id: 'phase3_pl_diagnosis',
    phase: 3,
    question: 'Your gross profit is flat despite higher revenue. The most likely cause is:',
    options: [
      { id: 'A', text: 'Material cost climbed with each sale', correct: true },
      { id: 'B', text: 'You ran out of energy', correct: false },
      { id: 'C', text: 'You used too few add-ons', correct: false },
      { id: 'D', text: 'Demand dropped sharply', correct: false },
    ],
  },
  {
    id: 'final_growth_driver',
    phase: 3,
    question: 'Across the 90 days, the strongest growth driver was:',
    options: [
      { id: 'A', text: 'Segment fit and channel match', correct: true },
      { id: 'B', text: 'Maximum stock at all times', correct: false },
      { id: 'C', text: 'Lowest price possible', correct: false },
      { id: 'D', text: 'Most add-ons stacked', correct: false },
    ],
  },
];
