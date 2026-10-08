// Amelia voice narration — modular TTS layer.
//
// ── Why a separate file ─────────────────────────────────────────────
// Music + UI SFX live in `audioManager.ts` and use the Web Audio API.
// Voice has different requirements: it cancels rapidly, picks a voice
// from the OS voice list, and may eventually be replaced with
// pre-generated audio files. Keeping it isolated means the voice
// engine can be swapped (Web Speech → Piper-generated MP3 → Coqui)
// without touching SFX/music.
//
// ── Architecture ────────────────────────────────────────────────────
//   AmeliaVoiceEngine (interface)
//     ├─ WebSpeechEngine       ← current default (browser-native)
//     └─ AudioFileEngine       ← future, plays /audio/amelia/{id}.mp3
//
//   AmeliaVoice (singleton)
//     - speak(line)            cancels any in-flight utterance + plays
//     - stop()                 cancels current; useful on Skip / unmount
//     - setEnabled(on)         mirrors SFX toggle from audioManager
//
// ── Browser autoplay policy ────────────────────────────────────────
// Speech Synthesis is gated on a user gesture in modern browsers.
// We never call `.speak()` from page load — only from real
// interactions (Next/Prev/Finish in VisualNovelMascot, mascot script
// triggers fired from clicks). If a call is blocked, we fail silently.
//
// ── Future: pre-generated audio files ──────────────────────────────
// See docs/amelia-voice-pipeline.md for the Piper/Coqui generation
// recipe. Each line has a stable `id` (we already use seqId__index in
// mascot scripts) so a generated file at `/audio/amelia/{id}.mp3` can
// transparently replace the Web Speech path when present.

import type { BubbleType, MascotMood } from '@/types';

// ── VO master switch ───────────────────────────────────────────────
// Amelia's voice-over (TTS narration) is disabled for now. SFX + music
// are unaffected (they live in audioManager). Flip this to `false` to
// bring her narration + the Settings voice picker back.
export const VOICE_DISABLED = true;

// ──────────────────────────────────────────────────────────────────
// MOOD MAPPING — drives prosody (rate/pitch/volume).
// ──────────────────────────────────────────────────────────────────

export type AmeliaMood =
  | 'neutral'
  | 'happy'
  | 'excited'
  | 'warning'
  | 'concerned'
  | 'success'
  | 'failure'
  | 'thinking'
  | 'tutorial';

interface Prosody {
  rate: number;
  pitch: number;
  volume: number;
}

const PROSODY: Record<AmeliaMood, Prosody> = {
  // Tutorial / neutral — friendly, clear, slightly higher pitch so
  // Amelia reads as a young female voice without sounding babyish.
  tutorial:  { rate: 0.95, pitch: 1.15, volume: 0.85 },
  neutral:   { rate: 0.95, pitch: 1.10, volume: 0.85 },
  // Positive outcomes — brighter, livelier.
  happy:     { rate: 1.00, pitch: 1.25, volume: 0.90 },
  success:   { rate: 1.00, pitch: 1.25, volume: 0.90 },
  excited:   { rate: 1.05, pitch: 1.30, volume: 0.90 },
  // Caution — slower, slightly lower so the line feels weighty
  // without alarming.
  warning:   { rate: 0.90, pitch: 1.05, volume: 0.85 },
  concerned: { rate: 0.90, pitch: 1.05, volume: 0.85 },
  // Failure — gentlest of all; deliberate and human, not punishing.
  failure:   { rate: 0.85, pitch: 0.95, volume: 0.85 },
  // Thinking — measured, slightly under-pitched.
  thinking:  { rate: 0.92, pitch: 1.05, volume: 0.85 },
};

/**
 * Derive an Amelia mood from the message's `mood` (MascotMood, used
 * for the sprite expression) and `type` (BubbleType, hint/warning/etc).
 * `mood` is a more specific cue when present, so it wins.
 */
export function moodFromMessage(msg: { mood?: MascotMood; type?: BubbleType }): AmeliaMood {
  const m = msg.mood;
  if (m) {
    if (m === 'excited' || m === 'excited_big') return 'excited';
    if (m === 'happy' || m === 'happy_soft') return 'happy';
    if (m === 'warning' || m === 'warning_alert') return 'warning';
    if (m === 'concerned' || m === 'concerned_soft' || m === 'confused' || m === 'confused_tilt') return 'concerned';
    if (m === 'thinking' || m === 'thinking_side') return 'thinking';
    if (m === 'presenting' || m === 'presenting_open_hand' || m === 'pointing_left_explain' || m === 'pointing_right_explain') return 'tutorial';
  }
  if (msg.type === 'success') return 'success';
  if (msg.type === 'warning') return 'warning';
  if (msg.type === 'tutorial') return 'tutorial';
  if (msg.type === 'event') return 'thinking';
  if (msg.type === 'insight') return 'thinking';
  if (msg.type === 'debrief') return 'thinking';
  return 'neutral';
}

// ──────────────────────────────────────────────────────────────────
// TEXT SANITIZATION — strip UI-only glyphs that don't read aloud well.
// ──────────────────────────────────────────────────────────────────

/**
 * Clean dialogue text for TTS. The visual novel overlay shows the
 * RAW string; this is the spoken-only transformation.
 *
 *   "Open Business → Customer"   →  "Open Business, then Customer"
 *   "P&L"                        →  "P and L"
 *   "$2,500"                     →  "$2500"   (browsers read OK)
 *   "90-day"                     →  "90 day"
 *   "Phase 1/3"                  →  "Phase 1 of 3"
 *   "—" (em dash)                →  ", "
 *   "·" (middle dot)             →  ", "
 *   emoji + control chars        →  stripped
 */
export function sanitizeForSpeech(text: string): string {
  let s = text;
  // Arrows → "then"
  s = s.replace(/[→➔➜>]/g, ', then ');
  s = s.replace(/[←⇐]/g, ', back to ');
  // Common ampersand patterns first (P&L / R&D etc.)
  s = s.replace(/\b([A-Z])&([A-Z])\b/g, '$1 and $2');
  s = s.replace(/&/g, ' and ');
  // Phase 1/3 → "Phase 1 of 3"
  s = s.replace(/(\d+)\s*\/\s*(\d+)/g, '$1 of $2');
  // Hyphens between number-and-word: "90-day" → "90 day"
  s = s.replace(/(\d+)-([a-zA-Z])/g, '$1 $2');
  // Em/en dashes + middle dot → comma pause
  s = s.replace(/[--·•]/g, ', ');
  // Currency commas — drop so "2,500" reads as "twenty five hundred"
  // or "two thousand five hundred", not "two comma five hundred".
  s = s.replace(/(\$?\d{1,3}(?:,\d{3})+)/g, (m) => m.replace(/,/g, ''));
  // Strip emojis, pictographs, control characters.
  s = s.replace(/[\u{1F000}-\u{1FFFF}]/gu, '');
  s = s.replace(/[\u{2600}-\u{27BF}]/gu, '');
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\x00-\x1f]/g, '');
  // Collapse repeated whitespace + commas.
  s = s.replace(/,\s*,/g, ',');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

// ──────────────────────────────────────────────────────────────────
// VOICE ENGINE INTERFACE
// ──────────────────────────────────────────────────────────────────

export interface AmeliaVoiceLine {
  id: string;
  text: string;
  mood?: AmeliaMood;
  /** When true, cancel any in-flight line before speaking. Default true. */
  interrupt?: boolean;
}

export interface AmeliaVoiceEngine {
  speak(line: AmeliaVoiceLine): void;
  stop(): void;
  isSpeaking(): boolean;
  /** Display-only — used by debug UI. */
  describe?(): string;
}

// ──────────────────────────────────────────────────────────────────
// WEB SPEECH ENGINE
// ──────────────────────────────────────────────────────────────────

class WebSpeechEngine implements AmeliaVoiceEngine {
  private chosenVoice: SpeechSynthesisVoice | null = null;
  private voicesLoaded = false;
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  /** User-pinned voice name. When set, overrides auto-selection. */
  private userVoiceName: string | null = null;

  constructor() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.synth = window.speechSynthesis;
    // Voices load asynchronously on Chrome — try once, then again on
    // the `voiceschanged` event. This whole flow is a no-op on
    // platforms that don't support the API.
    this.refreshVoice();
    if (this.synth.addEventListener) {
      this.synth.addEventListener('voiceschanged', () => this.refreshVoice());
    } else {
      this.synth.onvoiceschanged = () => this.refreshVoice();
    }
  }

  /**
   * Score a voice by how "Amelia-friendly" it sounds. Higher is
   * better. The biggest jumps come from:
   *   - Microsoft "Natural" / "Online" voices (Aria, Jenny, Ava) —
   *     dramatically more natural than the offline catalog
   *   - Apple "Premium" / "Enhanced" voices — Apple's neural voices
   *   - Voices labelled "(Female)" or matching a curated cute-name
   *     list (Samantha, Karen, Moira, Tessa)
   *
   * Robotic offline voices like "Microsoft David"/"Microsoft Mark"
   * (male, OS default) score low and end up at the bottom.
   */
  private scoreVoice(v: SpeechSynthesisVoice): number {
    const n = v.name.toLowerCase();
    let score = 0;

    // Reject male voices outright — Amelia is female-presenting.
    const maleNames = ['david', 'mark', 'george', 'fred', 'ralph', 'james', 'eddy', 'reed', 'rocko', 'albert', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'whisper', 'organ', 'trinoids', 'zarvox', 'bad news', 'good news', 'hysterical', 'pipe organ'];
    if (maleNames.some((m) => n.includes(m)) || n.includes('(male)')) return -100;

    // Microsoft Natural / Online voices — highest tier (very natural).
    if (n.includes('natural')) score += 200;
    if (n.includes('online')) score += 100;

    // Apple Premium / Enhanced — neural voices (very natural).
    if (n.includes('premium')) score += 180;
    if (n.includes('enhanced')) score += 120;

    // Cute / friendly female names — curated list. "Aria" and "Jenny"
    // tend to be Microsoft Natural voices on Edge/Chromium.
    const cuteFavorites: Record<string, number> = {
      aria: 80, jenny: 80, sonia: 70, libby: 60, michelle: 60,
      ava: 70, samantha: 60, karen: 55, moira: 50, tessa: 50,
      allison: 50, susan: 45, kate: 40, victoria: 40,
      // Google
      'google us english': 45, 'google uk english female': 50,
    };
    for (const [name, bonus] of Object.entries(cuteFavorites)) {
      if (n.includes(name)) { score += bonus; break; }
    }

    // Generic "female" hint
    if (n.includes('female')) score += 30;

    // Local voices have ZERO network delay — small bias toward them
    // when scores tie, so the user's first click feels instant.
    if (v.localService) score += 5;

    // Heavy penalty for known-robotic OS voices.
    const robotic = ['daniel', 'oliver', 'rishi', 'serena', 'thomas', 'whisper'];
    if (robotic.some((r) => n.includes(r))) score -= 50;

    return score;
  }

  private refreshVoice() {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    if (!voices.length) return;
    const en = voices.filter((v) => /^en[-_]/i.test(v.lang) || v.lang === 'en');
    if (!en.length) {
      this.chosenVoice = voices[0] ?? null;
      this.voicesLoaded = true;
      return;
    }
    // Honour a user pick first.
    if (this.userVoiceName) {
      const userPick = en.find((v) => v.name === this.userVoiceName);
      if (userPick) {
        this.chosenVoice = userPick;
        this.voicesLoaded = true;
        return;
      }
    }
    // Otherwise score every voice and take the best.
    const scored = en
      .map((v) => ({ v, score: this.scoreVoice(v) }))
      .sort((a, b) => b.score - a.score);
    this.chosenVoice = scored[0]?.v ?? en[0] ?? null;
    this.voicesLoaded = true;
  }

  /** Public — let the UI list candidate voices for the user. */
  getEnglishVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices()
      .filter((v) => /^en[-_]/i.test(v.lang) || v.lang === 'en')
      .filter((v) => this.scoreVoice(v) > -100)
      .sort((a, b) => this.scoreVoice(b) - this.scoreVoice(a));
  }

  /** Public — set the preferred voice by name. Empty string = auto. */
  setVoiceByName(name: string | null) {
    this.userVoiceName = name && name.length > 0 ? name : null;
    this.refreshVoice();
  }

  getCurrentVoiceName(): string | null {
    return this.chosenVoice?.name ?? null;
  }

  speak(line: AmeliaVoiceLine) {
    if (!this.synth) return;
    const text = sanitizeForSpeech(line.text);
    if (!text) return;
    // Always cancel the previous utterance so we don't queue or
    // overlap. SpeechSynthesis is single-channel by design.
    if (line.interrupt !== false) this.synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (this.chosenVoice) u.voice = this.chosenVoice;
    u.lang = this.chosenVoice?.lang ?? 'en-US';
    const prosody = PROSODY[line.mood ?? 'neutral'];
    u.rate = prosody.rate;
    u.pitch = prosody.pitch;
    u.volume = prosody.volume;
    u.onend = () => { if (this.currentUtterance === u) this.currentUtterance = null; };
    u.onerror = () => { if (this.currentUtterance === u) this.currentUtterance = null; };
    this.currentUtterance = u;
    try { this.synth.speak(u); } catch { /* autoplay blocked or platform issue */ }
  }

  stop() {
    if (!this.synth) return;
    try { this.synth.cancel(); } catch { /* ignore */ }
    this.currentUtterance = null;
  }

  isSpeaking() {
    return !!this.synth && this.synth.speaking;
  }

  describe() {
    return this.chosenVoice
      ? `Web Speech · ${this.chosenVoice.name} (${this.chosenVoice.lang})`
      : `Web Speech · ${this.voicesLoaded ? 'no English voice found' : 'voices loading…'}`;
  }
}

// ──────────────────────────────────────────────────────────────────
// KOKORO ENGINE — neural TTS running 100% in-browser via ONNX.
//
// Why Kokoro:
//   - 82M-parameter neural TTS — voices are dramatically more
//     natural than OS Web Speech voices (Samantha, Karen, etc.).
//   - Apache-2.0, runs offline once cached, no API key.
//   - Author (xenova) is also behind Transformers.js — well-maintained.
//
// Cost:
//   - First load downloads ~80-150MB of model weights from
//     HuggingFace. Cached by the browser afterwards.
//   - Synthesis ~1-3 seconds per line on a modern laptop CPU; <1s
//     with WebGPU.
//
// Strategy:
//   - Lazy-load on first speak() call so the page itself loads fast.
//   - While the model is loading, fall back to Web Speech so the
//     user still hears SOMETHING and the app isn't silent.
//   - Once Kokoro is ready, every subsequent speak() uses it.
//   - On any synth error, fall back to Web Speech for that line.
//
// Voice presets — biased toward "cute, friendly, expressive":
//   af_bella   — American Female, cheerful (default)
//   af_heart   — American Female, warm
//   af_nicole  — American Female, soft
//   bf_emma    — British Female, friendly
//   bf_isabella — British Female, gentle
// ──────────────────────────────────────────────────────────────────

export type KokoroVoiceId =
  | 'af_bella' | 'af_heart' | 'af_nicole' | 'af_sarah' | 'af_sky'
  | 'bf_emma' | 'bf_isabella' | 'bf_lily';

const KOKORO_VOICE_LABELS: Record<KokoroVoiceId, string> = {
  af_bella: 'Bella · cheerful (US)',
  af_heart: 'Heart · warm (US)',
  af_nicole: 'Nicole · soft (US)',
  af_sarah: 'Sarah · clear (US)',
  af_sky: 'Sky · bright (US)',
  bf_emma: 'Emma · friendly (UK)',
  bf_isabella: 'Isabella · gentle (UK)',
  bf_lily: 'Lily · sweet (UK)',
};

class KokoroEngine implements AmeliaVoiceEngine {
  // We hold the runtime instance dynamically — the package + model
  // weights are massive, so we never import statically.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private tts: any | null = null;
  private loading: Promise<void> | null = null;
  private loadError: Error | null = null;
  private voiceId: KokoroVoiceId = 'af_bella';
  private currentAudio: HTMLAudioElement | null = null;
  private currentRequestSeq = 0;
  private webSpeechFallback: WebSpeechEngine;

  constructor(fallback: WebSpeechEngine) {
    this.webSpeechFallback = fallback;
  }

  setVoiceId(id: KokoroVoiceId) { this.voiceId = id; }
  getVoiceId(): KokoroVoiceId { return this.voiceId; }

  /** Status flag for the UI — model loading, ready, or fell back. */
  status(): 'idle' | 'loading' | 'ready' | 'error' {
    if (this.loadError) return 'error';
    if (this.tts) return 'ready';
    if (this.loading) return 'loading';
    return 'idle';
  }

  private async loadModel(): Promise<void> {
    if (this.tts) return;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        // Dynamic import — keeps initial bundle small. Vite chunks the
        // kokoro-js + transformers.js dependency tree separately.
        const mod = await import('kokoro-js');
        const { KokoroTTS } = mod;
        // `q8` quantization keeps the model under ~200 MB while still
        // sounding natural. Browser caches the ONNX shards after the
        // first download.
        this.tts = await KokoroTTS.from_pretrained(
          'onnx-community/Kokoro-82M-v1.0-ONNX',
          { dtype: 'q8' },
        );
      } catch (err) {
        this.loadError = err as Error;
        console.warn('[ameliaVoice] Kokoro model failed to load - falling back to Web Speech.', err);
        throw err;
      } finally {
        this.loading = null;
      }
    })();
    return this.loading;
  }

  speak(line: AmeliaVoiceLine) {
    const seq = ++this.currentRequestSeq;
    const text = sanitizeForSpeech(line.text);
    if (!text) return;
    // Stop any in-flight Kokoro audio + any Web Speech utterance.
    this.stop();
    // While the model is still loading, render via Web Speech so the
    // user isn't met with silence on first click. When ready,
    // subsequent lines use Kokoro.
    if (!this.tts) {
      this.webSpeechFallback.speak(line);
      void this.loadModel().catch(() => { /* logged in loadModel */ });
      return;
    }
    void (async () => {
      try {
        // Kokoro produces a `RawAudio` object with .audio (Float32) +
        // .sampling_rate. We turn it into an MP3-ish blob via WAV.
        const out = await this.tts.generate(text, { voice: this.voiceId });
        // If the player hit Next/Skip while we were synthesizing,
        // discard the result.
        if (seq !== this.currentRequestSeq) return;
        const wav = floatToWav(out.audio, out.sampling_rate);
        const url = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
        const audio = new Audio(url);
        // Apply mood-driven volume (Kokoro doesn't expose pitch/rate
        // post-synthesis; for those we'd render with different voice
        // params, which is a follow-up).
        audio.volume = (PROSODY[line.mood ?? 'neutral'].volume ?? 0.85);
        audio.onended = () => { URL.revokeObjectURL(url); };
        audio.onerror = () => { URL.revokeObjectURL(url); };
        this.currentAudio = audio;
        await audio.play();
      } catch (err) {
        console.warn('[ameliaVoice] Kokoro synth failed, using Web Speech fallback.', err);
        if (seq === this.currentRequestSeq) {
          this.webSpeechFallback.speak(line);
        }
      }
    })();
  }

  stop() {
    this.currentRequestSeq++;
    if (this.currentAudio) {
      try { this.currentAudio.pause(); } catch { /* ignore */ }
      this.currentAudio = null;
    }
    this.webSpeechFallback.stop();
  }

  isSpeaking() {
    return !!this.currentAudio && !this.currentAudio.paused;
  }

  describe() {
    const s = this.status();
    if (s === 'ready') return `Kokoro · ${KOKORO_VOICE_LABELS[this.voiceId]}`;
    if (s === 'loading') return 'Kokoro · loading neural model…';
    if (s === 'error') return 'Kokoro · failed (using Web Speech)';
    return 'Kokoro · idle';
  }
}

/**
 * Encode a Float32 PCM buffer into a WAV blob (mono, 16-bit). WAV is
 * universally supported by `<audio>` and avoids extra deps.
 */
function floatToWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bit depth
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += bytesPerSample;
  }
  return buffer;
}

// ──────────────────────────────────────────────────────────────────
// AMELIA VOICE MANAGER (singleton)
// ──────────────────────────────────────────────────────────────────

class AmeliaVoiceManager {
  private engine: AmeliaVoiceEngine | null = null;
  private webSpeech: WebSpeechEngine | null = null;
  private kokoro: KokoroEngine | null = null;
  /** Which engine the manager currently routes speak() through. */
  private mode: 'kokoro' | 'webspeech' = 'kokoro';
  private enabled = true;
  private lastLineId: string | null = null;
  private warmedUp = false;

  private readVoicePref(): string | null {
    if (typeof localStorage === 'undefined') return null;
    try { return localStorage.getItem('intlabs:amelia:voice') || null; } catch { return null; }
  }
  private writeVoicePref(name: string | null) {
    if (typeof localStorage === 'undefined') return;
    try {
      if (name) localStorage.setItem('intlabs:amelia:voice', name);
      else localStorage.removeItem('intlabs:amelia:voice');
    } catch { /* ignore */ }
  }
  private readKokoroPref(): KokoroVoiceId | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const v = localStorage.getItem('intlabs:amelia:kokoro') as KokoroVoiceId | null;
      return v || null;
    } catch { return null; }
  }
  private writeKokoroPref(id: KokoroVoiceId) {
    if (typeof localStorage === 'undefined') return;
    try { localStorage.setItem('intlabs:amelia:kokoro', id); } catch { /* ignore */ }
  }

  /** List Amelia-suitable English voices for a settings picker. */
  listVoices(): { name: string; lang: string; localService: boolean }[] {
    const eng = this.ensureEngine();
    if (!eng || !(eng instanceof WebSpeechEngine)) return [];
    return eng.getEnglishVoices().map((v) => ({
      name: v.name,
      lang: v.lang,
      localService: v.localService,
    }));
  }

  /** User picks a voice by name. Empty → auto-select. Re-warm so the next click is instant. */
  setVoice(name: string | null) {
    const eng = this.ensureEngine();
    if (!eng || !(eng instanceof WebSpeechEngine)) return;
    eng.setVoiceByName(name);
    this.writeVoicePref(name);
    // Tiny priming utterance so the freshly-selected voice is hot
    // before the next real line.
    this.warmedUp = false;
    this.warmUp();
  }

  getCurrentVoiceName(): string | null {
    const eng = this.engine;
    if (!eng || !(eng instanceof WebSpeechEngine)) return null;
    return eng.getCurrentVoiceName();
  }

  /**
   * Speak a single space silently to wake the synth engine. The first
   * `.speak()` after page load can lag 200-500ms (especially online
   * voices fetching their model). Priming inside a user gesture
   * removes that initial hitch.
   */
  warmUp() {
    if (VOICE_DISABLED) return;
    if (this.warmedUp) return;
    if (!this.enabled) return;
    const eng = this.ensureEngine();
    if (!eng) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      u.rate = 1;
      window.speechSynthesis.speak(u);
      this.warmedUp = true;
    } catch { /* ignore */ }
  }

  private ensureEngine(): AmeliaVoiceEngine | null {
    if (this.engine) return this.engine;
    if (typeof window === 'undefined') return null;
    if (!('speechSynthesis' in window)) return null;
    this.engine = new WebSpeechEngine();
    // Apply persisted voice preference (if any) immediately.
    const pref = this.readVoicePref();
    if (pref && this.engine instanceof WebSpeechEngine) {
      this.engine.setVoiceByName(pref);
    }
    return this.engine;
  }

  /** Toggle voice on/off. When off, any in-flight line stops immediately. */
  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) {
      this.engine?.stop();
      this.lastLineId = null;
    } else {
      // Wake the engine on a real user gesture so the first script
      // doesn't have a cold-start delay.
      this.warmUp();
    }
  }
  isEnabled() { return this.enabled; }

  /**
   * Speak a line. Idempotent on the same `id` — calling twice with the
   * same id is a no-op so React effect re-renders don't replay.
   * Different ids (including Previous → earlier id) cancel the
   * current utterance and start the new one.
   */
  speak(line: AmeliaVoiceLine) {
    if (VOICE_DISABLED) return; // VO off for now — see VOICE_DISABLED
    if (!this.enabled) return;
    const eng = this.ensureEngine();
    if (!eng) return;
    if (this.lastLineId === line.id && eng.isSpeaking()) return;
    this.lastLineId = line.id;
    eng.speak(line);
  }

  stop() {
    this.engine?.stop();
    this.lastLineId = null;
  }

  isSpeaking() {
    return !!this.engine?.isSpeaking();
  }

  describe(): string {
    return this.engine?.describe?.() ?? 'No voice engine available';
  }
}

export const ameliaVoice = new AmeliaVoiceManager();

// Stop voice on page unload — prevents a stale utterance from
// continuing into a navigation.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => ameliaVoice.stop());
}
