import { useState } from 'react';
import { useGame } from '@/state/store';
import {
  engageFinlitHire, clearFinlitHire, engageFinlitVendor, clearFinlitVendor,
  setFinlitMarketingBudget,
  finlitCompanyChannels, toggleFinlitChannelAll, channelEnergyCost
} from '@/engine/mockEngine';
import {
  CHANNEL_META, channelRow,
  type ChannelId,
} from '@/data/finlit';
import { hireSteps, hireStep, CANDIDATE_IMAGE, type HireStep } from '@/engine/finlit/core/config/hiring';
import { MARKETING_IMAGE } from '@/engine/finlit/core/config/marketing';
import {
  vendorStep, vendorQuality, vendorCoversProduct, VENDOR_IMAGE,
} from '@/engine/finlit/core/config/vendors';
import type { GlobalInputItemDto } from '@/gamesim/types';
import { impactFor, stepControlFor, stepIndexForSpend } from '@/gamesim/impacts';
import { canSpend, selectCashBalance } from '@/engine/selectors';
import { useGamesimSession, roundNumberFromPhase } from '@/gamesim/GamesimProvider';
import { fmt$, fmtPct } from '@/utils/format';
import type { ServerProjectionResult } from '@/gamesim/sync';
import { DAYS_PER_PHASE } from '@/engine/config';
import { playSfx } from '@/audio/audioManager';
import { PixelModal } from '@/components/primitives/PixelModal';
import { CostTiles, ImpactList, type CostTile } from '@/components/primitives/CostTiles';
import { PixelButton } from '@/components/primitives';
import { SafeImage } from '@/components/primitives/SafeImage';
import { A } from '@/assets';
import { studyFor, type CaseStudy } from '@/content/finlitCaseStudies';
import { OpsSection, StatChip } from './OperationsKit';
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

/** Per-channel art for the three bundled ids. A channel the operator adds has
 *  no mark of its own, so `channelIcon` falls back rather than rendering an
 *  empty `src`. Closest existing marks; purpose-built ones would be better. */
const CHANNEL_ICON: Record<string, string> = {
  offline: A.ui.commercial.bulk_order,
  online: A.ui.commercial.social_media,
  retail: A.ui.studioOps.inventory_shelf,
};
const channelIcon = (ch: ChannelId): string =>
  CHANNEL_ICON[ch] ?? A.ui.commercial.bulk_order;

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
  // DEAD since 2026-10-06 — nothing constructs this variant. Hiring commits
  // from the level/investment field on blur (`commitHire`), with no modal in
  // front of it, so every `kind === 'candidate'` branch below is unreachable:
  // the `engageSummary` hire arm, `commit`'s `isHire` path, and the modal's
  // candidate body. VENDORS still use the modal, which is why the union and
  // its machinery stay rather than being torn out around them.
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
      // Driven by the item's own impacts, not by four named fields that were
      // zero on every hire but one. A hire pointed at a different impact
      // describes itself here with no branch added.
      for (const e of lv.effects) {
        if (e.contribution === 0) continue;
        effects.push(`${e.presentation.format(e.contribution)} ${e.presentation.label.toLowerCase()}`);
      }
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

/** The four decision blocks, in page order. */
export type OpsId = 'channels' | 'budget' | 'hiring' | 'vendor';
const ALL_OPS: readonly OpsId[] = ['channels', 'budget', 'hiring', 'vendor'];

/**
 * StudioPanel — the V3 company-decision hub. Hire a candidate, set Marketing &
 * Sales budgets, and pick a shipping vendor for the active line. Each spends
 * ENERGY to set up (separate from the per-phase money cost, which flows through the
 * phase P&L). Every decision is REVERSIBLE — clearing refunds the energy.
 */
export function StudioPanel({
  liveProjection,
  recalc,
  sections = ALL_OPS,
}: {
  liveProjection?: ServerProjectionResult | null;
  /** Called at the END of a decision interaction. See useLiveProjection. */
  recalc?: (reason: string) => void;
  /**
   * Which of the four blocks to render. They used to be one unbroken stack;
   * `Sales & Marketing` and `Capacity & RnD` are now separate tabs, and they
   * split this panel down the middle. The energy gate, the cash gate, the case-
   * study modal and the reference sheet are shared, which is why this is a
   * filter and not two components.
   */
  sections?: readonly OpsId[];
}) {
  const shows = (id: OpsId) => sections.includes(id);
  const energy = useGame((s) => s.player.energy);
  // Keyed by `inputId` now — `selectedStepKey` holds the backend options key
  // (the level), not an identity, so it can no longer identify which hire.
  const hireSelections = useGame((s) =>
    s.globalInputSelections.filter((sel) => sel.key === 'hiring' && sel.inputId != null),
  );
  // One row per item, same as hiring — see the note above `hireSelections`.
  const marketingSelections = useGame((s) =>
    s.globalInputSelections.filter((sel) => sel.key === 'marketing' && sel.inputId != null),
  );
  const marketingGI = useGame((s) => s.availableGlobalInputs.find((g) => g.key === 'marketing'));
  const phase = useGame((s) => s.meta.phase);
  const activeLine = useGame((s) =>
    s.portfolio.productLines.find((l) => l.id === s.portfolio.activeLineId) ?? s.portfolio.productLines[0],
  );
  // Keyed by productId, never by position — `byProduct` is ordered by the
  // server's pairing, not by portfolio order.
  const activeProj =
    liveProjection?.byProduct.find((p) => p.productId === activeLine?.productId) ?? null;
  const projDynamicCost = activeProj?.dynamicCost ?? null;
  // The cash gate needs every line's ceiling and unit cost — the build is part
  // of what the round has already committed.
  const cashByProduct = liveProjection?.byProduct ?? null;
  // …and the same base the chip shows, or the gate refuses spending the player
  // can see they can afford.
  // `bootstrap` was destructured here only to hand `channelDetail` the product
  // list for its name-matched override lookup. That lookup is gone — selections
  // are keyed by Product `_id`, which is what a genre id already is.
  const { financialsByRound } = useGamesimSession();
  const cashBase = useGame((s) =>
    selectCashBalance(
      s,
      s.meta.phase,
      (r) => financialsByRound[roundNumberFromPhase(r)]?.operatingProfit,
    ),
  );
  // "Where you sell" is company-wide: one channel set across every notebook.
  // A joined STRING, not a fresh array — a new array each render would break
  // Zustand's referential equality and churn re-renders.
  //
  // The `genresKey` subscription that sat here is gone with the genre × channel
  // matrix: it existed only to pick a genre for `channelRow`.
  const channelsKey = useGame((s) => finlitCompanyChannels(s).join(','));
  const companyChannels = new Set(channelsKey.split(',') as ChannelId[]);
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
  // EVERY item in the container, not `inputs[0]` — the operator can author
  // several marketing options and the server sums them all, so rendering only
  // the first hid levers that the P&L would still have charged for.
  const marketingLevers = (marketingGI?.inputs ?? []).map((item) => {
    const itemId = String(item._id);
    const sel = marketingSelections.find((s) => s.inputId === itemId);
    const stepKeys = Object.keys(item.options ?? {});
    const idx = Math.max(0, stepKeys.indexOf(sel?.selectedStepKey ?? ''));
    const stepKey = stepKeys[idx] ?? null;
    const mult = stepKey != null ? item.options?.[stepKey] ?? 0 : 0;
    // At a zero step the chip reads "To activate", so it must quote the NEXT
    // step's energy — `energy × 0` advertised activation as free while the
    // mutator charged the delta to the step actually moved to.
    const energyMult = mult !== 0
      ? mult
      : item.options?.[stepKeys[idx + 1] ?? ''] ?? 0;
    return {
      item, itemId, stepKeys, idx, stepKey,
      /** The step's own multiplier — 0 means this lever is switched off.
       *  `energy` cannot answer that any more: it previews the next step. */
      active: mult !== 0,
      // Through the shared util rather than open-coded, so a lever cannot drift
      // from the server's rule. Marketing is company-wide, hence productId null.
      demandLift: impactFor(item, 'marketing', stepKey, null),
      spend:  (item.cost ?? 0) * mult,
      // Scaled by the step, matching what setFinlitMarketingBudget charges. A
      // flat `item.energy` would show a figure the mutator never deducts.
      energy: Math.ceil((item.energy ?? 0) * energyMult),
    };
  });
  const marketingMaxSelections = marketingGI?.maxSelections ?? marketingLevers.length;
  // A lever already at a paid step stays editable so it can be wound back down.
  const marketingActiveCount = marketingLevers.filter((l) => l.active).length;

  const [pending, setPending] = useState<Pending | null>(null);
  // Raw text per candidate so the field can be empty mid-typing; it is parsed
  // and clamped before anything reaches the engine.
  const [levelDraft, setLevelDraft] = useState<Record<string, string>>({});
  /* `detailOpen` / `detailTab` and the `closeAllPopups` that cleared them went
     with the details sheet on 2026-10-05. The case-study gate (`pending`) is
     the only popup this panel owns now, so it is closed directly — if a second
     one is ever added, bring back a single close-everything function rather
     than letting each clear only itself. */

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
  // The product the active line makes — what `productsImpacted` and the
  // per-product override are resolved against. The LINE knows this now; it no
  // longer has to be recovered from the server's projection ordering.
  const activeProductId = activeLine?.productId ?? null;
  const vendorRefund = vendorSelections.reduce((sum, sel) => {
    const item = vendorGI?.inputs.find((i) => String(i._id) === sel.inputId);
    return sum + (item ? vendorStep(item, sel.selectedStepKey ?? null)?.energy ?? 0 : 0);
  }, 0);

  /**
   * Commit a hire straight from the level/investment field — THE decision, with
   * no Hire button and no confirmation modal in front of it (owner,
   * 2026-10-06). Called on blur, which is the interaction END for a typed
   * field, the same rule the sliders follow.
   *
   * It carries every guard the modal's `commit` had, because losing one here
   * loses it on the money path:
   *
   *   • NO-OP SHORT-CIRCUIT — blur fires whenever focus leaves, including when
   *     nothing was typed. Without this, tabbing past a card would re-commit
   *     and spend a recalc on an unchanged decision.
   *   • index 0 RELEASES. The `"0"` option is the off step, so winding the
   *     field back to 0 is what the Release button used to do.
   *   • CASH is checked BEFORE the mutator, on the DELTA against the current
   *     commitment, so re-levelling is priced on the difference.
   *   • ENERGY and the selection cap live inside `engageFinlitHire`, which
   *     charges the delta and refuses rather than half-applying.
   */
  const commitHire = (item: GlobalInputItemDto, steps: HireStep[], nextIdx: number) => {
    const itemId = String(item._id);
    const current = hireSelections.find((sel) => sel.inputId === itemId);
    const curKey = current?.selectedStepKey ?? null;
    const next = steps[nextIdx] ?? null;
    // A zero multiplier is not a step you can hold — it is the absence of one.
    const nextKey = next && next.multiplier !== 0 ? next.stepKey : null;
    if (nextKey === curKey) return;

    if (nextKey == null) {
      apply((s) => clearFinlitHire(s, item));
      playSfx('click-soft');
      recalc?.(`hire released · ${item.key}`);
      return;
    }

    const costAt = (k: string | null) => hireStep(item, k)?.cost ?? 0;
    const extra = costAt(nextKey) - costAt(curKey);
    let ok = false;
    apply((s) => {
      if (!canSpend(s, extra, cashByProduct, cashBase)) {
        s.toast = {
          id: 'cash-short-hire-' + itemId,
          kind: 'warning',
          text: `Not enough cash for ${item.label ?? 'that hire'} at that level.`,
          until: Date.now() + 1900,
        };
        return;
      }
      ok = engageFinlitHire(s, item, nextKey, hiringMaxSelections);
      if (!ok) {
        // `engageFinlitHire` refuses on energy OR on the selection cap and
        // says which only in a console line. Without a toast the field would
        // simply snap back with no reason given.
        s.toast = {
          id: 'hire-refused-' + itemId,
          kind: 'warning',
          text: `Not enough energy for ${item.label ?? 'that hire'}, or you already have ${hiringMaxSelections} hires.`,
          until: Date.now() + 1900,
        };
      }
    });
    playSfx(ok ? 'confirm' : 'fail');
    if (ok) recalc?.(`hire committed · ${item.key}`);
  };

  const commit = () => {
    if (!pending) return;
    const isHire = pending.kind === 'candidate';
    const itemId = String(pending.item._id);
    const costAt = (stepKey: string | null): number =>
      (isHire
        ? hireStep(pending.item, stepKey)?.cost
        : vendorStep(pending.item, null, pending.productId ?? null)?.cost) ?? 0;
    // The DELTA against this item's current commitment, so re-levelling an
    // existing hire is priced on the difference rather than the whole wage.
    const currentSel = (isHire ? hireSelections : vendorSelections)
      .find((sel) => sel.inputId === itemId);
    const extra = costAt(isHire ? pending.stepKey : null)
      - (currentSel ? costAt(currentSel.selectedStepKey) : 0);

    let ok = pending.energy <= energy;
    apply((s) => {
      // Cash bounds the round the way energy bounds the phase, and it is
      // checked BEFORE the mutator so nothing is half-applied.
      if (!canSpend(s, extra, cashByProduct, cashBase)) {
        ok = false;
        s.toast = {
          id: 'cash-short-engage-' + itemId,
          kind: 'warning',
          text: `Not enough cash for ${pending.item.label ?? (isHire ? 'that hire' : 'that vendor')}.`,
          until: Date.now() + 1900,
        };
        return;
      }
      if (isHire) engageFinlitHire(s, pending.item, pending.stepKey, hiringMaxSelections);
      else engageFinlitVendor(s, pending.item, null, vendorMaxSelections);
    });
    playSfx(ok ? 'confirm' : 'fail');
    if (!ok) return;
    // Modal commit is the interaction end for a hire or vendor.
    recalc?.(isHire ? 'hire committed' : 'vendor committed');
    setPending(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* The DETAILS button and the `OperationsDetailSheet` it opened were
          REMOVED on 2026-10-05. Owner: that reference material belongs in the
          CASE STUDY, which is the gate the player already reads before
          committing a hire or a vendor — so the explanation sits where the
          decision is made instead of behind a second control beside it. */}

      {/* No page-level status strip. The page already opened with THREE
          stacked bands of meta-text — the panel masthead, the tab explainer,
          and a "company decisions · reversible" line — before a single
          decision, and the energy figure in that third band was the same
          number the persistent HUD shows at the top of the screen. The
          reversibility note now lives in the tab explainer (copy.ts) and the
          page starts on its first actual decision. */}

      {/* ── Sales channels — WHERE you sell. Company-wide: every notebook ships
           through the same channels, so this is one decision, not one per SKU. ── */}
      {shows('channels') && (
      <OpsSection
        icon={SECTION_ICON.channels}
        title="Sales Channels"
        hint="Where you sell. Applies to every notebook."
      >
        {/* ONE per row. The `sm:grid-cols-3` here keyed off the VIEWPORT, which
            is almost always past `sm` — but this now sits in a rail capped at
            40vw, so it split a narrow column three ways and squeezed every
            card. Stacked, the section grows downwards instead. */}
        <div className="grid grid-cols-1 gap-3">
          {(Object.keys(CHANNEL_META) as ChannelId[]).map((ch) => {
            const on = companyChannels.has(ch);
            const isLastOn = on && companyChannels.size <= 1;
            // No genre argument any more — channel economics are per channel,
            // not per genre × channel. See channels.ts.
            const row = channelRow(ch);
            const channelItem = channelGI?.inputs.find((item) => item.key === ch);
            return (
              <motion.button
                key={ch}
                onClick={() => {
                  if (isLastOn) { playSfx('fail'); return; }
                  // No backend item ⇒ nothing the server could resolve, so the
                  // toggle is refused rather than writing an unsendable selection.
                  if (!channelItem) { playSfx('fail'); return; }
                  let ok = true;
                  apply((s) => {
                    // Binary, so the whole cost applies — but only when turning
                    // ON. Switching a channel off is a refund and never gated.
                    if (!on && !canSpend(s, channelItem.cost ?? 0, cashByProduct, cashBase)) {
                      ok = false;
                      s.toast = {
                        id: 'cash-short-channel-' + ch,
                        kind: 'warning',
                        text: `Not enough cash to open ${CHANNEL_META[ch]?.name ?? ch}.`,
                        until: Date.now() + 1900,
                      };
                      return;
                    }
                    toggleFinlitChannelAll(s, channelItem, channelMaxSelections);
                  });
                  playSfx(ok ? 'click-soft' : 'fail');
                  if (!ok) return;
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
                    src={channelIcon(ch)}
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
                {/* Wraps rather than holding three fixed thirds — see the note
                    on the same row in OperationsKit's detail modal. */}
                <div className="flex flex-wrap gap-2 mt-auto">
                  <StatChip className="grow basis-[104px]" label="Per phase" value={channelItem ? fmt$(channelItem.cost) : '–'} tone="money" />
                  {/* A RATE on the selling price, not a dollar fee — retail's
                      0.2 is 20% of every sale. `fmt$` rendered it "$0.20". */}
                  <StatChip
                    className="grow basis-[104px]"
                    label="Per sale"
                    value={row.consignment > 0 ? fmtPct(row.consignment) : 'None'}
                    tone={row.consignment > 0 ? 'money' : 'good'}
                  />
                  {/* Opening a channel SPENDS ENERGY, and the card never said
                      so — the only way to find out was to click and watch the
                      meter drop, or be refused. Same expression the mutator
                      charges (`item.energy || CHANNEL_ENERGY`), so the figure
                      quoted here cannot disagree with what is taken. */}
                  <StatChip
                    className="grow basis-[104px]"
                    label="Energy"
                    value={channelItem ? <EnergyValue amount={channelEnergyCost(channelItem)} size={13} /> : '–'}
                    tone="energy"
                  />
                </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </OpsSection>
      )}

      {shows('budget') && (
      <OpsSection
        icon={SECTION_ICON.budget}
        title="Marketing Budget"
        hint="Budget to grow, shown per phase. Set back to $0 to switch off and refund the energy."
      >
        {/* One per row — see the note on the channel grid above. */}
        <div className="grid grid-cols-1 gap-3">
          {marketingLevers.map((lv) => {
            // At the cap, only levers already paid for stay editable, so the
            // player can always wind one back down to free a slot.
            const atCap = marketingActiveCount >= marketingMaxSelections && !lv.active;
            return (
              <BudgetLever
                key={lv.itemId}
                // Keyed by the backend item's `key`, like the hiring portraits.
                img={MARKETING_IMAGE[lv.item.key]}
                label={lv.item.label ?? 'Marketing budget'}
                hint={lv.item.description ?? 'Awareness - lifts DEMAND (more people want it).'}
                value={lv.idx}
                max={Math.max(0, lv.stepKeys.length - 1)}
                // stepLabel={lv.stepKey ?? '—'}
                spend={lv.spend}
                energy={lv.energy}
                effectLabel="Level"
                effect={`${lv.stepKey ?? '—'}`}
                // The affordability decision belongs to the mutator, which knows
                // the step it is moving TO and charges only the delta. Gating here
                // on the CURRENT step's energy would let every move through, since
                // the current step is free once already paid for.
                canActivate={lv.stepKeys.length > 0 && !atCap}
                onChange={(i) => {
                  const key = lv.stepKeys[i];
                  if (key == null) return;
                  // Cash bounds the round. Only the DELTA against this lever's
                  // current step is tested, so stepping back down is free.
                  const nextSpend = (lv.item.cost ?? 0) * (lv.item.options?.[key] ?? 0);
                  let ok = false;
                  apply((s) => {
                    if (!canSpend(s, nextSpend - lv.spend, cashByProduct, cashBase)) {
                      s.toast = {
                        id: 'cash-short-marketing-' + lv.itemId,
                        kind: 'warning',
                        text: `Not enough cash for ${lv.item.label ?? 'marketing'} at that step.`,
                        until: Date.now() + 1900,
                      };
                      return;
                    }
                    ok = setFinlitMarketingBudget(s, lv.item, key);
                  });
                  playSfx(ok ? 'tick' : 'fail');
                }}
                onCommit={() => recalc?.('marketing lever released')}
              />
            );
          })}
        </div>
      </OpsSection>
      )}

      {shows('hiring') && (
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
      >
        {/* Two columns from xl. Four candidates stacked full-width left each
            row ~1330px wide around ~500px of content. That was the full-width
            page; in the rail there is no spare width to pair across, so one per
            row — see the note on the channel grid above. */}
        <div className="grid grid-cols-1 gap-2.5">
          {(hiringGI?.inputs ?? []).map((item) => {
            // The roster IS the backend's hiring items. `options` gives the
            // steps; the control is a 0-BASED INDEX into them, so an operator
            // can name the keys anything and both the floor and the ceiling
            // follow the configuration rather than a hardcoded 1..4.
            const itemId = String(item._id);
            const steps = hireSteps(item);
            const engagedSel = hireSelections.find((sel) => sel.inputId === itemId);
            const engaged = engagedSel != null;
            const engagedIdx = engaged
              ? steps.findIndex((s) => s.stepKey === engagedSel.selectedStepKey)
              : -1;
            // 0-BASED, like the marketing lever. `options` now carries a `"0"`
            // step whose multiplier is 0, so index 0 IS "not hired" and the
            // ladder runs 0..n rather than starting at the first paid tier.
            // There is no separate "off" state to model any more — the
            // configuration expresses it.
            const curIdx = engagedIdx >= 0 ? engagedIdx : 0;
            const maxIdx = Math.max(0, steps.length - 1);
            // WHAT THE PLAYER TYPES. Read off the item's impact, never its key
            // — `dynamic_cost` is bought by spending, so R&D's handle is the
            // COST and the tier is the consequence; everything else keeps the
            // level. See IMPACT_PRESENTATION.stepControl.
            const control = stepControlFor(item);
            const costs = steps.map((s) => s.cost);
            // MONEY IS SHOWN AT 2dp AND NEVER ROUNDED UP. `cost` is
            // `item.cost × multiplier`, so a multiplier like 1.06 gives
            // 5.300000000000001 — the raw float belongs in the arithmetic, not
            // in a field the player reads or types into. `toFixed(2)` for
            // DISPLAY only; `commitHire` still prices the delta off the raw
            // value, and `Math.ceil` must never touch a cost.
            const money2 = (n: number) => n.toFixed(2);
            const draftRaw =
              levelDraft[itemId] ??
              (control === 'cost' ? money2(costs[curIdx] ?? 0) : String(curIdx));
            const parsed = Number(draftRaw);
            const idx =
              control === 'cost'
                ? stepIndexForSpend(costs, parsed)
                : Number.isFinite(parsed)
                ? Math.min(maxIdx, Math.max(0, Math.trunc(parsed)))
                : 0;
            const lv = steps[idx] ?? null;
            // Index 0 is the OFF step — nothing to buy, so nothing to commit.
            const atZero = (lv?.multiplier ?? 0) === 0;
            // ENERGY PREVIEWS THE NEXT STEP WHEN THIS ONE IS FREE, exactly as
            // the marketing lever does: at a zero step `energy × 0` would
            // advertise activation as free while the mutator charges the step
            // actually moved to.
            const energyMult = !atZero
              ? lv?.multiplier ?? 0
              : steps[idx + 1]?.multiplier ?? 0;
            const energyShown = Math.ceil((item.energy ?? 0) * energyMult);
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
                          {/* The operator's own step KEY, not a derived
                              ordinal — `options` names the steps and that name
                              is what gets submitted. */}
                          <span className="eyebrow eyebrow-sm text-inherit">Level {steps[curIdx]?.stepKey ?? curIdx}</span>
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
                    {/* The caption names what the FIELD holds. On a
                        cost-driven lever it also states the base, because the
                        tiers are multiples of it — `options` scales
                        `item.cost`, so the base is the unit the steps are
                        counted in. */}
                    <span className="stat-label truncate">
                      {control === 'cost'
                        ? `Investment · up to ${fmt$(costs[costs.length - 1] ?? 0)}`
                        : `Level · 0 to ${maxIdx}`}
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      // BOTH start at 0 — the `"0"` option is the off step.
                      min={0}
                      max={control === 'cost' ? money2(costs[costs.length - 1] ?? 0) : maxIdx}
                      // Cents are typeable — the tiers are multiples of a base
                      // and need not land on whole dollars.
                      step={control === 'cost' ? '0.01' : 1}
                      value={draftRaw}
                      onChange={(e) => setLevelDraft((d) => ({ ...d, [c.id]: e.target.value }))}
                      // ARROWS MOVE A TIER, not a dollar. The native ±1 cannot
                      // walk this ladder: the tiers are 5 / 6 / 8 / 12, so from
                      // $8 an arrow-up types 9, which still resolves to $8 and
                      // the control appears stuck. Stepping by INDEX is what
                      // "every increase is based on the multiplier" means.
                      // Typing is untouched and snaps on blur.
                      onKeyDown={
                        control === 'cost'
                          ? (e) => {
                              if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                              e.preventDefault();
                              const next = Math.min(
                                maxIdx,
                                Math.max(0, idx + (e.key === 'ArrowUp' ? 1 : -1)),
                              );
                              setLevelDraft((d) => ({ ...d, [c.id]: money2(steps[next]?.cost ?? 0) }));
                            }
                          : undefined
                      }
                      // Snap on blur. A cost-driven field is typed freely and
                      // then resolved to the nearest CONFIGURED tier — the
                      // tiers are multiples of the base (5 / 6 / 8 / 12), not
                      // an even ladder, so the field cannot carry a fixed
                      // `step` and land on them.
                      // BLUR IS THE COMMIT. Snap the field to the resolved step
                      // and apply it in the same handler — leaving focus is the
                      // interaction end for a typed field, the same rule the
                      // sliders follow with `onPointerUp`.
                      onBlur={() => {
                        setLevelDraft((d) => ({
                          ...d,
                          [c.id]: control === 'cost' ? money2(lv?.cost ?? 0) : String(idx),
                        }));
                        commitHire(item, steps, idx);
                      }}
                      aria-label={
                        control === 'cost'
                          ? `${c.name} investment, 0 to ${fmt$(costs[costs.length - 1] ?? 0)}`
                          : `${c.name} level, 0 to ${maxIdx}`
                      }
                      // w-full, so the field spans its caption instead of
                      // floating as a 58px box inside a wider container.
                      className="w-full mt-1 bg-cream-50 border-2 border-border text-text num-sm text-center outline-none focus:border-primary shadow-[2px_2px_0_0_var(--c-shadow)] px-1.5 py-1 cursor-text"
                    />
                  </label>
                  {/* NO Hire BUTTON AND NO Release BUTTON (2026-10-06). The
                      field IS the decision: blur commits it, and winding it
                      back to 0 — the off step — is what Release did. A button
                      beside a field that already applies itself is a second
                      way to do one thing, and the two would disagree the
                      moment one of them grew a guard the other lacked. */}
                </div>

                {/* What it COSTS, then what it GIVES - and every figure
                    resolves to the level TYPED, not an L1→L4 range, which made
                    you interpolate to find what you were actually buying. One
                    six-column grid so the two rows share gutters: costs take
                    halves, outcomes take thirds. */}
                <div className="grid grid-cols-6 gap-2">
                  {/* No COST chip when cost IS the input — it would restate the
                      field directly above it. On a level-driven lever the cost
                      is a consequence the player has not typed, so it stays. */}
                  {control !== 'cost' && (
                    <StatChip className="col-span-3" label="Cost" value={fmt$(lv.cost)} tone="money" />
                  )}
                  {/* "Running on" once paid for, "To activate" at the off step
                      — where the figure is the NEXT step's, not this one's
                      zero. Same rule and same wording as the marketing lever. */}
                  <StatChip
                    className="col-span-3"
                    label={atZero ? 'To activate' : 'Running on'}
                    value={<EnergyValue amount={energyShown} size={13} />}
                    tone="energy"
                  />
                  {/* ONE CHIP PER IMPACT THIS HIRE ACTUALLY CARRIES.
                      It was two fixed chips — "Capacity Increase" and "Cost
                      reduction" — so every hire showed both and one of them
                      always read "—". Production carries `inventory`, R&D
                      carries `dynamic_cost`, and each now describes itself.
                      The sign comes from the registry's `format` and the tone
                      from `betterWhen`, which is why R&D's cut renders as
                      "-15%" and still reads as good. */}
                  {lv.effects.map((e) => (
                    <StatChip
                      key={e.key}
                      className="col-span-3"
                      label={e.presentation.label}
                      value={e.contribution !== 0 ? e.presentation.format(e.contribution) : '—'}
                      // `ChipTone` has no adverse hue — one colour per meaning,
                      // and nothing in this panel has needed "this is working
                      // against you" yet. `muted` until the chip system gets
                      // one; no hiring impact is currently `bad`.
                      tone={e.tone === 'good' ? 'good' : 'muted'}
                    />
                  ))}
                  {/* Units to sell for the cost saving to cover the wage:
                      `lv.cost / (dynamicCost × costReduction)`, on the server's
                      own `dynamicCost`.

                      RENDERED ONLY WHEN THIS HIRE CUTS COST. It is specific to
                      `dynamic_cost` — there is no breakeven to state for a
                      capacity hire — so it is gated on the IMPACT being
                      present, not on the item being R&D. A hire that does not
                      carry `dynamic_cost` simply does not get the chip,
                      instead of getting one that reads "—". */}
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
      )}

      {/* ── Shipping vendor — COMPANY-WIDE, like every other global input. The
           active notebook is still needed to render the cards, because coverage
           (`productsImpacted`) and the per-product override are shown relative
           to a product; the decision itself is not per line. ── */}
      {shows('vendor') && (
      <OpsSection
        icon={SECTION_ICON.vendor}
        title="Vendor"
        hint={
          activeLine
            ? `Company-wide. Figures shown for ${activeLine.name} — some vendors only supply certain notebooks.`
            : 'Add a notebook first.'
        }
      >
        {activeLine ? (
          <div className="flex flex-col gap-2">
            {/* ONE PER ROW — the last `grid-cols-2` in this panel. Two vendor
                cards side by side in a rail capped at 40vw squeezed both;
                stacked, each gets the full track.

                NO `max-h` and NO scroller of its own. The RAIL is the one
                scroller — a second one here would be a scrollbar inside a
                scrollbar, and it would cut the list off at an arbitrary height
                while the section around it still had room. */}
            <div className="grid grid-cols-1 gap-2">
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
      )}

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
  img,
  label,
  hint,
  value,
  max,
  spend,
  energy,
  effectLabel,
  effect,
  canActivate,
  onChange,
  onCommit,
}: {
  /** Operator art from PlayerConfig, keyed by the backend item's `key`.
   *  Undefined renders the fallback icon, same as the hiring rows. */
  img?: string;
  label: string;
  hint: string;
  /** INDEX into the backend item's configured option steps — not a dollar amount. */
  value: number;
  /** Highest valid index, i.e. `options` key count − 1. */
  max: number;
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
      {/* Header row mirrors the hiring cards: art left, name + blurb right. */}
      <div className="flex items-start gap-3">
        <SafeImage
          src={img}
          alt=""
          className={clsx('shrink-0 w-16 h-16 object-contain', !active && 'grayscale-[45%] opacity-80')}
          fallbackIcon="megaphone"
          fallbackSize={32}
        />
        <div className="min-w-0 flex-1">
          <div className="h3 uppercase text-ink-900">{label}</div>
          <p className="body-xs text-text-2 mt-1">{hint}</p>
        </div>
      </div>

      {/* Three chips, because dragging the slider used to change exactly one
          number — the spend — and say nothing about what that money bought.
          The effect chip is the whole point of the lever. */}
      <div className="grid grid-cols-3 gap-2">
        {/* `spend` is already a per-phase figure — the step's configured cost —
            so it is NOT run through perPhase() the way the old daily-dollar
            slider value was. */}
        <StatChip label={`Spend / phase`} value={fmt$(spend)} tone={active ? 'money' : 'muted'} />
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
