// Audio manager — Web Audio API based procedural SFX + ambient music.
//
// Why procedural?
//   - Zero asset weight (no MP3/OGG bundling, no CDN dependency).
//   - Sounds are crisp at any sample rate.
//   - Easy to swap for real audio files later by replacing `play()`
//     internals with `<audio>` element playback.
//
// Browser autoplay policy: any AudioContext created before the first
// user gesture is suspended. We lazily create the context inside the
// first `play()` call — which is always fired from a click/keydown.
//
// SFX timbre — kept short (60-300ms) and pleasant. Click is a soft
// blip; success is a rising perfect-fifth arpeggio; fail is a minor-
// second drop; coin/cash is a bright two-note ping; warning is a
// gentle two-tone alert.

export type SfxKind =
  | 'click'
  | 'click-soft'
  | 'success'
  | 'fail'
  | 'coin'
  | 'warning'
  | 'confirm'
  | 'whoosh'
  | 'pop'
  | 'select'
  | 'tick'
  | 'delete'
  | 'chime'
  | 'phase-up';

class AudioManager {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicNodes: { stop: () => void } | null = null;
  /**
   * Plain HTMLAudioElement for background music. We use the element
   * pipeline instead of Web Audio's decodeAudioData because:
   *   1. The browser handles streaming, decoding, and looping
   *      reliably across formats — no manual decode step.
   *   2. It's more tolerant of network jitter / cached responses.
   *   3. Volume control via .volume is straightforward.
   */
  private musicEl: HTMLAudioElement | null = null;

  private sfxEnabled = true;
  private musicEnabled = false; // off by default — let players opt in

  setSfxEnabled(on: boolean) {
    if (this.sfxEnabled === on) return;
    this.sfxEnabled = on;
    if (this.sfxGain) this.sfxGain.gain.value = on ? 0.4 : 0;
    // Amelia voice belongs to the same audio "channel" as SFX —
    // muting SFX silences her too. Imported lazily to avoid a
    // circular import (ameliaVoice doesn't depend on audioManager).
    void import('./ameliaVoice').then((m) => m.ameliaVoice.setEnabled(on));
  }

  setMusicEnabled(on: boolean) {
    // Idempotent — calling with the current state is a no-op. This
    // matters because the click handler in the HUD calls this directly
    // (for Safari gesture compliance) AND a useEffect mirrors the
    // store; without the guard music starts twice on toggle.
    if (this.musicEnabled === on) return;
    this.musicEnabled = on;
    // start/stop must not throw out of here. Creating or resuming an
    // AudioContext can fail — an autoplay policy, a browser with the Web Audio
    // API unavailable, a device with no output. If that exception escaped, the
    // caller's `toggleMusic()` never ran, so the manager believed music was on
    // while the store still said off: the toggle looked dead and stayed dead,
    // because the idempotent guard above then matched on every later attempt.
    try {
      if (on) this.startMusic();
      else this.stopMusic();
    } catch {
      // Roll the flag back so the guard doesn't wedge the toggle, and let the
      // caller's state update proceed — silence is recoverable, a stuck control
      // is not.
      this.musicEnabled = !on;
    }
  }

  isSfxEnabled() {
    return this.sfxEnabled;
  }
  isMusicEnabled() {
    return this.musicEnabled;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.ctx) {
      // Some browsers suspend AudioContext after a tab loses focus.
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    }
    try {
      const Ctx =
        (window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
          .AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      // Master gains let us toggle SFX/music independently.
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxEnabled ? 0.4 : 0;
      this.sfxGain.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.0; // ramp up when music starts
      this.musicGain.connect(this.ctx.destination);
      return this.ctx;
    } catch {
      return null;
    }
  }

  /** Play a short SFX cue. No-op when sfxEnabled is false. */
  play(kind: SfxKind) {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    switch (kind) {
      case 'click':
        this.envelope(ctx, this.sfxGain, [{ freq: 880, dur: 0.05, type: 'square', vol: 0.5 }]);
        break;
      case 'click-soft':
        this.envelope(ctx, this.sfxGain, [{ freq: 660, dur: 0.06, type: 'triangle', vol: 0.35 }]);
        break;
      case 'success':
        // Rising perfect-fifth arpeggio (C5 → G5 → C6).
        this.envelope(ctx, this.sfxGain, [
          { freq: 523, dur: 0.08, type: 'triangle', vol: 0.4, delay: 0 },
          { freq: 784, dur: 0.08, type: 'triangle', vol: 0.4, delay: 0.06 },
          { freq: 1046, dur: 0.16, type: 'triangle', vol: 0.45, delay: 0.13 },
        ]);
        break;
      case 'fail':
        // Drop a minor second.
        this.envelope(ctx, this.sfxGain, [
          { freq: 392, dur: 0.1, type: 'square', vol: 0.4, delay: 0 },
          { freq: 370, dur: 0.18, type: 'square', vol: 0.4, delay: 0.08 },
        ]);
        break;
      case 'coin':
        // Two-note bright ping (Mario-coin-ish but softer).
        this.envelope(ctx, this.sfxGain, [
          { freq: 988, dur: 0.05, type: 'sine', vol: 0.5, delay: 0 },
          { freq: 1318, dur: 0.18, type: 'sine', vol: 0.5, delay: 0.05 },
        ]);
        break;
      case 'warning':
        // Two short triangles, descending.
        this.envelope(ctx, this.sfxGain, [
          { freq: 660, dur: 0.08, type: 'triangle', vol: 0.4, delay: 0 },
          { freq: 523, dur: 0.12, type: 'triangle', vol: 0.4, delay: 0.1 },
        ]);
        break;
      case 'confirm':
        // Strong rising fifth — ideal for "Confirm Phase" CTA.
        this.envelope(ctx, this.sfxGain, [
          { freq: 440, dur: 0.07, type: 'sawtooth', vol: 0.35, delay: 0 },
          { freq: 660, dur: 0.07, type: 'sawtooth', vol: 0.35, delay: 0.06 },
          { freq: 880, dur: 0.18, type: 'sawtooth', vol: 0.4, delay: 0.13 },
        ]);
        break;
      case 'whoosh':
        // Filtered noise sweep — used when an event lands or a sequence opens.
        this.noiseSweep(ctx, this.sfxGain);
        break;
      case 'pop':
        // Gentle pop — for placement / tooltips. Quick triangle blip + descend.
        this.envelope(ctx, this.sfxGain, [
          { freq: 1200, dur: 0.04, type: 'triangle', vol: 0.35, delay: 0 },
          { freq: 800, dur: 0.05, type: 'triangle', vol: 0.25, delay: 0.03 },
        ]);
        break;
      case 'select':
        // Positive selection chime — fourth interval. Used when player
        // picks an audience, archetype, channel.
        this.envelope(ctx, this.sfxGain, [
          { freq: 587, dur: 0.06, type: 'sine', vol: 0.4, delay: 0 },
          { freq: 783, dur: 0.14, type: 'sine', vol: 0.45, delay: 0.05 },
        ]);
        break;
      case 'tick':
        // Tiny tactile tick — slider/stepper increments. Very short.
        this.envelope(ctx, this.sfxGain, [
          { freq: 1500, dur: 0.025, type: 'square', vol: 0.18 },
        ]);
        break;
      case 'delete':
        // Descending tone — remove / close. Telegraphs "going away".
        this.envelope(ctx, this.sfxGain, [
          { freq: 660, dur: 0.06, type: 'sawtooth', vol: 0.3, delay: 0 },
          { freq: 440, dur: 0.1, type: 'sawtooth', vol: 0.3, delay: 0.05 },
          { freq: 330, dur: 0.14, type: 'sawtooth', vol: 0.25, delay: 0.13 },
        ]);
        break;
      case 'chime':
        // Soft bell-like chime for positive notifications (insight
        // correct, level-up). Two stacked sine notes a third apart.
        this.envelope(ctx, this.sfxGain, [
          { freq: 880, dur: 0.4, type: 'sine', vol: 0.35, delay: 0 },
          { freq: 1108, dur: 0.4, type: 'sine', vol: 0.25, delay: 0.02 },
        ]);
        break;
      case 'phase-up':
        // Triumphant phase-complete — three rising notes + soft tail.
        this.envelope(ctx, this.sfxGain, [
          { freq: 523, dur: 0.1, type: 'triangle', vol: 0.4, delay: 0 },
          { freq: 659, dur: 0.1, type: 'triangle', vol: 0.4, delay: 0.08 },
          { freq: 784, dur: 0.1, type: 'triangle', vol: 0.45, delay: 0.16 },
          { freq: 1047, dur: 0.3, type: 'triangle', vol: 0.5, delay: 0.24 },
        ]);
        break;
    }
  }

  /** Schedule one or more enveloped oscillator beeps. */
  private envelope(
    ctx: AudioContext,
    out: GainNode,
    notes: Array<{ freq: number; dur: number; type: OscillatorType; vol: number; delay?: number }>,
  ) {
    const t0 = ctx.currentTime;
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = n.type;
      osc.frequency.value = n.freq;
      const start = t0 + (n.delay ?? 0);
      const end = start + n.dur;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(n.vol, start + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, end);
      osc.connect(g);
      g.connect(out);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  }

  /** Short filtered-noise sweep — works as a UI whoosh. */
  private noiseSweep(ctx: AudioContext, out: GainNode) {
    const dur = 0.22;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(2200, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(out);
    src.start();
    src.stop(ctx.currentTime + dur + 0.05);
  }

  // ──────────────────────────────────────────────────────────────────
  // BACKGROUND MUSIC — gentle ambient pad with subtle chord progression.
  //
  // Tries to load `/music/bg.mp3` first if a real file is provided.
  // Falls back to procedural ambient (slow chord cycle on a triangle
  // wave + low-pass filtered pink noise for that lo-fi tape texture).
  // ──────────────────────────────────────────────────────────────────

  private startMusic() {
    // Music uses HTMLAudioElement — independent of the Web Audio
    // context that powers SFX. Easier, more reliable across formats
    // and codecs, and handles streaming + loop natively.
    this.stopMusic();
    try {
      const el = new Audio('/music/bg.mp3');
      el.loop = true;
      el.volume = 0;
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';
      this.musicEl = el;
      // Fade-in over 1.2s.
      const startedAt = Date.now();
      const fadeIn = () => {
        if (!this.musicEl || this.musicEl !== el) return;
        const t = (Date.now() - startedAt) / 1200;
        const target = 0.45;
        if (t >= 1) {
          el.volume = target;
          return;
        }
        el.volume = target * t;
        window.setTimeout(fadeIn, 50);
      };
      // play() is a Promise that rejects on autoplay-policy block —
      // we already gate on a user gesture so this should resolve, but
      // we catch anyway so a rejection doesn't surface as a console error.
      el.play()
        .then(() => fadeIn())
        .catch((err) => {
          // Common rejection: NotAllowedError if not in a user gesture.
          // Roll back the enabled flag so the next click starts fresh.
          this.musicEnabled = false;
          this.musicEl = null;
          if (typeof console !== 'undefined') console.warn('Music play blocked:', err);
        });
    } catch (err) {
      this.musicEnabled = false;
      if (typeof console !== 'undefined') console.warn('Music init failed:', err);
    }
  }

  private stopMusic() {
    const el = this.musicEl;
    if (!el) return;
    this.musicEl = null;
    // Soft fade-out then pause.
    const startVol = el.volume;
    const startedAt = Date.now();
    const fadeOut = () => {
      const t = (Date.now() - startedAt) / 600;
      if (t >= 1) {
        el.volume = 0;
        try { el.pause(); el.src = ''; } catch {}
        return;
      }
      el.volume = startVol * (1 - t);
      window.setTimeout(fadeOut, 50);
    };
    fadeOut();
  }
}

// Singleton — one AudioContext per page.
export const audio = new AudioManager();

/** Convenience wrapper used at call sites. */
export const playSfx = (kind: SfxKind) => audio.play(kind);

// Dev-only: expose the manager on window for in-browser debugging.
// Strip in production via Vite's import.meta.env.PROD when needed.
if (typeof window !== 'undefined') {
  (window as unknown as { __audio?: AudioManager }).__audio = audio;
}
