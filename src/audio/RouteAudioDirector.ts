type RouteRegion = "caelus" | "windscar" | "foundry";

export class RouteAudioDirector {
  private readonly game: any;
  private context: AudioContext | null = null;
  private foundryGain: GainNode | null = null;
  private lastRegion: RouteRegion | null = null;
  private accumulator = 0;

  constructor(game: any) {
    this.game = game;
    const unlock = (): void => this.unlock();
    window.addEventListener("pointerdown", unlock, { once: true, capture: true });
    window.addEventListener("keydown", unlock, { once: true, capture: true });

    game.world.scene.onBeforeRenderObservable.add(() => {
      this.accumulator += Math.min(0.1, game.world.engine.getDeltaTime() / 1000);
      if (this.accumulator < 0.25) return;
      this.accumulator = 0;
      this.updateRegion();
    });
  }

  private unlock(): void {
    if (this.context) {
      void this.context.resume();
      return;
    }
    const AudioContextClass = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 190;
    filter.Q.value = 0.8;
    filter.connect(master);

    const fundamental = context.createOscillator();
    fundamental.type = "sine";
    fundamental.frequency.value = 41;
    const fundamentalGain = context.createGain();
    fundamentalGain.gain.value = 0.48;
    fundamental.connect(fundamentalGain).connect(filter);

    const harmonic = context.createOscillator();
    harmonic.type = "triangle";
    harmonic.frequency.value = 82.5;
    const harmonicGain = context.createGain();
    harmonicGain.gain.value = 0.11;
    harmonic.connect(harmonicGain).connect(filter);

    const pulse = context.createOscillator();
    pulse.type = "sine";
    pulse.frequency.value = 0.18;
    const pulseDepth = context.createGain();
    pulseDepth.gain.value = 0.018;
    pulse.connect(pulseDepth).connect(master.gain);

    fundamental.start();
    harmonic.start();
    pulse.start();
    this.context = context;
    this.foundryGain = master;
    void context.resume();
    this.updateRegion(true);
  }

  private updateRegion(force = false): void {
    const position = this.game.player.position();
    const region: RouteRegion = Math.abs(position.x - 475) < 78 && position.z < -438
      ? "foundry"
      : Math.abs(position.x) < 138 && position.z > 12 && position.z < 214
        ? "caelus"
        : "windscar";
    if (!force && region === this.lastRegion) return;
    this.lastRegion = region;

    this.game.audio.setAmbience(region === "caelus" ? "caelus" : "windscar");
    if (!this.context || !this.foundryGain) return;
    const now = this.context.currentTime;
    this.foundryGain.gain.cancelScheduledValues(now);
    this.foundryGain.gain.setTargetAtTime(region === "foundry" ? 0.035 : 0, now, 0.65);
  }
}
