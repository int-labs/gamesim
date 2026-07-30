import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { BookOpen, BriefcaseBusiness } from 'lucide-react';
import { TopHUD } from '@/components/hud/TopHUD';
import type { MainPage } from '@/components/hud/MainNav';
import { PhaseActionBar } from '@/components/hud/PhaseActionBar';
import { BottomStats } from '@/components/hud/MetricsTable';
import { AmeliaReactions } from '@/components/mascot/AmeliaReactions';
import { NavIcon } from '@/components/icons/NavIcon';
import { playSfx } from '@/audio/audioManager';
import { ProductPage } from '@/pages/ProductPage';
import { BusinessPage } from '@/pages/BusinessPage';
import { ResultsPage } from '@/pages/ResultsPage';
import { useGame } from '@/state/store';
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
      <TopHUD />
      {/* Live commentary — Amelia reacts to fit jumps, maxed add-ons and
          bold pricing (renders nothing; one-shot per notebook). */}
      <AmeliaReactions />

      {/* Content area — relative so the floating page tabs can pin to its
          top-center, over whichever page is active. */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        <FloatingPageTabs page={page} onChange={setPage} />

        {/* Scrollable main column.
            IMPORTANT: <main> is a normal scrollable BLOCK, not a flex column.
            - Page wrapper is EXACTLY 100% of main's visible area (h-full) so
              the canvas is never cropped; internal panels scroll themselves.
            - BottomStats is a normal block AFTER the page → user scrolls down
              (or taps the canvas "Stats ↓" chip). */}
        <main
          id="sim-scroll"
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
          style={{ scrollPaddingTop: 16 }}
        >
          {/* Product locks to the viewport (h-full) so the canvas never
              crops. Business flows at NATURAL height (min-h-full) — its
              content grows the page and THIS scrollbar handles it all, so
              there's no scroll-within-scroll. */}
          <div className={page === 'product' ? 'h-full flex flex-col' : 'min-h-full flex flex-col'}>
            {page === 'product' && <ProductPage />}
            {page === 'business' && <BusinessPage />}
            {page === 'results' && <ResultsPage />}
          </div>
          <BottomStats />
        </main>
      </div>

      <PhaseActionBar />
    </div>
  );
}

/**
 * FloatingPageTabs — the Product/Business switch as a dark pill card floating
 * over the canvas top-center (per the reference layout), freeing the top bar
 * for the combined KPI group.
 */
function FloatingPageTabs({ page, onChange }: { page: MainPage; onChange: (p: MainPage) => void }) {
  const TABS = [
    { id: 'product' as const, label: 'Product', icon: BookOpen },
    { id: 'business' as const, label: 'Business', icon: BriefcaseBusiness },
  ];
  return (
    // top-3 + h-[48px] — sits on the SAME horizontal band as the canvas
    // title card (left) and view controls (right), so the top edge reads
    // as one clean aligned row.
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40">
      <div
        role="tablist"
        aria-label="Main pages"
        className="h-[48px] inline-flex items-center gap-1 px-1 bg-[#221710] border border-black/50 shadow-[0_3px_0_0_rgba(0,0,0,0.35)]"
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
                'inline-flex items-center gap-1.5 h-[36px] px-2.5 sm:px-4 border text-[11px] uppercase tracking-wider font-bold transition-all duration-150 active:scale-95 cursor-pointer',
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
