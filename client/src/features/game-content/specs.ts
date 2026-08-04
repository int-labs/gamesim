import type { FieldSpec, NestedSpec } from "@/components/app/catalog-editor";

/**
 * Field specs for every PlayerConfig section.
 *
 * These mirror the player's own TypeScript types (see the master plan §1) so
 * what an operator edits here maps 1:1 onto what the game reads. Help text
 * carries the meaning of each number — an operator shouldn't have to open the
 * source to know what `rate` or `split` does.
 */

export type SectionRender = "table" | "cards" | "production" | "constants" | "copy" | "images";

export type SectionSpec = {
  key: string;
  label: string;
  group: "Economy" | "Catalog" | "Story" | "Presentation";
  description: string;
  render: SectionRender;
  fields?: FieldSpec[];
  headerFields?: FieldSpec[];
  bodyFields?: FieldSpec[];
  nested?: NestedSpec[];
  newRow?: () => any;
  titleKey?: string;
};

const ID: FieldSpec = { key: "id", label: "ID", mono: true, width: "w-40", help: "stable key" };
const NAME: FieldSpec = { key: "name", label: "Name", width: "w-56" };

const num = (key: string, label: string, help?: string, extra: Partial<FieldSpec> = {}): FieldSpec => ({
  key,
  label,
  type: "number",
  width: "w-28",
  help,
  ...extra,
});

const CHANNEL_OPTS = [
  { value: "offline", label: "Offline" },
  { value: "online", label: "Online" },
  { value: "retail", label: "Retail" },
];

const PHASE_OPTS = [
  { value: "1", label: "Phase 1" },
  { value: "2", label: "Phase 2" },
  { value: "3", label: "Phase 3" },
];

const LETTER_OPTS = ["A", "B", "C", "D"].map((v) => ({ value: v, label: v }));

const ADDON_SLOT_OPTS = [
  "corner-tl",
  "corner-tr",
  "corner-bl",
  "corner-br",
  "center-label",
  "cover-band-v",
  "cover-band-h",
  "edge-right",
  "bundle",
].map((v) => ({ value: v, label: v }));

const ADDON_CATEGORY_OPTS = [
  "integrated_charm",
  "integrated_ribbon",
  "integrated_sticker_name",
  "integrated_sticker_pack",
  "decorative_washi",
  "decorative_pattern",
  "decorative_bundle",
  "functional_bookmark",
  "functional_band",
  "functional_closure",
  "functional_clip",
  "writing_tool",
].map((v) => ({ value: v, label: v.replace(/_/g, " ") }));

const UPGRADE_CATEGORY_OPTS = [
  "hire",
  "tool",
  "process",
  "supplier",
  "channel",
  "marketing",
  "finance",
].map((v) => ({ value: v, label: v }));

/** Production axis rows — the same four columns for all six axes. */
export const PRODUCTION_AXIS_FIELDS: FieldSpec[] = [
  ID,
  NAME,
  num("rate", "Rate", "multiplicative production factor (<1)", { step: 0.001 }),
  num("cost", "Cost / unit", "$ added to unit cost", { step: 0.01 }),
];

export const PRODUCTION_AXES: { key: string; label: string; help: string }[] = [
  { key: "type", label: "Type", help: "One per genre; identical economics in the source sheet." },
  { key: "paper", label: "Paper", help: "Cream, fountain-pen, recycled, black." },
  { key: "size", label: "Size", help: "A5 / B4 / B5." },
  { key: "pageDesign", label: "Page design", help: "Lined, grid, storyboarding, blank, numbered." },
  { key: "addon", label: "Binding add-on", help: "Spiral, sewn, pen holder, bookmark, corners, charms." },
  { key: "cover", label: "Cover", help: "Hard, plastic, holographic." },
];

export const SECTIONS: SectionSpec[] = [
  /* ───────────────────────────── Economy ───────────────────────────── */
  {
    key: "genres",
    label: "Genres",
    group: "Economy",
    description:
      "The four markets. Demand is the total addressable units per phase; VoC weights say how much that market cares about each decision axis.",
    render: "cards",
    titleKey: "name",
    headerFields: [ID, NAME],
    bodyFields: [
      { key: "blurb", label: "Blurb", type: "textarea", wide: true },
      num("demand.pMinus1", "Demand P−1"),
      num("demand.p0", "Demand P0"),
      num("demand.p1", "Demand P1"),
      num("demand.p2", "Demand P2"),
      num("demand.p3", "Demand P3"),
      num("voc.design", "VoC design", "0–1", { step: 0.01, min: 0, max: 1 }),
      num("voc.price", "VoC price", "0–1", { step: 0.01, min: 0, max: 1 }),
      num("voc.channel", "VoC channel", "0–1", { step: 0.01, min: 0, max: 1 }),
      num("voc.size", "VoC size", "0–1", { step: 0.01, min: 0, max: 1 }),
      num("voc.paper", "VoC paper", "0–1", { step: 0.01, min: 0, max: 1 }),
      { key: "imagePath", label: "Image key", mono: true, help: "key into the player asset map" },
    ],
    newRow: () => ({
      id: "",
      name: "",
      blurb: "",
      demand: { pMinus1: 0, p0: 0, p1: 0, p2: 0, p3: 0 },
      voc: { design: 0.5, price: 0.5, channel: 0.5, size: 0.5, paper: 0.5 },
      imageAssetId: null,
      imagePath: null,
    }),
  },
  {
    key: "productionOptions",
    label: "Production",
    group: "Economy",
    description:
      "The six axes a notebook is built from. Production per day multiplies every chosen option's rate; unit cost sums their costs.",
    render: "production",
  },
  {
    key: "channelMeta",
    label: "Channel names",
    group: "Economy",
    description: "Display names for the three sales channels.",
    render: "table",
    fields: [
      { key: "id", label: "Channel", type: "select", options: CHANNEL_OPTS, width: "w-40" },
      NAME,
      { key: "blurb", label: "Blurb" },
    ],
    newRow: () => ({ id: "offline", name: "", blurb: "" }),
  },
  {
    key: "channelsByGenre",
    label: "Channel economics",
    group: "Economy",
    description:
      "Per genre, how demand splits across channels and what each costs. Splits should total ~1 per genre.",
    render: "cards",
    titleKey: "genreId",
    headerFields: [{ key: "genreId", label: "Genre ID", mono: true, width: "w-40" }],
    nested: [
      {
        key: "rows",
        label: "Rows",
        fields: [
          { key: "channel", label: "Channel", type: "select", options: CHANNEL_OPTS, width: "w-36" },
          num("split", "Split", "share of demand", { step: 0.01, min: 0, max: 1 }),
          num("maintenance", "Maintenance", "$/day", { step: 0.1 }),
          num("consignment", "Consignment", "fee", { step: 0.1 }),
          num("inventoryCost", "Inventory", "$", { step: 0.1 }),
          num("sellRate", "Sell rate", "base conversion", { step: 0.001, min: 0, max: 1 }),
        ],
        newRow: () => ({
          channel: "offline",
          split: 0,
          maintenance: 0,
          consignment: 0,
          inventoryCost: 0,
          sellRate: 0,
        }),
      },
    ],
    newRow: () => ({ genreId: "", rows: [] }),
  },
  {
    key: "vendors",
    label: "Vendors",
    group: "Economy",
    description:
      "Stockists. Each covers some genres per level — quality “none” means that vendor deliberately doesn't stock that genre.",
    render: "cards",
    titleKey: "name",
    headerFields: [ID, NAME],
    bodyFields: [
      { key: "blurb", label: "Blurb", type: "textarea", wide: true },
      num("energyByLevel.l1", "Energy L1"),
      num("energyByLevel.l2", "Energy L2"),
    ],
    nested: [
      {
        key: "coverage",
        label: "Coverage",
        fields: [
          num("level", "Level", "1 or 2", { width: "w-20" }),
          { key: "genreId", label: "Genre", mono: true, width: "w-32" },
          num("cost", "Cost"),
          {
            key: "quality",
            label: "Quality",
            type: "select",
            width: "w-32",
            options: ["perfect", "good", "average", "none"].map((v) => ({ value: v, label: v })),
          },
          num("sellBonus", "Sell bonus", undefined, { step: 0.001 }),
          num("prodBonus", "Prod bonus", undefined, { step: 0.001 }),
        ],
        newRow: () => ({
          level: 1,
          genreId: "",
          cost: 0,
          quality: "none",
          sellBonus: 0,
          prodBonus: 0,
        }),
      },
    ],
    newRow: () => ({
      id: "",
      name: "",
      blurb: null,
      energyByLevel: { l1: 8, l2: 18 },
      coverage: [],
      imageAssetId: null,
      imagePath: null,
    }),
  },
  {
    key: "hiringCandidates",
    label: "Hiring",
    group: "Economy",
    description:
      "Candidates and their levels. Production bonus adds to units/day; sell bonus adds to the channel conversion rate.",
    render: "cards",
    titleKey: "name",
    headerFields: [ID, NAME],
    bodyFields: [{ key: "blurb", label: "Blurb", type: "textarea", wide: true }],
    nested: [
      {
        key: "levels",
        label: "Levels",
        fields: [
          num("level", "Level", "1–4", { width: "w-20" }),
          num("prodBonus", "Prod bonus", undefined, { step: 0.001 }),
          num("sellBonus", "Sell bonus", undefined, { step: 0.001 }),
          num("cost", "Cost"),
          num("energy", "Energy"),
        ],
        newRow: () => ({ level: 1, prodBonus: 0, sellBonus: 0, cost: 0, energy: 0 }),
      },
    ],
    newRow: () => ({ id: "", name: "", blurb: "", levels: [], imageAssetId: null, imagePath: null }),
  },
  {
    key: "marketingTeams",
    label: "Marketing",
    group: "Economy",
    description: "Preset marketing options — a daily cost and energy for a sell-rate lift.",
    render: "table",
    fields: [
      ID,
      NAME,
      { key: "blurb", label: "Blurb" },
      num("cost", "Cost / day"),
      num("sellBonus", "Sell bonus", undefined, { step: 0.001 }),
      num("energy", "Energy"),
    ],
    newRow: () => ({ id: "", name: "", blurb: "", cost: 0, sellBonus: 0, energy: 0 }),
  },
  {
    key: "constants",
    label: "Constants",
    group: "Economy",
    description:
      "Engine tunables. Only whitelisted keys are accepted — an unknown key is rejected rather than silently stored.",
    render: "constants",
  },

  /* ───────────────────────────── Catalog ───────────────────────────── */
  {
    key: "addOns",
    label: "Add-ons",
    group: "Catalog",
    description:
      "Cover decorations. Slot decides where the art anchors on the notebook; segment boost lifts appeal for that audience.",
    render: "cards",
    titleKey: "name",
    headerFields: [ID, NAME],
    bodyFields: [
      { key: "category", label: "Category", type: "select", options: ADDON_CATEGORY_OPTS },
      { key: "slot", label: "Slot", type: "select", options: ADDON_SLOT_OPTS },
      num("costPerUnit", "Cost / unit", "adds to COGS", { step: 0.05 }),
      num("perceivedValue", "Perceived value", "0–1 price-ceiling lift", { step: 0.01, min: 0, max: 1 }),
      { key: "active", label: "Active", type: "switch" },
      { key: "description", label: "Description", type: "textarea", wide: true },
      { key: "segmentBoost", label: "Segment boost", type: "numberMap", wide: true, help: "segment → 0–1" },
      { key: "imagePath", label: "Image key", mono: true },
      { key: "thumbPath", label: "Thumb key", mono: true },
    ],
    newRow: () => ({
      id: "",
      name: "",
      category: "integrated_charm",
      slot: "corner-tr",
      costPerUnit: 0,
      perceivedValue: 0,
      segmentBoost: {},
      description: "",
      active: true,
      imageAssetId: null,
      imagePath: null,
      thumbAssetId: null,
      thumbPath: null,
    }),
  },
  {
    key: "addOnCategories",
    label: "Add-on categories",
    group: "Catalog",
    description: "Categories add-ons can belong to. The player groups the picker by these.",
    render: "table",
    fields: [
      ID,
      NAME,
      {
        key: "group",
        label: "Group",
        type: "select",
        width: "w-44",
        options: ["integrated", "decorative", "functional", "writing"].map((v) => ({
          value: v,
          label: v,
        })),
      },
    ],
    newRow: () => ({ id: "", name: "", group: "decorative" }),
  },
  {
    key: "segments",
    label: "Segments",
    group: "Catalog",
    description:
      "Audiences in the V2 model. Preference weights say what each audience values; price sensitivity scales the price penalty.",
    render: "cards",
    titleKey: "name",
    headerFields: [ID, NAME],
    bodyFields: [
      { key: "description", label: "Description", type: "textarea", wide: true },
      num("baseDemand", "Base demand"),
      num("priceSensitivity", "Price sensitivity", "higher = more sensitive", { step: 0.1 }),
      num("preferredPriceRef", "Preferred price", "$", { step: 0.5 }),
      num("preference.paperQuality", "Pref: paper", "0–1", { step: 0.05, min: 0, max: 1 }),
      num("preference.coverPremium", "Pref: cover", "0–1", { step: 0.05, min: 0, max: 1 }),
      num("preference.decorative", "Pref: decorative", "0–1", { step: 0.05, min: 0, max: 1 }),
      num("preference.functional", "Pref: functional", "0–1", { step: 0.05, min: 0, max: 1 }),
      num("preference.packaging", "Pref: packaging", "0–1", { step: 0.05, min: 0, max: 1 }),
      { key: "imagePath", label: "Image key", mono: true },
    ],
    newRow: () => ({
      id: "",
      name: "",
      description: "",
      baseDemand: 0,
      priceSensitivity: 1,
      preferredPriceRef: 10,
      preference: {
        paperQuality: 0.5,
        coverPremium: 0.5,
        decorative: 0.5,
        functional: 0.5,
        packaging: 0.5,
      },
      imageAssetId: null,
      imagePath: null,
    }),
  },
  {
    key: "channelsV2",
    label: "Channels (V2)",
    group: "Catalog",
    description: "The older channel model — reach multiplier, unlock costs and per-segment affinity.",
    render: "cards",
    titleKey: "name",
    headerFields: [ID, NAME],
    bodyFields: [
      { key: "description", label: "Description", type: "textarea", wide: true },
      num("reach", "Reach", "demand multiplier", { step: 0.1 }),
      num("dailyCost", "Daily cost"),
      num("unlockEnergy", "Unlock energy"),
      num("unlockCash", "Unlock cash"),
      { key: "segmentAffinity", label: "Segment affinity", type: "numberMap", wide: true },
      { key: "imagePath", label: "Image key", mono: true },
    ],
    newRow: () => ({
      id: "",
      name: "",
      description: "",
      reach: 1,
      dailyCost: 0,
      unlockEnergy: 0,
      unlockCash: 0,
      segmentAffinity: {},
      imageAssetId: null,
      imagePath: null,
    }),
  },
  {
    key: "upgrades",
    label: "Upgrades",
    group: "Catalog",
    description:
      "The upgrade ladder. Prerequisites must name real upgrade IDs. Cash cost can be negative — a loan pays the player.",
    render: "cards",
    titleKey: "name",
    headerFields: [ID, NAME],
    bodyFields: [
      { key: "category", label: "Category", type: "select", options: UPGRADE_CATEGORY_OPTS },
      num("costs.time", "Time"),
      num("costs.energy", "Energy"),
      num("costs.cash", "Cash", "negative = pays the player"),
      num("unlockDay", "Unlock day"),
      { key: "description", label: "Description", type: "textarea", wide: true },
      { key: "requires", label: "Requires", type: "stringList", help: "upgrade IDs" },
      { key: "effects", label: "Effects", type: "stringList" },
    ],
    newRow: () => ({
      id: "",
      name: "",
      category: "tool",
      description: "",
      costs: { time: 0, energy: 0, cash: 0 },
      unlockDay: null,
      requires: [],
      effects: [],
      imageAssetId: null,
      imagePath: null,
    }),
  },
  {
    key: "archetypes",
    label: "Archetypes",
    group: "Catalog",
    // The player derives every archetype from its genre on each read, so this
    // section can be published but never takes effect. Say so here rather than
    // letting an operator retype a title that will not move.
    description:
      "Read-only — the player builds these from Genres on the fly. To change an archetype's title or copy, edit the matching genre; the hydration report lists this section as skipped.",
    render: "cards",
    titleKey: "title",
    headerFields: [ID, { key: "title", label: "Title", width: "w-56" }],
    bodyFields: [
      { key: "tagline", label: "Tagline", wide: true },
      { key: "description", label: "Description", type: "textarea", wide: true },
      { key: "bestFor", label: "Best for", type: "stringList", help: "segment IDs" },
      { key: "strengths", label: "Strengths", type: "stringList" },
      { key: "tradeoffs", label: "Trade-offs", type: "stringList" },
      { key: "costNote", label: "Cost note", type: "textarea", wide: true },
      { key: "productionNote", label: "Production note", type: "textarea", wide: true },
      { key: "whyChoose", label: "Why choose", type: "textarea", wide: true },
    ],
    newRow: () => ({
      id: "",
      title: "",
      tagline: "",
      description: "",
      bestFor: [],
      strengths: [],
      tradeoffs: [],
      costNote: "",
      productionNote: "",
      whyChoose: "",
      imageAssetId: null,
      imagePath: null,
    }),
  },

  /* ────────────────────────────── Story ────────────────────────────── */
  {
    key: "scenarios",
    label: "Key scenarios",
    group: "Story",
    description:
      "Phase-level decisions. Multipliers apply to the coming phase — leave blank for no effect.",
    render: "cards",
    titleKey: "title",
    headerFields: [
      ID,
      { key: "phase", label: "Phase", type: "select", options: PHASE_OPTS, width: "w-32" },
      { key: "title", label: "Title", width: "w-64" },
    ],
    bodyFields: [{ key: "body", label: "Body", type: "textarea", wide: true }],
    nested: [
      {
        key: "options",
        label: "Options",
        fields: [
          { key: "id", label: "#", type: "select", options: LETTER_OPTS, width: "w-20" },
          { key: "label", label: "Label", width: "w-48" },
          { key: "detail", label: "Detail" },
          num("energy", "Energy"),
          num("demandMult", "Demand ×", undefined, { step: 0.01 }),
          num("sellMult", "Sell ×", undefined, { step: 0.01 }),
          num("cashNow", "Cash now"),
        ],
        newRow: () => ({
          id: "A",
          label: "",
          detail: "",
          energy: 0,
          demandMult: null,
          sellMult: null,
          cashNow: null,
        }),
      },
    ],
    newRow: () => ({
      id: "",
      phase: 1,
      title: "",
      body: "",
      options: [],
      imageAssetId: null,
      imagePath: null,
    }),
  },
  {
    key: "events",
    label: "Events",
    group: "Story",
    description: "Day-triggered events in the V2 layer, each with a set of responses.",
    render: "cards",
    titleKey: "title",
    headerFields: [ID, num("day", "Day"), { key: "title", label: "Title", width: "w-64" }],
    bodyFields: [
      { key: "body", label: "Body", type: "textarea", wide: true },
      { key: "mascotMood", label: "Mascot mood" },
    ],
    nested: [
      {
        key: "options",
        label: "Options",
        fields: [
          { key: "id", label: "#", type: "select", options: LETTER_OPTS, width: "w-20" },
          { key: "label", label: "Label", width: "w-48" },
          { key: "description", label: "Description" },
          num("cost.energy", "Energy"),
          num("cost.cash", "Cash"),
          { key: "effects", label: "Effects", type: "stringList" },
          { key: "modifierIds", label: "Modifier IDs", type: "stringList" },
        ],
        newRow: () => ({
          id: "A",
          label: "",
          description: "",
          cost: { energy: 0, cash: null },
          effects: [],
          modifierIds: [],
        }),
      },
    ],
    newRow: () => ({
      id: "",
      day: 1,
      title: "",
      body: "",
      mascotMood: "neutral",
      options: [],
      imageAssetId: null,
      imagePath: null,
    }),
  },
  {
    key: "insights",
    label: "Insight checks",
    group: "Story",
    description: "The end-of-phase question. At least one option must be marked correct.",
    render: "cards",
    titleKey: "question",
    headerFields: [
      ID,
      { key: "phase", label: "Phase", type: "select", options: PHASE_OPTS, width: "w-32" },
    ],
    bodyFields: [{ key: "question", label: "Question", type: "textarea", wide: true }],
    nested: [
      {
        key: "options",
        label: "Options",
        fields: [
          { key: "id", label: "#", type: "select", options: LETTER_OPTS, width: "w-20" },
          { key: "text", label: "Text" },
          { key: "correct", label: "Correct", type: "switch", width: "w-24" },
        ],
        newRow: () => ({ id: "A", text: "", correct: false }),
      },
    ],
    newRow: () => ({ id: "", phase: 1, question: "", options: [] }),
  },

  /* ─────────────────────────── Presentation ────────────────────────── */
  {
    key: "copy",
    label: "Copy",
    group: "Presentation",
    description:
      "Player-facing strings, keyed by namespace. Anything not overridden here falls back to the text bundled with the player.",
    render: "copy",
  },
  {
    key: "images",
    label: "Images",
    group: "Presentation",
    description:
      "Art slots. Point a slot at an uploaded Image Asset to replace the bundled sprite.",
    render: "images",
  },
];

export const SECTION_BY_KEY = Object.fromEntries(SECTIONS.map((s) => [s.key, s]));
export const SECTION_GROUPS = ["Economy", "Catalog", "Story", "Presentation"] as const;
