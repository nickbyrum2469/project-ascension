import type { AudioDirector } from "../audio/AudioDirector.js";
import type { CameraMode, GameSettings, InputFrame } from "../data/GameTypes.js";
import type { Hud } from "../ui/Hud.js";
import type { World } from "../world/World.js";
import { createMaterial, createWarden, type HumanoidVisual } from "../world/ProceduralAssets.js";
import type { RiftBoar } from "./RiftBoar.js";
import type { QuestSystem } from "./QuestSystem.js";

type AttackKind = "light" | "heavy" | null;

export class Player {
  public readonly visual: HumanoidVisual;
  public readonly root: any;
  public health = 100;
  public readonly maxHealth = 100;
  public stamina = 100;
  public focus = 0;
  public blocking = false;
  public cameraMode: CameraMode = "third";
  public lockTarget: RiftBoar | null = null;

  private readonly velocity = new BABYLON.Vector3();
  private verticalVelocity = 0;
  private grounded = true;
  private yaw = Math.PI;
  private pitch = -0.12;
  private shoulder = 1;
  private attack: AttackKind = null;
  private attackTime = 0;
  private attackHit = false;
  private dodgeTime = 0;
  private dodgeDirection = new BABYLON.Vector3();
  private walkCycle = 0;
  private footTimer = 0;
  private cameraBlend = 1;
  private cameraShake = 0;
  private fpRig: any;
  private fpSword: any;
  private fpArm: any;
  private settings: GameSettings;
  private saveTimer = 0;

  constructor(
    private readonly world: World,
    private readonly hud: Hud,
    private readonly audio: AudioDirector,
    private readonly quests: QuestSystem,
    private readonly onImpact: (position: any, heavy: boolean) => void
  ) {
    this.visual = createWarden(world.scene);
    this.root = this.visual.root;
    this.root.position = new BABYLON.Vector3(0, world.heightAt(0, -2), -2);
    this.root.rotation.y = this.yaw;
    this.root.getChildMeshes().forEach((mesh: any) => world.shadowGenerator.addShadowCaster(mesh));

    this.settings = quests.save.settings;
    this.health = Math.max(20, quests.save.player.health);
    this.focus = quests.save.player.focus;
    if (!quests.save.player.riftglassUnlocked) {
      this.visual.rune.material.emissiveIntensity = 0.45;
    }
    this.createFirstPersonRig();
    this.hud.setCameraMode(this.cameraMode);
    this.hud.setVitals(this.health, this.maxHealth, this.stamina, this.focus);
  }

  public update(delta: number, input: InputFrame, enemies: RiftBoar[], controlsEnabled: boolean): void {
    this.saveTimer += delta;
    if (this.saveTimer >= 4) {
      this.saveTimer = 0;
      this.quests.updatePlayer(this.health, this.focus);
    }

    if (!controlsEnabled) {
      this.blocking = false;
      this.animate(delta, 0, false);
      this.updateCamera(delta);
      return;
    }

    this.applyLook(input);
    this.handleModeActions(input, enemies);
    this.blocking = input.block && this.attack === null && this.dodgeTime <= 0 && this.stamina > 0;

    if (this.dodgeTime > 0) {
      this.updateDodge(delta);
    } else {
      this.handleCombatInput(input);
      this.updateMovement(delta, input);
    }

    this.updateAttack(delta, enemies);
    this.updateResources(delta);
    this.updateLockTarget(enemies);
    this.updateCamera(delta);
    this.hud.setVitals(this.health, this.maxHealth, this.stamina, this.focus);
    this.hud.setCompass(this.yaw);
  }

  public applySettings(settings: GameSettings): void {
    this.settings = settings;
    this.world.camera.fov = BABYLON.Tools.ToRadians(settings.fov);
  }

  public receiveDamage(amount: number, source: any): void {
    if (this.dodgeTime > 0.06 && this.dodgeTime < 0.42) return;
    this.health = Math.max(0, this.health - amount);
    this.audio.damage();
    this.hud.flashDamage();
    this.cameraShake = this.settings.cameraShake ? Math.min(1, this.cameraShake + 0.55) : 0;
    const away = this.root.position.subtract(source);
    away.y = 0;
    if (away.lengthSquared() > 0.001) {
      away.normalize();
      this.velocity.addInPlace(away.scale(3.2));
    }
    if (this.health <= 0) this.respawn();
  }

  public position(): any {
    return this.root.position;
  }

  public forward(): any {
    return new BABYLON.Vector3(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
  }

  private applyLook(input: InputFrame): void {
    const factor = 0.0018 * this.settings.sensitivity;
    this.yaw += input.lookX * factor;
    this.pitch = BABYLON.Scalar.Clamp(this.pitch + input.lookY * factor, -1.2, 0.78);
  }

  private handleModeActions(input: InputFrame, enemies: RiftBoar[]): void {
    if (input.toggleViewPressed) {
      this.cameraMode = this.cameraMode === "third" ? "first" : "third";
      this.cameraBlend = 0;
      this.visual.root.setEnabled(this.cameraMode === "third");
      this.fpRig.setEnabled(this.cameraMode === "first");
      this.hud.setCameraMode(this.cameraMode);
      this.hud.notify("VIEW SHIFT", this.cameraMode === "first" ? "First-person combat lattice engaged" : "Third-person field view engaged");
      this.audio.uiConfirm();
    }
    if (input.shoulderPressed) this.shoulder *= -1;
    if (input.lockOnPressed) {
      if (this.lockTarget) this.lockTarget = null;
      else this.lockTarget = this.findTarget(enemies, 20);
      this.audio.uiConfirm();
    }
  }

  private handleCombatInput(input: InputFrame): void {
    if (input.dodgePressed && this.stamina >= 24 && this.attack === null) {
      this.stamina -= 24;
      this.dodgeTime = 0.55;
      const inputDirection = this.inputDirection(input.moveX, input.moveY);
      this.dodgeDirection = inputDirection.lengthSquared() > 0.01 ? inputDirection.normalize() : this.forward().scale(-1);
      this.audio.swordSwing(false);
      return;
    }

    if (input.jumpPressed && this.grounded && this.stamina >= 10 && this.attack === null && !this.blocking) {
      this.verticalVelocity = 6.4;
      this.grounded = false;
      this.stamina -= 10;
    }

    if (input.lightPressed && this.attack === null && !this.blocking && this.stamina >= 13) {
      this.attack = "light";
      this.attackTime = 0;
      this.attackHit = false;
      this.stamina -= 13;
      this.audio.swordSwing(false);
    } else if (input.heavyPressed && this.attack === null && !this.blocking && this.stamina >= 27) {
      this.attack = "heavy";
      this.attackTime = 0;
      this.attackHit = false;
      this.stamina -= 27;
      this.audio.swordSwing(true);
    }
  }

  private updateMovement(delta: number, input: InputFrame): void {
    const direction = this.inputDirection(input.moveX, input.moveY);
    const magnitude = Math.min(1, Math.hypot(input.moveX, input.moveY));
    const attackingScale = this.attack ? (this.attack === "heavy" ? 0.14 : 0.36) : 1;
    const blockScale = this.blocking ? 0.42 : 1;
    const sprinting = input.sprint && this.stamina > 0 && magnitude > 0.25 && !this.blocking && this.attack === null;
    const targetSpeed = (sprinting ? 7.15 : 4.15) * magnitude * attackingScale * blockScale;
    const targetVelocity = direction.scale(targetSpeed);
    const acceleration = magnitude > 0.05 ? (sprinting ? 15 : 20) : 18;
    this.velocity.x = BABYLON.Scalar.Lerp(this.velocity.x, targetVelocity.x, Math.min(1, delta * acceleration));
    this.velocity.z = BABYLON.Scalar.Lerp(this.velocity.z, targetVelocity.z, Math.min(1, delta * acceleration));

    if (sprinting) this.stamina = Math.max(0, this.stamina - delta * 17);

    if (this.lockTarget && this.lockTarget.alive) {
      const toTarget = this.lockTarget.root.position.subtract(this.root.position);
      this.faceDirection(toTarget, Math.min(1, delta * 10));
    } else if (magnitude > 0.12) {
      this.faceDirection(direction, Math.min(1, delta * 12));
    }

    this.root.position.x += this.velocity.x * delta;
    this.root.position.z += this.velocity.z * delta;
    this.root.position.x = BABYLON.Scalar.Clamp(this.root.position.x, -94, 94);
    this.root.position.z = BABYLON.Scalar.Clamp(this.root.position.z, -96, 20);

    this.verticalVelocity -= 18.5 * delta;
    this.root.position.y += this.verticalVelocity * delta;
    const ground = this.world.heightAt(this.root.position.x, this.root.position.z);
    if (this.root.position.y <= ground) {
      if (!this.grounded && this.verticalVelocity < -4) {
        this.cameraShake = this.settings.cameraShake ? Math.min(1, this.cameraShake + 0.18) : 0;
      }
      this.root.position.y = ground;
      this.verticalVelocity = 0;
      this.grounded = true;
    }

    const planarSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    this.animate(delta, planarSpeed, sprinting);
  }

  private updateDodge(delta: number): void {
    this.dodgeTime -= delta;
    const normalized = Math.max(0, this.dodgeTime / 0.55);
    const speed = 3.4 + Math.sin(normalized * Math.PI) * 9.5;
    this.root.position.addInPlace(this.dodgeDirection.scale(speed * delta));
    this.root.position.y = this.world.heightAt(this.root.position.x, this.root.position.z);
    this.root.rotation.z = Math.sin((1 - normalized) * Math.PI) * -0.32;
    this.visual.hips.rotation.x = Math.sin((1 - normalized) * Math.PI) * 0.52;
    if (this.dodgeTime <= 0) {
      this.root.rotation.z = 0;
      this.visual.hips.rotation.x = 0;
    }
  }

  private updateAttack(delta: number, enemies: RiftBoar[]): void {
    if (!this.attack) {
      this.visual.rightArm.rotation.x = BABYLON.Scalar.Lerp(this.visual.rightArm.rotation.x, this.blocking ? -0.8 : 0, delta * 10);
      this.visual.rightArm.rotation.z = BABYLON.Scalar.Lerp(this.visual.rightArm.rotation.z, this.blocking ? 0.5 : 0, delta * 10);
      this.visual.leftArm.rotation.x = BABYLON.Scalar.Lerp(this.visual.leftArm.rotation.x, this.blocking ? -0.7 : 0, delta * 10);
      this.visual.sword.rotation.z = BABYLON.Scalar.Lerp(this.visual.sword.rotation.z, Math.PI, delta * 10);
      this.animateFirstPersonWeapon(delta, 0, null);
      return;
    }

    this.attackTime += delta;
    const heavy = this.attack === "heavy";
    const duration = heavy ? 0.92 : 0.52;
    const progress = Math.min(1, this.attackTime / duration);
    const swing = Math.sin(progress * Math.PI);
    this.visual.rightArm.rotation.x = -1.15 + progress * 2.7;
    this.visual.rightArm.rotation.z = heavy ? -0.65 + progress * 1.25 : -0.25 + progress * 0.65;
    this.visual.leftArm.rotation.x = heavy ? -0.75 + progress * 1.1 : 0;
    this.visual.torso.rotation.y = (progress - 0.5) * (heavy ? 0.72 : 0.38);
    this.visual.sword.rotation.z = Math.PI - swing * (heavy ? 0.58 : 0.32);
    this.animateFirstPersonWeapon(delta, progress, this.attack);

    const hitStart = heavy ? 0.42 : 0.27;
    const hitEnd = heavy ? 0.69 : 0.55;
    if (!this.attackHit && progress >= hitStart && progress <= hitEnd) {
      this.attackHit = true;
      const forward = this.forward();
      const reach = heavy ? 3.05 : 2.45;
      const damage = heavy ? 46 : 28;
      enemies.forEach((enemy) => {
        if (!enemy.alive) return;
        const toEnemy = enemy.root.position.subtract(this.root.position);
        const flat = new BABYLON.Vector3(toEnemy.x, 0, toEnemy.z);
        const distance = flat.length();
        const facing = distance > 0.01 ? BABYLON.Vector3.Dot(flat.scale(1 / distance), forward) : 1;
        if (distance <= reach && facing > (heavy ? 0.05 : 0.32)) {
          enemy.takeDamage(damage, flat.lengthSquared() > 0.001 ? flat : forward);
          this.focus = Math.min(100, this.focus + (heavy ? 16 : 10));
          this.cameraShake = this.settings.cameraShake ? Math.min(1, this.cameraShake + (heavy ? 0.4 : 0.22)) : 0;
          this.onImpact(enemy.root.position.add(new BABYLON.Vector3(0, 1.1, 0)), heavy);
        }
      });
    }

    if (progress >= 1) {
      this.attack = null;
      this.attackTime = 0;
      this.visual.torso.rotation.y = 0;
    }
  }

  private updateResources(delta: number): void {
    if (!this.blocking && this.attack === null && this.dodgeTime <= 0 && this.stamina < 100) {
      this.stamina = Math.min(100, this.stamina + delta * 25);
    }
    if (this.blocking) this.stamina = Math.max(0, this.stamina - delta * 5.5);
  }

  private updateLockTarget(enemies: RiftBoar[]): void {
    if (this.lockTarget && (!this.lockTarget.alive || BABYLON.Vector3.Distance(this.root.position, this.lockTarget.root.position) > 24)) {
      this.lockTarget = null;
    }
    if (!this.lockTarget && this.attack) this.lockTarget = this.findTarget(enemies, 13);
    this.hud.setTarget(
      this.lockTarget?.alive ? this.lockTarget.name : null,
      this.lockTarget?.health ?? 0,
      this.lockTarget?.maxHealth ?? 1
    );
  }

  private updateCamera(delta: number): void {
    const target = this.root.position.add(new BABYLON.Vector3(0, 1.42, 0));
    let desired: any;
    let lookTarget: any;

    if (this.cameraMode === "first") {
      const forward = new BABYLON.Vector3(
        Math.sin(this.yaw) * Math.cos(this.pitch),
        -Math.sin(this.pitch),
        Math.cos(this.yaw) * Math.cos(this.pitch)
      );
      desired = this.root.position.add(new BABYLON.Vector3(0, 1.67, 0)).add(forward.scale(0.08));
      lookTarget = desired.add(forward.scale(12));
    } else {
      const lockedTarget = this.lockTarget?.alive ? this.lockTarget.root.position.add(new BABYLON.Vector3(0, 0.8, 0)) : null;
      if (lockedTarget) {
        const toTarget = lockedTarget.subtract(target);
        this.yaw = Math.atan2(toTarget.x, toTarget.z);
        this.pitch = BABYLON.Scalar.Lerp(this.pitch, -0.08, delta * 2.8);
      }
      const distance = this.blocking ? 4.7 : 5.8;
      const horizontal = Math.cos(this.pitch) * distance;
      const offset = new BABYLON.Vector3(
        -Math.sin(this.yaw) * horizontal + Math.cos(this.yaw) * this.shoulder * 0.72,
        1.3 + Math.sin(-this.pitch) * distance,
        -Math.cos(this.yaw) * horizontal - Math.sin(this.yaw) * this.shoulder * 0.72
      );
      desired = target.add(offset);
      lookTarget = lockedTarget ? BABYLON.Vector3.Lerp(target, lockedTarget, 0.42) : target.add(new BABYLON.Vector3(0, 0.15, 0));

      const rayDirection = desired.subtract(lookTarget);
      const rayLength = rayDirection.length();
      if (rayLength > 0.01) {
        rayDirection.scaleInPlace(1 / rayLength);
        const ray = new BABYLON.Ray(lookTarget, rayDirection, rayLength);
        const hit = this.world.scene.pickWithRay(ray, (mesh: any) => mesh.isPickable && mesh.name === "windscar-terrain");
        if (hit?.hit && hit.distance < rayLength) desired = lookTarget.add(rayDirection.scale(Math.max(0.8, hit.distance - 0.25)));
      }
    }

    this.cameraBlend = Math.min(1, this.cameraBlend + delta * 5.8);
    const smooth = 1 - Math.pow(0.0002, delta);
    this.world.camera.position = BABYLON.Vector3.Lerp(this.world.camera.position, desired, Math.max(smooth, this.cameraBlend * 0.18));

    if (this.cameraShake > 0.001) {
      const shakeAmount = this.cameraShake * 0.065;
      this.world.camera.position.addInPlace(new BABYLON.Vector3(
        (Math.random() - 0.5) * shakeAmount,
        (Math.random() - 0.5) * shakeAmount,
        (Math.random() - 0.5) * shakeAmount
      ));
      this.cameraShake = Math.max(0, this.cameraShake - delta * 3.8);
    }
    this.world.camera.setTarget(lookTarget);
  }

  private animate(delta: number, speed: number, sprinting: boolean): void {
    const moving = speed > 0.25 && this.grounded && this.dodgeTime <= 0;
    this.walkCycle += delta * (sprinting ? 11.5 : 7.3) * Math.min(1.2, speed / 4);
    const amplitude = sprinting ? 0.75 : 0.48;
    if (moving && !this.attack) {
      this.visual.leftLeg.rotation.x = Math.sin(this.walkCycle) * amplitude;
      this.visual.rightLeg.rotation.x = Math.sin(this.walkCycle + Math.PI) * amplitude;
      this.visual.leftArm.rotation.x = Math.sin(this.walkCycle + Math.PI) * amplitude * 0.7;
      this.visual.rightArm.rotation.x = Math.sin(this.walkCycle) * amplitude * 0.45;
      this.visual.hips.position.y = 0.92 + Math.abs(Math.sin(this.walkCycle)) * 0.035;
      this.visual.cape.rotation.x = 0.08 + Math.sin(this.walkCycle * 0.5) * 0.05 + speed * 0.012;
      this.footTimer -= delta;
      if (this.footTimer <= 0) {
        this.footTimer = sprinting ? 0.27 : 0.38;
        this.audio.footstep(sprinting ? 1.25 : 0.9);
      }
    } else if (!this.attack) {
      this.visual.leftLeg.rotation.x = BABYLON.Scalar.Lerp(this.visual.leftLeg.rotation.x, 0, delta * 8);
      this.visual.rightLeg.rotation.x = BABYLON.Scalar.Lerp(this.visual.rightLeg.rotation.x, 0, delta * 8);
      this.visual.leftArm.rotation.x = BABYLON.Scalar.Lerp(this.visual.leftArm.rotation.x, 0, delta * 8);
      this.visual.rightArm.rotation.x = BABYLON.Scalar.Lerp(this.visual.rightArm.rotation.x, 0, delta * 8);
      this.visual.hips.position.y = 0.92 + Math.sin(performance.now() * 0.0024) * 0.012;
      this.visual.cape.rotation.x = 0.08 + Math.sin(performance.now() * 0.0017) * 0.025;
    }
  }

  private inputDirection(moveX: number, moveY: number): any {
    const forward = new BABYLON.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new BABYLON.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    return forward.scale(moveY).add(right.scale(moveX));
  }

  private faceDirection(direction: any, amount: number): void {
    if (direction.lengthSquared() < 0.001) return;
    const targetYaw = Math.atan2(direction.x, direction.z);
    this.root.rotation.y = this.lerpAngle(this.root.rotation.y, targetYaw, amount);
  }

  private findTarget(enemies: RiftBoar[], range: number): RiftBoar | null {
    const forward = new BABYLON.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    let best: RiftBoar | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      const toEnemy = enemy.root.position.subtract(this.root.position);
      toEnemy.y = 0;
      const distance = toEnemy.length();
      if (distance > range || distance < 0.001) return;
      const facing = BABYLON.Vector3.Dot(toEnemy.scale(1 / distance), forward);
      const score = distance - facing * 5;
      if (facing > -0.15 && score < bestScore) {
        best = enemy;
        bestScore = score;
      }
    });
    return best;
  }

  private createFirstPersonRig(): void {
    this.fpRig = new BABYLON.TransformNode("first-person-rig", this.world.scene);
    this.fpRig.parent = this.world.camera;
    this.fpRig.position = new BABYLON.Vector3(0.37, -0.34, 0.78);
    this.fpRig.rotation = new BABYLON.Vector3(0.04, Math.PI, -0.08);

    const gauntletMaterial = createMaterial(this.world.scene, "fp-gauntlet", "#233948", 0.34, 0.48);
    this.fpArm = BABYLON.MeshBuilder.CreateCylinder("fp-right-arm", {
      height: 0.88,
      diameterTop: 0.18,
      diameterBottom: 0.29,
      tessellation: 8
    }, this.world.scene);
    this.fpArm.material = gauntletMaterial;
    this.fpArm.rotation.x = Math.PI / 2 - 0.18;
    this.fpArm.position = new BABYLON.Vector3(0.12, -0.2, 0.08);
    this.fpArm.parent = this.fpRig;

    this.fpSword = this.visual.sword.clone("first-person-riftglass-edge", this.fpRig, false);
    this.fpSword.position = new BABYLON.Vector3(0.02, -0.04, -0.36);
    this.fpSword.rotation = new BABYLON.Vector3(-0.12, 0, Math.PI);
    this.fpSword.scaling = new BABYLON.Vector3(1.12, 1.12, 1.12);
    this.fpSword.getChildMeshes?.().forEach((mesh: any) => {
      mesh.isPickable = false;
      mesh.renderingGroupId = 2;
    });
    this.fpArm.renderingGroupId = 2;
    this.fpRig.setEnabled(false);
  }

  private animateFirstPersonWeapon(delta: number, progress: number, attack: AttackKind): void {
    if (!this.fpRig) return;
    if (!attack) {
      const breath = Math.sin(performance.now() * 0.0022) * 0.008;
      this.fpRig.position.x = BABYLON.Scalar.Lerp(this.fpRig.position.x, 0.37, delta * 9);
      this.fpRig.position.y = BABYLON.Scalar.Lerp(this.fpRig.position.y, -0.34 + breath, delta * 9);
      this.fpRig.rotation.x = BABYLON.Scalar.Lerp(this.fpRig.rotation.x, this.blocking ? -0.38 : 0.04, delta * 10);
      this.fpRig.rotation.z = BABYLON.Scalar.Lerp(this.fpRig.rotation.z, this.blocking ? 0.38 : -0.08, delta * 10);
      return;
    }
    const heavy = attack === "heavy";
    const swing = Math.sin(progress * Math.PI);
    this.fpRig.position.x = 0.37 - swing * (heavy ? 0.42 : 0.24);
    this.fpRig.position.y = -0.34 + swing * (heavy ? 0.2 : 0.12);
    this.fpRig.rotation.x = 0.04 + progress * (heavy ? 1.7 : 1.15);
    this.fpRig.rotation.z = -0.08 + swing * (heavy ? -1.05 : -0.62);
  }

  private respawn(): void {
    this.health = 100;
    this.stamina = 100;
    this.focus = Math.max(0, this.focus - 15);
    this.root.position = new BABYLON.Vector3(0, this.world.heightAt(0, -2), -2);
    this.velocity.setAll(0);
    this.hud.notify("THREAD RESTORED", "The Foundation returned you to the Caelus gate.");
    this.quests.updatePlayer(this.health, this.focus);
  }

  private lerpAngle(current: number, target: number, amount: number): number {
    let difference = (target - current + Math.PI) % (Math.PI * 2) - Math.PI;
    if (difference < -Math.PI) difference += Math.PI * 2;
    return current + difference * amount;
  }
}
