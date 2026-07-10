import type { Damageable } from "../data/GameTypes.js";
import type { AudioDirector } from "../audio/AudioDirector.js";
import type { QuestSystem } from "./QuestSystem.js";
import type { World } from "../world/World.js";
import { createRiftBoar, type BoarVisual } from "../world/ProceduralAssets.js";

export type BoarState = "idle" | "chase" | "windup" | "recover" | "hit" | "dead";

export class RiftBoar implements Damageable {
  public readonly name = "Rift Boar";
  public readonly visual: BoarVisual;
  public readonly root: any;
  public health = 80;
  public readonly maxHealth = 80;
  public alive = true;
  private state: BoarState = "idle";
  private stateTime = 0;
  private patrolTime = 0;
  private patrolHeading = 0;
  private attackConnected = false;
  private hitImpulse = new BABYLON.Vector3();
  private walkCycle = 0;

  constructor(
    private readonly world: World,
    position: any,
    index: number,
    private readonly audio: AudioDirector,
    private readonly quests: QuestSystem,
    private readonly onPlayerDamage: (amount: number, source: any) => void,
    private readonly onImpact: (position: any, heavy: boolean) => void
  ) {
    this.visual = createRiftBoar(world.scene, index);
    this.root = this.visual.root;
    this.root.position.copyFrom(position);
    this.root.rotation.y = index * 1.7;
    this.root.getChildMeshes().forEach((mesh: any) => world.shadowGenerator.addShadowCaster(mesh));
    this.patrolHeading = this.root.rotation.y;
  }

  public update(delta: number, playerPosition: any, playerBlocking: boolean): void {
    if (!this.alive) {
      this.root.rotation.z = BABYLON.Scalar.Lerp(this.root.rotation.z, Math.PI / 2, delta * 3.2);
      this.root.position.y = BABYLON.Scalar.Lerp(this.root.position.y, this.world.heightAt(this.root.position.x, this.root.position.z) + 0.25, delta * 3);
      return;
    }

    this.stateTime += delta;
    const toPlayer = playerPosition.subtract(this.root.position);
    const planar = new BABYLON.Vector3(toPlayer.x, 0, toPlayer.z);
    const distance = planar.length();
    const direction = distance > 0.001 ? planar.scale(1 / distance) : BABYLON.Vector3.Forward();

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
      this.root.position.addInPlace(this.hitImpulse.scale(delta));
      this.hitImpulse.scaleInPlace(Math.max(0, 1 - delta * 8));
      this.visual.body.rotation.z = Math.sin(this.stateTime * 18) * 0.08;
      if (this.stateTime >= 0.28) this.setState("chase");
    }

    const ground = this.world.heightAt(this.root.position.x, this.root.position.z);
    this.root.position.y = ground;
    this.animate(delta);
  }

  public takeDamage(amount: number, impulse: any): void {
    if (!this.alive) return;
    this.health = Math.max(0, this.health - amount);
    this.audio.impact(amount > 35);
    this.onImpact(this.root.position.add(new BABYLON.Vector3(0, 1.05, 0.5)), amount > 35);
    this.hitImpulse = impulse.normalize().scale(amount > 35 ? 5.8 : 3.2);
    if (this.health <= 0) {
      this.alive = false;
      this.setState("dead");
      this.quests.recordBoarDefeat();
      this.visual.rune.scaling.setAll(1.8);
      this.visual.rune.material.emissiveIntensity = 2.6;
      window.setTimeout(() => {
        this.visual.rune.material.emissiveIntensity = 0.15;
      }, 420);
    } else {
      this.setState("hit");
    }
  }

  private move(direction: any, speed: number, delta: number): void {
    this.face(direction, delta * 4.5);
    this.root.position.addInPlace(direction.scale(speed * delta));
  }

  private face(direction: any, amount: number): void {
    const targetYaw = Math.atan2(direction.x, direction.z);
    this.root.rotation.y = this.lerpAngle(this.root.rotation.y, targetYaw, Math.min(1, amount));
  }

  private animate(delta: number): void {
    const moving = this.state === "chase" || this.state === "idle";
    this.walkCycle += delta * (this.state === "chase" ? 9 : 4.5);
    this.visual.legs.forEach((leg, index) => {
      const phase = index % 2 === 0 ? 0 : Math.PI;
      leg.rotation.x = moving ? Math.sin(this.walkCycle + phase) * 0.42 : BABYLON.Scalar.Lerp(leg.rotation.x, 0, delta * 6);
    });
    if (this.state !== "hit" && this.state !== "dead") {
      this.visual.body.rotation.z = Math.sin(this.walkCycle * 0.5) * 0.025;
    }
  }

  private setState(state: BoarState): void {
    this.state = state;
    this.stateTime = 0;
    this.attackConnected = false;
  }

  private lerpAngle(current: number, target: number, amount: number): number {
    let difference = (target - current + Math.PI) % (Math.PI * 2) - Math.PI;
    if (difference < -Math.PI) difference += Math.PI * 2;
    return current + difference * amount;
  }
}
