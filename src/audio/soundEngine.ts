class CricketSoundEngine {
  private ctx: AudioContext | null = null;
  private masterBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted: boolean = false;

  // Ambient playing soundscape nodes
  private ambientActive: boolean = false;
  private ambientSource: AudioBufferSourceNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientLfo: OscillatorNode | null = null;
  private shouldPlayAmbient: boolean = false;

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) {
      this.stopAmbientNodes();
    } else if (this.shouldPlayAmbient) {
      this.startAmbientNodes();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setPlayingAmbient(playing: boolean) {
    this.shouldPlayAmbient = playing;
    if (playing && !this.muted) {
      this.startAmbientNodes();
    } else {
      this.stopAmbientNodes();
    }
  }

  public unlock() {
    if (typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.setupMasterBus();
      this.createNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        if (this.shouldPlayAmbient && !this.muted && !this.ambientActive) {
          this.startAmbientNodes();
        }
      }).catch(() => {});
    } else if (this.shouldPlayAmbient && !this.muted && !this.ambientActive) {
      this.startAmbientNodes();
    }
  }

  private setupMasterBus() {
    if (!this.ctx) return;
    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
    compressor.knee.setValueAtTime(14, this.ctx.currentTime);
    compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
    compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    compressor.release.setValueAtTime(0.18, this.ctx.currentTime);

    const master = this.ctx.createGain();
    master.gain.setValueAtTime(1.35, this.ctx.currentTime);

    master.connect(compressor);
    compressor.connect(this.ctx.destination);
    this.masterBus = master;
  }

  private getOutputNode(ctx: AudioContext): AudioNode {
    return this.masterBus ?? ctx.destination;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    this.unlock();
    if (!this.ctx || this.ctx.state === 'suspended') return null;
    return this.ctx;
  }

  private createNoiseBuffer() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 3;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    // Warm pink-ish noise approximation for natural crowd acoustics
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.16));
      b6 = white * 0.115926;
    }
    this.noiseBuffer = buffer;
  }

  private startAmbientNodes() {
    if (this.muted || this.ambientActive) return;
    if (!this.ctx || !this.noiseBuffer) return;
    if (this.ctx.state === 'suspended') return;

    try {
      const now = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(640, now);
      filter.Q.value = 0.65;

      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.24, now);
      lfoGain.gain.setValueAtTime(0.02, now);

      const ambGain = this.ctx.createGain();
      ambGain.gain.setValueAtTime(0.001, now);
      ambGain.gain.linearRampToValueAtTime(0.075, now + 0.5);

      lfo.connect(lfoGain);
      lfoGain.connect(ambGain.gain);

      src.connect(filter);
      filter.connect(ambGain);
      ambGain.connect(this.getOutputNode(this.ctx));

      src.start(now);
      lfo.start(now);

      this.ambientSource = src;
      this.ambientGain = ambGain;
      this.ambientLfo = lfo;
      this.ambientActive = true;
    } catch {
      this.ambientActive = false;
    }
  }

  private stopAmbientNodes() {
    if (!this.ambientActive) return;
    try {
      if (this.ambientSource) {
        this.ambientSource.stop();
        this.ambientSource.disconnect();
      }
      if (this.ambientLfo) {
        this.ambientLfo.stop();
        this.ambientLfo.disconnect();
      }
      if (this.ambientGain) {
        this.ambientGain.disconnect();
      }
    } catch {
      // Ignore already-stopped nodes
    }
    this.ambientSource = null;
    this.ambientLfo = null;
    this.ambientGain = null;
    this.ambientActive = false;
  }

  public playUiClick() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.05);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(this.getOutputNode(ctx));
    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playBowlRelease() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.08);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(this.getOutputNode(ctx));
    osc.start(now);
    osc.stop(now + 0.095);
  }

  public playPitchBounce() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(155, now);
    osc.frequency.exponentialRampToValueAtTime(56, now + 0.085);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    osc.connect(gain);
    gain.connect(this.getOutputNode(ctx));
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playBatSwoosh() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(340, now);
    filter.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
    filter.frequency.exponentialRampToValueAtTime(440, now + 0.16);
    filter.Q.value = 1.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.045);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.getOutputNode(ctx));
    src.start(now);
    src.stop(now + 0.18);
  }

  public playBatHit(power: 'SWEET' | 'GOOD' | 'EDGE') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getOutputNode(ctx);

    // 1. Punchy willow wood body crack
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = power === 'EDGE' ? 'triangle' : 'sine';
    const startFreq = power === 'SWEET' ? 430 : power === 'GOOD' ? 340 : 540;
    const endFreq = power === 'SWEET' ? 110 : power === 'GOOD' ? 95 : 220;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.08);

    const vol = power === 'SWEET' ? 0.58 : power === 'GOOD' ? 0.38 : 0.24;
    oscGain.gain.setValueAtTime(vol, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    osc.connect(oscGain);
    oscGain.connect(out);
    osc.start(now);
    osc.stop(now + 0.1);

    // 2. Crisp leather-on-willow snap transient
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const hp = ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.setValueAtTime(power === 'SWEET' ? 2700 : 1900, now);
      hp.Q.value = 1.2;

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(power === 'SWEET' ? 0.56 : 0.32, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

      noise.connect(hp);
      hp.connect(nGain);
      nGain.connect(out);
      noise.start(now);
      noise.stop(now + 0.06);
    }

    // 3. Sweet-spot bright ring + instant crowd anticipation "OHHH!" swell on clean hits
    if (power === 'SWEET' || power === 'GOOD') {
      const ping = ctx.createOscillator();
      const pingGain = ctx.createGain();
      ping.type = 'triangle';
      ping.frequency.setValueAtTime(power === 'SWEET' ? 920 : 720, now);
      ping.frequency.exponentialRampToValueAtTime(power === 'SWEET' ? 1420 : 1020, now + 0.06);
      pingGain.gain.setValueAtTime(power === 'SWEET' ? 0.18 : 0.1, now);
      pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      ping.connect(pingGain);
      pingGain.connect(out);
      ping.start(now);
      ping.stop(now + 0.12);

      // Crowd excitement gasp/cheer right after bat impact!
      this.playHitAnticipationSwell(power === 'SWEET' ? 0.55 : 0.35, power === 'SWEET' ? 0.24 : 0.14);
    }
  }

  private playHitAnticipationSwell(duration: number, peakGain: number) {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime + 0.03;
    const out = this.getOutputNode(ctx);

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(760, now);
    bp.frequency.linearRampToValueAtTime(1650, now + duration);
    bp.Q.value = 0.8;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(peakGain, now + duration * 0.4);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(bp);
    bp.connect(g);
    g.connect(out);
    src.start(now);
    src.stop(now + duration + 0.04);

    // Sweet excited crowd "OOOH!" rise
    const whoop = ctx.createOscillator();
    const wGain = ctx.createGain();
    whoop.type = 'triangle';
    whoop.frequency.setValueAtTime(440, now);
    whoop.frequency.exponentialRampToValueAtTime(698, now + duration * 0.75);
    wGain.gain.setValueAtTime(0.001, now);
    wGain.gain.linearRampToValueAtTime(peakGain * 0.35, now + duration * 0.35);
    wGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    whoop.connect(wGain);
    wGain.connect(out);
    whoop.start(now);
    whoop.stop(now + duration + 0.02);
  }

  public playRunStep(stepIndex: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getOutputNode(ctx);

    // 1. Punchy running spike/shoe thud on pitch clay (alternating left/right foot)
    const stepOsc = ctx.createOscillator();
    const stepGain = ctx.createGain();
    stepOsc.type = 'sine';
    const baseFreq = stepIndex % 2 === 0 ? 190 : 220;
    stepOsc.frequency.setValueAtTime(baseFreq, now);
    stepOsc.frequency.exponentialRampToValueAtTime(64, now + 0.065);
    stepGain.gain.setValueAtTime(0.36, now);
    stepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.072);
    stepOsc.connect(stepGain);
    stepGain.connect(out);
    stepOsc.start(now);
    stepOsc.stop(now + 0.08);

    // 2. Crisp pitch grit / grass sprint scuff on every stride
    if (this.noiseBuffer) {
      const scuff = ctx.createBufferSource();
      scuff.buffer = this.noiseBuffer;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(stepIndex % 2 === 0 ? 1450 : 1850, now);
      bp.frequency.exponentialRampToValueAtTime(820, now + 0.06);
      bp.Q.value = 1.1;

      const sGain = ctx.createGain();
      sGain.gain.setValueAtTime(0.28, now);
      sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.068);

      scuff.connect(bp);
      bp.connect(sGain);
      sGain.connect(out);
      scuff.start(now);
      scuff.stop(now + 0.075);
    }

    // 3. Quick sneaker/stride cadence tap so running is unmistakable
    const tap = ctx.createOscillator();
    const tGain = ctx.createGain();
    tap.type = 'triangle';
    tap.frequency.setValueAtTime(stepIndex % 2 === 0 ? 580 : 660, now);
    tap.frequency.exponentialRampToValueAtTime(340, now + 0.035);
    tGain.gain.setValueAtTime(0.09, now);
    tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.042);
    tap.connect(tGain);
    tGain.connect(out);
    tap.start(now);
    tap.stop(now + 0.048);
  }

  public playRunningAction(runs: 1 | 2 | 3) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getOutputNode(ctx);

    // 1. Upbeat rising run chime
    const notes = runs === 3 ? [587.33, 739.99, 880] : runs === 2 ? [587.33, 783.99] : [659.25, 880];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.075;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.17);
    });

    // 2. Crisp finishing sprinting footsteps into the crease
    const steps = runs * 2 + 1;
    for (let i = 0; i < steps; i++) {
      const t = now + i * 0.095;
      const stepOsc = ctx.createOscillator();
      const stepGain = ctx.createGain();
      stepOsc.type = 'sine';
      stepOsc.frequency.setValueAtTime(185 + (i % 2) * 32, t);
      stepOsc.frequency.exponentialRampToValueAtTime(64, t + 0.055);
      stepGain.gain.setValueAtTime(0.24, t);
      stepGain.gain.exponentialRampToValueAtTime(0.001, t + 0.062);
      stepOsc.connect(stepGain);
      stepGain.connect(out);
      stepOsc.start(t);
      stepOsc.stop(t + 0.068);
    }

    // 3. Sweet joyful crowd cheering & applause!
    this.playCrowdRoarAndShout(0.9 + runs * 0.22, 0.34 + runs * 0.06, 'RUN');
    this.playClapBurst(0.85 + runs * 0.15, 0.22, 12 + runs * 3);
  }

  public playFourCheer() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getOutputNode(ctx);

    // 1. LOUD stadium crowd roar + multi-voice shout ("YEEEAH!! FOUR!!")
    this.playCrowdRoarAndShout(1.85, 0.68, 'FOUR');

    // 2. Energetic stadium applause claps
    this.playClapBurst(1.6, 0.28, 22);

    // 3. Cheerful 3-note brassy triad fanfare
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }

  public playSixFanfare() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getOutputNode(ctx);

    // 1. MASSIVE stadium eruption: VERY LOUD roaring crowd + shouting chorus!
    this.playCrowdRoarAndShout(2.5, 0.92, 'SIX');

    // 2. Dense thunderous stadium clapping
    this.playClapBurst(2.2, 0.36, 32);

    // 3. Double stadium air-horn blast + 4-note victory arpeggio
    [0, 0.22].forEach((offset) => {
      const t = now + offset;
      const horn1 = ctx.createOscillator();
      const horn2 = ctx.createOscillator();
      const hornFilter = ctx.createBiquadFilter();
      const hornGain = ctx.createGain();

      horn1.type = 'sawtooth';
      horn2.type = 'sawtooth';
      horn1.frequency.setValueAtTime(392, t);
      horn2.frequency.setValueAtTime(523.25, t);

      hornFilter.type = 'lowpass';
      hornFilter.frequency.setValueAtTime(1900, t);

      hornGain.gain.setValueAtTime(0.001, t);
      hornGain.gain.linearRampToValueAtTime(0.14, t + 0.025);
      hornGain.gain.exponentialRampToValueAtTime(0.001, t + (offset === 0 ? 0.18 : 0.48));

      horn1.connect(hornFilter);
      horn2.connect(hornFilter);
      hornFilter.connect(hornGain);
      hornGain.connect(out);
      horn1.start(t);
      horn2.start(t);
      horn1.stop(t + 0.5);
      horn2.stop(t + 0.5);
    });

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.075;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === notes.length - 1 ? 'sawtooth' : 'triangle';

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2800;

      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(idx === notes.length - 1 ? 0.2 : 0.22, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (idx === notes.length - 1 ? 0.65 : 0.3));

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.7);
    });
  }

  public playMilestoneFanfare() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getOutputNode(ctx);
    this.playCrowdRoarAndShout(2.4, 0.78, 'SIX');
    const notes = [587.33, 739.99, 880, 1174.66];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.48);
    });
  }

  public playWicketShatter() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getOutputNode(ctx);

    [0, 0.045, 0.11].forEach((offset, i) => {
      const t = now + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(480 - i * 85, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.07);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.085);
    });

    this.playCrowdGasp(0.85, 0.28);

    const sad = ctx.createOscillator();
    const sadGain = ctx.createGain();
    sad.type = 'triangle';
    sad.frequency.setValueAtTime(360, now + 0.18);
    sad.frequency.exponentialRampToValueAtTime(165, now + 0.65);
    sadGain.gain.setValueAtTime(0.001, now + 0.18);
    sadGain.gain.linearRampToValueAtTime(0.18, now + 0.24);
    sadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);
    sad.connect(sadGain);
    sadGain.connect(out);
    sad.start(now + 0.18);
    sad.stop(now + 0.7);
  }

  public playCaughtOut() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const out = this.getOutputNode(ctx);

    const thump = ctx.createOscillator();
    const tGain = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(220, now);
    thump.frequency.exponentialRampToValueAtTime(80, now + 0.08);
    tGain.gain.setValueAtTime(0.28, now);
    tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    thump.connect(tGain);
    tGain.connect(out);
    thump.start(now);
    thump.stop(now + 0.1);

    this.playCrowdGasp(0.8, 0.25);

    [392, 293.66].forEach((freq, idx) => {
      const t = now + 0.14 + idx * 0.16;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  private playCrowdRoarAndShout(
    duration: number,
    peakGain: number,
    intensity: 'RUN' | 'FOUR' | 'SIX'
  ) {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const out = this.getOutputNode(ctx);

    // Layer A: Bright, airy, ecstatic stadium crowd cheer swell (no muddy harshness)
    const roarSrc = ctx.createBufferSource();
    roarSrc.buffer = this.noiseBuffer;

    const roarFilter = ctx.createBiquadFilter();
    roarFilter.type = 'bandpass';
    roarFilter.frequency.setValueAtTime(920, now);
    roarFilter.frequency.linearRampToValueAtTime(
      intensity === 'SIX' ? 2150 : intensity === 'FOUR' ? 1780 : 1420,
      now + duration * 0.2
    );
    roarFilter.frequency.linearRampToValueAtTime(960, now + duration);
    roarFilter.Q.value = 0.48;

    const roarGain = ctx.createGain();
    roarGain.gain.setValueAtTime(0.001, now);
    roarGain.gain.linearRampToValueAtTime(peakGain, now + 0.06);
    roarGain.gain.setValueAtTime(peakGain * 0.86, now + duration * 0.42);
    roarGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    roarSrc.connect(roarFilter);
    roarFilter.connect(roarGain);
    roarGain.connect(out);
    roarSrc.start(now);
    roarSrc.stop(now + duration + 0.05);

    // Layer B: Sweet, joyful, major-harmonic chorus ("YAAAY!! WOO-HOO!!") with live vibrato
    const voices =
      intensity === 'SIX'
        ? [392.0, 493.88, 523.25, 659.25, 783.99, 880.0, 987.77]
        : intensity === 'FOUR'
        ? [392.0, 493.88, 523.25, 659.25, 783.99]
        : [440.0, 523.25, 659.25];

    const formant1 = ctx.createBiquadFilter();
    formant1.type = 'bandpass';
    formant1.frequency.setValueAtTime(760, now);
    formant1.frequency.linearRampToValueAtTime(1060, now + 0.22);
    formant1.frequency.linearRampToValueAtTime(840, now + duration * 0.85);
    formant1.Q.value = 1.6;

    const formant2 = ctx.createBiquadFilter();
    formant2.type = 'bandpass';
    formant2.frequency.setValueAtTime(1750, now);
    formant2.frequency.linearRampToValueAtTime(2480, now + 0.24);
    formant2.Q.value = 1.8;

    const shoutGain = ctx.createGain();
    const shoutVol = intensity === 'SIX' ? 0.28 : intensity === 'FOUR' ? 0.22 : 0.13;
    shoutGain.gain.setValueAtTime(0.001, now);
    shoutGain.gain.linearRampToValueAtTime(shoutVol, now + 0.06);
    shoutGain.gain.setValueAtTime(shoutVol * 0.84, now + duration * 0.35);
    shoutGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.9);

    formant1.connect(shoutGain);
    formant2.connect(shoutGain);
    shoutGain.connect(out);

    // Shared sweet vibrato LFO so voices shimmer with ecstatic happiness
    const vibLfo = ctx.createOscillator();
    const vibDepth = ctx.createGain();
    vibLfo.type = 'sine';
    vibLfo.frequency.setValueAtTime(6.8, now);
    vibDepth.gain.setValueAtTime(11, now);
    vibLfo.connect(vibDepth);
    vibLfo.start(now);
    vibLfo.stop(now + duration);

    voices.forEach((baseFreq, i) => {
      const osc = ctx.createOscillator();
      // Sweet warm triangle & sine tones (no harsh low buzz)
      osc.type = i % 2 === 0 ? 'triangle' : 'sine';
      const pitchRise = intensity === 'SIX' ? 1.26 : intensity === 'FOUR' ? 1.18 : 1.12;
      const stagger = (i % 3) * 0.025;
      osc.frequency.setValueAtTime(baseFreq * 0.92, now + stagger);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * pitchRise, now + 0.19 + stagger);
      osc.frequency.linearRampToValueAtTime(baseFreq * 1.04, now + duration * 0.85);
      vibDepth.connect(osc.frequency);
      osc.connect(formant1);
      osc.connect(formant2);
      osc.start(now + stagger);
      osc.stop(now + duration * 0.92);
    });

    // Layer C: Staggered sweet ecstatic fan whoops ("WOO-HOO!! / YAAAY!!") going wild with joy
    const whoopCount = intensity === 'SIX' ? 7 : intensity === 'FOUR' ? 4 : 2;
    const whoopScale = [523.25, 587.33, 659.25, 783.99, 880.0];
    for (let w = 0; w < whoopCount; w++) {
      const t = now + 0.04 + w * (duration * 0.72 / whoopCount) + Math.random() * 0.04;
      const startF = whoopScale[w % whoopScale.length];
      const peakF = startF * (1.42 + (w % 2) * 0.16);
      const wDur = 0.28 + Math.random() * 0.14;

      const wOsc = ctx.createOscillator();
      const wGain = ctx.createGain();
      wOsc.type = w % 2 === 0 ? 'sine' : 'triangle';

      wOsc.frequency.setValueAtTime(startF, t);
      wOsc.frequency.exponentialRampToValueAtTime(peakF, t + wDur * 0.45);
      wOsc.frequency.exponentialRampToValueAtTime(peakF * 0.86, t + wDur);

      const wPeak = intensity === 'SIX' ? 0.11 : intensity === 'FOUR' ? 0.085 : 0.06;
      wGain.gain.setValueAtTime(0.001, t);
      wGain.gain.linearRampToValueAtTime(wPeak, t + 0.045);
      wGain.gain.exponentialRampToValueAtTime(0.001, t + wDur);

      wOsc.connect(wGain);
      wGain.connect(out);
      wOsc.start(t);
      wOsc.stop(t + wDur + 0.02);
    }

    // Layer D: Happy celebration trill whistle for SIX (pure euphoria!)
    if (intensity === 'SIX') {
      const wt = now + 0.14;
      const whistle = ctx.createOscillator();
      const wTrill = ctx.createOscillator();
      const wTrillGain = ctx.createGain();
      const wOutGain = ctx.createGain();

      whistle.type = 'sine';
      whistle.frequency.setValueAtTime(2250, wt);
      whistle.frequency.linearRampToValueAtTime(2550, wt + 0.18);
      whistle.frequency.linearRampToValueAtTime(2350, wt + 0.42);

      wTrill.type = 'sine';
      wTrill.frequency.setValueAtTime(24, wt);
      wTrillGain.gain.setValueAtTime(110, wt);
      wTrill.connect(wTrillGain);
      wTrillGain.connect(whistle.frequency);

      wOutGain.gain.setValueAtTime(0.001, wt);
      wOutGain.gain.linearRampToValueAtTime(0.065, wt + 0.04);
      wOutGain.gain.exponentialRampToValueAtTime(0.001, wt + 0.45);

      whistle.connect(wOutGain);
      wOutGain.connect(out);
      wTrill.start(wt);
      whistle.start(wt);
      wTrill.stop(wt + 0.48);
      whistle.stop(wt + 0.48);
    }
  }

  private playClapBurst(duration: number, peakGain: number, count: number) {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const out = this.getOutputNode(ctx);

    for (let i = 0; i < count; i++) {
      const t = now + (i / count) * duration * 0.88 + Math.random() * 0.05;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1350 + Math.random() * 1500;
      bp.Q.value = 1.4;

      const g = ctx.createGain();
      g.gain.setValueAtTime(peakGain * (0.45 + Math.random() * 0.55), t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      src.connect(bp);
      bp.connect(g);
      g.connect(out);
      src.start(t);
      src.stop(t + 0.055);
    }
  }

  private playCrowdGasp(duration: number, peakGain: number) {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const out = this.getOutputNode(ctx);

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(980, now);
    filter.frequency.exponentialRampToValueAtTime(340, now + duration);
    filter.Q.value = 1.4;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    src.start(now);
    src.stop(now + duration + 0.05);
  }
}

export const soundEngine = new CricketSoundEngine();
