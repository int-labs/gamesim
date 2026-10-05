import { useState, useEffect } from 'react';
import clsx from 'clsx';
import {
  BookOpen,
  Boxes,
  Factory,
  Megaphone,
  ReceiptText,
  Store,
} from 'lucide-react';
import { TopHUD } from '@/components/hud/TopHUD';
import type { MainPage } from '@/components/hud/MainNav';
import { PhaseActionBar } from '@/components/hud/PhaseActionBar';
import { BottomStats } from '@/components/hud/MetricsTable';
import { NavIcon } from '@/components/icons/NavIcon';
import { playSfx } from '@/audio/audioManager';
import { ProductStage } from '@/pages/ProductPage';
import { ProductLineList } from '@/components/panels/ProductLineList';
import { FinlitDesignControls } from '@/components/panels/FinlitDesignControls';
import { InventoryPanel } from '@/components/panels/InventoryPanel';
import { StudioPanel } from '@/components/panels/StudioPanel';
import { ArchetypeDetailModal } from '@/components/canvas/ArchetypeDetailModal';
import { useGame } from '@/state/store';
import { useLiveProjection, type LiveProjectionState } from '@/gamesim/useLiveProjection';
import {
  expandScript,
  SCRIPT_FIRST_PRODUCT_PAGE,
  SCRIPT_FIRST_BUSINESS_PAGE,
} from '@/content/mascotScripts';

/** How wide the notebook stage sits. The rail takes everything else. */
const STAGE_W = 420;

/**
 * Top-level layout for the playable run.
 *
 *   [TopHUD]
 *   [PageTabs — six sections]
 *   [rail (the active section)  |  stage (the notebook)]
 *   [footer compartment — PhaseActionBar]
 *
 * The rail is the page: every decision lives there and the stage beside it
 * never changes, so the notebook stays in view while the player works on it.
 */
export function SimulationScreen() {
  const [page, setPage] = useState<MainPage>('notebook');
  const pushMascotSequence = useGame((s) => s.pushMascotSequence);
  const liveProjectionState = useLiveProjection();

  // First-visit guidance scripts. Each script de-dupes via id, so once a
  // player has seen an intro it won't fire again — even across phase
  // transitions. The two scripts predate the six-section split; `notebook`
  // and `sales` are the nearest heirs of the old Product and Business pages.
  useEffect(() => {
    if (page === 'notebook') {
      pushMascotSequence(expandScript(SCRIPT_FIRST_PRODUCT_PAGE));
    } else if (page === 'sales') {
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

      {/* ── BODY — rail (the active section) + stage (the notebook) ─────────
          The rail is the wide one. Every decision moved into it, so it is where
          the player actually works; the stage is a fixed column that shows what
          those decisions are producing. */}
      <div className="flex-1 min-h-0 flex">
        <main
          id="sim-scroll"
          className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden"
          style={{ scrollPaddingTop: 16 }}
        >
          <PageRail page={page} liveProjectionState={liveProjectionState} />
        </main>

        {/* The notebook, on every section. `shrink-0` + a fixed width: it is a
            reference now, not the hero, and a flexible stage would reclaim the
            rail's width on a wide screen — the lopsidedness this replaced. */}
        <ProductStage
          className="shrink-0 min-h-0 flex flex-col border-l border-black/40 bg-surface"
          style={{ width: STAGE_W }}
        />
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
 * PageRail — the active section's contents. ONE level of tabs: each of the six
 * is a set of decisions, not a container of further tabs.
 *
 * `p-3.5` is load-bearing on the padded branch: `ProductLineList`'s sticky
 * "Add Notebook" footer bleeds over it with `-mx-3.5 -mb-3.5`, inherited from
 * the drawer body it used to live in.
 *
 * MARKET is unpadded and `h-full` — `ArchetypeDetailModal` is a filled sheet
 * that owns its own rail, panel and scroll regions, so padding it would put a
 * scrollbar inside a scrollbar.
 */
function PageRail({
  page,
  liveProjectionState,
}: {
  page: MainPage;
  liveProjectionState: LiveProjectionState;
}) {
  const { liveProjection, recalc } = liveProjectionState;

  if (page === 'market') {
    return (
      <div className="h-full min-h-0">
        {/* No `onClose`: it is optional and only fires after "Switch to …",
            which still applies. This is a tab, not an overlay — there is
            nothing to close it back to. */}
        <ArchetypeDetailModal fill open />
      </div>
    );
  }

  return (
    <div className="p-3.5">
      {page === 'notebook' && (
        <div className="flex flex-col gap-6">
          <ProductLineList />
          <FinlitDesignControls liveProjection={liveProjection} recalc={recalc} />
        </div>
      )}
      {page === 'financial' && <BottomStats liveProjectionState={liveProjectionState} />}
      {page === 'inventory' && <InventoryPanel liveProjection={liveProjection} recalc={recalc} />}
      {/* The two halves of StudioPanel. It stays ONE component behind a filter
          because the energy gate, the cash gate, the case-study modal and the
          reference sheet are shared by all four blocks. */}
      {page === 'capacity' && (
        <StudioPanel liveProjection={liveProjection} recalc={recalc} sections={['hiring', 'vendor']} />
      )}
      {page === 'sales' && (
        <StudioPanel liveProjection={liveProjection} recalc={recalc} sections={['channels', 'budget']} />
      )}
    </div>
  );
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
    { id: 'market' as const, label: 'Market', icon: Store },
    { id: 'financial' as const, label: 'Financial', icon: ReceiptText },
    { id: 'notebook' as const, label: 'Notebook', icon: BookOpen },
    { id: 'inventory' as const, label: 'Inventory & Production', icon: Boxes },
    { id: 'capacity' as const, label: 'Capacity & RnD', icon: Factory },
    { id: 'sales' as const, label: 'Sales & Marketing', icon: Megaphone },
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
