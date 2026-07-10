interface ImpactBurst {
  root: any;
  ring: any;
  shards: any[];
  directions: any[];
  age: number;
  duration: number;
  active: boolean;
}

interface RegionPresentation {
  id: string;
  kicker: string;
  title: string;
}

export class CombatPresentationDirector {
  private readonly game: any;
  private readonly world: any;
  private readonly scene: any;
  private readonly player: any;
  private readonly stance: HTMLElement;
  private readonly impactBursts: ImpactBurst[] = [];
  private readonly previousEnemyHealth = new Map<any, number>();
  private lastStance = "";
  private lastRegion = "";
  private elapsed = 0;

  constructor(game: any) {
    this.game = game;
    this.world = game.world;
    this.scene = game.world.scene;
    this.player = game.player;
    this.refinePlayerProportions();
    this.stance = this.createStanceIndicator();
    this.createImpactPool();
    for (const enemy of game.enemies) this.previousEnemyHealth.set(enemy, enemy.health);

    this.scene.onBeforeRenderObservable.add(() => {
      const delta = Math.min(0.05, Math.max(0.001, this.world.engine.getDeltaTime() / 1000));
      this.update(delta);
    });
  }

  private refinePlayerProportions(): void {
    const setScale = (name: string, x: number, y: number, z: number): void => {
      const mesh = this.scene.getMeshByName?.(name);
      if (mesh) mesh.scaling = new BABYLON.Vector3(x, y, z);
    };
    const setPosition = (name: string, x: number, y: number, z: number): void => {
      const mesh = this.scene.getMeshByName?.(name);
      if (mesh) mesh.position = new BABYLON.Vector3(x, y, z);
    };

    setScale("warden-left-upper-arm-mesh", 0.94, 1.06, 0.94);
    setScale("warden-right-upper-arm-mesh", 0.94, 1.06, 0.94);
    setScale("warden-left-forearm-mesh", 0.92, 1.08, 0.92);
    setScale("warden-right-forearm-mesh", 0.92, 1.08, 0.92);
    setScale("warden-left-thigh-mesh", 0.95, 1.06, 0.95);
    setScale("warden-right-thigh-mesh", 0.95, 1.06, 0.95);
    setScale("warden-left-shin-mesh", 0.93, 1.07, 0.93);
    setScale("warden-right-shin-mesh", 0.93, 1.07, 0.93);
    setScale("warden-head", 0.96, 0.98, 0.96);

    setScale("fp-right-sleeve", 0.64, 0.76, 0.64);
    setScale("fp-left-sleeve", 0.64, 0.76, 0.64);
    setScale("fp-right-hand", 0.72, 0.8, 0.72);
    setScale("fp-left-hand", 0.72, 0.8, 0.72);
    setPosition("fp-right-sleeve", 0.03, -0.4, 0.02);
    setPosition("fp-left-sleeve", -0.03, -0.4, 0.02);
    setPosition("fp-right-hand", 0.02, -0.75, 0.02);
    setPosition("fp-left-hand", -0.02, -0.75, 0.02);

    if (this.player.visual?.torso) {
      this.player.visual.torso.scaling = new BABYLON.Vector3(1.04, 1.02, 0.96);
    }
  }

  private createStanceIndicator(): HTMLElement {
    const element = document.createElement("div");
    element.id = "combat-stance-indicator";
    element.className = "combat-stance-indicator";
    element.innerHTML = "<span></span><strong>READY</strong>";
    document.getElementById("hud")?.append(element);
    return element;
  }

  private createImpactPool(): void {
    for (let poolIndex = 0; poolIndex < 4; poolIndex += 1) {
      const material = new BABYLON.StandardMaterial(`combat-impact-pool-material-${poolIndex}`, this.scene);
      material.disableLighting = true;
      material.emissiveColor = BABYLON.Color3.FromHexString("#70fff0");
      material.diffuseColor = BABYLON.Color3.Black();
      material.alpha = 0.92;

      const root = new BABYLON.TransformNode(`combat-impact-burst-${poolIndex}`, this.scene);
      const ring = BABYLON.MeshBuilder.CreateTorus(`combat-impact-ring-${poolIndex}`, {
        diameter: 1.3,
        thickness: 0.08,
        tessellation: 24
      }, this.scene);
      ring.rotation.x = Math.PI / 2;
      ring.material = material;
      ring.parent = root;

      const shards: any[] = [];
      const directions: any[] = [];
      for (let shardIndex = 0; shardIndex < 7; shardIndex += 1) {
        const shard = BABYLON.MeshBuilder.CreatePolyhedron(`combat-impact-shard-${poolIndex}-${shardIndex}`, {
          type: 1,
          size: 0.12 + (shardIndex % 3) * 0.025
        }, this.scene);
        shard.material = material;
        shard.parent = root;
        const angle = shardIndex / 7 * Math.PI * 2 + poolIndex * 0.23;
        directions.push(new BABYLON.Vector3(Math.cos(angle), 0.35 + (shardIndex % 2) * 0.28, Math.sin(angle)));
        shards.push(shard);
      }
      root.setEnabled(false);
      this.impactBursts.push({ root, ring, shards, directions, age: 0, duration: 0.42, active: false });
    }
  }

  private update(delta: number): void {
    this.elapsed += delta;
    this.updatePosePolish();
    this.updateEnemyImpacts();
    this.updateImpactPool(delta);
    this.updateStance();
    this.updateRegionPresentation();
  }

  private updatePosePolish(): void {
    const visual = this.player.visual;
    if (!visual?.root?.isEnabled?.()) return;

    if (this.player.blocking) {
      const pulse = Math.sin(this.elapsed * 4.2) * 0.012;
      visual.hips.rotation.x -= 0.055;
      visual.leftThigh.rotation.x -= 0.09;
      visual.rightThigh.rotation.x -= 0.06;
      visual.leftShin.rotation.x += 0.16;
      visual.rightShin.rotation.x += 0.13;
      visual.leftForearm.rotation.z += 0.12;
      visual.rightForearm.rotation.z -= 0.08;
      visual.torso.position.y = pulse;
      return;
    }

    if (this.player.attack) {
      const heavy = this.player.attack === "heavy";
      const duration = heavy ? 1.02 : 0.62;
      const progress = Math.min(1, this.player.attackTime / duration);
      const drive = Math.sin(progress * Math.PI);
      visual.leftThigh.rotation.x -= drive * (heavy ? 0.12 : 0.06);
      visual.leftShin.rotation.x += drive * (heavy ? 0.21 : 0.11);
      visual.rightShin.rotation.x += drive * (heavy ? 0.15 : 0.08);
      visual.rightForearm.rotation.z -= drive * (heavy ? 0.12 : 0.07);
      visual.leftForearm.rotation.z += drive * (heavy ? 0.1 : 0.05);
      visual.torso.position.y = -drive * (heavy ? 0.035 : 0.018);
      return;
    }

    visual.torso.position.y = Math.sin(this.elapsed * 1.65) * 0.006;
  }

  private updateEnemyImpacts(): void {
    for (const enemy of this.game.enemies) {
      const previous = this.previousEnemyHealth.get(enemy) ?? enemy.health;
      if (enemy.health < previous) {
        this.activateImpact(
          enemy.root.position.add(new BABYLON.Vector3(0, enemy.name === "Foundry Sentinel" ? 2.4 : 1.05, 0)),
          previous - enemy.health >= 40
        );
      }
      this.previousEnemyHealth.set(enemy, enemy.health);
    }
  }

  private activateImpact(position: any, heavy: boolean): void {
    const burst = this.impactBursts.find((candidate) => !candidate.active) ?? this.impactBursts[0];
    burst.active = true;
    burst.age = 0;
    burst.duration = heavy ? 0.55 : 0.38;
    burst.root.position.copyFrom(position);
    burst.root.scaling.setAll(heavy ? 1.35 : 1);
    burst.root.setEnabled(true);
    burst.ring.scaling.setAll(0.35);
    burst.shards.forEach((shard) => {
      shard.position.setAll(0);
      shard.rotation.setAll(0);
    });
  }

  private updateImpactPool(delta: number): void {
    for (const burst of this.impactBursts) {
      if (!burst.active) continue;
      burst.age += delta;
      const progress = Math.min(1, burst.age / burst.duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      burst.ring.scaling.setAll(0.35 + eased * 2.1);
      burst.ring.rotation.z += delta * 3.4;
      burst.shards.forEach((shard, index) => {
        const direction = burst.directions[index];
        shard.position.copyFrom(direction.scale(eased * 1.65));
        shard.position.y -= progress * progress * 0.72;
        shard.rotation.x += delta * (4 + index * 0.4);
        shard.rotation.y += delta * (3.2 + index * 0.35);
      });
      if (progress >= 1) {
        burst.active = false;
        burst.root.setEnabled(false);
      }
    }
  }

  private updateStance(): void {
    let label = "READY";
    let state = "ready";
    if (this.player.dodgeTime > 0) {
      label = "RIFT STEP";
      state = "dodge";
    } else if (this.player.blocking) {
      label = "WARD GUARD";
      state = "guard";
    } else if (this.player.attack === "heavy") {
      label = "BREAKER";
      state = "heavy";
    } else if (this.player.attack === "light") {
      label = "EDGE STRIKE";
      state = "light";
    }
    const snapshot = `${state}:${label}`;
    if (snapshot === this.lastStance) return;
    this.lastStance = snapshot;
    this.stance.dataset.state = state;
    const labelNode = this.stance.querySelector("strong");
    if (labelNode) labelNode.textContent = label;
  }

  private updateRegionPresentation(): void {
    const position = this.player.position();
    const region = this.regionAt(position.x, position.y, position.z);
    if (region.id === this.lastRegion) return;
    this.lastRegion = region.id;
    const kicker = document.querySelector<HTMLElement>(".region-kicker");
    const title = document.querySelector<HTMLElement>(".region-title");
    if (kicker) kicker.textContent = region.kicker;
    if (title) title.textContent = region.title;
  }

  private regionAt(x: number, y: number, z: number): RegionPresentation {
    if (y > 45) return { id: "floor-two", kicker: "FLOOR II THRESHOLD", title: "The Aerial Scar" };
    if (Math.abs(x - 475) < 42 && z < -585) {
      return { id: "pillar", kicker: "FOUNDATION SUPPORT CORE", title: "Eastern Pillar" };
    }
    if (Math.abs(x - 475) < 70 && z < -472) {
      return { id: "foundry", kicker: "BURIED INDUSTRIAL LATTICE", title: "Foundry Labyrinth" };
    }
    if (x > 405 && z < -430) {
      return { id: "breach", kicker: "EASTERN CLIFF FACE", title: "The Foundry Breach" };
    }
    if (Math.abs(x) < 135 && z > 18 && z < 210) {
      return { id: "caelus", kicker: "FLOOR I · WALLED DISTRICT", title: "Caelus Reach" };
    }
    return { id: "frontier", kicker: "FLOOR I · EXPEDITION ROUTE", title: "Windscar Road" };
  }
}
