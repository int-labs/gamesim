import { useState } from 'react';
import { useGame, DEFAULT_SHOP_NAME, MAX_SHOP_NAME } from '@/state/store';
import {
  engageFinlitHire, clearFinlitHire, engageFinlitVendor, clearFinlitVendor,
  setFinlitMarketingBudget, setFinlitSalesBudget,
  finlitCompanyChannels, toggleFinlitChannelAll, setShopName,
} from '@/engine/mockEngine';
import {
  BUDGET_LEVER_ENERGY,
  CHANNEL_META, channelRow,
  type GenreId, type ChannelId,
} from '@/data/finlit';
import { hireSteps, hireStep, CANDIDATE_IMAGE } from '@/engine/finlit/core/config/hiring';
import {
  vendorStep, vendorQuality, vendorCoversProduct, VENDOR_IMAGE,
} from '@/engine/finlit/core/config/vendors';
import type { GlobalInputItemDto } from '@/gamesim/types';
import { impactFor } from '@/gamesim/impacts';
import { fmt$ } from '@/utils/format';
import type { ServerProjectionResult } from '@/gamesim/sync';
import { DAYS_PER_PHASE } from '@/engine/config';
import { playSfx } from '@/audio/audioManager';
import { PixelModal } from '@/components/primitives/PixelModal';
import { CostTiles, ImpactList, type CostTile } from '@/components/primitives/CostTiles';
import { PixelButton } from '@/components/primitives';
import { SafeImage } from '@/components/primitives/SafeImage';
import { A } from '@/assets';
import { studyFor, type CaseStudy } from '@/content/finlitCaseStudies';
import { OpsSection, StatChip, OperationsDetailModal } from './OperationsKit';
import { channelDetail, budgetDetail, hiringDetail, vendorDetail, type SectionDetail } from './operationsDetails';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { EnergyValue } from '@/components/primitives/EnergyValue';

/** Section header art. Each decision gets a distinct pixel mark. */
const SECTION_ICON = {
  shop: A.ui.sidebar.product,
  channels: A.ui.commercial.social_media,
  budget: A.ui.commercial.campaign,
  hiring: A.ui.studioOps.staff_training,
  vendor: A.ui.studioOps.supplier,
};

/** Per-channel art. Closest existing marks; purpose-built ones would be better. */
const CHANNEL_ICON: Record<ChannelId, string> = {
  offline: A.ui.commercial.bulk_order,
  online: A.ui.commercial.social_media,
  retail: A.ui.studioOps.inventory_shelf,
};

// A distinct studio-operations portrait per candidate, so each hire reads at a
// glance (the visual hook for the hiring cards).
const CANDIDATE_ICON: Record<string, string> = {
  ains: A.ui.studioOps.printing,
  beta: A.ui.studioOps.staff_training,
  chewie: A.ui.studioOps.packaging_station,

};

// Storefront art per vendor. Every other option card on this page leads with a
// pixel mark; the vendor tiles were the one set that was pure text, so a row of
// four shops read as a table rather than as four places you could ship through.
const VENDOR_ICON: Record<string, string> = {
  als: A.ui.studioOps.supplier,
  emils: A.ui.commercial.bulk_order,
  phoebes: A.ui.studioOps.inventory_shelf,
  nines: A.ui.commercial.limited_drop,
};

// A pending pick — set when the player taps an option; the case-study modal
// then gates the actual engage (the PDF's "read before choosing").
type Pending =
  // A hire carries the backend ITEM and one of its own `options` keys — the two
  // things the server can actually resolve. No frontend candidate id.
  | { kind: 'candidate'; item: GlobalInputItemDto; stepKey: string; energy: number; study: CaseStudy }
  // A vendor likewise carries the backend item. It is a COMPANY-WIDE selection;
  // `productId` is only what the per-product override and coverage are read
  // against for display.
  | { kind: 'vendor'; item: GlobalInputItemDto; productId: string | null; energy: number; study: CaseStudy };

// Turn a pending pick into the prominent cost tiles + impact chips the modal
// shows — energy to unlock (⚡) and ongoing $ cost kept as SEPARATE tiles.
// No `genre` argument any more: vendor coverage is decided by `productsImpacted`
// against the product id, not by guessing a genre from a product name.
function engageSummary(p: Pending): { tiles: CostTile[]; effects: string[] } {
  const tiles: CostTile[] = [{ label: 'Energy to unlock', value: `${p.energy}`, tone: 'energy', icon: 'energy' }];
  const effects: string[] = [];
  if (p.kind === 'candidate') {
    const lv = hireStep(p.item, p.stepKey);
    if (lv) {
      tiles.push({ label: 'Wage / phase', value: fmt$(lv.cost), tone: 'cost', icon: 'cash' });
      if (lv.prodBonus > 0) effects.push(`+${(lv.prodBonus * 100).toFixed(0)}% production`);
      if (lv.sellBonus > 0) effects.push(`+${(lv.sellBonus * 100).toFixed(1)}% sell-rate`);
      if (lv.costReduction > 0) effects.push(`−${(lv.costReduction * 100).toFixed(0)}% unit cost`);
      if (lv.marketingBonus > 0) effects.push(`+${(lv.marketingBonus * 100).toFixed(1)}% demand`);
    }
  } else {
    // Scoped to the active product, so the bonus quoted is the one that product
    // actually receives once the per-product override is applied.
    const v = vendorStep(p.item, null, p.productId);
    if (v) {
      tiles.push({ label: 'Cost / phase', value: fmt$(v.cost), tone: 'cost', icon: 'cash' });
      effects.push(
        `+${(v.prodBonus * 100).toFixed(0)}% production`,
        `${vendorQuality(v.prodBonus)} quality`,
      );
      if (!vendorCoversProduct(p.item, p.productId)) {
        effects.push(`⚠ Does not supply this notebook`);
      }
    }
  }
  return { tiles, effects };
}

/**
 * StudioPanel — the V3 company-decision hub. Hire a candidate, set Marketing &
 * Sales budgets, and pick a shipping vendor for the active line. Each spends
 * ENERGY to set up (separate from the per-phase money cost, which flows through the
 * phase P&L). Every decision is REVERSIBLE — clearing refunds the energy.
 */
export function StudioPanel({
  liveProjection,
  recalc,
}: {
  liveProjection?: ServerProjectionResult | null;
  /** Called at the END of a decision interaction. See useLiveProjection. */
  recalc?: (reason: string) => void;
}) {
  const energy = useGame((s) => s.player.energy);
  // Keyed by `inputId` now — `selectedStepKey` holds the backend options key
  // (the level), not an identity, so it can no longer identify which hire.
  const hireSelections = useGame((s) =>
    s.globalInputSelections.filter((sel) => sel.key === 'hiring' && sel.inputId != null),
  );
  const marketingSel = useGame((s) => s.globalInputSelections.find((sel) => sel.key === 'marketing'));
  const marketingGI = useGame((s) => s.availableGlobalInputs.find((g) => g.key === 'marketing'));
  const phase = useGame((s) => s.meta.phase);
  const activeLine = useGame((s) =>
    s.portfolio.productLines.find((l) => l.id === s.portfolio.activeLineId) ?? s.portfolio.productLines[0],
  );
  const activeLineIndex = useGame((s) => {
    const idx = s.portfolio.productLines.findIndex((l) => l.id === s.portfolio.activeLineId);
    return idx >= 0 ? idx : 0;
  });
  const projDynamicCost = (liveProjection?.byProduct[activeLineIndex] ?? liveProjection?.byProduct[0])?.dynamicCost ?? null;
  // "Where you sell" is company-wide: one channel set across every notebook.
  // Both selectors return a joined STRING, not a fresh array — a new array each
  // render would break Zustand's referential equality and churn re-renders.
  const channelsKey = useGame((s) => finlitCompanyChannels(s).join(','));
  const genresKey = useGame((s) =>
    [...new Set(s.portfolio.productLines.map((l) => l.genre ?? 'indie'))].join(','),
  );
  const companyChannels = new Set(channelsKey.split(',') as ChannelId[]);
  const genresInPlay = (genresKey ? genresKey.split(',') : []) as GenreId[];
  const shopName = useGame((s) => s.meta.shopName);
  const apply = useGame((s) => s.apply);
  const availableGlobalInputs = useGame((s) => s.availableGlobalInputs);
  const channelGI = availableGlobalInputs.find((g) => g.key === 'channel');
  const hiringGI  = availableGlobalInputs.find((g) => g.key === 'hiring');
  const vendorGI  = availableGlobalInputs.find((g) => g.key === 'supply_chain');
  const channelMaxSelections = channelGI?.maxSelections ?? 1;
  const hiringMaxSelections  = hiringGI?.maxSelections ?? 3;
  // ── Marketing budget ────────────────────────────────────────────────────
  //
  // The lever's domain is the ITEM'S OWN `options` keys. It used to be a raw
  // `0…BUDGET_MAX` integer slider (a hardcoded frontend 40) whose value was
  // submitted as `selectedStepKey` — so unless the operator happened to key
  // options "0".."40", the server's `options[selectedStepKey] ?? 0` missed,
  // yielded 0, and skipped every marketing impact. The slider is now an INDEX
  // into the configured steps and submits the step's own key.
  const marketingItem = marketingGI?.inputs[0] ?? null;
  const marketingStepKeys = Object.keys(marketingItem?.options ?? {});
  const marketingIdx = Math.max(0, marketingStepKeys.indexOf(marketingSel?.selectedStepKey ?? ''));
  const marketingStepKey = marketingStepKeys[marketingIdx] ?? null;
  const marketingMult = marketingStepKey != null
    ? marketingItem?.options?.[marketingStepKey] ?? 0
    : 0;
  // Through the shared util rather than open-coded, so this lever cannot drift
  // from the server's rule. Marketing is company-wide, hence productId null.
  // The old display read `options[stepKey] - 1`, which ignored `impacts`
  // entirely and so showed a demand lift unrelated to the one being applied.
  const marketingDemandLift = marketingItem
    ? impactFor(marketingItem, 'marketing', marketingStepKey, null)
    : 0;
  const marketingSpend = Math.ceil((marketingItem?.cost ?? 0) * marketingMult);
  // Scaled by the step, matching what setFinlitMarketingBudget actually charges.
  // A flat `item.energy` here would show a figure the mutator never deducts.
  const marketingEnergy = Math.ceil((marketingItem?.energy ?? 0) * marketingMult);

  const [pending, setPending] = useState<Pending | null>(null);
  // Raw text per candidate so the field can be empty mid-typing; it is parsed
  // and clamped before anything reaches the engine.
  const [levelDraft, setLevelDraft] = useState<Record<string, string>>({});
  // null = not editing; the input falls back to the store value.
  const [shopDraft, setShopDraft] = useState<string | null>(null);
  // Which section's reference sheet is open, if any.
  const [detail, setDetail] = useState<SectionDetail | null>(null);

  // Days remaining in the current phase — see the Hiring hint for why the
  // per-phase figures need this qualifier. Derived from a PRIMITIVE read on
  // purpose: `selectCurrentPhase` carries the same figure but returns a fresh
  // object, so `useGame(selectCurrentPhase)` would fail Zustand's referential
  // check and re-render this panel every tick — the same trap the channel/genre
  // selectors above avoid by returning joined strings.
  const day = useGame((s) => s.meta.day);
  const daysLeftInPhase = Math.max(0, phase * DAYS_PER_PHASE - day + 1);

  // Vendor selections are company-wide, keyed by the backend item id.
  const vendorSelections = useGame((s) =>
    s.globalInputSelections.filter((sel) => sel.key === 'supply_chain' && sel.inputId != null),
  );
  const vendorMaxSelections = vendorGI?.maxSelections ?? 1;
  // The product the active line is paired with — what `productsImpacted` and the
  // per-product override are resolved against. Comes from the server projection,
  // which is the only place the line↔product pairing is known here.
  const activeProductId =
    (liveProjection?.byProduct[activeLineIndex] ?? liveProjection?.byProduct[0])?.productId ?? null;
  const vendorRefund = vendorSelections.reduce((sum, sel) => {
    const item = vendorGI?.inputs.find((i) => String(i._id) === sel.inputId);
    return sum + (item ? vendorStep(item, sel.selectedStepKey ?? null)?.energy ?? 0 : 0);
  }, 0);

  const commit = () => {
    if (!pending) return;
    const ok = pending.energy <= energy;
    playSfx(ok ? 'confirm' : 'fail');
    apply((s) => {
      if (pending.kind === 'candidate') engageFinlitHire(s, pending.item, pending.stepKey, hiringMaxSelections);
      else engageFinlitVendor(s, pending.item, null, vendorMaxSelections);
    });
    // Modal commit is the interaction end for a hire or vendor.
    recalc?.(pending.kind === 'candidate' ? 'hire committed' : 'vendor committed');
    setPending(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* No page-level status strip. The page already opened with THREE
          stacked bands of meta-text — the panel masthead, the tab explainer,
          and a "company decisions · reversible" line — before a single
          decision, and the energy figure in that third band was the same
          number the persistent HUD shows at the top of the screen. The
          reversibility note now lives in the tab explainer (copy.ts) and the
          page starts on its first actual decision. */}

      {/* ── Your shop — the company's name. Also renameable from the shop sign
           on the desk (Product page); both write through setShopName. ── */}
      <OpsSection icon={SECTION_ICON.shop} title="Your Shop" hint="Your business name. Costs nothing, change it whenever you like.">
        {/* The field used to sit alone against a full panel width of nothing.
            The counter and the "where does this show up?" line are what a
            player actually wants next to a name box, and they earn the space
            the empty half was wasting. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <input
            // Local draft while typing, committed on blur/Enter. Writing straight
            // through on every keystroke would fight setShopName's empty-fallback:
            // clearing the field to retype would snap it back to the default.
            value={shopDraft ?? shopName}
            onChange={(e) => setShopDraft(e.target.value)}
            onBlur={() => { apply((s) => setShopName(s, shopDraft ?? shopName)); setShopDraft(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            maxLength={MAX_SHOP_NAME}
            aria-label="Shop name"
            placeholder={DEFAULT_SHOP_NAME}
            className="w-full max-w-[340px] bg-cream-50 border-2 border-border text-text section-title outline-none focus:border-primary shadow-[2px_2px_0_0_var(--c-shadow)] px-3 py-2"
          />
          <div className="flex items-center gap-3 min-w-0">
            <span className="readout shrink-0 bg-surface-2 px-2 py-1">
              <span className="num-xs text-text-2 tabular-nums">
                {(shopDraft ?? shopName).length}/{MAX_SHOP_NAME}
              </span>
            </span>
            <span className="body-xs text-text-3 min-w-0">
              Appears on the shop sign on your desk and in the class standings.
            </span>
          </div>
        </div>
      </OpsSection>

      {/* ── Sales channels — WHERE you sell. Company-wide: every notebook ships
           through the same channels, so this is one decision, not one per SKU. ── */}
      <OpsSection
        icon={SECTION_ICON.channels}
        title="Sales Channels"
        hint="Where you sell. Applies to every notebook."
        onDetails={() => setDetail(channelDetail(channelGI))}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.keys(CHANNEL_META) as ChannelId[]).map((ch) => {
            const on = companyChannels.has(ch);
            const isLastOn = on && companyChannels.size <= 1;
            const row = channelRow(genresInPlay[0] ?? 'indie', ch);
            const channelItem = channelGI?.inputs.find((item) => item.key === ch);
            return (
              <motion.button
                key={ch}
                onClick={() => {
                  if (isLastOn) { playSfx('fail'); return; }
                  // No backend item ⇒ nothing the server could resolve, so the
                  // toggle is refused rather than writing an unsendable selection.
                  if (!channelItem) { playSfx('fail'); return; }
                  playSfx('click-soft');
                  apply((s) => toggleFinlitChannelAll(s, channelItem, channelMaxSelections));
                  // A button click has no separate interaction end.
                  recalc?.(`channel toggled · ${channelItem.key}`);
                }}
                title={isLastOn ? 'You need at least one channel to sell through.' : undefined}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 340, damping: 20 }}
                className={clsx(
                  // On/off used to be carried by FILL ALONE — #D4ECDB against
                  // #FBF6E9, two pale tints that read as the same light card,
                  // while the readout chips inside stayed fully coloured in
                  // BOTH states. So an "off" card still contained a green
                  // tile, and clients could not tell the two apart.
                  //
                  // State is now four reinforcing signals, only one of which
                  // is colour: accent BORDER, fill, a solid-vs-hollow badge
                  // carrying a ✓/✕ GLYPH (so it survives colour-blindness and
                  // greyscale), and desaturated art + muted chips when off.
                  // INK FRAME EITHER WAY. An "off" switch is still a switch,
                  // and RULE 5 gives every control the full 2px border — fading
                  // it to /35 made an off channel look like a static card, which
                  // is the opposite of the problem being solved. Same weight in
                  // both states; only the COLOUR changes, plus fill, badge glyph
                  // and desaturated art.
                  'ctl-btn flex flex-col gap-2 p-3 border-2 text-left cursor-pointer transition-colors',
                  on
                    ? 'border-primary-strong bg-surface'
                    : 'border-ink-900 bg-surface hover:bg-cream-100',
                )}
              >
                {/* OFF fades the whole CONTENT in one move rather than
                    bleaching each part separately. Per-element receding left
                    the chips on almost no fill, which read as a missing
                    background, and still needed a rule per element. The
                    BORDER stays outside this wrapper at full strength - an
                    off switch is still a control. */}
                <div className={clsx('contents', !on && '[&>*]:opacity-60')}>
                <div className="flex items-start justify-between gap-2">
                  <img
                    src={CHANNEL_ICON[ch]}
                    alt=""
                    className={clsx(
                      'w-28 h-28 object-contain shrink-0 transition-[filter,opacity]',
                      !on && 'grayscale',
                    )}
                    style={{ imageRendering: 'pixelated' }}
                    draggable={false}
                  />
                  {/* Solid + ✓ when on, hollow + ✕ when off. The glyph is the
                      part that still works in greyscale or at a glance. */}
                  <span className={clsx(
                    'shrink-0 inline-flex items-center gap-1 px-2 py-1 border-2',
                    on
                      ? 'bg-primary-strong border-primary-strong text-cream-50'
                      : 'bg-transparent border-ink-900/40 text-text-3',
                  )}>
                    <span aria-hidden className="btn-label-sm leading-none">{on ? '✓' : '✕'}</span>
                    <span className="eyebrow eyebrow-sm text-inherit">{on ? 'On' : 'Off'}</span>
                  </span>
                </div>

                {/* Text recedes with the card. Dimming only the ART left the
                    name and the figures at full strength, so an off channel
                    read as "available" rather than "not running" — the exact
                    complaint. --c-text-3 still measures ~10:1 on cream, so
                    receding costs no legibility. */}
                <div className="min-w-0">
                  <div className="h3 uppercase text-ink-900">{CHANNEL_META[ch].name}</div>
                  <p className="body-xs text-text-2 mt-1 measure">{CHANNEL_META[ch].blurb}</p>
                </div>

                {/* The numbers you're actually choosing between get to look
                    like values, not footnotes.

                    Offline takes no consignment, and omitting the chip left a
                    hole in that card where its siblings had a third row — it
                    read as a rendering fault rather than as "this one is
                    cheaper". "None" is the actual answer, and it's the whole
                    reason to pick offline, so it says so. */}
                {/* Chips carry their semantic tint only while the channel is
                    ON. Tinted in both states they out-shouted the card's own
                    state — a green "Per sale: None" tile sat inside every OFF
                    card, which is exactly the colour that is supposed to mean
                    "this one is running". */}
                <div className="grid grid-cols-2 gap-2 mt-auto">
                  <StatChip label="Per phase" value={channelItem ? fmt$(channelItem.cost) : '–'} tone="money" />
                  <StatChip
                    label="Per sale"
                    value={row.consignment > 0 ? fmt$(row.consignment) : 'None'}
                    tone={row.consignment > 0 ? 'money' : 'good'}
                  />
                </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </OpsSection>

      {/* ── Marketing & Sales budgets ── */}
      <OpsSection
        icon={SECTION_ICON.budget}
        title="Marketing & Sales Budget"
        hint="Budget to grow, shown per phase. Set back to $0 to switch off and refund the energy."
        onDetails={() => setDetail(budgetDetail(marketingGI))}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <BudgetLever
            label="Marketing budget"
            hint="Awareness - lifts DEMAND (more people want it)."
            value={marketingIdx}
            max={Math.max(0, marketingStepKeys.length - 1)}
            stepLabel={marketingStepKey ?? '—'}
            spend={marketingSpend}
            energy={marketingEnergy}
            effectLabel="Demand"
            effect={`+${(marketingDemandLift * 100).toFixed(1)}%`}
            // The affordability decision belongs to the mutator, which knows the
            // step it is moving TO and charges only the delta. Gating here on the
            // CURRENT step's energy would let every move through, since the
            // current step is free once already paid for.
            canActivate={marketingStepKeys.length > 0}
            onChange={(i) => {
              const key = marketingStepKeys[i];
              if (key == null || !marketingItem) return;
              let ok = false;
              apply((s) => { ok = setFinlitMarketingBudget(s, marketingItem, key); });
              playSfx(ok ? 'tick' : 'fail');
            }}
            onCommit={() => recalc?.('marketing lever released')}
          />
          <BudgetLever
            label="Sales budget"
            hint="Conversion - lifts SELL-RATE (more of them buy). Comes from hiring."
            value={0}
            max={0}
            stepLabel="—"
            spend={0}
            energy={BUDGET_LEVER_ENERGY}
            effectLabel="Sell-rate"
            effect={`+${(hireSelections.reduce((sum, sel) => {
              const item = hiringGI?.inputs.find((i) => String(i._id) === sel.inputId);
              return sum + (item ? hireStep(item, sel.selectedStepKey)?.sellBonus ?? 0 : 0);
            }, 0) * 100).toFixed(1)}%`}
            canActivate={false}
            onChange={(v) => { playSfx('tick'); apply((s) => setFinlitSalesBudget(s, v)); }}
          />
        </div>
      </OpsSection>

      {/* ── Hiring ── */}
      <OpsSection
        icon={SECTION_ICON.hiring}
        title="Hiring"
        hint={
          // Two things the per-phase figures do not say on their own, and both
          // change what the number means:
          //   1. a hire is NOT one-off — nothing clears `finlit.hire` at phase
          //      rollover, so a Phase 1 hire keeps charging through 2 and 3.
          //      "$150" read as one-time understates the commitment 3x.
          //   2. the figures assume a whole 30-day phase. Hire on day 25 and
          //      you buy 6 days of it, so surface the shortfall rather than
          //      quietly overstating what the money buys.
          // Kept short: the section header scrolls under the floating
          // PRODUCT/BUSINESS nav, which clips a long second line.
          daysLeftInPhase < DAYS_PER_PHASE
            ? `Costs are per phase and recur while engaged - ${daysLeftInPhase}d left, figures show a full phase.`
            : 'One at a time. Costs are per phase and recur while engaged.'
        }
        onDetails={() => setDetail(hiringDetail(hiringGI))}
      >
        {/* Two columns from xl. Four candidates stacked full-width left each
            row ~1330px wide around ~500px of content, so every card carried a
            half-empty right side and the four ran together as one long list.
            Paired up they read as a roster you compare across, and the whole
            section fits without scrolling. */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
          {(hiringGI?.inputs ?? []).map((item) => {
            // The roster IS the backend's hiring items. `options` gives the
            // steps; the level control is a 1-based INDEX into them, so an
            // operator can name the keys anything and the ceiling follows the
            // configuration rather than a hardcoded 4.
            const itemId = String(item._id);
            const steps = hireSteps(item);
            const engagedSel = hireSelections.find((sel) => sel.inputId === itemId);
            const engaged = engagedSel != null;
            const engagedIdx = engaged
              ? steps.findIndex((s) => s.stepKey === engagedSel.selectedStepKey)
              : -1;
            const curLevel = engagedIdx >= 0 ? engagedIdx + 1 : 0;
            const maxLevel = Math.max(1, steps.length);
            const draftRaw = levelDraft[itemId] ?? String(curLevel || 1);
            const parsed = parseInt(draftRaw, 10);
            const level = Number.isFinite(parsed) ? Math.min(maxLevel, Math.max(1, parsed)) : 1;
            const lv = steps[level - 1] ?? null;
            // Presentation only. Name and blurb are the backend's label and
            // description; the portrait comes from PlayerConfig via
            // configHydrator, falling back to the bundled mark.
            const c = {
              id: itemId,
              name: item.label,
              blurb: item.description ?? '',
              img: CANDIDATE_IMAGE[item.key] ?? CANDIDATE_ICON[item.key],
            };
            return (
              // A roster CARD. The controls are the level input and the
              // hire button inside it; the card itself is never clickable.
              //
              // Layout: the portrait used to be `self-center` in a flex ROW
              // with everything else, so on a tall card it floated at mid
              // height while the text started at the top, and because each
              // candidate's art has its own aspect ratio the text columns
              // started at a different x in every card. Header row first
              // (art + name + blurb), then controls and figures full width,
              // so all four cards align down the same edge.
              <div key={c.id} className="readout p-3 flex flex-col gap-3 bg-surface">
                <div className="flex items-start gap-3">
                  <SafeImage
                    src={c.img}
                    alt=""
                    className={clsx('shrink-0 w-24 h-24 object-contain', !engaged && 'grayscale-[45%] opacity-80')}
                    fallbackIcon="hire"
                    fallbackSize={44}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="h3 uppercase text-ink-900">{c.name}</span>
                      {engaged && (
                        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-[2px] border-2 border-primary-strong bg-primary-strong text-cream-50">
                          <span aria-hidden className="btn-label-sm leading-none">✓</span>
                          <span className="eyebrow eyebrow-sm text-inherit">Level {curLevel}</span>
                        </span>
                      )}
                    </div>
                    <p className="body-xs text-text-2 mt-1 measure">{c.blurb}</p>
                  </div>
                </div>

                {/* LEVEL — typed, not picked from a fixed row of tiers. The value
                    is a 1-based INDEX into the item's `options` steps, so the
                    ceiling is whatever the operator configured and adding a step
                    in the backend widens this input with no code change. It is
                    clamped to that range, and the step's own key — never the
                    typed number — is what gets submitted. */}
                {/* One line, baseline-aligned. This was four boxes of three
                    different heights jammed together with `items-end` — an
                    input, two tinted chips and a button — which read as
                    clutter rather than a control. The cost and energy are
                    consequences of the level you type, not things you pick,
                    so they are inline figures now; only the input and the
                    button are boxed, and the button is pushed to the far end
                    where an action belongs. */}
                {/* Cost and energy are READOUTS and wear the chip tray. The
                    level is the one thing in this row you can change, and it
                    is deliberately NOT a chip: it used to be an input nested
                    inside a tray, so a tray said "number to read" while the
                    input's own frame said "control", one inside the other, and
                    the caption and the field read as the same object. A
                    control here is a bare framed field on the card surface —
                    the same 2px frame + resting shadow as every button — so
                    the contrast with the two trays beside it IS the signal. */}
                {/* THE DECISION, on its own line: pick a level, press Hire.
                    Those two were previously strung through a row of readouts,
                    so the one control and the one commit were separated by the
                    facts about them and the row read as four unrelated boxes.
                    They are one block now, above the numbers they produce. */}
                <div className="flex items-end gap-2 border-t border-border-soft pt-2.5">
                  {/* <label> wraps both parts, so the caption is a click target
                      for the field rather than decoration beside it. */}
                  <label className="min-w-0 flex-1 flex flex-col cursor-pointer">
                    <span className="stat-label truncate">{`Level · max ${maxLevel}`}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={maxLevel}
                      value={draftRaw}
                      onChange={(e) => setLevelDraft((d) => ({ ...d, [c.id]: e.target.value }))}
                      onBlur={() => setLevelDraft((d) => ({ ...d, [c.id]: String(level) }))}
                      aria-label={`${c.name} level, 1 to ${maxLevel}`}
                      // w-full, so the field spans its caption instead of
                      // floating as a 58px box inside a wider container.
                      className="w-full mt-1 bg-cream-50 border-2 border-border text-text num-sm text-center outline-none focus:border-primary shadow-[2px_2px_0_0_var(--c-shadow)] px-1.5 py-1 cursor-text"
                    />
                  </label>
                  <span className="shrink-0 self-end pb-0.5">
                  {engaged ? (
                    <PixelButton
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        playSfx('click-soft');
                        apply((s2) => clearFinlitHire(s2, item));
                        // Releasing a hire removes a globalInput selection — the
                        // projection is stale until this fires.
                        recalc?.(`hire released · ${item.key}`);
                      }}
                    >
                      Release
                    </PixelButton>
                  ) : (
                    <PixelButton
                      size="sm"
                      disabled={lv == null || energy < lv.energy}
                      onClick={() => {
                        if (!lv) return;
                        playSfx('click-soft');
                        // Case studies are still keyed by the operator's own id
                        // (`item.key`), which is what PlayerConfig sets them under.
                        setPending({
                          kind: 'candidate',
                          item,
                          stepKey: lv.stepKey,
                          energy: lv.energy,
                          study: studyFor('candidate', item.key),
                        });
                      }}
                    >
                      Hire
                    </PixelButton>
                  )}
                  </span>
                </div>

                {/* What it COSTS, then what it GIVES - and every figure
                    resolves to the level TYPED, not an L1→L4 range, which made
                    you interpolate to find what you were actually buying. One
                    six-column grid so the two rows share gutters: costs take
                    halves, outcomes take thirds. */}
                <div className="grid grid-cols-6 gap-2">
                  <StatChip className="col-span-3" label="Cost / phase" value={fmt$(lv.cost)} tone="money" />
                  <StatChip className="col-span-3" label="Energy" value={<EnergyValue amount={lv.energy} size={13} />} tone="energy" />
                  <StatChip className="col-span-3" label="Inventory rate" value={lv.prodBonus > 0 ? `+${(lv.prodBonus * 100).toFixed(1)}%` : '—'} tone="good" />
                  <StatChip className="col-span-3" label="Sell-rate" value={`+${(lv.sellBonus * 100).toFixed(1)}%`} tone="good" />
                  <StatChip className="col-span-3" label="Cost reduction" value={lv.costReduction > 0 ? `−${(lv.costReduction * 100).toFixed(1)}%` : '—'} tone="good" />
                  {/* Units to sell for cost savings to cover the hire wage:
                      lv.cost / (dynamicCost × costReduction). Uses server dynamicCost
                      from calcFinancials — only meaningful when costReduction > 0. */}
                  <StatChip
                    className="col-span-3"
                    label="Breakeven"
                    value={
                      projDynamicCost !== null && projDynamicCost > 0 && lv.costReduction > 0
                        ? `${Math.ceil(lv.cost / (projDynamicCost * lv.costReduction))} units`
                        : '—'
                    }
                    tone="money"
                  />
                </div>
              </div>
            );
          })}
          {/* The separate "Clear hire" button is gone. Undo now lives on the
              engaged tier itself — click the lit L1-L4 again to release it —
              so making and unmaking the decision are the same control in the
              same place, instead of a second button parked below the roster. */}
        </div>
      </OpsSection>

      {/* ── Shipping vendor — COMPANY-WIDE, like every other global input. The
           active notebook is still needed to render the cards, because coverage
           (`productsImpacted`) and the per-product override are shown relative
           to a product; the decision itself is not per line. ── */}
      <OpsSection
        icon={SECTION_ICON.vendor}
        title="Vendor"
        hint={
          activeLine
            ? `Company-wide. Figures shown for ${activeLine.name} — some vendors only supply certain notebooks.`
            : 'Add a notebook first.'
        }
        onDetails={() => setDetail(vendorDetail(vendorGI))}
      >
        {activeLine ? (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              {(vendorGI?.inputs ?? []).map((item) => {
                const itemId = String(item._id);
                // Scoped to the active product: coverage from `productsImpacted`,
                // bonus through the per-product `selections` override.
                const step = vendorStep(item, null, activeProductId);
                const stocks = vendorCoversProduct(item, activeProductId);
                const on = vendorSelections.some((sel) => sel.inputId === itemId);
                const cost = step?.energy ?? item.energy;
                const affordable = energy >= cost || on;
                const v = {
                  id: itemId,
                  name: item.label,
                  cost: step?.cost ?? item.cost,
                  prodBonus: step?.prodBonus ?? 0,
                  quality: vendorQuality(step?.prodBonus ?? 0),
                  img: VENDOR_IMAGE[item.key] ?? VENDOR_ICON[item.key],
                };
                return (
                  <button
                    key={v.id}
                    disabled={!stocks || (!affordable && !on)}
                    onClick={() => {
                      playSfx('click-soft');
                      setPending({
                        kind: 'vendor',
                        item,
                        productId: activeProductId,
                        energy: cost,
                        // Case studies stay keyed by the operator's own id.
                        study: studyFor('vendor', item.key),
                      });
                    }}
                    className={clsx(
                      'ctl-btn text-left px-2 py-2 border-2 transition-all active:scale-[0.98]',
                      on ? 'border-primary-strong bg-surface'
                      : stocks && affordable ? 'border-ink-900 bg-surface hover:bg-cream-100'
                      : 'border-border-soft bg-surface-2 opacity-50 cursor-not-allowed',
                    )}
                    title={stocks ? `${v.quality} · +${(v.prodBonus * 100).toFixed(0)}% prod · ${cost}⚡ to unlock · ${fmt$(v.cost)} per phase` : `Doesn't supply this market`}
                  >
                    <div className={clsx('contents', !on && '[&>*]:opacity-60')}>
                    <div className="flex items-center gap-2.5">
                      <SafeImage
                        src={v.img}
                        alt=""
                        className={clsx('shrink-0 w-20 h-20 object-contain', !on && 'grayscale')}
                        fallbackIcon="box"
                        fallbackSize={32}
                      />
                      <span className="h3 uppercase text-ink-900 truncate flex-1 min-w-0">{v.name}</span>
                      {stocks && (
                        <span className={clsx(
                          'shrink-0 inline-flex items-center gap-1 px-1.5 py-[2px] border-2',
                          on ? 'bg-primary-strong border-primary-strong text-cream-50'
                             : 'bg-transparent border-ink-900/40 text-text-3',
                        )}>
                          <span aria-hidden className="btn-label-sm leading-none">{on ? '✓' : '✕'}</span>
                          <span className="eyebrow eyebrow-sm text-inherit">{on ? 'Shipping' : 'Off'}</span>
                        </span>
                      )}
                    </div>
                    {stocks ? (
                      <div className="grid grid-cols-3 gap-1.5 mt-2">
                        <StatChip label="Quality" value={v.quality} tone={v.quality === 'perfect' ? 'good' : 'reach'} />
                        <StatChip label="Per phase" value={fmt$(v.cost)} tone="money" />
                        <StatChip label="Energy" value={<EnergyValue amount={cost} size={13} />} tone="energy" />
                      </div>
                    ) : (
                      <p className="body-xs text-text-3 mt-2">Doesn't supply this market.</p>
                    )}
                    </div>
                  </button>
                );
              })}
            </div>
            {/* Gated on the SELECTIONS, not on `activeLine.vendor` — that field
                is no longer written now vendors are company-wide, so keying the
                button on it hid it permanently. Each vendor is released with the
                item that priced its step, because that is what
                `clearFinlitVendor` needs in order to refund the energy. */}
            {vendorSelections.length > 0 && (
              <PixelButton
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => {
                  playSfx('click-soft');
                  apply((s) => {
                    for (const sel of vendorSelections) {
                      const item = vendorGI?.inputs.find((i) => String(i._id) === sel.inputId);
                      if (item) clearFinlitVendor(s, item);
                    }
                  });
                  // A button click has no separate interaction end. Releasing a
                  // vendor removes a globalInput selection, so the projection is
                  // stale until this fires.
                  recalc?.('vendors cleared');
                }}
              >
                {vendorSelections.length > 1 ? 'Clear vendors' : 'Clear vendor'} · refund{' '}
                <EnergyValue amount={vendorRefund} className="ml-1" />
              </PixelButton>
            )}
          </div>
        ) : null}
      </OpsSection>

      {/* Per-section reference sheet: cost/energy/impact on the left, the
          market numbers behind it on the right. */}
      <OperationsDetailModal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.title ?? ''}
        intro={detail?.intro}
        inputs={detail?.inputs ?? []}
        tables={detail?.tables ?? []}
      />

      {/* Case-study gate — the PDF's "read before choosing". */}
      <PixelModal
        open={pending !== null}
        onClose={() => setPending(null)}
        title={pending ? `Case Study · ${pending.study.title}` : ''}
        width="min(520px, calc(100vw - 32px))"
      >
        {pending && (() => {
          const short = pending.energy > energy;
          const { tiles, effects } = engageSummary(pending);
          return (
          <div className="flex flex-col gap-4">
            {/* Who this is about. A case study with no face was just a wall of
                prose; the portrait anchors the brief and matches the roster row
                the player clicked to get here. */}
            <div className="flex items-start gap-3.5">
              {pending.kind === 'candidate' && (
                <SafeImage
                  src={CANDIDATE_IMAGE[pending.item.key] ?? CANDIDATE_ICON[pending.item.key]}
                  alt=""
                  className="shrink-0 w-20 h-20 object-contain"
                  fallbackIcon="hire"
                  fallbackSize={56}
                />
              )}
              <p className="body-sm text-text leading-relaxed min-w-0">{pending.study.brief}</p>
            </div>

            {/* The trade-off, as a matched pair — same shape, opposite colour,
                so "when this wins" and "when it hurts" weigh the same. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="readout bg-success-soft/50 px-3 py-2.5">
                <div className="stat-label text-success">Best when</div>
                <div className="body-xs text-text mt-1.5">{pending.study.bestWhen}</div>
              </div>
              <div className="readout bg-warning-soft/50 px-3 py-2.5">
                <div className="stat-label text-warning">Watch out</div>
                <div className="body-xs text-text mt-1.5">{pending.study.watchOut}</div>
              </div>
            </div>

            {/* Prominent cost + impact — the numbers the player is committing to. */}
            <CostTiles tiles={tiles} />
            {effects.length > 0 && <ImpactList items={effects} />}

            {/* Actions use PixelButton like every other commit in the game —
                the hand-rolled body-xs buttons here were the only ones in the
                app set in the body face, which is why they read as foreign. */}
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-border-soft mt-1 -mx-1 px-1 pt-3.5">
              {short && (
                // No 2px frame: this is a REASON, not a control, and it sits
                // inches from the two buttons it explains. Framing it like them
                // invited a click on the one thing here that does nothing.
                <span className="mr-auto self-center inline-flex items-center gap-1.5 bg-danger-soft/50 px-2.5 py-1.5">
                  <span className="stat-label text-danger">Not enough energy</span>
                </span>
              )}
              <PixelButton variant="ghost" size="md" onClick={() => setPending(null)}>Back</PixelButton>
              <PixelButton variant="primary" size="md" disabled={short} onClick={commit}>
                Engage · <EnergyValue amount={pending.energy} className="ml-1" />
              </PixelButton>
            </div>
          </div>
          );
        })()}
      </PixelModal>
    </div>
  );
}

/* A budget lever. The slider's underlying unit is $/DAY (that is what the
   engine charges and what the design sheet specifies), but the chip reports the
   PER-PHASE total, because that is the figure a player weighs against revenue.
   The raw per-day value is never surfaced, so there is no unit to confuse.
   $0 = off; moving above 0 charges the flat activation energy (refunded when
   set back to 0). Money spend flows through the phase P&L. */
function BudgetLever({
  label,
  hint,
  value,
  max,
  stepLabel,
  spend,
  energy,
  effectLabel,
  effect,
  canActivate,
  onChange,
  onCommit,
}: {
  label: string;
  hint: string;
  /** INDEX into the backend item's configured option steps — not a dollar amount. */
  value: number;
  /** Highest valid index, i.e. `options` key count − 1. */
  max: number;
  /** The option key at the current index, shown so the operator's own step label reads back. */
  stepLabel: string;
  /** Money this step costs per phase: `item.cost × options[stepKey]`. */
  spend: number;
  energy: number;
  /** What the spend moves, e.g. "Demand". */
  effectLabel: string;
  /** The live figure for that effect at the current spend, e.g. "+5%". */
  effect: string;
  canActivate: boolean;
  onChange: (v: number) => void;
  /** Interaction END — pointer released, or a keyboard drag finished. */
  onCommit?: () => void;
}) {
  const active = spend > 0;
  return (
    // The lever's CONTROL is the slider; the card around it is a panel — same
    // `readout` + `bg-surface` as every other card in this panel. It used to
    // turn mint (`bg-success-soft`) once funded, which made a funded lever the
    // only tinted region on the page and re-introduced the "active gets its own
    // colour" pattern. Funded state is already legible from the spend and the
    // "Running on" energy label; it does not need a fill.
    <div className="readout p-3 flex flex-col gap-2 bg-surface">
      <div>
        <div className="h3 uppercase text-ink-900">{label}</div>
        <p className="body-xs text-text-2 mt-1">{hint}</p>
      </div>

      {/* Three chips, because dragging the slider used to change exactly one
          number — the spend — and say nothing about what that money bought.
          The effect chip is the whole point of the lever. */}
      <div className="grid grid-cols-3 gap-2">
        {/* `spend` is already a per-phase figure — the step's configured cost —
            so it is NOT run through perPhase() the way the old daily-dollar
            slider value was. */}
        <StatChip label={`Spend / phase (${stepLabel})`} value={fmt$(spend)} tone={active ? 'money' : 'muted'} />
        <StatChip label={effectLabel} value={effect} tone={active ? 'good' : 'muted'} />
        <StatChip
          label={active ? 'Running on' : 'To activate'}
          value={<EnergyValue amount={energy} size={13} />}
          tone="energy"
        />
      </div>

      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        disabled={!canActivate || max === 0}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        // Pointer up covers mouse and touch; key up covers arrow-key dragging.
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        className="w-full accent-ui-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}
