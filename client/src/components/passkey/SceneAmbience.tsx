import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * SceneAmbience — a field of warm PIXEL fireflies that drift, flicker, and
 * SCATTER from the cursor like the real thing. Square + yellow to read as
 * pixel art.
 *
 * Two nested elements per fly so two transforms never fight:
 *   • outer div  → cursor-flee offset, driven by a tiny physics sim
 *   • inner motion.div → idle drift + opacity flicker (Framer)
 *
 * The flee is a velocity/spring simulation (NOT a CSS transition, which snapped
 * and lagged): each frame the cursor pushes nearby flies (sharp quadratic
 * falloff, per-fly reactivity), a spring pulls each back toward its home spot,
 * and friction damps the motion. Result: they dart off with momentum, hover
 * just out of reach, then ease back home — organic, never mechanical.
 *
 * The rAF loop only runs while the cursor is in play or flies are still
 * settling, so it idles at zero cost. Disabled under reduced motion. Layout
 * derives from the index (no RNG).
 */
const COUNT = 80;
const FLEE_RADIUS = 130; // px — how close the cursor must get to spook a fly
const PUSH = 0.62; // flee acceleration strength
const SPRING = 0.013; // pull back toward home (smaller = slower drift back)
const DAMP = 0.82; // friction (higher = more glide/float)
const MAX_OFF = 100; // px — cap so a fly never bolts absurdly far

const FLIES = Array.from({ length: COUNT }, (_, i) => ({
  // Golden-ratio spread → even, non-griddy coverage of the whole scene.
  left: (i * 61.803) % 100,
  top: ((i * 38.197 + (i % 5) * 6) % 94) + 3,
  size: 3 + (i % 6), // 3–8px
  delay: (i % 14) * 0.34,
  duration: 5 + (i % 8), // 5–12s
  dx: (i % 2 === 0 ? 1 : -1) * (14 + (i % 6) * 7),
  dy: -(14 + (i % 7) * 7),
  react: 2 + (i % 3), // 2–4: some flies are jumpier than others
  bright: i % 3 === 0, // a third glow stronger for depth
}));

export function SceneAmbience() {
  const reduced = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const nodes = Array.from(wrap.children) as HTMLElement[];
    const n = nodes.length;
    const ox = new Float32Array(n);
    const oy = new Float32Array(n);
    const vx = new Float32Array(n);
    const vy = new Float32Array(n);

    let vw = window.innerWidth;
    let vh = window.innerHeight;
    let mx = -9999;
    let my = -9999;
    let raf = 0;
    let running = false;

    const onResize = () => {
      vw = window.innerWidth;
      vh = window.innerHeight;
    };

    const tick = () => {
      let active = false;
      for (let i = 0; i < n; i++) {
        const f = FLIES[i];
        const homeX = (f.left / 100) * vw;
        const homeY = (f.top / 100) * vh;
        // current (displaced) position drives the flee, so as a fly escapes the
        // push naturally fades — self-limiting, like a real escape.
        const curX = homeX + ox[i];
        const curY = homeY + oy[i];

        // spring back toward home
        let ax = -ox[i] * SPRING;
        let ay = -oy[i] * SPRING;

        // flee from cursor (quadratic falloff → only the close ones bolt)
        const ddx = curX - mx;
        const ddy = curY - my;
        const dist = Math.hypot(ddx, ddy);
        if (dist < FLEE_RADIUS && dist > 0.01) {
          const t = 1 - dist / FLEE_RADIUS;
          const force = t * t * PUSH * f.react;
          ax += (ddx / dist) * force;
          ay += (ddy / dist) * force;
        }

        vx[i] = (vx[i] + ax) * DAMP;
        vy[i] = (vy[i] + ay) * DAMP;
        ox[i] += vx[i];
        oy[i] += vy[i];
        if (ox[i] > MAX_OFF) ox[i] = MAX_OFF;
        else if (ox[i] < -MAX_OFF) ox[i] = -MAX_OFF;
        if (oy[i] > MAX_OFF) oy[i] = MAX_OFF;
        else if (oy[i] < -MAX_OFF) oy[i] = -MAX_OFF;

        nodes[i].style.transform = `translate3d(${ox[i].toFixed(2)}px, ${oy[i].toFixed(2)}px, 0)`;

        if (Math.abs(ox[i]) > 0.1 || Math.abs(oy[i]) > 0.1 || Math.abs(vx[i]) > 0.04 || Math.abs(vy[i]) > 0.04) {
          active = true;
        }
      }
      // keep simulating while anything is still displaced/moving; pointermove
      // re-arms the loop, so it idles for free over empty areas of the scene.
      if (active) {
        raf = requestAnimationFrame(tick);
      } else {
        running = false;
        raf = 0;
      }
    };

    const start = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };
    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      start();
    };
    const onLeave = () => {
      // cursor left the window — let the springs ease everyone home
      mx = -9999;
      my = -9999;
      start();
    };

    window.addEventListener('pointermove', onMove);
    document.addEventListener('mouseleave', onLeave);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('resize', onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced]);

  if (reduced) return null;

  return (
    <div ref={wrapRef} aria-hidden className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
      {FLIES.map((f, i) => (
        <div key={i} className="absolute will-change-transform" style={{ left: `${f.left}%`, top: `${f.top}%` }}>
          <motion.div
            style={{
              width: f.size,
              height: f.size,
              backgroundColor: '#FFEFA8',
              boxShadow: f.bright
                ? '0 0 14px 5px rgba(255,214,90,0.9)'
                : '0 0 10px 3px rgba(255,214,90,0.7)',
              imageRendering: 'pixelated',
            }}
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0.25, 1, 0.55, 1, 0.25],
              x: [0, f.dx * 0.5, f.dx, f.dx * 0.6, 0],
              y: [0, f.dy * 0.4, f.dy * 0.7, f.dy, f.dy * 1.1],
            }}
            transition={{ duration: f.duration, delay: f.delay, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      ))}
    </div>
  );
}
