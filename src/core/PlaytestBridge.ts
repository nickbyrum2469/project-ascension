type CameraMode = "first" | "third";
type KeyEventType = "keydown" | "keyup";

interface PlaytestCheckpoint {
  x: number;
  z: number;
  yaw: number;
}

const checkpoints: Record<string, PlaytestCheckpoint> = {
  spawn: { x: 0, z: -2, yaw: Math.PI },
  "gate-exterior": { x: 0, z: 5, yaw: 0 },
  "city-boulevard": { x: 0, z: 74, yaw: 0 },
  "city-plaza": { x: 0, z: 112, yaw: 0 },
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

  constructor(game: any, renderer: string) {
    if (!new URLSearchParams(window.location.search).has("playtest")) return;
    this.game = game;

    window.addEventListener("error", (event) => {
      this.errors.push(`${event.message} @ ${event.filename}:${event.lineno}:${event.colno}`);
    });
    window.addEventListener("unhandledrejection", (event) => {
      this.errors.push(`Unhandled rejection: ${serializeReason(event.reason)}`);
    });

    const api = {
      version: 3,
      renderer,
      checkpoints: Object.keys(checkpoints),
      snapshot: () => this.snapshot(),
      checkpoint: (name: string) => this.moveToCheckpoint(name),
      teleport: (x: number, z: number, yaw = Math.PI) => this.teleport(x, z, yaw),
      setView: (mode: CameraMode) => this.setView(mode),
      keyDown: (code: string) => this.dispatchKey("keydown", code),
      keyUp: (code: string) => this.dispatchKey("keyup", code),
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
      verticalSliceVersion: this.game.world.scene.metadata?.verticalSliceVersion ?? null,
      protectedRouteCollisionVolumesRemoved:
        this.game.world.scene.metadata?.protectedRouteCollisionVolumesRemoved ?? 0,
      runtimeErrors: [...this.errors]
    };
  }

  private moveToCheckpoint(name: string): Record<string, unknown> {
    const checkpoint = checkpoints[name];
    if (!checkpoint) throw new Error(`Unknown playtest checkpoint: ${name}`);
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

    return {
      unsupportedRibs,
      missingRequiredMeshes: requiredMeshes.filter((name) => !scene.getMeshByName?.(name)),
      disabledRequiredMeshes: requiredMeshes.filter((name) => scene.getMeshByName?.(name) && !enabled(name)),
      terrainMaterial: scene.getMaterialByName?.("windscar-ground")?.name ?? null,
      terrainBumpTexture: scene.getMaterialByName?.("windscar-ground")?.bumpTexture?.name ?? null,
      collisionBoxes: this.game.world.collisionBoxes?.length ?? 0,
      verticalSliceVersion: scene.metadata?.verticalSliceVersion ?? null,
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
