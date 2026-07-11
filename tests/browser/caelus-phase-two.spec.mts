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
  roadVisualRevision: number;
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
  curbHalfWidth: number;
  curbHeightOffset: number;
  channelHalfWidth: number;
  channelHeightOffset: number;
  phaseTwoMaterialCount: number;
}

interface IntegratedCityAudit {
  version: number;
  buildingCount: number;
  curbSegmentCount: number;
  junctionCount: number;
  removedCollision: number;
  hiddenLegacyCount: number;
  enabledIntegratedCount: number;
  junctionAwareCurbCount: number;
  frontagePathCount: number;
  missingRequired: string[];
  transparentIntegratedMaterials: string[];
  swordForwardVerified: boolean;
  swordForwardDotBeforeCorrection: number;
  stableGuardInstalled: boolean;
}

interface GuardStabilityProbe {
  frames: number;
  displacement: number;
  rootPitch: number;
  rootRoll: number;
  hipPitch: number;
  hipRoll: number;
  torsoOffsetY: number;
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

const captureLockedView = async (
  page: Page,
  testInfo: TestInfo,
  name: string,
  player: [number, number, number],
  camera: [number, number, number, number]
): Promise<void> => {
  await bridgeCall(page, "teleport", ...player);
  await bridgeCall(page, "setPaused", true);
  await bridgeCall(page, "cameraPose", ...camera);
  await capture(page, testInfo, name);
  await bridgeCall(page, "clearCameraPose");
  await bridgeCall(page, "setPaused", false);
};

test("Caelus integrated city and combat repair is production-safe", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`console: ${message.text()}`);
  });

  await page.goto("/?playtest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean((globalThis as any).__ASCENSION_PLAYTEST__), null, { timeout: 45_000 });
  await page.locator("#enter-world").click();
  await expect(page.locator("#hud")).not.toHaveClass(/hidden/);
  await bridgeCall(page, "renderFrame");

  const start = await bridgeCall<Snapshot>(page, "snapshot");
  expect(start.started).toBe(true);
  expect(start.cameraMode).toBe("third");

  const audit = await bridgeCall<PhaseTwoAudit>(page, "phaseTwoAudit");
  expect(audit.version).toBe(1);
  expect(audit.roadVisualRevision).toBe(3);
  expect(audit.wellRecovered).toBe(true);
  expect(audit.drainageBandCount).toBe(20);
  expect(audit.missingDrainageMeshes).toEqual([]);
  expect(audit.disabledDrainageMeshes).toEqual([]);
  expect(audit.transparentPhaseTwoMaterials).toEqual([]);
  expect(audit.roadMaterialFrozen).toBe(true);
  expect(audit.roadEdgeMaterialFrozen).toBe(true);
  expect(audit.curbHalfWidth).toBeCloseTo(0.22, 3);
  expect(audit.channelHalfWidth).toBeCloseTo(0.14, 3);
  expect(audit.phaseTwoMaterialCount).toBe(2);
  expect(audit.collisionAudit).not.toBeNull();
  expect(audit.collisionAudit?.duplicatePairs).toBe(0);
  expect(audit.collisionAudit?.mainRouteIntrusions).toBe(0);

  const integrated = await bridgeCall<IntegratedCityAudit>(page, "integratedCityAudit");
  expect(integrated.version).toBe(1);
  expect(integrated.buildingCount).toBe(14);
  expect(integrated.junctionCount).toBe(7);
  expect(integrated.curbSegmentCount).toBeGreaterThan(100);
  expect(integrated.junctionAwareCurbCount).toBeGreaterThan(50);
  expect(integrated.frontagePathCount).toBe(14);
  expect(integrated.enabledIntegratedCount).toBeGreaterThan(80);
  expect(integrated.hiddenLegacyCount).toBeGreaterThanOrEqual(30);
  expect(integrated.removedCollision).toBeGreaterThan(10);
  expect(integrated.missingRequired).toEqual([]);
  expect(integrated.transparentIntegratedMaterials).toEqual([]);
  expect(integrated.swordForwardVerified).toBe(true);
  expect(integrated.stableGuardInstalled).toBe(true);

  const probes: Array<[string, [number, number, number, number]]> = [
    ["east", [-14, 118, -19, 118]],
    ["west", [-28, 118, -23, 118]],
    ["south", [-21, 111, -21, 116]],
    ["north", [-21, 125, -21, 120]]
  ];
  const probeEvidence: Record<string, CollisionProbe> = {};
  for (const [name, values] of probes) {
    const result = await bridgeCall<CollisionProbe>(page, "phaseTwoCollisionProbe", ...values);
    expect(result.blocked, `${name} approach must collide with the integrated well rim`).toBe(true);
    probeEvidence[name] = result;
  }

  const clearSouth = await bridgeCall<CollisionProbe>(page, "phaseTwoCollisionProbe", 0, 96, 0, 108);
  const clearNorth = await bridgeCall<CollisionProbe>(page, "phaseTwoCollisionProbe", 0, 122, 0, 136);
  expect(clearSouth.blocked).toBe(false);
  expect(clearNorth.blocked).toBe(false);

  await bridgeCall(page, "teleport", 0, 92, 0);
  const mainStreetMovement = await bridgeCall<Snapshot>(page, "simulate", 5.5, ["ShiftLeft", "KeyW"]);
  expect(mainStreetMovement.z).toBeGreaterThan(120);

  // Thirty rendered guard frames are enough to catch the former cumulative backflip regression
  // while keeping software-WebGL CI inside the production evidence budget.
  const guard = await bridgeCall<GuardStabilityProbe>(page, "guardStabilityProbe", 0.5);
  expect(guard.frames).toBe(30);
  expect(guard.displacement).toBeLessThan(0.01);
  expect(Math.abs(guard.rootPitch)).toBeLessThan(0.001);
  expect(Math.abs(guard.rootRoll)).toBeLessThan(0.001);
  expect(Math.abs(guard.hipPitch)).toBeLessThan(0.2);
  expect(Math.abs(guard.hipRoll)).toBeLessThan(0.001);
  expect(Math.abs(guard.torsoOffsetY)).toBeLessThan(0.001);

  await captureLockedView(page, testInfo, "phase2-main-road-drainage", [0, 91, 0], [13, 8, -15, 1.8]);
  await captureLockedView(page, testInfo, "phase2-relocated-town-well", [-21, 118, 0], [11, 8, -13, 2.2]);
  await captureLockedView(page, testInfo, "phase2-market-lane-drainage", [-49, 121, -0.8], [14, 9, -15, 1.8]);
  await captureLockedView(page, testInfo, "phase2-guild-lane-drainage", [50, 130, 0.8], [-15, 9, -15, 2]);
  await captureLockedView(page, testInfo, "integrated-gate-close", [0, 8, 0], [16, 9, -18, 6]);
  await captureLockedView(page, testInfo, "integrated-main-junction-close", [0, 103, 0], [11, 7, -12, 1.4]);

  await bridgeCall(page, "teleport", 12, 112, 0);
  await bridgeCall(page, "setPaused", false);
  await bridgeCall(page, "simulate", 0.1, ["MouseRight"]);
  await capture(page, testInfo, "integrated-sword-forward-profile");

  const runtimeErrors = await bridgeCall<string[]>(page, "errors");
  const evidencePath = testInfo.outputPath("integrated-city-audit.json");
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, JSON.stringify({
    audit,
    integrated,
    guard,
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
