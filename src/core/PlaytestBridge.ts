type CameraMode = "first" | "third";
type KeyEventType = "keydown" | "keyup";

interface PlaytestCheckpoint {
  x: number;
  z: number;
  yaw: number;
}

interface ManualCameraPose {
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  targetY: number;
}

const checkpoints: Record<string, PlaytestCheckpoint> = {
  spawn: { x: 0, z: -2, yaw: Math.PI },
  "frontier-combat": { x: 0, z: -60, yaw: Math.PI },
  "gate-exterior": { x: 0, z: 5, yaw: 0 },
  "gate-interior": { x: 0, z: 34, yaw: 0 },
  "city-boulevard": { x: 0, z: 74, yaw: 0 },
  "city-market": { x: 0, z: 91, yaw: 0 },
  "city-plaza": { x: 0, z: 112, yaw: 0 },
  "city-north": { x: 0, z: 176, yaw: Math.PI },
  frontier: { x: -22, z: -156, yaw: Math.PI * 0.9 },
  "foundry-breach": { x: 448, z: -451, yaw: Math.PI * 0.7 },
  "foundry-entry": { x: 475, z: -470, yaw: Math.PI },
  "foundry-core": { x: 475, z: -592, yaw: Math.PI },
  "pillar-lift": { x: 475, z: -606, yaw: Math.PI }
};

const serializeReason = (reason: unknown): string => {
  if (reason instanceof Error) return `${reason.name}: ${reason.message}`;
  if (typeof reason === "string") return reason;
  try {
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
};

export class PlaytestBridge {
  private readonly game: any;
  private readonly errors: string[] = [];
  private simulatedFrames = 0;
  private manualCameraPose: ManualCameraPose | null = null;

  constructor(game: any, renderer: string) {
    if (!new URLSearchParams(window.location.search).has("playtest")) return;
    this.game = game;

    window.addEventListener("error", (event) => {
      this.errors.push(`${event.message} @ ${event.filename}:${event.lineno}:${event.colno}`);
    });
    window.addEventListener("unhandledrejection", (event) => {
      this.errors.push(`Unhandled rejection: ${serializeReason(event.reason)}`);
    });
    this.game.world.scene.onBeforeRenderObservable.add(() => this.applyManualCameraPose());

    const api = {
      version: 6,
      renderer,
      checkpoints: Object.keys(checkpoints),
      snapshot: () => this.snapshot(),
      checkpoint: (name: string) => this.moveToCheckpoint(name),
      teleport: (x: number, z: number, yaw = Math.PI) => this.teleport(x, z, yaw),
      setView: (mode: CameraMode) => this.setView(mode),
      setPaused: (paused: boolean) => this.setPaused(paused),
      cameraPose: (offsetX: number, offsetY: number, offsetZ: number, targetY = 1.2) => (
        this.cameraPose(offsetX, offsetY, offsetZ, targetY)
      ),
      clearCameraPose: () => this.clearCameraPose(),
      keyDown: (code: string) => this.dispatchKey("keydown", code),
      keyUp: (code: string) => this.dispatchKey("keyup", code),
      simulate: (seconds: number, codes: string[] = []) => this.simulate(seconds, codes),
      renderFrame: () => this.renderFrame(),
      clearInput: () => this.clearInput(),
      clearErrors: () => { this.errors.length = 0; },
      errors: () => [...this.errors],
      geometryAudit: () => this.geometryAudit(),
      unlockVerticalSlice: () => this.unlockVerticalSlice()
    };

    (globalThis as typeof globalThis & { __ASCENSION_PLAYTEST__?: typeof api }).__ASCENSION_PLAYTEST__ = api;
    document.documentElement.dataset.playtestReady = "true";
  }

  private snapshot(): Record<string, unknown> {
    const player = this.game.player;
    const position = player.root.position;
    const ground = this.game.world.heightAt(position.x, position.z);
    const input = this.game.input as any;
    const interfaceOpen = document.querySelector(".journal-shell.open, .loadout-overlay.open") !== null;
    return {
      started: Boolean(this.game.started),
      paused: Boolean(this.game.paused),
      interfaceOpen,
      dialogueOpen: Boolean(this.game.hud?.isDialogueOpen?.()),
      liftActive: Boolean(this.game.expedition?.isLiftActive?.()),
      ascentCinematicTime: Number(this.game.ascentCinematicTime ?? 0),
      inputEnabled: Boolean(input?.enabled),
      activeKeys: Array.from(input?.keys ?? []),
      simulatedFrames: this.simulatedFrames,
      x: Number(position.x.toFixed(3)),
      y: Number(position.y.toFixed(3)),
      z: Number(position.z.toFixed(3)),
      ground: Number(ground.toFixed(3)),
      grounded: Boolean(player.grounded),
      cameraMode: player.cameraMode,
      health: player.health,
      stamina: Number(player.stamina.toFixed(2)),
      focus: Number(player.focus.toFixed(2)),
      attack: player.attack,
      blocking: player.blocking,
      questStage: this.game.quests?.save?.quest?.stage ?? null,
      labyrinth: { ...(this.game.quests?.save?.labyrinth ?? {}) },
      expedition: { ...(this.game.quests?.save?.expedition ?? {}) },
      meshCount: this.game.world.scene.meshes.length,
      activeMeshes: this.game.world.scene.getActiveMeshes?.().length ?? 0,
      fps: Number(this.game.world.engine.getFps?.().toFixed?.(1) ?? 0),
      verticalSliceVersion: this.game.world.scene.metadata?.verticalSliceVersion ?? null,
      caelusPhaseZeroVersion: this.game.world.scene.metadata?.caelusPhaseZeroVersion ?? null,
      weaponMountInstalled: Boolean(this.game.world.scene.metadata?.weaponMountInstalled),
      manualCameraLocked: this.manualCameraPose !== null,
      protectedRouteCollisionVolumesRemoved:
        this.game.world.scene.metadata?.protectedRouteCollisionVolumesRemoved ?? 0,
      runtimeErrors: [...this.errors]
    };
  }

  private moveToCheckpoint(name: string): Record<string, unknown> {
    const checkpoint = checkpoints[name];
    if (!checkpoint) throw new Error(`Unknown playtest checkpoint: ${name}`);
    this.manualCameraPose = null;
    this.clearInput();
    this.teleport(checkpoint.x, checkpoint.z, checkpoint.yaw);
    return this.snapshot();
  }

  private teleport(x: number, z: number, yaw: number): void {
    const player = this.game.player;
    const ground = this.game.world.heightAt(x, z);
    player.root.position.set(x, ground, z);
    player.root.rotation.y = yaw;
    player.yaw = yaw;
    player.pitch = -0.12;
    player.velocity?.setAll?.(0);
    player.verticalVelocity = 0;
    player.grounded = true;
    player.dodgeTime = 0;
    player.attack = null;
    player.attackTime = 0;
    player.lockTarget = null;
    this.game.world.camera.position.copyFrom(player.root.position.add(new BABYLON.Vector3(0, 4, 8)));
  }

  private setView(mode: CameraMode): void {
    this.game.player.setCameraMode(mode, false);
  }

  private setPaused(paused: boolean): Record<string, unknown> {
    this.game.paused = paused;
    this.clearInput();
    return this.snapshot();
  }

  private cameraPose(
    offsetX: number,
    offsetY: number,
    offsetZ: number,
    targetY: number
  ): Record<string, unknown> {
    this.manualCameraPose = { offsetX, offsetY, offsetZ, targetY };
    this.applyManualCameraPose();
    return this.snapshot();
  }

  private clearCameraPose(): Record<string, unknown> {
    this.manualCameraPose = null;
    return this.snapshot();
  }

  private applyManualCameraPose(): void {
    const pose = this.manualCameraPose;
    if (!pose) return;
    const playerPosition = this.game.player.root.position;
    this.game.world.camera.position.set(
      playerPosition.x + pose.offsetX,
      playerPosition.y + pose.offsetY,
      playerPosition.z + pose.offsetZ
    );
    this.game.world.camera.setTarget(playerPosition.add(new BABYLON.Vector3(0, pose.targetY, 0)));
  }

  private dispatchKey(type: KeyEventType, code: string): void {
    const event = new KeyboardEvent(type, {
      code,
      key: code,
      bubbles: true,
      cancelable: true,
      repeat: false
    });
    window.dispatchEvent(event);
  }

  private simulate(seconds: number, codes: string[]): Record<string, unknown> {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 20) {
      throw new Error(`Invalid simulation duration: ${seconds}`);
    }
    this.clearInput();
    codes.forEach((code) => this.dispatchKey("keydown", code));
    const steps = Math.max(1, Math.ceil(seconds * 60));
    for (let index = 0; index < steps; index += 1) {
      this.game.update(1 / 60);
      this.simulatedFrames += 1;
    }
    codes.forEach((code) => this.dispatchKey("keyup", code));
    this.clearInput();
    return this.snapshot();
  }

  private renderFrame(): void {
    this.applyManualCameraPose();
    this.game.world.scene.render();
  }

  private clearInput(): void {
    const input = this.game.input as any;
    input?.keys?.clear?.();
    input?.pressed?.clear?.();
    input.mouseHeavy = false;
    input.mouseBlock = false;
  }

  private geometryAudit(): Record<string, unknown> {
    const scene = this.game.world.scene;
    const enabled = (name: string): boolean => Boolean(scene.getMeshByName?.(name)?.isEnabled?.());
    const disabledFamilies = ["foundation-rib-", "foundation-rib-collar-"];
    const unsupportedRibs = scene.meshes.filter((mesh: any) => {
      const name = String(mesh.name ?? "");
      return disabledFamilies.some((prefix) => name.startsWith(prefix)) && mesh.isEnabled?.();
    }).map((mesh: any) => mesh.name);

    const requiredMeshes = [
      "vertical-slice-caelus-boulevard",
      "vertical-slice-city-bodies-a",
      "vertical-slice-city-doors",
      "vertical-slice-city-windows",
      "vertical-slice-market-canopies",
      "vertical-slice-road-surface",
      "vertical-slice-route-bushes-a",
      "vertical-slice-route-rocks",
      "vertical-slice-foundry-cliff-wall",
      "vertical-slice-foundry-tunnel-floor",
      "foundry-spine-floor",
      "foundry-core-arena",
      "vertical-slice-core-to-pillar-catwalk",
      "vertical-slice-pillar-shell"
    ];

    const legacyPrefixes = [
      "caelus-south-wall-left",
      "caelus-south-wall-right",
      "caelus-north-wall",
      "caelus-west-wall",
      "caelus-east-wall",
      "caelus-wall-tower-",
      "caelus-central-plaza",
      "caelus-expedition-keep"
    ];
    const legacyCaelusMeshesEnabled = scene.meshes.filter((mesh: any) => {
      const name = String(mesh.name ?? "");
      return legacyPrefixes.some((prefix) => name.startsWith(prefix)) && mesh.isEnabled?.();
    }).map((mesh: any) => mesh.name);
    const legacyGate = scene.getTransformNodeByName?.("caelus-gate-root");
    if (legacyGate?.isEnabled?.()) legacyCaelusMeshesEnabled.push("caelus-gate-root");

    const unsupportedExact = new Set([
      "vertical-slice-wall-walks",
      "vertical-slice-wall-merlons",
      "vertical-slice-plaza-monuments",
      "vertical-slice-pillar-collars",
      "vertical-slice-pillar-ascent-rune"
    ]);
    const unsupportedCityMeshesEnabled = scene.meshes.filter((mesh: any) => {
      const name = String(mesh.name ?? "");
      return (
        unsupportedExact.has(name)
        || name.startsWith("vertical-slice-monument-ring-")
      ) && mesh.isEnabled?.();
    }).map((mesh: any) => mesh.name);

    const architecturePrefixes = [
      "vertical-slice-city-",
      "vertical-slice-plaster-",
      "vertical-slice-roof-",
      "vertical-slice-timber",
      "vertical-slice-plaza-",
      "vertical-slice-gate-",
      "vertical-slice-market-",
      "vertical-slice-banner"
    ];
    const transparentArchitectureMaterials = scene.materials.filter((material: any) => {
      const name = String(material.name ?? "");
      return architecturePrefixes.some((prefix) => name.startsWith(prefix))
        && (Number(material.alpha ?? 1) < 0.999 || Number(material.transparencyMode ?? 0) !== 0);
    }).map((material: any) => material.name);

    return {
      unsupportedRibs,
      missingRequiredMeshes: requiredMeshes.filter((name) => !scene.getMeshByName?.(name)),
      disabledRequiredMeshes: requiredMeshes.filter((name) => scene.getMeshByName?.(name) && !enabled(name)),
      terrainMaterial: scene.getMaterialByName?.("windscar-ground")?.name ?? null,
      terrainBumpTexture: scene.getMaterialByName?.("windscar-ground")?.bumpTexture?.name ?? null,
      collisionBoxes: this.game.world.collisionBoxes?.length ?? 0,
      verticalSliceVersion: scene.metadata?.verticalSliceVersion ?? null,
      caelusPhaseZeroVersion: scene.metadata?.caelusPhaseZeroVersion ?? null,
      weaponMountInstalled: Boolean(scene.getTransformNodeByName?.("caelus-third-person-sword-mount")),
      weaponMountParent: scene.getTransformNodeByName?.("caelus-third-person-sword-mount")?.parent?.name ?? null,
      legacyCaelusMeshesEnabled,
      unsupportedCityMeshesEnabled,
      transparentArchitectureMaterials,
      legacyCaelusCollisionVolumesRemoved: Number(scene.metadata?.legacyCaelusCollisionVolumesRemoved ?? 0),
      opaqueArchitectureMaterials: Number(scene.metadata?.opaqueArchitectureMaterials ?? 0),
      dynamicActorsRebased: Boolean(scene.metadata?.dynamicActorsRebased),
      protectedRouteCollisionVolumesRemoved:
        Number(scene.metadata?.protectedRouteCollisionVolumesRemoved ?? 0)
    };
  }

  private unlockVerticalSlice(): void {
    const save = this.game.quests.save;
    save.quest.accepted = true;
    save.quest.boarsDefeated = Math.max(3, save.quest.boarsDefeated ?? 0);
    save.quest.markerInvestigated = true;
    save.quest.completed = true;
    save.labyrinth.unlocked = true;
    save.labyrinth.entered = true;
    save.labyrinth.sigilsActivated = [true, true, true];
    save.labyrinth.guardianDefeated = true;
    save.labyrinth.coreRestored = true;
    save.labyrinth.shortcutOpened = true;
    this.game.labyrinth.setProgress(save.labyrinth);
    this.game.expedition.setProgress(save.expedition, true);
  }
}
