import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Bot } from 'lucide-react';
import { useGame } from '@/state/store';
import { A } from '@/assets';
import type { BubbleType, MascotMood } from '@/types';
import { PixelIcon } from '@/components/icons/PixelIcon';
import { NavIcon } from '@/components/icons/NavIcon';
import { playSfx } from '@/audio/audioManager';
import { HeartRain, patHeartRain, originOf } from '@/components/fx/HeartRain';
import { ameliaVoice, moodFromMessage } from '@/audio/ameliaVoice';

const tones: Record<BubbleType, { accent: string; tag: string; tagBg: string }> = {
  hint:     { accent: 'border-border-soft', tag: 'text-text-2',   tagBg: 'bg-surface-2' },
  warning:  { accent: 'border-warning',     tag: 'text-warning',  tagBg: 'bg-warning-soft' },
  success:  { accent: 'border-success',     tag: 'text-success',  tagBg: 'bg-success-soft' },
  event:    { accent: 'border-info',        tag: 'text-info',     tagBg: 'bg-info-soft' },
  insight:  { accent: 'border-info',        tag: 'text-info',     tagBg: 'bg-info-soft' },
  debrief:  { accent: 'border-secondary',   tag: 'text-secondary',tagBg: 'bg-secondary-soft' },
  tutorial: { accent: 'border-primary',     tag: 'text-primary',  tagBg: 'bg-primary-soft' },
};

const labels: Record<BubbleType, string> = {
  hint: 'Hint',
  warning: 'Heads up',
  success: 'Nice',
  event: 'Event',
  insight: 'Insight',
  debrief: 'Debrief',
  tutorial: 'Tutorial',
};

const moodSrc: Record<MascotMood, string> = {
  neutral: A.mascot.expressions.neutral,
  happy: A.mascot.expressions.happy,
  happy_soft: A.mascot.expressions.happy_soft,
  excited: A.mascot.expressions.excited,
  excited_big: A.mascot.expressions.excited_big,
  thinking: A.mascot.expressions.thinking,
  thinking_side: A.mascot.expressions.thinking_side,
  concerned: A.mascot.expressions.concerned,
  concerned_soft: A.mascot.expressions.concerned_soft,
  confused: A.mascot.expressions.confused,
  confused_tilt: A.mascot.expressions.confused_tilt,
  warning: A.mascot.expressions.warning,
  warning_alert: A.mascot.expressions.warning_alert,
  pointing_left: A.mascot.poses.pointing_left,
  pointing_right: A.mascot.poses.pointing_right,
  pointing_left_explain: A.mascot.poses.pointing_left_explain,
  pointing_right_explain: A.mascot.poses.pointing_right_explain,
  presenting: A.mascot.poses.presenting,
  presenting_open_hand: A.mascot.poses.presenting_open_hand,
  idle: A.mascot.expressions.neutral,
  idle_soft_wave: A.mascot.poses.idle_soft_wave,
};

const TYPEWRITER_MS_PER_CHAR = 14;

/**
 * Visual-novel overlay — bottom-anchored composition stage.
 *
 *   .vn-overlay              (fixed inset-0, z-9999, dim backdrop)
 *     ├── .vn-skip                top-right skip button
 *     └── .vn-stage              absolute, bottom-anchored, fixed height
 *         ├── .vn-dialogue            LEFT  zone, bottom-aligned
 *         └── .vn-character-crop      RIGHT zone, clipping window
 *             └── img.vn-character        sprite top-aligned, lower body
 *                                         clipped by container overflow
 *
 * Cropping: the .vn-character-crop container's height equals the stage
 * height (~min(46vh, 430px)). The img is sized by width (max 420px),
 * height intrinsic — taller than the container. align-items: flex-start
 * pins the head to the top; overflow: hidden clips the legs. The face
 * is never cropped.
 *
 * Composition: dialogue and crop are grid columns sharing the same
 * bottom baseline (align-items: end). gap is small so they read as one
 * scene. Stage is anchored to the lower portion of the viewport, leaving
 * empty dim space above for the VN feel.
 *
 * Skip vs Continue:
 *   - Skip dismisses ALL queued messages → clearMascotQueue → overlay
 *     unmounts on next render.
 *   - Continue mid-typewriter reveals; once fully revealed, advances the
 *     queue via popMascot.
 */
export function VisualNovelMascot() {
  const current = useGame((s) => s.mascot.current);
  const mood = useGame((s) => s.mascot.mood);
  const minimized = useGame((s) => s.mascot.minimized);
  const popMascot = useGame((s) => s.popMascot);
  const prevMascot = useGame((s) => s.prevMascot);
  const clearMascotQueue = useGame((s) => s.clearMascotQueue);
  const historyLen = useGame((s) => s.mascot.history.length);
  // Within a sequence, "has previous" means there's a prior message in
  // the SAME sequence (don't step back into a different dialogue).
  const canGoPrev = (() => {
    if (!current) return false;
    if (historyLen === 0) return false;
    if (!current.seqId) return false;
    return (current.seqIndex ?? 0) > 0;
  })();
  const isLastInSequence = !!current?.seqId && (current.seqIndex ?? 0) + 1 >= (current.seqLen ?? 1);
  // How many messages are queued AFTER this one. The app routinely pushes two
  // scripts back-to-back — the Phase 1 debrief immediately followed by the
  // Phase 2 intro, for instance — so "last message of THIS sequence" is not the
  // same thing as "end of all dialogue".
  const queueLen = useGame((s) => s.mascot.queue.length);
  // Only the genuine end: last of its sequence AND nothing waiting behind it.
  const isFinalMessage = isLastInSequence && queueLen === 0;

  const [shown, setShown] = useState('');
  const intervalRef = useRef<number | null>(null);

  // Patting the dialogue portrait: a CSS squash-and-stretch plus an escalating
  // love bomb behind her. The counter is a ref, not state, so a pat never
  // re-renders the typewriter mid-line.
  const [patting, setPatting] = useState(false);
  const patCount = useRef(0);
  const spriteRef = useRef<HTMLImageElement>(null);
  const onPat = () => {
    patCount.current += 1;
    playSfx('pop');
    setPatting(true);
    patHeartRain(patCount.current, originOf(spriteRef.current));
  };

  // Typewriter + voice narration. Both are driven by `current.id`
  // changes — when the displayed line flips (Next/Prev/auto-promote),
  // we restart the typewriter AND ask Amelia to speak. Voice manager
  // de-dupes by id so React effect re-fires don't replay.
  useEffect(() => {
    if (!current || minimized) {
      setShown('');
      ameliaVoice.stop();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    setShown('');
    let i = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      i++;
      setShown(current.body.slice(0, i));
      if (i >= current.body.length) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, TYPEWRITER_MS_PER_CHAR);
    // Speak the line — the manager handles cancel-previous, so rapid
    // Next clicks won't overlap. SFX-disabled = silent (audioManager
    // mirrors the toggle into ameliaVoice).
    ameliaVoice.speak({
      id: current.id,
      text: current.body,
      mood: moodFromMessage(current),
    });
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [current, minimized]);

  if (minimized || !current) return null;

  const fullyTyped = shown.length >= current.body.length;
  // Reveal-all must also stop the typewriter interval; otherwise the
  // next tick would overwrite the fully-revealed text with another
  // partial slice.
  const revealAll = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setShown(current.body);
  };

  const onNext = () => {
    if (!fullyTyped) {
      revealAll();
      playSfx('click-soft');
      return;
    }
    if (isFinalMessage) {
      // Truly the end of all dialogue — safe to clear.
      playSfx('click');
      clearMascotQueue();
      return;
    }
    // Either mid-sequence, or the last message of this script with a follow-up
    // still queued. Advance rather than clear: `clearMascotQueue()` here would
    // discard the queued script outright, so finishing the Phase 1 debrief
    // silently ate the Phase 2 intro that had been pushed right behind it.
    playSfx('click-soft');
    popMascot();
  };

  const onPrev = () => {
    if (!canGoPrev) return;
    playSfx('click-soft');
    prevMascot();
  };

  // Skip = dismiss EVERYTHING. The store action clears queue + current,
  // which unmounts this component on the next render.
  const onSkip = () => {
    playSfx('click');
    clearMascotQueue();
  };

  const src = moodSrc[(current.mood ?? mood) as MascotMood] ?? moodSrc.neutral;
  const tone = tones[current.type];

  return (
    <div className="vn-overlay" role="dialog" aria-modal="true" aria-label={`${labels[current.type]} from Amelia`}>
      {/* Skip — top-right of overlay, above the stage. Always reachable. */}
      <button
        onClick={onSkip}
        aria-label="Skip dialogue"
        title="Skip - close all dialogue"
        className="vn-skip"
      >
        <span>Skip</span>
        <span aria-hidden>▸</span>
      </button>

      <div className="vn-stage">
        {/* LEFT — Dialogue (bottom-anchored, fills the stage row) */}
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id + ':dialogue'}
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 1.4, 0.4, 1] }}
            className="vn-dialogue"
          >
            <div
              className={clsx(
                'panel-frame panel-frame--lifted-lg bg-surface flex flex-col',
                tone.accent,
              )}
              style={{ minHeight: 220, maxHeight: 320 }}
            >
              {/* Header — speaker label + sequence progress */}
              <div className="flex items-center justify-between px-5 py-3 border-b-2 border-border-soft bg-surface-2 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={clsx(
                      'inline-flex items-center justify-center w-8 h-8 border-2 shrink-0',
                      tone.accent,
                      tone.tagBg,
                    )}
                  >
                    <NavIcon icon={Bot} size={14} color="currentColor" />
                  </span>
                  {/* Title is ALWAYS dark ink — tone colours (amber/green/…)
                      were unreadable on the caramel header bar; the tone
                      still shows via the icon chip + accent border. */}
                  <span className="eyebrow eyebrow-sm tracking-[0.16em] truncate text-ink-900">
                    {current.seqTitle
                      ? `Amelia · ${current.seqTitle}`
                      : `Amelia · ${labels[current.type]}`}
                  </span>
                </div>
                {current.seqLen && current.seqLen > 1 && (
                  <span
                    className="num-xs tracking-wider text-text-3 shrink-0"
                    aria-label={`Message ${(current.seqIndex ?? 0) + 1} of ${current.seqLen}`}
                  >
                    {(current.seqIndex ?? 0) + 1} / {current.seqLen}
                  </span>
                )}
              </div>

              {/* Body — typewriter (flex-grow so footer stays pinned) */}
              <div
                className="px-7 py-6 body-xs leading-[1.6] text-text whitespace-pre-wrap flex-1 overflow-auto"
              >
                {shown}
                {!fullyTyped && <span className="opacity-60 animate-pulse">▌</span>}
              </div>

              {/* Footer — Previous (only when a prior message exists),
                   Next / Finish. Previous is hidden entirely on the
                   first message of a sequence so the empty button does
                   not waste space or look broken. */}
              <div
                className={clsx(
                  'flex items-center gap-2 px-5 py-3 border-t border-border-soft bg-surface-2/70 shrink-0',
                  canGoPrev ? 'justify-between' : 'justify-end',
                )}
              >
                {canGoPrev && (
                  <button
                    onClick={onPrev}
                    className="inline-flex items-center gap-2 h-[36px] px-4 border-2 border-border-soft bg-surface text-text-2 hover:bg-surface-2 hover:text-text cursor-pointer"
                    aria-label="Previous message"
                  >
                    <PixelIcon kind="arrow-right" size={11} color="currentColor" className="rotate-180" />
                    <span className="eyebrow eyebrow-sm">Previous</span>
                  </button>
                )}
                <button
                  onClick={onNext}
                  // Matches the game's primary CTA: bright fill, deep ink
                  // label. The dark-fill/cream-label pairing this used to
                  // share with `.game-btn` read as a disabled control, and
                  // this is the button that advances every tutorial line.
                  className="vn-continue inline-flex items-center gap-2 h-[36px] px-5 border-2 border-border bg-primary text-[#12301C] cursor-pointer"
                  aria-label={isFinalMessage ? 'Finish' : (fullyTyped ? 'Next message' : 'Reveal full message')}
                >
                  <span className="eyebrow eyebrow-sm text-inherit">
                    {!fullyTyped ? 'Reveal' : isFinalMessage ? 'Finish' : 'Next'}
                  </span>
                  <PixelIcon kind="arrow-right" size={11} color="currentColor" />
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* RIGHT — Mascot crop window. Plain DOM (no framer-motion on the
             crop or the img) so the CSS idle animation runs cleanly.

             Pat her and hearts erupt from BEHIND: the canvas sits at z-1, the
             crop at z-2, so Amelia is never covered by her own love bomb. */}
        <HeartRain className="pointer-events-none absolute inset-0 z-[1]" />
        <div
          className="vn-character-crop"
          onClick={onPat}
          role="button"
          tabIndex={0}
          aria-label="Pat Amelia"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPat(); } }}
        >
          <img
            ref={spriteRef}
            className={clsx('vn-character', patting && 'is-hopping')}
            onAnimationEnd={(e) => { if (/mascot-pat/.test(e.animationName)) setPatting(false); }}
            key={current.id + ':sprite'}
            src={src}
            alt=""
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
