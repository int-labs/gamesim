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
  tagline:
    "Run a notebook business for 90 simulated days. Pick your audience, design your products, manage stock and cash - and learn why growth is more than revenue.",
  taglineReturning:
    'Pick up where you left off. Your run is saved.',
  taglineEnded:
    'Your last run wrapped. Start a fresh one to try a different strategy.',
  ameliaIntro: "Hi, I'm Amelia. I'll guide you through the numbers and explain what each decision changes.",
  ameliaIntroReturning: (day: number, phase: number, route: 'self' | 'investor') =>
    `Welcome back. You're on Day ${day} of 90, mid-Phase ${phase}, ${route === 'investor' ? 'investor-backed' : 'self-funded'}.`,
  cta: {
    startFirst: 'Start business',
    continue: (day: number) => `Continue · Day ${day}`,
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
    hint: 'This is your business. You can rename it any time from the shop sign on your desk.',
  },
  eyebrow: 'Step 1',
  title: 'Choose your funding route',
  subtitle:
    'Each route changes your starting cash, the pressure you feel, and how your final score is weighted. Either route can score 100.',
  self: {
    title: 'Self-funded',
    tagline: 'Small budget. Patient run.',
    startingCash: 1000,
    perks: 'No debt. No repayment pressure. Straight scoring.',
    risks: 'Slow start - every dollar matters. Mistakes hurt longer.',
    summary:
      'Best if you want a calmer run focused on learning fundamentals before scaling.',
  },
  investor: {
    title: 'Investor-backed',
    tagline: 'More cash. Real expectations.',
    startingCash: 2500,
    perks: 'Bigger upfront moves possible. ×1.1 score multiplier on success.',
    risks: 'Repay $3,000 by Day 90 or lose 15 points. Faster pace, less margin for error.',
    summary:
      'Best if you want pressure-tested scaling and a higher score ceiling.',
  },
  footer: 'Pick what fits your style. The simulation works either way.',
};

export const PHASE_INTRO = {
  1: {
    title: 'Phase 1 · Days 1-30 - Market Positioning',
    body: "Find your audience and ship your first notebook. This phase is about discovery - pick a segment, set a price, and watch what fit feels like.",
    cta: 'Start Phase 1',
    learningFocus: 'LP1',
  },
  2: {
    title: 'Phase 2 · Days 31-60 - Inventory Flow',
    body: "Demand grows. Now you have to keep stock flowing without trapping cash. Hire helpers, buy raw materials at the right moment, and watch your stockout / overstock days.",
    cta: 'Start Phase 2',
    learningFocus: 'LP2',
  },
  3: {
    title: 'Phase 3 · Days 61-90 - Cash, P&L, Focus',
    body: "Final stretch. Read your P&L like a map, repay debts, and decide whether to expand your line-up or focus your strongest notebook. Cash timing decides who finishes well.",
    cta: 'Start Phase 3',
    learningFocus: 'LP4',
  },
} as const;

export const PRODUCT_PAGE = {
  notebookItems: {
    title: 'Notebook Items',
    subtitle: (count: number, phase: number) =>
      `${count} ${count === 1 ? 'notebook' : 'notebooks'} · Phase ${phase}`,
    emptyState:
      'No notebook lines yet. Add one to start designing your first product.',
    helperLow:
      'Add more lines to reach new audiences. Complexity may slow production.',
    helperStrained:
      'Strained - too many lines for your current capacity. Consider upgrading operations.',
    helperOverloaded:
      'Overloaded - hire helpers or buy tools before adding more lines.',
    addCta: 'Add Notebook',
    addAnother: 'Add another notebook line',
    deleteConfirm: (name: string) => `Delete "${name}"? This removes the line and its add-ons.`,
    quantityHint: 'Sets daily production target for this notebook.',
    activePin: 'ACTIVE',
  },
  config: {
    title: 'Active Notebook · Configuration',
    subtitle: 'Edits affect the selected notebook only.',
    typeLabel: 'Notebook Type',
    typeHint: 'Each archetype keeps its own add-ons and feels different to its audience.',
    coverLabel: 'Cover Material',
    coverHint: 'Hardcover lifts perceived quality. Leather lifts price tolerance.',
    bindingLabel: 'Binding',
    bindingHint: 'Ring lays flat. Staple is cheaper.',
    sizeLabel: 'Size',
    sizeHint: 'Add-ons scale with the notebook.',
    paperLabel: 'Paper Quality',
    paperHint: 'Cheap is fine for students. Premium signals craft.',
    addOns: {
      title: 'Add-Ons',
      hint: 'Drag onto the notebook. Add-ons raise value but also raise unit cost.',
      cap: 'Each line can carry up to 3 add-ons of different sub-categories.',
      maxReached: 'Add-on limit reached for this notebook.',
      duplicate: 'A similar add-on is already placed.',
    },
  },
  effects: {
    title: 'Active Notebook · Impact',
    subtitle: 'What your current product needs say to the customer',
    allTitle: 'All Notebooks',
    snapshotTitle: 'Profit Snapshot',
    snapshotHint: 'Click to jump to the full P&L table.',
    noAudience: {
      title: 'No audience',
      hint: 'Open Business → Audience',
      action: 'Pick one',
    },
    weakFit: 'Weak segment fit - design and target are mismatched.',
    strongFit: 'Strong segment fit - your design matches the audience.',
    noStockYet: 'Buy raw, then confirm phase',
    cannibalization: {
      none: 'None',
      low: 'Low',
      medium: 'Medium',
      high: (pct: number) => `High (−${pct}%)`,
      hint: 'Lines targeting the same audience may compete with each other.',
    },
    capacityHint: '100% means production matches your daily capacity exactly.',
  },
};

export const BUSINESS_PAGE = {
  header: 'Business sections',
  tabs: {
    operations: {
      label: 'Operations',
      sub: 'Sell, market, hire & ship',
      explainer: 'Your company decisions - where you sell, what you spend on marketing and sales, who you hire, and which vendor ships for you. Most spend energy; read the case study before you commit.',
    },
    inventory: {
      label: 'Inventory',
      sub: 'Stock & production',
      explainer: 'Finished goods, production per day, and demand. Produce near demand to stay clean - over-make and cash piles up in unsold stock.',
    },
    performance: {
      label: 'Performance',
      sub: 'P&L & portfolio',
      explainer: 'The full profit & loss and per-notebook numbers. Trace every outcome back to the decision that caused it.',
    },
  },
  inventory: {
    rawHint: 'Raw materials get turned into finished notebooks each day.',
    finishedHint: 'Finished stock is ready to sell. No stock = no sales.',
    stockoutHint: 'A stockout means a customer wanted to buy but you had nothing to sell - lost demand.',
    overstockHint: 'Overstock means cash is sitting in unsold notebooks. It traps liquidity.',
  },
  sales: {
    marketingHint: 'Marketing lifts demand, but only converts if you have stock AND fit.',
    channelHint: 'Each channel has a different reach and daily cost.',
  },
};

export const HUD_TOOLTIPS = {
  phase: 'Which 30-day phase you are in. Phases run consecutively (1→2→3) and you confirm each one to advance.',
  energy: 'Energy is consumed by big decisions (hires, upgrades, campaigns). It refills each phase.',
  cash: 'Money you can spend right now. Cash can drop before profit appears - material buys hit immediately.',
  opProfit: 'Operating Profit = Revenue − material − labor − packaging − fulfillment − marketing − tools.',
  revenue: 'Total money customers paid you. Revenue alone does not equal profit.',
  stock: 'Finished notebooks ready to sell. No stock means no sales, even if demand is high.',
  demand: 'Estimated daily customer interest based on segment fit, price, marketing, and brand.',
  fit: 'How well the active notebook matches the selected audience. Above 70% is strong; below 40% is weak.',
};

export const PNL = {
  title: 'Profit & Loss',
  subtitle: 'How your decisions add up across phases',
  rows: {
    grossRevenue: { label: 'Gross Revenue', hint: 'Units sold × price.' },
    material: { label: 'Less: Material Cost', hint: 'Paper, cover, binding, add-ons.' },
    labor: { label: 'Less: Labor Cost', hint: 'Daily wages × hires.' },
    packaging: { label: 'Less: Packaging / Fulfillment', hint: 'Per-unit fulfillment cost.' },
    marketing: { label: 'Less: Marketing Spend', hint: 'Daily marketing cost across channels.' },
    tools: { label: 'Less: Tools / Upgrades', hint: 'One-time and recurring tool costs.' },
    grossProfit: { label: 'Gross Profit', hint: 'Revenue − direct costs (material + labor + fulfillment).' },
    opProfit: { label: 'Operating Profit', hint: 'Gross Profit − marketing − tools.' },
    cash: { label: 'Cash Balance', hint: 'Money on hand. Different from profit because of timing.' },
  },
};

export const CONFIRM_PHASE = {
  titleFn: (phase: number) => `Confirm Phase ${phase} Decisions`,
  preview: {
    intro: (phase: number, daysLeft: number) =>
      `Lock in your decisions for Phase ${phase}. The simulation will run ${daysLeft} day${daysLeft === 1 ? '' : 's'} with your current product, audience, channels, and operations.`,
    disclaimer:
      "These numbers are an estimate. Actual demand is rolled day-by-day, so results may swing - that's part of the game. Adjust before confirming if needed.",
    impactTitle: 'Estimated phase impact',
    impactRow: {
      sold: (units: number, days: number) => `Likely sold over ${days}d: ~${units} units`,
      revenue: (amount: string) => `Revenue est.: ${amount}`,
      expenses: (amount: string) => `Operating expenses: ${amount}`,
      net: (amount: string, positive: boolean) =>
        `Net cash change: ${positive ? '+' : ''}${amount}`,
    },
  },
  running: 'Simulating phase…',
  confirmCta: (phase: number) =>
    phase === 1 ? 'Confirm Phase 1 · Days 1-30' :
    phase === 2 ? 'Confirm Phase 2 · Days 31-60' :
    'Confirm Phase 3 · Days 61-90',
  cancel: 'Adjust first',
};

export const EVALUATION = {
  headerFn: (phase: number, isFinal: boolean) =>
    isFinal ? 'Closing the books' : `Looking back at Phase ${phase}`,
  panels: {
    snapshot: 'Phase Snapshot',
    cash: 'Cash trend',
    profit: 'Daily profit',
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
  eyebrow: 'Day 90 · Final',
  title: 'Final Results',
  panels: {
    score: 'Score Breakdown',
    full90: 'The full 90 days',
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
    pickedSegment: 'Picked a clear target audience early.',
    qualityProcess: 'Quality process kept defects low.',
    diversifiedChannels: 'Diversified channels.',
    cashPositive: 'Stayed cash-positive throughout.',
    keptLean: 'Kept costs lean - no wasted upgrades.',
    profit: (amount: string) => `Made ${amount} in profit.`,
  },
  hurt: {
    stockouts: 'Stockouts left demand on the table.',
    overstock: 'Overstock trapped cash in unsold inventory.',
    noSegment: 'Never settled on a clear segment.',
    cashNegative: 'Cash went negative - even with revenue.',
    noDifferentiation: 'Every line lacked differentiation across all variants.',
  },
};

export const TOAST = {
  addOnCap: 'Add-on cap reached or sub-category already placed.',
  audienceFirst: 'Open the Design drawer and pick a market (genre) first.',
  notebookFirst: 'Add at least one notebook product before simulating.',
  decisionLogged: "Decision logged. We'll see how it plays out over the next days.",
};

export const VALIDATION = {
  noNotebook: 'Add at least one notebook to continue.',
  noSegment: 'Pick a market - open Design and choose a genre.',
  runEnded: 'This run is finished. Start a new game from Home.',
  pendingEvent: 'Resolve the event before confirming the next phase.',
  pendingEval: 'Finish the phase evaluation before continuing.',
};
