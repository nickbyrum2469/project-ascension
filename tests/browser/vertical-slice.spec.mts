import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

interface Snapshot {
  started: boolean;
  paused: boolean;
  interfaceOpen: boolean;
  dialogueOpen: boolean;
  liftActive: boolean;
  inputEnabled: boolean;
  activeKeys: string[];
  simulatedFrames: number;
  x: number;
  y: number;
  z: number;
  ground: number;
  grounded: boolean;
  cameraMode: "first" | "third";
  stamina: number;
  attack: string | null;
  fps: number;
  verticalSliceVersion: number | null;
  caelusPhaseZeroVersion: number | null;
  caelusTownPhaseOneVersion: number | null;
  caelusTownBuildingCount: number;
  weaponMountInstalled: boolean;
  manualCameraLocked: boolean;
  protectedRouteCollisionVolumesRemoved: number;
  runtimeErrors: string[];
}

interface GeometryAudit {
  unsupportedRibs: string[];
  missingRequiredMeshes: string[];
  disabledRequiredMeshes: string[];
  terrainBumpTexture: string | null;
  townTerrainSamples: number[];
  townTerrainRange: number;
  collisionBoxes: number;
  verticalSliceVersion: number | null;
  caelusPhaseZeroVersion: number | null;
  caelusTownPhaseOneVersion: number | null;
  caelusTownBuildingCount: number;
  caelusTownDistricts: Record<string, { x: number; z: number }> | null;
  phaseOneCitizenCount: number;
  phaseOneMaterialCount: number;
  weaponMountInstalled: boolean;
  weaponMountParent: string | null;
  legacyCaelusMeshesEnabled: string[];
  rigidCityMeshesPresent: string[];
  unsupportedCityMeshesEnabled: string[];
  transparentArchitectureMaterials: string[];
  legacyCaelusCollisionVolumesRemoved: number;
  dynamicActorsRebased: boolean;
  protectedRouteCollisionVolumesRemoved: number;
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

const simulate = async (page: Page, seconds: number, codes: string[] = []): Promise<Snapshot> => (
  bridgeCall<Snapshot>(page, "simulate", seconds, codes)
);

const capture = async (page: Page, testInfo: TestInfo, name: string): Promise<void> => {
  await bridgeCall(page, "renderFrame");
  await page.waitForTimeout(75);
  const path = testInfo.outputPath("visual", `${name}.png`);
  await mkdir(dirname(path), { recursive: true });
  await page.locator("#render-canvas").screenshot({ path });
};

test("production vertical slice and organic Caelus town remain traversable and auditable", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`console: ${message.text()}`);
  });

  await page.goto("/?playtest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean((globalThis as any).__ASCENSION_PLAYTEST__), null, { timeout: 45_000 });
  await expect(page.locator("#enter-world")).toBeVisible();
  await page.locator("#enter-world").click();
  await expect(page.locator("#hud")).not.toHaveClass(/hidden/);
  await expect(page.locator("#combat-stance-indicator")).toBeVisible();
  await page.waitForTimeout(250);

  const start = await bridgeCall<Snapshot>(page, "snapshot");
  expect(start.started).toBe(true);
  expect(start.paused).toBe(false);
  expect(start.interfaceOpen).toBe(false);
  expect(start.dialogueOpen).toBe(false);
  expect(start.liftActive).toBe(false);
  expect(start.inputEnabled).toBe(true);
  expect(start.cameraMode).toBe("third");
  expect(start.verticalSliceVersion).toBe(2);
  expect(start.caelusPhaseZeroVersion).toBe(1);
  expect(start.caelusTownPhaseOneVersion).toBe(1);
  expect(start.caelusTownBuildingCount).toBe(18);
  expect(start.weaponMountInstalled).toBe(true);
  expect(start.manualCameraLocked).toBe(false);

  await bridgeCall(page, "keyDown", "KeyW");
  const heldInput = await bridgeCall<Snapshot>(page, "snapshot");
  expect(heldInput.activeKeys).toContain("KeyW");
  await bridgeCall(page, "keyUp", "KeyW");

  const frontierMovement = await simulate(page, 1.85, ["KeyW"]);
  expect(frontierMovement.simulatedFrames).toBeGreaterThanOrEqual(111);
  expect(frontierMovement.z).toBeLessThan(start.z - 3.5);

  const airborne = await simulate(page, 0.08, ["Space"]);
  expect(airborne.y).toBeGreaterThan(airborne.ground + 0.08);
  const landed = await simulate(page, 1.1);
  expect(landed.grounded).toBe(true);
  expect(Math.abs(landed.y - landed.ground)).toBeLessThan(0.08);

  await bridgeCall(page, "checkpoint", "frontier-combat");
  await simulate(page, 0.35);
  const combatReady = await bridgeCall<Snapshot>(page, "snapshot");
  expect(combatReady.cameraMode).toBe("third");
  expect(combatReady.grounded).toBe(true);

  await bridgeCall(page, "setPaused", true);
  const rightProfile = await bridgeCall<Snapshot>(page, "cameraPose", 4.25, 1.85, 0, 1.25);
  expect(rightProfile.manualCameraLocked).toBe(true);
  await capture(page, testInfo, "weapon-idle-right-profile");
  const leftProfile = await bridgeCall<Snapshot>(page, "cameraPose", -4.25, 1.85, 0, 1.25);
  expect(leftProfile.manualCameraLocked).toBe(true);
  await capture(page, testInfo, "weapon-idle-left-profile");
  const cameraReleased = await bridgeCall<Snapshot>(page, "clearCameraPose");
  expect(cameraReleased.manualCameraLocked).toBe(false);
  await bridgeCall(page, "setPaused", false);
  await simulate(page, 0.1);

  const staminaBeforeHeavy = combatReady.stamina;
  const heavy = await simulate(page, 0.08, ["KeyQ"]);
  expect(heavy.stamina).toBeLessThan(staminaBeforeHeavy - 20);
  expect(heavy.attack).toBe("heavy");
  await expect(page.locator("#combat-stance-indicator")).toHaveAttribute("data-state", "heavy");
  await capture(page, testInfo, "combat-third-person-heavy");
  await simulate(page, 1.05);

  const firstPerson = await simulate(page, 0.05, ["KeyV"]);
  expect(firstPerson.cameraMode).toBe("first");
  await simulate(page, 0.25);
  const firstPersonHeavy = await simulate(page, 0.08, ["KeyQ"]);
  expect(firstPersonHeavy.attack).toBe("heavy");
  await capture(page, testInfo, "combat-first-person-heavy");
  await simulate(page, 1.05);
  const thirdPerson = await simulate(page, 0.05, ["KeyV"]);
  expect(thirdPerson.cameraMode).toBe("third");

  await bridgeCall(page, "checkpoint", "gate-exterior");
  const throughGate = await simulate(page, 4.5, ["ShiftLeft", "KeyW"]);
  expect(throughGate.z).toBeGreaterThan(27);

  await bridgeCall(page, "checkpoint", "gate-interior");
  const mainStreetWalk = await simulate(page, 4.2, ["ShiftLeft", "KeyW"]);
  expect(mainStreetWalk.z).toBeGreaterThan(58);

  await bridgeCall(page, "teleport", -4, 101, -1.15);
  const marketLaneWalk = await simulate(page, 2.5, ["KeyW"]);
  expect(marketLaneWalk.x).toBeLessThan(-10);
  expect(marketLaneWalk.z).toBeGreaterThan(102);

  await bridgeCall(page, "teleport", 4, 103, 1.12);
  const guildLaneWalk = await simulate(page, 2.5, ["KeyW"]);
  expect(guildLaneWalk.x).toBeGreaterThan(10);
  expect(guildLaneWalk.z).toBeGreaterThan(104);

  const audit = await bridgeCall<GeometryAudit>(page, "geometryAudit");
  expect(audit.unsupportedRibs).toEqual([]);
  expect(audit.missingRequiredMeshes).toEqual([]);
  expect(audit.disabledRequiredMeshes).toEqual([]);
  expect(audit.terrainBumpTexture).toBeNull();
  expect(audit.townTerrainSamples).toHaveLength(7);
  expect(audit.townTerrainRange).toBeGreaterThan(0.45);
  expect(audit.townTerrainRange).toBeLessThan(2.2);
  expect(audit.collisionBoxes).toBeGreaterThan(25);
  expect(audit.verticalSliceVersion).toBe(2);
  expect(audit.caelusPhaseZeroVersion).toBe(1);
  expect(audit.caelusTownPhaseOneVersion).toBe(1);
  expect(audit.caelusTownBuildingCount).toBe(18);
  expect(audit.caelusTownDistricts).not.toBeNull();
  expect(Object.keys(audit.caelusTownDistricts ?? {})).toEqual(expect.arrayContaining([
    "gate", "mainStreet", "townCenter", "market", "guild", "residential", "service", "supply"
  ]));
  expect(audit.phaseOneCitizenCount).toBe(5);
  expect(audit.phaseOneMaterialCount).toBeGreaterThanOrEqual(13);
  expect(audit.weaponMountInstalled).toBe(true);
  expect(audit.weaponMountParent).toBe("warden-right-hand");
  expect(audit.legacyCaelusMeshesEnabled).toEqual([]);
  expect(audit.rigidCityMeshesPresent).toEqual([]);
  expect(audit.unsupportedCityMeshesEnabled).toEqual([]);
  expect(audit.transparentArchitectureMaterials).toEqual([]);
  expect(audit.legacyCaelusCollisionVolumesRemoved).toBe(5);
  expect(audit.dynamicActorsRebased).toBe(true);
  expect(audit.protectedRouteCollisionVolumesRemoved).toBeGreaterThan(0);

  const auditPath = testInfo.outputPath("caelus-phase-one-audit.json");
  await mkdir(dirname(auditPath), { recursive: true });
  await writeFile(auditPath, JSON.stringify({ start, audit }, null, 2));

  const views = [
    "spawn",
    "gate-exterior",
    "gate-interior",
    "city-main-south",
    "city-market",
    "city-center",
    "city-guild",
    "city-residential",
    "city-service",
    "city-supply",
    "city-north",
    "frontier",
    "foundry-breach"
  ];
  for (const view of views) {
    await bridgeCall(page, "checkpoint", view);
    await simulate(page, 0.2);
    await capture(page, testInfo, view);
  }

  await bridgeCall(page, "unlockVerticalSlice");
  await bridgeCall(page, "checkpoint", "foundry-breach");
  const insideBreach = await simulate(page, 8, ["KeyW"]);
  expect(insideBreach.x).toBeGreaterThan(462);
  expect(insideBreach.z).toBeLessThan(-461.5);

  for (const view of ["foundry-entry", "foundry-core", "pillar-lift"]) {
    await bridgeCall(page, "checkpoint", view);
    await simulate(page, 0.2);
    await capture(page, testInfo, view);
  }

  const runtimeErrors = await bridgeCall<string[]>(page, "errors");
  const evidencePath = testInfo.outputPath("browser-console.json");
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, JSON.stringify({ consoleErrors, runtimeErrors }, null, 2));

  expect(runtimeErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
