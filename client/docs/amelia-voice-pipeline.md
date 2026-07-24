# Amelia Voice Pipeline

Amelia is the in-game mentor mascot. Her dialogue appears in the
visual-novel overlay and (optionally) is spoken aloud by a TTS engine
so the simulation feels alive.

This document explains:

1. The current runtime engine (Web Speech API)
2. How to swap it for **pre-generated** voice files using **Piper** or
   **Coqui TTS** — both free and open-source
3. File layout, naming, and the runtime fallback rules

---

## 1. Why two engines?

The Web Speech API is the prototype path: zero install, zero asset
weight, every browser ships its own voice list. It's perfect for "ship
today" but the voices vary by OS and some sound robotic.

The pre-generated path uses an open-source TTS engine to render every
line offline as an `.mp3` (or `.ogg`) file. The runtime tries the file
first; if missing, it falls back to Web Speech. This gives:

- consistent voice quality across all browsers / devices
- richer prosody than the OS voices typically allow
- offline-friendly (files cached by the SW)
- one chosen "Amelia" voice, not whatever the OS happens to have

You can ship both. The runtime in `src/audio/ameliaVoice.ts` is
abstracted behind `AmeliaVoiceEngine` so the file-playback engine
slots in without touching call sites.

---

## 2. Tooling — pick one

### Option A — Piper (recommended for our use case)

[https://github.com/rhasspy/piper](https://github.com/rhasspy/piper)

- C++ inference, fast (real-time on a laptop CPU)
- Tons of voices in the [piper-voices](https://huggingface.co/rhasspy/piper-voices) collection
- Apache-2.0 license
- WAV output (convert to MP3 with `ffmpeg`)

Recommended Amelia voice candidates (high pitch, clear, English):

| Voice ID | Notes |
|---|---|
| `en_US-amy-medium` | Female, clear, slightly warm — good default |
| `en_US-libritts_r-medium` | High-quality female multi-speaker model — pick speaker `7` for Amelia |
| `en_GB-jenny_dioco-medium` | UK English female, friendly tone |

### Option B — Coqui TTS

[https://github.com/coqui-ai/TTS](https://github.com/coqui-ai/TTS)

- Python framework, great research voices including XTTS v2 (cloning)
- Heavier setup; consider for one-shot offline batch generation
- Mozilla Public License

### Option C — Microsoft TTS Edge / Azure free tier

Higher quality but bound to a service. Not preferred — keep the asset
licensing clean and offline-friendly.

---

## 3. Workflow — Piper recipe

```bash
# 1. Install Piper (Linux / Mac / WSL)
curl -L https://github.com/rhasspy/piper/releases/latest/download/piper_amd64.tar.gz | tar -xz
cd piper

# 2. Download a voice
mkdir -p voices && cd voices
curl -O https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx
curl -O https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json
cd ..

# 3. Render one line (text via stdin → wav file)
echo "Hi, I'm Amelia. Welcome to the academy." \
  | ./piper --model voices/en_US-amy-medium.onnx --output_file /tmp/amelia_intro_0.wav

# 4. Convert to MP3 (smaller, faster cold-start)
ffmpeg -y -i /tmp/amelia_intro_0.wav -codec:a libmp3lame -b:a 96k assets/audio/amelia/intro_first_visit__0.mp3
```

For a batch: write a script that walks the `MascotScript` registry
in `src/content/mascotScripts.ts`, expands every script via
`expandScript`, and renders each `id → text` pair. See
`scripts/generate-amelia-voice.md` for a worked example.

---

## 4. File layout

```
assets/                          # Vite's publicDir (NOT 'public/')
  audio/
    amelia/
      intro_first_visit__0.mp3   # SCRIPT_INTRO message 0
      intro_first_visit__1.mp3   # SCRIPT_INTRO message 1
      intro_first_visit__2.mp3
      intro_first_visit__3.mp3
      route_chosen_self__0.mp3
      route_chosen_self__1.mp3
      route_chosen_investor__0.mp3
      …
      first_product_page__0.mp3
      …
```

The naming convention is `{seqId}__{seqIndex}.mp3` — exactly the same
string we already use for the message `id` in `expandScript`. So a
generated file at `/audio/amelia/{id}.mp3` always matches its line
without any mapping table.

---

## 5. Runtime fallback rules

When you wire up a file-backed engine, the order is:

1. **File-backed** — try `HEAD /audio/amelia/{id}.mp3`.
   - 200 → play with `<audio>` element, apply mood-driven volume.
   - 404 / non-audio → fall back to step 2.
2. **Web Speech** — current default. Picks an English female voice
   from `speechSynthesis.getVoices()`.
3. **Silent** — no engine available (very old browsers). The text
   still appears in the overlay; only voice is missing.

The fallback should be transparent to call sites. Example skeleton
for an `AudioFileEngine` slot-in:

```ts
class AudioFileEngine implements AmeliaVoiceEngine {
  private current: HTMLAudioElement | null = null;

  async speak(line: AmeliaVoiceLine) {
    this.stop();
    const url = `/audio/amelia/${line.id}.mp3`;
    try {
      const head = await fetch(url, { method: 'HEAD' });
      const ct = head.headers.get('content-type') ?? '';
      if (!head.ok || !ct.includes('audio')) throw new Error('no file');
    } catch {
      // delegate to web speech
      webSpeechEngine.speak(line);
      return;
    }
    const el = new Audio(url);
    el.volume = PROSODY[line.mood ?? 'neutral'].volume;
    el.play().catch(() => { /* autoplay blocked */ });
    this.current = el;
  }
  stop() { try { this.current?.pause(); } catch {} this.current = null; }
  isSpeaking() { return !!this.current && !this.current.paused; }
}
```

The `AmeliaVoiceManager` selects the engine based on a build-time
flag or an in-app setting.

---

## 6. Mood and prosody

Web Speech: prosody is set per-utterance via `rate`/`pitch`/`volume`.

Pre-generated files: prosody is **baked in** at generation time. Two
options:

1. **Multi-take per line** — render each line at the mood that fits
   it best. The chosen mood lives in the `MascotScript` definition.
   Generation script picks the corresponding Piper config (some Piper
   voices accept a `--length-scale` for slower/faster).
2. **Single take + runtime gain only** — generate one neutral take per
   line, then adjust `<audio>` volume at runtime by mood. Cheaper to
   produce, less expressive.

For Amelia, option 1 is recommended for the high-impact scripts
(`SCRIPT_INTRO`, `SCRIPT_PHASE3_START`, `SCRIPT_FINAL`); option 2 is
fine for ad-hoc dynamic feedback messages.

---

## 7. Quick start — generate ALL current scripts

`scripts/generate-amelia-voice.sh` (write this when you're ready):

```bash
#!/usr/bin/env bash
set -euo pipefail
OUT=assets/audio/amelia
mkdir -p "$OUT"
node --experimental-strip-types <<'NODE'
  import { ALL_SCRIPTS, expandScript } from '../src/content/mascotScripts';
  import { spawnSync } from 'node:child_process';
  for (const script of ALL_SCRIPTS) {
    for (const m of expandScript(script)) {
      const wav = `/tmp/${m.id}.wav`;
      const mp3 = `assets/audio/amelia/${m.id}.mp3`;
      spawnSync('piper', [
        '--model', 'voices/en_US-amy-medium.onnx',
        '--output_file', wav,
      ], { input: m.body });
      spawnSync('ffmpeg', ['-y', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '96k', mp3]);
    }
  }
NODE
```

Run once. Output lands in `assets/audio/amelia/`. Vite serves the
folder under `/audio/amelia/` automatically.

---

## 8. Settings + UX rules

The voice belongs to the SFX channel:

- SFX off → voice off.
- Music toggle is independent (music can be on with voice off).
- Skip / Finish / Next / Previous all stop the current utterance.
- `beforeunload` stops voice (no leftover audio when navigating away).
- Re-speaking the SAME line id while it's still speaking is a no-op
  (no replay on React re-render).

These rules are enforced by `AmeliaVoiceManager` in
`src/audio/ameliaVoice.ts` and don't change between Web Speech and
file-backed engines.

---

## 9. Limitations

- **Web Speech voices vary by OS.** Chrome on Linux often has thin,
  robotic voices. Pre-generation is the fix for consistency.
- **Long lines clip on iOS Safari.** SpeechSynthesis on iOS has a
  hardcoded ~30 second per-utterance cap. Our scripts are short
  enough to never hit it, but watch out if scripts grow.
- **Autoplay policies.** Voice can only fire after a user gesture.
  All Amelia triggers are gesture-bound today (clicks). If you ever
  call `speak()` from a passive event (timer, idle handler), expect
  silent fail on Safari.

---

## 10. Status

- ✅ Web Speech engine implemented (`src/audio/ameliaVoice.ts`)
- ✅ Mood → prosody mapping
- ✅ Text sanitization (arrows, ampersands, currency, emojis)
- ✅ Wired into `VisualNovelMascot` overlay
- ✅ SFX toggle silences voice
- ⏳ File-backed engine — skeleton in this doc; not yet shipped
- ⏳ Voice files — not generated yet
- ⏳ Per-line generation script — recipe in this doc; not yet committed
