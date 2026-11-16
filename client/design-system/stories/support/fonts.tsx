import { useEffect, useState, type ReactNode } from "react";

/**
 * Renders its children once the web fonts are in. A popup open from the start is placed when it
 * mounts, and text that reflows as a font arrives would leave it a few pixels off its anchor.
 */
export function WhenFontsReady({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void document.fonts.ready.then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  return ready ? children : null;
}
