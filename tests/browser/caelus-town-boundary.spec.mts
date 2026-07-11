import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

interface TownBoundaryReport {
  version: number;
  milestone: string;
  identity: string;
  plan: {
    boundaryVertices: number;
    boundaryArea: number;
    perimeter: number;
    previousSurveyArea: number;
    footprintReduction: number;
    districtCount: number;
    anchorCount: number;
    corridorCount: number;
    sightlineCount: number;
  };
  activeBuildings: Array<{ name: string }>;
  activeBuildingsOutsideBoundary: string[];
  anchorsOutsideBoundary: string[];
  districtAnchorMismatches: string[];
  districtVerticesOutsideBoundary: string[];
  topologyViolations: string[];
  corridors: Array<{
    id: string;
    critical: boolean;
    buildingIntrusions: string[];
    blockedSamples: Array<{ x: number; z: number; collisionId: string }>;
  }>;
  sightlines: Array<{
    id: string;
    requiredClear: boolean;
    blockedBy: string[];
  }>;
  protectedRoute: {
    corridorId: string;
    blockedSamples: Array<{ x: number; z: number; collisionId: string }>;
    buildingIntrusions: string[];
    preserved: boolean;
  };
  findings: Array<{
    severity: string;
    code: string;
    message: string;
    subjects: string[];
  }>;
  summary: {
    activeBuildings: number;
    activeBuildingsOutsideBoundary: number;
    anchorsOutsideBoundary: number;
    districtAnchorMismatches: number;
    districtVerticesOutsideBoundary: number;
    topologyViolations: number;
    criticalCorridorIntrusions: number;
    protectedRouteBlockedSamples: number;
    blockedRequiredSightlines: number;
    findings: number;
  };
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

test("Set 1 Milestone 1.2 locks the final Caelus town boundary", async ({ page }, testInfo: TestInfo) => {
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

  const report = await bridgeCall<TownBoundaryReport>(page, "townBoundaryAudit");
  expect(report.version).toBe(2);
  expect(report.milestone).toContain("Milestone 1.2");
  expect(report.identity).toBe("Compact Floor-One frontier town");
  expect(report.plan.boundaryVertices).toBe(20);
  expect(report.plan.boundaryArea).toBeCloseTo(33159, 0);
  expect(report.plan.perimeter).toBeGreaterThan(600);
  expect(report.plan.footprintReduction).toBeGreaterThan(0.4);
  expect(report.plan.districtCount).toBe(8);
  expect(report.plan.anchorCount).toBe(9);
  expect(report.plan.corridorCount).toBe(5);
  expect(report.plan.sightlineCount).toBe(4);

  expect(report.summary.activeBuildings).toBe(14);
  expect(report.activeBuildingsOutsideBoundary).toEqual([]);
  expect(report.anchorsOutsideBoundary).toEqual([]);
  expect(report.districtAnchorMismatches).toEqual([]);
  expect(report.districtVerticesOutsideBoundary).toEqual([]);
  expect(report.topologyViolations).toEqual([]);
  expect(report.summary.criticalCorridorIntrusions).toBe(0);
  expect(report.summary.protectedRouteBlockedSamples).toBe(0);
  expect(report.summary.blockedRequiredSightlines).toBe(0);

  const primary = report.corridors.find((corridor) => corridor.id === "primary-spine");
  expect(primary).toBeDefined();
  expect(primary?.critical).toBe(true);
  expect(primary?.buildingIntrusions).toEqual([]);
  expect(primary?.blockedSamples).toEqual([]);
  expect(report.protectedRoute.corridorId).toBe("primary-spine");
  expect(report.protectedRoute.buildingIntrusions).toEqual([]);
  expect(report.protectedRoute.blockedSamples).toEqual([]);
  expect(report.protectedRoute.preserved).toBe(true);

  for (const sightline of report.sightlines.filter((candidate) => candidate.requiredClear)) {
    expect(sightline.blockedBy, `${sightline.id} must remain visually clear`).toEqual([]);
  }
  expect(report.findings.filter((finding) => finding.severity === "critical")).toEqual([]);

  await bridgeCall(page, "setTownBoundaryVisible", true);
  expect(await bridgeCall<boolean>(page, "townBoundaryVisible")).toBe(true);
  const overlay = page.locator("#caelus-town-boundary-overlay");
  await expect(overlay).toBeVisible();
  await expect(overlay.locator("canvas")).toBeVisible();

  const screenshotPath = testInfo.outputPath("visual", "caelus-final-town-boundary.png");
  await mkdir(dirname(screenshotPath), { recursive: true });
  await overlay.screenshot({ path: screenshotPath, animations: "disabled" });

  const reportPath = testInfo.outputPath("caelus-final-town-boundary.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2));

  await bridgeCall(page, "setTownBoundaryVisible", false);
  expect(await bridgeCall<boolean>(page, "townBoundaryVisible")).toBe(false);
  await bridgeCall(page, "simulate", 0.25, ["KeyW"]);

  const runtimeErrors = await bridgeCall<string[]>(page, "errors");
  expect(runtimeErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
