import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

interface Snapshot {
  x: number;
  z: number;
  started: boolean;
  cameraMode: "first" | "third";
  runtimeErrors: string[];
}

interface CollisionAudit {
  total: number;
  duplicatePairs: number;
  mainRouteIntrusions: number;
  wellCollisions: number;
}

interface PhaseTwoAudit {
  version: number;
  wellRecovered: boolean;
  drainageBandCount: number;
  collisionAudit: CollisionAudit | null;
  missingDrainageMeshes: string[];
  disabledDrainageMeshes: string[];
  transparentPhaseTwoMaterials: string[];
  wellRootOffsetX: number;
  wellCollisionCenter: { x: number; z: number } | null;
  wellRelocated: boolean;
  roadMaterialFrozen: boolean;
  roadEdgeMaterialFrozen: boolean;
  phaseTwoMaterialCount: number;
}

interface CollisionProbe {
  fromX: number;
  fromZ: number;
  requestedX: number;
  requestedZ: number;
  resolvedX: number;
  resolvedZ: number;
  blocked: boolean;
}

const bridgeCall = async <T>(page: Page, method: string, ...args: unknown[]): Promise<T> => page.evaluate(
  ({ methodName, values }) => {
    const bridge = (globalThis as any).__ASCENSION_PLAYTEST__;
    if (!bridge) throw new Error("Playtest bridge is not installed.");
    const target = bridge[methodName];
    if (typeof target !== "function") throw new Error(`Unknown bridge method: ${methodName}`);
    return target(...values);
  },
  { methodName: method, values: args }
);

const capture = async (page: Page, testInfo: TestInfo, name: string): Promise<void> => {
  await bridgeCall(page, "renderFrame");
  await page.waitForTimeout(25);
  const canvas = page.locator("#render-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Render canvas has no screenshot bounds.");
  const path = testInfo.outputPath("visual", `${name}.png`);
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({
    path,
    animations: "disabled",
    clip: {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height
    }
  });
};

test("Caelus Phase Two roads and civic collision are production-safe", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`console: ${message.text()}`);
  });

  await page.goto("/?playtest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean((globalThis as any).__ASCENSION_PLAYTEST__), null, { timeout: 45_000 });
  await page.locator("#enter-world").click();
  await expect(page.locator("#hud")).not.toHaveClass(/hidden/);

  const start = await bridgeCall<Snapshot>(page, "snapshot");
  expect(start.started).toBe(true);
  expect(start.cameraMode).toBe("third");

  const audit = await bridgeCall<PhaseTwoAudit>(page, "phaseTwoAudit");
  expect(audit.version).toBe(1);
  expect(audit.wellRecovered).toBe(true);
  expect(audit.drainageBandCount).toBe(20);
  expect(audit.missingDrainageMeshes).toEqual([]);
  expect(audit.disabledDrainageMeshes).toEqual([]);
  expect(audit.transparentPhaseTwoMaterials).toEqual([]);
  expect(audit.wellRootOffsetX).toBe(-7);
  expect(audit.wellCollisionCenter).toEqual({ x: -10, z: 112 });
  expect(audit.wellRelocated).toBe(true);
  expect(audit.roadMaterialFrozen).toBe(true);
  expect(audit.roadEdgeMaterialFrozen).toBe(true);
  expect(audit.phaseTwoMaterialCount).toBe(2);
  expect(audit.collisionAudit).not.toBeNull();
  expect(audit.collisionAudit?.duplicatePairs).toBe(0);
  expect(audit.collisionAudit?.mainRouteIntrusions).toBe(0);
  expect(audit.collisionAudit?.wellCollisions).toBeGreaterThanOrEqual(1);
  expect(audit.collisionAudit?.total).toBeGreaterThan(70);

  const probes: Array<[string, [number, number, number, number]]> = [
    ["east", [-5, 112, -8, 112]],
    ["west", [-15, 112, -12, 112]],
    ["south", [-10, 106, -10, 110]],
    ["north", [-10, 118, -10, 114]]
  ];
  const probeEvidence: Record<string, CollisionProbe> = {};
  for (const [name, values] of probes) {
    const result = await bridgeCall<CollisionProbe>(page, "phaseTwoCollisionProbe", ...values);
    expect(result.blocked, `${name} approach must collide with the well`).toBe(true);
    probeEvidence[name] = result;
  }

  const clearSouth = await bridgeCall<CollisionProbe>(page, "phaseTwoCollisionProbe", 0, 96, 0, 108);
  const clearNorth = await bridgeCall<CollisionProbe>(page, "phaseTwoCollisionProbe", 0, 122, 0, 136);
  expect(clearSouth.blocked).toBe(false);
  expect(clearNorth.blocked).toBe(false);

  await bridgeCall(page, "teleport", 0, 92, 0);
  const mainStreetMovement = await bridgeCall<Snapshot>(page, "simulate", 5.5, ["ShiftLeft", "KeyW"]);
  expect(mainStreetMovement.z).toBeGreaterThan(120);

  await bridgeCall(page, "teleport", 0, 70, 0);
  await bridgeCall(page, "simulate", 0.12);
  await capture(page, testInfo, "phase2-main-road-drainage");

  await bridgeCall(page, "teleport", -2, 112, -Math.PI / 2);
  await bridgeCall(page, "simulate", 0.12);
  await capture(page, testInfo, "phase2-relocated-town-well");

  await bridgeCall(page, "teleport", -20, 103, -0.8);
  await bridgeCall(page, "simulate", 0.12);
  await capture(page, testInfo, "phase2-market-lane-drainage");

  await bridgeCall(page, "teleport", 24, 108, 0.8);
  await bridgeCall(page, "simulate", 0.12);
  await capture(page, testInfo, "phase2-guild-lane-drainage");

  const runtimeErrors = await bridgeCall<string[]>(page, "errors");
  const evidencePath = testInfo.outputPath("phase-two-collision-audit.json");
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, JSON.stringify({
    audit,
    probeEvidence,
    clearSouth,
    clearNorth,
    mainStreetMovement,
    consoleErrors,
    runtimeErrors
  }, null, 2));

  expect(runtimeErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
