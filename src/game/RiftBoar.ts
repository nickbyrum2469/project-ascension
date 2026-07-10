import type { Damageable } from "../data/GameTypes.js";
import type { AudioDirector } from "../audio/AudioDirector.js";
import type { QuestSystem } from "./QuestSystem.js";
import type { World } from "../world/World.js";
import { createMaterial, createRiftBoar, type BoarVisual } from "../world/ProceduralAssets.js";

export type BoarState = "idle" | "chase" | "windup" | "slam" | "recover" | "hit" | "dead";

export class RiftBoar implements Damageable {
  public readonly name: string;
  public readonly visual: BoarVisual;
  public readonly root: any;
  public health: number;
  public readonly maxHealth: number;
  public alive: boolean;

  private readonly isGuardian: boolean;
  private readonly guardianRings: any[] = [];
  private state: BoarState = "idle";
  private stateTime = 0;
  private patrolTime = 0;
  private patrolHeading = 0;
  private attackConnected = false;
  private hitImpulse = new BABYLON.Vector3();
  private walkCycle = 0;
  private attackPattern = 0;
  private awakened = false;

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
    this.name = this.isGuardian ? "Foundry Sentinel" : "Rift Boar";
    this.maxHealth = this.isGuardian ? 480 : 80;
    this.health = this.maxHealth;
    this.alive = this.isGuardian ? !quests.save.labyrinth.guardianDefeated : true;

    this.visual = createRiftBoar(world.scene, index);
    this.root = this.visual.root;
    this.root.position.copyFrom(position);
    if (this.isGuardian) {
      const guardianX = world.labyrinthPosition.x;
      const guardianZ = world.labyrinthPosition.z - 76;
      this.root.position.copyFrom(new BABYLON.Vector3(guardianX, world.heightAt(guardianX, guardianZ), guardianZ));
    }
    this.root.rotation.y = index * 1.7;
    this.root.getChildMeshes().forEach((mesh: any) => world.shadowGenerator.addShadowCaster(mesh));
    this.patrolHeading = this.root.rotation.y;

    if (this.isGuardian) {
      this.createGuardianPresentation();
      this.root.setEnabled(quests.save.labyrinth.entered && this.alive);
    }
  }

  public update(delta: number, playerPosition: any, playerBlocking: boolean): void {
    this.stateTime += delta;

    if (this.isGuardian) {
      if (!this.quests.save.labyrinth.entered) {
        this.root.setEnabled(false);
        return;
      }
      if (this.quests.save.labyrinth.guardianDefeated && this.alive) {
        this.alive = false;
        this.setState("dead");
      }
      if (this.alive && !this.root.isEnabled()) this.root.setEnabled(true);
    }

    if (!this.alive) {
      this.animateDeath(delta);
      return;
    }

    const toPlayer = playerPosition.subtract(this.root.position);
    const planar = new BABYLON.Vector3(toPlayer.x, 0, toPlayer.z);
    const distance = planar.length();
    const direction = distance > 0.001 ? planar.scale(1 / distance) : BABYLON.Vector3.Forward();

    if (this.isGuardian) {
      this.updateGuardian(delta, playerPosition, playerBlocking, distance, direction);
    } else {
      this.updateBoar(delta, playerPosition, playerBlocking, distance, direction);
    }

    const ground = this.world.heightAt(this.root.position.x, this.root.position.z);
    this.root.position.y = ground;
    this.animate(delta);
  }

  public takeDamage(amount: number, impulse: any): void {
    if (!this.alive || (this.isGuardian && !this.quests.save.labyrinth.entered)) return;
    this.health = Math.max(0, this.health - amount);
    this.audio.impact(amount > 35);
    this.onImpact(
      this.root.position.add(new BABYLON.Vector3(0, this.isGuardian ? 2.1 : 1.05, 0.5)),
      amount > 35
    );

    const planarImpulse = new BABYLON.Vector3(impulse.x, 0, impulse.z);
    if (planarImpulse.lengthSquared() > 0.001) {
      planarImpulse.normalize();
      this.hitImpulse = planarImpulse.scale(this.isGuardian ? (amount > 35 ? 1.8 : 0.7) : (amount > 35 ? 5.8 : 3.2));
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
      } else {
        this.quests.recordBoarDefeat();
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
            this.onPlayerDamage(18, this.root.position.clone());
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
        this.move(direction, (enraged ? 4.35 : 3.45), delta);
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
        this.move(direction, (enraged ? 14 : 11.5), delta);
        if (!this.attackConnected && distance < 4.15) {
          this.attackConnected = true;
          if (playerBlocking) {
            this.audio.guard();
            this.onImpact(playerPosition.add(new BABYLON.Vector3(0, 1.2, 0)), true);
            this.health = Math.max(1, this.health - 16);
            this.setState("hit");
          } else {
            this.onPlayerDamage(enraged ? 34 : 28, this.root.position.clone());
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
            this.onPlayerDamage(enraged ? 38 : 31, this.root.position.clone());
          }
        }
      }
      if (this.stateTime >= slamMoment + 0.48) this.setState("recover");
    } else if (this.state === "recover") {
      this.root.scaling.z = BABYLON.Scalar.Lerp(this.root.scaling.z, 2.2, delta * 7);
      this.visual.body.position.y = BABYLON.Scalar.Lerp(this.visual.body.position.y, 0, delta * 8);
      this.visual.rune.scaling.setAll(BABYLON.Scalar.Lerp(this.visual.rune.scaling.x, 1, delta * 7));
      this.visual.head.rotation.x = BABYLON.Scalar.Lerp(this.visual.head.rotation.x, 0, delta * 6);
      if (this.stateTime >= (enraged ? 0.42 : 0.62)) this.setState("chase");
    } else if (this.state === "hit") {
      this.applyHitReaction(delta);
      this.visual.body.rotation.z = Math.sin(this.stateTime * 24) * 0.055;
      if (this.stateTime >= (enraged ? 0.16 : 0.24)) this.setState("chase");
    }
  }

  private applyHitReaction(delta: number): void {
    this.root.position.addInPlace(this.hitImpulse.scale(delta));
    this.hitImpulse.scaleInPlace(Math.max(0, 1 - delta * 8));
    this.visual.body.rotation.z = Math.sin(this.stateTime * 18) * 0.08;
  }

  private animateDeath(delta: number): void {
    if (!this.root.isEnabled()) return;
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

  private move(direction: any, speed: number, delta: number): void {
    this.face(direction, delta * (this.isGuardian ? 5.8 : 4.5));
    this.root.position.addInPlace(direction.scale(speed * delta));
  }

  private face(direction: any, amount: number): void {
    const targetYaw = Math.atan2(direction.x, direction.z);
    this.root.rotation.y = this.lerpAngle(this.root.rotation.y, targetYaw, Math.min(1, amount));
  }

  private animate(delta: number): void {
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
    if (state === "windup" || state === "slam") this.audio.creatureCharge();
  }

  private lerpAngle(current: number, target: number, amount: number): number {
    let difference = (target - current + Math.PI) % (Math.PI * 2) - Math.PI;
    if (difference < -Math.PI) difference += Math.PI * 2;
    return current + difference * amount;
  }
}
