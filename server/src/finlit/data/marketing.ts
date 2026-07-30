// Marketing teams (sheet rows 48–52). Pick one; it adds a sell-rate bump for a
// daily cost + energy. "Sell-rate is perpendicular to cost; cost is a slider,
// sell-rate rises 0.01 per $0.30" — the four presets sit on that line.

export type MarketingId = 'social' | 'offline_ad' | 'web' | 'seo';

export interface MarketingDef {
  id: MarketingId;
  name: string;
  cost: number;
  sellBonus: number;
  energy: number;
  blurb: string;
}

export const MARKETING_TEAMS: MarketingDef[] = [
  { id: 'social', name: 'Social Media Marketing', cost: 13, sellBonus: 0.047, energy: 4, blurb: 'Steady organic-feeling reach at a modest spend.' },
  { id: 'offline_ad', name: 'Offline Advertisement', cost: 10, sellBonus: 0.041, energy: 3, blurb: 'Cheapest option; smallest lift. Good early.' },
  { id: 'web', name: 'Web Marketing', cost: 20, sellBonus: 0.092, energy: 7, blurb: 'Biggest sell lift, but the priciest and most energy-hungry.' },
  { id: 'seo', name: 'SEO', cost: 17, sellBonus: 0.075, energy: 5, blurb: 'Strong compounding reach at a middle price point.' },
];

export const marketingById = (id: MarketingId): MarketingDef => {
  const m = MARKETING_TEAMS.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown marketing team: ${id}`);
  return m;
};
