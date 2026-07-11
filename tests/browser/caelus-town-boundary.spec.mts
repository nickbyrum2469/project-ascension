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

test("Set 1.2 locks a compact final Caelus town boundary", async ({ page }, testInfo: TestInfo) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`console: ${message.text()}`);
  });

  await page.goto("/?playtest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean((globalThis as any).__ASCENSION_PLAYTEST__), null, { timeout: 45_000 });
  await page.locator("#enter-world").click();
  await expect(page.locator("#hud")).not.toHaveClass(/hidden/);

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
