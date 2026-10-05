import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { BookOpen, BriefcaseBusiness } from 'lucide-react';
import { TopHUD } from '@/components/hud/TopHUD';
import type { MainPage } from '@/components/hud/MainNav';
import { PhaseActionBar } from '@/components/hud/PhaseActionBar';
import { BottomStats } from '@/components/hud/MetricsTable';
import { NavIcon } from '@/components/icons/NavIcon';
import { playSfx } from '@/audio/audioManager';
import { ProductPage } from '@/pages/ProductPage';
import { BusinessPage } from '@/pages/BusinessPage';
import { ResultsPage } from '@/pages/ResultsPage';
import { useGame } from '@/state/store';
import { useLiveProjection } from '@/gamesim/useLiveProjection';
import {
  expandScript,
  SCRIPT_FIRST_PRODUCT_PAGE,
  SCRIPT_FIRST_BUSINESS_PAGE,
} from '@/content/mascotScripts';

/**
 * Top-level layout for the playable run.
 *
 * Layout:
 *   [TopHUD — KPI pills combined into one bar]
 *   [scrollable main]
 *      ├── floating Product/Business tabs (top-center, over the canvas)
 *      ├── active page (fills the first viewport via h-full)
 *      └── #stats-section (Stats & P&L tables flow below — just scroll,
 *          no drawer; the canvas "Stats ↓" chip smooth-scrolls here)
 *   [PhaseActionBar] (sticky bottom, always visible)
 */
export function SimulationScreen() {
  const [page, setPage] = useState<MainPage>('product');
  const pushMascotSequence = useGame((s) => s.pushMascotSequence);
  const liveProjectionState = useLiveProjection();

  // First-visit guidance scripts. Each script de-dupes via id, so once
  // a player has seen the Product or Business intro it won't fire again
  // — even across phase transitions.
  useEffect(() => {
    if (page === 'product') {
      pushMascotSequence(expandScript(SCRIPT_FIRST_PRODUCT_PAGE));
    } else if (page === 'business') {
      pushMascotSequence(expandScript(SCRIPT_FIRST_BUSINESS_PAGE));
    }
  }, [page, pushMascotSequence]);

  // Cross-component navigation — listen for `intlabs:goto` events
  // dispatched by validation pills (e.g. PhaseActionBar's "Pick an
  // audience" warning chip) so any deep-linked nudge can move the
  // player to the right page without lifting state into the store.
  useEffect(() => {
    const onGoto = (e: Event) => {
      const detail = (e as CustomEvent).detail as { page?: MainPage } | undefined;
      if (detail?.page) setPage(detail.page);
    };
    window.addEventListener('intlabs:goto', onGoto);
    return () => window.removeEventListener('intlabs:goto', onGoto);
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col">
      <TopHUD liveProjectionState={liveProjectionState} />
      {/* `AmeliaReactions` was REMOVED here on 2026-09-14. Its three live
          reactions were scored off the obsolete local `vocFit` model, and the
          trigger is being redesigned with the wider UX pass. */}

      {/* ── TAB ROW — docked, its own band ──────────────────────────────────
          Was a pill FLOATING over the canvas top-centre. Docked here it owns a
          row, so the page beneath it is a plain region instead of a stage with
          chrome hovering on it. */}
      <PageTabs page={page} onChange={setPage} />

      {/* ── BODY — left rail + centre ───────────────────────────────────────
          Two columns, no right rail: performance belongs to FINANCE, not to a
          permanent sidebar. */}
      <div className="flex-1 min-h-0 flex">
        {/* The rail renders its own <aside> and returns null while a page has
            nothing for it, so an unfilled rail costs no empty column. */}
        <PageRail page={page} />

        {/* Scrollable centre column.
            IMPORTANT: <main> is a normal scrollable BLOCK, not a flex column.
            - Page wrapper is EXACTLY 100% of main's visible area (h-full) so
              the canvas is never cropped; internal panels scroll themselves.
            - BottomStats is a normal block AFTER the page → user scrolls down
              (or taps the canvas "Stats ↓" chip). Both it and that chip go
              when FINANCE lands as its own tab. */}
        <main
          id="sim-scroll"
          className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden"
          style={{ scrollPaddingTop: 16 }}
        >
          {/* Product locks to the viewport (h-full) so the canvas never
              crops. Business flows at NATURAL height (min-h-full) — its
              content grows the page and THIS scrollbar handles it all, so
              there's no scroll-within-scroll. */}
          <div className={page === 'product' ? 'h-full flex flex-col' : 'min-h-full flex flex-col'}>
            {page === 'product' && <ProductPage liveProjectionState={liveProjectionState} />}
            {page === 'business' && <BusinessPage liveProjectionState={liveProjectionState} />}
            {page === 'results' && <ResultsPage />}
          </div>
          <BottomStats liveProjectionState={liveProjectionState} />
        </main>
      </div>

      {/* ── FOOTER COMPARTMENT ──────────────────────────────────────────────
          Spans the full width, under BOTH columns. `PhaseActionBar` is the only
          occupant today and carries the round-advance control; it is already
          `shrink-0`, so this region is the place further buttons go rather than
          a wrapper that re-does its layout.

          Same reason as AmeliaReactions above: the modal it opens shows the
          projected cash figure, which must be the SAME instance the HUD chip
          reads or the two disagree. */}
      <PhaseActionBar liveProjection={liveProjectionState.liveProjection} />
    </div>
  );
}

/**
 * The LEFT RAIL — each page's own stacked sections, with its own sub-tabs.
 *
 * Renders its own `<aside>` so a page with nothing for the rail costs no empty
 * column. Null for every page today; the Product page's panels move in next,
 * out of the sliding drawer they currently live in.
 */
function PageRail({ page: _page }: { page: MainPage }) {
  return null;
}

/**
 * PageTabs — the top-level page switch, DOCKED in its own row.
 *
 * It was a pill floating over the canvas top-centre. Docked, it reads as the
 * page's own chrome rather than something hovering on the stage, and the centre
 * column gets its full height back.
 */
function PageTabs({ page, onChange }: { page: MainPage; onChange: (p: MainPage) => void }) {
  const TABS = [
    { id: 'product' as const, label: 'Product', icon: BookOpen },
    { id: 'business' as const, label: 'Business', icon: BriefcaseBusiness },
  ];
  return (
    <div className="shrink-0 bg-[#221710] border-b border-black/50">
      <div
        role="tablist"
        aria-label="Main pages"
        className="h-[48px] flex items-center gap-1 px-2"
      >
        {TABS.map((t) => {
          const active = page === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => { if (!active) playSfx('click-soft'); onChange(t.id); }}
              className={clsx(
                'inline-flex items-center gap-1.5 h-[36px] px-2.5 sm:px-4 border eyebrow eyebrow-sm transition-all duration-150 active:scale-95 cursor-pointer',
                active
                  ? 'bg-surface border-primary text-text'
                  : 'border-transparent text-[#D9B57A] hover:bg-white/5 hover:text-cream-100',
              )}
            >
              <NavIcon icon={t.icon} size={14} color={active ? 'var(--c-primary)' : 'currentColor'} />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
