export class CombatRigCorrectionDirector {
  private readonly scene: any;
  private readonly player: any;
  private readonly visual: any;
  private readonly sword: any;
  private readonly swordMount: any;
  private readonly tipMarker: any;
  private readonly hiltMarker: any;
  private guardAnchor: any | null = null;
  private lastForwardDot = 0;
  private guardFrames = 0;

  constructor(private readonly game: any) {
    this.scene = game.world.scene;
    this.player = game.player;
    this.visual = game.player.visual;
    this.sword = this.visual?.sword;
    this.swordMount = this.installCanonicalSwordMount();
    this.hiltMarker = this.createMarker("warden-sword-hilt-marker", 0.2);
    this.tipMarker = this.createMarker("warden-sword-tip-marker", 2.18);

    this.scene.onBeforeRenderObservable.add(() => this.update());
    this.scene.metadata = {
      ...(this.scene.metadata ?? {}),
      combatRigCorrectionVersion: 1,
      swordForwardRuleInstalled: Boolean(this.swordMount && this.tipMarker && this.hiltMarker),
      stableGuardRuleInstalled: true
    };
  }

  private installCanonicalSwordMount(): any {
    if (!this.sword || !this.visual?.rightHand) return null;

    let mount = this.scene.getTransformNodeByName?.("caelus-third-person-sword-mount");
    if (!mount) {
      mount = new BABYLON.TransformNode("caelus-third-person-sword-mount", this.scene);
      mount.parent = this.visual.rightHand;
    }

    mount.parent = this.visual.rightHand;
    mount.position = new BABYLON.Vector3(0.04, -0.03, 0.09);
    mount.rotationQuaternion = null;
    mount.rotation = new BABYLON.Vector3(0, 0, 0);

    this.sword.parent = mount;
    this.sword.position = new BABYLON.Vector3(0, -0.02, 0.02);
    this.sword.rotationQuaternion = null;
    this.sword.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0.06);
    this.sword.scaling = new BABYLON.Vector3(1, 1, 1);
    return mount;
  }

  private createMarker(name: string, localY: number): any {
    if (!this.sword) return null;
    const existing = this.scene.getTransformNodeByName?.(name);
    if (existing) return existing;
    const marker = new BABYLON.TransformNode(name, this.scene);
    marker.parent = this.sword;
    marker.position = new BABYLON.Vector3(0, localY, 0);
    return marker;
  }

  private update(): void {
    if (!this.sword || !this.visual?.root?.isEnabled?.()) return;

    const attacking = Boolean(this.player.attack);
    if (this.player.blocking) {
      this.applyStableGuard();
    } else {
      this.guardAnchor = null;
      this.guardFrames = 0;
      if (!attacking) this.applyForwardIdle();
      else this.correctAttackForwardAxis();
    }

    this.updateForwardAudit();
  }

  private applyForwardIdle(): void {
    this.sword.position.set(0, -0.02, 0.02);
    this.sword.rotation.set(Math.PI / 2, 0, 0.06);
  }

  private correctAttackForwardAxis(): void {
    if (this.sword.rotation.x < 0) this.sword.rotation.x *= -1;
  }

  private applyStableGuard(): void {
    if (!this.guardAnchor) this.guardAnchor = this.player.root.position.clone();
    this.guardFrames += 1;

    this.player.root.position.x = this.guardAnchor.x;
    this.player.root.position.z = this.guardAnchor.z;
    if (this.player.velocity) {
      this.player.velocity.x = 0;
      this.player.velocity.z = 0;
    }

    this.player.root.rotation.x = 0;
    this.player.root.rotation.z = 0;
    this.visual.hips.rotation.set(-0.045, 0, 0);
    this.visual.torso.rotation.set(0, -0.1, 0);
    this.visual.torso.position.y = 0;

    this.visual.leftThigh.rotation.x = -0.08;
    this.visual.rightThigh.rotation.x = -0.06;
    this.visual.leftShin.rotation.x = 0.15;
    this.visual.rightShin.rotation.x = 0.13;
    this.visual.leftFoot.rotation.x = 0;
    this.visual.rightFoot.rotation.x = 0;

    this.visual.rightUpperArm.rotation.set(-1.12, 0, -0.34);
    this.visual.rightForearm.rotation.set(-0.92, 0, 0.22);
    this.visual.leftUpperArm.rotation.set(-0.86, 0, 0.38);
    this.visual.leftForearm.rotation.set(-0.68, 0, -0.08);

    this.sword.position.set(0, -0.02, 0.03);
    this.sword.rotation.set(0.82, -0.1, -0.72);
  }

  private updateForwardAudit(): void {
    this.sword.computeWorldMatrix?.(true);
    this.hiltMarker?.computeWorldMatrix?.(true);
    this.tipMarker?.computeWorldMatrix?.(true);
    const hilt = this.hiltMarker?.getAbsolutePosition?.();
    const tip = this.tipMarker?.getAbsolutePosition?.();
    if (!hilt || !tip) return;

    const blade = tip.subtract(hilt);
    blade.y = 0;
    const forward = this.player.forward();
    if (blade.lengthSquared() > 0.0001) blade.normalize();
    if (forward.lengthSquared() > 0.0001) forward.normalize();
    this.lastForwardDot = BABYLON.Vector3.Dot(blade, forward);

    this.scene.metadata = {
      ...(this.scene.metadata ?? {}),
      swordForwardDot: Number(this.lastForwardDot.toFixed(4)),
      guardFramesStable: this.guardFrames,
      guardAnchorActive: Boolean(this.guardAnchor),
      guardRootRoll: Number(this.player.root.rotation.z.toFixed(4)),
      guardRootPitch: Number(this.player.root.rotation.x.toFixed(4))
    };
  }
}
