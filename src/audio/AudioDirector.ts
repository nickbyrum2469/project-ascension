export class AudioDirector {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: GainNode | null = null;
  private nextFoot = 0;

  public async unlock(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.34;
      this.master.connect(this.context.destination);
      this.createAmbience();
    }
    if (this.context.state === "suspended") await this.context.resume();
  }

  public setMuted(muted: boolean): void {
    if (!this.master || !this.context) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.34, this.context.currentTime, 0.04);
  }

  public uiConfirm(): void {
    this.tone(620, 0.06, 0.04, "sine", 980);
    window.setTimeout(() => this.tone(930, 0.08, 0.035, "sine", 1280), 45);
  }

  public uiHover(): void {
    this.tone(880, 0.025, 0.015, "sine", 1040);
  }

  public footstep(intensity = 1): void {
    if (!this.context || this.context.currentTime < this.nextFoot) return;
    this.nextFoot = this.context.currentTime + 0.18;
    this.noiseBurst(0.045, 0.03 * intensity, 180, 900);
    this.tone(72, 0.06, 0.025 * intensity, "triangle", 46);
  }

  public swordSwing(heavy = false): void {
    this.noiseBurst(heavy ? 0.19 : 0.12, heavy ? 0.085 : 0.055, 380, heavy ? 1700 : 2400);
    this.tone(heavy ? 94 : 140, heavy ? 0.16 : 0.1, heavy ? 0.06 : 0.035, "sawtooth", heavy ? 55 : 90);
  }

  public impact(heavy = false): void {
    this.noiseBurst(heavy ? 0.11 : 0.07, heavy ? 0.11 : 0.075, 90, 1300);
    this.tone(heavy ? 52 : 76, heavy ? 0.18 : 0.11, heavy ? 0.11 : 0.075, "triangle", 34);
    this.tone(heavy ? 980 : 1380, 0.035, 0.025, "square", 430);
  }

  public guard(): void {
    this.tone(210, 0.12, 0.07, "square", 90);
    this.tone(1240, 0.05, 0.03, "triangle", 520);
  }

  public damage(): void {
    this.noiseBurst(0.13, 0.1, 70, 650);
    this.tone(44, 0.21, 0.12, "sawtooth", 31);
  }

  public quest(): void {
    [330, 440, 660, 880].forEach((frequency, index) => {
      window.setTimeout(() => this.tone(frequency, 0.13, 0.035, "sine", frequency * 1.06), index * 75);
    });
  }

  private createAmbience(): void {
    if (!this.context || !this.master) return;
    const ctx = this.context;
    this.ambience = ctx.createGain();
    this.ambience.gain.value = 0.08;
    this.ambience.connect(this.master);

    const low = ctx.createOscillator();
    const lowGain = ctx.createGain();
    low.type = "sine";
    low.frequency.value = 39;
    lowGain.gain.value = 0.045;
    low.connect(lowGain).connect(this.ambience);
    low.start();

    const harmonic = ctx.createOscillator();
    const harmonicGain = ctx.createGain();
    harmonic.type = "triangle";
    harmonic.frequency.value = 117;
    harmonicGain.gain.value = 0.012;
    harmonic.connect(harmonicGain).connect(this.ambience);
    harmonic.start();

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 0.025;
    lfo.connect(lfoGain).connect(lowGain.gain);
    lfo.start();
  }

  private tone(
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    endFrequency = frequency
  ): void {
    if (!this.context || !this.master) return;
    const ctx = this.context;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration + 0.02);
  }

  private noiseBurst(duration: number, volume: number, lowCut: number, highCut: number): void {
    if (!this.context || !this.master) return;
    const ctx = this.context;
    const frameCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) {
      const envelope = 1 - index / frameCount;
      data[index] = (Math.random() * 2 - 1) * envelope;
    }
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const high = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    filter.type = "lowpass";
    filter.frequency.value = highCut;
    high.type = "highpass";
    high.frequency.value = lowCut;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter).connect(high).connect(gain).connect(this.master);
    source.start();
  }
}
