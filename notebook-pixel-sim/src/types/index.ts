// Shared types for the simulation. All currency is in dollars (number).

// V3 (FinLit) type aliases — imported from the self-contained data module.
// (data/finlit does not import back from @/types, so there is no cycle.)
import type {
  GenreId as FinlitGenreId,
  ProductionSpec as FinlitProductionSpec,
  ChannelId as FinlitChannelId,
  VendorId as FinlitVendorId,
  CandidateId as FinlitCandidateId,
  MarketingId as FinlitMarketingId,
} from '@/data/finlit';

export type {
  FinlitGenreId, FinlitProductionSpec, FinlitChannelId, FinlitVendorId,
  FinlitCandidateId, FinlitMarketingId,
};

export type Phase = 1 | 2 | 3;
export type Route = 'self' | 'investor';
export type Segment = 'students' | 'creators' | 'professionals' | 'gift';
/**
 * A notebook's identity = the market it is made for.
 *
 * This used to be a closed union of V2 product shapes ('student' | 'planner' |
 * 'daily') that sat ALONGSIDE `genre`, holding a 1:1 duplicate of it. Two
 * fields for one concept is what made the product model confusing, so the
 * archetype axis is gone and `genre` is the single identity. The alias is kept
 * only so existing call sites read naturally; it is a genre id.
 */
export type Archetype = FinlitGenreId;
export type Cover = 'hardcover' | 'leather';
export type Binding = 'ring' | 'staple';
export type Size = 's' | 'm' | 'l';
export type PaperQuality = 'cheap' | 'standard' | 'premium';
export type PricePoint = 'low' | 'balanced' | 'premium';
export type ChannelId =
  | 'word_of_mouth'
  | 'campus_booth'
  | 'campus_store'
  | 'online'
  | 'influencer'
  | 'student_club';

export type ScreenId =
  | 'start'
  | 'route'
  | 'phase_intro'
  | 'simulation'
  | 'evaluation'
  | 'final';

export type SidebarCategory =
  | 'product'
  | 'audience'
  | 'addons'
  | 'operations'
  | 'inventory'
  | 'commercial'
  | 'metrics'
  | 'results';

export type MascotMood =
  | 'neutral'
  | 'happy'
  | 'happy_soft'
  | 'excited'
  | 'excited_big'
  | 'thinking'
  | 'thinking_side'
  | 'concerned'
  | 'concerned_soft'
  | 'confused'
  | 'confused_tilt'
  | 'warning'
  | 'warning_alert'
  | 'pointing_left'
  | 'pointing_right'
  | 'pointing_left_explain'
  | 'pointing_right_explain'
  | 'presenting'
  | 'presenting_open_hand'
  | 'idle'
  | 'idle_soft_wave';

export type BubbleType =
  | 'hint'
  | 'warning'
  | 'success'
  | 'event'
  | 'insight'
  | 'debrief'
  | 'tutorial';

export interface MascotMessage {
  id: string;
  type: BubbleType;
  body: string;
  mood?: MascotMood;
  priority: number; // 0 high → 5 low
  ttlMs?: number;
  /**
   * Sequence support — set when this message is part of a multi-step
   * dialogue script (see src/content/mascotScripts.ts). The runtime
   * uses these to render Previous/Next + "2 / 5" progress.
   */
  seqId?: string;
  seqIndex?: number;
  seqLen?: number;
  seqTitle?: string;
}

export interface AddOnInstance {
  id: string;          // unique instance id
  defId: string;       // reference to AddOnDef
  placedAt: number;    // day placed
  /**
   * Free-canvas placement. All values are NORMALIZED (independent of
   * pixel size) so the placement survives canvas resize + browser zoom:
   *   x, y    — center position relative to the canvas stage (0..1)
   *   scale   — size multiplier relative to the stage's natural unit
   *   rotation— degrees, optional (defaults to 0)
   *   zIndex  — local stacking within the canvas (1..9, clamped)
   */
  x: number;
  y: number;
  scale: number;
  rotation?: number;
  zIndex: number;
}

// ─── Product Lines (portfolio model) ──────────────────────────────────────
//
// The simulation runs a PORTFOLIO of product lines, not a single product.
// Each line is an independent SKU with its own design, price, target
// segment, and stock pool. Production capacity, channels, marketing,
// brand, and retention remain company-wide.
//
// Phase line caps:
//   Phase 1 → max 2 lines, all share the global target segment
//   Phase 2 → max 3 lines, lines may target different segments
//   Phase 3 → max 5 lines, full flexibility
//
// Cannibalization (per segment, applied to lines whose target == seg):
//   1 line  → ×1.00
//   2 lines → ×0.85
//   3 lines → ×0.75
//   4+      → ×0.60
//
// Production allocation (shared capacity):
//   load[line] = quantityTarget[line] / phaseLength × unitTime[line]
//   if Σload ≤ capacity   → each line builds toward its daily target
//   else                  → each line scales by capacity / Σload

export interface ProductLineInventory {
  raw: number;            // units of raw material reserved for this line
  finished: number;       // good units ready to ship
  stockoutDays: number;   // days where this line had unmet demand
  overstockDays: number;  // days where this line was sitting on too much
  producedToday: number;  // last tick's good output (display only)
}

export interface ProductLine {
  /** Stable id used as ledger tag, key in lookup maps, and React key. */
  id: string;
  /** Player-editable name. Defaults from archetype: "Student", "Planner-2", … */
  name: string;
  /**
   * True when the player has manually renamed this line. While false,
   * changing the archetype updates the name to match the new archetype's
   * default ("Student" → "Planner"). Becomes true on any explicit rename.
   */
  isCustomName: boolean;

  /**
   * The notebook this line makes = the market it targets. Mirrors `genre`
   * below, which is the canonical field; this alias stays populated so the
   * many `line.archetype` call sites keep working and a saved game written by
   * either name still loads. Both always hold the same genre id.
   */
  archetype: Archetype;
  cover: Cover;
  binding: Binding;
  size: Size;
  paperQuality: PaperQuality;
  pricePoint: PricePoint;
  price: number;

  /**
   * Add-on lists keyed by notebook id, so switching a line between notebooks
   * keeps the decoration the player built up for each. Only the active id's
   * list affects unit cost / time / fit / demand.
   *
   * A partial Record, not a total one: notebook ids are open-ended now (the
   * operator can publish more), so an entry is created on demand rather than
   * every id being present up front.
   */
  addOnsByArchetype: Partial<Record<Archetype, AddOnInstance[]>>;

  /**
   * Player intent for the WHOLE PHASE (units). Engine divides by phase
   * length to derive a daily target, then allocates capacity proportionally
   * across lines.
   */
  quantityTarget: number;

  /**
   * Per-line target segment. In Phase 1 this is set globally for all lines
   * by the audience picker; in Phase 2+ each line can override.
   * `null` means "no target" — line still produces but demand is weak.
   */
  targetSegment: Segment | null;

  inventory: ProductLineInventory;

  // ── V3 (FinLit) fields — optional; the engine adapter falls back to sensible
  //    defaults for lines that predate them. See docs/V3-FINLIT-PRD.md. ──
  /** The notebook genre this line targets (its market). */
  genre?: FinlitGenreId;
  /** Multiplicative production spec (type/paper/size/pageDesign/addon/cover). */
  finlitSpec?: Partial<FinlitProductionSpec>;
  /** Shipping vendor engaged for this line. */
  vendor?: FinlitVendorId;
  /** Units/day the player commits to producing (LP2 lever; ≤ capacity). */
  targetPerDay?: number;
  /** Player's own demand estimate for this line (units/phase). Pure UI input —
   *  used to coach production targets; does not affect the engine simulation. */
  demandEstPerPhase?: number;
}

export type AddOnCategory =
  | 'integrated_charm'
  | 'integrated_ribbon'
  | 'integrated_sticker_name'
  | 'integrated_sticker_pack'
  | 'decorative_washi'
  | 'decorative_pattern'
  | 'decorative_bundle'
  | 'functional_bookmark'
  | 'functional_band'
  | 'functional_closure'
  | 'functional_clip'
  | 'writing_tool';

export interface AddOnDef {
  id: string;
  name: string;
  category: AddOnCategory;
  imgPath: string;
  thumbPath?: string;
  costPerUnit: number;     // contributes to COGS
  segmentBoost?: Partial<Record<Segment, number>>; // 0..1
  perceivedValue: number;  // 0..1 effect on price ceiling
  slot: import('@/data/addOnSlots').AddOnSlot; // canonical placement
  description: string;
}

export interface Decision {
  id: string;
  category: SidebarCategory | 'event';
  kind: string;
  payload?: Record<string, unknown>;
  costs: { time: number; energy: number; cash: number };
  effects?: string[];
  causeTag: string; // e.g. 'segment_change', 'cover_leather'
}

export interface LedgerEntry {
  id: string;
  day: number;
  kind:
    | 'revenue'
    | 'cogs-material'
    | 'cogs-labor'
    | 'cogs-packaging'
    | 'cogs-fulfillment'
    | 'opex-marketing'
    | 'opex-rent'
    | 'opex-tool'
    | 'opex-energy'
    | 'cash-in'
    | 'cash-out'
    | 'inventory-purchase';
  amount: number;
  cause: string;
  decisionId?: string;
}

export interface DemandSnapshot {
  day: number;
  bySegment: Record<Segment, number>;
  total: number;
  sold: number;
  lostSales: number;
}

export interface EventOption {
  id: 'A' | 'B' | 'C' | 'D';
  label: string;
  description: string;
  cost: { energy: number; cash?: number };
  effects: string[]; // human readable, applied as modifiers
  modifierIds: string[]; // engine refs
}

export interface EventDef {
  id: string;
  day: number;
  title: string;
  body: string;
  mascotMood: MascotMood;
  options: EventOption[];
}

export interface InsightCheck {
  id: string;
  phase: Phase;
  question: string;
  options: { id: 'A' | 'B' | 'C' | 'D'; text: string; correct: boolean }[];
  shownAt?: number; // day
  answeredCorrectly?: boolean;
}

export interface UpgradeDef {
  id: string;
  name: string;
  category: 'hire' | 'tool' | 'process' | 'supplier' | 'channel' | 'marketing' | 'finance';
  description: string;
  costs: { time: number; energy: number; cash: number };
  unlockDay?: number;
  /**
   * IDs of upgrades that must already be acquired before this one becomes
   * available. Combined with the phase gate, prerequisites enforce a coherent
   * upgrade ladder (e.g. you can't hire a second helper without hiring a first,
   * can't buy a pro press without the basic press).
   */
  requires?: string[];
  effects: string[];
}

export interface SegmentDef {
  id: Segment;
  name: string;
  description: string;
  baseDemand: number;
  priceSensitivity: number; // higher = more sensitive
  preferredPriceRef: number;
  preference: {
    paperQuality: number; // 0..1 weight
    coverPremium: number;
    decorative: number;
    functional: number;
    packaging: number;
  };
  imgPath: string;
}

export interface ChannelDef {
  id: ChannelId;
  name: string;
  description: string;
  reach: number; // demand multiplier
  dailyCost: number;
  unlockEnergy: number;
  unlockCash: number;
  segmentAffinity: Partial<Record<Segment, number>>;
  imgPath?: string;
}
