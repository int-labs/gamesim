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

// Seeded empty — populated at boot by configHydrator via patchCaseStudy().
// Keys match the backend GlobalInputItem.key for each candidate.
export const CANDIDATE_STUDIES: Record<string, CaseStudy> = {};

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

// Seeded empty — populated at boot by configHydrator via patchCaseStudy().
// Keys match the backend GlobalInputItem.key for each vendor.
export const VENDOR_STUDIES: Record<string, CaseStudy> = {};

const EMPTY_STUDY: CaseStudy = { title: '', brief: '', bestWhen: '', watchOut: '' };

export function studyFor(kind: 'candidate' | 'marketing' | 'vendor', id: string): CaseStudy {
  const map = kind === 'candidate' ? CANDIDATE_STUDIES : kind === 'marketing' ? MARKETING_STUDIES : VENDOR_STUDIES;
  return map[id] ?? EMPTY_STUDY;
}
