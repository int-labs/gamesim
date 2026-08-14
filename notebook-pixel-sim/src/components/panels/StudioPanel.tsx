import { useEffect, useState } from 'react';
import { useGame, DEFAULT_SHOP_NAME, MAX_SHOP_NAME } from '@/state/store';
import {
  setGlobalInputSelection, clearGlobalInputSelection,
  engageFinlitVendor, clearFinlitVendor, setShopName,
} from '@/engine/mockEngine';
import {
  VENDORS, vendorCoverage,
  type VendorId, type GenreId,
} from '@/data/finlit';
import { useGamesimSession } from '@/gamesim/GamesimProvider';
import { getImageAssets, type ImageAssetDto } from '@/gamesim/client';
import type { GlobalInputDto, GlobalInputImpactDto } from '@/gamesim/types';
import { fmt$, perPhase } from '@/utils/format';
import { DAYS_PER_PHASE } from '@/engine/config';
import { playSfx } from '@/audio/audioManager';
import { PixelModal } from '@/components/primitives/PixelModal';
import { CostTiles, ImpactList, type CostTile } from '@/components/primitives/CostTiles';
import { PixelBadge, PixelButton } from '@/components/primitives';
import { SafeImage } from '@/components/primitives/SafeImage';
import { A } from '@/assets';
import { studyFor, type CaseStudy } from '@/content/finlitCaseStudies';
import { OpsSection, StatChip, OperationsDetailModal, type DetailInput } from './OperationsKit';
import { vendorDetail, type SectionDetail } from './operationsDetails';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { EnergyValue } from '@/components/primitives/EnergyValue';

/** Format backend impact entries into readable strings for ImpactList. */
function formatImpacts(impacts: Record<string, GlobalInputImpactDto>): string[] {
  return Object.entries(impacts).map(([key, v]) => {
    const sign = v.value >= 0 ? '+' : '';
    const val = v.type === 'relative'
      ? `${sign}${(v.value * 100).toFixed(0)}%`
      : `${sign}${v.value}`;
    return `${key}: ${val}`;
  });
}

/** Build an OperationsDetailModal payload from a GlobalInput container. */
function buildGlobalInputDetail(container: GlobalInputDto, inputs: GlobalInputItem[]): SectionDetail {
  return {
    title: container.label,
    intro: container.description ?? `Options for ${container.label}.`,
    inputs: inputs.map((item): DetailInput => ({
      name: item.label,
      description: item.description ?? '',
      cost: item.cost > 0 ? `${fmt$(item.cost)}/day` : undefined,
      energy: item.energy > 0 ? item.energy : undefined,
      impacts: item.productsImpacted.length ? 'Selected products' : 'All products',
      effect: (item.impactLevel ?? formatImpacts(item.impacts ?? {}).join(', ')) || '–',
    })),
    tables: [],
  };
}

/** Section header art. */
const SECTION_ICON = {
  shop: A.ui.sidebar.product,
  vendor: A.ui.studioOps.supplier,
  globalInput: A.ui.commercial.campaign,
};

/** Storefront art per vendor. */
const VENDOR_ICON: Record<string, string> = {
  als: A.ui.studioOps.supplier,
  emils: A.ui.commercial.bulk_order,
  phoebes: A.ui.studioOps.inventory_shelf,
  nines: A.ui.commercial.limited_drop,
};

type GlobalInputItem = GlobalInputDto['inputs'][number];
type Pending =
  | { kind: 'vendor'; id: VendorId; energy: number; study: CaseStudy }
  | { kind: 'globalInput'; item: GlobalInputItem; containerInputs: GlobalInputItem[]; containerType: string; isSelected: boolean; pendingStepKey?: string };

function vendorEngageSummary(
  id: VendorId,
  energy: number,
  vendorLevel: 1 | 2,
  genre: GenreId | undefined,
): { tiles: CostTile[]; effects: string[] } {
  const tiles: CostTile[] = [{ label: 'Energy to unlock', value: `${energy}`, tone: 'energy', icon: 'energy' }];
  const effects: string[] = [];
  const cov = genre ? vendorCoverage(id, vendorLevel, genre) : undefined;
  if (cov && cov.quality !== 'none') {
    tiles.push({ label: 'Daily cost', value: fmt$(cov.cost), tone: 'cost', icon: 'cash' });
    effects.push(
      `+${(cov.sellBonus * 100).toFixed(1)}% sell-rate`,
      `+${cov.prodBonus.toFixed(1)} produced / day`,
      `${cov.quality} quality`,
    );
  }
  return { tiles, effects };
}

/**
 * StudioPanel — the company-decision hub. Company-wide operations (channels,
 * hiring, budgets) are now driven by backend-configured GlobalInputs so the
 * operator can add, remove, or re-price them without a frontend deploy.
 * Shipping vendor (per-line) remains engine-managed.
 */
export function StudioPanel() {
  const { bootstrap } = useGamesimSession();
  const [imageAssets, setImageAssets] = useState<ImageAssetDto[]>([]);
  const [imageAssetsReady, setImageAssetsReady] = useState(false);

  useEffect(() => {
    getImageAssets()
      .then((assets) => { setImageAssets(assets); })
      .catch(() => {})
      .finally(() => { setImageAssetsReady(true); });
  }, []);

  const energy = useGame((s) => s.player.energy);
  const globalInputSelections = useGame((s) => s.globalInputSelections ?? []);
  const phase = useGame((s) => s.meta.phase);
  const activeLine = useGame((s) =>
    s.portfolio.productLines.find((l) => l.id === s.portfolio.activeLineId) ?? s.portfolio.productLines[0],
  );
  const shopName = useGame((s) => s.meta.shopName);
  const apply = useGame((s) => s.apply);
  const [pending, setPending] = useState<Pending | null>(null);
  const [shopDraft, setShopDraft] = useState<string | null>(null);
  const [detail, setDetail] = useState<SectionDetail | null>(null);

  const day = useGame((s) => s.meta.day);
  const daysLeftInPhase = Math.max(0, phase * DAYS_PER_PHASE - day + 1);

  const vendorLevel = phase >= 2 ? 2 : 1;
  const vendorRefund = activeLine?.vendor
    ? VENDORS.find((v) => v.id === activeLine.vendor)!.energyByLevel[vendorLevel]
    : 0;

  // Helpers — reads from the already-selected snapshot (no Zustand selector needed).
  const isSelected = (key: string) => globalInputSelections.some((s) => s.key === key);
  const selectedStep = (key: string) =>
    globalInputSelections.find((s) => s.key === key)?.selectedStepKey ?? null;

  const commit = () => {
    if (!pending || pending.kind !== 'vendor') return;
    const ok = pending.energy <= energy;
    playSfx(ok ? 'confirm' : 'fail');
    apply((s) => engageFinlitVendor(s, pending.id));
    setPending(null);
  };

  const commitGlobalInput = () => {
    if (!pending || pending.kind !== 'globalInput') return;
    const { item, containerInputs, containerType, isSelected: currentlySelected, pendingStepKey } = pending;
    if (!currentlySelected) {
      if (item.energy > energy) { playSfx('fail'); return; }
      playSfx('confirm');
      apply((s) => {
        if (containerType === 'radio') {
          for (const inp of containerInputs) {
            if (s.globalInputSelections.some((sel: { key: string }) => sel.key === inp.key)) {
              clearGlobalInputSelection(s, inp.key, inp.energy);
            }
          }
        }
        setGlobalInputSelection(s, item.key, pendingStepKey ?? null, item.energy);
      });
    } else {
      playSfx('click-soft');
      apply((s) => clearGlobalInputSelection(s, item.key, item.energy));
    }
    setPending(null);
  };

  // Pre-compute image indices: imageAssets[i] maps to the i-th GlobalInput item
  // globally (across all containers, in the order they arrive from the server).
  let imgIdx = 0;
  const enrichedContainers = (bootstrap?.globalInputs ?? [])
    .filter((container) => container.category !== 'difficulty')
    .map((container) => ({
      container,
      items: container.inputs.map((item) => ({ item, imgIndex: imgIdx++ })),
    }));

  return (
    <div className="flex flex-col gap-4">
      {/* ── Your shop name ── */}
      <OpsSection icon={SECTION_ICON.shop} title="Your Shop" hint="Your business name. Costs nothing, change it whenever you like.">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <input
            value={shopDraft ?? shopName}
            onChange={(e) => setShopDraft(e.target.value)}
            onBlur={() => { apply((s) => setShopName(s, shopDraft ?? shopName)); setShopDraft(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            maxLength={MAX_SHOP_NAME}
            aria-label="Shop name"
            placeholder={DEFAULT_SHOP_NAME}
            className="w-full max-w-[340px] bg-cream-50 border-2 border-border text-text section-title outline-none focus:border-primary px-3 py-2"
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

      {/* ── Operator-configured GlobalInput sections ──
           Each container maps to one OpsSection. The backend operator decides
           the categories (channels, hiring, budgets, etc.) — the frontend just
           renders them generically. Held until imageAssetsReady so images are
           present before any card mounts (avoids flashing placeholder boxes). */}
      {!imageAssetsReady && enrichedContainers.length > 0 && (
        <div className="flex items-center justify-center py-8">
          <span className="eyebrow eyebrow-sm text-text-3 animate-pulse">Loading options…</span>
        </div>
      )}
      {imageAssetsReady && enrichedContainers.map(({ container, items }) => (
        <GlobalInputSection
          key={container._id}
          container={container}
          items={items}
          imageAssets={imageAssets}
          energy={energy}
          isSelected={isSelected}
          selectedStep={selectedStep}
          daysLeftInPhase={daysLeftInPhase}
          onCardClick={(item) => {
            playSfx('click-soft');
            setPending({
              kind: 'globalInput',
              item,
              containerInputs: container.inputs,
              containerType: container.type,
              isSelected: isSelected(item.key),
            });
          }}
          onSliderStep={(item, stepKey) => {
            // Already engaged — direct step change, no modal.
            playSfx('tick');
            apply((s) => setGlobalInputSelection(s, item.key, stepKey));
          }}
          onSliderEngage={(item, stepKey) => {
            // First engagement on a slider — gate through the case-study modal.
            playSfx('click-soft');
            setPending({
              kind: 'globalInput',
              item,
              containerInputs: container.inputs,
              containerType: container.type,
              isSelected: false,
              pendingStepKey: stepKey,
            });
          }}
          onClearAll={() => {
            playSfx('click-soft');
            apply((s) => {
              for (const inp of container.inputs) {
                if (s.globalInputSelections.some((sel: { key: string }) => sel.key === inp.key)) {
                  clearGlobalInputSelection(s, inp.key, inp.energy);
                }
              }
            });
          }}
          onDetails={() => setDetail(buildGlobalInputDetail(container, container.inputs))}
        />
      ))}

      {/* ── Shipping vendor (per active line) ── */}
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
                      on ? 'border-ink-900 bg-success-soft'
                      : stocks && affordable ? 'border-ink-900 bg-surface hover:bg-cream-100'
                      : 'border-border-soft bg-surface-2 opacity-50 cursor-not-allowed',
                    )}
                    title={stocks ? `${cov.quality} · +${(cov.sellBonus * 100).toFixed(1)}% sell · ${cost}⚡ to unlock · ${fmt$(perPhase(cov.cost))} per phase (${fmt$(cov.cost)}/day)` : `Doesn't stock ${activeLine.genre ?? 'indie'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <SafeImage
                        src={VENDOR_ICON[v.id]}
                        alt=""
                        className="shrink-0 w-12 h-12 object-contain"
                        fallbackIcon="box"
                        fallbackSize={32}
                      />
                      <span className="h2 uppercase text-ink-900 truncate flex-1 min-w-0">{v.name}</span>
                      {stocks && <PixelBadge tone={cov.quality === 'perfect' ? 'success' : 'neutral'}>{cov.quality}</PixelBadge>}
                    </div>
                    {stocks ? (
                      <div className="grid grid-cols-3 gap-1.5 mt-2">
                        <StatChip label="Sell" value={`+${(cov.sellBonus * 100).toFixed(1)}%`} tone="good" />
                        <StatChip label="Per phase" value={fmt$(perPhase(cov.cost))} tone="money" />
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
              <PixelButton
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => { playSfx('click-soft'); apply((s) => clearFinlitVendor(s)); }}
              >
                Clear vendor · refund <EnergyValue amount={vendorRefund} className="ml-1" />
              </PixelButton>
            )}
          </div>
        ) : null}
      </OpsSection>

      {/* Per-section reference sheet. */}
      <OperationsDetailModal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.title ?? ''}
        intro={detail?.intro}
        inputs={detail?.inputs ?? []}
        tables={detail?.tables ?? []}
      />

      {/* Case-study modal for GlobalInput item engagement / removal. */}
      <PixelModal
        open={pending?.kind === 'globalInput'}
        onClose={() => setPending(null)}
        title={pending?.kind === 'globalInput' ? `Case Study · ${pending.item.label}` : ''}
        width="min(520px, calc(100vw - 32px))"
      >
        {pending?.kind === 'globalInput' && (() => {
          const { item, isSelected: currentlySelected, pendingStepKey } = pending;
          const short = !currentlySelected && item.energy > energy;
          const tiles: CostTile[] = [];
          const stepMult = (pendingStepKey && item.options?.[pendingStepKey]) ? item.options[pendingStepKey] : 1;
          if (item.energy > 0) tiles.push({ label: 'Energy to engage', value: `${item.energy}`, tone: 'energy', icon: 'energy' });
          if (item.cost > 0) tiles.push({ label: `${daysLeftInPhase}d cost`, value: fmt$(item.cost * stepMult * daysLeftInPhase), tone: 'cost', icon: 'cash' });
          const impacts = formatImpacts(item.impacts ?? {});
          return (
            <div className="flex flex-col gap-4">
              {item.description && (
                <p className="body-sm text-text leading-relaxed">{item.description}</p>
              )}
              {(item.impactLevel || pendingStepKey) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {pendingStepKey && (
                    <div className="readout bg-success-soft/50 px-3 py-2.5">
                      <div className="stat-label text-success">Selected option</div>
                      <div className="body-xs text-text mt-1.5 strong">{pendingStepKey}</div>
                    </div>
                  )}
                  {item.impactLevel && (
                    <div className="readout bg-warning-soft/50 px-3 py-2.5">
                      <div className="stat-label text-warning">Impact level</div>
                      <div className="body-xs text-text mt-1.5">{item.impactLevel}</div>
                    </div>
                  )}
                </div>
              )}
              {tiles.length > 0 && <CostTiles tiles={tiles} />}
              {impacts.length > 0 && <ImpactList items={impacts} />}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-border-soft mt-1 -mx-1 px-1 pt-3.5">
                {short && (
                  <span className="mr-auto self-center inline-flex items-center gap-1.5 border-2 border-danger bg-danger-soft/50 px-2.5 py-1.5">
                    <span className="stat-label text-danger">Not enough energy</span>
                  </span>
                )}
                <PixelButton variant="ghost" size="md" onClick={() => setPending(null)}>Back</PixelButton>
                {currentlySelected ? (
                  <PixelButton variant="ghost" size="md" onClick={commitGlobalInput}>
                    Remove · refund <EnergyValue amount={item.energy} className="ml-1" />
                  </PixelButton>
                ) : (
                  <PixelButton variant="primary" size="md" disabled={short} onClick={commitGlobalInput}>
                    Engage{item.energy > 0 && <> · <EnergyValue amount={item.energy} className="ml-1" /></>}
                  </PixelButton>
                )}
              </div>
            </div>
          );
        })()}
      </PixelModal>

      {/* Case-study gate for vendor engagement. */}
      <PixelModal
        open={pending?.kind === 'vendor'}
        onClose={() => setPending(null)}
        title={pending?.kind === 'vendor' ? `Case Study · ${pending.study.title}` : ''}
        width="min(520px, calc(100vw - 32px))"
      >
        {pending?.kind === 'vendor' && (() => {
          const short = pending.energy > energy;
          const { tiles, effects } = vendorEngageSummary(pending.id, pending.energy, vendorLevel, activeLine?.genre);
          return (
            <div className="flex flex-col gap-4">
              <p className="body-sm text-text leading-relaxed">{pending.study.brief}</p>
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
              <CostTiles tiles={tiles} />
              {effects.length > 0 && <ImpactList items={effects} />}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-border-soft mt-1 -mx-1 px-1 pt-3.5">
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

// ── Generic GlobalInput section ──────────────────────────────────────────────

type EnrichedItem = { item: GlobalInputItem; imgIndex: number };

function GlobalInputSection({
  container,
  items,
  imageAssets,
  energy,
  isSelected,
  selectedStep,
  daysLeftInPhase,
  onCardClick,
  onSliderStep,
  onSliderEngage,
  onClearAll,
  onDetails,
}: {
  container: GlobalInputDto;
  items: EnrichedItem[];
  imageAssets: ImageAssetDto[];
  energy: number;
  isSelected: (key: string) => boolean;
  selectedStep: (key: string) => string | null;
  daysLeftInPhase: number;
  onCardClick: (item: GlobalInputItem) => void;
  onSliderStep: (item: GlobalInputItem, stepKey: string) => void;
  onSliderEngage: (item: GlobalInputItem, stepKey: string) => void;
  onClearAll: () => void;
  onDetails: () => void;
}) {
  const type = container.type as 'checkbox' | 'radio' | 'slider';
  const hasAnySelected = items.some(({ item }) => isSelected(item.key));

  const hint = daysLeftInPhase < DAYS_PER_PHASE
    ? `${daysLeftInPhase}d left this phase — costs recur while engaged.`
    : undefined;

  return (
    <OpsSection
      icon={SECTION_ICON.globalInput}
      title={container.label}
      hint={hint}
      onDetails={onDetails}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {items.map(({ item, imgIndex }) => {
          const img = imageAssets[imgIndex];
          const active = isSelected(item.key);
          const step = selectedStep(item.key);
          const stepKeys = Object.keys(item.options ?? {});
          const isSlider = type === 'slider';
          const stepIdx = step ? stepKeys.indexOf(step) : -1;

          return (
            <motion.div
              key={item.key}
              className={clsx(
                'flex flex-col gap-2 p-3 border-2 border-ink-900',
                !isSlider && 'cursor-pointer',
                active ? 'bg-success-soft' : 'bg-surface',
              )}
              onClick={!isSlider ? () => onCardClick(item) : undefined}
              whileHover={!isSlider ? { y: -3 } : undefined}
              whileTap={!isSlider ? { scale: 0.97 } : undefined}
              transition={{ type: 'spring', stiffness: 340, damping: 20 }}
            >
              <div className="flex items-start justify-between gap-2">
                {img?.url ? (
                  <SafeImage
                    src={img.url}
                    alt=""
                    className="w-20 h-20 object-contain shrink-0"
                    style={{ imageRendering: 'pixelated' }}
                    fallbackIcon="hire"
                    fallbackSize={56}
                  />
                ) : (
                  <div className="w-20 h-20 shrink-0 bg-surface-2 border border-border-soft" />
                )}
                <span className={clsx(
                  'shrink-0 px-2 py-1',
                  active ? 'bg-success text-ink-900' : 'bg-surface-2',
                )}>
                  <span className={clsx('eyebrow eyebrow-sm', active ? 'text-ink-900' : 'eyebrow-muted')}>
                    {active ? (step ?? 'On') : 'Off'}
                  </span>
                </span>
              </div>

              <div className="min-w-0">
                <div className="h2 uppercase text-ink-900">{item.label}</div>
                {item.description && (
                  <p className="body-xs text-text-2 mt-1 measure">{item.description}</p>
                )}
              </div>

              {(() => {
                const mult = (step && item.options?.[step]) ? item.options[step] : 1;
                const effectiveCost = item.cost * mult;
                return (
                  <div className="grid grid-cols-2 gap-2 mt-auto">
                    {item.cost > 0 && (
                      <StatChip
                        label={`${daysLeftInPhase}d cost`}
                        value={fmt$(effectiveCost * daysLeftInPhase)}
                        tone={active ? 'money' : 'muted'}
                      />
                    )}
                    <StatChip label={active ? 'Running on' : 'To engage'} value={<EnergyValue amount={item.energy} size={13} />} tone="energy" />
                  </div>
                );
              })()}

              {/* Slider — real range input, same pattern as BudgetLever. Card is
                  not clickable; user drags to set the step. First drag opens the
                  case-study modal; subsequent drags are direct step switches. */}
              {isSlider && stepKeys.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-1" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="range"
                    min={0}
                    max={stepKeys.length - 1}
                    step={1}
                    value={stepIdx >= 0 ? stepIdx : 0}
                    disabled={!active && item.energy > energy}
                    className={clsx(
                      'w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
                      active ? 'accent-primary' : 'accent-border',
                    )}
                    onChange={(e) => {
                      const idx = parseInt(e.target.value, 10);
                      const sk = stepKeys[idx];
                      if (!active) {
                        onSliderEngage(item, sk);
                      } else {
                        onSliderStep(item, sk);
                      }
                    }}
                  />
                  <div className="flex justify-between px-0.5">
                    {stepKeys.map((sk) => (
                      <span
                        key={sk}
                        className={clsx(
                          'stat-label leading-none',
                          step === sk ? 'text-primary strong' : 'text-text-3',
                        )}
                      >
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {hasAnySelected && (
        <PixelButton variant="ghost" size="sm" className="self-start mt-1" onClick={onClearAll}>
          Clear all · refund energy
        </PixelButton>
      )}
    </OpsSection>
  );
}
