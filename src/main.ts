import "./styles.css";
import * as BabylonModule from "babylonjs";
import { PerformanceDirector } from "./core/PerformanceDirector.js";
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
    if (airborneHeight > ground + 0.14) position.y = airborneHeight;
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

const boot = async (): Promise<void> => {
  const canvas = getCanvas();
  const status = document.getElementById("boot-status");
  try {
    status && (status.textContent = "Synchronizing the Foundation lattice…");
    await installAirborneCollisionGuard();
    const { Game } = await import("./game/Game.js");
    installInterfacePauseGuard(Game);
    const { engine, renderer } = await createEngine(canvas);
    const game = new Game(engine, canvas, renderer);
    new ExpeditionJournal();
    new LoadoutOverlay();
    game.world.mara.root.position.y += 0.31;
    applyEmergencyGpuBudget(game);
    new PerformanceDirector(engine, game.world, renderer);
    game.run();
  } catch (error) {
    console.error(error);
    if (status) status.textContent = "The world lattice failed to initialize. Refresh or enable hardware acceleration.";
  }
};

void boot();
