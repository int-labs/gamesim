import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { A } from '@/assets';
import { playSfx } from '@/audio/audioManager';

/**
 * HeartRain — the "pat Amelia" love-bomb easter egg (canvas particle system).
 *
 * Fire it with `patHeartRain` / `triggerHeartRain` (or the raw
 * `intlabs:heart-rain` event) and a LOVE BOMB detonates on Amelia: a bright
 * flash, then dozens of hearts blast outward in every direction at once - the
 * "wholesome hearts" meme's sudden surprise - before drag slows them and they
 * bob and float up, swaying, spinning, beating, twinkling with sparkles, and
 * fading out.
 *
 * The sprites are the real multi-color pixel hearts the user provided
 * (`assets/img/lovebomb/love-{red,yellow,pink,blue}.png` + `sparkle-1.png`),
 * each baked once with a matching soft glow. Mounted ONCE, fixed,
 * pointer-events-none, top z-index, so it plays over the passkey screen AND the
 * game. Reduced-motion gets a gentle, spin-free version with no shockwave.
 *
 * Pure decoration - Math.random never touches the sim (matches PixelBurst).
 */

interface Origin { x: number; y: number; h?: number }
interface RainDetail { count?: number; origin?: Origin }
type Sprite = HTMLCanvasElement;

// The provided sprites + the glow colour baked behind each.
const HEART_SRC: Array<{ src: string; glow: string }> = [
  { src: A.ui.lovebomb.red, glow: '#FF4D5E' },
  { src: A.ui.lovebomb.pink, glow: '#FF2E9A' },
  { src: A.ui.lovebomb.yellow, glow: '#FFC24B' },
  { src: A.ui.lovebomb.blue, glow: '#7C7CF0' },
];

interface P {
  kind: 'heart' | 'star' | 'ring' | 'flash';
  x: number; y: number; vx: number; vy: number;
  sprite: number; z: number; size: number; rise: number;
  rot: number; rotV: number;
  swayA: number; swayF: number; swayP: number;
  beatF: number; beatP: number;
  t: number; life: number; spawn: number;
  r: number; rv: number; twF: number; twP: number;
}

export function HeartRain({ className = 'pointer-events-none fixed inset-0 z-[10000]' }: { className?: string } = {}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const rm = !!reduced;

    let W = 0, H = 0, raf = 0, running = true, ready = false;
    let parts: P[] = [];
    let hearts: Sprite[] = [];
    let star: Sprite | null = null;

    const rnd = (a: number, b: number) => a + Math.random() * (b - a);

    function resize() {
      const DPR = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      cv!.width = W * DPR; cv!.height = H * DPR;
      cv!.style.width = W + 'px'; cv!.style.height = H + 'px';
      ctx!.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    // ── Sprites: the provided hearts + sparkle, each with a baked glow ───────
    function bake(image: HTMLImageElement, glow: string, baseSize: number, blur: number): Sprite {
      const s = baseSize / Math.max(image.naturalWidth, image.naturalHeight);
      const iw = Math.max(1, Math.round(image.naturalWidth * s));
      const ih = Math.max(1, Math.round(image.naturalHeight * s));
      const pad = Math.round(baseSize * 0.5);
      const f = document.createElement('canvas');
      f.width = iw + pad * 2; f.height = ih + pad * 2;
      const fc = f.getContext('2d')!;
      fc.imageSmoothingEnabled = false;
      fc.shadowColor = glow; fc.shadowBlur = blur;
      fc.drawImage(image, pad, pad, iw, ih);
      fc.drawImage(image, pad, pad, iw, ih);
      fc.shadowBlur = 0;
      fc.drawImage(image, pad, pad, iw, ih);
      return f;
    }

    let loaded = 0;
    const need = HEART_SRC.length + 1;
    const heartImgs: HTMLImageElement[] = [];
    function onEach() {
      loaded++;
      if (loaded < need) return;
      hearts = heartImgs.map((im, k) => bake(im, HEART_SRC[k].glow, 88, 88 * 0.3));
      ready = true;
    }
    HEART_SRC.forEach((h, k) => {
      const im = new Image();
      heartImgs[k] = im;
      im.onload = onEach; im.onerror = onEach;
      im.src = h.src;
      if (im.complete) onEach();
    });
    const starImg = new Image();
    starImg.onload = () => { star = bake(starImg, '#FFE9A8', 48, 11); onEach(); };
    starImg.onerror = onEach;
    starImg.src = A.ui.lovebomb.sparkle;
    if (starImg.complete && starImg.naturalWidth) { star = bake(starImg, '#FFE9A8', 48, 11); onEach(); }

    // ── Particle factories ──────────────────────────────────────────────────
    function heart(x: number, y: number, o: { szMin: number; szMax: number; spdMin: number; spdMax: number; sc: number }) {
      const ang = rnd(0, Math.PI * 2);          // radial explosion - hearts fly EVERYWHERE
      const spd = rnd(o.spdMin, o.spdMax);
      const fall = Math.random() < 0.16;         // a few sink; most rise after the blast
      parts.push({
        kind: 'heart', x, y,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        sprite: (Math.random() * hearts.length) | 0, z: Math.random(),
        size: rnd(o.szMin, o.szMax), rise: (fall ? -rnd(8, 22) : rnd(24, 64)) * o.sc,
        rot: rnd(-.6, .6), rotV: rm ? 0 : rnd(-2.6, 2.6),
        swayA: rnd(10, 40) * o.sc, swayF: rnd(.7, 1.8), swayP: rnd(0, 7),
        beatF: rnd(2.6, 4.4), beatP: rnd(0, 7),
        t: 0, life: rnd(2.0, 3.7), spawn: 0, r: 0, rv: 0, twF: 0, twP: 0,
      });
    }
    function sparkle(x: number, y: number, spread: number, S: number) {
      const ang = rnd(0, Math.PI * 2), spd = rnd(180, 640) * Math.sqrt(S);
      parts.push({
        kind: 'star', x: x + rnd(-spread * .3, spread * .3), y: y + rnd(-spread * .3, spread * .3),
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, sprite: 0, z: .9,
        size: rnd(10, 26) * S, rise: rnd(-6, 14) * S, rot: rnd(0, 7), rotV: rnd(-3, 3),
        swayA: 0, swayF: 0, swayP: 0, beatF: 0, beatP: 0,
        t: 0, life: rnd(.7, 1.5), spawn: 0, r: 0, rv: 0, twF: rnd(5, 9), twP: rnd(0, 7),
      });
    }
    function ring(x: number, y: number, kind: 'ring' | 'flash', rv: number, life: number) {
      parts.push({
        kind, x, y, vx: 0, vy: 0, sprite: 0, z: 0, size: 0, rise: 0,
        rot: 0, rotV: 0, swayA: 0, swayF: 0, swayP: 0, beatF: 0, beatP: 0,
        t: 0, life, spawn: 0, r: 6, rv, twF: 0, twP: 0,
      });
    }

    const CAP = rm ? 110 : 300;
    // Strong initial drag so the blast shoots out hard then settles into a float.
    const DAMP = 5.0;

    function bomb(count: number, origin?: Origin) {
      if (!ready) { if (loaded >= need) { hearts = heartImgs.map((im, k) => bake(im, HEART_SRC[k].glow, 88, 88 * 0.3)); ready = true; } if (!ready) return; }
      const o = origin ?? { x: W / 2, y: H * 0.42 };
      // Scale the whole blast to the mascot's on-screen height: a big close-up
      // mascot (VN portrait, phase-intro hero) gets big, WOW-sized hearts and a
      // wider, harder burst; the small roaming greeter stays subtle.
      const S = Math.max(0.9, Math.min(2.6, (o.h ?? 340) / 340));
      const spd = Math.sqrt(S);
      const spread = Math.min(80, 24 + count * 0.4) * S;
      const opt = { szMin: (rm ? 16 : 22) * S, szMax: (rm ? 34 : 62) * S, spdMin: (rm ? 150 : 420) * spd, spdMax: (rm ? 300 : 1080) * spd, sc: S };
      const n = rm ? Math.min(count, 18) : Math.round(count * Math.min(1.7, S));
      if (!rm) { ring(o.x, o.y, 'flash', 1200 * S, 0.26); ring(o.x, o.y, 'ring', 1000 * S, 0.42); }
      else { ring(o.x, o.y, 'ring', 560, 0.5); }
      // THE BOMB: detonate everything at once - no slow trickle.
      for (let i = 0; i < n; i++) {
        heart(o.x + rnd(-spread, spread), o.y + rnd(-spread, spread), opt);
        if (!rm && Math.random() < .45) sparkle(o.x, o.y, spread, S);
      }
      if (parts.length > CAP) parts.splice(0, parts.length - CAP);
    }

    function onRain(e: Event) {
      const d = (e as CustomEvent).detail as RainDetail | undefined;
      const count = Math.round(d?.count ?? 45);
      bomb(rm ? Math.min(20, count) : Math.min(130, Math.max(18, count)), d?.origin);
    }
    window.addEventListener('intlabs:heart-rain', onRain);

    const backOut = (t: number) => { const c1 = 2.2, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

    // ── Render loop ─────────────────────────────────────────────────────────
    let prev = performance.now();
    function frame(now: number) {
      if (!running) return;
      const dt = Math.min(.05, (now - prev) / 1000); prev = now;
      ctx!.clearRect(0, 0, W, H);
      if (ready && parts.length) {
        const damp = Math.exp(-DAMP * dt);
        ctx!.globalCompositeOperation = 'lighter';
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i]; p.t += dt;
          const k = p.t / p.life;
          if (k >= 1) { parts.splice(i, 1); continue; }

          if (p.kind === 'flash') {
            p.r += p.rv * dt;
            ctx!.globalCompositeOperation = 'lighter';
            const g = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
            const a = (1 - k) * 0.5;
            g.addColorStop(0, `rgba(255,220,235,${a})`);
            g.addColorStop(0.5, `rgba(255,90,160,${a * 0.5})`);
            g.addColorStop(1, 'rgba(255,90,160,0)');
            ctx!.fillStyle = g; ctx!.beginPath(); ctx!.arc(p.x, p.y, p.r, 0, 7); ctx!.fill();
            continue;
          }
          if (p.kind === 'ring') {
            p.r += p.rv * dt;
            ctx!.globalCompositeOperation = 'screen';
            ctx!.strokeStyle = '#FF6FB5'; ctx!.globalAlpha = (1 - k) * .55; ctx!.lineWidth = 4 * (1 - k) + 1;
            ctx!.beginPath(); ctx!.arc(p.x, p.y, p.r, 0, 7); ctx!.stroke();
            ctx!.globalCompositeOperation = 'lighter';
            continue;
          }

          p.spawn = Math.min(1, p.spawn + dt * 12);
          p.vx *= damp; p.vy *= damp;
          p.x += p.vx * dt; p.y += p.vy * dt - p.rise * dt;
          p.rot += p.rotV * dt;
          const dx = p.x + Math.sin(p.t * p.swayF + p.swayP) * p.swayA;
          let alpha = k < .08 ? k / .08 : (k > .74 ? (1 - k) / .26 : 1);
          alpha *= (.5 + p.z * .5);

          if (p.kind === 'star') {
            if (!star) continue;
            const tw = .5 + .5 * Math.sin(p.t * p.twF + p.twP);
            ctx!.globalAlpha = alpha * tw;
            const s = p.size * (.7 + tw * .6);
            const ar = star.height / star.width;
            ctx!.save(); ctx!.translate(dx, p.y); ctx!.rotate(p.rot);
            ctx!.drawImage(star, -s / 2, -s * ar / 2, s, s * ar); ctx!.restore();
            continue;
          }
          const sp = hearts[p.sprite % hearts.length];
          if (!sp) continue;
          const ease = p.spawn < 1 ? backOut(p.spawn) : 1;
          const beat = 1 + Math.sin(p.t * p.beatF + p.beatP) * (rm ? .03 : .12);
          const s = p.size * ease * beat * (.6 + p.z * .7);
          const ar = sp.height / sp.width;
          ctx!.globalAlpha = alpha; ctx!.imageSmoothingEnabled = false;
          ctx!.save(); ctx!.translate(dx, p.y); ctx!.rotate(p.rot);
          ctx!.drawImage(sp, -s / 2, -s * ar / 2, s, s * ar); ctx!.restore();
        }
        ctx!.globalAlpha = 1; ctx!.globalCompositeOperation = 'source-over';
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('intlabs:heart-rain', onRain);
      parts = [];
    };
  }, [reduced]);

  return <canvas ref={ref} aria-hidden className={className} />;
}

/** Fire a love bomb from anywhere. `intensity` ~ how many hearts; `origin` = viewport point to detonate on. */
export function triggerHeartRain(intensity = 45, origin?: Origin): void {
  window.dispatchEvent(new CustomEvent('intlabs:heart-rain', { detail: { count: intensity, origin } }));
}

/**
 * Call on each mascot pat with the running pat count. Every 3rd pat (from the
 * 3rd) detonates a love bomb - a little bigger each time - on `origin` (the
 * mascot), plus a happy chime.
 */
export function patHeartRain(count: number, origin?: Origin): void {
  if (count >= 3 && count % 3 === 0) {
    triggerHeartRain(Math.min(90, 42 + count * 4), origin);
    playSfx('chime');
  }
}

/** Viewport point to detonate the love bomb on - the mascot element's upper-center. */
export function originOf(el: HTMLElement | null): Origin | undefined {
  if (!el) return undefined;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height * 0.42, h: r.height };
}
