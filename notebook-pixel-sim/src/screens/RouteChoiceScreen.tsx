import { useState } from 'react';
import { useGame, DEFAULT_SHOP_NAME, MAX_SHOP_NAME } from '@/state/store';
import { setShopName } from '@/engine/mockEngine';
import { A } from '@/assets';
import { PixelButton } from '@/components/primitives';
import { MascotAvatar } from '@/components/mascot/MascotAvatar';
import { motion } from 'framer-motion';
import { ROUTE } from '@/content/copy';
import { expandScript, SCRIPT_AFTER_NAMING } from '@/content/mascotScripts';
import { playSfx } from '@/audio/audioManager';

/**
 * Founding the shop — the ONLY thing this screen asks.
 *
 * It used to also carry the funding-route choice (self-funded vs
 * investor-backed), which set starting cash and a debt obligation. That taught
 * nothing the rest of the game builds on, so the mechanic is gone: opening cash
 * is now one operator-configured figure, seeded in `startingState`.
 */
export function RouteChoiceScreen() {
  const setScreen = useGame((s) => s.setScreen);
  const apply = useGame((s) => s.apply);
  const pushMascotSequence = useGame((s) => s.pushMascotSequence);

  // A local draft until the player commits, so they can type freely. Empty
  // falls back to the default (setShopName enforces this too).
  const [shopDraft, setShopDraft] = useState('');

  const begin = () => {
    playSfx('coin');
    apply((s) => setShopName(s, shopDraft));
    setScreen('phase_intro');
    pushMascotSequence(expandScript(SCRIPT_AFTER_NAMING));
  };

  return (
    <div className="absolute inset-0 flex flex-col">
      <img src={A.env.deskFull} alt="" className="absolute inset-0 w-full h-full object-cover opacity-95" draggable={false} />
      <div className="absolute inset-0 bg-ink-900/35" />
      {/* ONE FRAMED CARD, like the Start screen before it. These two screens run
          back to back and used to disagree about whether content sits on a card
          at all, so the second one read as a different app. */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6">
        <motion.div
          className="pixel-frame bg-cream-50 w-full max-w-[640px] text-center"
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="px-6 pt-6 pb-2">
            <motion.h1
              className="h1 uppercase text-ink-900 leading-tight"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            >
              {ROUTE.shop.title}
            </motion.h1>
            <p className="font-body body-xs text-ink-800 mt-3 max-w-[560px] mx-auto leading-relaxed">
              {ROUTE.shop.hint}
            </p>

            <motion.div
              className="w-full flex flex-col items-center gap-4 mt-5"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, type: 'spring', stiffness: 260, damping: 22 }}
            >
              <input
                id="shop-name"
                aria-label={ROUTE.shop.title}
                value={shopDraft}
                onChange={(e) => setShopDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') begin(); }}
                maxLength={MAX_SHOP_NAME}
                // A PLACEHOLDER, never a prefilled value — `setShopName` already
                // falls back to this string on an empty draft, so prefilling it
                // would only mean the player has to clear it to type.
                placeholder={DEFAULT_SHOP_NAME}
                autoFocus
                className="w-[320px] max-w-full bg-cream-50 border-2 border-ink-900 shadow-pixel-2 text-text section-title text-center outline-none focus:border-primary px-3 py-2.5 placeholder:text-text-3"
              />
            </motion.div>
          </div>

          {/* The footer matches the Start screen's: avatar, speech bubble,
              primary CTA, on the same cream-200 shelf. */}
          <div className="border-t border-border-soft bg-cream-200 p-4 mt-4 flex flex-col gap-3 items-center">
            <div className="flex w-full max-w-[470px] items-center gap-3">
              <MascotAvatar mood="thinking_side" size={76} />
              <div className="relative flex-1 text-left">
                <span
                  aria-hidden
                  className="absolute -left-[7px] top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-b-2 border-l-2 border-ink-900 bg-cream-50"
                />
                <div className="rounded-lg border border-border-soft bg-cream-50 px-3 py-2">
                  <div className="eyebrow eyebrow-sm text-brand-500">Amelia</div>
                  <div className="mt-0.5 font-body hint leading-snug text-ink-900">
                    {ROUTE.footer}
                  </div>
                </div>
              </div>
            </div>
            <PixelButton variant="primary" size="lg" onClick={begin}>
              {ROUTE.cta}
            </PixelButton>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
