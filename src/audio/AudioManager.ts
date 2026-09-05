/**
 * Sound is sampled where samples exist and synthesised where they do not.
 *
 * `public/sounds/` is populated by `bun run sounds` (CC0 clips from Freesound —
 * see public/sounds/CREDITS.md). Every sample is pitch- and gain-randomised per
 * impact and several variants of each sound are cycled, so twenty punches in a
 * row do not sound like one clip looping.
 *
 * The synthesised versions are not dead code: each method falls back to one when
 * the pack is missing, a file fails to decode, or the fetch is still in flight
 * during the first fight. The game is never silent, and it still works offline
 * with no audio files at all.
 */
type SampleName = "whoosh" | "hit" | "heavy" | "block" | "knockdown" | "special" | "ko";

class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;
  private samples = new Map<SampleName, AudioBuffer[]>();
  private loading = false;

  /** Must be called from a user gesture (the Play button). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;

    // 2 seconds of white noise, reused by every percussive sound.
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;

    void this.loadSamples();
  }

  /** Fetches and decodes the sound pack. Failures are silent by design. */
  private async loadSamples() {
    if (this.loading || !this.ctx) return;
    this.loading = true;
    // BASE_URL, not a leading slash: the same reason faces.ts and heads.ts use
    // it — an absolute path breaks the moment the game is served from a subpath.
    const base = `${import.meta.env.BASE_URL}sounds`;
    try {
      const res = await fetch(`${base}/manifest.json`);
      if (!res.ok) return;
      const manifest = (await res.json()) as Record<string, number>;
      await Promise.all(
        Object.entries(manifest).map(async ([name, count]) => {
          const buffers: AudioBuffer[] = [];
          for (let i = 1; i <= count; i++) {
            try {
              const r = await fetch(`${base}/${name}-${i}.mp3`);
              if (!r.ok) continue;
              buffers.push(await this.ctx!.decodeAudioData(await r.arrayBuffer()));
            } catch {
              /* one bad file should not take out the pack */
            }
          }
          if (buffers.length) this.samples.set(name as SampleName, buffers);
        }),
      );
    } catch {
      /* offline or missing pack: the synthesised fallbacks cover everything */
    }
  }

  /**
   * Plays a random variant, detuned and re-levelled a little each time.
   * Returns false when no sample is loaded, so callers can synthesise instead.
   */
  private sample(name: SampleName, gain = 1, spread = 0.16): boolean {
    const bank = this.samples.get(name);
    if (!bank || bank.length === 0 || !this.ctx || !this.master || this.muted) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = bank[(Math.random() * bank.length) | 0];
    src.playbackRate.value = 1 + (Math.random() * 2 - 1) * spread;
    const g = this.ctx.createGain();
    g.gain.value = gain * (0.85 + Math.random() * 0.3);
    src.connect(g).connect(this.master);
    src.start();
    return true;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.6;
  }

  private get t() {
    return this.ctx?.currentTime ?? 0;
  }

  private tone(
    freq: number,
    endFreq: number,
    duration: number,
    gain: number,
    type: OscillatorType = "sine",
    delay = 0,
  ) {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.t + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + duration);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  private burst(
    duration: number,
    gain: number,
    filterFreq: number,
    endFilter: number,
    q = 1,
    delay = 0,
  ) {
    if (!this.ctx || !this.master || !this.noise || this.muted) return;
    const t0 = this.t + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = q;
    filter.frequency.setValueAtTime(filterFreq, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFilter), t0 + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + duration + 0.05);
  }

  whoosh() {
    if (this.sample("whoosh", 0.5, 0.22)) return;
    this.burst(0.16, 0.16, 1600, 320, 1.4);
  }

  hit(power = 1) {
    if (this.sample("hit", 0.9)) return;
    const p = Math.min(2, power);
    this.burst(0.12 + p * 0.05, 0.4, 2200 * (0.8 + Math.random() * 0.4), 260, 0.9);
    this.tone(190 * (0.9 + Math.random() * 0.2), 48, 0.18 + p * 0.1, 0.5, "sine");
  }

  heavy() {
    if (this.sample("heavy", 1)) return;
    this.burst(0.3, 0.5, 1400, 120, 0.7);
    this.tone(120, 34, 0.45, 0.7, "sine");
    this.tone(300, 80, 0.25, 0.25, "sawtooth", 0.01);
  }

  block() {
    if (this.sample("block", 0.7)) return;
    this.burst(0.09, 0.3, 3600, 1200, 3);
    this.tone(880, 620, 0.09, 0.18, "square");
  }

  special() {
    if (this.sample("special", 0.9, 0.08)) return;
    this.tone(120, 900, 0.45, 0.3, "sawtooth");
    this.burst(0.5, 0.28, 400, 4000, 1.2);
  }

  ko() {
    if (this.sample("ko", 1, 0.06)) return;
    this.tone(320, 40, 0.9, 0.8, "sawtooth");
    this.burst(0.8, 0.55, 900, 80, 0.5);
    this.tone(60, 28, 1.4, 0.6, "sine", 0.05);
  }

  beep(high = false) {
    this.tone(high ? 900 : 620, high ? 900 : 620, high ? 0.4 : 0.14, 0.35, "square");
  }

  click() {
    this.tone(520, 760, 0.06, 0.22, "square");
  }

  knockdown() {
    if (this.sample("knockdown", 0.9)) return;
    this.burst(0.4, 0.4, 700, 90, 0.6);
    this.tone(90, 40, 0.5, 0.5, "sine");
  }
}

export const audio = new AudioManager();
