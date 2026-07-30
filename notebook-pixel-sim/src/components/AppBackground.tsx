import { A } from '@/assets';

/**
 * App-wide back layer — the dim notebook studio scene visible behind
 * the cream panels. Provides game-scene depth: panels float on a
 * warm-wood environment rather than a flat color.
 *
 * Treatment:
 *   1. Shelf isometric scene as base (slightly desaturated, lightly
 *      blurred so detail doesn't fight foreground UI)
 *   2. Dark walnut overlay at ~70% so the scene reads as ambient
 *      context, not a competing layer
 *   3. Subtle radial vignette darkening the corners — focuses the eye
 *      on the play area in the center
 */
export function AppBackground() {
  return (
    <div className="absolute inset-0 -z-0 pointer-events-none overflow-hidden">
      <img
        src={A.env.shelf}
        alt=""
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: 'blur(1.5px) saturate(0.8) brightness(0.65)', opacity: 0.85 }}
      />
      {/* Walnut tint — keeps the scene quiet and warm. The page bg
          token (deep walnut) shows through where the image is darker. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(58,40,24,0.55) 0%, rgba(58,40,24,0.40) 50%, rgba(58,40,24,0.65) 100%)',
        }}
      />
      {/* Radial vignette — focuses attention on the play area. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 35%, rgba(28,18,10,0.55) 100%)',
        }}
      />
    </div>
  );
}
