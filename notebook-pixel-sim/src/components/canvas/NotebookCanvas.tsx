import {
  motion,
  useAnimationControls,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import { useRef, useState } from 'react';
import { useGame } from '@/state/store';
import { EnvironmentBackground } from './EnvironmentBackground';
import { Notebook, sizeScale } from './Notebook';
import { lineSize } from '@/engine/selectors';
import { AddOnLayer } from './AddOnLayer';
import { currentAddOns } from '@/engine/mockEngine';
import { PixelIcon } from '@/components/icons/PixelIcon';
import { NotebookCycler } from '@/components/canvas/NotebookCycler';
import { DustMotes } from '@/components/fx/DustMotes';
import { PixelBurstLayer } from '@/components/fx/PixelBurst';
import { playSfx } from '@/audio/audioManager';
import { useDroppable } from '@dnd-kit/core';

/**
 * NotebookCanvas — the FULL-BLEED stage. The desk artwork fills the entire
 * region edge-to-edge; all chrome floats OVER it as game-HUD cards:
 *
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
  const addOns = useGame((s) => (hasNotebook ? currentAddOns(s) : []));
  const pushMascot = useGame((s) => s.pushMascot);
  const patCount = useRef(0);

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
              Open the <span className="strong text-text">Notebook</span> section to add your first notebook.
            </p>
            <button
              // Switches SECTION. It called `openDrawer('left', 'items')`, and
              // that drawer no longer exists — the button was already dead.
              onClick={() => {
                playSfx('click-soft');
                window.dispatchEvent(new CustomEvent('intlabs:goto', { detail: { page: 'notebook' } }));
              }}
              className="pbtn mt-1 px-3 h-[30px] eyebrow eyebrow-sm text-text border-2 border-primary bg-primary-soft"
            >
              Go to Notebook
            </button>
          </div>
        </div>
      </div>
    );
  }

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
        key={`${product.id}-${product.productId}-${product.cover}-${product.binding}-${drawnSize}`}
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
              {/* SIZED IN vh, NOT vw. It was `min(48vw, 520px)`, which scaled
                  with the whole WINDOW's width — but the stage is one column of
                  that window now, behind a 52px tab rail and a rail capped at
                  40vw, so 48vw was routinely wider than the region it sits in
                  and the notebook bled out of its own drop zone.

                  Viewport HEIGHT is the honest axis here: the stage spans the
                  full height minus the HUD, the header, the add-on strip and
                  the footer, and nothing competes with it vertically. The
                  square tracks that, and `maxWidth: 100%` is the backstop on a
                  short, narrow window. */}
              <div
                ref={setDropRef}
                className="relative"
                style={{ width: 'min(46vh, 520px)', maxWidth: '100%', aspectRatio: '1 / 1' }}
              >
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
                  archetype={product.productId}
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

      {/* The floating TITLE PLATE was REMOVED here on 2026-10-05 — accent
          chip, name, and the "genre · cover · binding · size" line. The stage
          header above this canvas already names the notebook, and the Notebook
          section's list owns both the name and that spec. */}

      {/* The Focus / Shelf / Details strip MOVED to `ProductPage` (2026-10-01).
          It lived here and in NotebookGallery, so it disappeared whenever this
          component took its empty-portfolio early return — taking the market
          data a player is meant to choose FROM with it. It belongs to the page,
          not to a canvas state. */}

      {/* Focus navigation — a bottom-center carousel cluster ‹ 1/3 › so it
          never overlaps the hero, docks or placed add-ons. Sits above the
          phone dock bar; bottom-3 on sm+. */}
      {/* `onCycle` feeds the hero's slide direction — the cycler owns the
          counter's own roll, this is the extra thing only the canvas animates. */}
      <NotebookCycler
        className="absolute bottom-[84px] sm:bottom-3 left-1/2 -translate-x-1/2 z-30"
        onCycle={setSlideDir}
      />

      {/* The "Projection & P&L" chip was REMOVED here on 2026-10-05. It
          scrolled to tables that trailed this page; once those became the
          FINANCIAL tab it was a second route to a tab the row above already
          offers, parked on a canvas that is now a narrow stage. */}

    </div>
  );
}

/* `labelArch`, `SIZE_TO_PAPER` and `sizeLabel` were REMOVED with the title
   plate on 2026-10-05 — they existed only to write its caption line. */
