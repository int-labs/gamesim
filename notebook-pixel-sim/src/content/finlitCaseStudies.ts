// Case studies (P4). The PDF requires players to READ a short case study before
// committing to a hire, marketing team, or shipping vendor — the pick is only
// as good as the fit to your situation. Each entry is the "brief" shown in the
// engage modal; `bestWhen` is the teachable heuristic.

export interface CaseStudy {
  title: string;
  brief: string;
  bestWhen: string;
  watchOut: string;
}

export const CANDIDATE_STUDIES: Record<string, CaseStudy> = {
  ains: {
    title: 'Ains - the machine',
    brief: 'Ains ships volume. Give them a workstation and finished units pile up faster than anyone on the roster - but they barely touch the sell side.',
    bestWhen: "You're production-starved: demand is outrunning what you can make.",
    watchOut: 'If you already over-produce, more output just deepens overstock.',
  },
  beta: {
    title: 'Beta - the all-rounder',
    brief: 'Beta gives you a steady bump to sell-rate. No spikes, no gaps - a safe hire when you are not sure where the bottleneck is.',
    bestWhen: 'Early game, or when production and demand are roughly balanced.',
    watchOut: 'A specialist beats Beta once you know your exact constraint.',
  },
  chewie: {
    title: 'Chewie - the closer',
    brief: 'Chewie reduces the cost of production. over long periods of time, that tiny margin to material cost might make a huge difference in profit margins',
    bestWhen: "You're unsure whether the item will sell, or if you require a larger margin of error to breakeven with less units sold",
    watchOut: 'When you have a large enough profit, it may be better to invest into other hiring options',
  },
};

export const MARKETING_STUDIES: Record<string, CaseStudy> = {
  social: {
    title: 'Social Media Marketing',
    brief: 'A balanced, always-on lift to sell-rate at a modest spend per phase. Reliable reach without a big commitment.',
    bestWhen: 'A dependable mid-game default across most genres.',
    watchOut: 'Never the cheapest nor the strongest - fine, rarely optimal.',
  },
  offline_ad: {
    title: 'Offline Advertisement',
    brief: 'The cheapest team and the smallest lift. Low cost per phase, low energy - good while cash is tight.',
    bestWhen: 'Phase 1, or any time margins are thin and every dollar counts.',
    watchOut: 'The lift is small; you will outgrow it fast.',
  },
  web: {
    title: 'Web Marketing',
    brief: 'The biggest sell-rate lift on offer - and the priciest, hungriest for energy. A late-game amplifier once you can afford it.',
    bestWhen: 'You have volume + margin and want to convert far more of it.',
    watchOut: 'Highest cost per phase and energy; a loss-maker on thin margins.',
  },
  seo: {
    title: 'SEO',
    brief: 'Strong, compounding reach at a middle price. Sits between Social and Web on both lift and cost.',
    bestWhen: 'Mid-to-late game when you want more lift than Social for a fair price.',
    watchOut: 'Middling energy cost - plan the phase budget around it.',
  },
};

export const VENDOR_STUDIES: Record<string, CaseStudy> = {
  als: {
    title: "Al's Store",
    brief: "Strong on Anime and Indie, decent on Minimalist - but Al doesn't stock Cute at all. Perfect quality where it counts.",
    bestWhen: 'Your line targets Anime or Indie.',
    watchOut: 'No Cute coverage; picking it for a Cute line does nothing.',
  },
  emils: {
    title: "Emil's Shop",
    brief: 'Great for Cute, Anime and Indie, with a perfect-quality Anime slot. Skips Minimalist entirely.',
    bestWhen: 'Cute or Anime lines that want reliable reach.',
    watchOut: 'No Minimalist coverage.',
  },
  phoebes: {
    title: "Phoebe's Books",
    brief: "Covers Cute, Minimalist and Indie with solid quality; the strongest production bonus on Cute. No Anime.",
    bestWhen: 'Cute lines especially, or Minimalist/Indie.',
    watchOut: 'No Anime coverage.',
  },
  nines: {
    title: "Nine's Wares",
    brief: 'Perfect-quality Minimalist and Indie, average on Cute. The go-to for the two quieter genres. No Anime.',
    bestWhen: 'Minimalist or Indie lines chasing top quality.',
    watchOut: 'No Anime; only average on Cute.',
  },
};

export function studyFor(kind: 'candidate' | 'marketing' | 'vendor', id: string): CaseStudy | null {
  const map = kind === 'candidate' ? CANDIDATE_STUDIES : kind === 'marketing' ? MARKETING_STUDIES : VENDOR_STUDIES;
  return map[id] ?? null;
}
