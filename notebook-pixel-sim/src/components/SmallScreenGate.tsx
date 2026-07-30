import { useEffect, useState } from 'react';

/**
 * SmallScreenGate — informational, NOT blocking.
 *
 * The simulation now has dedicated tablet and mobile layouts. This gate
 * surfaces a one-time tip on very narrow screens (< 768px) the first
 * time the app loads, then is permanently dismissed via localStorage.
 * Players on tablets and small laptops never see it.
 */
export function SmallScreenGate({ children }: { children: React.ReactNode }) {
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    const KEY = 'intlabs:sim:smallscreen-tip-dismissed';
    const dismissed = (() => {
      try { return window.localStorage.getItem(KEY) === '1'; } catch { return false; }
    })();
    if (dismissed) return;
    const check = () => {
      if (window.innerWidth < 768) setShowTip(true);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const dismiss = () => {
    try { window.localStorage.setItem('intlabs:sim:smallscreen-tip-dismissed', '1'); } catch { /* ignore */ }
    setShowTip(false);
  };

  return (
    <>
      {children}
      {showTip && (
        <div className="fixed inset-x-0 bottom-0 z-[60] p-3 pointer-events-none">
          <div className="pixel-frame bg-cream-50 border-2 border-ink-900 max-w-[420px] mx-auto p-3 shadow-pixel-2 pointer-events-auto">
            <div className="flex items-start gap-2.5">
              <div className="flex-1">
                <div className="font-hud uppercase text-[11px] mb-1 text-ink-900">Compact mode</div>
                <p className="text-[12px] font-body text-ink-800 leading-snug">
                  You're on a small screen. The layout adapts, but some
                  charts read better in landscape or on a tablet/desktop.
                </p>
              </div>
              <button
                onClick={dismiss}
                className="shrink-0 border-2 border-ink-900 bg-cream-100 hover:bg-cream-200 font-hud uppercase text-[10px] px-2 py-1 cursor-pointer"
                aria-label="Dismiss"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
