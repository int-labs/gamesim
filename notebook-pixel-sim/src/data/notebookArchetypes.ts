import type { Archetype, Segment } from '@/types';

export interface ArchetypeInfo {
  id: Archetype;
  title: string;
  tagline: string;
  description: string;
  bestFor: Segment[];
  strengths: string[];
  tradeoffs: string[];
  costNote: string;
  productionNote: string;
  whyChoose: string;
}

export const ARCHETYPE_INFO: Record<Archetype, ArchetypeInfo> = {
  student: {
    id: 'student',
    title: 'Student Notebook',
    tagline: 'Affordable, familiar, easy to make.',
    description:
      'A practical, no-frills lined notebook. The kind that lives in every bag on campus. Fast to produce, easy to scale, sells on price and reliability rather than premium feel.',
    bestFor: ['students', 'creators'],
    strengths: [
      'Lowest unit cost - best margin headroom at low prices',
      'Highest production speed - capacity goes further',
      'Strong fit with student segment',
    ],
    tradeoffs: [
      'Weak premium / gift appeal',
      'Limited price ceiling - mismatch with professionals at high prices',
      'Less differentiation without add-ons',
    ],
    costNote: 'Material cost is lowest of the three. Hardcover + standard paper is the value combo.',
    productionNote: 'Fastest to produce; pairs well with smaller capacity.',
    whyChoose: 'Pick this when starting lean, when targeting volume buyers, or when cash is tight.',
  },
  planner: {
    id: 'planner',
    title: 'Planner',
    tagline: 'Structured. Functional. A little more grown-up.',
    description:
      'A notebook with a calendar grid and tab dividers. Organised feel, slightly higher perceived value. Sits between student and premium - good middle-ground product when audiences shift.',
    bestFor: ['students', 'professionals'],
    strengths: [
      'Stronger fit with professionals than the student notebook',
      'Higher perceived value at the same paper / cover',
      'Holds price increases better than student',
    ],
    tradeoffs: [
      'Slightly more complex to produce',
      'Charms / stickers feel less natural here than on a daily journal',
      'Demand is steadier but lower volume than students',
    ],
    costNote: 'Mid-tier material cost. Leather upgrade lifts professional fit sharply.',
    productionNote: 'Slightly slower than the student notebook; consider a hire when ramping.',
    whyChoose: 'Pick this when broadening into the professional segment without abandoning students.',
  },
  daily: {
    id: 'daily',
    title: 'Daily Journal',
    tagline: 'Premium, giftable, emotional.',
    description:
      'A leather-feel daily journal with strap and gold "DAILY" stamp. The most "giftable" of the three. Strongest emotional pull for creators and gift-buyers, command higher prices, but every cost line scales up.',
    bestFor: ['creators', 'gift', 'professionals'],
    strengths: [
      'Highest price ceiling - creators and gift-buyers pay more',
      'Strong fit with ribbon wraps and name stickers',
      'Best for premium positioning',
    ],
    tradeoffs: [
      'Highest unit cost - margin is thinner if you under-price',
      'Slower to produce - capacity bites harder',
      'Mismatch with budget students at low prices',
    ],
    costNote: 'Material cost is the highest. Leather + premium paper makes the strongest signal.',
    productionNote: 'Slowest of the three. Hire help and add a tool to scale.',
    whyChoose: 'Pick this for premium positioning, holiday seasons, or when serving gift-buyers.',
  },
};
