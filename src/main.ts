import "./styles.css";
import { Game } from "./game/Game.js";

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
        antialias: true,
        adaptToDeviceRatio: true,
        powerPreference: "high-performance"
      });
      await engine.initAsync();
      return { engine, renderer: "WebGPU" };
    } catch (error) {
      console.warn("WebGPU initialization failed; falling back to WebGL.", error);
    }
  }

  const engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: true,
    disableWebGL2Support: false,
    powerPreference: "high-performance"
  }, true);
  return { engine, renderer: "WebGL 2" };
};

const boot = async (): Promise<void> => {
  const canvas = getCanvas();
  const status = document.getElementById("boot-status");
  try {
    status && (status.textContent = "Synchronizing the Foundation lattice…");
    const { engine, renderer } = await createEngine(canvas);
    const game = new Game(engine, canvas, renderer);
    game.run();
  } catch (error) {
    console.error(error);
    if (status) status.textContent = "The world lattice failed to initialize. Refresh or enable hardware acceleration.";
  }
};

void boot();
