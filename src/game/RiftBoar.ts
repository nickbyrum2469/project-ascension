import type { Damageable, EnemyKind } from "../data/GameTypes.js";
import type { AudioDirector } from "../audio/AudioDirector.js";
import type { QuestSystem } from "./QuestSystem.js";
import type { World } from "../world/World.js";
import { createMaterial, createRiftBoar, type BoarVisual } from "../world/ProceduralAssets.js";
import { createRiftWisp } from "../world/RiftWispAsset.js";

export type BoarState = "idle" | "chase" | "windup" | "slam" | "recover" | "hit" | "dead";

export class RiftBoar implements Damageable {
  public readonly name: string;
  public readonly kind: EnemyKind;
  public readonly visual: BoarVisual;
  public readonly root: any;
  public health: number;
  public readonly maxHealth: number;
  public alive: boolean;

  private readonly isGuardian: boolean;
  private readonly isWisp: boolean;
  private readonly homePosition: any;
  private readonly baseBodyScaling: any;
  private readonly guardianRings: any[] = [];
  private readonly telegraphRoot: any;
  private readonly telegraphRing: any;
  private readonly telegraphSweep: any;
  private readonly telegraphMaterial: any;
  private readonly wispTarget = new BABYLON.Vector3();
  private state: BoarState = "idle";
  private stateTime = 0;
  private patrolTime = 0;
  private patrolHeading = 0;
  private attackConnected = false;
  private hitImpulse = new BABYLON.Vector3();
  private walkCycle = 0;
  private attackPattern = 0;
  private awakened = false;
  private wispBolt: any = null;
  private wispBoltDirection = new BABYLON.Vector3();
  private wispBoltLife = 0;
  private wispRespawnTime = 0;

  constructor(
    private readonly world: World,
    position: any,
    index: number,
    private readonly audio: AudioDirector,
    private readonly quests: QuestSystem,
    private readonly onPlayerDamage: (amount: number, source: any) => void,
    private readonly onImpact: (position: any, heavy: boolean) => void
  ) {
    this.isGuardian = index === 4;
    this.isWisp = index === 3;
    this.kind = this.isGuardian ? "foundry-sentinel" : this.isWisp ? "rift-wisp" : "rift-boar";
    this.name = this.isGuardian ? "Foundry Sentinel" : this.isWisp ? "Rift Wisp Constellation" : "Rift Boar";
    this.maxHealth = this.isGuardian ? 480 : this.isWisp ? 64 : 80;
    this.health = this.maxHealth;
    this.alive = this.isGuardian ? !quests.save.labyrinth.guardianDefeated : true;

    this.visual = this.isWisp ? createRiftWisp(world.scene, index) : createRiftBoar(world.scene, index);
    this.root = this.visual.root;
    this.baseBodyScaling = this.visual.body.scaling.clone();
    this.root.position.copyFrom(position);
    if (this.isGuardian) {
      const guardianX = world.labyrinthPosition.x;
      const guardianZ = world.labyrinthPosition.z - 76;
      this.root.position.copyFrom(new BABYLON.Vector3(guardianX, world.heightAt(guardianX, guardianZ), guardianZ));
    } else if (this.isWisp) {
      this.root.position.y = world.heightAt(this.root.position.x, this.root.position.z) + 2.65;
    }
    this.homePosition = this.root.position.clone();
    this.root.rotation.y = index * 1.7;
    this.root.getChildMeshes().forEach((mesh: any) => world.shadowGenerator.addShadowCaster(mesh));
    this.patrolHeading = this.root.rotation.y;

    const telegraph = this.createCombatTelegraph(index);
    this.telegraphRoot = telegraph.root;
    this.telegraphRing = telegraph.ring;
    this.telegraphSweep = telegraph.sweep;
    this.telegraphMaterial = telegraph.material;
    this.root.onDisposeObservable?.add(() => {
      this.disposeWispBolt();
      if (!this.telegraphRoot.isDisposed?.()) {
        this.telegraphRoot.getChildMeshes().forEach((mesh: any) => mesh.dispose(false, true));
        this.telegraphRoot.dispose();
      }
    });

    if (this.isGuardian) {
      this.createGuardianPresentation();
      this.root.setEnabled(quests.save.labyrinth.entered && this.alive);
      this.telegraphRoot.setEnabled(quests.save.labyrinth.entered && this.alive);
    }
  }

  public update(delta: number, playerPosition: any, playerBlocking: boolean): void {
    this.stateTime += delta;
    this.updateWispBolt(delta, playerPosition, playerBlocking);

    if (this.isGuardian) {
      if (!this.quests.save.labyrinth.entered) {
        this.root.setEnabled(false);
        this.telegraphRoot.setEnabled(false);
        return;
      }
      if (this.quests.save.labyrinth.guardianDefeated && this.alive) {
        this.alive = false;
        this.setState("dead");
      }
      if (this.alive && !this.root.isEnabled()) this.root.setEnabled(true);
      if (this.alive && !this.telegraphRoot.isEnabled()) this.telegraphRoot.setEnabled(true);
    }

    if (!this.alive) {
      this.telegraphRoot.setEnabled(false);
      this.animateDeath(delta);
      if (this.isWisp) {
        this.wispRespawnTime -= delta;
        if (this.wispRespawnTime <= 0) this.reviveWisp();
      }
      return;
    }

    const toPlayer = playerPosition.subtract(this.root.position);
    const planar = new BABYLON.Vector3(toPlayer.x, 0, toPlayer.z);
    const distance = planar.length();
    const direction = distance > 0.001 ? planar.scale(1 / distance) : BABYLON.Vector3.Forward();

    if (this.isGuardian) {
      this.updateGuardian(delta, playerPosition, playerBlocking, distance, direction);
    } else if (this.isWisp) {
      this.updateWisp(delta, playerPosition, distance, direction);
    } else {
      this.updateBoar(delta, playerPosition, playerBlocking, distance, direction);
    }

    const ground = this.world.heightAt(this.root.position.x, this.root.position.z);
    this.root.position.y = this.isWisp
      ? ground + 2.55 + Math.sin(this.walkCycle * 0.7) * 0.22
      : ground;
    this.updateCombatTelegraph(delta, ground);
    this.animate(delta);
  }

  public takeDamage(amount: number, impulse: any): void {
    if (!this.alive || (this.isGuardian && !this.quests.save.labyrinth.entered)) return;
    const effectiveAmount = amount * this.quests.outgoingDamageMultiplier(this.kind);
    this.health = Math.max(0, this.health - effectiveAmount);
    this.audio.impact(effectiveAmount > 35);
    this.onImpact(
      this.root.position.add(new BABYLON.Vector3(0, this.isGuardian ? 2.1 : this.isWisp ? 0 : 1.05, this.isWisp ? 0 : 0.5)),
      effectiveAmount > 35
    );

    const planarImpulse = new BABYLON.Vector3(impulse.x, 0, impulse.z);
    if (planarImpulse.lengthSquared() > 0.001) {
      planarImpulse.normalize();
      this.hitImpulse = planarImpulse.scale(
        this.isGuardian ? (effectiveAmount > 35 ? 1.8 : 0.7) : this.isWisp ? 1.4 : (effectiveAmount > 35 ? 5.8 : 3.2)
      );
    }

    if (this.health <= 0) {
      this.alive = false;
      this.setState("dead");
      if (this.isGuardian) {
        this.quests.recordGuardianDefeat();
        this.visual.rune.scaling.setAll(2.4);
        this.visual.rune.material.emissiveIntensity = 3.8;
        this.guardianRings.forEach((ring) => {
          ring.material.emissiveIntensity = 4.2;
        });
      } else if (this.isWisp) {
        this.quests.recordEnemyDefeat(this.kind);
        this.wispRespawnTime = 36;
        this.visual.rune.material.emissiveIntensity = 4.4;
      } else {
        this.quests.recordBoarDefeat();
        this.quests.recordEnemyDefeat(this.kind);
        this.visual.rune.scaling.setAll(1.8);
        this.visual.rune.material.emissiveIntensity = 2.6;
        window.setTimeout(() => {
          this.visual.rune.material.emissiveIntensity = 0.15;
        }, 420);
      }
    } else {
      this.setState("hit");
    }
  }

  private updateBoar(
    delta: number,
    playerPosition: any,
    playerBlocking: boolean,
    distance: number,
    direction: any
  ): void {
    if (this.state === "idle") {
      this.patrolTime -= delta;
      if (distance < 15.5) {
        this.setState("chase");
      } else {
        if (this.patrolTime <= 0) {
          this.patrolTime = 2 + Math.random() * 3;
          this.patrolHeading += (Math.random() - 0.5) * 1.8;
        }
        const patrolDirection = new BABYLON.Vector3(Math.sin(this.patrolHeading), 0, Math.cos(this.patrolHeading));
        this.move(patrolDirection, 0.7, delta);
      }
    } else if (this.state === "chase") {
      this.face(direction, delta * 5.5);
      if (distance > 21) this.setState("idle");
      else if (distance < 2.2) this.setState("windup");
      else this.move(direction, distance > 7 ? 3.7 : 2.6, delta);
    } else if (this.state === "windup") {
      this.face(direction, delta * 8);
      const pulse = 1 + Math.sin(this.stateTime * 18) * 0.12;
      this.visual.rune.scaling.setAll(pulse);
      this.visual.head.rotation.x = -0.25 - Math.min(0.35, this.stateTime * 0.4);
      if (this.stateTime > 0.58 && this.stateTime < 0.82) {
        this.move(direction, 8.2, delta);
        if (!this.attackConnected && distance < 2.05) {
          this.attackConnected = true;
          if (playerBlocking) {
            this.audio.guard();
            this.onImpact(playerPosition.add(new BABYLON.Vector3(0, 1, 0)), true);
            this.takeDamage(12, direction.scale(-1));
          } else {
            this.damagePlayer(18);
          }
        }
      }
      if (this.stateTime >= 0.9) this.setState("recover");
    } else if (this.state === "recover") {
      this.visual.rune.scaling.setAll(BABYLON.Scalar.Lerp(this.visual.rune.scaling.x, 1, delta * 8));
      this.visual.head.rotation.x = BABYLON.Scalar.Lerp(this.visual.head.rotation.x, 0, delta * 7);
      if (this.stateTime >= 0.62) this.setState(distance < 16 ? "chase" : "idle");
    } else if (this.state === "hit") {
      this.applyHitReaction(delta);
      if (this.stateTime >= 0.28) this.setState("chase");
    }
  }

  private updateWisp(delta: number, playerPosition: any, distance: number, direction: any): void {
    if (this.state === "idle") {
      const toHome = this.homePosition.subtract(this.root.position);
      toHome.y = 0;
      if (toHome.length() > 5) this.root.position.addInPlace(toHome.normalize().scale(delta * 1.4));
      this.root.rotation.y += delta * 0.35;
      if (distance < 23) this.setState("chase");
    } else if (this.state === "chase") {
      this.face(direction, delta * 4.8);
      const tangent = new BABYLON.Vector3(direction.z, 0, -direction.x);
      const radial = distance < 7 ? direction.scale(-1) : distance > 13 ? direction : BABYLON.Vector3.Zero();
      const orbitDirection = tangent.scale(Math.sin(this.stateTime * 0.85) >= 0 ? 1 : -1).add(radial.scale(1.35));
      if (orbitDirection.lengthSquared() > 0.001) orbitDirection.normalize();
      this.root.position.addInPlace(orbitDirection.scale(delta * 3.1));
      if (distance > 29) this.setState("idle");
      else if (this.stateTime > 2.05) {
        this.wispTarget.copyFrom(playerPosition);
        this.setState("windup");
      }
    } else if (this.state === "windup") {
      this.face(direction, delta * 6.5);
      if (this.stateTime < 0.08) this.wispTarget.copyFrom(playerPosition);
      const charge = BABYLON.Scalar.Clamp(this.stateTime / 0.86, 0, 1);
      this.visual.rune.scaling.setAll(1 + charge * 0.42 + Math.sin(this.stateTime * 28) * 0.06);
      this.visual.body.scaling.copyFrom(this.baseBodyScaling.scale(1 - charge * 0.12));
      if (!this.attackConnected && this.stateTime >= 0.82) {
        this.attackConnected = true;
        this.spawnWispBolt(this.wispTarget);
      }
      if (this.stateTime >= 0.98) this.setState("recover");
    } else if (this.state === "recover") {
      this.visual.rune.scaling.setAll(BABYLON.Scalar.Lerp(this.visual.rune.scaling.x, 1, delta * 8));
      this.visual.body.scaling.copyFrom(
        BABYLON.Vector3.Lerp(this.visual.body.scaling, this.baseBodyScaling, Math.min(1, delta * 8))
      );
      if (this.stateTime > 0.64) this.setState(distance < 25 ? "chase" : "idle");
    } else if (this.state === "hit") {
      this.applyHitReaction(delta);
      this.visual.rune.rotation.z += delta * 7;
      if (this.stateTime > 0.25) this.setState("chase");
    }
  }

  private updateGuardian(
    delta: number,
    playerPosition: any,
    playerBlocking: boolean,
    distance: number,
    direction: any
  ): void {
    const enraged = this.health <= this.maxHealth * 0.5;
    const speedScale = enraged ? 1.22 : 1;

    this.guardianRings.forEach((ring, index) => {
      ring.rotation.y += delta * (0.65 + index * 0.2) * (index % 2 === 0 ? 1 : -1);
      ring.rotation.z += delta * 0.16 * (index + 1);
    });

    if (this.state === "idle") {
      this.face(direction, delta * 2.5);
      if (distance < 25) {
        if (!this.awakened) {
          this.awakened = true;
          this.audio.creatureCharge();
          this.onImpact(this.root.position.add(new BABYLON.Vector3(0, 2.2, 0)), true);
        }
        this.setState("chase");
      }
    } else if (this.state === "chase") {
      this.face(direction, delta * 5.8 * speedScale);
      if (distance > 31) {
        this.setState("idle");
      } else if (distance < 4.6) {
        this.attackPattern = (this.attackPattern + 1) % 3;
        this.setState(this.attackPattern === 1 ? "slam" : "windup");
      } else {
        this.move(direction, enraged ? 4.35 : 3.45, delta);
      }
    } else if (this.state === "windup") {
      this.face(direction, delta * 7.5);
      const windupDuration = enraged ? 0.58 : 0.78;
      const attackEnd = windupDuration + 0.34;
      const pulse = 1 + Math.sin(this.stateTime * 24) * 0.16;
      this.visual.rune.scaling.setAll(pulse);
      this.visual.head.rotation.x = -0.32 - Math.min(0.48, this.stateTime * 0.55);
      this.root.scaling.z = 2.2 + Math.min(0.28, this.stateTime * 0.28);

      if (this.stateTime >= windupDuration && this.stateTime <= attackEnd) {
        this.move(direction, enraged ? 14 : 11.5, delta);
        if (!this.attackConnected && distance < 4.15) {
          this.attackConnected = true;
          if (playerBlocking) {
            this.audio.guard();
            this.onImpact(playerPosition.add(new BABYLON.Vector3(0, 1.2, 0)), true);
            this.health = Math.max(1, this.health - 16 * this.quests.outgoingDamageMultiplier(this.kind));
            this.setState("hit");
          } else {
            this.damagePlayer(enraged ? 34 : 28);
          }
        }
      }
      if (this.stateTime > attackEnd + 0.12) this.setState("recover");
    } else if (this.state === "slam") {
      this.face(direction, delta * 5.2);
      const slamMoment = enraged ? 0.72 : 0.92;
      this.visual.head.rotation.x = BABYLON.Scalar.Lerp(this.visual.head.rotation.x, -0.86, delta * 4.5);
      this.visual.body.position.y = Math.sin(Math.min(1, this.stateTime / slamMoment) * Math.PI) * 0.72;
      const pulse = 1 + Math.min(0.35, this.stateTime * 0.32);
      this.visual.rune.scaling.setAll(pulse);

      if (!this.attackConnected && this.stateTime >= slamMoment) {
        this.attackConnected = true;
        this.audio.impact(true);
        this.onImpact(this.root.position.add(new BABYLON.Vector3(0, 0.35, 0)), true);
        if (distance < (enraged ? 6.8 : 5.8)) {
          if (playerBlocking) {
            this.audio.guard();
            this.onImpact(playerPosition.add(new BABYLON.Vector3(0, 1.1, 0)), true);
          } else {
            this.damagePlayer(enraged ? 38 : 31);
          }
        }
      }
      if (this.stateTime >= slamMoment + 0.48) this.setState("recover");
    } else if (this.state === "recover") {
      this.root.scaling.z = BABYLON.Scalar.Lerp(this.root.scaling.z, 2.2, delta * 7);
      this.visual.body.position.y = BABYLON.Scalar.Lerp(this.visual.body.position.y, 0, delta * 8);
      this.visual.rune.scaling.setAll(BABYLON.Scalar.Lerp(this.visual.rune.scaling.x, 1, delta * 7));
      this.visual.head.rotation.x = BABYLON.Scalar.Lerp(this.visual.head.rotation.x, 0, delta * 7);
      if (this.stateTime >= (enraged ? 0.42 : 0.62)) this.setState("chase");
    } else if (this.state === "hit") {
      this.applyHitReaction(delta);
      this.visual.body.rotation.z = Math.sin(this.stateTime * 24) * 0.055;
      if (this.stateTime >= (enraged ? 0.16 : 0.24)) this.setState("chase");
    }
  }

  private createCombatTelegraph(index: number): { root: any; ring: any; sweep: any; material: any } {
    const root = new BABYLON.TransformNode(`boar-telegraph-root-${index}`, this.world.scene);
    const material = createMaterial(
      this.world.scene,
      `boar-telegraph-material-${index}`,
      this.isGuardian ? "#ff6a3d" : this.isWisp ? "#ffd36f" : "#ffb34d",
      0.05,
      0.12,
      this.isGuardian ? "#ff3d2e" : this.isWisp ? "#ff9d42" : "#ff8a32"
    );
    material.alpha = 0;
    material.emissiveIntensity = 2.4;
    material.disableLighting = true;

    const ring = BABYLON.MeshBuilder.CreateTorus(`boar-danger-ring-${index}`, {
      diameter: 2,
      thickness: this.isGuardian ? 0.085 : this.isWisp ? 0.07 : 0.055,
      tessellation: 64
    }, this.world.scene);
    ring.rotation.x = Math.PI / 2;
    ring.material = material;
    ring.parent = root;

    const sweep = BABYLON.MeshBuilder.CreateDisc(`boar-danger-sweep-${index}`, {
      radius: 1,
      tessellation: 64,
      arc: this.isGuardian ? 0.18 : 0.12,
      sideOrientation: BABYLON.Mesh.DOUBLESIDE
    }, this.world.scene);
    sweep.rotation.x = Math.PI / 2;
    sweep.rotation.z = Math.PI / 2;
    sweep.position.y = 0.012;
    sweep.material = material;
    sweep.parent = root;

    root.setEnabled(false);
    return { root, ring, sweep, material };
  }

  private updateCombatTelegraph(delta: number, ground: number): void {
    const attacking = this.state === "windup" || this.state === "slam";
    if (!attacking) {
      this.telegraphMaterial.alpha = BABYLON.Scalar.Lerp(this.telegraphMaterial.alpha, 0, Math.min(1, delta * 18));
      if (this.telegraphMaterial.alpha < 0.01) this.telegraphRoot.setEnabled(false);
      return;
    }

    if (!this.telegraphRoot.isEnabled()) this.telegraphRoot.setEnabled(true);
    const enraged = this.isGuardian && this.health <= this.maxHealth * 0.5;
    const isSlam = this.state === "slam";
    const duration = this.isWisp
      ? 0.86
      : isSlam
        ? (enraged ? 0.72 : 0.92)
        : (this.isGuardian ? (enraged ? 0.58 : 0.78) : 0.58);
    const progress = BABYLON.Scalar.Clamp(this.stateTime / duration, 0, 1);
    const radius = this.isWisp
      ? 2.25
      : isSlam
        ? (enraged ? 6.8 : 5.8)
        : (this.isGuardian ? 4.15 : 2.05);
    const anticipation = 0.78 + progress * 0.22;

    if (this.isWisp) {
      const targetGround = this.world.heightAt(this.wispTarget.x, this.wispTarget.z);
      this.telegraphRoot.position.copyFromFloats(this.wispTarget.x, targetGround + 0.055, this.wispTarget.z);
      this.telegraphRoot.rotation.y = 0;
    } else {
      this.telegraphRoot.position.copyFromFloats(this.root.position.x, ground + 0.055, this.root.position.z);
      this.telegraphRoot.rotation.y = this.root.rotation.y;
    }
    this.telegraphRing.scaling.setAll(radius * anticipation);
    this.telegraphSweep.scaling.setAll(radius * anticipation);
    this.telegraphSweep.setEnabled(!isSlam && !this.isWisp);
    this.telegraphRing.setEnabled(true);
    this.telegraphRing.rotation.z += delta * (enraged ? 3.8 : this.isWisp ? 4.6 : 2.5);
    this.telegraphSweep.rotation.z = Math.PI / 2 + Math.sin(this.stateTime * 7) * 0.08;
    this.telegraphMaterial.alpha = 0.18 + progress * 0.58 + Math.sin(this.stateTime * 22) * 0.06;
    this.telegraphMaterial.emissiveIntensity = (enraged ? 3.8 : this.isWisp ? 3.2 : 2.4) + progress * 2.2;
  }

  private spawnWispBolt(target: any): void {
    this.disposeWispBolt();
    const root = new BABYLON.TransformNode(`rift-wisp-bolt-${performance.now()}`, this.world.scene);
    root.position.copyFrom(this.root.position);
    const material = createMaterial(this.world.scene, `rift-wisp-bolt-material-${performance.now()}`, "#fff0aa", 0.05, 0.08, "#ff9d42");
    material.emissiveIntensity = 4.4;
    const orb = BABYLON.MeshBuilder.CreatePolyhedron(`rift-wisp-bolt-core-${performance.now()}`, { type: 1, size: 0.34 }, this.world.scene);
    orb.material = material;
    orb.parent = root;
    const ring = BABYLON.MeshBuilder.CreateTorus(`rift-wisp-bolt-ring-${performance.now()}`, {
      diameter: 0.95,
      thickness: 0.045,
      tessellation: 20
    }, this.world.scene);
    ring.rotation.x = Math.PI / 2;
    ring.material = material;
    ring.parent = root;
    const direction = target.add(new BABYLON.Vector3(0, 0.8, 0)).subtract(root.position);
    this.wispBoltDirection = direction.lengthSquared() > 0.001 ? direction.normalize() : BABYLON.Vector3.Forward();
    this.wispBolt = root;
    this.wispBoltLife = 2.4;
    this.audio.creatureCharge();
  }

  private updateWispBolt(delta: number, playerPosition: any, playerBlocking: boolean): void {
    if (!this.wispBolt) return;
    this.wispBoltLife -= delta;
    this.wispBolt.position.addInPlace(this.wispBoltDirection.scale(delta * 15.5));
    this.wispBolt.rotation.y += delta * 9;
    this.wispBolt.rotation.z += delta * 5;
    const target = playerPosition.add(new BABYLON.Vector3(0, 0.9, 0));
    if (BABYLON.Vector3.Distance(this.wispBolt.position, target) <= 1.25) {
      if (playerBlocking) {
        this.audio.guard();
        this.onImpact(target, true);
        if (this.alive) this.takeDamage(14, this.wispBoltDirection.scale(-1));
      } else {
        this.damagePlayer(17);
        this.onImpact(target, false);
      }
      this.disposeWispBolt();
      return;
    }
    if (this.wispBoltLife <= 0) this.disposeWispBolt();
  }

  private disposeWispBolt(): void {
    if (!this.wispBolt) return;
    this.wispBolt.getChildMeshes().forEach((mesh: any) => mesh.dispose(false, true));
    this.wispBolt.dispose();
    this.wispBolt = null;
    this.wispBoltLife = 0;
  }

  private damagePlayer(amount: number): void {
    const adjusted = amount * this.quests.incomingDamageMultiplier(this.kind);
    this.onPlayerDamage(adjusted, this.root.position.clone());
  }

  private applyHitReaction(delta: number): void {
    this.root.position.addInPlace(this.hitImpulse.scale(delta));
    this.hitImpulse.scaleInPlace(Math.max(0, 1 - delta * 8));
    this.visual.body.rotation.z = Math.sin(this.stateTime * 18) * 0.08;
  }

  private animateDeath(delta: number): void {
    if (!this.root.isEnabled()) return;
    if (this.isWisp) {
      this.root.rotation.y += delta * 5.5;
      this.root.scaling.setAll(Math.max(0.04, 1 - this.stateTime * 0.7));
      this.root.position.y -= delta * 0.55;
      if (this.stateTime > 1.45) this.root.setEnabled(false);
      return;
    }
    const targetRotation = this.isGuardian ? -Math.PI / 2 : Math.PI / 2;
    this.root.rotation.z = BABYLON.Scalar.Lerp(this.root.rotation.z, targetRotation, delta * (this.isGuardian ? 1.3 : 3.2));
    this.root.position.y = BABYLON.Scalar.Lerp(
      this.root.position.y,
      this.world.heightAt(this.root.position.x, this.root.position.z) + (this.isGuardian ? 0.6 : 0.25),
      delta * 3
    );
    if (this.isGuardian) {
      this.guardianRings.forEach((ring, index) => {
        ring.scaling.setAll(Math.max(0.05, 1 - this.stateTime * (0.2 + index * 0.04)));
        ring.rotation.y += delta * 2.4;
      });
      if (this.stateTime > 4.2) this.root.setEnabled(false);
    }
  }

  private reviveWisp(): void {
    this.alive = true;
    this.health = this.maxHealth;
    this.state = "idle";
    this.stateTime = 0;
    this.attackConnected = false;
    this.disposeWispBolt();
    this.root.position.copyFrom(this.homePosition);
    this.root.rotation.copyFromFloats(0, 0, 0);
    this.root.scaling.setAll(1);
    this.visual.body.scaling.copyFrom(this.baseBodyScaling);
    this.visual.body.rotation.copyFromFloats(0, 0, 0);
    this.visual.rune.scaling.setAll(1);
    this.visual.rune.material.emissiveIntensity = 2.1;
    this.root.setEnabled(true);
    this.telegraphRoot.setEnabled(false);
    this.onImpact(this.root.position.clone(), true);
  }

  private move(direction: any, speed: number, delta: number): void {
    this.face(direction, delta * (this.isGuardian ? 5.8 : 4.5));
    this.root.position.addInPlace(direction.scale(speed * delta));
  }

  private face(direction: any, amount: number): void {
    const targetYaw = Math.atan2(direction.x, direction.z);
    this.root.rotation.y = this.lerpAngle(this.root.rotation.y, targetYaw, Math.min(1, amount));
  }

  private animate(delta: number): void {
    if (this.isWisp) {
      this.walkCycle += delta * (this.state === "windup" ? 8.5 : 3.8);
      this.visual.rune.rotation.y += delta * 1.7;
      this.visual.rune.rotation.z += delta * 0.55;
      const secondaryRing = this.root.metadata?.secondaryRing;
      if (secondaryRing) {
        secondaryRing.rotation.y -= delta * 1.15;
        secondaryRing.rotation.z += delta * 0.42;
      }
      this.visual.legs.forEach((bladeRig, index) => {
        bladeRig.rotation.y += delta * (0.35 + index * 0.06) * (index % 2 === 0 ? 1 : -1);
        bladeRig.rotation.z = Math.sin(this.walkCycle + index) * 0.18;
      });
      this.visual.head.rotation.y += delta * 0.9;
      return;
    }

    const moving = this.state === "chase" || this.state === "idle";
    const pace = this.isGuardian ? (this.state === "chase" ? 6.8 : 2.8) : (this.state === "chase" ? 9 : 4.5);
    this.walkCycle += delta * pace;
    const stride = this.isGuardian ? 0.3 : 0.42;
    this.visual.legs.forEach((leg, index) => {
      const phase = index % 2 === 0 ? 0 : Math.PI;
      leg.rotation.x = moving ? Math.sin(this.walkCycle + phase) * stride : BABYLON.Scalar.Lerp(leg.rotation.x, 0, delta * 6);
    });
    if (this.state !== "hit" && this.state !== "dead") {
      this.visual.body.rotation.z = Math.sin(this.walkCycle * 0.5) * (this.isGuardian ? 0.018 : 0.025);
    }
  }

  private createGuardianPresentation(): void {
    this.root.scaling = new BABYLON.Vector3(2.2, 2.15, 2.2);
    this.visual.body.scaling = new BABYLON.Vector3(1.18, 1.08, 1.25);
    this.visual.head.scaling = new BABYLON.Vector3(1.18, 1.1, 1.2);

    const armor = createMaterial(this.world.scene, "foundry-sentinel-armor", "#344c55", 0.28, 0.76);
    const edge = createMaterial(this.world.scene, "foundry-sentinel-edge", "#85f6ef", 0.12, 0.32, "#35e6dd");
    edge.emissiveIntensity = 2.1;

    [-0.62, 0, 0.62].forEach((offset, index) => {
      const plate = BABYLON.MeshBuilder.CreatePolyhedron(`sentinel-back-plate-${index}`, {
        type: 1,
        size: 0.48
      }, this.world.scene);
      plate.position = new BABYLON.Vector3(offset, 0.62 + Math.abs(offset) * 0.12, -0.02);
      plate.scaling = new BABYLON.Vector3(1.1, 1.45, 0.72);
      plate.rotation = new BABYLON.Vector3(0.12, offset * -0.28, offset * -0.35);
      plate.material = index === 1 ? edge : armor;
      plate.parent = this.visual.body;
      this.world.shadowGenerator.addShadowCaster(plate);
    });

    [-1, 1].forEach((side) => {
      const horn = BABYLON.MeshBuilder.CreateCylinder(`sentinel-horn-${side}`, {
        height: 1.05,
        diameterTop: 0.03,
        diameterBottom: 0.24,
        tessellation: 5
      }, this.world.scene);
      horn.position = new BABYLON.Vector3(side * 0.48, 0.25, 0.48);
      horn.rotation = new BABYLON.Vector3(Math.PI / 2 - 0.32, 0, side * -0.35);
      horn.material = edge;
      horn.parent = this.visual.head;
      this.world.shadowGenerator.addShadowCaster(horn);
    });

    [2.3, 3.05].forEach((diameter, index) => {
      const ring = BABYLON.MeshBuilder.CreateTorus(`sentinel-orbit-${index}`, {
        diameter,
        thickness: 0.055 + index * 0.02,
        tessellation: 28
      }, this.world.scene);
      ring.position = new BABYLON.Vector3(0, 1.02 + index * 0.18, 0);
      ring.rotation = new BABYLON.Vector3(Math.PI / 2 - index * 0.32, index * 0.4, index * 0.22);
      ring.material = edge;
      ring.parent = this.root;
      this.guardianRings.push(ring);
    });

    this.visual.rune.material.emissiveIntensity = 2.5;
  }

  private setState(state: BoarState): void {
    this.state = state;
    this.stateTime = 0;
    this.attackConnected = false;
    if (state === "windup" || state === "slam") {
      this.audio.creatureCharge();
      this.telegraphRoot.setEnabled(true);
    }
  }

  private lerpAngle(current: number, target: number, amount: number): number {
    let difference = (target - current + Math.PI) % (Math.PI * 2) - Math.PI;
    if (difference < -Math.PI) difference += Math.PI * 2;
    return current + difference * amount;
  }
}
