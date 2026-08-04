import { useState } from 'react';
import { useGame, DEFAULT_SHOP_NAME, MAX_SHOP_NAME } from '@/state/store';
import {
  engageFinlitHire, clearFinlitHire, engageFinlitVendor, clearFinlitVendor,
  setFinlitMarketingBudget, setFinlitSalesBudget,
  finlitCompanyChannels, toggleFinlitChannelAll, setShopName,
} from '@/engine/mockEngine';
import {
  CANDIDATES, VENDORS, hireLevel, vendorCoverage,
  BUDGET_MAX, BUDGET_LEVER_ENERGY, marketingDemandMult, salesSellBonus,
  CHANNEL_META, channelRow,
  type CandidateId, type VendorId, type GenreId, type ChannelId,
} from '@/data/finlit';
import { fmt$ } from '@/utils/format';
import { playSfx } from '@/audio/audioManager';
import { PixelModal } from '@/components/primitives/PixelModal';
import { CostTiles, ImpactList, type CostTile } from '@/components/primitives/CostTiles';
import { PixelBadge, PixelButton } from '@/components/primitives';
import { SafeImage } from '@/components/primitives/SafeImage';
import { A } from '@/assets';
import { studyFor, type CaseStudy } from '@/content/finlitCaseStudies';
import { OpsSection, StatChip, EnergyTag, OperationsDetailModal } from './OperationsKit';
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
  danoct: A.ui.studioOps.binding_machine,
};

// A pending pick — set when the player taps an option; the case-study modal
// then gates the actual engage (the PDF's "read before choosing").
type Pending =
  | { kind: 'candidate'; id: CandidateId; level: 1 | 2 | 3 | 4; energy: number; study: CaseStudy }
  | { kind: 'vendor'; id: VendorId; energy: number; study: CaseStudy };

// Turn a pending pick into the prominent cost tiles + impact chips the modal
// shows — energy to unlock (⚡) and ongoing $ cost kept as SEPARATE tiles.
function engageSummary(
  p: Pending,
  vendorLevel: 1 | 2,
  genre: GenreId | undefined,
): { tiles: CostTile[]; effects: string[] } {
  const tiles: CostTile[] = [{ label: 'Energy to unlock', value: `${p.energy}`, tone: 'energy', icon: 'energy' }];
  const effects: string[] = [];
  if (p.kind === 'candidate') {
    const lv = hireLevel(p.id, p.level);
    tiles.push({ label: 'Daily wage', value: fmt$(lv.cost), tone: 'cost', icon: 'cash' });
    effects.push(`+${lv.prodBonus.toFixed(2)} produced / day`, `+${(lv.sellBonus * 100).toFixed(1)}% sell-rate`);
  } else {
    const cov = genre ? vendorCoverage(p.id, vendorLevel, genre) : undefined;
    if (cov && cov.quality !== 'none') {
      tiles.push({ label: 'Daily cost', value: fmt$(cov.cost), tone: 'cost', icon: 'cash' });
      effects.push(
        `+${(cov.sellBonus * 100).toFixed(1)}% sell-rate`,
        `+${cov.prodBonus.toFixed(1)} produced / day`,
        `${cov.quality} quality`,
      );
    }
  }
  return { tiles, effects };
}

/**
 * StudioPanel — the V3 company-decision hub. Hire a candidate, set Marketing &
 * Sales budgets, and pick a shipping vendor for the active line. Each spends
 * ENERGY to set up (separate from the $/day money cost, which flows through the
 * phase P&L). Every decision is REVERSIBLE — clearing refunds the energy.
 */
export function StudioPanel() {
  const energy = useGame((s) => s.player.energy);
  const hire = useGame((s) => s.finlit.hire);
  const marketingBudget = useGame((s) => s.finlit.marketingBudget);
  const salesBudget = useGame((s) => s.finlit.salesBudget);
  const phase = useGame((s) => s.meta.phase);
  const activeLine = useGame((s) =>
    s.portfolio.productLines.find((l) => l.id === s.portfolio.activeLineId) ?? s.portfolio.productLines[0],
  );
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
  const [pending, setPending] = useState<Pending | null>(null);
  // null = not editing; the input falls back to the store value.
  const [shopDraft, setShopDraft] = useState<string | null>(null);
  // Which section's reference sheet is open, if any.
  const [detail, setDetail] = useState<SectionDetail | null>(null);

  const vendorLevel = phase >= 2 ? 2 : 1;
  const hireRefund = hire ? hireLevel(hire.candidate, hire.level).energy : 0;
  const vendorRefund = activeLine?.vendor ? VENDORS.find((v) => v.id === activeLine.vendor)!.energyByLevel[vendorLevel] : 0;

  const commit = () => {
    if (!pending) return;
    const ok = pending.energy <= energy;
    playSfx(ok ? 'confirm' : 'fail');
    apply((s) => {
      if (pending.kind === 'candidate') engageFinlitHire(s, pending.id, pending.level);
      else engageFinlitVendor(s, pending.id);
    });
    setPending(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between body-xs">
        <span className="text-text-2">Company decisions · reversible (clearing refunds energy)</span>
        <span className="num-xs text-warning inline-flex items-baseline gap-1"><EnergyValue amount={energy} /> energy</span>
      </div>

      {/* ── Your shop — the company's name. Also renameable from the shop sign
           on the desk (Product page); both write through setShopName. ── */}
      <OpsSection icon={SECTION_ICON.shop} title="Your Shop" hint="Your business name. Costs nothing, change it whenever you like.">
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
          className="w-full max-w-[340px] bg-cream-50 border-2 border-border text-text section-title outline-none focus:border-primary px-3 py-2"
        />
      </OpsSection>

      {/* ── Sales channels — WHERE you sell. Company-wide: every notebook ships
           through the same channels, so this is one decision, not one per SKU. ── */}
      <OpsSection
        icon={SECTION_ICON.channels}
        title="Sales Channels"
        hint="Where you sell. Applies to every notebook."
        onDetails={() => setDetail(channelDetail())}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.keys(CHANNEL_META) as ChannelId[]).map((ch) => {
            const on = companyChannels.has(ch);
            const isLastOn = on && companyChannels.size <= 1;
            // maintenance/consignment are the same for every genre; only reach
            // (split) differs, so show the range across the genres in play.
            const reaches = genresInPlay.map((g) => channelRow(g, ch).split);
            const lo = reaches.length ? Math.round(Math.min(...reaches) * 100) : 0;
            const hi = reaches.length ? Math.round(Math.max(...reaches) * 100) : 0;
            const row = channelRow(genresInPlay[0] ?? 'indie', ch);
            return (
              <motion.button
                key={ch}
                onClick={() => {
                  if (isLastOn) { playSfx('fail'); return; }
                  playSfx('click-soft');
                  apply((s) => toggleFinlitChannelAll(s, ch));
                }}
                title={isLastOn ? 'You need at least one channel to sell through.' : undefined}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 340, damping: 20 }}
                className={clsx(
                  'ctl-btn flex flex-col gap-2 p-3 border-2 text-left cursor-pointer',
                  on ? 'border-success bg-success-soft shadow-pixel-1' : 'border-border-soft bg-surface hover:border-border',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <img
                    src={CHANNEL_ICON[ch]}
                    alt=""
                    className="w-10 h-10 object-contain shrink-0"
                    style={{ imageRendering: 'pixelated' }}
                    draggable={false}
                  />
                  <span className={clsx(
                    'shrink-0 border-2 px-2 py-1',
                    on ? 'border-success bg-surface' : 'border-border-soft',
                  )}>
                    <span className={clsx('eyebrow eyebrow-sm', on ? 'text-success' : 'eyebrow-muted')}>
                      {on ? 'On' : 'Off'}
                    </span>
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="h3 uppercase text-ink-900">{CHANNEL_META[ch].name}</div>
                  <p className="body-xs text-text-2 mt-1">{CHANNEL_META[ch].blurb}</p>
                </div>

                {/* The numbers you're actually choosing between get to look
                    like values, not footnotes. */}
                <div className="grid grid-cols-2 gap-2 mt-auto">
                  <StatChip label="Reach" value={lo === hi ? `${lo}%` : `${lo}-${hi}%`} tone="reach" />
                  <StatChip label="Per day" value={fmt$(row.maintenance)} tone="money" />
                  {row.consignment > 0 && (
                    <StatChip label="Per sale" value={fmt$(row.consignment)} tone="money" className="col-span-2" />
                  )}
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
        hint="Spend $/day to grow. Set back to $0 to switch off and refund the energy."
        onDetails={() => setDetail(budgetDetail(BUDGET_LEVER_ENERGY, BUDGET_MAX, marketingDemandMult, salesSellBonus))}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <BudgetLever
            label="Marketing budget"
            hint="Awareness - lifts DEMAND (more people want it)."
            value={marketingBudget}
            energy={BUDGET_LEVER_ENERGY}
            canActivate={marketingBudget > 0 || energy >= BUDGET_LEVER_ENERGY}
            onChange={(v) => { playSfx('tick'); apply((s) => setFinlitMarketingBudget(s, v)); }}
          />
          <BudgetLever
            label="Sales budget"
            hint="Conversion - lifts SELL-RATE (more of them buy)."
            value={salesBudget}
            energy={BUDGET_LEVER_ENERGY}
            canActivate={salesBudget > 0 || energy >= BUDGET_LEVER_ENERGY}
            onChange={(v) => { playSfx('tick'); apply((s) => setFinlitSalesBudget(s, v)); }}
          />
        </div>
      </OpsSection>

      {/* ── Hiring ── */}
      <OpsSection
        icon={SECTION_ICON.hiring}
        title="Hiring"
        hint="One hire at a time. Adds production and sell-rate."
        onDetails={() => setDetail(hiringDetail())}
      >
        <div className="flex flex-col gap-2.5">
          {CANDIDATES.map((c) => {
            const engaged = hire?.candidate === c.id;
            const curLevel = engaged ? hire!.level : 0;
            return (
              <div key={c.id} className={clsx('border-2 px-2.5 py-2 flex gap-2.5', engaged ? 'border-primary bg-primary-soft' : 'border-border-soft bg-surface')}>
                {/* Candidate portrait. No frame: a box around a transparent
                    pixel sprite added a second border inside a bordered card
                    and boxed the art into a narrow column. Unframed it reads as
                    a character standing in the row, and the space that the
                    frame's padding was eating goes to the art instead. */}
                <SafeImage
                  src={CANDIDATE_ICON[c.id]}
                  alt=""
                  className="shrink-0 w-20 h-20 object-contain self-start"
                  fallbackIcon="hire"
                  fallbackSize={56}
                />
                <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="h3 uppercase text-ink-900">{c.name}</span>
                  {engaged && <PixelBadge tone="success">L{curLevel} hired</PixelBadge>}
                </div>
                <p className="body-xs text-text-2 mt-1 mb-2">{c.blurb}</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {c.levels.map((lv) => {
                    const affordable = energy >= lv.energy;
                    const isCur = engaged && curLevel === lv.level;
                    return (
                      <button
                        key={lv.level}
                        disabled={!affordable || isCur}
                        onClick={() => { playSfx('click-soft'); setPending({ kind: 'candidate', id: c.id as CandidateId, level: lv.level, energy: lv.energy, study: studyFor('candidate', c.id)! }); }}
                        className={clsx(
                          'ctl-btn flex flex-col items-center gap-1 py-2 px-1 border-2 transition-all',
                          isCur ? 'border-primary bg-primary-strong text-white'
                          : affordable ? 'border-border-soft bg-surface hover:border-primary text-text active:scale-95'
                          : 'border-border-soft bg-surface-2 text-text-3 opacity-50 cursor-not-allowed',
                        )}
                        title={`L${lv.level}: +${lv.prodBonus.toFixed(2)} prod, +${(lv.sellBonus * 100).toFixed(1)}% sell · ${lv.energy}⚡ to unlock · ${fmt$(lv.cost)}/day`}
                      >
                        {/* Level is the IDENTITY of the button, so it leads at
                            numeral scale. Wage and energy are what it costs —
                            quiet, and captioned so "$5" and "2" can't be
                            confused for each other. */}
                        <span className={clsx('num-md leading-none', isCur ? 'text-white' : 'text-ink-900')}>
                          L{lv.level}
                        </span>
                        <span className={clsx('stat-label stat-label-on-tint', isCur && 'text-white')}>
                          {fmt$(lv.cost)}/day
                        </span>
                        {!isCur && <EnergyTag amount={lv.energy} />}
                      </button>
                    );
                  })}
                </div>
                </div>
              </div>
            );
          })}
          {hire && (
            <button onClick={() => { playSfx('click-soft'); apply((s) => clearFinlitHire(s)); }} className="item-name text-text-3 hover:text-danger self-start">
              Clear hire · refund <EnergyValue amount={hireRefund} className="ml-1" />
            </button>
          )}
        </div>
      </OpsSection>

      {/* ── Shipping vendor (active line) ── */}
      <OpsSection
        icon={SECTION_ICON.vendor}
        title="Shipping Vendor"
        hint={activeLine ? `For ${activeLine.name}. Only helps if it stocks that market.` : 'Add a notebook first.'}
        onDetails={() => setDetail(vendorDetail(vendorLevel))}
      >
        {activeLine ? (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              {VENDORS.map((v) => {
                const cov = v.coverage[vendorLevel][(activeLine.genre ?? 'indie') as keyof typeof v.coverage[1]];
                const stocks = cov.quality !== 'none';
                const on = activeLine.vendor === v.id;
                const cost = v.energyByLevel[vendorLevel];
                const affordable = energy >= cost || on;
                return (
                  <button
                    key={v.id}
                    disabled={!stocks || (!affordable && !on)}
                    onClick={() => { playSfx('click-soft'); setPending({ kind: 'vendor', id: v.id as VendorId, energy: cost, study: studyFor('vendor', v.id)! }); }}
                    className={clsx(
                      'ctl-btn text-left px-2 py-2 border-2 transition-all active:scale-[0.98]',
                      on ? 'border-success bg-success-soft' : stocks && affordable ? 'border-border-soft bg-surface hover:border-border' : 'border-border-soft bg-surface-2 opacity-50 cursor-not-allowed',
                    )}
                    title={stocks ? `${cov.quality} · +${(cov.sellBonus * 100).toFixed(1)}% sell · ${cost}⚡ to unlock · ${fmt$(cov.cost)}/day` : `Doesn't stock ${activeLine.genre ?? 'indie'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="h3 uppercase text-ink-900 truncate">{v.name}</span>
                      {stocks && <PixelBadge tone={cov.quality === 'perfect' ? 'success' : 'neutral'}>{cov.quality}</PixelBadge>}
                    </div>
                    {stocks ? (
                      <div className="grid grid-cols-3 gap-1.5 mt-2">
                        <StatChip label="Sell" value={`+${(cov.sellBonus * 100).toFixed(1)}%`} tone="good" />
                        <StatChip label="Per day" value={fmt$(cov.cost)} tone="money" />
                        <StatChip label="Energy" value={<EnergyValue amount={cost} size={13} />} tone="energy" />
                      </div>
                    ) : (
                      <p className="body-xs text-text-3 mt-2">Doesn't stock this market.</p>
                    )}
                  </button>
                );
              })}
            </div>
            {activeLine.vendor && (
              <button onClick={() => { playSfx('click-soft'); apply((s) => clearFinlitVendor(s)); }} className="item-name text-text-3 hover:text-danger self-start">
                Clear vendor · refund <EnergyValue amount={vendorRefund} className="ml-1" />
              </button>
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
          const { tiles, effects } = engageSummary(pending, vendorLevel, activeLine?.genre);
          return (
          <div className="flex flex-col gap-4">
            {/* Who this is about. A case study with no face was just a wall of
                prose; the portrait anchors the brief and matches the roster row
                the player clicked to get here. */}
            <div className="flex items-start gap-3.5">
              {pending.kind === 'candidate' && (
                <SafeImage
                  src={CANDIDATE_ICON[pending.id]}
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
              <div className="border-2 border-success/45 bg-success-soft/40 px-3 py-2.5">
                <div className="stat-label text-success">Best when</div>
                <div className="body-xs text-text mt-1.5">{pending.study.bestWhen}</div>
              </div>
              <div className="border-2 border-warning/45 bg-warning-soft/40 px-3 py-2.5">
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
            <div className="flex items-center justify-end gap-2 pt-1 border-t-2 border-border-soft mt-1 -mx-1 px-1 pt-3.5">
              {short && (
                <span className="mr-auto self-center inline-flex items-center gap-1.5 border-2 border-danger bg-danger-soft/50 px-2.5 py-1.5">
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

/* A budget lever — a $/day slider with its live effect and activation energy.
   $0 = off; moving above 0 charges the flat activation energy (refunded when
   set back to 0). Money spend flows through the phase P&L. */
function BudgetLever({
  label,
  hint,
  value,
  energy,
  canActivate,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  energy: number;
  canActivate: boolean;
  onChange: (v: number) => void;
}) {
  const active = value > 0;
  return (
    <div className={clsx('border-2 p-3 flex flex-col gap-2', active ? 'border-success bg-success-soft shadow-pixel-1' : 'border-border-soft bg-surface')}>
      <div>
        <div className="h3 uppercase text-ink-900">{label}</div>
        <p className="body-xs text-text-2 mt-1">{hint}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatChip label="Spend" value={`${fmt$(value)}/day`} tone={active ? 'money' : 'muted'} />
        <StatChip
          label={active ? 'Running on' : 'To activate'}
          value={<EnergyValue amount={energy} size={13} />}
          tone="energy"
        />
      </div>

      <input
        type="range"
        min={0}
        max={BUDGET_MAX}
        step={1}
        value={value}
        disabled={!canActivate}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full accent-ui-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}
