import { useState, useEffect } from 'react';
import clsx from 'clsx';
import { motion, useReducedMotion } from 'framer-motion';
import { StudioPanel } from '@/components/panels/StudioPanel';
import { InventoryPanel } from '@/components/panels/InventoryPanel';
import { FinanceTable, PortfolioMetrics } from '@/components/hud/MetricsTable';
import { PixelIcon, PixelIconKind } from '@/components/icons/PixelIcon';
import { BUSINESS_PAGE } from '@/content/copy';
import { playSfx } from '@/audio/audioManager';

// V3 Business page — the OPERATIONS hub. Company decisions (hire/market/ship)
// live here, plus inventory and the full P&L. Product design (genre + spec +
// channels + price) lives in the Product page's drawers.
type SubTab = 'operations' | 'inventory' | 'performance';

const TABS: { id: SubTab; label: string; icon: PixelIconKind; sub: string; explainer: string }[] = [
  { id: 'operations',  label: BUSINESS_PAGE.tabs.operations.label,  icon: 'operations', sub: BUSINESS_PAGE.tabs.operations.sub,  explainer: BUSINESS_PAGE.tabs.operations.explainer  },
  { id: 'inventory',   label: BUSINESS_PAGE.tabs.inventory.label,   icon: 'inventory',  sub: BUSINESS_PAGE.tabs.inventory.sub,   explainer: BUSINESS_PAGE.tabs.inventory.explainer   },
  { id: 'performance', label: BUSINESS_PAGE.tabs.performance.label, icon: 'results',    sub: BUSINESS_PAGE.tabs.performance.sub, explainer: BUSINESS_PAGE.tabs.performance.explainer },
];

/**
 * Business page — an ARCHIVE of file folders. The four sections are folder
 * tabs across the top of one big document sheet: the active tab is taller,
 * cream, and merges seamlessly into the sheet (border-b removed, 2px overlap);
 * inactive tabs sit shorter and behind, manila-toned, each with its pastel
 * sticky-note icon — like labelled folders in a drawer.
 */
export function BusinessPage() {
  const [tab, setTab] = useState<SubTab>('operations');
  const activeTab = TABS.find((x) => x.id === tab);
  const reduced = useReducedMotion();

  // Listen for cross-component "go to audience" / "go to operations"
  // events so deep-linked CTAs (e.g. the disabled-Confirm warning
  // chip) can hop straight to the right sub-tab.
  useEffect(() => {
    const onGoto = (e: Event) => {
      const detail = (e as CustomEvent).detail as { tab?: SubTab } | undefined;
      if (detail?.tab && TABS.some((t) => t.id === detail.tab)) {
        setTab(detail.tab as SubTab);
      }
    };
    window.addEventListener('intlabs:goto', onGoto);
    return () => window.removeEventListener('intlabs:goto', onGoto);
  }, []);

  return (
    // NATURAL height — the sheet grows with its content and the page's ONE
    // scrollbar (main#sim-scroll) handles everything; no scroll-in-scroll.
    // pt-16 clears the floating Product/Business tabs pinned top-center.
    <div className="flex flex-col px-3 sm:px-4 pb-3 pt-16">
      <FolderTabs
        tabs={TABS}
        active={tab}
        onSelect={(id) => { if (tab !== id) playSfx('click-soft'); setTab(id); }}
      />

      {/* The document sheet — the active folder's contents. */}
      <section className="relative min-w-0 flex flex-col panel-frame bg-surface">
        <header className="px-4 py-3 border-b border-border-soft bg-surface-2 shrink-0 flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-7 h-7 border border-border-soft bg-surface">
            {activeTab && <PixelIcon kind={activeTab.icon} size={13} color="var(--c-primary)" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="panel-title text-text">{activeTab?.label}</div>
            <div className="body-xs font-medium text-text-2 mt-0.5">{activeTab?.sub}</div>
          </div>
          <span className="hidden lg:block hint font-medium text-text-2 text-right leading-snug max-w-[260px]">
            Decisions here don't advance days - confirm a phase to simulate.
          </span>
        </header>
        {/* Per-tab explainer - primes the user on what this section is for. */}
        {activeTab && (
          <div className="px-4 py-2.5 border-b border-border-soft bg-surface body-xs text-text-2 leading-relaxed">
            {activeTab.explainer}
          </div>
        )}
        <motion.div
          key={tab}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.2, 1, 0.4, 1] }}
          className="p-4"
        >
          {tab === 'operations' && <StudioPanel />}
          {tab === 'inventory' && <InventoryPanel />}
          {tab === 'performance' && (
            <div className="flex flex-col gap-5">
              <FinanceTable />
              <PortfolioMetrics />
            </div>
          )}
        </motion.div>
      </section>
    </div>
  );
}

/** Pastel sticky-note colours, one per folder, so sections read at a glance. */
const STICKY = ['#B7DDC0', '#E7C98C', '#E3A9A0', '#C9B6E4'];

/**
 * FolderTabs - the sections as physical FILE-FOLDER tabs across the top of
 * the sheet (per the archive reference):
 *   • active tab - taller, cream (same surface as the sheet), border-bottom
 *     removed and overlapping the sheet's top border by 2px → reads as ONE
 *     connected folder.
 *   • inactive tabs - shorter, manila, tucked behind (descending z, slight
 *     negative overlap), popping up on hover.
 *   • each tab carries its tilted pastel sticky-note icon.
 * Horizontally scrollable on narrow screens. Motion respects reduced-motion.
 */
function FolderTabs({
  tabs,
  active,
  onSelect,
}: {
  tabs: typeof TABS;
  active: SubTab;
  onSelect: (id: SubTab) => void;
}) {
  const reduced = useReducedMotion();
  return (
    <div
      role="tablist"
      aria-label="Business sections"
      // z-30 floats the row over the sheet; -mb-[2px] lets the active tab's
      // cream body cover the sheet's top border → seamless folder join.
      className="relative z-30 -mb-[2px] flex items-end gap-0 overflow-x-auto pl-1 pr-1 pt-1 shrink-0"
    >
      {tabs.map((t, i) => {
        const isActive = active === t.id;
        const sticky = STICKY[i % STICKY.length];
        return (
          <motion.button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(t.id)}
            className={clsx(
              'group relative shrink-0 flex items-center gap-2.5 border-2 px-3 sm:px-4 text-left min-w-0 cursor-pointer select-none',
              i > 0 && '-ml-2',
              isActive
                ? 'h-[64px] bg-surface border-border border-b-0 shadow-[0_-3px_0_0_rgba(0,0,0,0.12)]'
                : 'h-[56px] bg-cream-100 border-ink-900/45 border-b-0 hover:bg-cream-50',
            )}
            style={{ zIndex: isActive ? 30 : 12 - i }}
            initial={false}
            animate={reduced ? {} : { opacity: 1 }}
            whileTap={reduced ? undefined : { scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            {/* Tilted pastel sticky-note bearing the section icon — wiggles
                a little further when you hover the folder. */}
            <span
              aria-hidden
              className={clsx(
                'inline-flex items-center justify-center border border-ink-900/50 shadow-[1px_1px_0_0_rgba(0,0,0,0.3)] shrink-0 -rotate-6 transition-transform duration-200 group-hover:-rotate-12 group-hover:scale-110',
                isActive ? 'w-8 h-8' : 'w-7 h-7',
              )}
              style={{ background: sticky }}
            >
              <PixelIcon kind={t.icon} size={isActive ? 14 : 12} color="#2a2017" />
            </span>
            <span className="flex flex-col leading-tight min-w-0">
              <span className={clsx('strong uppercase tracking-wide text-ink-900 truncate', isActive ? 'body-xs' : 'body-xs')}>
                {t.label}
              </span>
              <span className="hidden md:block hint font-medium text-ink-800 truncate mt-0.5">{t.sub}</span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
