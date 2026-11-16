import { tokens } from "../tokens";

/**
 * A small confetti burst around an element: the success moment of a solid button (Figma
 * btnPublish "sucess1": orange, red and violet 8 x 4 rectangles). The confetti library loads only
 * when a burst happens, draws on a canvas above everything that never takes the pointer, and
 * shows nothing when motion is reduced.
 */
export async function burstFrom(element: HTMLElement): Promise<void> {
  if (typeof window === "undefined" || document.documentElement.dataset.motion === "reduced") return;
  const { default: confetti } = await import("canvas-confetti");
  const box = element.getBoundingClientRect();
  await confetti({
    particleCount: 28,
    spread: 360,
    startVelocity: 14,
    gravity: 0.7,
    decay: 0.88,
    ticks: 80,
    scalar: 0.6,
    shapes: ["square"],
    colors: [tokens.palette.confetti.orange, tokens.palette.confetti.red, tokens.palette.confetti.violet],
    origin: {
      x: (box.left + box.width / 2) / window.innerWidth,
      y: (box.top + box.height / 2) / window.innerHeight,
    },
    zIndex: tokens.layer.celebration,
    disableForReducedMotion: true,
  });
}
