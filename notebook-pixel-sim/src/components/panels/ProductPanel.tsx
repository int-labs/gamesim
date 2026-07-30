import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '@/state/store';
import {
  setProductField,
  placeAddOn,
  removeAddOn,
  currentAddOns,
} from '@/engine/mockEngine';
import { PixelChip, PixelBadge } from '@/components/primitives';
import { ADDONS, addOnById } from '@/data/addOns';
import { A } from '@/assets';
import type { AddOnDef, Archetype, Binding, Cover, PaperQuality, Size } from '@/types';
import clsx from 'clsx';
import { SafeImage } from '@/components/primitives/SafeImage';
import { PixelIcon } from '@/components/icons/PixelIcon';
import { playSfx } from '@/audio/audioManager';
import { Tooltip } from '@/components/primitives/Tooltip';

// Tooltip copy for each material/binding/size/paper option — explains
// trade-offs so the player learns what each choice DOES, not just
// what it's labelled.
const COVER_TIPS: Record<string, string> = {
  hardcover: 'Hardcover - sturdy, classic feel. Lower unit cost than leather, mid-range perceived value.',
  leather:   'Leather - premium feel. Higher unit cost, higher perceived value. Lifts price tolerance with picky audiences.',
};
const BINDING_TIPS: Record<string, string> = {
  ring:    'Ring binding - lays flat for note-takers. Slightly higher cost, broadly liked.',
  staple:  'Staple binding - cheapest option. Less premium but keeps unit cost down.',
};
const SIZE_TIPS: Record<string, string> = {
  s: 'Small - 33% surface area. Lower material cost. Add-ons render small.',
  m: 'Medium - 66% surface area. Balanced cost and visibility.',
  l: 'Large - full size. Highest material cost. Add-ons read clearly.',
};
const PAPER_TIPS: Record<string, string> = {
  cheap:    'Cheap paper - minimal cost. Fine for students; weak fit with creators.',
  standard: 'Standard paper - middle ground. Acceptable to all segments.',
  premium:  'Premium paper - highest unit cost. Loved by creators and professionals.',
};

const ARCHS: { id: Archetype; label: string; sample: string }[] = [
  { id: 'student', label: 'Student',       sample: A.notebook.student.hardcover_ring },
  { id: 'planner', label: 'Planner',       sample: A.notebook.planner.hardcover_ring },
  { id: 'daily',   label: 'Daily Journal', sample: A.notebook.daily.hardcover_ring },
];
const COVERS: Cover[] = ['hardcover', 'leather'];
const BINDINGS: Binding[] = ['ring', 'staple'];
const SIZES: Size[] = ['s', 'm', 'l'];
const PAPERS: PaperQuality[] = ['cheap', 'standard', 'premium'];

const ADDON_GROUPS: { label: string; cats: AddOnDef['category'][] }[] = [
  { label: 'Charms',    cats: ['integrated_charm'] },
  { label: 'Ribbons',   cats: ['integrated_ribbon'] },
  { label: 'Stickers',  cats: ['integrated_sticker_name', 'integrated_sticker_pack'] },
  { label: 'Functional',cats: ['functional_bookmark', 'functional_band', 'functional_closure'] },
];

/** Shared active-line accessor for the design/add-on drawer panels. */
function useActiveLine() {
  const product = useGame(
    (s) => s.portfolio.productLines.find((l) => l.id === s.portfolio.activeLineId)
      ?? s.portfolio.productLines[0],
  );
  const hasNotebook = useGame((s) => s.portfolio.productLines.length > 0);
  const apply = useGame((s) => s.apply);
  return { product, hasNotebook, apply };
}

function EmptyLine() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4 py-12 gap-2">
      <div className="text-[15px] font-bold text-text">No notebook selected</div>
      <p className="text-[13px] text-text-2 max-w-[28ch]">
        Open <span className="font-bold text-text">Notebook Items</span> in the left dock to add one.
      </p>
    </div>
  );
}

/**
 * DesignControls — the core notebook design inputs (type, cover, binding,
 * size, paper). Lives in the left dock's "Design" drawer; edits the ACTIVE
 * line only.
 */
export function DesignControls() {
  const { product, hasNotebook, apply } = useActiveLine();
  if (!hasNotebook || !product) return <EmptyLine />;

  const set = <K extends keyof typeof product>(k: K, v: (typeof product)[K]) => {
    if (product[k] !== v) playSfx('tick');
    apply((s) => setProductField(s, k as any, v as any));
  };

  return (
    <div className="flex flex-col gap-5">
      <Group title="Notebook type" hint="Each type keeps its own add-ons.">
        <ArchetypeDropdown
          value={product.archetype}
          ownCounts={{
            student: product.addOnsByArchetype.student.length,
            planner: product.addOnsByArchetype.planner.length,
            daily: product.addOnsByArchetype.daily.length,
          }}
          onChange={(arch) => set('archetype', arch)}
        />
      </Group>

      <Group title="Cover material">
        <div className="flex flex-wrap gap-2">
          {COVERS.map((c) => (
            <Tooltip key={c} content={COVER_TIPS[c] ?? ''}>
              <PixelChip
                selected={product.cover === c}
                onClick={() => set('cover', c)}
                icon={
                  <span
                    className="inline-block w-3.5 h-3.5 border border-border"
                    style={{ background: c === 'leather' ? '#7a4a2b' : '#cba87a' }}
                  />
                }
                label={c === 'hardcover' ? 'Hardcover' : 'Leather'}
              />
            </Tooltip>
          ))}
        </div>
      </Group>

      <Group title="Binding">
        <div className="flex flex-wrap gap-2">
          {BINDINGS.map((b) => (
            <Tooltip key={b} content={BINDING_TIPS[b] ?? ''}>
              <PixelChip
                selected={product.binding === b}
                onClick={() => set('binding', b)}
                label={b === 'ring' ? 'Ring' : 'Staple'}
              />
            </Tooltip>
          ))}
        </div>
      </Group>

      <Group title="Size" hint="Add-ons scale with the notebook.">
        <div className="flex flex-wrap gap-2">
          {SIZES.map((s) => (
            <Tooltip key={s} content={SIZE_TIPS[s] ?? ''}>
              <PixelChip
                selected={product.size === s}
                onClick={() => set('size', s)}
                label={s === 's' ? 'Small' : s === 'm' ? 'Medium' : 'Large'}
                meta={s === 's' ? '33%' : s === 'm' ? '66%' : '100%'}
              />
            </Tooltip>
          ))}
        </div>
      </Group>

      <Group title="Paper quality">
        <div className="flex flex-wrap gap-2">
          {PAPERS.map((p) => (
            <Tooltip key={p} content={PAPER_TIPS[p] ?? ''}>
              <PixelChip
                selected={product.paperQuality === p}
                onClick={() => set('paperQuality', p)}
                label={p === 'cheap' ? 'Cheap' : p === 'standard' ? 'Standard' : 'Premium'}
              />
            </Tooltip>
          ))}
        </div>
      </Group>
    </div>
  );
}

/**
 * AddOnGallery — the draggable add-on catalog. Lives in the left dock's
 * "Add-ons" drawer. Click a tile to toggle it, or drag it onto the notebook.
 */
export function AddOnGallery() {
  const { product, hasNotebook, apply } = useActiveLine();
  const archAddOns = useGame((s) => (hasNotebook ? currentAddOns(s) : []));
  if (!hasNotebook || !product) return <EmptyLine />;

  const toggleAddOn = (defId: string) => {
    apply((s) => {
      const list = currentAddOns(s);
      const existing = list.find((p: { defId: string; id: string }) => p.defId === defId);
      if (existing) {
        // Clicked the same add-on again → toggle it off.
        playSfx('delete');
        removeAddOn(s, existing.id);
        return;
      }
      // Click on a DIFFERENT add-on in the same category (e.g. cat charm
      // placed, penguin charm clicked) — swap directly instead of forcing
      // the player to unselect first. placeAddOn keeps its strict
      // same-category rejection, so the eviction happens here.
      const newCat = addOnById(defId)?.category;
      if (newCat) {
        const sameCat = list.find(
          (p: { defId: string; id: string }) => addOnById(p.defId)?.category === newCat,
        );
        if (sameCat) removeAddOn(s, sameCat.id);
      }
      const ok = placeAddOn(s, defId);
      if (!ok) {
        playSfx('fail');
        // After the same-category swap, the only remaining failure mode
        // is the global 3-add-on cap.
        s.toast = {
          id: 'addon-fail-' + defId,
          kind: 'warning',
          text: 'Max 3 add-ons. Remove one to add another.',
          until: Date.now() + 1700,
        };
      } else {
        playSfx('pop');
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[15px] text-text-2 leading-snug">
        <span className="font-bold text-text">{archAddOns.length}/3</span> on · tap to toggle. Decorations appear on the notebook automatically - they're cosmetic and don't change your score.
      </div>
      <div className="flex flex-col gap-3">
          {ADDON_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-text-3 mb-1.5">
                {group.label}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {ADDONS.filter((a) => group.cats.includes(a.category)).map((a) => {
                  const placed = !!archAddOns.find((p: { defId: string }) => p.defId === a.id);
                  const catLocked =
                    !placed && !!archAddOns.find((p: { defId: string }) => addOnById(p.defId)?.category === a.category);
                  const capReached = !placed && archAddOns.length >= 3;
                  return (
                    <AddOnTile
                      key={a.id}
                      def={a}
                      placed={placed}
                      catLocked={catLocked}
                      capReached={capReached}
                      onToggle={() => toggleAddOn(a.id)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
  );
}

/** Back-compat composition — design controls then the add-on gallery. */
export function ProductPanel() {
  return (
    <div className="flex flex-col gap-6">
      <DesignControls />
      <AddOnGallery />
    </div>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <header className="mb-2">
        <div className="panel-title text-text">{title}</div>
        {hint && <div className="text-[10px] text-text-3 mt-0.5">{hint}</div>}
      </header>
      {children}
    </section>
  );
}

function AddOnTile({
  def,
  placed,
  catLocked,
  capReached,
  onToggle,
}: {
  def: AddOnDef;
  placed: boolean;
  catLocked: boolean;
  capReached: boolean;
  onToggle: () => void;
}) {
  // Pure toggle button now — no drag. catLocked (same-category sibling) swaps
  // automatically on click; the only hard block is the 3-add-on cap.
  const disabled = !placed && capReached;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={clsx(
        'ctl-btn group relative border-2 p-2 flex flex-col items-center gap-1 select-none',
        placed
          ? 'bg-success-soft border-success'
          : disabled
          ? 'bg-surface border-border-soft opacity-55 cursor-not-allowed'
          : 'bg-surface border-border-soft cursor-pointer hover:border-border',
      )}
      title={
        placed
          ? `${def.name} - tap to remove`
          : capReached
          ? '3 add-ons already on'
          : catLocked
          ? `${def.name} - tap to swap your current ${def.category.replace(/_/g, ' ')}`
          : `${def.name} - tap to add`
      }
    >
      <SafeImage
        src={def.thumbPath ?? def.imgPath}
        alt={def.name}
        className="w-10 h-10 object-contain"
        fallbackIcon="sparkle"
        fallbackSize={30}
      />
      <span className="text-[14px] text-text text-center leading-tight font-semibold">{def.name}</span>

      {placed && (
        <span className="absolute -top-1.5 -right-1.5 bg-primary text-white border border-border w-5 h-5 flex items-center justify-center text-[14px] leading-none font-bold">
          ✓
        </span>
      )}
      {/* sibling of the placed add-on — picking it swaps, not blocks */}
      {!placed && !capReached && catLocked && (
        <span className="absolute -top-1.5 -right-1.5">
          <PixelBadge tone="info">swap</PixelBadge>
        </span>
      )}
      {!placed && !catLocked && capReached && (
        <span className="absolute -top-1.5 -right-1.5">
          <PixelBadge tone="warn">3/3</PixelBadge>
        </span>
      )}
    </button>
  );
}

/**
 * Compact "Notebook Type" dropdown. Replaces the previous 3-card
 * selector — the cards are now redundant because the Notebook Items
 * collection already shows type + thumbnail per item.
 *
 * The opened menu is portaled to <body> at fixed coords so it can't be
 * clipped by the left aside's overflow-hidden boundary.
 */
function ArchetypeDropdown({
  value,
  ownCounts,
  onChange,
}: {
  value: Archetype;
  ownCounts: Record<Archetype, number>;
  onChange: (a: Archetype) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      const menu = document.getElementById('archetype-menu');
      if (menu && menu.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onResize = () => { if (btnRef.current) setRect(btnRef.current.getBoundingClientRect()); };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open]);

  const click = () => {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setOpen((v) => !v);
  };
  const pick = (a: Archetype) => { onChange(a); setOpen(false); };

  const current = ARCHS.find((a) => a.id === value) ?? ARCHS[0];

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={click}
        className={clsx(
          'w-full inline-flex items-center gap-2.5 px-2 py-1.5 border-2 bg-surface text-text cursor-pointer',
          'border-border-soft hover:border-border',
        )}
      >
        <span className="inline-flex items-center justify-center w-9 h-9 shrink-0">
          <SafeImage src={current.sample} alt="" className="h-7 object-contain" fallbackIcon="product" fallbackSize={20} />
        </span>
        <span className="flex flex-col items-start min-w-0 flex-1">
          <span className="text-[14px] font-bold leading-tight">{current.label} Notebook</span>
          <span className="text-[10px] text-text-3 leading-tight mt-0.5">
            {ownCounts[value]} add-on{ownCounts[value] === 1 ? '' : 's'} on this type
          </span>
        </span>
        <PixelIcon kind="chevron-down" size={10} />
      </button>

      {open && rect && createPortal(
        <div
          id="archetype-menu"
          role="menu"
          className="z-[120] panel-frame bg-surface border-2 border-border shadow-[3px_3px_0_0_var(--c-shadow)]"
          style={{ position: 'fixed', left: rect.left, top: rect.bottom + 6, width: rect.width }}
        >
          {ARCHS.map((a) => {
            const isSel = a.id === value;
            return (
              <button
                key={a.id}
                role="menuitem"
                onClick={() => pick(a.id)}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-2.5 py-2 text-left cursor-pointer border-b border-border-soft last:border-b-0',
                  isSel ? 'bg-primary-soft' : 'hover:bg-surface-2',
                )}
              >
                <span className="inline-flex items-center justify-center w-9 h-9 shrink-0">
                  <SafeImage src={a.sample} alt="" className="h-7 object-contain" fallbackIcon="product" fallbackSize={20} />
                </span>
                <span className="flex flex-col items-start min-w-0 flex-1">
                  <span className="text-[14px] font-bold text-text leading-tight">{a.label} Notebook</span>
                  <span className="text-[10px] text-text-3 leading-tight mt-0.5">
                    {ownCounts[a.id]} saved add-on{ownCounts[a.id] === 1 ? '' : 's'}
                  </span>
                </span>
                {isSel && <PixelIcon kind="check" size={10} color="var(--c-primary)" />}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
