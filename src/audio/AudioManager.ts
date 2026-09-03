/**
 * All sound is synthesised with the Web Audio API.
 *
 * The MVP ships no audio files on purpose: procedural hits load instantly, weigh
 * nothing, and can be pitch-randomised per impact so twenty punches in a row do
 * not sound like one sample looping. Swapping in real recordings later means
 * replacing the bodies of these methods.
 */
class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;

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
    this.burst(0.16, 0.16, 1600, 320, 1.4);
  }

  hit(power = 1) {
    const p = Math.min(2, power);
    this.burst(0.12 + p * 0.05, 0.4, 2200 * (0.8 + Math.random() * 0.4), 260, 0.9);
    this.tone(190 * (0.9 + Math.random() * 0.2), 48, 0.18 + p * 0.1, 0.5, "sine");
  }

  heavy() {
    this.burst(0.3, 0.5, 1400, 120, 0.7);
    this.tone(120, 34, 0.45, 0.7, "sine");
    this.tone(300, 80, 0.25, 0.25, "sawtooth", 0.01);
  }

  block() {
    this.burst(0.09, 0.3, 3600, 1200, 3);
    this.tone(880, 620, 0.09, 0.18, "square");
  }

  special() {
    this.tone(120, 900, 0.45, 0.3, "sawtooth");
    this.burst(0.5, 0.28, 400, 4000, 1.2);
  }

  ko() {
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
    this.burst(0.4, 0.4, 700, 90, 0.6);
    this.tone(90, 40, 0.5, 0.5, "sine");
  }
}

export const audio = new AudioManager();
