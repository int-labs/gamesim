import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useGame } from '@/state/store';
import {
  addProductLine,
  removeProductLine,
  setActiveLine,
  renameProductLine,
  canAddProductLine,
  archetypeLabel,
} from '@/engine/mockEngine';
import type { ProductLine, Archetype } from '@/types';
import { A } from '@/assets';
import { notebookCatalogue, ARCHETYPE_INFO } from '@/data/notebookArchetypes';
import { PixelIcon } from '@/components/icons/PixelIcon';
import { playSfx } from '@/audio/audioManager';

/** Live catalogue — see notebookArchetypes.ts. */
const notebookIds = (): Archetype[] => notebookCatalogue().map((n) => n.id);

const ARCH_DESC: Record<Archetype, string> = {
  student: 'Affordable, school-focused notebooks for the student segment.',
  planner: 'Structured planners for professionals and creators.',
  daily: 'Premium daily journals - gift-friendly, high margin.',
};

const archetypeThumb = (archetype: Archetype): string =>
  ARCHETYPE_INFO[archetype]?.art ?? '';

/**
 * Notebook Items — the collection of notebook product lines, laid out for
 * the left-dock DRAWER (a tall, ~380px-wide panel):
 *
 *   ┌ 3 notebooks · Phase 1              [Healthy] ┐   ← slim meta row (the
 *   │ ┌──────────────────────────────────────────┐ │      drawer chrome owns
 *   │ │ [thumb] Name              ✎ 🗑            │ │      the panel title)
 *   │ │         Student Notebook                  │ │
 *   │ │         QTY               [− 25 +]        │ │   ← full-width cards,
 *   │ └──────────────────────────────────────────┘ │      vertical stack
 *   │ …                                            │
 *   │ [           + Add Notebook              ▾ ]  │
 *   └──────────────────────────────────────────────┘
 *
 * Rename (pencil / double-click), delete (trash → confirm modal), and an
 * inline qty stepper per card; actions are ALWAYS visible (hover-only icons
 * were undiscoverable). Add Notebook opens a portaled archetype picker.
 */
export function ProductLineList() {
  const lines = useGame((s) => s.portfolio.productLines);
  const activeLineId = useGame((s) => s.portfolio.activeLineId);
  const phase = useGame((s) => s.meta.phase);
  const apply = useGame((s) => s.apply);
  const canAdd = useGame((s) => canAddProductLine(s));

  // Rename
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  // Add Notebook popover
  const [addOpen, setAddOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement | null>(null);
  const [addRect, setAddRect] = useState<DOMRect | null>(null);

  // Delete confirmation modal
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmLine = lines.find((l) => l.id === confirmId);

  // Outside-click + Escape for the add popover
  useEffect(() => {
    if (!addOpen) return;
    const onDoc = (e: PointerEvent) => {
      const t = e.target as Node;
      if (addBtnRef.current?.contains(t)) return;
      const menu = document.getElementById('add-notebook-menu');
      if (menu && menu.contains(t)) return;
      setAddOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAddOpen(false); };
    const onResize = () => {
      if (addBtnRef.current) setAddRect(addBtnRef.current.getBoundingClientRect());
    };
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
  }, [addOpen]);

  // Escape closes the confirm modal too.
  useEffect(() => {
    if (!confirmId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirmId(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmId]);

  const handleSelect = (id: string) => {
    if (id !== activeLineId) playSfx('click-soft');
    apply((s) => setActiveLine(s, id));
  };

  const handleAddClick = () => {
    if (!canAdd) return;
    if (addBtnRef.current) setAddRect(addBtnRef.current.getBoundingClientRect());
    setAddOpen((v) => !v);
  };
  const handleAdd = (archetype: Archetype) => {
    playSfx('coin');
    apply((s) => addProductLine(s, archetype));
    setAddOpen(false);
    // Juice: the newcomer pops onto the canvas behind the drawer.
    window.dispatchEvent(new CustomEvent('intlabs:burst', { detail: { x: 0.5, y: 0.5 } }));
  };

  const askDelete = (id: string) => { playSfx('click-soft'); setConfirmId(id); };
  const cancelDelete = () => { playSfx('click-soft'); setConfirmId(null); };
  const confirmDelete = () => {
    if (!confirmId) return;
    playSfx('delete');
    apply((s) => removeProductLine(s, confirmId));
    setConfirmId(null);
  };

  const startRename = (line: ProductLine) => {
    playSfx('click-soft');
    setRenameId(line.id);
    setRenameVal(line.name);
  };
  const commitRename = () => {
    if (renameId) apply((s) => renameProductLine(s, renameId, renameVal.trim() || 'Notebook'));
    setRenameId(null);
  };

  return (
    // Lives inside the Drawer body (which owns padding + the panel title),
    // so this is just the content: meta row → vertical card list → add CTA.
    <section className="flex flex-col gap-2">
      <header className="flex items-center justify-between gap-2">
        {/* Count + phase only — the drawer chrome already says
            "Notebook Items", so no duplicate title here. */}
        <span className="body-xs text-text-2">
          <span className="strong text-text">{lines.length}</span>{' '}
          notebook{lines.length === 1 ? '' : 's'} · Phase {phase}
        </span>
      </header>

      {/* Vertical stack of full-width notebook cards */}
      <div>
        {lines.length === 0 ? (
          <div className="py-3 body-sm text-text-2">
            No notebooks in your collection. Add at least one notebook to continue.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {lines.map((line, cardIdx) => {
              const isActive = line.id === activeLineId;
              const thumb = archetypeThumb(line.archetype);
              return (
                // Opacity-only stagger — a transform here would override the
                // CSS hover-lift (framer leaves inline transform behind).
                <motion.article
                  key={line.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.22, delay: cardIdx * 0.045 }}
                  className={clsx(
                    // Full-width card for the vertical drawer list.
                    // Thumbnail left, name + type + qty stacked right.
                    // White card pops from the cream drawer surface.
                    'group relative w-full border-2 cursor-pointer flex items-stretch bg-white card-hover-lift',
                    isActive
                      ? 'border-primary shadow-[2px_2px_0_0_var(--c-shadow)] pixel-corners-strong'
                      : 'border-border-soft hover:border-border',
                  )}
                  onClick={() => handleSelect(line.id)}
                >
                  {/* Thumbnail (left) */}
                  <div className="flex items-center justify-center w-[68px] shrink-0 overflow-hidden py-2">
                    {thumb && (
                      <img
                        src={thumb}
                        alt=""
                        className="h-[52px] w-auto object-contain"
                        style={{ imageRendering: 'pixelated' }}
                        draggable={false}
                      />
                    )}
                  </div>

                  {/* Right stack: name, type, qty. pr clears the always-
                       visible action icons in the top-right corner. */}
                  <div className="flex-1 min-w-0 pl-1 pr-2 py-2 flex flex-col gap-1.5">
                    {renameId === line.id ? (
                      <input
                        autoFocus
                        value={renameVal}
                        onChange={(e) => setRenameVal(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename();
                          if (e.key === 'Escape') setRenameId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full item-name bg-surface-2 border border-border-soft px-1.5 py-0.5"
                        maxLength={32}
                      />
                    ) : (
                      // TITLE — biggest, boldest, darkest ink.
                      <div
                        className="item-name text-text truncate leading-tight pr-12"
                        title={`${line.name} - double-click to rename`}
                        onDoubleClick={(e) => { e.stopPropagation(); startRename(line); }}
                      >
                        {line.name}
                      </div>
                    )}
                    {/* SUBTITLE — smaller, muted. */}
                    <div className="hint truncate leading-tight -mt-0.5 pr-12">
                      {archetypeLabel(line.archetype)}
                    </div>
                    {/* TAG — the market genre, the quietest level: tiny caps
                        pill, subordinate to the title (not a second heading). */}
                    {line.genre && (
                      <div className="mt-auto">
                        <span className="inline-flex items-center px-1.5 py-px border border-border-soft bg-surface-2 stat-label">
                          {line.genre}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Active pin — INSIDE the card top edge so the strip's
                       overflow-y-hidden doesn't clip it. */}
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute top-0.5 left-0.5 bg-primary num-xs tracking-wider px-1 py-px border border-border z-10"
                      style={{ color: '#12301C' }}
                    >
                      ACTIVE
                    </span>
                  )}

                  {/* Actions — ALWAYS visible (hover-only was undiscoverable),
                       dimmed until hover for calm. */}
                  <div className="absolute top-1 right-1 flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); startRename(line); }}
                      title="Rename"
                      aria-label={`Rename ${line.name}`}
                      className="w-6 h-6 inline-flex items-center justify-center bg-surface border border-border-soft hover:border-border hover:bg-surface-2 cursor-pointer"
                    >
                      <PixelIcon kind="pen" size={10} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); askDelete(line.id); }}
                      title="Delete this notebook"
                      aria-label={`Delete ${line.name}`}
                      className="w-6 h-6 inline-flex items-center justify-center bg-surface border border-border-soft text-danger hover:border-danger hover:bg-danger-soft cursor-pointer"
                    >
                      <PixelIcon kind="trash" size={10} color="var(--c-danger)" />
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>

      {/* Full-width Add Notebook button — a STICKY footer pinned to the
           drawer's bottom edge so it stays reachable however long the list
           grows. Bleeds over the drawer body's p-3.5 with negative margins.
           Always enabled (until the soft 20-line sanity ceiling). */}
      <div className="sticky bottom-0 z-10 -mx-3.5 -mb-3.5 mt-1 px-3.5 pt-2 pb-3 bg-surface border-t-2 border-border-soft">
        <button
          ref={addBtnRef}
          type="button"
          onClick={handleAddClick}
          disabled={!canAdd}
          aria-haspopup="menu"
          aria-expanded={addOpen}
          className={clsx(
            'w-full h-[36px] inline-flex items-center justify-center gap-1.5 border-2 border-dashed btn-label cursor-pointer transition-colors',
            canAdd
              ? 'border-border bg-surface text-text-2 hover:border-primary hover:text-primary hover:bg-primary-soft'
              : 'border-border-soft bg-surface-2 text-text-3 cursor-not-allowed opacity-70',
          )}
        >
          <PixelIcon kind="plus" size={10} />
          {canAdd ? 'Add Notebook' : 'Notebook limit reached'}
          {canAdd && <PixelIcon kind="chevron-down" size={8} />}
        </button>

        {/* A calm invitation to expand — each new notebook opens another
            genre/market. Capacity/production trade-offs surface on the
            Inventory tab, not here. */}
        <div className="mt-1.5 px-2 py-0.5 hint">
          Each notebook targets a different genre. Add lines to reach new markets.
        </div>
      </div>

      {/* Add Notebook popover — portaled to body, position: fixed, so the
           parent aside's overflow-hidden can never clip it. FLIPS UPWARD
           when there isn't room below (the trigger is a sticky footer at
           the drawer's bottom edge, so up is the common case). */}
      {addOpen && addRect &&
        createPortal(
          <div
            id="add-notebook-menu"
            role="menu"
            className="z-[120] panel-frame panel-frame--lifted bg-surface"
            style={{
              position: 'fixed',
              left: addRect.left,
              width: Math.max(220, addRect.width),
              // ~248px = header + 3 archetype rows. Not enough room below →
              // anchor the menu's bottom to the button's top instead.
              ...(window.innerHeight - addRect.bottom < 260
                ? { bottom: window.innerHeight - addRect.top + 6 }
                : { top: addRect.bottom + 6 }),
            }}
          >
            <div className="px-3 py-2 border-b border-border-soft stat-label bg-surface-2">
              Choose notebook type
            </div>
            {notebookIds().map((arch) => (
              <button
                key={arch}
                type="button"
                role="menuitem"
                onClick={() => handleAdd(arch)}
                className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-surface-2 cursor-pointer border-b border-border-soft last:border-b-0"
              >
                {archetypeThumb(arch) && (
                  <img
                    src={archetypeThumb(arch)}
                    alt=""
                    className="w-9 h-9 object-contain mt-0.5 shrink-0"
                    style={{ imageRendering: 'pixelated' }}
                    draggable={false}
                  />
                )}
                <div className="flex flex-col min-w-0">
                  <span className="item-name text-text leading-tight">
                    {archetypeLabel(arch)}
                  </span>
                  <span className="hint mt-0.5">
                    {ARCH_DESC[arch]}
                  </span>
                </div>
              </button>
            ))}
          </div>,
          document.body,
        )}

      {/* Delete confirmation modal — portaled, blocks the page. */}
      {confirmId && confirmLine &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] bg-black/55 flex items-center justify-center p-4"
            onClick={cancelDelete}
          >
            <div
              role="alertdialog"
              aria-modal="true"
              aria-label="Delete notebook"
              className="panel-frame panel-frame--lifted-lg bg-surface w-full max-w-[420px]"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="flex items-center gap-2 px-4 py-3 border-b-2 border-border-soft bg-surface-2">
                <span className="inline-flex w-7 h-7 items-center justify-center border-2 border-danger bg-danger-soft">
                  <PixelIcon kind="trash" size={12} color="var(--c-danger)" />
                </span>
                <span className="section-title text-ink-900">
                  Delete this notebook?
                </span>
              </header>
              <div className="px-4 py-4 body-sm text-text-2">
                <p>
                  This will remove <span className="strong text-text">{confirmLine.name}</span>
                  {' '}({archetypeLabel(confirmLine.archetype)}) and all of its configuration,
                  add-ons, and inventory. This cannot be undone.
                </p>
              </div>
              <footer className="flex items-center justify-end gap-2 px-4 py-3 border-t-2 border-border-soft bg-surface-2/70">
                <button
                  type="button"
                  onClick={cancelDelete}
                  className="h-[34px] px-4 border-2 border-border-soft bg-surface text-text btn-label hover:bg-surface-2 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="h-[34px] px-4 border-2 border-border bg-danger-strong text-white btn-label hover:-translate-y-px hover:shadow-[2px_2px_0_0_var(--c-shadow)] cursor-pointer inline-flex items-center gap-1.5"
                  style={{ color: '#FAF7E8' }}
                >
                  <PixelIcon kind="trash" size={11} color="#FAF7E8" />
                  Delete Notebook
                </button>
              </footer>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
