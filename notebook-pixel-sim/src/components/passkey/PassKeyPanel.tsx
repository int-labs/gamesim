import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { A } from '@/assets';
import { verifyPassKey } from '@/access/passkey';
import { PixelIcon } from '@/components/icons/PixelIcon';
import { LearnMoreModal } from './LearnMoreModal';
import { playSfx } from '@/audio/audioManager';
import { PASSKEY } from '@/content/copy';

/**
 * PassKeyPanel — the parchment "Pass Key" form.
 *
 * States covered:
 *   idle      → waiting for input
 *   checking  → verifying (button shows "Checking…", input disabled, aria-busy)
 *   error     → empty submission OR invalid key (distinct messages, shake,
 *               role="alert" live region, lock stays closed)
 *   success   → lock pops open, then hands control back via onUnlock()
 */
type Status = 'idle' | 'checking' | 'error' | 'success';

// Paper styling for the "sign" — layered as a single backgroundImage so it
// paints UNDER the form content (no extra DOM, no stacking fights):
//   1. fine grayscale grain (tiling SVG fractal noise) → real-paper texture
//   2. faint HORIZONTAL ruled lines every 28px → blank-notebook feel
//   3. two soft warm radials → aged/sun-faded corners
// The cream `bg-cream-50` class stays as the base colour beneath all of it.
const PAPER_NOISE =
  "url(\"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='180'%20height='180'%3E%3Cfilter%20id='n'%3E%3CfeTurbulence%20type='fractalNoise'%20baseFrequency='0.65'%20numOctaves='2'%20stitchTiles='stitch'/%3E%3CfeColorMatrix%20type='saturate'%20values='0'/%3E%3C/filter%3E%3Crect%20width='100%25'%20height='100%25'%20filter='url(%23n)'%20opacity='0.06'/%3E%3C/svg%3E\")";
const PAPER_BG = [
  PAPER_NOISE,
  'repeating-linear-gradient(to bottom, rgba(42,32,23,0) 0px, rgba(42,32,23,0) 27px, rgba(42,32,23,0.07) 27px, rgba(42,32,23,0.07) 28px)',
  'radial-gradient(115% 75% at 100% 0%, rgba(120,90,50,0.07), rgba(120,90,50,0) 60%)',
  'radial-gradient(115% 75% at 0% 100%, rgba(120,90,50,0.06), rgba(120,90,50,0) 55%)',
].join(', ');

export function PassKeyPanel({ onUnlock, fill }: { onUnlock: () => void; fill?: 'top' | 'center' }) {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const [learn, setLearn] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const controls = useAnimationControls();
  const inputId = useId();
  const errId = useId();

  const reduced = useReducedMotion();
  const busy = status === 'checking';
  const unlocked = status === 'success';
  // Gentle "look here" pulse on the field until the user engages with it.
  const nudge = !interacted && !reduced && !unlocked;
  // Once a key is typed, the submit button gently pulses to invite the press.
  const ready = value.trim().length > 0 && !busy && !unlocked && !reduced;

  // Auto-focus the field on desktop only. On touch devices, auto-focusing
  // would immediately pop the on-screen keyboard and cover the layout.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(pointer: fine)').matches) {
      inputRef.current?.focus();
    }
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || unlocked) return;
    setStatus('checking');
    setError(null);

    const res = await verifyPassKey(value);
    if (res.ok) {
      setStatus('success');
      playSfx('success');
      // Let the unlocked lock register for a beat, then hand off.
      window.setTimeout(onUnlock, 650);
      return;
    }

    setStatus('error');
    setError(
      res.reason === 'empty'
        ? PASSKEY.errors.empty
        : res.reason === 'offline'
          ? PASSKEY.errors.offline
          : PASSKEY.errors.invalid,
    );
    playSfx(res.reason === 'invalid' ? 'fail' : 'warning');
    controls.start({ x: [0, -8, 8, -6, 6, -3, 0], transition: { duration: 0.42 } });
    inputRef.current?.focus();
  };

  return (
    <motion.div animate={controls} className={clsx('relative w-full', fill === 'top' ? 'h-full' : 'max-w-[440px]')}>
      {/* Tape accents — pins the "sign" to the wall (decorative). z-20 keeps
          them ON TOP of the form (which is `relative` for the paper texture),
          so the tape reads as stuck over the paper's top edge. */}
      <div
        aria-hidden
        className="absolute -top-3 left-7 z-20 h-6 w-16 rotate-[-6deg] border border-ink-900/15 bg-cream-200/85 shadow-pixel-soft"
      />
      <div
        aria-hidden
        className="absolute -top-3 right-7 z-20 h-6 w-16 rotate-[5deg] border border-ink-900/15 bg-cream-200/85 shadow-pixel-soft"
      />

      <form
        onSubmit={onSubmit}
        style={{ backgroundImage: PAPER_BG }}
        className={clsx(
          'pixel-frame relative overflow-hidden bg-cream-50 p-5 sm:p-6',
          // Stage (board) fills its height; card mode hugs its content so the
          // mobile sheet is only as tall as it needs to be (centred by parent).
          fill === 'top' && 'flex h-full flex-col justify-start',
        )}
        aria-label={PASSKEY.title}
      >
        {/* Mobile full-height sheet only: show the brand up top — the storefront
            sign is cropped out on small screens. (Desktop has the sign already.)
            Left-aligned to match the rest of the content. */}
        {fill === 'center' && (
          <img
            src={A.logo}
            alt="Int Labs Academy"
            draggable={false}
            className="mb-6 h-9 w-auto self-start object-contain"
          />
        )}

        <h1 className="mb-1 section-heading text-ink-900">
          {PASSKEY.title}
        </h1>
        <p className="mb-4 font-body body-xs leading-relaxed text-ink-700">{PASSKEY.subtitle}</p>

        <label htmlFor={inputId} className="sr-only">
          {PASSKEY.inputLabel}
        </label>
        <motion.div
          className="relative"
          animate={
            nudge
              ? {
                  scale: [1, 1.03, 1],
                  boxShadow: [
                    '0 0 0 0 rgba(111,187,133,0)',
                    '0 0 0 5px rgba(111,187,133,0.30)',
                    '0 0 0 0 rgba(111,187,133,0)',
                  ],
                }
              : { scale: 1, boxShadow: '0 0 0 0 rgba(111,187,133,0)' }
          }
          transition={
            nudge
              ? { duration: 1.3, repeat: Infinity, repeatDelay: 1.4, delay: 2.4, ease: 'easeInOut' }
              : { duration: 0.2 }
          }
        >
          <input
            id={inputId}
            ref={inputRef}
            type={reveal ? 'text' : 'password'}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            disabled={busy || unlocked}
            value={value}
            onFocus={() => setInteracted(true)}
            onChange={(e) => {
              setInteracted(true);
              setValue(e.target.value);
              if (status === 'error') {
                setStatus('idle');
                setError(null);
              }
            }}
            placeholder={PASSKEY.placeholder}
            aria-invalid={status === 'error'}
            aria-describedby={errId}
            className={clsx(
              'w-full border-2 bg-cream-100 px-3 py-2.5 pr-10 font-body body-xs text-ink-900',
              'outline-none focus:ring-4 focus:ring-[#6FBB85]/40',
              'disabled:opacity-70',
              status === 'error' ? 'border-danger' : 'border-ink-900',
            )}
          />
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            aria-label={reveal ? 'Hide pass key' : 'Show pass key'}
            className="absolute right-2 top-1/2 flex -translate-y-1/2 cursor-pointer items-center p-1 text-ink-500 hover:text-ink-900"
          >
            <PixelIcon kind={reveal ? 'eye-off' : 'eye'} size={16} />
          </button>
        </motion.div>

        {/* Live region — announces empty/invalid errors. Reserves height so
            the layout doesn't jump when a message appears. */}
        <div id={errId} role="alert" aria-live="assertive" className="mt-1.5 min-h-[18px]">
          {error && <span className="font-body hint text-danger">{error}</span>}
        </div>

        <motion.button
          type="submit"
          disabled={busy || unlocked}
          aria-busy={busy}
          className={clsx(
            'mt-2 w-full border-2 border-ink-900 py-3 btn-label uppercase',
            'cursor-pointer transition-[box-shadow,filter] duration-150 hover:shadow-pixel-2',
            'disabled:cursor-wait',
            unlocked ? 'bg-success text-ink-900' : 'bg-primary text-ink-900 hover:brightness-105',
          )}
          // Subtle "ready" pulse once a key is entered (no shiny gradient).
          animate={ready ? { scale: [1, 1.03, 1] } : { scale: 1 }}
          transition={
            ready
              ? { duration: 1.2, repeat: Infinity, repeatDelay: 1.6, ease: 'easeInOut' }
              : { duration: 0.2 }
          }
          whileTap={{ scale: 0.98 }}
        >
          {busy ? PASSKEY.cta.checking : unlocked ? PASSKEY.cta.success : PASSKEY.cta.enter}
        </motion.button>

        <div className="mt-3 text-left">
          <span className="font-body hint text-ink-600">{PASSKEY.noKeyPrompt} </span>
          <button
            type="button"
            onClick={() => setLearn(true)}
            className="cursor-pointer font-body hint text-secondary underline underline-offset-2 hover:text-ink-900"
          >
            {PASSKEY.learnMoreCta}
          </button>
        </div>

        {/* Handwritten signature, bottom-right of the sheet (decorative).
            Caveat is a true handwriting face, so it reads as a penned sign-off.
            Stage mode floats it in the board's empty space; card mode (which
            now hugs its content) flows it after the content so it never
            overlaps. */}
        <span
          aria-hidden
          style={{ fontFamily: "'Caveat', cursive" }}
          className={clsx(
            'pointer-events-none -rotate-3 select-none body-sm font-semibold leading-none text-ink-800/40',
            fill === 'top' ? 'absolute bottom-10 right-8' : 'mt-5 ml-auto block w-fit',
          )}
        >
          made with <span className="text-danger/50">♥</span> by Int Labs
        </span>
      </form>

      <LearnMoreModal open={learn} onClose={() => setLearn(false)} />
    </motion.div>
  );
}
