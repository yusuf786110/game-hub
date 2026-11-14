// Procedural Sound Effects & Atmosphere for Buckshot Roulette using Web Audio API
// 100% self-contained, zero external audio dependencies!

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.ambientGain = null;
    this.isMuted = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.startAmbient();
  }

  startAmbient() {
    if (!this.ctx || this.ambientGain) return;
    const ctx = this.ctx;

    // Dark industrial hum & transformer drone
    this.ambientGain = ctx.createGain();
    this.ambientGain.gain.setValueAtTime(this.isMuted ? 0 : 0.12, ctx.currentTime);
    this.ambientGain.connect(ctx.destination);

    // Deep sub drone
    const osc1 = ctx.createOscillator();
    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(50, ctx.currentTime);
    const filter1 = ctx.createBiquadFilter();
    filter1.type = "lowpass";
    filter1.frequency.setValueAtTime(100, ctx.currentTime);
    osc1.connect(filter1);
    filter1.connect(this.ambientGain);
    osc1.start();

    // Electrical 60Hz hum
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(60, ctx.currentTime);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.06, ctx.currentTime);
    osc2.connect(g2);
    g2.connect(this.ambientGain);
    osc2.start();

    // Subtle background noise rumble
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(130, ctx.currentTime);
    noiseFilter.Q.setValueAtTime(3.0, ctx.currentTime);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.035, ctx.currentTime);
    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.ambientGain);
    whiteNoise.start();
  }

  setMute(muted) {
    this.isMuted = muted;
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setValueAtTime(muted ? 0 : 0.12, this.ctx.currentTime);
    }
  }

  // --- SOUND EFFECTS ---

  // Massive 12-gauge shotgun blast with sub bass explosion and room echo
  playShotgunBlast() {
    if (!this.ctx || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Sharp noise burst
    const bufferSize = Math.floor(ctx.sampleRate * 1.6);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const out = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      out[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.18));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.setValueAtTime(5000, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(110, now + 1.4);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(1.0, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);

    // Deep sub bass kick thump
    const subOsc = ctx.createOscillator();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(170, now);
    subOsc.frequency.exponentialRampToValueAtTime(26, now + 0.7);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.95, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.9);
  }

  // Hollow metallic dry fire click
  playBlankClick() {
    if (!this.ctx || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Shotgun pump racking sound (ch-chck)
  playPumpRack() {
    if (!this.ctx || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const playClack = (t, freq) => {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(70, t + 0.07);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.45, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.09);
    };

    playClack(now, 460);
    playClack(now + 0.15, 320);
  }

  // Shell insert click into magazine tube
  playShellInsert() {
    if (!this.ctx || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  // Brass shell casing bouncing on metal/wood table
  playShellBounce() {
    if (!this.ctx || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.12;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1200 + i * 250, t);
      osc.frequency.exponentialRampToValueAtTime(700, t + 0.05);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25 / (i + 1), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.08);
    }
  }

  // Beer can crack and fizz
  playBeerOpen() {
    if (!this.ctx || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.04);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.06);

    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.45), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(3200, now);
    const fg = ctx.createGain();
    fg.gain.setValueAtTime(0.35, now + 0.02);
    fg.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    noise.connect(filter); filter.connect(fg); fg.connect(ctx.destination);
    noise.start(now + 0.02);
  }

  // Lighter flick & cigarette puff
  playCigarette() {
    if (!this.ctx || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.exponentialRampToValueAtTime(350, now + 0.03);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.05);

    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.65), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.18;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1800, now);
    const fg = ctx.createGain();
    fg.gain.setValueAtTime(0.01, now);
    fg.gain.linearRampToValueAtTime(0.22, now + 0.2);
    fg.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    noise.connect(filter); filter.connect(fg); fg.connect(ctx.destination);
    noise.start(now + 0.05);
  }

  // Handcuff ratchet
  playCuffs() {
    if (!this.ctx || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.07;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(1900 + i * 200, t);
      osc.frequency.exponentialRampToValueAtTime(450, t + 0.04);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.06);
    }
  }

  // Saw rasping teeth
  playSaw() {
    if (!this.ctx || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.18;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(340, t);
      osc.frequency.linearRampToValueAtTime(680, t + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + 0.14);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.15);
    }
  }

  // Magnifier glass ting
  playMagnifier() {
    if (!this.ctx || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(2800, now);
    osc.frequency.exponentialRampToValueAtTime(1500, now + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.4);
  }

  // Defibrillator / Heartbeat ECG beep
  playHeartbeat(isFast = false) {
    if (!this.ctx || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(isFast ? 1100 : 900, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.1);
  }

  // Heavy metal sliding blast door
  playDoorOpen() {
    if (!this.ctx || this.isMuted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.linearRampToValueAtTime(60, now + 1.2);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(360, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.38, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + 1.3);
    osc.connect(filter); filter.connect(g); g.connect(ctx.destination);
    osc.start(now); osc.stop(now + 1.4);
  }
}

export const sounds = new SoundEngine();
