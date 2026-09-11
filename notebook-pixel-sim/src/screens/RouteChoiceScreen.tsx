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
      <div className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[560px] flex flex-col items-center gap-6">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          >
            <div className="eyebrow eyebrow-md eyebrow-light">{ROUTE.eyebrow}</div>
            <h1 className="h2 uppercase text-cream-50 mt-1">{ROUTE.shop.title}</h1>
            <p className="body-sm text-cream-100 mt-2 max-w-[52ch] mx-auto">{ROUTE.shop.hint}</p>
          </motion.div>

          <motion.div
            className="w-full flex flex-col items-center gap-4"
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
              placeholder={DEFAULT_SHOP_NAME}
              autoFocus
              className="w-[320px] max-w-full bg-cream-50 border-2 border-ink-900 shadow-pixel-2 text-text section-title text-center outline-none focus:border-primary px-3 py-2.5"
            />
            <PixelButton variant="primary" size="md" onClick={begin}>
              {ROUTE.cta}
            </PixelButton>
          </motion.div>

          <div className="flex items-center gap-3 bg-cream-50 border border-border-soft px-3 py-2">
            <MascotAvatar mood="thinking_side" size={60} />
            <div className="body-xs font-body">{ROUTE.footer}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
