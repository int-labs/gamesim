import { useState } from 'react';
import { useGame, DEFAULT_SHOP_NAME, MAX_SHOP_NAME } from '@/state/store';
import { setShopName } from '@/engine/mockEngine';
import { A } from '@/assets';
import { PixelButton, PixelBadge } from '@/components/primitives';
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
import { useGamesimSession } from '@/gamesim/GamesimProvider';
import type { GlobalInputDto } from '@/gamesim/types';

export function RouteChoiceScreen() {
  const [hover, setHover] = useState<string | null>(null);
  const setRoute = useGame((s) => s.setRoute);
  const setScreen = useGame((s) => s.setScreen);
  const apply = useGame((s) => s.apply);
  const pushMascotSequence = useGame((s) => s.pushMascotSequence);
  const { bootstrap } = useGamesimSession();

  const difficultyContainer: GlobalInputDto | undefined = bootstrap?.globalInputs.find(
    (g) => g.category === 'difficulty',
  );

  // Founding the shop: the name is a local draft until a route is chosen, so
  // the player can type freely and only commit once. Empty falls back to the
  // default (setShopName enforces this too).
  const [shopDraft, setShopDraft] = useState('');

  const choose = (r: string) => {
    playSfx('coin');
    apply((s) => setShopName(s, shopDraft));
    setRoute(r as Route);
    setScreen('phase_intro');
    pushMascotSequence(
      expandScript(r === 'investor' ? SCRIPT_AFTER_ROUTE_INVESTOR : SCRIPT_AFTER_ROUTE_SELF),
    );
  };

  return (
    <div className="absolute inset-0 flex flex-col">
      <img src={A.env.deskFull} alt="" className="absolute inset-0 w-full h-full object-cover opacity-95" draggable={false} />
      <div className="absolute inset-0 bg-ink-900/35" />
      <div className="relative z-10 flex-1 flex items-center justify-center p-6">
        {/* Hero heading → studio name → the two routes → Amelia's nudge.
            The choice is the point, so it gets the centre of the screen and
            everything above it stays light. */}
        <div className="w-full max-w-[1024px] flex flex-col items-center gap-6">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          >
            <div className="eyebrow eyebrow-md eyebrow-light">{ROUTE.eyebrow}</div>
            <h1 className="h2 uppercase text-cream-50 mt-1">{ROUTE.title}</h1>
            <p className="body-sm text-cream-100 mt-2 max-w-[62ch] mx-auto">{ROUTE.subtitle}</p>
          </motion.div>

          {/* Compact and centred: naming the studio is a nice touch, not the
              decision, so it shouldn't outweigh the cards below it. */}
          <motion.div
            className="flex flex-col items-center gap-1.5"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, type: 'spring', stiffness: 260, damping: 22 }}
          >
            <label htmlFor="shop-name" className="eyebrow eyebrow-sm eyebrow-light">
              {ROUTE.shop.title}
            </label>
            <input
              id="shop-name"
              value={shopDraft}
              onChange={(e) => setShopDraft(e.target.value)}
              maxLength={MAX_SHOP_NAME}
              placeholder={DEFAULT_SHOP_NAME}
              title={ROUTE.shop.hint}
              className="w-[320px] max-w-full bg-cream-50 border-2 border-ink-900 shadow-pixel-2 text-text section-title text-center outline-none focus:border-primary px-3 py-2.5"
            />
          </motion.div>

          <div className="w-full grid md:grid-cols-2 gap-5">
            {difficultyContainer ? (
              difficultyContainer.inputs.map((item, i) => (
                <DifficultyCard
                  key={item.key}
                  item={item}
                  index={i}
                  hovered={hover === item.key}
                  onHover={() => setHover(item.key)}
                  onLeave={() => setHover(null)}
                  onChoose={() => choose(item.key)}
                />
              ))
            ) : (
              <>
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
              </>
            )}
          </div>

          <div className="flex justify-center">
            <div className="flex items-center gap-3 bg-cream-50 border border-border-soft px-3 py-2">
              <MascotAvatar mood="thinking_side" size={60} />
              <div className="body-xs font-body">{ROUTE.footer}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Backend-driven difficulty card — mirrors RouteCard's layout using GlobalInputItemDto fields. */
function DifficultyCard({
  item,
  index,
  hovered,
  onHover,
  onLeave,
  onChoose,
}: {
  item: GlobalInputDto['inputs'][number];
  index: number;
  hovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onChoose: () => void;
}) {
  const impacts = Object.entries(item.impacts ?? {}).map(([key, v]) => {
    const sign = v.value >= 0 ? '+' : '';
    const val = v.type === 'relative' ? `${sign}${(v.value * 100).toFixed(0)}%` : `${sign}${v.value}`;
    return `${key}: ${val}`;
  });

  // Alternate the tilt direction per card, matching RouteCard's hover feel.
  const tilt = index % 2 === 0 ? -0.6 : 0.6;

  return (
    <motion.div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={clsx('panel bg-surface text-left p-5', hovered && 'relative z-10')}
      initial={{ opacity: 0, y: 26, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ y: -6, rotate: tilt, transition: { type: 'spring', stiffness: 260, damping: 18 } }}
      transition={{ type: 'spring', stiffness: 220, damping: 20, delay: index * 0.13 }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="h2 uppercase text-ink-900">{item.label}</div>
        {item.impactLevel && (
          <PixelBadge tone="neutral">{item.impactLevel}</PixelBadge>
        )}
      </div>
      {item.description && (
        <div className="body-xs text-text-2 mb-3">{item.description}</div>
      )}
      {impacts.length > 0 && (
        <div className="bg-surface-2 border border-border-soft p-2.5 mb-2.5">
          <div className="stat-label mb-1">Effects</div>
          <ul className="flex flex-col gap-0.5">
            {impacts.map((imp) => (
              <li key={imp} className="body-xs text-text">{imp}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3 flex justify-end">
        <PixelButton variant="primary" size="md" onClick={onChoose}>
          Choose {item.label}
        </PixelButton>
      </div>
    </motion.div>
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
      className={clsx('panel bg-surface text-left p-5', hovered && 'relative z-10')}
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
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="h2 uppercase text-ink-900">{title}</div>
        <PixelBadge tone={route === 'self' ? 'success' : 'brand'}>${startingCash.toLocaleString('en-US')}</PixelBadge>
      </div>
      <div className="body-xs text-text-2 mb-3">{tagline}</div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-surface-2 border border-border-soft p-2.5">
          <div className="stat-label">Perks</div>
          <div className="body-xs text-text mt-1">{perks}</div>
        </div>
        <div className="bg-warning-soft border-2 border-warning p-2.5">
          <div className="stat-label">Risks</div>
          <div className="body-xs text-text mt-1">{risks}</div>
        </div>
      </div>
      <div className="mt-2.5 body-xs text-text-2 italic">{summary}</div>
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
