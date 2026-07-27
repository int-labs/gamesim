// VoC fit — how well a line's config + price + channels align to a genre's
// Voice-of-Customer weights (the PDF's "VoC Alignment" chart). Returns a demand
// MULTIPLIER around 1.0, so a well-targeted product sells more of the sheet's
// base volume and a mismatched one sells less. LP1 lives here.
//
// Attribute scores are DERIVED FROM THE COST TABLES (higher-cost options read as
// more premium/decorated), so nothing is hand-waved — it tracks the real data.

import {
  PAGE_DESIGN_OPTIONS, ADDON_OPTIONS, COVER_OPTIONS, PAPER_OPTIONS, SIZE_OPTIONS,
  configOption, genreById, type GenreId, type ProductionSpec, type ChannelId,
} from '@/data/finlit';

const maxCost = (opts: { cost: number }[]) => Math.max(...opts.map((o) => o.cost));
const DESIGN_MAX = maxCost(PAGE_DESIGN_OPTIONS) + maxCost(ADDON_OPTIONS) + maxCost(COVER_OPTIONS);
const PAPER_MAX = maxCost(PAPER_OPTIONS);
const SIZE_MAX = maxCost(SIZE_OPTIONS);

/** Rough "ideal" price per genre (used only for the price-fit term). */
const IDEAL_PRICE: Record<GenreId, number> = {
  cute: 18, anime: 22, minimalist: 16, indie: 20,
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Attribute scores in [0,1] derived from the chosen config. */
export function attributeScores(spec: ProductionSpec, price: number, channels: ChannelId[], genre: GenreId) {
  const design =
    (configOption('pageDesign', spec.pageDesign).cost +
      configOption('addon', spec.addon).cost +
      configOption('cover', spec.cover).cost) / DESIGN_MAX;
  const paper = configOption('paper', spec.paper).cost / PAPER_MAX;
  const size = configOption('size', spec.size).cost / SIZE_MAX;

  const g = genreById(genre);
  const ideal = IDEAL_PRICE[genre];
  // Sharper penalty when the genre cares about price (voc.price high).
  const priceGap = Math.abs(price - ideal) / ideal;
  const price_ = clamp01(1 - priceGap * (0.5 + g.voc.price));

  // Availability: more relevant channels stocked = better reach.
  const channel = clamp01(channels.length / 3);

  return {
    design: clamp01(design),
    paper: clamp01(paper),
    size: clamp01(size),
    price: price_,
    channel,
  };
}

/**
 * Demand multiplier for a line targeting a genre. Weighted alignment of the
 * attribute scores to the genre's VoC, mapped to [0.6, 1.2] (neutral ≈ 0.9).
 */
export function vocFit(spec: ProductionSpec, price: number, channels: ChannelId[], genre: GenreId): number {
  const s = attributeScores(spec, price, channels, genre);
  const w = genreById(genre).voc;
  const wSum = w.design + w.price + w.channel + w.size + w.paper;
  const aligned =
    (w.design * s.design + w.price * s.price + w.channel * s.channel + w.size * s.size + w.paper * s.paper) / wSum;
  return 0.6 + 0.6 * aligned;
}
