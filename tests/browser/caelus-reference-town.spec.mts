import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

interface ReferenceTownAudit {
  version: number;
  milestone: string;
  retiredMeshes: number;
  removedCollisionVolumes: number;
  houseCount: number;
  mainRoadCount: number;
  collectorPathCount: number;
  frontagePathCount: number;
  wallSegmentCount: number;
  towerCount: number;
  gateOpeningCount: number;
  wellPosition: { x: number; z: number };
  townCenterPresent: boolean;
  houseRoadIntersections: string[];
  houseCollectorIntersections: string[];
  houseWallIntersections: string[];
  houseHouseIntersections: string[];
  blockedMainRouteSamples: number;
  minimumWallClearance: number;
  minimumHouseSpacing: number;
  pass: boolean;
}

interface ReferenceTownPolishAudit {
  version: number;
  pathColor: string;
  roadColor: string;
  gateTowerX: number;
  gateClearWidth: number;
  southGateZ: number;
  northGateZ: number;
}

interface RoadConnectivityAudit {
  version: number;
  milestone: string;
  mainRoadWidth: number;
  collectorRoadCount: number;
  frontageRoadCount: number;
  junctionPatchCount: number;
  disconnectedCollectorCount: number;
  disconnectedFrontageCount: number;
  buriedSurfaceVertexCount: number;
  minimumSurfaceClearance: number;
  northGateCovered: boolean;
  southGateCovered: boolean;
  wellCanopyRemoved: boolean;
  pass: boolean;
}

interface RoofAlignmentAudit {
  version: number;
  milestone: string;
  houseBodyCount: number;
  alignedRoofCount: number;
  retiredLegacyRoofCount: number;
  misalignedRoofCount: number;
  minimumOverhang: number;
  maximumCenterOffset: number;
  pass: boolean;
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
  await page.waitForTimeout(80);
  const path = testInfo.outputPath("visual", `${name}.png`);
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, animations: "disabled" });
};

const lockedView = async (
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

test("Set 1.4.2 has gap-free terrain roads and aligned full-footprint roofs", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`console: ${message.text()}`);
  });

  await page.goto("/?playtest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean((globalThis as any).__ASCENSION_PLAYTEST__), null, { timeout: 45_000 });
  await page.locator("#enter-world").click();
  await expect(page.locator("#hud")).not.toHaveClass(/hidden/);

  const audit = await bridgeCall<ReferenceTownAudit>(page, "referenceTownAudit");
  expect(audit.version).toBe(1);
  expect(audit.pass).toBe(true);
  expect(audit.houseCount).toBe(20);
  expect(audit.mainRoadCount).toBe(1);
  expect(audit.collectorPathCount).toBe(6);
  expect(audit.frontagePathCount).toBe(21);
  expect(audit.wallSegmentCount).toBe(6);
  expect(audit.towerCount).toBe(8);
  expect(audit.gateOpeningCount).toBe(2);
  expect(audit.townCenterPresent).toBe(false);
  expect(audit.houseRoadIntersections).toEqual([]);
  expect(audit.houseCollectorIntersections).toEqual([]);
  expect(audit.houseWallIntersections).toEqual([]);
  expect(audit.houseHouseIntersections).toEqual([]);
  expect(audit.blockedMainRouteSamples).toBe(0);
  expect(audit.minimumWallClearance).toBeGreaterThanOrEqual(12);

  const polish = await bridgeCall<ReferenceTownPolishAudit>(page, "referenceTownPolishAudit");
  expect(polish.version).toBe(2);
  expect(polish.gateTowerX).toBe(13);
  expect(polish.gateClearWidth).toBeGreaterThan(16);

  const roofs = await bridgeCall<RoofAlignmentAudit>(page, "roofAlignmentAudit");
  expect(roofs.version).toBe(1);
  expect(roofs.milestone).toContain("Milestone 1.4.2");
  expect(roofs.houseBodyCount).toBe(20);
  expect(roofs.alignedRoofCount).toBe(20);
  expect(roofs.retiredLegacyRoofCount).toBe(20);
  expect(roofs.misalignedRoofCount).toBe(0);
  expect(roofs.minimumOverhang).toBeGreaterThanOrEqual(0.75);
  expect(roofs.maximumCenterOffset).toBeLessThanOrEqual(0.01);
  expect(roofs.pass).toBe(true);

  const connectivity = await bridgeCall<RoadConnectivityAudit>(page, "roadConnectivityAudit");
  expect(connectivity.version).toBe(2);
  expect(connectivity.milestone).toContain("Milestone 1.4.2");
  expect(connectivity.mainRoadWidth).toBe(18);
  expect(connectivity.collectorRoadCount).toBe(3);
  expect(connectivity.frontageRoadCount).toBe(21);
  expect(connectivity.junctionPatchCount).toBe(24);
  expect(connectivity.disconnectedCollectorCount).toBe(0);
  expect(connectivity.disconnectedFrontageCount).toBe(0);
  expect(connectivity.buriedSurfaceVertexCount).toBe(0);
  expect(connectivity.minimumSurfaceClearance).toBeGreaterThanOrEqual(0.12);
  expect(connectivity.northGateCovered).toBe(true);
  expect(connectivity.southGateCovered).toBe(true);
  expect(connectivity.wellCanopyRemoved).toBe(true);
  expect(connectivity.pass).toBe(true);

  const alignedRoofMeshes = await bridgeCall<string[]>(page, "alignedRoofMeshes");
  expect(alignedRoofMeshes).toHaveLength(20);
  expect(alignedRoofMeshes.every((name) => name.startsWith("caelus-aligned-house-") && name.endsWith("-roof"))).toBe(true);

  const roadMeshes = await bridgeCall<string[]>(page, "roadConnectivityMeshes");
  expect(roadMeshes.some((name) => name === "caelus-connected-v2-main-road")).toBe(true);
  expect(roadMeshes.filter((name) => name.startsWith("caelus-connected-v2-collector-"))).toHaveLength(3);
  expect(roadMeshes.filter((name) => name.startsWith("caelus-connected-v2-frontage-") && !name.includes("junction"))).toHaveLength(21);
  expect(roadMeshes.filter((name) => name.includes("frontage-junction-"))).toHaveLength(21);
  expect(roadMeshes.filter((name) => name.endsWith("-gate-apron"))).toHaveLength(2);

  await lockedView(page, testInfo, "reference-town-v2-top-down-roads-roofs", [0, 121, 0], [0, 160, -0.01, 1.2]);
  await lockedView(page, testInfo, "reference-town-v2-lower-road-connections", [0, 70, 0], [0, 62, -0.01, 1.2]);
  await lockedView(page, testInfo, "reference-town-v2-north-gate-road", [0, 216, 0], [0, 30, -34, 1.2]);
  await lockedView(page, testInfo, "reference-town-v2-house-roof-alignment", [-55, 160, 0], [0, 48, -0.01, 1.2]);

  await writeFile(testInfo.outputPath("reference-town-audit.json"), JSON.stringify({ audit, polish, roofs, connectivity }, null, 2));
  const runtimeErrors = await bridgeCall<string[]>(page, "errors");
  expect(runtimeErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
