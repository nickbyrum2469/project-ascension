import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

interface BaselineSurveyReport {
  version: number;
  milestone: string;
  generatedAt: string;
  summary: {
    roads: number;
    frontages: number;
    buildings: number;
    walls: number;
    civicObjects: number;
    npcs: number;
    questObjects: number;
    collisionVolumes: number;
    terrainSamples: number;
    protectedRoutePoints: number;
    blockedRouteSamples: number;
    findings: number;
    criticalFindings: number;
    highFindings: number;
  };
  terrain: {
    samples: Array<{ x: number; z: number; height: number; slope: number }>;
    minHeight: number;
    maxHeight: number;
    heightRange: number;
    maxSlope: number;
    roughSampleCount: number;
  };
  protectedRoute: {
    points: Array<{ id: string; label: string; x: number; z: number; height: number }>;
    blockedSamples: Array<{ x: number; z: number; collisionId: string }>;
  };
  findings: Array<{
    severity: string;
    code: string;
    message: string;
    subjects: string[];
  }>;
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

test("Set 1 Milestone 1.1 captures the complete Caelus city baseline", async ({ page }, testInfo: TestInfo) => {
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

  const report = await bridgeCall<BaselineSurveyReport>(page, "baselineSurvey");
  expect(report.version).toBe(1);
  expect(report.milestone).toContain("Milestone 1.1");
  expect(report.summary.roads).toBeGreaterThanOrEqual(5);
  expect(report.summary.buildings).toBeGreaterThanOrEqual(14);
  expect(report.summary.frontages).toBeGreaterThanOrEqual(14);
  expect(report.summary.walls).toBeGreaterThanOrEqual(3);
  expect(report.summary.civicObjects).toBeGreaterThanOrEqual(5);
  expect(report.summary.collisionVolumes).toBeGreaterThan(10);
  expect(report.terrain.samples.length).toBeGreaterThanOrEqual(600);
  expect(report.terrain.maxHeight).toBeGreaterThanOrEqual(report.terrain.minHeight);
  expect(report.terrain.heightRange).toBeGreaterThanOrEqual(0);
  expect(report.protectedRoute.points.length).toBe(7);
  expect(report.summary.findings).toBe(report.findings.length);
  expect(report.findings.length).toBeGreaterThan(0);

  await bridgeCall(page, "setBaselineSurveyVisible", true);
  expect(await bridgeCall<boolean>(page, "baselineSurveyVisible")).toBe(true);
  const overlay = page.locator("#caelus-baseline-survey-overlay");
  await expect(overlay).toBeVisible();
  await expect(overlay.locator("canvas")).toBeVisible();

  const screenshotPath = testInfo.outputPath("visual", "caelus-baseline-survey-map.png");
  await mkdir(dirname(screenshotPath), { recursive: true });
  await overlay.screenshot({ path: screenshotPath, animations: "disabled" });

  const reportPath = testInfo.outputPath("baseline-survey-report.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2));

  const runtimeErrors = await bridgeCall<string[]>(page, "errors");
  expect(runtimeErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
