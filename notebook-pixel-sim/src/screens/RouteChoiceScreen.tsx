import { useState } from 'react';
import { useGame, DEFAULT_SHOP_NAME, MAX_SHOP_NAME } from '@/state/store';
import { setShopName } from '@/engine/mockEngine';
import { A } from '@/assets';
import { PixelButton, PixelBadge, PixelPanel } from '@/components/primitives';
import { MascotAvatar } from '@/components/mascot/MascotAvatar';
import type { Route } from '@/types';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { ROUTE } from '@/content/copy';
import {
  expandScript,
  SCRIPT_AFTER_ROUTE_SELF,
  SCRIPT_AFTER_ROUTE_INVESTOR,
} from '@/content/mascotScripts';
import { playSfx } from '@/audio/audioManager';

export function RouteChoiceScreen() {
  const [hover, setHover] = useState<Route | null>(null);
  const setRoute = useGame((s) => s.setRoute);
  const setScreen = useGame((s) => s.setScreen);
  const apply = useGame((s) => s.apply);
  const pushMascotSequence = useGame((s) => s.pushMascotSequence);

  // Founding the shop: the name is a local draft until a route is chosen, so
  // the player can type freely and only commit once. Empty falls back to the
  // default (setShopName enforces this too).
  const [shopDraft, setShopDraft] = useState('');

  const choose = (r: Route) => {
    playSfx('coin');
    apply((s) => setShopName(s, shopDraft));
    setRoute(r);
    setScreen('phase_intro');
    pushMascotSequence(
      expandScript(r === 'self' ? SCRIPT_AFTER_ROUTE_SELF : SCRIPT_AFTER_ROUTE_INVESTOR),
    );
  };

  return (
    <div className="absolute inset-0 flex flex-col">
      <img src={A.env.deskFull} alt="" className="absolute inset-0 w-full h-full object-cover opacity-95" draggable={false} />
      <div className="absolute inset-0 bg-ink-900/35" />
      <div className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[1024px]">
          {/* ── Step 1 — name the shop. The founding moment: you name the
               business, then pick how it's funded. Optional; blank = default. ── */}
          <div className="mx-auto mb-5 w-full max-w-[520px]">
            <div className="panel bg-surface p-4 text-center">
              <div className="font-hud text-[11px] uppercase tracking-wider text-text-3">{ROUTE.shop.eyebrow}</div>
              <h2 className="font-hud text-[17px] uppercase text-text mt-1">{ROUTE.shop.title}</h2>
              <input
                value={shopDraft}
                onChange={(e) => setShopDraft(e.target.value)}
                maxLength={MAX_SHOP_NAME}
                aria-label="Shop name"
                placeholder={DEFAULT_SHOP_NAME}
                className="mt-2.5 w-full bg-cream-50 border-2 border-border text-text font-hud text-[15px] uppercase text-center outline-none focus:border-primary px-3 py-2.5"
              />
              <div className="mt-1.5 text-[12px] font-medium text-text-3">{ROUTE.shop.hint}</div>
            </div>
          </div>

          <div className="text-center mb-6">
            <div className="font-hud text-[12px] uppercase text-cream-100 tracking-wider">{ROUTE.eyebrow}</div>
            <h2 className="font-hud text-[22px] uppercase text-cream-50">{ROUTE.title}</h2>
            <p className="font-body text-[14px] text-cream-100 mt-1 max-w-[680px] mx-auto">{ROUTE.subtitle}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <RouteCard
              route="self"
              title={ROUTE.self.title}
              tagline={ROUTE.self.tagline}
              startingCash={ROUTE.self.startingCash}
              risks={ROUTE.self.risks}
              perks={ROUTE.self.perks}
              summary={ROUTE.self.summary}
              hovered={hover === 'self'}
              onHover={() => setHover('self')}
              onLeave={() => setHover(null)}
              onChoose={() => choose('self')}
            />
            <RouteCard
              route="investor"
              title={ROUTE.investor.title}
              tagline={ROUTE.investor.tagline}
              startingCash={ROUTE.investor.startingCash}
              risks={ROUTE.investor.risks}
              perks={ROUTE.investor.perks}
              summary={ROUTE.investor.summary}
              hovered={hover === 'investor'}
              onHover={() => setHover('investor')}
              onLeave={() => setHover(null)}
              onChoose={() => choose('investor')}
            />
          </div>

          <div className="flex justify-center mt-4">
            <div className="flex items-center gap-3 bg-cream-50 border-2 border-ink-900 px-3 py-2 shadow-pixel-2">
              <MascotAvatar mood="thinking_side" size={60} />
              <div className="text-[13px] font-body">{ROUTE.footer}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RouteCard({
  route, title, tagline, startingCash, risks, perks, summary, hovered, onHover, onLeave, onChoose,
}: {
  route: Route; title: string; tagline: string; startingCash: number; risks: string; perks: string; summary: string;
  hovered: boolean; onHover: () => void; onLeave: () => void; onChoose: () => void;
}) {
  return (
    <motion.div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={clsx('panel bg-surface text-left p-4', hovered && 'relative z-10')}
      // Cards deal onto the table one after the other, then lift + tilt
      // toward you on hover like you're picking one up.
      initial={{ opacity: 0, y: 26, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{
        y: -6,
        rotate: route === 'self' ? -0.6 : 0.6,
        transition: { type: 'spring', stiffness: 260, damping: 18 },
      }}
      transition={{ type: 'spring', stiffness: 220, damping: 20, delay: route === 'self' ? 0.15 : 0.28 }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="font-hud text-[18px] uppercase">{title}</div>
        <PixelBadge tone={route === 'self' ? 'success' : 'brand'}>${startingCash}</PixelBadge>
      </div>
      <div className="text-[13px] text-text-2 mb-3">{tagline}</div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-surface-2 border border-border-soft p-2">
          <div className="text-[10px] uppercase tracking-wider font-bold text-text-3">Perks</div>
          <div className="text-[12px] text-text">{perks}</div>
        </div>
        <div className="bg-warning-soft border border-warning p-2">
          <div className="text-[10px] uppercase tracking-wider font-bold text-text-3">Risks</div>
          <div className="text-[12px] text-text">{risks}</div>
        </div>
      </div>
      <div className="mt-2 text-[12px] text-text-2 italic">{summary}</div>
      <div className="mt-3 flex justify-end">
        <PixelButton
          variant={route === 'self' ? 'primary' : 'secondary'}
          size="md"
          onClick={onChoose}
        >
          Choose {title}
        </PixelButton>
      </div>
    </motion.div>
  );
}
