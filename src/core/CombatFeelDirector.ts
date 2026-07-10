interface DamageLabel {
  element: HTMLDivElement;
  worldPosition: any;
  age: number;
  duration: number;
}

interface StaggerPulse {
  enemy: any;
  age: number;
  duration: number;
  originalScaling: any;
  originalRotationZ: number;
  heavy: boolean;
}

interface TrailPair {
  mesh: any;
  emitter: any;
  running: boolean;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export class CombatFeelDirector {
  private readonly scene: any;
  private readonly player: any;
  private readonly enemies: any[];
  private readonly camera: any;
  private readonly damageLayer: HTMLDivElement;
  private readonly comboElement: HTMLDivElement;
  private readonly comboCount: HTMLElement;
  private readonly comboText: HTMLElement;
  private readonly comboBar: HTMLElement;
  private readonly flashElement: HTMLDivElement;
  private readonly healthSnapshot = new Map<any, number>();
  private readonly labels: DamageLabel[] = [];
  private readonly staggers: StaggerPulse[] = [];
  private readonly trails: TrailPair[] = [];
  private readonly originalUpdate: (delta: number) => void;
  private hitStop = 0;
  private impactPunch = 0;
  private combo = 0;
  private displayedCombo = -1;
  private comboTimer = 0;
  private comboDuration = 2.35;
  private lastStamina = 100;

  constructor(private readonly game: any, private readonly engine: any) {
    this.scene = game.world.scene;
    this.player = game.player;
    this.enemies = game.enemies;
    this.camera = game.world.camera;
    this.originalUpdate = game.update.bind(game);

    this.installStyles();
    this.damageLayer = document.createElement("div");
    this.damageLayer.className = "combat-damage-layer";
    this.comboElement = document.createElement("div");
    this.comboElement.className = "combat-combo";
    this.comboElement.innerHTML = "<small>RIFTGLASS FLOW</small><strong>0</strong><span>confirmed strike</span><i></i>";
    this.comboCount = this.requiredElement<HTMLElement>(this.comboElement, "strong");
    this.comboText = this.requiredElement<HTMLElement>(this.comboElement, "span");
    this.comboBar = this.requiredElement<HTMLElement>(this.comboElement, "i");
    this.flashElement = document.createElement("div");
    this.flashElement.className = "combat-impact-flash";
    document.body.append(this.damageLayer, this.comboElement, this.flashElement);

    for (const enemy of this.enemies) this.healthSnapshot.set(enemy, Number(enemy.health ?? 0));
    this.lastStamina = Number(this.player.stamina ?? 100);
    this.createSwordTrails();
    this.installHitStopWrapper();
    this.scene.onBeforeRenderObservable.add(() => this.update());
  }

  private requiredElement<T extends HTMLElement>(root: ParentNode, selector: string): T {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing combat UI element ${selector}`);
    return element;
  }

  private installHitStopWrapper(): void {
    this.game.update = (delta: number): void => {
      if (this.hitStop > 0) {
        this.hitStop = Math.max(0, this.hitStop - delta);
        this.originalUpdate(Math.min(0.0015, delta * 0.06));
        return;
      }
      this.originalUpdate(delta);
    };
  }

  private createSwordTrails(): void {
    if (!BABYLON.TrailMesh) return;
    const material = new BABYLON.StandardMaterial("warden-combat-trail-material", this.scene);
    material.disableLighting = true;
    material.emissiveColor = BABYLON.Color3.FromHexString("#8ef7ff");
    material.diffuseColor = BABYLON.Color3.Black();
    material.alpha = 0.58;
    material.backFaceCulling = false;

    const create = (name: string, parent: any, y: number): void => {
      if (!parent) return;
      const emitter = BABYLON.MeshBuilder.CreateSphere(`${name}-emitter`, {
        diameter: 0.035,
        segments: 4
      }, this.scene);
      emitter.isVisible = false;
      emitter.isPickable = false;
      emitter.parent = parent;
      emitter.position = new BABYLON.Vector3(0, y, 0);
      const trail = new BABYLON.TrailMesh(name, emitter, this.scene, 0.11, 22, false);
      trail.material = material;
      trail.isPickable = false;
      trail.visibility = 0;
      this.trails.push({ mesh: trail, emitter, running: false });
    };

    create("warden-third-person-trail", this.player.visual?.sword, 2.05);
    create("warden-first-person-trail", this.player.fpSword, 2.05);
  }

  private update(): void {
    const delta = Math.min(0.05, Math.max(0.001, Number(this.engine.getDeltaTime?.() ?? 16.7) / 1000));
    this.detectDamage();
    this.detectGuardImpact();
    this.updateTrails();
    this.updateStaggers(delta);
    this.updateDamageLabels(delta);
    this.updateCombo(delta);
    this.updateCameraPunch(delta);
  }

  private detectDamage(): void {
    for (const enemy of this.enemies) {
      const previous = this.healthSnapshot.get(enemy) ?? Number(enemy.health ?? 0);
      const current = Number(enemy.health ?? 0);
      if (current < previous) {
        const damage = Math.max(1, Math.round(previous - current));
        const heavy = this.player.attack === "heavy" || damage >= 40;
        this.confirmHit(enemy, damage, heavy);
      }
      this.healthSnapshot.set(enemy, current);
    }
  }

  private detectGuardImpact(): void {
    const stamina = Number(this.player.stamina ?? 0);
    const spent = this.lastStamina - stamina;
    if (this.player.blocking && spent > 2.2) {
      this.hitStop = Math.max(this.hitStop, 0.032);
      this.impactPunch = Math.max(this.impactPunch, 0.16);
      this.flashElement.classList.remove("guard", "light", "heavy");
      void this.flashElement.offsetWidth;
      this.flashElement.classList.add("guard");
    }
    this.lastStamina = stamina;
  }

  private confirmHit(enemy: any, damage: number, heavy: boolean): void {
    this.hitStop = Math.max(this.hitStop, heavy ? 0.078 : 0.044);
    this.impactPunch = Math.max(this.impactPunch, heavy ? 0.54 : 0.28);
    this.combo += 1;
    this.comboDuration = heavy ? 2.8 : 2.35;
    this.comboTimer = this.comboDuration;
    this.spawnDamageLabel(enemy.root.position.add(new BABYLON.Vector3(0, heavy ? 1.65 : 1.3, 0)), damage, heavy);
    this.startStagger(enemy, heavy);

    this.flashElement.classList.remove("guard", "light", "heavy");
    void this.flashElement.offsetWidth;
    this.flashElement.classList.add(heavy ? "heavy" : "light");
  }

  private startStagger(enemy: any, heavy: boolean): void {
    const existing = this.staggers.find((entry) => entry.enemy === enemy);
    if (existing) {
      existing.age = 0;
      existing.duration = heavy ? 0.2 : 0.13;
      existing.heavy = heavy;
      return;
    }
    this.staggers.push({
      enemy,
      age: 0,
      duration: heavy ? 0.2 : 0.13,
      originalScaling: enemy.root.scaling.clone(),
      originalRotationZ: Number(enemy.root.rotation?.z ?? 0),
      heavy
    });
  }

  private updateStaggers(delta: number): void {
    for (let index = this.staggers.length - 1; index >= 0; index -= 1) {
      const pulse = this.staggers[index];
      if (!pulse.enemy?.root || pulse.enemy.root.isDisposed?.()) {
        this.staggers.splice(index, 1);
        continue;
      }
      pulse.age += delta;
      const progress = clamp01(pulse.age / pulse.duration);
      const snap = Math.sin(progress * Math.PI);
      const scale = 1 + snap * (pulse.heavy ? 0.12 : 0.065);
      pulse.enemy.root.scaling.copyFrom(pulse.originalScaling.scale(scale));
      pulse.enemy.root.rotation.z = pulse.originalRotationZ + Math.sin(progress * Math.PI * 2) * (pulse.heavy ? 0.085 : 0.045);
      if (progress >= 1) {
        pulse.enemy.root.scaling.copyFrom(pulse.originalScaling);
        pulse.enemy.root.rotation.z = pulse.originalRotationZ;
        this.staggers.splice(index, 1);
      }
    }
  }

  private updateTrails(): void {
    const attack = this.player.attack as string | null;
    const duration = attack === "heavy" ? 1.02 : 0.62;
    const progress = attack ? clamp01(Number(this.player.attackTime ?? 0) / duration) : 0;
    const active = attack !== null
      && progress >= (attack === "heavy" ? 0.24 : 0.18)
      && progress <= (attack === "heavy" ? 0.74 : 0.7);

    this.trails.forEach((trail, index) => {
      const correctView = index === 0 ? this.player.cameraMode === "third" : this.player.cameraMode === "first";
      const shouldRun = active && correctView;
      if (shouldRun && !trail.running) {
        trail.mesh.reset?.();
        trail.mesh.start?.();
        trail.running = true;
      } else if (!shouldRun && trail.running) {
        trail.mesh.stop?.();
        trail.mesh.reset?.();
        trail.running = false;
      }
      trail.mesh.visibility = shouldRun ? (attack === "heavy" ? 0.82 : 0.62) : 0;
    });
  }

  private spawnDamageLabel(position: any, damage: number, heavy: boolean): void {
    const element = document.createElement("div");
    element.className = `combat-damage-number ${heavy ? "heavy" : "light"}`;
    element.textContent = `${damage}`;
    this.damageLayer.appendChild(element);
    this.labels.push({
      element,
      worldPosition: position.clone(),
      age: 0,
      duration: heavy ? 0.82 : 0.66
    });
  }

  private updateDamageLabels(delta: number): void {
    const width = this.engine.getRenderWidth();
    const height = this.engine.getRenderHeight();
    const canvas = this.engine.getRenderingCanvas?.() as HTMLCanvasElement | null;
    const cssScaleX = Number(canvas?.clientWidth ?? width) / Math.max(1, width);
    const cssScaleY = Number(canvas?.clientHeight ?? height) / Math.max(1, height);
    const viewport = this.camera.viewport.toGlobal(width, height);
    const transform = this.scene.getTransformMatrix();

    for (let index = this.labels.length - 1; index >= 0; index -= 1) {
      const label = this.labels[index];
      label.age += delta;
      const progress = clamp01(label.age / label.duration);
      const projected = BABYLON.Vector3.Project(
        label.worldPosition,
        BABYLON.Matrix.Identity(),
        transform,
        viewport
      );
      const visible = projected.z > 0 && projected.z < 1;
      label.element.style.display = visible ? "block" : "none";
      label.element.style.left = `${projected.x * cssScaleX}px`;
      label.element.style.top = `${projected.y * cssScaleY - progress * 38}px`;
      label.element.style.opacity = `${1 - progress}`;
      label.element.style.transform = `translate(-50%, -50%) scale(${1 + Math.sin(progress * Math.PI) * 0.24})`;
      if (progress >= 1) {
        label.element.remove();
        this.labels.splice(index, 1);
      }
    }
  }

  private updateCombo(delta: number): void {
    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - delta);
      this.comboElement.classList.add("visible");
      if (this.displayedCombo !== this.combo) {
        this.displayedCombo = this.combo;
        this.comboCount.textContent = `${this.combo}`;
        this.comboText.textContent = this.combo === 1 ? "confirmed strike" : "linked strikes";
      }
      this.comboBar.style.transform = `scaleX(${clamp01(this.comboTimer / this.comboDuration)})`;
      return;
    }
    this.combo = 0;
    this.displayedCombo = -1;
    this.comboElement.classList.remove("visible");
  }

  private updateCameraPunch(delta: number): void {
    const baseDegrees = Number(this.game.quests?.save?.settings?.fov ?? 75);
    const base = BABYLON.Tools.ToRadians(baseDegrees);
    const attack = this.player.attack as string | null;
    const attackPunch = attack === "heavy" ? 0.025 : attack === "light" ? 0.012 : 0;
    const target = base * (1 - attackPunch - this.impactPunch * 0.028);
    this.camera.fov = BABYLON.Scalar.Lerp(this.camera.fov, target, Math.min(1, delta * 18));
    this.impactPunch = Math.max(0, this.impactPunch - delta * 4.8);
  }

  private installStyles(): void {
    if (document.getElementById("combat-feel-styles")) return;
    const style = document.createElement("style");
    style.id = "combat-feel-styles";
    style.textContent = `
      .combat-damage-layer{position:fixed;inset:0;z-index:45;pointer-events:none;overflow:hidden}.combat-damage-number{position:absolute;font:800 22px/1 Inter,system-ui,sans-serif;letter-spacing:.03em;text-shadow:0 2px 8px #000,0 0 12px currentColor;will-change:transform,opacity}.combat-damage-number.light{color:#a9f7ff}.combat-damage-number.heavy{color:#fff2b1;font-size:30px}.combat-combo{position:fixed;z-index:42;right:26px;bottom:112px;display:grid;grid-template-columns:auto auto;align-items:end;gap:0 10px;min-width:160px;padding:12px 14px 10px;border:1px solid #8bead34a;border-radius:12px;background:linear-gradient(120deg,#071318e8,#10302ce2);box-shadow:0 16px 38px #0008;opacity:0;transform:translateX(18px);transition:.18s;pointer-events:none;color:#e9fff8;overflow:hidden}.combat-combo.visible{opacity:1;transform:none}.combat-combo small{grid-column:1/-1;color:#70dabb;font-size:8px;font-weight:800;letter-spacing:.17em}.combat-combo strong{font:800 34px/1 Georgia,serif;color:#caffee}.combat-combo span{padding-bottom:3px;color:#91aaa2;font-size:10px}.combat-combo i{position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,#45caa0,#b4ffea);transform-origin:left center}.combat-impact-flash{position:fixed;inset:0;z-index:41;pointer-events:none;opacity:0}.combat-impact-flash.light{animation:combat-light-flash .12s ease-out}.combat-impact-flash.heavy{animation:combat-heavy-flash .18s ease-out}.combat-impact-flash.guard{animation:combat-guard-flash .14s ease-out}@keyframes combat-light-flash{0%{opacity:.2;box-shadow:inset 0 0 85px #5bf0ff55}100%{opacity:0}}@keyframes combat-heavy-flash{0%{opacity:.34;box-shadow:inset 0 0 130px #f5f0bd66}100%{opacity:0}}@keyframes combat-guard-flash{0%{opacity:.27;box-shadow:inset 0 0 95px #7cb7ff55}100%{opacity:0}}@media(max-width:720px){.combat-combo{right:12px;bottom:96px;transform:scale(.9);transform-origin:right bottom}.combat-combo.visible{transform:scale(.9)}}`;
    document.head.appendChild(style);
  }
}
