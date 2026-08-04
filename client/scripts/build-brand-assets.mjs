/**
 * Turn the raw brand files in /assets into web-ready ones under public/brand/.
 *
 * The sources are print-scale: a 16 MB 3599×3843 PNG photo and 8245×1672 logo
 * PNGs. Shipping those to a login screen would cost more than the rest of the
 * app combined, so each one is resized to the sizes the page can actually use
 * and encoded twice — AVIF for browsers that take it, WebP for the rest — with
 * a tiny blurred placeholder inlined so the panel paints instantly.
 *
 * Re-run after replacing anything in /assets:
 *   node scripts/build-brand-assets.mjs
 */
import { createRequire } from "node:module";
import { mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
// sharp is a transitive dependency of the player app's toolchain; resolving it
// from there keeps it out of this package's dependency list for a build step
// that runs by hand.
const sharp = require(require.resolve("sharp", { paths: [path.resolve("../notebook-pixel-sim")] }));

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "../../assets");
const OUT = path.resolve(HERE, "../public/brand");

const HERO_SRC = "a-team-of-developers-working-with-virtual-reality-2025-01-09-12-28-31-utc (4).png";

/** Widths the login panel can actually request, incl. 2× for retina. */
const HERO_WIDTHS = [640, 960, 1280, 1800];

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

async function emit(pipeline, name, encode) {
  const buf = await encode(pipeline).toBuffer();
  await writeFile(path.join(OUT, name), buf);
  return { name, size: buf.length };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const rows = [];

  // ── Hero photo ────────────────────────────────────────────────────────
  const heroPath = path.join(SRC, HERO_SRC);
  const meta = await sharp(heroPath).metadata();
  console.log(`hero source: ${meta.width}×${meta.height}, ${kb((await stat(heroPath)).size)}\n`);

  for (const w of HERO_WIDTHS) {
    const base = sharp(heroPath).resize({ width: w, withoutEnlargement: true, kernel: "lanczos3" });
    // effort/cpuEffort are maxed because this runs once, by hand — the only
    // thing that matters at runtime is the byte count.
    rows.push(await emit(base.clone(), `hero-${w}.avif`, (p) => p.avif({ quality: 58, effort: 9 })));
    rows.push(
      await emit(base.clone(), `hero-${w}.webp`, (p) =>
        p.webp({ quality: 78, effort: 6, smartSubsample: true })
      )
    );
  }

  // Blurred placeholder, inlined by the page as a data URI so there is never a
  // blank panel while the real image streams in.
  const lqip = await sharp(heroPath)
    .resize({ width: 24 })
    .blur(1.2)
    .webp({ quality: 40 })
    .toBuffer();
  await writeFile(path.join(OUT, "hero-lqip.txt"), `data:image/webp;base64,${lqip.toString("base64")}`);
  rows.push({ name: "hero-lqip.txt (inlined)", size: lqip.length });

  // ── Logos ─────────────────────────────────────────────────────────────
  // The wordmark is 4.93:1, so 320px covers the ~94px-wide sidebar mark even
  // on a 3× screen; 640 and 1280 are for the login header and any large use.
  //
  // Encoding differs by artwork: the two flat one-colour marks are lossless
  // (tiny, and lossless keeps the letter edges exact), while the gradient one
  // is lossy — a smooth ramp is precisely what lossless handles worst.
  for (const [src, out, lossless] of [
    ["logo1.png", "logo-color", false],
    ["logo1_white.png", "logo-white", true],
    ["logo1_black.png", "logo-black", true],
  ]) {
    for (const w of [320, 640, 1280]) {
      const p = sharp(path.join(SRC, src)).resize({ width: w, kernel: "lanczos3" });
      rows.push(
        await emit(p, `${out}-${w}.webp`, (q) =>
          lossless
            ? q.webp({ lossless: true, effort: 6 })
            : q.webp({ quality: 92, alphaQuality: 100, effort: 6 })
        )
      );
    }
  }

  // ── Report ────────────────────────────────────────────────────────────
  const total = rows.reduce((a, r) => a + r.size, 0);
  console.log("written to public/brand/:");
  for (const r of rows.sort((a, b) => b.size - a.size)) {
    console.log(`  ${r.name.padEnd(28)} ${kb(r.size).padStart(10)}`);
  }
  console.log(`\n  ${String(rows.length).padStart(2)} files, ${kb(total)} total`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
