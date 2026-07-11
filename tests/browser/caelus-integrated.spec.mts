import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

interface Snapshot {
  started: boolean;
  cameraMode: "first" | "third";
  x: number;
  y: number;
  z: number;
  runtimeErrors: string[];
}

interface IntegratedTownAudit {
  curbInsideJunction: number;
  channelInsideJunction: number;
  roadBuildingOverlaps: number;
  buildingOverlapPairs: number;
  disconnectedFrontages: number;
  buildingCount: number;
  frontageCount: number;
  citizenCount: number;
  opaqueIntegratedMaterials: number;
  guildBoardRelocated: boolean;
  boarContractAvailable: boolean;
  wellHasDarkShaft: boolean;
  gateSolidMeshCount: number;
}

interface IntegratedCityAudit {
  version: number;
  audit: IntegratedTownAudit | null;
  roadCount: number;
  junctionCount: number;
  buildingCount: number;
  frontageCount: number;
  curbCount: number;
  channelCount: number;
  roadMeshCount: number;
  frontageMeshCount: number;
  hiddenSuperseded: number;
  visibleSuperseded: string[];
  transparentIntegratedMaterials: string[];
  integratedMaterialCount: number;
  gateSolidMeshCount: number;
  wellHasDarkShaft: boolean;
  guildHallPresent: boolean;
  guildBoardPosition: { x: number; z: number } | null;
  wellPosition: { x: number; z: number } | null;
}

interface CombatRigAudit {
  version: number;
  swordForwardRuleInstalled: boolean;
  stableGuardRuleInstalled: boolean;
  liveForwardDot: number;
  metadataForwardDot: number;
  guardFramesStable: number;
  guardAnchorActive: boolean;
  guardRootRoll: number;
  guardRootPitch: number;
  rootX: number;
  rootZ: number;
  swordParent: string | null;
  swordRotationX: number;
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
    clip: { x: box.x, y: box.y, width: box.width, height: box.height }
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

test("integrated Caelus city, forward sword, and stable guard are production-safe", async ({ page }, testInfo) => {
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

  const audit = await bridgeCall<IntegratedCityAudit>(page, "integratedCityAudit");
  expect(audit.version).toBe(1);
  expect(audit.roadCount).toBe(5);
  expect(audit.junctionCount).toBe(7);
  expect(audit.buildingCount).toBe(15);
  expect(audit.frontageCount).toBe(15);
  expect(audit.roadMeshCount).toBe(5);
  expect(audit.frontageMeshCount).toBeGreaterThanOrEqual(15);
  expect(audit.curbCount).toBeGreaterThan(100);
  expect(audit.channelCount).toBe(audit.curbCount);
  expect(audit.hiddenSuperseded).toBeGreaterThan(20);
  expect(audit.visibleSuperseded).toEqual([]);
  expect(audit.transparentIntegratedMaterials).toEqual([]);
  expect(audit.integratedMaterialCount).toBeGreaterThanOrEqual(18);
  expect(audit.gateSolidMeshCount).toBeGreaterThanOrEqual(5);
  expect(audit.wellHasDarkShaft).toBe(true);
  expect(audit.guildHallPresent).toBe(true);
  expect(audit.guildBoardPosition).toEqual({ x: 35, z: 128 });
  expect(audit.wellPosition).toEqual({ x: -19, z: 121 });
  expect(audit.audit).not.toBeNull();
  expect(audit.audit?.curbInsideJunction).toBe(0);
  expect(audit.audit?.channelInsideJunction).toBe(0);
  expect(audit.audit?.roadBuildingOverlaps).toBe(0);
  expect(audit.audit?.buildingOverlapPairs).toBe(0);
  expect(audit.audit?.disconnectedFrontages).toBe(0);
  expect(audit.audit?.buildingCount).toBe(15);
  expect(audit.audit?.frontageCount).toBe(15);
  expect(audit.audit?.citizenCount).toBe(5);
  expect(audit.audit?.guildBoardRelocated).toBe(true);
  expect(audit.audit?.boarContractAvailable).toBe(true);
  expect(audit.audit?.wellHasDarkShaft).toBe(true);
  expect(audit.audit?.gateSolidMeshCount).toBeGreaterThanOrEqual(5);

  const headingEvidence: Record<string, CombatRigAudit> = {};
  for (const [name, yaw] of [
    ["north", 0],
    ["east", Math.PI / 2],
    ["south", Math.PI],
    ["west", -Math.PI / 2]
  ] as Array<[string, number]>) {
    await bridgeCall(page, "setPlayerHeading", yaw);
    await bridgeCall(page, "simulate", 0.16, []);
    const rig = await bridgeCall<CombatRigAudit>(page, "combatRigAudit");
    expect(rig.version).toBe(1);
    expect(rig.swordForwardRuleInstalled).toBe(true);
    expect(rig.stableGuardRuleInstalled).toBe(true);
    expect(rig.liveForwardDot, `${name} sword tip must remain ahead of the hilt`).toBeGreaterThan(0.25);
    expect(rig.swordParent).toBe("caelus-third-person-sword-mount");
    expect(rig.swordRotationX).toBeGreaterThan(0);
    headingEvidence[name] = rig;
  }

  await bridgeCall(page, "teleport", -4, 116, 0);
  await bridgeCall(page, "simulate", 0.12, []);
  const guardStart = await bridgeCall<CombatRigAudit>(page, "combatRigAudit");
  await bridgeCall(page, "setGuardHeld", true);
  await bridgeCall(page, "simulate", 3.2, []);
  const guardHeld = await bridgeCall<CombatRigAudit>(page, "combatRigAudit");
  expect(guardHeld.guardAnchorActive).toBe(true);
  expect(guardHeld.guardFramesStable).toBeGreaterThan(150);
  expect(Math.abs(guardHeld.rootX - guardStart.rootX)).toBeLessThan(0.01);
  expect(Math.abs(guardHeld.rootZ - guardStart.rootZ)).toBeLessThan(0.01);
  expect(Math.abs(guardHeld.guardRootRoll)).toBeLessThan(0.001);
  expect(Math.abs(guardHeld.guardRootPitch)).toBeLessThan(0.001);
  expect(guardHeld.liveForwardDot).toBeGreaterThan(0.05);
  await capture(page, testInfo, "integrated-guard-pose");
  await bridgeCall(page, "setGuardHeld", false);
  await bridgeCall(page, "simulate", 0.35, []);
  const guardReleased = await bridgeCall<CombatRigAudit>(page, "combatRigAudit");
  expect(guardReleased.guardAnchorActive).toBe(false);

  await captureLockedView(page, testInfo, "integrated-gate-exterior", [0, 8, 0], [0, 9, -22, 1.8]);
  await captureLockedView(page, testInfo, "integrated-main-junctions", [0, 96, 0], [13, 14, -19, 1.9]);
  await captureLockedView(page, testInfo, "integrated-town-center-well", [-12, 118, 0], [17, 11, -18, 2.2]);
  await captureLockedView(page, testInfo, "integrated-market-square", [-48, 119, 0], [17, 11, -19, 2.1]);
  await captureLockedView(page, testInfo, "integrated-guild-court", [43, 128, 0], [-20, 12, -18, 2.1]);
  await captureLockedView(page, testInfo, "integrated-service-workshop", [18, 72, 0], [15, 9, -17, 1.7]);
  await captureLockedView(page, testInfo, "integrated-city-overview", [0, 118, 0], [0, 62, -58, 1.18]);

  const runtimeErrors = await bridgeCall<string[]>(page, "errors");
  const evidencePath = testInfo.outputPath("integrated-caelus-audit.json");
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, JSON.stringify({
    audit,
    headingEvidence,
    guardStart,
    guardHeld,
    guardReleased,
    consoleErrors,
    runtimeErrors
  }, null, 2));

  expect(runtimeErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
