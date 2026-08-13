// Structured Amelia guidance sequences.
//
// Each script is a *named ordered list* of mascot messages. The mascot
// runtime treats each script as a single dialogue: the player can move
// Previous / Next, see "2 / 5" progress, Skip the whole thing, or
// Finish on the last message. Scripts are fired by triggers (first
// product page visit, before phase 1 confirm, after phase 1 result,
// etc.) — see App.tsx for wiring.
//
// Style rules:
//   - 2-5 messages per script
//   - each message ≤ 2 short sentences (visual-novel comfort)
//   - explain cause AND next action
//   - never repeat obvious UI labels
//   - never sound robotic ("As an AI...")
//
// All `id` values must be globally unique. The runtime de-duplicates
// by id, so a script will not fire twice unless the id changes.

import type { MascotMessage, MascotMood, BubbleType } from '@/types';

export interface MascotScript {
  /** Unique trigger key — also used as id prefix. */
  key: string;
  /** Short title shown in dialogue header (e.g. "Welcome"). */
  title: string;
  /** Ordered messages. The runtime fills seqId/seqIndex/seqLen. */
  messages: Array<{ body: string; mood?: MascotMood; type?: BubbleType }>;
}

/** Convert a script into MascotMessage objects ready to push into the queue. */
export function expandScript(script: MascotScript): MascotMessage[] {
  return script.messages.map((m, i) => ({
    id: `${script.key}__${i}`,
    seqId: script.key,
    seqIndex: i,
    seqLen: script.messages.length,
    seqTitle: script.title,
    type: m.type ?? 'tutorial',
    body: m.body,
    mood: m.mood,
    priority: 1,
  }));
}

// ──────────────────────────────────────────────────────────────────────
// SCRIPTS
// ──────────────────────────────────────────────────────────────────────

export const SCRIPT_INTRO: MascotScript = {
  key: 'intro_first_visit',
  title: 'Welcome',
  messages: [
    {
      body: "Hey, I'm Amelia. Welcome to the academy.",
      mood: 'idle_soft_wave',
    },
    {
      body: "You're going to run a small notebook business for 90 simulated days. The goal is to learn how product, audience, operations, and cash actually fit together - not just to pick a winner.",
      mood: 'presenting',
    },
    {
      body: 'Three phases, 30 days each. Each phase ends with a debrief and a quick insight question.',
      mood: 'pointing_left_explain',
    },
    {
      body: "I'll pop up when something needs attention. You can skip my dialogue any time - but the early hints save you a lot of money.",
      mood: 'happy_soft',
    },
  ],
};

export const SCRIPT_AFTER_ROUTE_SELF: MascotScript = {
  key: 'route_chosen_self',
  title: 'Self-funded',
  messages: [
    {
      body: 'Self-funded - patient and steady. You start with $1,000 and no debt to repay.',
      mood: 'happy_soft',
    },
    {
      body: "Score lands clean: no multiplier, no penalty. Strong fit if you want to learn the basics before the pressure ramps up.",
      mood: 'pointing_right_explain',
    },
  ],
};

export const SCRIPT_AFTER_ROUTE_INVESTOR: MascotScript = {
  key: 'route_chosen_investor',
  title: 'Investor-backed',
  messages: [
    {
      body: 'Investor-backed - bigger budget, bigger expectations. You start with $2,500 but owe $3,000 by Day 90.',
      mood: 'thinking_side',
    },
    {
      body: 'Win this and your final score gets a ×1.1 multiplier. Miss the repayment and you lose 15 points - so plan cash, not just revenue.',
      mood: 'warning',
    },
  ],
};

export const SCRIPT_FIRST_PRODUCT_PAGE: MascotScript = {
  key: 'first_product_page',
  title: 'Product Page',
  messages: [
    {
      body: 'This is your product workshop. Each card on the left is its own product line - its own notebook with its own configuration.',
      mood: 'pointing_left_explain',
    },
    {
      body: 'Pick a notebook type, cover, binding, size, and paper quality. The right rail tells you how those choices change demand and unit cost in real time.',
      mood: 'presenting',
    },
    {
      body: 'Add-ons are extras you drag onto the canvas. They lift perceived value but raise unit cost - and each line can only carry 3.',
      mood: 'thinking',
    },
    {
      body: 'You can run multiple lines, but each new line adds production complexity. More products ≠ more profit unless your operations scale with them.',
      mood: 'thinking_side',
    },
  ],
};

export const SCRIPT_FIRST_BUSINESS_PAGE: MascotScript = {
  key: 'first_business_page',
  title: 'Business Page',
  messages: [
    {
      body: 'Welcome to the business side. Three sections: Operations, Inventory, and Performance.',
      mood: 'presenting',
    },
    {
      body: 'Operations is where you run the company: where you sell, what you spend on marketing and sales, who you hire, and which vendor ships for you.',
      mood: 'pointing_right_explain',
    },
    {
      body: 'Inventory is how many to make per phase - over-make and your cash gets trapped in unsold stock. Performance is the P&L: where every dollar actually went.',
      mood: 'thinking_side',
    },
  ],
};

export const SCRIPT_FIRST_ADDON: MascotScript = {
  key: 'first_addon_drop',
  title: 'Add-Ons',
  messages: [
    {
      body: 'Nice - your first add-on. These raise perceived value but raise unit cost, so they only pay off when the audience values that detail.',
      mood: 'happy_soft',
    },
    {
      body: 'Each line can carry up to 3 add-ons of different sub-categories. Stacking everything maxes complexity and rarely improves margin.',
      mood: 'thinking',
    },
  ],
};

export const SCRIPT_BEFORE_PHASE1_CONFIRM: MascotScript = {
  key: 'before_phase1_confirm',
  title: 'Before You Confirm',
  messages: [
    {
      body: "Before you lock Phase 1, two checks: have you picked an audience, and does your notebook fit them? The right rail tells you both.",
      mood: 'thinking_side',
    },
    {
      body: "Below 40% fit means demand will stay cold. Above 70% means buyers will reach for it. Adjust price, materials, or add-ons to land in the sweet spot.",
      mood: 'pointing_right_explain',
    },
    {
      body: "Confirming simulates the rest of the phase. You can't undo it once it runs - but you can adjust everything BEFORE confirming.",
      mood: 'warning_alert',
    },
  ],
};

export const SCRIPT_AFTER_PHASE1: MascotScript = {
  key: 'after_phase1',
  title: 'Phase 1 Debrief',
  messages: [
    {
      body: 'Phase 1 is in the books. Open the P&L below - it shows where every dollar came in and went out.',
      mood: 'presenting',
    },
    {
      body: 'In Phase 2, demand grows faster. Your job shifts from "find fit" to "keep the line flowing" - produce enough to sell without trapping cash in stock.',
      mood: 'pointing_left_explain',
    },
  ],
};

export const SCRIPT_PHASE2_START: MascotScript = {
  key: 'phase2_start',
  title: 'Phase 2 - Inventory Flow',
  messages: [
    {
      body: 'Phase 2: inventory flow. Demand is bigger now, so under-producing leaves money on the table - but over-producing freezes cash in unsold notebooks.',
      mood: 'thinking',
    },
    {
      body: "Watch two numbers: Stock and Demand in the top HUD. If stock keeps hitting zero, raise Produce / day or hire a helper. If stock keeps growing, lower it again.",
      mood: 'pointing_right_explain',
    },
    {
      body: "Operations upgrades unlock here. Each one explains its capacity gain and ongoing cost - pick the cheapest upgrade that solves your bottleneck.",
      mood: 'happy_soft',
    },
  ],
};

export const SCRIPT_PHASE3_START: MascotScript = {
  key: 'phase3_start',
  title: 'Phase 3 - Cash & Focus',
  messages: [
    {
      body: 'Final stretch. The numbers are bigger, the timing matters more. Cash flow is what decides who lands well.',
      mood: 'thinking_side',
    },
    {
      body: "If you're investor-backed, the $3,000 repayment is due by Day 90. Project your cash forward - don't be surprised on Day 87.",
      mood: 'warning_alert',
    },
    {
      body: "Decide whether to expand or focus. A wide line-up reaches more audiences but adds complexity. Sometimes the highest-margin move is to drop your weakest notebook.",
      mood: 'pointing_left_explain',
    },
  ],
};

export const SCRIPT_FINAL: MascotScript = {
  key: 'final_summary',
  title: 'Final Score',
  messages: [
    {
      body: "That's 90 days. Your final score has three parts: Net Profit (50), Inventory Cleanliness (25), and Insight (25).",
      mood: 'presenting',
    },
    {
      body: "Open the timeline below to see every decision in order. Most lessons live in why one choice helped and another hurt.",
      mood: 'pointing_right_explain',
    },
    {
      body: "Try a new run with a different audience or route. Two runs side-by-side teach more than one perfect run.",
      mood: 'happy_soft',
    },
  ],
};

export const ALL_SCRIPTS: MascotScript[] = [
  SCRIPT_INTRO,
  SCRIPT_AFTER_ROUTE_SELF,
  SCRIPT_AFTER_ROUTE_INVESTOR,
  SCRIPT_FIRST_PRODUCT_PAGE,
  SCRIPT_FIRST_BUSINESS_PAGE,
  SCRIPT_FIRST_ADDON,
  SCRIPT_BEFORE_PHASE1_CONFIRM,
  SCRIPT_AFTER_PHASE1,
  SCRIPT_PHASE2_START,
  SCRIPT_PHASE3_START,
  SCRIPT_FINAL,
];

export const SCRIPT_BY_KEY: Record<string, MascotScript> =
  Object.fromEntries(ALL_SCRIPTS.map((s) => [s.key, s]));
