import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  ChannelId,
  LedgerEntry,
  MascotMessage,
  Phase,
  Route,
  ScreenId,
  Segment,
  SidebarCategory,
  MascotMood,
  BubbleType,
  ProductLine,
} from '@/types';
import { STARTING_CASH, STARTING_DEBT } from '@/data/balance';
import { DAYS_PER_PHASE } from '@/engine/config';
import { ENERGY_START, ENERGY_CAP, GENRES } from '@/data/finlit';
import { segmentForGenre } from '@/engine/finlit/core/config/genreSegments';
import type { ActiveModifier } from '@/engine/modifiers';
import type { PendingCash } from '@/engine/cashflow';
import type { GlobalInputDto } from '@/gamesim/types';

/**
 * The shop's name before the player picks one. Doubles as the fallback whenever
 * a rename resolves to empty, so the UI never shows a nameless shop. Matches
 * the canvas sign's original text, so an existing save reads unchanged.
 */
export const DEFAULT_SHOP_NAME = 'Notebook Studio';
/** Keeps the name inside the canvas sign / HUD without truncating. */
export const MAX_SHOP_NAME = 24;

/**
 * Durable event/decision effect. Used by engine formulas to model lasting
 * impacts (e.g. material cost +20% for 30 days) instead of one-shot mutations.
 */
export interface Modifier {
  id: string;
  kind:
    | 'material_cost_mult'
    | 'demand_mult'
    | 'demand_mult_segment'
    | 'defect_rate_add'
    | 'capacity_mult'
    | 'retention_add'
    | 'lead_time_add'
    | 'marketing_pause'
    | 'price_lock'
    | 'price_mult'
    | 'fit_add'
    | 'brand_decay_mult';
  value: number;
  fromDay: number;
  toDay: number | null; // null = indefinite
  cause: string;
  segment?: 'students' | 'creators' | 'professionals' | 'gift';
  meta?: Record<string, unknown>;
}

export interface GameState {
  meta: {
    day: number;
    phase: Phase;
    route: Route | null;
    seed: string;
    mascotName: string;
    /**
     * The player's shop / company name. Chosen when founding the business on
     * the route screen and renameable any time (canvas shop sign, or
     * Business ▸ Operations). Never empty — falls back to DEFAULT_SHOP_NAME.
     */
    shopName: string;
    screen: ScreenId;
    pendingEventId: string | null;
    pendingEvalPhase: Phase | null;
    sidebar: SidebarCategory;
    started: boolean;
    ended: boolean;
    detailModalOpen: boolean;
    /**
     * True while the unified PhaseSequenceModal is active. When true, the
     * standalone EventModal and EvaluationScreen are suppressed because the
     * sequence modal renders those steps inline.
     */
    sequenceActive: boolean;
  };
  player: {
    cash: number;
    debt: number;
    energy: number;
    maxEnergy: number;
    brand: number;
  };
  /**
   * Portfolio of product lines (SKUs). Replaces the legacy single
   * `product` slice. Each line owns its own design, price, target segment,
   * and stock pool. The `activeLineId` is which line the editor canvas
   * and add-on placement panel currently reflect.
   *
   * Phase line caps:
   *   P1 → 2 lines (single global target segment)
   *   P2 → 3 lines (per-line target segments allowed)
   *   P3 → 5 lines (full flexibility)
   */
  portfolio: {
    productLines: ProductLine[];
    activeLineId: string;
  };
  market: {
    /**
     * Global "lead" target segment. In Phase 1 the audience picker writes
     * this AND propagates it to every line (single shared focus). In
     * Phase 2+ the picker still updates the global value but lines can
     * override their own `targetSegment` independently.
     */
    targetSegment: Segment | null;
    retention: Record<Segment, number>;
    /**
     * Per-line, per-segment fit. Recomputed daily from each line's
     * design vs each segment's preference weights.
     * Shape: fitBySegmentByLineId[lineId][segment] = 0..1
     */
    fitBySegmentByLineId: Record<string, Record<Segment, number>>;
  };
  ops: {
    capacity: number;
    hires: number;
    tools: string[];
    process: string[];
    defectRate: number;
  };
  /**
   * AGGREGATE inventory rollup across all product lines. Per-line
   * inventory lives on each `ProductLine.inventory`. These fields are
   * a convenience for HUD and selectors and are recomputed at the end
   * of each tick.
   */
  inventory: {
    totalRaw: number;
    totalFinished: number;
    /** Days where AT LEAST one line stocked out. */
    stockoutDays: number;
    /** Days where AT LEAST one line was overstocked. */
    overstockDays: number;
    /** Sum of all lines' good-output today. */
    productionPerDay: number;
    /** Line ids currently flagged as stocked out (for UI warnings). */
    linesWithStockout: string[];
    /** Line ids currently flagged as overstocked. */
    linesWithOverstock: string[];
  };
  channels: {
    active: ChannelId[];
    marketingPerDay: number;
  };
  upgrades: {
    acquired: string[];
  };
  events: {
    resolved: { id: string; option: 'A' | 'B' | 'C' | 'D'; day: number }[];
  };
  /** Time-windowed effects pushed by event responses + upgrades. */
  activeModifiers: ActiveModifier[];
  /** Pending cash receipts and payments scheduled in the future (AR / AP). */
  cashSchedule: PendingCash[];
  modifiers: Modifier[];
  evaluations: {
    resolved: { phase: Phase; insightCorrect: boolean | null; day: number }[];
  };
  insights: {
    answered: { id: string; correct: boolean }[];
    score: { correct: number; total: number };
  };
  ledger: LedgerEntry[];
  /**
   * Round → the cash balance that round OPENED with. WRITE-ONCE per round.
   *
   * `player.cash` is cash at ROUND start, not cash now, and it moves only at a
   * round boundary. This map is what makes an already-established column
   * immutable: once round 2's opening is recorded it can never be recomputed,
   * so a later event cannot retroactively change what round 1 showed.
   *
   * Round 1's entry is the route's starting capital, written by `setRoute`.
   * Each later entry is the previous round's opening plus that round's
   * server-scored operating profit — safe to bank at the boundary because limbo
   * guarantees the administrator has calculated the round before the next one
   * begins.
   */
  cashOpeningByRound: Record<number, number>;
  history: { day: number; text: string; cause: string }[];
  // Daily snapshot lists for charts
  series: {
    cash: number[];
    revenue: number[];
    profit: number[];
    sold: number[];
    finished: number[];
    raw: number[];
    demand: number[];
    stockout: number[];
    overstock: number[];
  };
  mascot: {
    queue: MascotMessage[];
    current: MascotMessage | null;
    /**
     * Past messages, oldest → newest. The runtime pushes the *current*
     * message onto history before promoting the next from the queue;
     * `prevMascot()` then pops from history to step back. Capped at
     * MASCOT_HISTORY_MAX so it can't grow unbounded.
     */
    history: MascotMessage[];
    /**
     * seqIds (Amelia script keys) the player has already finished or
     * skipped. Persisted across reloads so a script never replays after
     * the player has acknowledged it once. The runtime checks this in
     * `pushMascotSequence` and refuses to enqueue a known script.
     */
    seenScripts: string[];
    mood: MascotMood;
    minimized: boolean;
    /** Floating position relative to viewport (px from top-left). null = use default top-right. */
    position: { x: number; y: number } | null;
  };
  toast: { id: string; kind: BubbleType; text: string; until: number } | null;
  /**
   * Audio preferences. SFX is on by default (cheap, satisfying);
   * music is off by default (player must opt in). Both persist
   * across reloads so the player's choice sticks.
   */
  audio: {
    sfxEnabled: boolean;
    musicEnabled: boolean;
  };
  /**
   * Transient UI-shell state for the wide-canvas simulation. NEVER persisted
   * (reset in `partialize`): which edge-dock drawer is open on each side, the
   * canvas view mode, and tips the player dismissed this session.
   */
  ui: {
    leftDrawer: string | null;
    rightDrawer: string | null;
    viewMode: 'focus' | 'gallery';
    dismissedTips: string[];
  };
  /**
   * V3 (FinLit) company-wide decisions in force this phase — hiring, marketing,
   * and global demand/sell multipliers from key-decision cards. Consumed by the
   * FinLit engine adapter. See docs/V3-FINLIT-PRD.md.
   */
  finlit: {
    demandMult: number;
    sellMult: number;
    /** Key-scenario ids the player has already resolved this run. */
    resolvedScenarios: string[];
  };
  /** Operator-configured global input selections (channels, hiring, budgets, etc.).
   *  Each entry records which item key is selected, the backend input's _id for
   *  server reconciliation, and (for inputs with levels, e.g. hiring) the level
   *  the player chose. */
  globalInputSelections: Array<{
    key: string;
    selectedStepKey: string | null;
    inputId?: string;
    selectedLevel?: number;
  }>;
  /**
   * The full globalInputs schema fetched from the server at boot — what inputs
   * are available, their maxSelections constraints, and their option sets.
   * Transient: never persisted (stripped in partialize), repopulated by
   * GamesimProvider after each successful bootstrap.
   */
  availableGlobalInputs: GlobalInputDto[];
}

const STARTER_LINE_ID = 'line-starter';

/**
 * The one notebook a fresh run opens with. Every identity field — sprite,
 * market, legacy segment gate, spec type and name — is read off the same genre
 * so they can never disagree.
 */
/**
 * The genre a fresh run opens on. Named explicitly rather than taken as
 * `GENRES[0]`, so the catalogue's display order and the starter choice are
 * independent decisions. Falls back to the first genre if an operator's
 * published catalogue somehow lacks this id.
 */
const STARTER_GENRE_ID = 'indie';

/** The starter genre's legacy segment — shared by the line and the market slice. */
const starterSegment = () =>
  segmentForGenre((GENRES.find((g) => g.id === STARTER_GENRE_ID) ?? GENRES[0]).id);

const starterLine = (): ProductLine => {
  const genre = GENRES.find((g) => g.id === STARTER_GENRE_ID) ?? GENRES[0];
  return {
    id: STARTER_LINE_ID,
    name: genre.name,
    archetype: genre.id,
    genre: genre.id,
    cover: 'hardcover', binding: 'ring', size: 'm', paperQuality: 'standard',
    pricePoint: 'balanced',
    price: 14,
    isCustomName: false,
    addOnsByArchetype: { [genre.id]: [] },
    quantityTarget: 25,
    targetSegment: starterSegment(),
    inventory: { raw: 2, finished: 1, stockoutDays: 0, overstockDays: 0, producedToday: 0 },
    finlitSpec: { type: genre.id, paper: 'recycled', size: 'b5', pageDesign: 'blank', addon: 'bookmark', cover: 'plastic' },
    // No `targetPerPhase`. Absent means ZERO on both sides — production is a
    // decision the player has to make, and a new line must not arrive with a
    // build already planned. See `produced` in server/src/sim/calcFinancials.ts.
  };
};

const startingState = (): GameState => ({
  meta: {
    day: 1,
    phase: 1,
    route: null,
    seed: 'amelia-' + Date.now().toString(36),
    mascotName: 'Amelia',
    shopName: DEFAULT_SHOP_NAME,
    screen: 'start',
    pendingEventId: null,
    pendingEvalPhase: null,
    sidebar: 'product',
    started: false,
    ended: false,
    detailModalOpen: false,
    sequenceActive: false,
  },
  player: {
    cash: STARTING_CASH.self,
    debt: 0,
    // V3 energy model — start 50, cap 100 (replenished +30 per phase in
    // advanceFinlitPhase, since V3 bypasses the V2 day-tick's replenish).
    energy: ENERGY_START,
    maxEnergy: ENERGY_CAP,
    brand: 5,
  },
  // Fresh game starts with a SINGLE notebook — the player grows the portfolio
  // deliberately. It carries a V3 market + lean spec so the game is immediately
  // valid (a genre = a target, satisfying the phase-gate).
  //
  // Everything about the starter line derives from ONE genre, because writing
  // these fields independently is what produced the bug this replaces: the line
  // was drawn as `GENRES[0]` (Cute), scored as `'minimalist'`, and labelled
  // "Student" — a name from the retired archetype set. Three identities for one
  // notebook. `startingState` is a factory, so reading GENRES here still picks
  // up an operator's hydrated catalogue rather than freezing the bundle.
  portfolio: {
    productLines: [starterLine()],
    activeLineId: STARTER_LINE_ID,
  },
  market: {
    // Derived from the SAME genre as the starter line, so the global lead
    // segment and the line's own target cannot disagree on the first frame.
    // This was hardcoded to 'professionals' — correct only for the retired
    // "Student → minimalist" starter — while the line targeted students.
    targetSegment: starterSegment(),
    retention: { students: 0, creators: 0, professionals: 0, gift: 0 },
    // Keyed on the line that actually exists. The old map was keyed on
    // 'line-student' / 'line-planner' / 'line-daily', none of which are created
    // any more, so the starter line opened with no fit entry at all. The engine
    // recomputes this every tick; these are just the first-frame values.
    fitBySegmentByLineId: {
      [STARTER_LINE_ID]: { students: 0.55, creators: 0.40, professionals: 0.35, gift: 0.40 },
    },
  },
  ops: {
    capacity: 5,
    hires: 0,
    tools: [],
    process: [],
    defectRate: 0.08,
  },
  inventory: {
    totalRaw: 2,
    totalFinished: 1,
    stockoutDays: 0,
    overstockDays: 0,
    productionPerDay: 0,
    linesWithStockout: [],
    linesWithOverstock: [],
  },
  channels: {
    active: ['word_of_mouth'],
    marketingPerDay: 0,
  },
  upgrades: { acquired: [] },
  events: { resolved: [] },
  activeModifiers: [],
  cashSchedule: [],
  modifiers: [],
  evaluations: { resolved: [] },
  insights: { answered: [], score: { correct: 0, total: 0 } },
  ledger: [],
  // Seeded by `setRoute`, which is where the starting capital is decided.
  cashOpeningByRound: {},
  history: [{ day: 1, text: 'Started a notebook business out of the dorm.', cause: 'start' }],
  series: { cash: [], revenue: [], profit: [], sold: [], finished: [], raw: [], demand: [], stockout: [], overstock: [] },
  mascot: { queue: [], current: null, history: [], seenScripts: [], mood: 'idle', minimized: false, position: null },
  audio: { sfxEnabled: true, musicEnabled: false },
  ui: { leftDrawer: null, rightDrawer: null, viewMode: 'focus', dismissedTips: [] },
  finlit: { demandMult: 1, sellMult: 1, resolvedScenarios: [] },
  globalInputSelections: [],
  availableGlobalInputs: [],
  toast: null,
});

interface Actions {
  reset: () => void;
  setScreen: (s: ScreenId) => void;
  setSidebar: (c: SidebarCategory) => void;
  setRoute: (r: Route) => void;
  // Mascot
  pushMascot: (m: MascotMessage) => void;
  /** Push a multi-message dialogue script as one batch. Filters duplicates by id. */
  pushMascotSequence: (messages: MascotMessage[]) => void;
  /** Advance to the next message; pushes the current onto history. */
  popMascot: () => void;
  /** Step back to the previous message — pulls from history, returns current to queue front. */
  prevMascot: () => void;
  /** Dismiss all queued mascot messages and clear the current one. Used by Skip / Finish. */
  clearMascotQueue: () => void;
  setMood: (m: MascotMood) => void;
  toggleMascotMinimize: () => void;
  setMascotPosition: (p: { x: number; y: number } | null) => void;
  // Audio
  toggleSfx: () => void;
  toggleMusic: () => void;
  // Toast
  showToast: (t: { kind: BubbleType; text: string; ms?: number }) => void;
  clearToast: () => void;
  // Generic mutators (used by mockEngine)
  apply: (mut: (s: GameState) => void) => void;
  // UI shell (wide-canvas docks/drawers/tips) — transient, never persisted.
  openDrawer: (side: 'left' | 'right', id: string) => void;
  closeDrawer: (side: 'left' | 'right') => void;
  toggleDrawer: (side: 'left' | 'right', id: string) => void;
  setViewMode: (m: 'focus' | 'gallery') => void;
  dismissTip: (id: string) => void;
  /** Populate the server's globalInputs schema; called by GamesimProvider after bootstrap. Transient — never persisted. */
  setAvailableGlobalInputs: (inputs: GlobalInputDto[]) => void;
}

export type Store = GameState & Actions;

export const useGame = create<Store>()(
  persist(
    immer((set) => ({
      ...startingState(),
      reset: () => set(() => startingState()),
      setScreen: (s) => set((st) => { st.meta.screen = s; }),
      setSidebar: (c) => set((st) => { st.meta.sidebar = c; }),
      setRoute: (r) =>
        set((st) => {
          st.meta.route = r;
          st.player.cash = STARTING_CASH[r];
          st.player.debt = STARTING_DEBT[r];
          // Round 1 opens on the starting capital. Reset rather than merged —
          // choosing a route is the start of a run, so any openings recorded by
          // a previous run must not survive into it.
          st.cashOpeningByRound = { 1: STARTING_CASH[r] };
        }),
      pushMascot: (m) =>
        set((st) => {
          // Don't queue duplicates by id (current, queued, or already shown).
          const seen =
            st.mascot.current?.id === m.id ||
            st.mascot.queue.some((q) => q.id === m.id) ||
            st.mascot.history.some((h) => h.id === m.id);
          if (!seen) {
            st.mascot.queue.push(m);
            // Sort by priority — but only outside of an active sequence,
            // so script messages stay in order.
            if (!m.seqId) {
              st.mascot.queue.sort((a, b) => a.priority - b.priority);
            }
          }
          if (!st.mascot.current) {
            st.mascot.current = st.mascot.queue.shift() ?? null;
          }
          if (m.mood) st.mascot.mood = m.mood;
        }),
      pushMascotSequence: (messages) =>
        set((st) => {
          // Refuse to push a script the player has already finished or
          // skipped (tracked in seenScripts). Scripts are identified by
          // their seqId — every message in the same script shares one.
          const seqId = messages.find((m) => m.seqId)?.seqId;
          if (seqId && st.mascot.seenScripts.includes(seqId)) return;
          for (const m of messages) {
            const seen =
              st.mascot.current?.id === m.id ||
              st.mascot.queue.some((q) => q.id === m.id) ||
              st.mascot.history.some((h) => h.id === m.id);
            if (!seen) st.mascot.queue.push(m);
          }
          if (!st.mascot.current) {
            st.mascot.current = st.mascot.queue.shift() ?? null;
          }
          const lastMood = messages.find((m) => m.mood)?.mood;
          if (lastMood) st.mascot.mood = lastMood;
        }),
      popMascot: () =>
        set((st) => {
          const done = st.mascot.current;
          // Push current onto history (capped at 20) before advancing.
          if (done) {
            st.mascot.history.push(done);
            if (st.mascot.history.length > 20) st.mascot.history.shift();
          }
          st.mascot.current = st.mascot.queue.shift() ?? null;
          if (st.mascot.current?.mood) st.mascot.mood = st.mascot.current.mood;

          // A script is SEEN once its last message has been advanced past —
          // recorded here, not only in clearMascotQueue. Relying on the clear
          // meant a script that ran to its end through Next was never marked,
          // so it replayed in full on every reload: the Phase 1 debrief came
          // back every single time the player refreshed at phase 2. History is
          // dropped on persist, so nothing else remembers it happened.
          if (done?.seqId && (done.seqIndex ?? 0) + 1 >= (done.seqLen ?? 1)) {
            if (!st.mascot.seenScripts.includes(done.seqId)) {
              st.mascot.seenScripts.push(done.seqId);
            }
          }
        }),
      prevMascot: () =>
        set((st) => {
          // Step back to the previous message. Push the current one
          // back onto the front of the queue so Next can return to it.
          if (st.mascot.history.length === 0) return;
          const prev = st.mascot.history.pop()!;
          if (st.mascot.current) {
            st.mascot.queue.unshift(st.mascot.current);
          }
          st.mascot.current = prev;
          if (prev.mood) st.mascot.mood = prev.mood;
        }),
      clearMascotQueue: () =>
        set((st) => {
          // Mark every seqId currently in flight as seen so it won't
          // re-fire on revisit. Single-message pushes (no seqId) are
          // ignored — those are reactive feedback rules that are
          // already deduped by id-bucketing.
          const inFlight: MascotMessage[] = [
            ...(st.mascot.current ? [st.mascot.current] : []),
            ...st.mascot.queue,
            ...st.mascot.history,
          ];
          for (const m of inFlight) {
            if (m.seqId && !st.mascot.seenScripts.includes(m.seqId)) {
              st.mascot.seenScripts.push(m.seqId);
            }
          }
          st.mascot.queue = [];
          st.mascot.current = null;
          st.mascot.history = [];
        }),
      setMood: (m) => set((st) => { st.mascot.mood = m; }),
      toggleMascotMinimize: () => set((st) => { st.mascot.minimized = !st.mascot.minimized; }),
      setMascotPosition: (p) => set((st) => { st.mascot.position = p; }),
      toggleSfx: () => set((st) => { st.audio.sfxEnabled = !st.audio.sfxEnabled; }),
      toggleMusic: () => set((st) => { st.audio.musicEnabled = !st.audio.musicEnabled; }),
      showToast: (t) =>
        set((st) => {
          st.toast = {
            id: 'tst-' + Math.random().toString(36).slice(2, 8),
            kind: t.kind,
            text: t.text,
            until: Date.now() + (t.ms ?? 2200),
          };
        }),
      clearToast: () => set((st) => { st.toast = null; }),
      apply: (mut) => set((st) => { mut(st); }),
      // Left and right drawers are independent — ProductPage uses backdrop={false}
      // on the left so both can be open at once (design + details side by side).
      openDrawer: (side, id) =>
        set((st) => {
          if (side === 'left') st.ui.leftDrawer = id;
          else st.ui.rightDrawer = id;
        }),
      closeDrawer: (side) =>
        set((st) => {
          if (side === 'left') st.ui.leftDrawer = null;
          else st.ui.rightDrawer = null;
        }),
      toggleDrawer: (side, id) =>
        set((st) => {
          if (side === 'left') st.ui.leftDrawer = st.ui.leftDrawer === id ? null : id;
          else st.ui.rightDrawer = st.ui.rightDrawer === id ? null : id;
        }),
      setViewMode: (m) => set((st) => { st.ui.viewMode = m; }),
      dismissTip: (id) =>
        set((st) => {
          if (!st.ui.dismissedTips.includes(id)) st.ui.dismissedTips.push(id);
        }),
      setAvailableGlobalInputs: (inputs) => set((st) => { st.availableGlobalInputs = inputs; }),
    })),
    {
      name: 'intlabs:sim:state:v1',
      version: 20,
      storage: createJSONStorage(() => localStorage),
      // ── Persistence boundary ────────────────────────────────────────
      // Persist DURABLE game progress (cash, inventory, ledger, lines,
      // upgrades, history, pending events/evals, …) but NEVER persist
      // transient UI/flow flags (`screen`, `sequenceActive`,
      // `detailModalOpen`). Without this, once a player reached
      // `screen: 'simulation'` that value would rehydrate forever —
      // fresh tabs skipped the home/start/route flow entirely.
      //
      // `screen` is forced to 'start' on every persist so the next load
      // always begins at the home screen. The home screen reads
      // `meta.started` to decide whether to show Continue + Start New
      // or just Start business.
      //
      // Pending events / evaluations remain persisted — they're real
      // engine state. If the player closed mid-event, the event modal
      // will re-open as soon as they resume the simulation.
      partialize: (s) =>
        ({
          ...s,
          meta: {
            ...s.meta,
            screen: 'start',
            sequenceActive: false,
            detailModalOpen: false,
          },
          // Wipe transient mascot state on persist, but PRESERVE
          // seenScripts so finished/skipped Amelia scripts don't replay
          // on the next load.
          mascot: { ...s.mascot, queue: [], current: null, history: [] },
          // Music ALWAYS starts off — every load is silent until the
          // player explicitly clicks the Music toggle. SFX preference
          // still persists so a player who muted SFX stays muted.
          audio: { ...s.audio, musicEnabled: false },
          // UI shell is always transient — never rehydrate an open drawer,
          // a gallery view, or dismissed tips across loads.
          ui: { leftDrawer: null, rightDrawer: null, viewMode: 'focus', dismissedTips: [] },
          // Server schema: re-fetched every boot, never stored in localStorage.
          availableGlobalInputs: [],
          toast: null,
        }) as unknown as Store,
      migrate: (persisted: any, fromVersion) => {
        // v1 had product.addOns: AddOnInstance[]. v2 splits per archetype.
        if (fromVersion < 2 && persisted?.product) {
          const old = persisted.product.addOns ?? [];
          const arch = persisted.product.archetype ?? 'student';
          persisted.product.addOnsByArchetype = {
            student: arch === 'student' ? old : [],
            planner: arch === 'planner' ? old : [],
            daily: arch === 'daily' ? old : [],
          };
          delete persisted.product.addOns;
        }
        if (persisted?.mascot && persisted.mascot.position === undefined) {
          persisted.mascot.position = null;
        }
        // v9 introduced mascot.history for Previous-button support.
        if (persisted?.mascot && !Array.isArray(persisted.mascot.history)) {
          persisted.mascot.history = [];
        }
        // v10 introduced seenScripts so Amelia scripts don't replay.
        if (persisted?.mascot && !Array.isArray(persisted.mascot.seenScripts)) {
          persisted.mascot.seenScripts = [];
        }
        // v11 introduced audio preferences (SFX on / music off by default).
        if (persisted && (!persisted.audio || typeof persisted.audio.sfxEnabled !== 'boolean')) {
          persisted.audio = { sfxEnabled: true, musicEnabled: false };
        }
        // Store version 10 introduced meta.shopName. An in-flight save keeps
        // playing under the default name until the player renames it.
        if (persisted?.meta && typeof persisted.meta.shopName !== 'string') {
          persisted.meta.shopName = DEFAULT_SHOP_NAME;
        }
        if (fromVersion < 3) {
          persisted.modifiers = persisted.modifiers ?? [];
        }
        if (fromVersion < 4) {
          persisted.activeModifiers = persisted.activeModifiers ?? [];
          persisted.cashSchedule = persisted.cashSchedule ?? [];
        }
        if (fromVersion < 5 && persisted?.meta) {
          persisted.meta.sequenceActive = false;
        }
        // v6: single-product → portfolio. Convert legacy s.product into
        //     productLines[0]; convert legacy s.inventory into the line's
        //     inventory + a new aggregate rollup; convert market.fitBySegment
        //     into market.fitBySegmentByLineId; ensure each line has the
        //     new fields (quantityTarget, targetSegment).
        if (fromVersion < 6) {
          const oldProduct = persisted?.product;
          const oldInv = persisted?.inventory ?? {};
          const oldFit = persisted?.market?.fitBySegment ?? { students: 0.5, creators: 0.4, professionals: 0.4, gift: 0.4 };
          const oldTarget = persisted?.market?.targetSegment ?? null;

          if (oldProduct) {
            const arch = oldProduct.archetype ?? 'student';
            const archName = arch === 'student' ? 'Student' : arch === 'planner' ? 'Planner' : 'Daily Journal';
            const line = {
              id: 'line-1',
              name: archName,
              isCustomName: false,
              archetype: arch,
              cover: oldProduct.cover ?? 'hardcover',
              binding: oldProduct.binding ?? 'ring',
              size: oldProduct.size ?? 'm',
              paperQuality: oldProduct.paperQuality ?? 'standard',
              pricePoint: oldProduct.pricePoint ?? 'balanced',
              price: oldProduct.price ?? 8,
              addOnsByArchetype: oldProduct.addOnsByArchetype ?? { student: [], planner: [], daily: [] },
              quantityTarget: 30,
              targetSegment: oldTarget as Segment | null,
              inventory: {
                raw: oldInv.raw ?? 5,
                finished: oldInv.finished ?? 0,
                stockoutDays: oldInv.stockoutDays ?? 0,
                overstockDays: oldInv.overstockDays ?? 0,
                producedToday: oldInv.productionPerDay ?? 0,
              },
            };
            persisted.portfolio = { productLines: [line], activeLineId: 'line-1' };
            delete persisted.product;
          } else {
            // No old product to migrate; seed a fresh default line.
            persisted.portfolio = persisted.portfolio ?? {
              productLines: [{
                id: 'line-1',
                name: 'Student',
                isCustomName: false,
                archetype: GENRES[0].id,
                cover: 'hardcover',
                binding: 'ring',
                size: 'm',
                paperQuality: 'standard',
                pricePoint: 'balanced',
                price: 8,
                addOnsByArchetype: { student: [], planner: [], daily: [] },
                quantityTarget: 30,
                targetSegment: null,
                inventory: { raw: 5, finished: 0, stockoutDays: 0, overstockDays: 0, producedToday: 0 },
              }],
              activeLineId: 'line-1',
            };
          }

          // Aggregate inventory rollup
          const lines = persisted.portfolio.productLines;
          persisted.inventory = {
            totalRaw: lines.reduce((s: number, l: any) => s + (l.inventory?.raw ?? 0), 0),
            totalFinished: lines.reduce((s: number, l: any) => s + (l.inventory?.finished ?? 0), 0),
            stockoutDays: oldInv.stockoutDays ?? 0,
            overstockDays: oldInv.overstockDays ?? 0,
            productionPerDay: oldInv.productionPerDay ?? 0,
            linesWithStockout: [],
            linesWithOverstock: [],
          };

          // Per-line fit map seeded from old global fit (best we can do).
          if (persisted.market) {
            persisted.market.fitBySegmentByLineId = {};
            for (const l of lines) {
              persisted.market.fitBySegmentByLineId[l.id] = { ...oldFit };
            }
            delete persisted.market.fitBySegment;
          }
        }
        // v7: AddOnInstance gains free-canvas placement fields (x, y,
        //     scale, rotation, zIndex). Migrate existing instances by
        //     seeding defaults from each add-on's category.
        if (fromVersion < 7) {
          // We can't import data files inside migrate without circulars;
          // the defaults table is defined inline and intentionally
          // identical to data/addOnDefaults.ts.
          const DEFAULTS: Record<string, { x: number; y: number; scale: number; zIndex: number }> = {
            integrated_charm:        { x: 0.78, y: 0.18, scale: 0.18, zIndex: 5 },
            integrated_ribbon:       { x: 0.78, y: 0.78, scale: 0.22, zIndex: 4 },
            integrated_sticker_name: { x: 0.50, y: 0.42, scale: 0.30, zIndex: 6 },
            integrated_sticker_pack: { x: 0.40, y: 0.62, scale: 0.26, zIndex: 5 },
            decorative_washi:        { x: 0.50, y: 0.15, scale: 0.40, zIndex: 4 },
            decorative_pattern:      { x: 0.50, y: 0.50, scale: 0.50, zIndex: 2 },
            decorative_bundle:       { x: 0.30, y: 0.70, scale: 0.24, zIndex: 4 },
            functional_bookmark:     { x: 0.88, y: 0.42, scale: 0.16, zIndex: 5 },
            functional_band:         { x: 0.92, y: 0.50, scale: 0.10, zIndex: 6 },
            functional_closure:      { x: 0.90, y: 0.55, scale: 0.14, zIndex: 6 },
            functional_clip:         { x: 0.30, y: 0.10, scale: 0.14, zIndex: 7 },
            writing_tool:            { x: 0.95, y: 0.55, scale: 0.18, zIndex: 7 },
          };
          const FALLBACK = { x: 0.5, y: 0.5, scale: 0.25, zIndex: 5 };
          // Hoist resolution because addOns data isn't imported here either.
          // We can't recover category from defId without that import, so
          // we fall back to FALLBACK for any instance whose category we
          // can't identify by id-prefix. Mostly the FALLBACK will get used,
          // but that's acceptable — players will reposition the very few
          // pre-existing add-ons.
          const lines = persisted?.portfolio?.productLines ?? [];
          for (const line of lines) {
            const arches = line.addOnsByArchetype ?? {};
            for (const arch of Object.keys(arches)) {
              const list = arches[arch] ?? [];
              for (const inst of list) {
                if (inst.x !== undefined) continue; // already migrated
                const place = DEFAULTS[inst.defId] ?? FALLBACK;
                inst.x = place.x;
                inst.y = place.y;
                inst.scale = place.scale;
                inst.rotation = 0;
                inst.zIndex = place.zIndex;
              }
            }
          }
        }
        // v8: notebook lines gain `isCustomName`. Legacy lines named
        //     "Line 1", "Line 2", … or empty become archetype-based
        //     defaults ("Student", "Planner", "Daily Journal", "Student-2"…).
        if (fromVersion < 8) {
          const ARCHETYPE_LABEL: Record<string, string> = {
            student: 'Student',
            planner: 'Planner',
            daily: 'Daily Journal',
          };
          const lines = persisted?.portfolio?.productLines ?? [];
          // Track which default names have been claimed so duplicates
          // get -2, -3, … suffixes deterministically.
          const claimed = new Set<string>();
          // First pass: keep custom-looking names (anything that isn't
          // "Line N" or empty).
          for (const line of lines) {
            const looksLegacy = !line.name || /^line\s+\d+$/i.test(String(line.name).trim());
            if (looksLegacy) continue;
            line.isCustomName = line.isCustomName ?? true;
            claimed.add(line.name);
          }
          // Second pass: rewrite legacy names from archetype defaults.
          for (const line of lines) {
            const looksLegacy = !line.name || /^line\s+\d+$/i.test(String(line.name).trim());
            if (!looksLegacy) continue;
            const base = ARCHETYPE_LABEL[line.archetype] ?? 'Student';
            let candidate = base;
            let n = 2;
            while (claimed.has(candidate)) { candidate = `${base}-${n}`; n++; }
            line.name = candidate;
            line.isCustomName = false;
            claimed.add(candidate);
          }
          // Ensure the field exists everywhere even if name was custom.
          for (const line of lines) {
            if (line.isCustomName === undefined) line.isCustomName = false;
          }
        }
        // v9: fixed marketing-team preset → Marketing/Sales budget sliders.
        if (persisted?.finlit) {
          if (typeof persisted.finlit.marketingBudget !== 'number') persisted.finlit.marketingBudget = 0;
          if (typeof persisted.finlit.salesBudget !== 'number') persisted.finlit.salesBudget = 0;
          delete persisted.finlit.marketing;
        }

        // ── v11: the V2 archetype axis is gone; a notebook IS its market ──
        //
        // Saves written before this hold archetype ids ('student' | 'planner' |
        // 'daily') that no longer exist in the catalogue. `genreById` THROWS on
        // an unknown id, so leaving one in a line would crash the run on load.
        // Every line is rewritten to the genre it already carried, and the
        // per-notebook add-on lists are re-keyed to match.
        if (fromVersion < 11 && Array.isArray(persisted?.portfolio?.productLines)) {
          const LEGACY_TO_GENRE: Record<string, string> = {
            student: 'minimalist', planner: 'indie', daily: 'cute',
          };
          const known = new Set(GENRES.map((g) => g.id));
          const fallback = GENRES[0]?.id ?? 'cute';

          for (const line of persisted.portfolio.productLines) {
            // The line's own genre wins when it is still valid — it was always
            // the real identity. Otherwise map the retired archetype, and fall
            // back to a notebook that definitely exists.
            const next =
              (known.has(line.genre) && line.genre) ||
              LEGACY_TO_GENRE[line.archetype] ||
              (known.has(line.archetype) && line.archetype) ||
              fallback;

            const oldKey = line.archetype;
            line.archetype = next;
            line.genre = next;
            if (line.finlitSpec && typeof line.finlitSpec === 'object') line.finlitSpec.type = next;

            // Rename auto-named lines too, or a save shows a "Student" that is
            // now a Minimalist Notebook — the exact confusion this removes. A
            // player's own name is theirs and is left alone.
            if (!line.isCustomName) {
              const label = GENRES.find((g) => g.id === next)?.name ?? next;
              const taken = new Set(
                persisted.portfolio.productLines.filter((l: any) => l !== line).map((l: any) => l.name),
              );
              let candidate = label;
              let n = 2;
              while (taken.has(candidate)) candidate = `${label}-${n++}`;
              line.name = candidate;
            }

            // Carry the decoration across to the new key so switching notebooks
            // does not silently wipe what the player placed.
            const lists = line.addOnsByArchetype;
            if (lists && typeof lists === 'object') {
              if (oldKey !== next && Array.isArray(lists[oldKey])) {
                lists[next] = lists[oldKey];
                delete lists[oldKey];
              }
              for (const k of Object.keys(lists)) {
                if (!known.has(k)) delete lists[k];
              }
              if (!Array.isArray(lists[next])) lists[next] = [];
            } else {
              line.addOnsByArchetype = { [next]: [] };
            }
          }
        }
        // ── v12: heal names left behind by an earlier v11 ──
        //
        // The first cut of the v11 migration remapped ids but not names, so a
        // save converted by it still shows "Student" on a Minimalist Notebook.
        // This runs on every load below v12 and only touches auto-named lines
        // whose name is exactly a retired archetype label, so a player's own
        // name and any already-correct name are both left alone.
        if (fromVersion < 13) {
          persisted.globalInputSelections = [];
          if (persisted.finlit) {
            delete persisted.finlit.hire;
            delete persisted.finlit.marketingBudget;
            delete persisted.finlit.salesBudget;
          }
          if (Array.isArray(persisted.portfolio?.productLines)) {
            for (const line of persisted.portfolio.productLines) {
              delete line.channels;
            }
          }
        }
        // v14: globalInputSelections gains inputId and selectedLevel fields.
        // Reset the array so stale entries without these fields don't persist —
        // the player re-makes selections on the next session (same as v13 did).
        if (fromVersion < 14) {
          persisted.globalInputSelections = [];
        }
        // v15: `selectedStepKey` MEANING changed. It used to hold whatever id the
        // frontend had invented (a candidate id, a ChannelId); it now holds a key
        // of the backend item's own `options` map, which is what the server looks
        // up. A pre-v15 selection would resolve to quantity 0 there and have
        // every one of its impacts silently discarded, so the array is reset and
        // the player re-makes selections — same approach as v13 and v14.
        if (fromVersion < 15) {
          persisted.globalInputSelections = [];
        }
        // v16: `ProductLine.vendor` removed. Vendors are a company-wide
        // globalInput selection, so the per-line field is dropped rather than
        // migrated — there is nowhere on a line for it to go. Stripped from old
        // saves so the shape matches the type and nothing reads a ghost field.
        if (fromVersion < 16 && Array.isArray(persisted?.portfolio?.productLines)) {
          for (const line of persisted.portfolio.productLines) {
            delete line.vendor;
          }
        }
        // v17: `targetPerDay` is DROPPED, not converted. It was units/day for the
        // local day-tick throttle — never submitted, never part of any server
        // figure — and it was tuned against a capacity model that no longer
        // bounds production. Carrying it over would preserve a stale plan and
        // shadow the new default (half the server's capacity), so the field just
        // goes.
        if (fromVersion < 17 && Array.isArray(persisted?.portfolio?.productLines)) {
          for (const line of persisted.portfolio.productLines) {
            delete line.targetPerDay;
          }
        }
        // v18: `demandEstPerPhase` removed. The produce target IS the player's
        // demand estimate, so a second field asked the same question twice —
        // and every comparison between them was the player against themselves.
        // Dropped rather than merged into `targetPerPhase`: an old estimate is
        // not a production decision, and the default (half capacity) is the
        // honest starting point.
        if (fromVersion < 18 && Array.isArray(persisted?.portfolio?.productLines)) {
          for (const line of persisted.portfolio.productLines) {
            delete line.demandEstPerPhase;
          }
        }
        // v20: `cashOpeningByRound` added.
        //
        // Back-filled as `{ 1: player.cash }`, which is a GUESS and worth
        // naming as one: an existing save's `player.cash` has already had local
        // engine profit banked into it, so it is that save's CURRENT balance,
        // not what round 1 opened with. There is no way to recover the true
        // opening from the persisted state — the ledger held only local
        // aggregate rows and cash was never snapshotted. A mid-run save
        // therefore shows round 1 opening at today's balance; a fresh run is
        // exact, because `setRoute` writes the real figure.
        if (fromVersion < 20 && persisted && !persisted.cashOpeningByRound) {
          persisted.cashOpeningByRound = { 1: persisted.player?.cash ?? 0 };
        }
        // v19: LedgerEntry.day → LedgerEntry.roundNumber. Stored entries were
        // stamped with the day the phase ENDED (30/60/90), so the round is that
        // day divided by the phase length — not the raw day. An entry with no
        // usable day falls back to round 1 rather than to `undefined`, which the
        // P&L would bucket under a phantom column.
        if (fromVersion < 19 && Array.isArray(persisted?.ledger)) {
          for (const e of persisted.ledger) {
            if (e.roundNumber === undefined) {
              const day = Number(e.day);
              e.roundNumber = Number.isFinite(day) && day > 0 ? Math.ceil(day / DAYS_PER_PHASE) : 1;
            }
            delete e.day;
          }
        }
        if (fromVersion < 12 && Array.isArray(persisted?.portfolio?.productLines)) {
          const RETIRED_LABELS = new Set(['Student', 'Planner', 'Daily Journal']);
          for (const line of persisted.portfolio.productLines) {
            if (line.isCustomName) continue;
            const base = String(line.name ?? '').replace(/-\d+$/, '');
            if (!RETIRED_LABELS.has(base)) continue;
            const label = GENRES.find((g) => g.id === line.archetype)?.name;
            if (!label) continue;
            const taken = new Set(
              persisted.portfolio.productLines.filter((l: any) => l !== line).map((l: any) => l.name),
            );
            let candidate = label;
            let n = 2;
            while (taken.has(candidate)) candidate = `${label}-${n++}`;
            line.name = candidate;
          }
        }
        return persisted as Store;
      },
    },
  ),
);
