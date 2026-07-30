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
import { SafeImage } from '@/components/primitives/SafeImage';
import { A } from '@/assets';
import { studyFor, type CaseStudy } from '@/content/finlitCaseStudies';
import clsx from 'clsx';

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
  const tiles: CostTile[] = [{ label: 'Energy to unlock', value: `${p.energy}⚡`, tone: 'energy', icon: 'energy' }];
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
      <div className="flex items-center justify-between text-[16px]">
        <span className="text-text-2">Company decisions · reversible (clearing refunds energy)</span>
        <span className="font-bold text-warning tabular-nums">⚡ {energy} energy</span>
      </div>

      {/* ── Your shop — the company's name. Also renameable from the shop sign
           on the desk (Product page); both write through setShopName. ── */}
      <Section title="Your Shop" hint="Your business name. Costs nothing, change it whenever you like.">
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
          className="w-full max-w-[340px] bg-cream-50 border-2 border-border text-text font-hud text-[15px] uppercase outline-none focus:border-primary px-3 py-2"
        />
      </Section>

      {/* ── Sales channels — WHERE you sell. Company-wide: every notebook ships
           through the same channels, so this is one decision, not one per SKU. ── */}
      <Section title="Sales Channels" hint="Where you sell. Applies to every notebook. Each channel adds reach at a daily overhead.">
        <div className="flex flex-col gap-2">
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
              <button
                key={ch}
                onClick={() => {
                  if (isLastOn) { playSfx('fail'); return; }
                  playSfx('click-soft');
                  apply((s) => toggleFinlitChannelAll(s, ch));
                }}
                title={isLastOn ? 'You need at least one channel to sell through.' : undefined}
                className={clsx(
                  'ctl-btn flex items-center justify-between gap-2 px-3 py-2.5 border-2 text-left transition-all active:scale-[0.99]',
                  on ? 'border-success bg-success-soft' : 'border-border-soft bg-surface hover:border-border',
                )}
              >
                <div className="min-w-0">
                  <div className="text-[17px] font-bold text-text leading-tight">{CHANNEL_META[ch].name}</div>
                  <div className="text-[13px] font-medium text-text-3 leading-tight mt-0.5">{CHANNEL_META[ch].blurb}</div>
                  <div className="text-[14px] text-text-3 leading-tight mt-1">
                    reach <span className="font-bold text-info">{lo === hi ? `${lo}%` : `${lo}-${hi}%`}</span>
                    {' · '}<span className="text-warning font-bold">{fmt$(row.maintenance)}/day</span>
                    {row.consignment > 0 && <> · <span className="text-warning font-bold">{fmt$(row.consignment)}/sale</span></>}
                  </div>
                </div>
                <span className={clsx(
                  'shrink-0 text-[14px] font-bold px-2 py-1 border tabular-nums',
                  on ? 'border-success text-success bg-surface' : 'border-border-soft text-text-3',
                )}>
                  {on ? 'ON' : 'OFF'}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Marketing & Sales budgets ── */}
      <Section title="Marketing & Sales Budget" hint="Spend $/day to grow the business. Each lever costs energy to switch on; drag to $0 to switch off (energy refunded).">
        <div className="flex flex-col gap-2">
          <BudgetLever
            label="Marketing budget"
            hint="Awareness - lifts DEMAND (more people want it)."
            value={marketingBudget}
            energy={BUDGET_LEVER_ENERGY}
            effectLabel={`+${Math.round((marketingDemandMult(marketingBudget) - 1) * 100)}% demand`}
            effectTone="text-info"
            canActivate={marketingBudget > 0 || energy >= BUDGET_LEVER_ENERGY}
            onChange={(v) => { playSfx('tick'); apply((s) => setFinlitMarketingBudget(s, v)); }}
          />
          <BudgetLever
            label="Sales budget"
            hint="Conversion - lifts SELL-RATE (more of them buy)."
            value={salesBudget}
            energy={BUDGET_LEVER_ENERGY}
            effectLabel={`+${(salesSellBonus(salesBudget) * 100).toFixed(1)}% sell-rate`}
            effectTone="text-success"
            canActivate={salesBudget > 0 || energy >= BUDGET_LEVER_ENERGY}
            onChange={(v) => { playSfx('tick'); apply((s) => setFinlitSalesBudget(s, v)); }}
          />
        </div>
      </Section>

      {/* ── Hiring ── */}
      <Section title="Hiring" hint="Adds production + sell-rate. Higher levels cost more energy to unlock.">
        <div className="flex flex-col gap-2">
          {CANDIDATES.map((c) => {
            const engaged = hire?.candidate === c.id;
            const curLevel = engaged ? hire!.level : 0;
            return (
              <div key={c.id} className={clsx('border-2 px-2.5 py-2 flex gap-2.5', engaged ? 'border-primary bg-primary-soft' : 'border-border-soft bg-surface')}>
                {/* Candidate portrait — a big visual hook, sized to the card. */}
                <div className={clsx('shrink-0 self-stretch flex items-center justify-center w-14 border-2 bg-surface-2', engaged ? 'border-primary' : 'border-border-soft')}>
                  <SafeImage
                    src={CANDIDATE_ICON[c.id]}
                    alt=""
                    className="w-11 h-11 object-contain"
                    fallbackIcon="hire"
                    fallbackSize={30}
                  />
                </div>
                <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[17px] font-bold text-text">{c.name}</span>
                  {engaged && <span className="text-[15px] font-bold text-primary">L{curLevel} hired</span>}
                </div>
                <div className="text-[14px] text-text-3 leading-tight mb-1.5">{c.blurb}</div>
                <div className="flex gap-1">
                  {c.levels.map((lv) => {
                    const affordable = energy >= lv.energy;
                    const isCur = engaged && curLevel === lv.level;
                    return (
                      <button
                        key={lv.level}
                        disabled={!affordable || isCur}
                        onClick={() => { playSfx('click-soft'); setPending({ kind: 'candidate', id: c.id as CandidateId, level: lv.level, energy: lv.energy, study: studyFor('candidate', c.id)! }); }}
                        className={clsx(
                          'ctl-btn flex-1 text-[15px] py-1 border-2 font-bold transition-all leading-tight',
                          isCur ? 'border-primary bg-primary text-white'
                          : affordable ? 'border-border-soft bg-surface hover:border-primary text-text active:scale-95'
                          : 'border-border-soft bg-surface-2 text-text-3 opacity-50 cursor-not-allowed',
                        )}
                        title={`L${lv.level}: +${lv.prodBonus.toFixed(2)} prod, +${(lv.sellBonus * 100).toFixed(1)}% sell · ${lv.energy}⚡ to unlock · ${fmt$(lv.cost)}/day`}
                      >
                        L{lv.level}<br /><span className="text-warning">{lv.energy}⚡</span> · {fmt$(lv.cost)}
                      </button>
                    );
                  })}
                </div>
                </div>
              </div>
            );
          })}
          {hire && (
            <button onClick={() => { playSfx('click-soft'); apply((s) => clearFinlitHire(s)); }} className="text-[15px] font-bold text-text-3 hover:text-danger self-start">
              ✕ Clear hire · refund {hireRefund}⚡
            </button>
          )}
        </div>
      </Section>

      {/* ── Shipping vendor (active line) ── */}
      <Section title="Shipping Vendor" hint={activeLine ? `For ${activeLine.name} (${activeLine.genre ?? 'indie'}). Adds sell + production if it stocks the genre.` : 'Add a notebook first.'}>
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
                    <div className="text-[16px] font-bold text-text leading-tight">{v.name}</div>
                    {stocks ? (
                      <div className="text-[14px] text-text-3 mt-0.5">
                        {cov.quality} · +{(cov.sellBonus * 100).toFixed(1)}% · <span className="text-warning font-bold">{cost}⚡</span> · {fmt$(cov.cost)}/d
                      </div>
                    ) : (
                      <div className="text-[14px] text-text-3 mt-0.5">- no coverage</div>
                    )}
                  </button>
                );
              })}
            </div>
            {activeLine.vendor && (
              <button onClick={() => { playSfx('click-soft'); apply((s) => clearFinlitVendor(s)); }} className="text-[15px] font-bold text-text-3 hover:text-danger self-start">
                ✕ Clear vendor · refund {vendorRefund}⚡
              </button>
            )}
          </div>
        ) : null}
      </Section>

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
          <div className="flex flex-col gap-3 p-1">
            <p className="text-[18px] text-text leading-relaxed">{pending.study.brief}</p>
            <div className="border-l-4 border-success pl-3 py-1 bg-success-soft/40">
              <div className="text-[10.5px] uppercase tracking-[0.09em] font-bold text-text-2">Best when</div>
              <div className="text-[15px] text-text">{pending.study.bestWhen}</div>
            </div>
            <div className="border-l-4 border-warning pl-3 py-1 bg-warning-soft/40">
              <div className="text-[10.5px] uppercase tracking-[0.09em] font-bold text-text-2">Watch out</div>
              <div className="text-[15px] text-text">{pending.study.watchOut}</div>
            </div>

            {/* Prominent cost + impact — the numbers the player is committing to. */}
            <CostTiles tiles={tiles} />
            {effects.length > 0 && <ImpactList items={effects} />}

            <div className="flex items-center justify-end gap-2 pt-1">
              {short && <span className="text-[16px] font-bold text-danger mr-auto self-center">Not enough energy</span>}
              <button onClick={() => setPending(null)} className="px-3 py-1.5 text-[17px] border-2 border-border-soft bg-surface text-text-2 hover:text-text">Back</button>
              <button
                onClick={commit}
                disabled={short}
                className={clsx('px-3 py-1.5 text-[17px] font-bold border-2', short ? 'border-border-soft bg-surface-2 text-text-3 opacity-50 cursor-not-allowed' : 'border-primary bg-primary text-white hover:brightness-105 active:scale-95')}
              >
                Engage · {pending.energy}⚡
              </button>
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
  effectLabel,
  effectTone,
  canActivate,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  energy: number;
  effectLabel: string;
  effectTone: string;
  canActivate: boolean;
  onChange: (v: number) => void;
}) {
  const active = value > 0;
  return (
    <div className={clsx('border-2 px-2.5 py-2', active ? 'border-success bg-success-soft' : 'border-border-soft bg-surface')}>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[17px] font-bold text-text">{label}</span>
        <span className="text-[18px] font-bold tabular-nums text-text">{fmt$(value)}<span className="text-text-3 text-[15px]">/day</span></span>
      </div>
      <div className="text-[14px] text-text-3 leading-tight mb-1.5">{hint}</div>
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
      <div className="flex items-center justify-between mt-1 text-[15px]">
        <span className={clsx('font-bold', active ? effectTone : 'text-text-3')}>{active ? effectLabel : 'Off'}</span>
        <span className="text-text-3">
          {active ? <>Active · <span className="text-warning font-bold">{energy}⚡</span> to run</> : <><span className="text-warning font-bold">{energy}⚡</span> to activate</>}
        </span>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="text-[11px] uppercase tracking-[0.09em] font-bold text-text-2 mb-1">{title}</div>
      {hint && <div className="text-[12px] font-medium text-text-3 mb-1.5 leading-tight">{hint}</div>}
      {children}
    </section>
  );
}
