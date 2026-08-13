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
//   OpsSection — a real framed container: icon, title, hint, Details button
//   OperationsDetailModal — the reference sheet behind each section
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
    <div className={clsx('readout px-2.5 py-1.5 min-w-0', CHIP_TONE[tone], className)}>
      {/* One line, always. .stat-label carries `white-space: nowrap`, so a long
          caption clips at the chip edge instead of pushing the figure down and
          leaving one chip in a row taller than its neighbours. */}
      <div className="stat-label stat-label-on-tint truncate">{label}</div>
      {/* Values wrap rather than truncate: a clipped "$11.50/day + $…" hides
          exactly the number the player needs. */}
      <div className="num-sm mt-1 leading-tight break-words">{value}</div>
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
 * A framed section. The icon + heavy border give each decision a clear edge,
 * and `onDetails` puts the reference sheet exactly where the brief asked: top
 * right of the section it explains.
 */
export function OpsSection({
  icon,
  title,
  hint,
  onDetails,
  children,
}: {
  icon: string;
  title: string;
  hint?: string;
  onDetails?: () => void;
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
        {onDetails && (
          <motion.button
            onClick={() => {
              playSfx('click-soft');
              onDetails();
            }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="ctl-btn shrink-0 self-center flex items-center gap-1.5 border-2 border-ink-900 bg-cream-50 hover:bg-cream-100 px-2.5 py-1.5 cursor-pointer"
          >
            {/* The glyph carries the meaning ("there's more to read here"), so it
                leads; the word follows. Sized to the cap-height of eyebrow-sm so
                the two sit on one optical line. */}
            <img
              src={A.ui.pixel.info}
              alt=""
              className="w-3.5 h-3.5 object-contain shrink-0"
              style={{ imageRendering: 'pixelated' }}
              draggable={false}
            />
            {/* .btn-label-sm, not .stat-label — this is a control the player
                clicks, not a caption naming a number. */}
            <span className="btn-label-sm uppercase text-text">Details</span>
          </motion.button>
        )}
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
  /** Per-phase or one-off money cost. Omit when the option is free. */
  cost?: string;
  /** Energy to activate. Omit when it costs none. */
  energy?: number;
  /** Which products this applies to, e.g. "All notebooks". */
  impacts: string;
  /** What it actually changes in the sim. */
  effect: string;
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
 * Two panes, matching the brief: what the option costs and changes on the left,
 * the market numbers behind it on the right. Both halves are real engine
 * config, so the sheet can't disagree with the simulation.
 */
export function OperationsDetailModal({
  open,
  onClose,
  title,
  intro,
  inputs,
  tables,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  intro?: string;
  inputs: DetailInput[];
  tables: DetailTable[];
}) {
  return (
    <PixelModal open={open} onClose={onClose} title={title} size="lg" playful>
      <div className="flex flex-col gap-5">
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
                  <div className="grid grid-cols-3 gap-2">
                    <StatChip label="Cost" value={inp.cost ?? 'Free'} tone={inp.cost ? 'money' : 'muted'} />
                    <StatChip
                      label="Energy"
                      value={inp.energy ? <EnergyValue amount={inp.energy} size={13} /> : 'None'}
                      tone={inp.energy ? 'energy' : 'muted'}
                    />
                    <StatChip label="Effect" value={inp.effect} tone="good" />
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
    </PixelModal>
  );
}
