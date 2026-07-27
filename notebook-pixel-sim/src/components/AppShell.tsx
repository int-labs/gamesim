import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { A } from '@/assets';
import { ASSET_MANIFEST, preloadImages, preloadIdle } from '@/utils/preload';

/**
 * AppShell — gates the root render behind a branded loading screen.
 *
 * On first paint the user sees the loading visual immediately (Int Labs
 * logo + pixel progress bar + rotating "preparing your studio…" line).
 * The shell awaits the priority-0 manifest (logo) and the priority-1
 * manifest (start-screen visuals + neutral Amelia + desk background).
 * When those settle the children render.
 *
 * Priority-2 (default notebook thumbnails) and priority-4 (idle nice-to-
 * haves) preload AFTER children mount, via requestIdleCallback. They
 * never block the UI.
 *
 * If the priority assets fail to load (offline image), the shell still
 * dismisses after a short safety timeout — broken images get the
 * SmartPixelImage fallback in the actual UI.
 */

const LOADING_LINES = [
  'Preparing your notebook studio…',
  'Stacking paper sheets…',
  'Sharpening pencils…',
  'Checking inventory…',
  'Calling Amelia…',
];

interface Stage {
  label: string;
  promise: Promise<void>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [line, setLine] = useState(0);

  // Rotate loading messages every 1.4s while waiting.
  useEffect(() => {
    if (ready) return;
    const id = setInterval(() => {
      setLine((n) => (n + 1) % LOADING_LINES.length);
    }, 1400);
    return () => clearInterval(id);
  }, [ready]);

  useEffect(() => {
    let cancelled = false;
    const stages: Stage[] = [
      { label: 'Loading app shell',  promise: preloadImages(ASSET_MANIFEST.priority0Critical) },
      { label: 'Loading core assets', promise: preloadImages(ASSET_MANIFEST.priority1FirstView) },
    ];
    const total = stages.length;

    (async () => {
      for (let i = 0; i < stages.length; i++) {
        await stages[i].promise;
        if (cancelled) return;
        setProgress(((i + 1) / total) * 100);
      }
      if (cancelled) return;
      setReady(true);

      // After children mount, opportunistically warm priority-2 +
      // priority-4 during idle time. These are nice-to-have and do not
      // gate any UI — players may navigate before they finish, and
      // SmartPixelImage handles late arrivals gracefully.
      preloadIdle([
        ...ASSET_MANIFEST.priority2Common,
        ...ASSET_MANIFEST.priority4Idle,
      ]);
    })();

    // Safety timeout — if assets stall (offline / 404), let the user in
    // anyway after 4s. The UI will surface fallbacks where needed.
    const safety = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 4000);
    return () => { cancelled = true; clearTimeout(safety); };
  }, []);

  return (
    <>
      {/* Children render as soon as ready=true. Always mounted under
          the overlay so first paint can begin layout immediately. */}
      {ready && children}

      <AnimatePresence>
        {!ready && (
          <motion.div
            key="loading"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 1.4, 0.4, 1] }}
            className="fixed inset-0 z-[1000] flex items-center justify-center"
            style={{
              // Direct image URL so we don't depend on JS-side asset
              // resolution to render the loading background. If it
              // fails the cream fallback below covers it.
              backgroundColor: '#FBF6E9',
              backgroundImage: `url('${A.env.deskFull}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="absolute inset-0 bg-ink-900/40" />
            <div className="relative pixel-frame bg-cream-50 max-w-[420px] w-[88vw] p-5 text-center">
              <img
                src={A.logo}
                alt="Int Labs"
                className="h-9 w-auto mx-auto mb-3"
                style={{ imageRendering: 'pixelated' }}
                draggable={false}
              />
              <div className="font-hud text-[10px] uppercase tracking-wider text-ink-700 mb-2">
                Int Labs Academy
              </div>
              <div className="text-[13px] font-body text-ink-800 mb-3 min-h-[18px]">
                {LOADING_LINES[line]}
              </div>
              <ProgressBar value={progress} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** Pixel-style progress bar. Stable height so the loading panel doesn't reflow. */
function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="relative h-3 w-full bg-cream-200 border-2 border-ink-900"
    >
      <div
        className="absolute inset-y-0 left-0"
        style={{
          width: `${clamped}%`,
          backgroundColor: 'var(--c-primary)',
          boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.25)',
          transition: 'width 0.25s ease-out',
        }}
      />
    </div>
  );
}
