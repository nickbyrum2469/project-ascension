interface GeneratedAudioAsset {
  id: string;
  file: string;
  category: string;
  loop: boolean;
  volume: number;
}

interface GeneratedAudioManifest {
  assets: GeneratedAudioAsset[];
}

export type AmbienceRegion = "windscar" | "caelus";

export class AudioDirector {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: GainNode | null = null;
  private proceduralAmbience: GainNode | null = null;
  private generatedAmbienceSource: AudioBufferSourceNode | null = null;
  private generatedAmbienceGain: GainNode | null = null;
  private readonly samples = new Map<string, AudioBuffer>();
  private readonly sampleVolumes = new Map<string, number>();
  private nextFoot = 0;
  private packLoadStarted = false;
  private desiredAmbience = "windscar-ambience";

  public async unlock(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.34;
      this.master.connect(this.context.destination);
      this.createAmbience();
    }
    if (this.context.state === "suspended") await this.context.resume();
    if (!this.packLoadStarted) {
      this.packLoadStarted = true;
      void this.loadGeneratedPack();
    }
  }

  public setMuted(muted: boolean): void {
    if (!this.master || !this.context) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.34, this.context.currentTime, 0.04);
  }

  public setAmbience(region: AmbienceRegion): void {
    const next = region === "caelus" ? "caelus-reach-ambience" : "windscar-ambience";
    if (next === this.desiredAmbience) return;
    this.desiredAmbience = next;
    this.startGeneratedAmbience(next);
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
    const id = heavy ? "sword-heavy-swing" : "sword-light-swing";
    const played = this.playSample(id, heavy ? 0.86 : 0.78, heavy ? 0.96 : 1.03);
    if (played) return;
    this.noiseBurst(heavy ? 0.19 : 0.12, heavy ? 0.085 : 0.055, 380, heavy ? 1700 : 2400);
    this.tone(heavy ? 94 : 140, heavy ? 0.16 : 0.1, heavy ? 0.06 : 0.035, "sawtooth", heavy ? 55 : 90);
  }

  public impact(heavy = false): void {
    const played = this.playSample("riftglass-impact", heavy ? 0.95 : 0.78, heavy ? 0.91 : 1.06);
    if (played) return;
    this.noiseBurst(heavy ? 0.11 : 0.07, heavy ? 0.11 : 0.075, 90, 1300);
    this.tone(heavy ? 52 : 76, heavy ? 0.18 : 0.11, heavy ? 0.11 : 0.075, "triangle", 34);
    this.tone(heavy ? 980 : 1380, 0.035, 0.025, "square", 430);
  }

  public guard(): void {
    if (this.playSample("guard-clash", 0.9, 1)) return;
    this.tone(210, 0.12, 0.07, "square", 90);
    this.tone(1240, 0.05, 0.03, "triangle", 520);
  }

  public creatureCharge(): void {
    if (this.playSample("rift-boar-charge", 0.82, 1)) return;
    this.tone(82, 0.28, 0.055, "sawtooth", 49);
    this.noiseBurst(0.32, 0.04, 65, 520);
  }

  public damage(): void {
    this.noiseBurst(0.13, 0.1, 70, 650);
    this.tone(44, 0.21, 0.12, "sawtooth", 31);
  }

  public quest(): void {
    if (this.playSample("quest-thread-stinger", 0.68, 1)) return;
    [330, 440, 660, 880].forEach((frequency, index) => {
      window.setTimeout(() => this.tone(frequency, 0.13, 0.035, "sine", frequency * 1.06), index * 75);
    });
  }

  private async loadGeneratedPack(): Promise<void> {
    if (!this.context) return;
    try {
      const response = await fetch("./assets/audio/generated/audio-manifest.json", { cache: "force-cache" });
      if (!response.ok) return;
      const manifest = await response.json() as GeneratedAudioManifest;
      await Promise.all(manifest.assets.map(async (asset) => {
        const audioResponse = await fetch(asset.file, { cache: "force-cache" });
        if (!audioResponse.ok || !this.context) return;
        const buffer = await this.context.decodeAudioData(await audioResponse.arrayBuffer());
        this.samples.set(asset.id, buffer);
        this.sampleVolumes.set(asset.id, asset.volume);
      }));
      this.startGeneratedAmbience(this.desiredAmbience);
    } catch (error) {
      console.warn("Generated audio pack was unavailable; procedural audio remains active.", error);
    }
  }

  private startGeneratedAmbience(id: string): void {
    if (!this.context || !this.ambience) return;
    const buffer = this.samples.get(id);
    if (!buffer) return;

    const now = this.context.currentTime;
    if (this.generatedAmbienceGain) {
      this.generatedAmbienceGain.gain.cancelScheduledValues(now);
      this.generatedAmbienceGain.gain.setTargetAtTime(0.0001, now, 0.35);
    }
    if (this.generatedAmbienceSource) {
      const oldSource = this.generatedAmbienceSource;
      window.setTimeout(() => {
        try {
          oldSource.stop();
        } catch {
          // Source may already have ended.
        }
      }, 1400);
    }

    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.001, this.sampleVolumes.get(id) ?? 0.4),
      now + 1.6
    );
    source.connect(gain).connect(this.ambience);
    source.start();
    this.generatedAmbienceSource = source;
    this.generatedAmbienceGain = gain;
    this.proceduralAmbience?.gain.setTargetAtTime(0.018, now, 0.8);
  }

  private playSample(id: string, volume = 1, playbackRate = 1): boolean {
    if (!this.context || !this.master) return false;
    const buffer = this.samples.get(id);
    if (!buffer) return false;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    gain.gain.value = volume * (this.sampleVolumes.get(id) ?? 1);
    source.connect(gain).connect(this.master);
    source.start();
    return true;
  }

  private createAmbience(): void {
    if (!this.context || !this.master) return;
    const ctx = this.context;
    this.ambience = ctx.createGain();
    this.ambience.gain.value = 0.48;
    this.ambience.connect(this.master);

    this.proceduralAmbience = ctx.createGain();
    this.proceduralAmbience.gain.value = 0.08;
    this.proceduralAmbience.connect(this.ambience);

    const low = ctx.createOscillator();
    const lowGain = ctx.createGain();
    low.type = "sine";
    low.frequency.value = 39;
    lowGain.gain.value = 0.045;
    low.connect(lowGain).connect(this.proceduralAmbience);
    low.start();

    const harmonic = ctx.createOscillator();
    const harmonicGain = ctx.createGain();
    harmonic.type = "triangle";
    harmonic.frequency.value = 117;
    harmonicGain.gain.value = 0.012;
    harmonic.connect(harmonicGain).connect(this.proceduralAmbience);
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
