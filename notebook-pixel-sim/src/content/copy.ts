// Centralized user-facing copy.
//
// All headlines, body text, button labels, helper text, empty states, and
// section descriptions live here so they can be reviewed, edited, and
// translated in one place. Components import from this file rather than
// hard-coding strings inline.
//
// Keep entries SHORT, friendly, and business-aware. Tone reference:
// "A helpful game mentor teaching business through a notebook shop."

export const HOME = {
  eyebrow: 'Int Labs Academy',
  title: 'Mini Business Sim',
  // Phases, not days — nothing ticks per day, and the phase count is the
  // operator's `config.totalRounds`, so copy must not name either number.
  tagline:
    "Run a notebook business phase by phase. Pick your audience, design your products, manage stock and cash - and learn why growth is more than revenue.",
  taglineReturning:
    'Pick up where you left off. Your run is saved.',
  taglineEnded:
    'Your last run wrapped. Start a fresh one to try a different strategy.',
  ameliaIntro: "Hi, I'm Amelia. I'll guide you through the numbers and explain what each decision changes.",
  /** `totalRounds` is undefined in standalone play — the sentence then omits
   *  the total rather than asserting one. */
  ameliaIntroReturning: (phase: number, totalRounds?: number) =>
    `Welcome back. You're on Phase ${phase}${totalRounds ? ` of ${totalRounds}` : ''}.`,
  cta: {
    startFirst: 'Start business',
    continue: (phase: number) => `Continue · Phase ${phase}`,
    startNew: 'Start new game',
    startAnother: 'Start a new run',
  },
  learningPoints: [
    { tag: 'LP1', body: 'Targeted Design' },
    { tag: 'LP2', body: 'Inventory Flow' },
    { tag: 'LP3', body: 'Revenue vs Cash' },
    { tag: 'LP4', body: 'P&L Signals' },
  ],
};

// ── Pass Key gate (pre-Start entry experience) ──────────────────────────
export const PASSKEY = {
  title: 'Pass Key',
  subtitle: 'Enter your pass key to unlock your Academy experience.',
  inputLabel: 'Academy pass key',
  placeholder: 'Enter pass key',
  cta: {
    enter: 'Enter Academy',
    checking: 'Checking…',
    success: 'Welcome!',
  },
  errors: {
    empty: 'Please enter your pass key to continue.',
    invalid: "Hmm, that key doesn't fit. Double-check with your facilitator.",
    offline: "Couldn't reach the simulation server. Check your connection and try again.",
  },
  noKeyPrompt: "Don't have a pass key?",
  learnMoreCta: 'Learn more',
  learnMore: {
    title: 'About pass keys',
    body: [
      'Your pass key unlocks the Int Labs Academy simulation for your cohort.',
      'Keys are shared by your program facilitator when your session begins.',
    ],
    bullets: [
      'Already enrolled? Check your welcome email or ask your facilitator.',
      'Exploring on your own? Reach out to the Int Labs team for access.',
    ],
    close: 'Got it',
  },
  // Where Amelia roams in the scene + what she says there. Warm, casual, like a
  // friend showing you around. No em-dashes (they read as AI).
  mascotAreas: [
    {
      spot: 'shop',
      lines: [
        "Oh hey, you made it! Come on in and get comfy.",
        "I'm Amelia, by the way. So nice to finally meet you!",
        "I'm really glad you're here. Let's get this started!",
        'Got your pass key ready? Pop it in and off we go.',
      ],
    },
    {
      spot: 'river',
      lines: [
        'Ooh, would you look at that sunset over the water!',
        'Pretty nice out here, right? This spot is my favorite.',
        'That cool breeze off the river feels just about perfect.',
        'Honestly, I could stand here and watch this all evening.',
      ],
    },
    {
      spot: 'bench',
      lines: [
        "Psst, just so you know, I've got big plans for us two.",
        'So tell me, what is the first thing you want to make?',
        "You've got a real creative spark, I can already tell.",
        'Dream big. That is rule number one around this place.',
      ],
    },
    {
      spot: 'books',
      lines: [
        'Look at all these lovely fresh notebooks over here!',
        'Find the right key and every one of them is yours.',
        'Everything you could need is waiting right inside for you.',
        "Come on then, let me show you around the place!",
      ],
    },
  ],
  // Playful one-liners when Amelia is tapped.
  mascotReactions: [
    'Hehe, that tickles!',
    "Oh, hi! Didn't see you sneak up.",
    'Ooh, a curious one. I like you already.',
    "Big CEO energy, I'm telling you.",
    'Okay okay, key first, then high fives!',
    'Wheee, do that again!',
    "You and me? We're gonna be great.",
  ],
};

export const LEARNING_POINTS = {
  LP1: {
    title: 'Targeted Design',
    blurb: 'Pick one target segment and let it guide every design and pricing call. Focus beats spreading thin.',
  },
  LP2: {
    title: 'Inventory Flow',
    blurb: 'Inventory is tied-up cash. Match production to demand to dodge both stockouts and overstock.',
  },
  LP3: {
    title: 'Revenue vs Cash Flow',
    blurb: 'Profit is not cash. The timing of money in and out is what keeps you liquid as you grow.',
  },
  LP4: {
    title: 'Understanding P&L Signals',
    blurb: 'Read the P&L to spot which line item leaks and which decisions are actually profitable.',
  },
};

export const ROUTE = {
  shop: {
    title: 'Name your studio',
    hint: 'This is your business. You can rename it any time from Business ▸ Operations.',
  },
  eyebrow: 'Step 1',
  cta: 'Open for business',
  footer: 'You can change this later. Nothing here affects your score.',
};

export const PHASE_INTRO = {
  1: {
    title: 'Phase 1 - Market Positioning',
    body: "Find your audience and ship your first notebook. This phase is about discovery - pick a segment, set a price, and watch what fit feels like.",
    cta: 'Start Phase 1',
    learningFocus: 'LP1',
  },
  2: {
    title: 'Phase 2 - Inventory Flow',
    body: "Demand grows. Now you have to keep stock flowing without trapping cash. Hire helpers, tune Produce / phase, and watch what you leave unsold.",
    cta: 'Start Phase 2',
    learningFocus: 'LP2',
  },
  3: {
    title: 'Phase 3 - Cash, P&L, Focus',
    body: "Final stretch. Read your P&L like a map, repay debts, and decide whether to expand your line-up or focus your strongest notebook. Cash timing decides who finishes well.",
    cta: 'Start Phase 3',
    learningFocus: 'LP4',
  },
} as const;

export const BUSINESS_PAGE = {
  header: 'Business sections',
  tabs: {
    operations: {
      label: 'Operations',
      sub: 'Sell, market, hire & ship',
      explainer: 'Your company decisions - where you sell, what you spend on marketing and sales, who you hire, and which vendor ships for you. Most spend energy; read the case study before you commit. Everything here is reversible - clearing a decision refunds its energy.',
    },
    inventory: {
      label: 'Inventory',
      sub: 'Stock & production',
      explainer: 'Finished goods, production per phase, and demand. Produce near demand to stay clean - over-make and cash piles up in unsold stock.',
    },
    performance: {
      label: 'Performance',
      sub: 'P&L & portfolio',
      explainer: 'The full profit & loss and per-notebook numbers. Trace every outcome back to the decision that caused it.',
    },
  },
  inventory: {
    finishedHint: 'Finished stock is ready to sell. No stock = no sales.',
    stockoutHint: 'A stockout means a customer wanted to buy but you had nothing to sell - lost demand.',
    overstockHint: 'Overstock means cash is sitting in unsold notebooks. It traps liquidity.',
  },
  sales: {
    marketingHint: 'Marketing lifts demand, but only converts if you have stock AND fit.',
    channelHint: 'Each channel has a different reach and cost per phase.',
  },
};

export const HUD_TOOLTIPS = {
  phase: 'Which phase you are in. Phases run consecutively and you confirm each one to advance.',
  energy: 'Energy is consumed by big decisions (hires, upgrades, campaigns). It refills each phase.',
  cash: 'Money you can spend right now. Cash can drop before profit appears - material buys hit immediately.',
  opProfit: 'Operating Profit = Revenue − material − labor − packaging − fulfillment − marketing − tools.',
  revenue: 'Total money customers paid you. Revenue alone does not equal profit.',
  stock: 'Finished notebooks ready to sell. No stock means no sales, even if demand is high.',
  demand: 'Estimated customer interest based on segment fit, price, marketing, and brand.',
  fit: 'How well the active notebook matches the selected audience. Above 70% is strong; below 40% is weak.',
};

export const PNL = {
  title: 'Profit & Loss',
  subtitle: 'How your decisions add up across phases',
  rows: {
    grossRevenue: { label: 'Gross Revenue', hint: 'Units sold × price.' },
    material: { label: 'Less: Material Cost', hint: 'Paper, cover, binding, add-ons.' },
    labor: { label: 'Less: Labor Cost', hint: 'Wages × hires, per phase.' },
    packaging: { label: 'Less: Packaging / Fulfillment', hint: 'Per-unit fulfillment cost.' },
    marketing: { label: 'Less: Marketing Spend', hint: 'Marketing cost across channels, per phase.' },
    tools: { label: 'Less: Tools / Upgrades', hint: 'One-time and recurring tool costs.' },
    grossProfit: { label: 'Gross Profit', hint: 'Revenue − direct costs (material + labor + fulfillment).' },
    opProfit: { label: 'Operating Profit', hint: 'Gross Profit − marketing − tools.' },
    cash: { label: 'Cash Balance', hint: 'Money on hand. Different from profit because of timing.' },
  },
};

export const EVALUATION = {
  headerFn: (phase: number, isFinal: boolean) =>
    isFinal ? 'Closing the books' : `Looking back at Phase ${phase}`,
  panels: {
    snapshot: 'Phase Snapshot',
    cash: 'Cash trend',
    profit: 'Profit trend',
    cost: 'Cost mix this run',
    debrief: "Amelia's debrief",
    insight: 'Insight check',
  },
  buttons: {
    submit: 'Submit answer',
    continueNext: 'Continue to next phase',
    seeFinal: 'See final results',
  },
};

export const FINAL = {
  title: 'Final Results',
  panels: {
    score: 'Score Breakdown',
    cashTrend: 'Cash Trend',
    profitTrend: 'Profit Trend',
    costMix: 'Cost Mix',
    didWell: 'Did Well',
    hurt: 'Hurt Your Business',
    timeline: 'Decision Timeline',
    takeaway: "Amelia's takeaway",
  },
  scoreCells: {
    netProfit: 'Net Profit',
    inventory: 'Inventory',
    insight: 'Insight',
  },
  finalLabel: 'Final score',
  netProjected: (amount: string) => `Net profit projected from ledger: ${amount}`,
  takeaway: {
    strong: 'Strong run - your audience choice and operations stayed in sync. Notice what compounded.',
    mixed: 'Mixed run - solid moments and some leaks. The P&L will show where margin slipped.',
    tough:  'Tough run - re-read your decisions in the timeline below. The numbers will tell the story.',
  },
  buttons: {
    export: 'Export run JSON',
    home: 'Back to Home',
  },
  didWell: {
    qualityProcess: 'Quality process kept defects low.',
    diversifiedChannels: 'Diversified channels.',
    cashPositive: 'Stayed cash-positive throughout.',
    keptLean: 'Kept costs lean - no wasted upgrades.',
    profit: (amount: string) => `Made ${amount} in profit.`,
  },
  hurt: {
    stockouts: 'Stockouts left demand on the table.',
    overstock: 'Overstock trapped cash in unsold inventory.',
    cashNegative: 'Cash went negative - even with revenue.',
    noDifferentiation: 'Every line lacked differentiation across all variants.',
  },
};

export const TOAST = {
  addOnCap: 'Add-on cap reached or sub-category already placed.',
  notebookFirst: 'Add at least one notebook product before simulating.',
};

export const VALIDATION = {
  noNotebook: 'Add at least one notebook to continue.',
  runEnded: 'This run is finished. Start a new game from Home.',
  pendingEvent: 'Resolve the event before confirming the next phase.',
  pendingEval: 'Finish the phase evaluation before continuing.',
};
