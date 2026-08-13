import clsx from 'clsx';
import {
  motion,
  useAnimationControls,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useGame, MAX_SHOP_NAME } from '@/state/store';
import { EnvironmentBackground } from './EnvironmentBackground';
import { Notebook, sizeScale } from './Notebook';
import { lineSize } from '@/engine/selectors';
import { AddOnLayer } from './AddOnLayer';
import { removeAddOn, currentAddOns, setActiveLine, renameProductLine, setShopName } from '@/engine/mockEngine';
import { archetypeLabel } from '@/engine/mockEngine';
import { PixelIcon } from '@/components/icons/PixelIcon';
import { ChevronDown, Pencil } from 'lucide-react';
import { NavIcon } from '@/components/icons/NavIcon';
import { A } from '@/assets';
import { ViewToggle } from './ViewToggle';
import { DismissibleTip } from '@/components/hud/DismissibleTip';
import { DustMotes } from '@/components/fx/DustMotes';
import { PixelBurstLayer } from '@/components/fx/PixelBurst';
import { playSfx } from '@/audio/audioManager';
import { useDroppable } from '@dnd-kit/core';

/**
 * NotebookCanvas — the FULL-BLEED stage. The desk artwork fills the entire
 * region edge-to-edge; all chrome floats OVER it as game-HUD cards:
 *
 *   top-left   → title card (renameable name + config) with status pills
 *   top-right  → Focus/Shelf toggle + Details
 *   mid-edges  → prev/next chevrons (offset inward past the floating docks)
 *   top-center → "n / N" position pill
 *
 * The root is the dnd droppable + an `isolate` stacking context so add-on
 * z-indices stay clamped inside the stage.
 */
export function NotebookCanvas() {
  // Canvas reflects the ACTIVE notebook item. May be undefined if the
  // player has deleted every notebook — in that case we render an empty
  // state below.
  const product = useGame(
    (s) => s.portfolio.productLines.find((l) => l.id === s.portfolio.activeLineId)
      ?? s.portfolio.productLines[0],
  );
  // The drawn size comes from the FinLit spec (the dropdown the player uses),
  // not `product.size` — that legacy field is written once at line creation and
  // never updated, so scaling from it meant picking B4 changed nothing.
  const drawnSize = lineSize(product);
  // Drop target for tiles dragged out of the Add-ons drawer (ProductPage owns
  // the DndContext).
  const { isOver, setNodeRef: setDropRef } = useDroppable({ id: 'notebook-canvas' });
  const hasNotebook = useGame((s) => s.portfolio.productLines.length > 0);
  const apply = useGame((s) => s.apply);
  const segment = useGame((s) => (product?.targetSegment ?? s.market.targetSegment));
  const addOns = useGame((s) => (hasNotebook ? currentAddOns(s) : []));
  const openDrawer = useGame((s) => s.openDrawer);
  const lines = useGame((s) => s.portfolio.productLines);
  const pushMascot = useGame((s) => s.pushMascot);
  const patCount = useRef(0);

  // Inline rename — the floating title card is the name's editing surface
  // (the top bar no longer shows it).
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // Shop sign rename — same pattern as the notebook title, on the desk sign.
  const shopName = useGame((s) => s.meta.shopName);
  const [editingShop, setEditingShop] = useState(false);
  const [shopDraft, setShopDraft] = useState('');
  const shopInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (editingShop) shopInputRef.current?.select();
  }, [editingShop]);
  const startShopRename = () => {
    setShopDraft(shopName);
    setEditingShop(true);
    playSfx('click-soft');
  };
  const commitShopRename = () => {
    apply((s) => setShopName(s, shopDraft));
    setEditingShop(false);
  };

  // Chevron direction (−1 prev / +1 next) so the hero SLIDES the way you
  // navigate instead of popping. 0 = config change → gentle scale-fade.
  const [slideDir, setSlideDir] = useState(0);

  // ── Living hero ──────────────────────────────────────────────────────
  // The notebook leans gently toward the cursor (fine pointers only) and
  // idles with a soft bob; clicking it gives a squash-and-stretch "pat"
  // plus a pixel burst. All of it sits out under reduced-motion.
  const reduced = useReducedMotion();
  const canHover = useRef(
    typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches,
  );
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 110, damping: 14 });
  const sy = useSpring(my, { stiffness: 110, damping: 14 });
  const tiltX = useTransform(sx, [-1, 1], [-8, 8]);
  const tiltY = useTransform(sy, [-1, 1], [-6, 6]);
  const tiltR = useTransform(sx, [-1, 1], [-2.2, 2.2]);
  const patCtrl = useAnimationControls();

  const onStageMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || !canHover.current || e.pointerType !== 'mouse') return;
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set(((e.clientX - rect.left) / rect.width) * 2 - 1);
    my.set(((e.clientY - rect.top) / rect.height) * 2 - 1);
  };
  const onStageLeave = () => {
    mx.set(0);
    my.set(0);
  };
  const onStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Pat the notebook — only when the (background) click lands on the hero
    // box. Add-on clicks stop propagation inside AddOnLayer, so they never
    // reach here.
    const rect = e.currentTarget.getBoundingClientRect();
    const heroSize = Math.min(rect.width * 0.48, 520);
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    if (Math.abs(e.clientX - cx) > heroSize / 2 || Math.abs(e.clientY - cy) > heroSize / 2) return;
    playSfx('pop');
    window.dispatchEvent(
      new CustomEvent('intlabs:burst', {
        detail: { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height },
      }),
    );
    if (!reduced) {
      patCtrl.start({
        scaleX: [1, 1.09, 0.94, 1.03, 1],
        scaleY: [1, 0.9, 1.07, 0.97, 1],
        transition: { duration: 0.5, ease: 'easeOut' },
      });
    }
    // Easter egg — Amelia notices persistent patting (once per session;
    // pushMascot de-dupes by id).
    patCount.current += 1;
    if (patCount.current === 3) {
      pushMascot({
        id: 'pat-easter-egg',
        type: 'success',
        body: "Okay, the notebook officially likes you. Petting it is free - selling it pays the bills though!",
        priority: 1,
        mood: 'happy',
      });
    }
  };

  if (!hasNotebook || !product) {
    return (
      <div className="relative flex flex-col flex-1 min-h-0 overflow-hidden isolate bg-surface-muted">
        <EnvironmentBackground variant="desk" />
        <div aria-hidden className="absolute inset-0 bg-ink-900/25" />
        <div className="relative flex-1 min-h-0 flex flex-col items-center justify-center text-center px-6 py-10 gap-3">
          <div className="panel-frame bg-surface px-8 py-8 flex flex-col items-center gap-3">
            <PixelIcon kind="product" size={28} color="var(--c-text-3)" />
            <div className="item-name text-text">No notebook selected</div>
            <p className="hint text-text-2 max-w-[28ch]">
              Open <span className="strong text-text">Notebook Items</span> in the left dock to add your first notebook.
            </p>
            <button
              onClick={() => openDrawer('left', 'items')}
              className="pbtn mt-1 px-3 h-[30px] eyebrow eyebrow-sm text-text border-2 border-primary bg-primary-soft"
            >
              Open Notebook Items
            </button>
          </div>
        </div>
      </div>
    );
  }

  const idx = lines.findIndex((l) => l.id === product.id);
  const cycle = (dir: number) => {
    if (lines.length < 2) return;
    const next = (idx + dir + lines.length) % lines.length;
    playSfx('whoosh'); // movement, not a click — the hero slides
    setSlideDir(dir);
    apply((s) => setActiveLine(s, lines[next].id));
  };

  const startRename = () => {
    setDraft(product.name);
    setEditing(true);
    playSfx('click-soft');
  };
  const commitRename = () => {
    const name = draft.trim();
    if (name && name !== product.name) apply((s) => renameProductLine(s, product.id, name));
    setEditing(false);
  };

  return (
    <div
      onPointerMove={onStageMove}
      onPointerLeave={onStageLeave}
      onClick={onStageClick}
      className="relative flex-1 min-h-0 overflow-hidden bg-surface-muted isolate"
    >
      {/* ── The stage itself — desk art fills the whole region ─────────── */}
      <EnvironmentBackground variant="desk" />

      {/* Spotlight + soft edge vignette so the floating HUD reads clearly. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: [
            'radial-gradient(ellipse 40% 42% at 50% 56%, rgba(255,236,180,0.20) 0%, rgba(255,236,180,0) 70%)',
            'linear-gradient(180deg, rgba(20,12,6,0.28) 0%, rgba(20,12,6,0) 18%)',
            'linear-gradient(0deg, rgba(20,12,6,0.30) 0%, rgba(20,12,6,0) 16%)',
          ].join(','),
        }}
      />

      {/* Ambient dust drifting through the studio light. */}
      <DustMotes />

      {/* Breathing ground shadow — in step with the hero's idle bob. */}
      <motion.div
        aria-hidden
        className="absolute left-1/2 top-[64%] -translate-x-1/2 w-[26%] max-w-[300px] h-5 rounded-[50%] bg-black/30 blur-[4px] pointer-events-none"
        animate={reduced ? undefined : { scaleX: [1, 0.9, 1], opacity: [0.3, 0.2, 0.3] }}
        transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Notebook hero — slides in the chevron's direction when switching
          notebooks (scale-fade for config changes), then LIVES: leans toward
          the cursor, bobs in place, and squashes when patted. */}
      <motion.div
        key={`${product.id}-${product.archetype}-${product.cover}-${product.binding}-${drawnSize}`}
        initial={{
          opacity: 0,
          x: slideDir * 72,
          scale: slideDir === 0 ? 0.96 : 1,
        }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.24, ease: [0.2, 1, 0.4, 1] }}
        onAnimationComplete={() => setSlideDir(0)}
        className="absolute inset-0 flex items-center justify-center"
      >
        {/* cursor tilt (spring motion values — no re-renders) */}
        <motion.div style={reduced ? undefined : { x: tiltX, y: tiltY, rotate: tiltR }}>
          {/* idle bob */}
          <motion.div
            animate={reduced ? undefined : { y: [0, -6, 0] }}
            transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            {/* pat squash-and-stretch */}
            <motion.div animate={patCtrl} style={{ transformOrigin: '50% 85%' }}>
              <div ref={setDropRef} className="relative" style={{ width: 'min(48vw, 520px)', maxWidth: '100%', aspectRatio: '1 / 1' }}>
                {/* Drop affordance. TRANSLUCENT on purpose: the notebook IS the
                    drop target, so an opaque fill covers the very thing the
                    player is aiming at and reads as the canvas going blank.
                    The literal rgba() is also deliberate — a Tailwind /alpha
                    suffix on a hex CSS-var token renders fully transparent in
                    this codebase. The hint sits at the top, clear of the hero. */}
                {isOver && (
                  <div
                    aria-hidden
                    className="absolute inset-3 z-10 border-2 border-dashed border-success pointer-events-none flex items-start justify-center pt-5"
                    style={{ background: 'rgba(111,187,133,0.14)' }}
                  >
                    <span className="inline-flex items-center gap-1.5 stat-label text-success bg-surface px-3 py-1.5 border-2 border-success shadow-[2px_2px_0_0_var(--c-shadow)]">
                      <PixelIcon kind="plus" size={11} color="var(--c-success-ink)" />
                      Drop to place
                    </span>
                  </div>
                )}
                <Notebook
                  archetype={product.archetype}
                  cover={product.cover}
                  binding={product.binding}
                  size={drawnSize}
                />
                {/* Decorations live INSIDE the notebook square AND scale with
                    its size, so their 0..1 placement maps onto the cover and
                    they grow/shrink + lean/bob with the hero — reading as part
                    of the notebook. */}
                <div
                  className="absolute inset-0"
                  style={{ transform: `scale(${sizeScale(drawnSize)})`, transformOrigin: 'center center' }}
                >
                  <AddOnLayer addOns={addOns} />
                </div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Pixel bursts — add-on drops + notebook pats land here. */}
      <PixelBurstLayer />

      {/* ── Floating TITLE PLATE (top-left) — reads as a proper game title:
           accent icon chip + tiny eyebrow + chunky arcade-font name. Still a
           single 48px row on the shared top band. ─────────────────────── */}
      <div className="absolute left-3 top-3 z-20 max-w-[calc(50%-120px)]">
        <div className="panel-frame bg-surface h-[48px] pl-2 pr-3 flex items-center gap-2.5 w-fit max-w-full">
          {/* accent chip */}
          <span aria-hidden className="inline-flex items-center justify-center w-8 h-8 border border-primary bg-primary-soft shrink-0">
            <PixelIcon kind="product" size={15} color="var(--c-primary)" />
          </span>
          <div className="flex flex-col justify-center gap-[3px] leading-none min-w-0">
            <span className="stat-label leading-none">
              Notebook
            </span>
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setEditing(false);
                }}
                maxLength={28}
                aria-label="Notebook name"
                // Shrinks with the viewport so the field never pushes out of
                // the title card (the card's wrapper is max-w-[calc(50%-120px)]
                // — the icon + padding eat ~120px, so cap the field to match).
                className="w-[min(240px,calc(50vw_-_190px))] min-w-[90px] max-w-full bg-cream-50 border-2 border-primary text-ink-900 eyebrow eyebrow-sm outline-none px-1.5 py-0.5"
              />
            ) : (
              <button
                type="button"
                onClick={startRename}
                aria-label={`Notebook name: ${product.name}. Click to rename.`}
                className="group inline-flex items-center gap-1.5 min-w-0 cursor-text text-left"
              >
                {/* keyed slide-up so the title visibly "changes hands" when
                    you cycle notebooks */}
                <motion.span
                  key={product.id}
                  initial={reduced ? false : { y: 9, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.2, ease: [0.2, 1, 0.4, 1] }}
                  className="eyebrow eyebrow-sm text-text truncate leading-none"
                >
                  {product.name}
                </motion.span>
                {/* Was opacity-35 until :hover — the only hint that this label is
                      editable, and invisible on the tablets this is played on.
                      Click-to-edit text is exempt from the button grammar (see the
                      affordance rule), so the icon IS the affordance and must be
                      legible at rest. */}
                <span aria-hidden className="opacity-70 group-hover:opacity-100 transition-opacity shrink-0">
                  <NavIcon icon={Pencil} size={11} color="var(--c-text-3)" />
                </span>
              </button>
            )}
          </div>
          <span aria-hidden className="hidden md:block w-px h-6 bg-border-soft shrink-0" />
          <div className="hidden md:block hint text-text-2 truncate">
            {labelArch(product.archetype)} · {product.cover === 'leather' ? 'Leather' : 'Hardcover'} · {product.binding === 'ring' ? 'Ring' : 'Staple'} · {sizeLabel(drawnSize)}
          </div>
        </div>
      </div>

      {/* ── Floating view controls (top-right, same 48px band) ─────────── */}
      <div className="absolute right-3 top-3 z-[45] h-[48px] flex items-center gap-1.5 panel-frame panel-frame--lifted bg-surface px-1.5">
        <ViewToggle />
        {/* h matches the ViewToggle's OUTER height (26px buttons + p-0.5 +
            border = 32px) so the row reads as one aligned control strip. */}
        <button
          onClick={() => openDrawer('right', 'details')}
          className="pbtn ctl-btn px-2.5 h-[32px] eyebrow eyebrow-sm text-text-2 hover:text-text"
        >
          <img src={A.ui.pixel.info} alt="" className="w-[14px] h-[14px] object-contain" style={{ imageRendering: 'pixelated' }} draggable={false} />
          <span className="hidden md:inline">Details</span>
        </button>
      </div>

      {/* Focus navigation — a bottom-center carousel cluster ‹ 1/3 › so it
          never overlaps the hero, docks or placed add-ons. Sits above the
          phone dock bar; bottom-3 on sm+. */}
      {lines.length > 1 && (
        <div className="absolute bottom-[84px] sm:bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
          <button
            onClick={() => cycle(-1)}
            aria-label="Previous notebook"
            className="group/nav inline-flex items-center justify-center w-10 h-10 bg-surface border-2 border-border shadow-[2px_2px_0_0_var(--c-shadow)] hover:border-primary hover:scale-110 active:scale-95 transition-transform"
          >
            <img
              src={A.ui.pixel.arrow_left}
              alt=""
              className="w-[22px] h-[22px] object-contain transition-transform group-hover/nav:-translate-x-0.5"
              style={{ imageRendering: 'pixelated' }}
              draggable={false}
            />
          </button>
          <div className="pointer-events-none inline-flex items-center gap-1 px-2.5 py-1.5 bg-ink-900/70 text-cream-100 eyebrow eyebrow-sm border border-black/40 tabular-nums overflow-hidden">
            {/* keyed flip — the counter rolls like an odometer */}
            <motion.span
              key={idx}
              initial={reduced ? false : { y: slideDir >= 0 ? 10 : -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.18, ease: [0.2, 1, 0.4, 1] }}
            >
              {idx + 1}
            </motion.span>
            <span>/ {lines.length}</span>
          </div>
          <button
            onClick={() => cycle(1)}
            aria-label="Next notebook"
            className="group/nav inline-flex items-center justify-center w-10 h-10 bg-surface border-2 border-border shadow-[2px_2px_0_0_var(--c-shadow)] hover:border-primary hover:scale-110 active:scale-95 transition-transform"
          >
            <img
              src={A.ui.pixel.arrow_right}
              alt=""
              className="w-[22px] h-[22px] object-contain transition-transform group-hover/nav:translate-x-0.5"
              style={{ imageRendering: 'pixelated' }}
              draggable={false}
            />
          </button>
        </div>
      )}

      {/* The SHOP SIGN, bottom-left — the player's business name on the desk.
          Was a decorative "Notebook Studio" stamp; now it's their shop and the
          in-run rename affordance (click it, like the notebook title card). */}
      <div className="absolute bottom-3 left-3 z-30 hidden sm:block">
        {editingShop ? (
          <input
            ref={shopInputRef}
            value={shopDraft}
            autoFocus
            onChange={(e) => setShopDraft(e.target.value)}
            onBlur={commitShopRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitShopRename();
              if (e.key === 'Escape') setEditingShop(false);
            }}
            maxLength={MAX_SHOP_NAME}
            aria-label="Shop name"
            className="w-[200px] bg-cream-50 border-2 border-primary text-ink-900 stamp outline-none px-2 py-0.5"
          />
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); startShopRename(); }}
            aria-label={`Shop name: ${shopName}. Click to rename.`}
            className="group inline-flex items-center gap-1.5 px-2 py-0.5 bg-surface border-2 border-border text-text stamp shadow-[1px_1px_0_0_var(--c-shadow)] select-none cursor-text hover:border-primary transition-colors"
          >
            <span className="w-1 h-1 bg-primary" aria-hidden />
            <span>{shopName}</span>
            <span aria-hidden className="opacity-60 group-hover:opacity-100 transition-opacity">
              <NavIcon icon={Pencil} size={9} color="var(--c-text-3)" />
            </span>
          </button>
        )}
      </div>

      {/* "Stats ↓" — smooth-scrolls to the in-flow stats & P&L tables below
          the canvas (they're plain page content now, not a drawer). */}
      <button
        onClick={() => {
          playSfx('click-soft');
          document.getElementById('stats-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
        className="absolute bottom-3 right-3 z-30 inline-flex items-center gap-1.5 px-3 h-[34px] bg-surface border-2 border-border text-text eyebrow eyebrow-sm shadow-[2px_2px_0_0_var(--c-shadow)] hover:border-primary hover:text-primary active:scale-95 transition-all cursor-pointer"
      >
        Stats &amp; P&amp;L
        <NavIcon icon={ChevronDown} size={13} color="currentColor" />
      </button>

      {!segment && (
        <div className="absolute bottom-[136px] sm:bottom-16 left-1/2 -translate-x-1/2 z-20">
          <DismissibleTip id="canvas-audience" tone="warn">
            Open <strong>Business → Audience</strong> to start scoring fit.
          </DismissibleTip>
        </div>
      )}
    </div>
  );
}

function labelArch(a: string) {
  // Live catalogue: a published notebook labels itself.
  return archetypeLabel(a);
}
// The caption echoes the player's own choice, so it names the paper the Design
// dropdown offers (A5/B5/B4). A "Small/Medium/Large" paraphrase would disagree
// with the control that set it.
const SIZE_TO_PAPER: Record<'s' | 'm' | 'l', string> = { s: 'A5', m: 'B5', l: 'B4' };
function sizeLabel(s: 's' | 'm' | 'l') {
  return SIZE_TO_PAPER[s];
}
