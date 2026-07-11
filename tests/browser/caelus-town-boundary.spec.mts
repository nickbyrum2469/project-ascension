import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

interface BoundaryAudit {
  version: number;
  milestone: string;
  perimeterArea: number;
  compactness: number;
  districts: Array<{ id: string; label: string; anchor: { x: number; z: number } }>;
  corridors: Array<{ id: string; points: Array<{ x: number; z: number }> }>;
  sightlines: Array<{ id: string; blockedSamples: number }>;
  protectedRouteInsideBoundary: boolean;
  districtAnchorsInsideBoundary: boolean;
  districtOverlapPairs: string[];
  foundrySeparation: number;
  deadSpaceRatio: number;
  pass: boolean;
}

interface TerrainAudit {
  version: number;
  milestone: string;
  buildingPads: Array<{ id: string; variance: number; minimum: number; maximum: number }>;
  corridors: Array<{ id: string; maximumGrade: number; averageGrade: number }>;
  maximumBuildingVariance: number;
  maximumCorridorGrade: number;
  minimumHeight: number;
  maximumHeight: number;
  heightRange: number;
  sampleCount: number;
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

const enterWorld = async (page: Page, consoleErrors: string[]): Promise<void> => {
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`console: ${message.text()}`);
  });
  await page.goto("/?playtest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean((globalThis as any).__ASCENSION_PLAYTEST__), null, { timeout: 45_000 });
  await page.locator("#enter-world").click();
  await expect(page.locator("#hud")).not.toHaveClass(/hidden/);
};

test("Set 1.2 locks a compact final Caelus town boundary", async ({ page }, testInfo: TestInfo) => {
  const consoleErrors: string[] = [];
  await enterWorld(page, consoleErrors);

  const audit = await bridgeCall<BoundaryAudit>(page, "townBoundaryAudit");
  expect(audit.version).toBe(1);
  expect(audit.milestone).toContain("Milestone 1.2");
  expect(audit.pass).toBe(true);
  expect(audit.perimeterArea).toBeGreaterThan(30_000);
  expect(audit.perimeterArea).toBeLessThan(43_000);
  expect(audit.compactness).toBeGreaterThanOrEqual(0.64);
  expect(audit.districts).toHaveLength(8);
  expect(audit.corridors).toHaveLength(4);
  expect(audit.sightlines).toHaveLength(2);
  expect(audit.districtOverlapPairs).toEqual([]);
  expect(audit.protectedRouteInsideBoundary).toBe(true);
  expect(audit.districtAnchorsInsideBoundary).toBe(true);
  expect(audit.foundrySeparation).toBeGreaterThanOrEqual(20);
  expect(audit.deadSpaceRatio).toBeLessThanOrEqual(0.32);

  const ids = audit.districts.map((district) => district.id).sort();
  expect(ids).toEqual([
    "frontier-exit", "gate-watch", "guild-court", "main-street",
    "market", "residential-lane", "service-yard", "town-center"
  ]);

  await bridgeCall(page, "setTownBoundaryVisible", true);
  expect(await bridgeCall<boolean>(page, "townBoundaryVisible")).toBe(true);
  const overlay = page.locator("#caelus-town-boundary-overlay");
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText("FINAL TOWN BOUNDARY");
  await expect(overlay).toContainText("Milestone gate: PASS");

  await bridgeCall(page, "teleport", 0, 108, 0);
  await bridgeCall(page, "setPaused", true);
  await bridgeCall(page, "cameraPose", 0, 145, 105, 1.56);
  await bridgeCall(page, "renderFrame");
  await page.waitForTimeout(50);
  const screenshotPath = testInfo.outputPath("visual", "town-boundary-debug.png");
  await mkdir(dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, animations: "disabled" });

  const auditPath = testInfo.outputPath("town-boundary-audit.json");
  await writeFile(auditPath, JSON.stringify(audit, null, 2));

  const runtimeErrors = await bridgeCall<string[]>(page, "errors");
  expect(runtimeErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("Set 1.3 sculpts controlled terrain tiers and level building pads", async ({ page }, testInfo: TestInfo) => {
  const consoleErrors: string[] = [];
  await enterWorld(page, consoleErrors);

  const audit = await bridgeCall<TerrainAudit>(page, "controlledTerrainAudit");
  expect(audit.version).toBe(1);
  expect(audit.milestone).toContain("Milestone 1.3");
  expect(audit.pass).toBe(true);
  expect(audit.buildingPads).toHaveLength(18);
  expect(audit.corridors).toHaveLength(5);
  expect(audit.maximumBuildingVariance).toBeLessThanOrEqual(0.08);
  expect(audit.maximumCorridorGrade).toBeLessThanOrEqual(0.07);
  expect(audit.heightRange).toBeLessThanOrEqual(2.4);
  expect(audit.sampleCount).toBeGreaterThan(500);
  expect(audit.buildingPads.every((pad) => pad.variance <= 0.08)).toBe(true);
  expect(audit.corridors.every((corridor) => corridor.maximumGrade <= 0.07)).toBe(true);

  await bridgeCall(page, "teleport", 0, 112, 0);
  await bridgeCall(page, "setPaused", true);
  await bridgeCall(page, "setControlledTerrainVisible", false);
  await bridgeCall(page, "cameraPose", 0, 124, 104, 1.7);
  await bridgeCall(page, "renderFrame");
  await page.waitForTimeout(80);
  const aerialPath = testInfo.outputPath("visual", "controlled-terrain-aerial-clean.png");
  await mkdir(dirname(aerialPath), { recursive: true });
  await page.screenshot({ path: aerialPath, animations: "disabled" });

  await bridgeCall(page, "setControlledTerrainVisible", true);
  expect(await bridgeCall<boolean>(page, "controlledTerrainVisible")).toBe(true);
  const overlay = page.locator("#caelus-controlled-terrain-overlay");
  await expect(overlay).toBeVisible();
  await expect(overlay).toContainText("CONTROLLED TERRAIN · 1.3");
  await expect(overlay).toContainText("Milestone gate: PASS");
  await bridgeCall(page, "renderFrame");
  await page.waitForTimeout(50);
  await page.screenshot({
    path: testInfo.outputPath("visual", "controlled-terrain-aerial-debug.png"),
    animations: "disabled"
  });

  await bridgeCall(page, "setControlledTerrainVisible", false);
  await bridgeCall(page, "teleport", -5, 151, 0.3);
  await bridgeCall(page, "cameraPose", 24, 12, -27, 1.8);
  await bridgeCall(page, "renderFrame");
  await page.waitForTimeout(80);
  await page.screenshot({
    path: testInfo.outputPath("visual", "controlled-terrain-street-level.png"),
    animations: "disabled"
  });

  await writeFile(testInfo.outputPath("controlled-terrain-audit.json"), JSON.stringify(audit, null, 2));
  const runtimeErrors = await bridgeCall<string[]>(page, "errors");
  expect(runtimeErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
