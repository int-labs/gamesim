// Shared furniture for the Operations page.
//
// The old page ran every section together: a tiny uppercase caption, a hint,
// then controls, with costs and energy buried as muted inline text like
// "reach 30% · $300/phase". Nothing framed a section, so the eye had no idea where
// one decision ended and the next began, and the numbers you actually decide on
// were the least visible thing on screen.
//
// Three pieces fix that:
//   StatChip   — every cost / energy / effect gets a bordered, labelled chip
//   OpsSection — a real framed container: icon, title, hint
//   OperationsDetailSheet — ONE reference sheet, every section a tab
//
// Typography follows the shared scale in src/styles/index.css. Numerals are
// always .num-* (Inter, tabular) and never a pixel face.

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { PixelModal } from '@/components/primitives/PixelModal';
import { PixelBadge } from '@/components/primitives';
import { playSfx } from '@/audio/audioManager';
import { A } from '@/assets';
import { EnergyValue } from '@/components/primitives/EnergyValue';

// ── Chips ────────────────────────────────────────────────────────────────────

type ChipTone = 'money' | 'energy' | 'reach' | 'good' | 'muted';

// CHIP TONES — colour encodes MEANING, and each meaning has exactly one hue.
//
// This used to be four tones over two colours: `money` and `energy` were both
// amber, `reach` and `muted` were both caramel. Colour therefore told you
// nothing, while three adjacent chips could still come out three different
// shades — a gain, a rate and a threshold each tinted differently in one row,
// which is what made these read as a rainbow rather than a table.
//
//   good    sage    something you GAIN     (output, sell-rate lift)
//   money   amber   money OUT or a money threshold (cost, breakeven, fees)
//   energy  caramel the other currency you spend — warm and adjacent to
//                   money because it is also a cost, but its own shade so a
//                   ⚡ never reads as a $
//   reach   surface a neutral descriptor: not good, not bad, not a cost
//   muted   quiet   a de-emphasised value. NOT the off-card treatment: an
//                   off card fades its whole content with opacity, so its
//                   chips keep their normal tint and fade with everything
//                   else. Bleaching each chip instead left labels sitting on
//                   almost no fill, which read as a missing background.
// The TRAY is the tone. A flat variant was tried - caption over figure, colour
// moved onto the value's ink, no fill - on the theory that a tinted box inside
// a card was one nested fill too many. It reads calmer in isolation and it is
// the wrong trade: without the fill the labels stop being grouped objects and
// the row turns into loose text, so the cost/energy coding that is supposed to
// organise the card at a glance has to be READ rather than seen. The fill stays.
//
// (If it is ever revisited: `text-success` / `text-warning` are the ink classes.
// tailwind.config maps textColor.success straight to the --c-*-ink weight, so
// `text-success-ink` is not a class, compiles to nothing, and silently leaves
// every value on the default ink.)
const CHIP_TONE: Record<ChipTone, string> = {
  money: 'bg-warning-soft text-text',
  energy: 'bg-surface-muted text-text',
  reach: 'bg-surface-2 text-text',
  good: 'bg-success-soft text-text',
  muted: 'bg-surface-2 text-text-2',
};

/**
 * A single decision-relevant number, given its own bordered box with a label
 * above it. These are the things the player is actually choosing between, so
 * they get to look like values rather than footnotes.
 */
export function StatChip({
  label,
  value,
  tone = 'muted',
  className,
}: {
  label: string;
  value: ReactNode;
  tone?: ChipTone;
  className?: string;
}) {
  return (
    // No BORDER - a chip carrying a number is not pressable, and giving it the
    // same 2px frame as the buttons beside it is most of why the page was hard
    // to read as a set of controls. But it keeps its FILL: `.readout`'s inset
    // shadow says "display", and the tint is what makes label + value read as
    // one object instead of two loose lines.
    // SIDE BY SIDE, not stacked. A caption over its figure made every chip two
    // lines tall, so five facts became a five-storey block and the card was
    // mostly chips. On one baseline a chip is a row in a table - caption left,
    // figure right - which is how you read a set of numbers against each other.
    //
    // WRAPS to a second line when both halves cannot share one. The value used
    // to be `shrink-0` on the reasoning that a clipped "$11.50 / uni" hides
    // what the player came for - true for a short figure, but these values are
    // not all figures. "$150 / phase" and "No holding cost" in a `grid-cols-3`
    // third simply ran out over the caption and clipped it, so the chip read
    // "COS$150 / phase". Neither half is allowed to overrun the other now:
    // `min-w-0` lets both give way, and the row wraps before anything clips.
    <div
      className={clsx(
        // `content-center` is what keeps a ROW of chips aligned. Flex siblings
        // stretch to the tallest, so a chip whose caption wrapped to two lines
        // made its neighbours tall boxes with their content pinned to the top.
        // Centring the flex LINES puts every chip's content on the same visual
        // middle whatever its neighbours do.
        'readout px-2.5 py-1.5 min-w-0 flex flex-wrap content-center items-baseline justify-between gap-x-2 gap-y-0.5',
        CHIP_TONE[tone],
        className,
      )}
    >
      {/* The caption names the figure - "OUTPUT / P…" tells you nothing, so it
          wraps rather than truncating. The grid row stretches its cells, so a
          caption taking two lines lifts its whole row and the chips stay level. */}
      <div className="stat-label stat-label-on-tint min-w-0 leading-tight break-words">{label}</div>
      {/* `ml-auto` keeps it right-aligned even once it has wrapped onto a line
          of its own, where `justify-between` would otherwise flush it left.
          `num-xs` not `num-sm`: at 17px a three-word value could not share a
          third of a card with its caption at any wrap point. */}
      <div className="num-xs leading-tight min-w-0 ml-auto text-right break-words">{value}</div>
    </div>
  );
}

/** Inline energy cost, used inside buttons where a full chip won't fit. */
export function EnergyTag({ amount, className }: { amount: number; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 bg-warning-soft px-1.5 py-[1px]',
        className,
      )}
    >
      <EnergyValue amount={amount} className="num-xs" />
    </span>
  );
}

// ── Section shell ────────────────────────────────────────────────────────────

/**
 * A framed section. The icon + heavy border give each decision a clear edge.
 *
 * NO Details button. Each section used to carry its own, opening its own popup,
 * so the control the player reaches for most moved four times down one page and
 * the reference sheet arrived with no sense of what else it covered. The page
 * now has ONE Details button in a fixed spot and one sheet with a tab per
 * section — see `OperationsDetailSheet`.
 */
export function OpsSection({
  icon,
  title,
  hint,
  children,
}: {
  icon: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    // NO frame of its own. Reading one figure on this page meant parsing FIVE
    // nested boxes - chip inside card inside section inside sheet inside page -
    // each drawing its own edge and fill. That is the structural reason the
    // screen read as cluttered, and no amount of colour tuning fixes it; a
    // level has to go. The section is identified by its masthead band and the
    // space around it, which is enough, so its border comes off and the count
    // drops to four.
    <section className="bg-cream-50">
      {/* The masthead carries the section's weight: bigger art and a heading
          that outranks the card titles underneath it. */}
      <header className="flex items-center gap-3.5 px-4 py-3 border-b border-border-soft bg-cream-200">
        <img
          src={icon}
          alt=""
          className="w-20 h-20 object-contain shrink-0"
          style={{ imageRendering: 'pixelated' }}
          draggable={false}
        />
        <div className="min-w-0 flex-1">
          <h3 className="section-heading text-ink-900">{title}</h3>
          {hint && <p className="body-xs text-text-2 mt-1 measure">{hint}</p>}
        </div>
      </header>
      <div className="p-3.5">{children}</div>
    </section>
  );
}

// ── Detail modal ─────────────────────────────────────────────────────────────

export interface DetailInput {
  /** Option name, e.g. "Offline" or "Ains L2". */
  name: string;
  description: string;
  /** The per-phase money figure ALONE — "$137.00", not "$137 / phase". The
   *  chip's caption carries the unit, exactly as it does on the option cards.
   *  Omit when the option is free. */
  cost?: string;
  /** A per-sale rate, where the lever charges one (channel consignment).
   *  Omit where the concept does not apply — the chip is then not rendered. */
  perSale?: string;
  /** Energy to activate. Omit when it costs none. */
  energy?: number;
  /** Which products this applies to, e.g. "All notebooks". */
  impacts: string;
}

export interface DetailTable {
  caption?: string;
  columns: string[];
  /** Cell 0 is a row label (left, bold); the rest are numerals (right). */
  rows: (string | number)[][];
}

/**
 * The masthead for one half of the detail sheet. Art + a title at heading
 * weight + a line saying what this half is FOR, so the reader knows which
 * question each column answers before reading any of it.
 */
function PaneHeader({ icon, title, blurb }: { icon: string; title: string; blurb: string }) {
  return (
    <div className="flex items-center gap-3 pb-3 border-b border-border-soft">
      <img
        src={icon}
        alt=""
        className="w-10 h-10 object-contain shrink-0"
        style={{ imageRendering: 'pixelated' }}
        draggable={false}
      />
      <div className="min-w-0">
        <h4 className="h3 uppercase text-ink-900 leading-none">{title}</h4>
        <p className="hint text-text-3 mt-1 measure">{blurb}</p>
      </div>
    </div>
  );
}

/**
 * One Operations section, as a tab in the sheet.
 *
 * Structurally a `SectionDetail` (from operationsDetails.ts) plus the three
 * fields the tab bar needs. Spread rather than imported — `operationsDetails`
 * already imports `DetailInput`/`DetailTable` from here, and naming its type in
 * this file would close the loop.
 */
export interface DetailSection {
  id: string;
  /** Tab label. The section's own name, verbatim — the tab and the OpsSection
   *  masthead it explains must read as the same word. */
  label: string;
  icon: string;
  title: string;
  intro?: string;
  inputs: DetailInput[];
  tables: DetailTable[];
}

/**
 * THE reference sheet for the whole Operations page: one tab per section.
 *
 * Was four separate modals, each opened by a Details button in its own
 * section's masthead. Two costs, both structural:
 *
 *   1. the trigger MOVED. Four buttons down a long scrolling page meant the
 *      most-used control on the screen was never twice in the same place, and
 *      never where the Product page keeps its own Details button.
 *   2. four popups over one dataset. The sections are a single source of truth
 *      about one company — comparing a channel's per-phase cost against a
 *      hire's meant closing one popup, scrolling, and opening another from
 *      memory.
 *
 * The tab bar is deliberately the SAME component shape as ArchetypeDetailModal's
 * (tab-label-sm, 2px top border, shared-layout underline): two sheets that
 * behave differently are two things to learn.
 */
export function OperationsDetailSheet({
  open,
  onClose,
  sections,
  activeId,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  sections: DetailSection[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  // Falls back to the first tab rather than rendering an empty sheet: `sections`
  // is derived from the backend global inputs, so an id can go away under a
  // config change while the open sheet still holds it.
  const active = sections.find((s) => s.id === activeId) ?? sections[0] ?? null;

  return (
    <PixelModal
      open={open}
      onClose={onClose}
      // A FIXED title. The section name moves with the tabs, inside the panel —
      // if the modal's own heading changed too, the one piece of chrome that
      // tells you where you are would be the piece that keeps moving.
      title="Business Details"
      size="lg"
      playful
      className="h-[min(660px,calc(100dvh-48px))]"
      // The panel owns the scroll, so the tab bar stays put while it moves.
      bodyClassName="overflow-hidden"
    >
      <div className="flex flex-col h-full min-h-0">
        {/* ── Tab bar ── */}
        <div
          role="tablist"
          aria-label="Operations sections"
          className="shrink-0 flex items-end gap-1 px-2 pt-2 border-b border-border-soft bg-cream-200 overflow-x-auto"
        >
          {sections.map((s) => {
            const isActive = s.id === active?.id;
            return (
              <motion.button
                key={s.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  if (s.id === active?.id) return;
                  playSfx('whoosh');
                  onSelect(s.id);
                }}
                whileTap={{ scale: 0.95 }}
                whileHover={isActive ? undefined : { y: -2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                className={clsx(
                  'relative tab-label-sm px-3.5 sm:px-4 py-2.5 border-2 border-b-0 transition-colors cursor-pointer whitespace-nowrap',
                  isActive
                    ? 'bg-cream-50 border-ink-900 text-ink-900 -mb-[2px] pb-[12px]'
                    : 'bg-cream-100 border-ink-700/30 text-text-2 hover:text-text hover:bg-cream-50',
                )}
              >
                {s.label}
                {isActive && (
                  // Its own layoutId, not the Product sheet's — a shared one
                  // would make two mounted sheets fight over one element.
                  <motion.div
                    layoutId="ops-detail-tab-underline"
                    className="absolute left-0 right-0 -bottom-[2px] h-[3px] bg-cream-50"
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* ── Panel ── */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 bg-cream-50">
          {active && (
            // Keyed remount replays the enter animation on every tab change
            // with no exit gap — the same trick the Product sheet uses.
            <motion.div
              key={active.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.18, ease: [0.2, 1, 0.4, 1] }}
            >
              <DetailPanes section={active} />
            </motion.div>
          )}
        </div>
      </div>
    </PixelModal>
  );
}

/**
 * Two panes, matching the brief: what the option costs and changes on the left,
 * the market numbers behind it on the right. Both halves are real engine
 * config, so the sheet can't disagree with the simulation.
 */
function DetailPanes({ section }: { section: DetailSection }) {
  const { intro, inputs, tables } = section;
  return (
      <div className="flex flex-col gap-5">
        {/* The section's own name, INSIDE the panel. The modal heading is fixed
            now, so without this the sheet would not say which of the four you
            are reading. */}
        <div className="flex items-center gap-3">
          <img
            src={section.icon}
            alt=""
            className="w-9 h-9 object-contain shrink-0"
            style={{ imageRendering: 'pixelated' }}
            draggable={false}
          />
          <h3 className="section-heading text-ink-900 min-w-0">{section.title}</h3>
        </div>
        {intro && (
          <p className="body-sm text-text-2 leading-relaxed border-l-4 border-info pl-3">{intro}</p>
        )}

        {/* The two halves answer different questions — "what can I choose?" and
            "what are the numbers behind it?" — so they get a real gutter, their
            own captioned headers and a full-height rule between them. Before,
            two identical small captions and a 16px gap made it read as one long
            column that happened to change shape halfway down. */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_2px_minmax(0,1fr)] gap-6 lg:gap-0 items-start">
          {/* ── Global inputs ── */}
          <div className="flex flex-col gap-3 lg:pr-6">
            <PaneHeader
              icon={A.ui.sidebar.studio}
              title="Global inputs"
              blurb="What you can switch on, and what each one costs."
            />
            {inputs.map((inp, i) => (
              <motion.div
                key={inp.name}
                // Hairline, not a 2px ink frame. This is a REFERENCE card in a
                // read-only sheet — nothing here is pressable — and it was
                // wearing the same frame as the buttons on the page behind it.
                // Its own header band already separates one entry from the next.
                className="border border-border-soft bg-cream-50"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, type: 'spring', stiffness: 280, damping: 22 }}
              >
                <div className="px-3 py-2 border-b border-border-soft bg-cream-200 flex items-center justify-between gap-2">
                  <span className="item-name text-text truncate">{inp.name}</span>
                  <PixelBadge tone="neutral">{inp.impacts}</PixelBadge>
                </div>
                <div className="p-3 flex flex-col gap-2">
                  <p className="body-xs text-text-2">{inp.description}</p>
                  {/* FLEX-WRAP, not `grid-cols-3`. Three fixed thirds gave
                      every chip the same width whatever it held, so "No holding
                      cost" and "$150 / phase" were crushed into the same space
                      as "None". Each chip takes an equal share while they fit
                      and drops to its own full-width line when they do not. */}
                  {/* SAME captions and SAME value shape as the option cards on
                      the page behind this sheet — "Per phase / $137.00", not
                      "Cost / $137 / phase + 20% of each sale". One lever
                      described two ways reads as two different levers, and the
                      crammed string was also what overflowed its chip. */}
                  <div className="flex flex-wrap gap-2">
                    <StatChip
                      className="grow basis-[132px]"
                      label="Per phase" value={inp.cost ?? 'Free'} tone={inp.cost ? 'money' : 'muted'}
                    />
                    {inp.perSale !== undefined && (
                      <StatChip
                        className="grow basis-[132px]"
                        label="Per sale" value={inp.perSale}
                        tone={inp.perSale === 'None' ? 'good' : 'money'}
                      />
                    )}
                    <StatChip
                      className="grow basis-[132px]"
                      label="Energy"
                      value={inp.energy ? <EnergyValue amount={inp.energy} size={13} /> : 'None'}
                      tone={inp.energy ? 'energy' : 'muted'}
                    />
                    {/* No "Effect" chip. Every channel's read "No holding
                        cost", and the other sections reduced a whole step
                        curve to one unlabelled figure ("+0.3"). The tables
                        below carry the real per-step effects. */}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Full-height rule. A border on the right pane only reached as far
              as that pane's content; as its own grid track it spans the taller
              of the two. */}
          <div className="hidden lg:block self-stretch bg-border-soft" />

          {/* ── Market data ── */}
          <div className="flex flex-col gap-3 lg:pl-6">
            <PaneHeader
              icon={A.ui.sidebar.metrics}
              title="Market data"
              blurb="The engine's own numbers - what those choices are worth."
            />
            {tables.map((t, i) => (
              <motion.div
                key={i}
                // The caption sits OUTSIDE the scroll container. Inside it, a
                // wide table scrolled the caption along with the columns and
                // clipped it ("…VEL 1)"), because a block inside an
                // overflow-x-auto box scrolls with its content rather than
                // pinning to the visible width. Only the table scrolls now.
                // Border also drops to the static weight (RULE 5) — this is a
                // panel, not a control.
                className="border border-border-soft bg-cream-50"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.04, type: 'spring', stiffness: 280, damping: 22 }}
              >
                {t.caption && (
                  <div className="px-3 py-2 border-b border-border-soft bg-cream-200">
                    <span className="stat-label text-text">{t.caption}</span>
                  </div>
                )}
                <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-cream-100 border-b border-border-soft">
                      {t.columns.map((c, j) => (
                        <th
                          key={c}
                          className={clsx(
                            'stat-label px-3 py-2',
                            j === 0 ? 'text-left' : 'text-right',
                          )}
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {t.rows.map((r, ri) => (
                      // Zebra striping: these tables are read across a row to
                      // compare one market's numbers, and at four-plus columns
                      // the eye loses the line without it.
                      <tr key={ri} className={clsx('border-b border-border-soft last:border-b-0', ri % 2 === 1 && 'bg-cream-100/50')}>
                        {r.map((cell, ci) => (
                          <td
                            key={ci}
                            className={clsx(
                              'px-3 py-2',
                              ci === 0
                                ? 'item-name text-text whitespace-nowrap'
                                : 'num-xs text-ink-900 text-right',
                            )}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
  );
}
