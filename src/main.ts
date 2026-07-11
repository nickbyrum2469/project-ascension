import "./styles.css";
import "./combat-presentation.css";
import * as BabylonModule from "babylonjs";
import { RouteAudioDirector } from "./audio/RouteAudioDirector.js";
import { CaelusBaselineSurveyDirector } from "./core/CaelusBaselineSurveyDirector.js";
import { CaelusControlledTerrainDirector, installCaelusControlledTerrain } from "./core/CaelusControlledTerrainDirector.js";
import { installCaelusControlledTerrainPerimeterGuard } from "./core/CaelusControlledTerrainPerimeterGuard.js";
import { CaelusIntegratedRepairDirector } from "./core/CaelusIntegratedRepairDirector.js";
import { CaelusMigrationCompatibility } from "./core/CaelusMigrationCompatibility.js";
import { CaelusPhaseTwoPlaytestExtension } from "./core/CaelusPhaseTwoPlaytestExtension.js";
import { CaelusPhaseZeroDirector } from "./core/CaelusPhaseZeroDirector.js";
import { CaelusReferenceTownDirector } from "./core/CaelusReferenceTownDirector.js";
import { CaelusReferenceTownPolishDirector } from "./core/CaelusReferenceTownPolishDirector.js";
import { CaelusRoadConnectivityDirector } from "./core/CaelusRoadConnectivityDirector.js";
import { installCaelusTownPhaseOne } from "./core/CaelusTownPhaseOne.js";
import { CaelusTownBoundaryDirector } from "./core/CaelusTownBoundaryDirector.js";
import { CaelusTownPhaseTwo } from "./core/CaelusTownPhaseTwo.js";
import { CameraSafetyDirector } from "./core/CameraSafetyDirector.js";
import { CombatFeelDirector } from "./core/CombatFeelDirector.js";
import { CombatPresentationDirector } from "./core/CombatPresentationDirector.js";
import { FloorTwoArrivalDirector } from "./core/FloorTwoArrivalDirector.js";
import { FrontierContractDirector } from "./core/FrontierContractDirector.js";
import { PerformanceDirector } from "./core/PerformanceDirector.js";
import { PlaytestBridge } from "./core/PlaytestBridge.js";
import { VerticalSliceActorRebase } from "./core/VerticalSliceActorRebase.js";
import { VerticalSliceDirector } from "./core/VerticalSliceDirector.js";
import { installVerticalSliceRuntimeGuard } from "./core/VerticalSliceRuntimeGuard.js";
import { VerticalSliceTraversalGuard } from "./core/VerticalSliceTraversalGuard.js";
import { VisualRecoveryDirector } from "./core/VisualRecoveryDirector.js";
import { ExpeditionJournal } from "./ui/ExpeditionJournal.js";
import { LoadoutOverlay } from "./ui/LoadoutOverlay.js";

(globalThis as typeof globalThis & { BABYLON: typeof BabylonModule }).BABYLON = BabylonModule;

const getCanvas = (): HTMLCanvasElement => {
  const canvas = document.getElementById("render-canvas");
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Missing #render-canvas");
  return canvas;
};

const createEngine = async (canvas: HTMLCanvasElement): Promise<{ engine: any; renderer: string }> => {
  const webGpuAvailable = Boolean(BABYLON.WebGPUEngine)
    && "gpu" in navigator
    && await BABYLON.WebGPUEngine.IsSupportedAsync;

  if (webGpuAvailable) {
    try {
      const engine = new BABYLON.WebGPUEngine(canvas, {
        antialias: false,
        adaptToDeviceRatio: true,
        powerPreference: "high-performance"
      });
      await engine.initAsync();
      return { engine, renderer: "WebGPU" };
    } catch (error) {
      console.warn("WebGPU initialization failed; falling back to WebGL.", error);
    }
  }

  const engine = new BABYLON.Engine(canvas, false, {
    preserveDrawingBuffer: false,
    stencil: true,
    disableWebGL2Support: false,
    powerPreference: "high-performance"
  }, true);
  return { engine, renderer: "WebGL 2" };
};

const installAirborneCollisionGuard = async (): Promise<void> => {
  const { World } = await import("./world/World.js");
  const prototype = World.prototype as any;
  if (prototype.__airborneCollisionGuard) return;

  const resolve = prototype.resolvePlayerPosition;
  prototype.resolvePlayerPosition = function resolveWithoutFlatteningJumps(
    this: any,
    position: any,
    previous: any
  ): void {
    const airborneHeight = position.y;
    resolve.call(this, position, previous);
    const ground = this.heightAt(position.x, position.z);
    if (airborneHeight > ground + 0.002) position.y = airborneHeight;
  };
  prototype.__airborneCollisionGuard = true;
};

const installInterfacePauseGuard = (GameClass: any): void => {
  const prototype = GameClass.prototype as any;
  if (prototype.__interfacePauseGuard) return;
  const update = prototype.update;
  prototype.update = function pauseBehindArchiveInterfaces(this: any, delta: number): void {
    const interfaceOpen = document.querySelector(".journal-shell.open, .loadout-overlay.open") !== null;
    if (interfaceOpen) return;
    update.call(this, delta);
  };
  prototype.__interfacePauseGuard = true;
};

const applyEmergencyGpuBudget = (game: any): void => {
  const shadowMap = game.world.shadowGenerator?.getShadowMap?.();
  const shadowSize = shadowMap?.getSize?.();
  if (shadowMap?.resize && Number(shadowSize?.width ?? 0) > 1024) shadowMap.resize(1024);

  const dust = game.world.scene.particleSystems?.find((system: any) => system.name === "foundation-dust");
  if (dust) {
    dust.emitRate = Math.min(18, dust.emitRate);
    dust.updateSpeed = Math.min(0.012, dust.updateSpeed ?? 0.012);
  }
};

const installFloorTwoSafety = (game: any, floorTwo: FloorTwoArrivalDirector): void => {
  const state = floorTwo as any;
  const playerUpdate = game.player.update.bind(game.player);
  game.player.update = (...args: any[]): void => {
    if (state.upperActive && game.player.root.position.y < state.upperFloorY - 18) {
      state.upperActive = false;
      state.objective?.classList.remove("visible");
      game.expedition.liftActive = false;
      game.expedition.liftAtTop = false;
      game.expedition.liftTime = 0;
      game.expedition.completionReported = false;
      game.expedition.liftRoot.position.y = game.expedition.liftBaseY;
    }
    playerUpdate(...args);
  };

  for (const mesh of game.world.scene.meshes) {
    const name = String(mesh.name ?? "");
    if (name === "floor-two-arrival-terrace" || name.includes("floor-two-") && name.includes("-rail-")) {
      mesh.metadata = { ...(mesh.metadata ?? {}), cameraCollision: true };
      mesh.isPickable = true;
    }
  }
};

const consolidateFloorTwoStaticGeometry = (game: any): void => {
  const scene = game.world.scene;
  const preserved = [
    "floor-two-rift-shear",
    "floor-two-threshold-fragment",
    "floor-two-survey-lens"
  ];
  const groups = new Map<string, any[]>();

  for (const mesh of [...scene.meshes]) {
    const name = String(mesh.name ?? "");
    if (!name.startsWith("floor-two-") || preserved.some((prefix) => name.startsWith(prefix))) continue;
    if (!mesh.material || mesh.isDisposed?.() || Number(mesh.getTotalVertices?.() ?? 0) <= 0) continue;
    const key = String(mesh.material.uniqueId ?? mesh.material.name ?? "floor-two-material");
    const group = groups.get(key) ?? [];
    group.push(mesh);
    groups.set(key, group);
  }

  let sourceCount = 0;
  let batchCount = 0;
  for (const meshes of groups.values()) {
    if (meshes.length < 2) continue;
    const cameraCollision = meshes.some((mesh) => mesh.metadata?.cameraCollision === true);
    const receiveShadows = meshes.some((mesh) => mesh.receiveShadows === true);
    meshes.forEach((mesh) => {
      mesh.unfreezeWorldMatrix?.();
      mesh.computeWorldMatrix(true);
    });
    const merged = BABYLON.Mesh.MergeMeshes(meshes, true, true, undefined, false, false);
    if (!merged) {
      meshes.forEach((mesh) => mesh.freezeWorldMatrix?.());
      continue;
    }
    sourceCount += meshes.length;
    batchCount += 1;
    merged.name = `batched-floor-two-${batchCount}`;
    merged.metadata = cameraCollision ? { cameraCollision: true } : {};
    merged.isPickable = cameraCollision;
    merged.receiveShadows = receiveShadows;
    merged.computeWorldMatrix(true);
    merged.freezeWorldMatrix();
  }

  console.info(`[Performance] Batched ${sourceCount} Floor Two static meshes into ${batchCount} material groups.`);
};

const boot = async (): Promise<void> => {
  const canvas = getCanvas();
  const status = document.getElementById("boot-status");
  try {
    status && (status.textContent = "Synchronizing the Foundation lattice…");
    await installAirborneCollisionGuard();
    const { Game } = await import("./game/Game.js");
    installInterfacePauseGuard(Game);
    installVerticalSliceRuntimeGuard(VerticalSliceDirector);
    installCaelusTownPhaseOne(VerticalSliceDirector);
    installCaelusControlledTerrain(VerticalSliceDirector);
    installCaelusControlledTerrainPerimeterGuard(VerticalSliceDirector);
    const { engine, renderer } = await createEngine(canvas);
    const game = new Game(engine, canvas, renderer);
    new ExpeditionJournal();
    new LoadoutOverlay();
    game.world.mara.root.position.y += 0.31;
    applyEmergencyGpuBudget(game);
    new VisualRecoveryDirector(game);
    new VerticalSliceDirector(game);
    new CaelusPhaseZeroDirector(game);
    new VerticalSliceActorRebase(game);
    const floorTwo = new FloorTwoArrivalDirector(game);
    installFloorTwoSafety(game, floorTwo);
    new FrontierContractDirector(game);
    new VerticalSliceTraversalGuard(game);
    new CaelusTownPhaseTwo(game);
    consolidateFloorTwoStaticGeometry(game);
    new PerformanceDirector(engine, game.world, renderer);
    new CombatFeelDirector(game, engine);
    new CombatPresentationDirector(game);
    new CaelusIntegratedRepairDirector(game);
    new CaelusMigrationCompatibility(game);
    new CameraSafetyDirector(game);
    new RouteAudioDirector(game);
    new PlaytestBridge(game, renderer);
    new CaelusControlledTerrainDirector(game);
    new CaelusReferenceTownDirector(game);
    new CaelusReferenceTownPolishDirector(game);
    new CaelusRoadConnectivityDirector(game);
    new CaelusBaselineSurveyDirector(game);
    new CaelusTownBoundaryDirector(game);
    new CaelusPhaseTwoPlaytestExtension(game);
    game.run();
  } catch (error) {
    console.error(error);
    if (status) status.textContent = "The world lattice failed to initialize. Refresh or enable hardware acceleration.";
  }
};

void boot();
