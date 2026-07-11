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
  await page.waitForTimeout(60);
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

test("Set 1.4 matches the approved straight-road walled-town reference", async ({ page }, testInfo) => {
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
  expect(audit.milestone).toContain("Milestone 1.4");
  expect(audit.pass).toBe(true);
  expect(audit.houseCount).toBe(20);
  expect(audit.mainRoadCount).toBe(1);
  expect(audit.collectorPathCount).toBe(6);
  expect(audit.frontagePathCount).toBe(21);
  expect(audit.wallSegmentCount).toBe(6);
  expect(audit.towerCount).toBe(8);
  expect(audit.gateOpeningCount).toBe(2);
  expect(audit.wellPosition.x).toBeLessThan(-80);
  expect(audit.wellPosition.z).toBeGreaterThan(195);
  expect(audit.townCenterPresent).toBe(false);
  expect(audit.houseRoadIntersections).toEqual([]);
  expect(audit.houseCollectorIntersections).toEqual([]);
  expect(audit.houseWallIntersections).toEqual([]);
  expect(audit.houseHouseIntersections).toEqual([]);
  expect(audit.blockedMainRouteSamples).toBe(0);
  expect(audit.minimumWallClearance).toBeGreaterThanOrEqual(12);
  expect(audit.retiredMeshes).toBeGreaterThan(50);
  expect(audit.removedCollisionVolumes).toBeGreaterThan(10);

  const meshes = await bridgeCall<string[]>(page, "referenceTownMeshes");
  expect(meshes.some((name) => name === "caelus-reference-main-street-road-surface")).toBe(true);
  expect(meshes.filter((name) => name.includes("-body")).length).toBe(20);
  expect(meshes.some((name) => name === "caelus-reference-well-dark-shaft")).toBe(true);

  await lockedView(page, testInfo, "reference-town-aerial", [0, 121, 0], [0, 136, 98, 1.3]);
  await lockedView(page, testInfo, "reference-town-south-gate", [0, 28, 0], [0, 13, -24, 2]);
  await lockedView(page, testInfo, "reference-town-north-gate", [0, 214, 0], [0, 13, 24, 2]);
  await lockedView(page, testInfo, "reference-town-upper-left-well", [-91, 207, 0], [13, 10, -15, 2]);

  await writeFile(testInfo.outputPath("reference-town-audit.json"), JSON.stringify(audit, null, 2));
  const runtimeErrors = await bridgeCall<string[]>(page, "errors");
  expect(runtimeErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
