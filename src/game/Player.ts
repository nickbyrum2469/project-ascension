import type { AudioDirector } from "../audio/AudioDirector.js";
import type { CameraMode, GameSettings, InputFrame } from "../data/GameTypes.js";
import type { Hud } from "../ui/Hud.js";
import type { World } from "../world/World.js";
import {
  createMaterial,
  createRiftglassSword,
  createWarden,
  type HumanoidVisual
} from "../world/ProceduralAssets.js";
import type { RiftBoar } from "./RiftBoar.js";
import type { QuestSystem } from "./QuestSystem.js";

type AttackKind = "light" | "heavy" | null;

const easeOut = (value: number): number => 1 - Math.pow(1 - BABYLON.Scalar.Clamp(value, 0, 1), 3);
const easeInOut = (value: number): number => {
  const t = BABYLON.Scalar.Clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

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
  private fpRightArm: any;
  private fpLeftArm: any;
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
    this.cameraMode = this.settings.cameraMode;
    this.health = Math.max(20, quests.save.player.health);
    this.focus = quests.save.player.focus;
    if (!quests.save.player.riftglassUnlocked) {
      this.visual.rune.material.emissiveIntensity = 0.45;
    }

    this.createFirstPersonRig();
    this.setCameraMode(this.cameraMode, false);
    this.resetPose(1);
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
      this.animateLocomotion(delta, 0, false);
      this.updateCombatPose(delta);
      this.updateCamera(delta);
      return;
    }

    this.applyLook(input);
    this.handleModeActions(input, enemies);
    this.blocking = input.block && this.attack === null && this.dodgeTime <= 0 && this.stamina > 0;

    if (this.cameraMode === "first" && !this.lockTarget) {
      this.root.rotation.y = this.yaw;
    }

    if (this.dodgeTime > 0) {
      this.updateDodge(delta);
    } else {
      this.handleCombatInput(input);
      this.updateMovement(delta, input);
    }

    this.updateAttack(delta, enemies);
    this.updateResources(delta);
    this.updateLockTarget(enemies);
    this.updateCombatPose(delta);
    this.updateCamera(delta);
    this.hud.setVitals(this.health, this.maxHealth, this.stamina, this.focus);
    this.hud.setCompass(this.yaw);
  }

  public applySettings(settings: GameSettings): void {
    this.settings = settings;
    this.world.camera.fov = BABYLON.Tools.ToRadians(settings.fov);
    this.hud.setQuestCompact(settings.compactQuestTracker);
    if (settings.cameraMode !== this.cameraMode) this.setCameraMode(settings.cameraMode, false);
  }

  public setCameraMode(mode: CameraMode, announce = true): void {
    this.cameraMode = mode;
    this.cameraBlend = 0;
    this.visual.root.setEnabled(mode === "third");
    this.fpRig.setEnabled(mode === "first");
    this.hud.setCameraMode(mode);

    if (announce) {
      this.hud.notify(
        "PERSPECTIVE CHANGED",
        mode === "first" ? "First-person view engaged." : "Third-person view engaged."
      );
      this.audio.uiConfirm();
    }
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
    const verticalDirection = this.settings.invertY ? -1 : 1;
    this.yaw += input.lookX * factor;
    this.pitch = BABYLON.Scalar.Clamp(
      this.pitch + input.lookY * factor * verticalDirection,
      -1.05,
      0.72
    );
  }

  private handleModeActions(input: InputFrame, enemies: RiftBoar[]): void {
    if (input.toggleViewPressed) {
      this.setCameraMode(this.cameraMode === "third" ? "first" : "third");
      this.settings.cameraMode = this.cameraMode;
      this.quests.updateSettings(this.settings);
    }
    if (input.shoulderPressed) this.shoulder *= -1;
    if (input.lockOnPressed) {
      this.lockTarget = this.lockTarget ? null : this.findTarget(enemies, 24);
      this.audio.uiConfirm();
    }
  }

  private handleCombatInput(input: InputFrame): void {
    if (input.dodgePressed && this.stamina >= 24 && this.attack === null) {
      this.stamina -= 24;
      this.dodgeTime = 0.55;
      const inputDirection = this.inputDirection(input.moveX, input.moveY);
      this.dodgeDirection = inputDirection.lengthSquared() > 0.01
        ? inputDirection.normalize()
        : this.forward().scale(-1);
      this.audio.swordSwing(false);
      return;
    }

    if (
      input.jumpPressed
      && this.grounded
      && this.stamina >= 10
      && this.attack === null
      && !this.blocking
    ) {
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
    } else if (
      input.heavyPressed
      && this.attack === null
      && !this.blocking
      && this.stamina >= 27
    ) {
      this.attack = "heavy";
      this.attackTime = 0;
      this.attackHit = false;
      this.stamina -= 27;
      this.audio.swordSwing(true);
    }
  }

  private updateMovement(delta: number, input: InputFrame): void {
    const previous = this.root.position.clone();
    const direction = this.inputDirection(input.moveX, input.moveY);
    const magnitude = Math.min(1, Math.hypot(input.moveX, input.moveY));
    const attackingScale = this.attack ? (this.attack === "heavy" ? 0.12 : 0.32) : 1;
    const blockScale = this.blocking ? 0.4 : 1;
    const sprinting = input.sprint
      && this.stamina > 0
      && magnitude > 0.25
      && !this.blocking
      && this.attack === null;
    const targetSpeed = (sprinting ? 7.3 : 4.25) * magnitude * attackingScale * blockScale;
    const targetVelocity = direction.scale(targetSpeed);
    const acceleration = magnitude > 0.05 ? (sprinting ? 15 : 20) : 18;
    this.velocity.x = BABYLON.Scalar.Lerp(
      this.velocity.x,
      targetVelocity.x,
      Math.min(1, delta * acceleration)
    );
    this.velocity.z = BABYLON.Scalar.Lerp(
      this.velocity.z,
      targetVelocity.z,
      Math.min(1, delta * acceleration)
    );

    if (sprinting) this.stamina = Math.max(0, this.stamina - delta * 17);

    if (this.lockTarget && this.lockTarget.alive) {
      const toTarget = this.lockTarget.root.position.subtract(this.root.position);
      this.faceDirection(toTarget, Math.min(1, delta * 10));
    } else if (magnitude > 0.12 && this.cameraMode === "third") {
      this.faceDirection(direction, Math.min(1, delta * 12));
    }

    this.root.position.x += this.velocity.x * delta;
    this.root.position.z += this.velocity.z * delta;

    this.verticalVelocity -= 18.5 * delta;
    this.root.position.y += this.verticalVelocity * delta;
    const ground = this.world.heightAt(this.root.position.x, this.root.position.z);
    if (this.root.position.y <= ground) {
      if (!this.grounded && this.verticalVelocity < -4) {
        this.cameraShake = this.settings.cameraShake
          ? Math.min(1, this.cameraShake + 0.18)
          : 0;
      }
      this.root.position.y = ground;
      this.verticalVelocity = 0;
      this.grounded = true;
    }

    this.world.resolvePlayerPosition(this.root.position, previous);
    const planarSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    this.animateLocomotion(delta, planarSpeed, sprinting);
  }

  private updateDodge(delta: number): void {
    const previous = this.root.position.clone();
    this.dodgeTime -= delta;
    const normalized = Math.max(0, this.dodgeTime / 0.55);
    const speed = 3.4 + Math.sin(normalized * Math.PI) * 9.5;
    this.root.position.addInPlace(this.dodgeDirection.scale(speed * delta));
    this.world.resolvePlayerPosition(this.root.position, previous);
    this.root.rotation.z = Math.sin((1 - normalized) * Math.PI) * -0.24;
    this.visual.hips.rotation.x = Math.sin((1 - normalized) * Math.PI) * 0.38;
    if (this.dodgeTime <= 0) {
      this.root.rotation.z = 0;
      this.visual.hips.rotation.x = 0;
    }
  }

  private updateAttack(delta: number, enemies: RiftBoar[]): void {
    if (!this.attack) return;

    this.attackTime += delta;
    const heavy = this.attack === "heavy";
    const duration = heavy ? 1.02 : 0.62;
    const progress = Math.min(1, this.attackTime / duration);
    const hitStart = heavy ? 0.39 : 0.31;
    const hitEnd = heavy ? 0.67 : 0.61;

    if (!this.attackHit && progress >= hitStart && progress <= hitEnd) {
      this.attackHit = true;
      const forward = this.forward();
      const reach = heavy ? 3.3 : 2.7;
      const damage = heavy ? 46 : 28;
      enemies.forEach((enemy) => {
        if (!enemy.alive) return;
        const toEnemy = enemy.root.position.subtract(this.root.position);
        const flat = new BABYLON.Vector3(toEnemy.x, 0, toEnemy.z);
        const distance = flat.length();
        const facing = distance > 0.01
          ? BABYLON.Vector3.Dot(flat.scale(1 / distance), forward)
          : 1;
        if (distance <= reach && facing > (heavy ? -0.05 : 0.22)) {
          enemy.takeDamage(damage, flat.lengthSquared() > 0.001 ? flat : forward);
          this.focus = Math.min(100, this.focus + (heavy ? 16 : 10));
          this.cameraShake = this.settings.cameraShake
            ? Math.min(1, this.cameraShake + (heavy ? 0.4 : 0.22))
            : 0;
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
    if (
      this.lockTarget
      && (!this.lockTarget.alive
        || BABYLON.Vector3.Distance(this.root.position, this.lockTarget.root.position) > 28)
    ) {
      this.lockTarget = null;
    }
    if (!this.lockTarget && this.attack) this.lockTarget = this.findTarget(enemies, 14);
    this.hud.setTarget(
      this.lockTarget?.alive ? this.lockTarget.name : null,
      this.lockTarget?.health ?? 0,
      this.lockTarget?.maxHealth ?? 1
    );
  }

  private updateCombatPose(delta: number): void {
    if (this.attack) {
      this.animateThirdPersonAttack(delta);
      this.animateFirstPersonAttack(delta);
      return;
    }

    if (this.blocking) {
      const amount = Math.min(1, delta * 13);
      this.visual.torso.rotation.y = BABYLON.Scalar.Lerp(this.visual.torso.rotation.y, -0.12, amount);
      this.visual.rightUpperArm.rotation.x = BABYLON.Scalar.Lerp(
        this.visual.rightUpperArm.rotation.x,
        -1.18,
        amount
      );
      this.visual.rightUpperArm.rotation.z = BABYLON.Scalar.Lerp(
        this.visual.rightUpperArm.rotation.z,
        -0.28,
        amount
      );
      this.visual.rightForearm.rotation.x = BABYLON.Scalar.Lerp(
        this.visual.rightForearm.rotation.x,
        -1.05,
        amount
      );
      this.visual.rightForearm.rotation.z = BABYLON.Scalar.Lerp(
        this.visual.rightForearm.rotation.z,
        0.2,
        amount
      );
      this.visual.leftUpperArm.rotation.x = BABYLON.Scalar.Lerp(
        this.visual.leftUpperArm.rotation.x,
        -1.05,
        amount
      );
      this.visual.leftUpperArm.rotation.z = BABYLON.Scalar.Lerp(
        this.visual.leftUpperArm.rotation.z,
        0.36,
        amount
      );
      this.visual.leftForearm.rotation.x = BABYLON.Scalar.Lerp(
        this.visual.leftForearm.rotation.x,
        -0.85,
        amount
      );
      this.visual.sword.rotation.x = BABYLON.Scalar.Lerp(
        this.visual.sword.rotation.x,
        -0.18,
        amount
      );
      this.visual.sword.rotation.y = BABYLON.Scalar.Lerp(
        this.visual.sword.rotation.y,
        -0.25,
        amount
      );
      this.visual.sword.rotation.z = BABYLON.Scalar.Lerp(
        this.visual.sword.rotation.z,
        -0.72,
        amount
      );
      this.animateFirstPersonGuard(delta);
      return;
    }

    this.resetPose(Math.min(1, delta * 10));
    this.animateFirstPersonIdle(delta);
  }

  private animateThirdPersonAttack(delta: number): void {
    if (!this.attack) return;
    const heavy = this.attack === "heavy";
    const duration = heavy ? 1.02 : 0.62;
    const progress = Math.min(1, this.attackTime / duration);
    const anticipation = easeInOut(progress / (heavy ? 0.3 : 0.23));
    const strike = easeOut((progress - (heavy ? 0.27 : 0.2)) / (heavy ? 0.38 : 0.34));
    const recovery = easeInOut((progress - (heavy ? 0.64 : 0.58)) / (heavy ? 0.36 : 0.42));
    const active = BABYLON.Scalar.Clamp(strike - recovery, 0, 1);

    const windupYaw = heavy ? -0.72 : -0.5;
    const followYaw = heavy ? 0.78 : 0.58;
    this.visual.torso.rotation.y = BABYLON.Scalar.Lerp(
      BABYLON.Scalar.Lerp(0, windupYaw, anticipation),
      followYaw,
      active
    );
    this.visual.hips.rotation.y = this.visual.torso.rotation.y * 0.32;
    this.visual.hips.rotation.x = Math.sin(progress * Math.PI) * (heavy ? -0.1 : -0.05);

    this.visual.rightUpperArm.rotation.x = BABYLON.Scalar.Lerp(
      BABYLON.Scalar.Lerp(-0.2, -1.55, anticipation),
      0.18,
      active
    );
    this.visual.rightUpperArm.rotation.z = BABYLON.Scalar.Lerp(
      BABYLON.Scalar.Lerp(-0.08, -0.68, anticipation),
      0.5,
      active
    );
    this.visual.rightForearm.rotation.x = BABYLON.Scalar.Lerp(
      BABYLON.Scalar.Lerp(-0.18, -0.72, anticipation),
      -0.12,
      active
    );
    this.visual.rightForearm.rotation.z = BABYLON.Scalar.Lerp(
      BABYLON.Scalar.Lerp(0, 0.28, anticipation),
      -0.16,
      active
    );

    this.visual.leftUpperArm.rotation.x = BABYLON.Scalar.Lerp(
      0,
      heavy ? -0.72 : -0.28,
      anticipation
    );
    this.visual.leftUpperArm.rotation.z = BABYLON.Scalar.Lerp(
      0.08,
      heavy ? 0.38 : 0.18,
      anticipation
    );
    this.visual.leftForearm.rotation.x = BABYLON.Scalar.Lerp(
      0,
      heavy ? -0.5 : -0.16,
      anticipation
    );

    this.visual.sword.rotation.x = BABYLON.Scalar.Lerp(
      BABYLON.Scalar.Lerp(-Math.PI / 2, -0.72, anticipation),
      -1.12,
      active
    );
    this.visual.sword.rotation.y = BABYLON.Scalar.Lerp(
      BABYLON.Scalar.Lerp(0, -0.4, anticipation),
      0.48,
      active
    );
    this.visual.sword.rotation.z = BABYLON.Scalar.Lerp(
      BABYLON.Scalar.Lerp(-0.08, -0.52, anticipation),
      0.28,
      active
    );

    const kneeBend = Math.sin(progress * Math.PI) * (heavy ? 0.34 : 0.18);
    this.visual.leftThigh.rotation.x = -kneeBend * 0.45;
    this.visual.leftShin.rotation.x = kneeBend;
    this.visual.rightThigh.rotation.x = kneeBend * 0.28;
    this.visual.rightShin.rotation.x = kneeBend * 0.55;

    if (recovery > 0) this.resetPose(Math.min(1, delta * 5 + recovery * 0.16));
  }

  private updateCamera(delta: number): void {
    const target = this.root.position.add(new BABYLON.Vector3(0, 1.55, 0));
    let desired: any;
    let lookTarget: any;

    if (this.cameraMode === "first") {
      const forward = new BABYLON.Vector3(
        Math.sin(this.yaw) * Math.cos(this.pitch),
        -Math.sin(this.pitch),
        Math.cos(this.yaw) * Math.cos(this.pitch)
      );
      desired = this.root.position
        .add(new BABYLON.Vector3(0, 1.72, 0))
        .add(forward.scale(0.08));
      lookTarget = desired.add(forward.scale(14));
    } else {
      const lockedTarget = this.lockTarget?.alive
        ? this.lockTarget.root.position.add(new BABYLON.Vector3(0, 0.9, 0))
        : null;
      if (lockedTarget) {
        const toTarget = lockedTarget.subtract(target);
        this.yaw = Math.atan2(toTarget.x, toTarget.z);
        this.pitch = BABYLON.Scalar.Lerp(this.pitch, -0.08, delta * 2.8);
      }
      const distance = this.blocking ? 4.8 : 5.9;
      const horizontal = Math.cos(this.pitch) * distance;
      const offset = new BABYLON.Vector3(
        -Math.sin(this.yaw) * horizontal + Math.cos(this.yaw) * this.shoulder * 0.72,
        1.35 + Math.sin(this.pitch) * distance,
        -Math.cos(this.yaw) * horizontal - Math.sin(this.yaw) * this.shoulder * 0.72
      );
      desired = target.add(offset);
      lookTarget = lockedTarget
        ? BABYLON.Vector3.Lerp(target, lockedTarget, 0.42)
        : target.add(new BABYLON.Vector3(0, 0.18, 0));

      const rayDirection = desired.subtract(lookTarget);
      const rayLength = rayDirection.length();
      if (rayLength > 0.01) {
        rayDirection.scaleInPlace(1 / rayLength);
        const ray = new BABYLON.Ray(lookTarget, rayDirection, rayLength);
        const hit = this.world.scene.pickWithRay(
          ray,
          (mesh: any) => mesh.isPickable && mesh.metadata?.cameraCollision === true
        );
        if (hit?.hit && hit.distance < rayLength) {
          desired = lookTarget.add(rayDirection.scale(Math.max(0.85, hit.distance - 0.28)));
        }
      }
    }

    this.cameraBlend = Math.min(1, this.cameraBlend + delta * 5.8);
    const smooth = 1 - Math.pow(0.0002, delta);
    this.world.camera.position = BABYLON.Vector3.Lerp(
      this.world.camera.position,
      desired,
      Math.max(smooth, this.cameraBlend * 0.18)
    );

    if (this.cameraShake > 0.001) {
      const shakeAmount = this.cameraShake * 0.06;
      this.world.camera.position.addInPlace(new BABYLON.Vector3(
        (Math.random() - 0.5) * shakeAmount,
        (Math.random() - 0.5) * shakeAmount,
        (Math.random() - 0.5) * shakeAmount
      ));
      this.cameraShake = Math.max(0, this.cameraShake - delta * 3.8);
    }
    this.world.camera.setTarget(lookTarget);
  }

  private animateLocomotion(delta: number, speed: number, sprinting: boolean): void {
    if (this.attack || this.blocking || this.dodgeTime > 0) return;
    const moving = speed > 0.25 && this.grounded;
    this.walkCycle += delta * (sprinting ? 11.2 : 7.1) * Math.min(1.2, speed / 4);
    const amplitude = sprinting ? 0.68 : 0.43;

    if (moving) {
      const leftStep = Math.sin(this.walkCycle);
      const rightStep = Math.sin(this.walkCycle + Math.PI);
      this.visual.leftThigh.rotation.x = leftStep * amplitude;
      this.visual.rightThigh.rotation.x = rightStep * amplitude;
      this.visual.leftShin.rotation.x = Math.max(0, -leftStep) * (sprinting ? 0.72 : 0.48);
      this.visual.rightShin.rotation.x = Math.max(0, -rightStep) * (sprinting ? 0.72 : 0.48);
      this.visual.leftFoot.rotation.x = Math.max(0, leftStep) * -0.18;
      this.visual.rightFoot.rotation.x = Math.max(0, rightStep) * -0.18;
      this.visual.leftUpperArm.rotation.x = rightStep * amplitude * 0.62;
      this.visual.rightUpperArm.rotation.x = -0.2 + leftStep * amplitude * 0.22;
      this.visual.rightForearm.rotation.x = -0.18 - Math.max(0, leftStep) * 0.12;
      this.visual.hips.position.y = 1.25 + Math.abs(Math.sin(this.walkCycle)) * 0.035;
      this.visual.hips.rotation.y = Math.sin(this.walkCycle) * 0.035;
      this.visual.cape.rotation.x = 0.08 + Math.sin(this.walkCycle * 0.5) * 0.05 + speed * 0.012;
      this.footTimer -= delta;
      if (this.footTimer <= 0) {
        this.footTimer = sprinting ? 0.27 : 0.38;
        this.audio.footstep(sprinting ? 1.25 : 0.9);
      }
    } else {
      this.resetPose(Math.min(1, delta * 8));
      this.visual.hips.position.y = 1.25 + Math.sin(performance.now() * 0.0024) * 0.012;
      this.visual.cape.rotation.x = 0.08 + Math.sin(performance.now() * 0.0017) * 0.025;
    }
  }

  private resetPose(amount: number): void {
    const lerp = (node: any, axis: "x" | "y" | "z", target: number): void => {
      node.rotation[axis] = BABYLON.Scalar.Lerp(node.rotation[axis], target, amount);
    };

    lerp(this.visual.torso, "x", 0);
    lerp(this.visual.torso, "y", 0);
    lerp(this.visual.torso, "z", 0);
    lerp(this.visual.hips, "x", 0);
    lerp(this.visual.hips, "y", 0);
    lerp(this.visual.leftUpperArm, "x", 0);
    lerp(this.visual.leftUpperArm, "z", 0.08);
    lerp(this.visual.leftForearm, "x", 0);
    lerp(this.visual.leftForearm, "z", 0);
    lerp(this.visual.rightUpperArm, "x", -0.2);
    lerp(this.visual.rightUpperArm, "z", -0.08);
    lerp(this.visual.rightForearm, "x", -0.18);
    lerp(this.visual.rightForearm, "z", 0);
    lerp(this.visual.leftThigh, "x", 0);
    lerp(this.visual.rightThigh, "x", 0);
    lerp(this.visual.leftShin, "x", 0.05);
    lerp(this.visual.rightShin, "x", 0.05);
    lerp(this.visual.leftFoot, "x", 0);
    lerp(this.visual.rightFoot, "x", 0);
    lerp(this.visual.sword, "x", -Math.PI / 2);
    lerp(this.visual.sword, "y", 0);
    lerp(this.visual.sword, "z", -0.08);
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
      const score = distance - facing * 6;
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
    this.fpRig.position = new BABYLON.Vector3(0.33, -0.38, 0.82);
    this.fpRig.rotation = new BABYLON.Vector3(0.02, Math.PI, -0.04);

    const gauntlet = createMaterial(this.world.scene, "fp-gauntlet", "#2b4352", 0.34, 0.5);
    const sleeve = createMaterial(this.world.scene, "fp-sleeve", "#142631", 0.88, 0.03);
    this.fpRightArm = new BABYLON.TransformNode("fp-right-arm-rig", this.world.scene);
    this.fpRightArm.parent = this.fpRig;
    this.fpRightArm.position = new BABYLON.Vector3(0.1, -0.15, 0.02);
    const rightSleeve = BABYLON.MeshBuilder.CreateCylinder("fp-right-sleeve", {
      height: 0.72,
      diameterTop: 0.19,
      diameterBottom: 0.29,
      tessellation: 8
    }, this.world.scene);
    rightSleeve.position.y = -0.27;
    rightSleeve.material = sleeve;
    rightSleeve.parent = this.fpRightArm;
    const rightHand = BABYLON.MeshBuilder.CreateSphere("fp-right-hand", {
      diameter: 0.22,
      segments: 8
    }, this.world.scene);
    rightHand.position.y = -0.66;
    rightHand.material = gauntlet;
    rightHand.parent = this.fpRightArm;

    this.fpLeftArm = new BABYLON.TransformNode("fp-left-arm-rig", this.world.scene);
    this.fpLeftArm.parent = this.fpRig;
    this.fpLeftArm.position = new BABYLON.Vector3(-0.42, -0.19, 0.08);
    const leftSleeve = rightSleeve.clone("fp-left-sleeve");
    leftSleeve.parent = this.fpLeftArm;
    const leftHand = rightHand.clone("fp-left-hand");
    leftHand.parent = this.fpLeftArm;

    this.fpSword = createRiftglassSword(this.world.scene, "first-person-riftglass-edge");
    this.fpSword.parent = this.fpRightArm;
    this.fpSword.position = new BABYLON.Vector3(0, -0.69, 0.02);
    this.fpSword.rotation = new BABYLON.Vector3(-1.18, 0.12, -0.18);
    this.fpSword.scaling = new BABYLON.Vector3(1.08, 1.08, 1.08);

    this.fpRig.getChildMeshes().forEach((mesh: any) => {
      mesh.isPickable = false;
      mesh.renderingGroupId = 2;
    });
    this.fpRig.setEnabled(false);
  }

  private animateFirstPersonIdle(delta: number): void {
    if (!this.fpRig) return;
    const breath = Math.sin(performance.now() * 0.0022) * 0.008;
    this.fpRig.position.x = BABYLON.Scalar.Lerp(this.fpRig.position.x, 0.33, delta * 9);
    this.fpRig.position.y = BABYLON.Scalar.Lerp(this.fpRig.position.y, -0.38 + breath, delta * 9);
    this.fpRig.position.z = BABYLON.Scalar.Lerp(this.fpRig.position.z, 0.82, delta * 9);
    this.fpRig.rotation.x = BABYLON.Scalar.Lerp(this.fpRig.rotation.x, 0.02, delta * 10);
    this.fpRig.rotation.y = BABYLON.Scalar.Lerp(this.fpRig.rotation.y, Math.PI, delta * 10);
    this.fpRig.rotation.z = BABYLON.Scalar.Lerp(this.fpRig.rotation.z, -0.04, delta * 10);
    this.fpRightArm.rotation.x = BABYLON.Scalar.Lerp(this.fpRightArm.rotation.x, 0, delta * 10);
    this.fpRightArm.rotation.y = BABYLON.Scalar.Lerp(this.fpRightArm.rotation.y, 0, delta * 10);
    this.fpRightArm.rotation.z = BABYLON.Scalar.Lerp(this.fpRightArm.rotation.z, 0, delta * 10);
    this.fpLeftArm.rotation.x = BABYLON.Scalar.Lerp(this.fpLeftArm.rotation.x, 0.16, delta * 10);
    this.fpLeftArm.rotation.y = BABYLON.Scalar.Lerp(this.fpLeftArm.rotation.y, -0.18, delta * 10);
    this.fpLeftArm.rotation.z = BABYLON.Scalar.Lerp(this.fpLeftArm.rotation.z, -0.18, delta * 10);
  }

  private animateFirstPersonGuard(delta: number): void {
    const amount = Math.min(1, delta * 12);
    this.fpRig.position.x = BABYLON.Scalar.Lerp(this.fpRig.position.x, 0.08, amount);
    this.fpRig.position.y = BABYLON.Scalar.Lerp(this.fpRig.position.y, -0.23, amount);
    this.fpRig.position.z = BABYLON.Scalar.Lerp(this.fpRig.position.z, 0.66, amount);
    this.fpRig.rotation.x = BABYLON.Scalar.Lerp(this.fpRig.rotation.x, -0.28, amount);
    this.fpRig.rotation.y = BABYLON.Scalar.Lerp(this.fpRig.rotation.y, Math.PI - 0.15, amount);
    this.fpRig.rotation.z = BABYLON.Scalar.Lerp(this.fpRig.rotation.z, 0.58, amount);
    this.fpRightArm.rotation.x = BABYLON.Scalar.Lerp(this.fpRightArm.rotation.x, -0.48, amount);
    this.fpRightArm.rotation.z = BABYLON.Scalar.Lerp(this.fpRightArm.rotation.z, -0.32, amount);
    this.fpLeftArm.rotation.x = BABYLON.Scalar.Lerp(this.fpLeftArm.rotation.x, -0.42, amount);
    this.fpLeftArm.rotation.z = BABYLON.Scalar.Lerp(this.fpLeftArm.rotation.z, 0.46, amount);
  }

  private animateFirstPersonAttack(delta: number): void {
    if (!this.attack) return;
    const heavy = this.attack === "heavy";
    const duration = heavy ? 1.02 : 0.62;
    const progress = Math.min(1, this.attackTime / duration);
    const anticipation = easeInOut(progress / (heavy ? 0.3 : 0.22));
    const strike = easeOut((progress - (heavy ? 0.27 : 0.19)) / (heavy ? 0.37 : 0.34));
    const recovery = easeInOut((progress - (heavy ? 0.64 : 0.58)) / (heavy ? 0.36 : 0.42));
    const active = BABYLON.Scalar.Clamp(strike - recovery, 0, 1);

    this.fpRig.position.x = BABYLON.Scalar.Lerp(
      BABYLON.Scalar.Lerp(0.33, 0.7, anticipation),
      heavy ? -0.4 : -0.27,
      active
    );
    this.fpRig.position.y = BABYLON.Scalar.Lerp(
      BABYLON.Scalar.Lerp(-0.38, -0.14, anticipation),
      heavy ? -0.02 : -0.16,
      active
    );
    this.fpRig.position.z = BABYLON.Scalar.Lerp(
      BABYLON.Scalar.Lerp(0.82, 0.68, anticipation),
      heavy ? 0.28 : 0.42,
      active
    );
    this.fpRig.rotation.x = BABYLON.Scalar.Lerp(
      BABYLON.Scalar.Lerp(0.02, -0.5, anticipation),
      heavy ? 0.68 : 0.38,
      active
    );
    this.fpRig.rotation.y = BABYLON.Scalar.Lerp(
      BABYLON.Scalar.Lerp(Math.PI, Math.PI + 0.72, anticipation),
      Math.PI - (heavy ? 1.18 : 0.92),
      active
    );
    this.fpRig.rotation.z = BABYLON.Scalar.Lerp(
      BABYLON.Scalar.Lerp(-0.04, -0.76, anticipation),
      heavy ? 0.82 : 0.58,
      active
    );
    this.fpRightArm.rotation.x = BABYLON.Scalar.Lerp(-0.1, -0.65, anticipation);
    this.fpRightArm.rotation.z = BABYLON.Scalar.Lerp(-0.08, 0.34, active);
    this.fpLeftArm.rotation.x = heavy ? BABYLON.Scalar.Lerp(0.1, -0.35, anticipation) : 0.16;
    this.fpLeftArm.rotation.z = heavy ? BABYLON.Scalar.Lerp(-0.18, 0.38, anticipation) : -0.18;

    if (recovery > 0.15) this.animateFirstPersonIdle(delta * recovery * 0.9);
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
