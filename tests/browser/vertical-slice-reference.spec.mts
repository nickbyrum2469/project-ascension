import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

interface Snapshot {
  started: boolean;
  paused: boolean;
  x: number;
  y: number;
  z: number;
  ground: number;
  grounded: boolean;
  cameraMode: "first" | "third";
  stamina: number;
  attack: string | null;
  runtimeErrors: string[];
}

interface ReferenceTownAudit {
  pass: boolean;
  houseCount: number;
  gateOpeningCount: number;
  blockedMainRouteSamples: number;
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
  await page.waitForTimeout(35);
  const path = testInfo.outputPath("visual", `${name}.png`);
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, animations: "disabled" });
};

test("the complete Project Ascension route remains playable with the rebuilt town", async ({ page }, testInfo) => {
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
  expect(start.paused).toBe(false);
  expect(start.cameraMode).toBe("third");

  const town = await bridgeCall<ReferenceTownAudit>(page, "referenceTownAudit");
  expect(town.pass).toBe(true);
  expect(town.houseCount).toBe(20);
  expect(town.gateOpeningCount).toBe(2);
  expect(town.blockedMainRouteSamples).toBe(0);

  const frontierMovement = await bridgeCall<Snapshot>(page, "simulate", 1.85, ["KeyW"]);
  expect(Math.abs(frontierMovement.z - start.z)).toBeGreaterThan(3.5);

  const airborne = await bridgeCall<Snapshot>(page, "simulate", 0.08, ["Space"]);
  expect(airborne.y).toBeGreaterThan(airborne.ground + 0.08);
  const landed = await bridgeCall<Snapshot>(page, "simulate", 1.1);
  expect(landed.grounded).toBe(true);

  await bridgeCall(page, "checkpoint", "frontier-combat");
  const combatReady = await bridgeCall<Snapshot>(page, "snapshot");
  const heavy = await bridgeCall<Snapshot>(page, "simulate", 0.08, ["KeyQ"]);
  expect(heavy.attack).toBe("heavy");
  expect(heavy.stamina).toBeLessThan(combatReady.stamina);
  await capture(page, testInfo, "reference-route-combat");
  await bridgeCall(page, "simulate", 1.05);

  const firstPerson = await bridgeCall<Snapshot>(page, "simulate", 0.05, ["KeyV"]);
  expect(firstPerson.cameraMode).toBe("first");
  await bridgeCall(page, "simulate", 0.05, ["KeyV"]);

  await bridgeCall(page, "checkpoint", "gate-exterior");
  const throughSouthGate = await bridgeCall<Snapshot>(page, "simulate", 4.5, ["ShiftLeft", "KeyW"]);
  expect(throughSouthGate.z).toBeGreaterThan(27);

  await bridgeCall(page, "teleport", 0, 32, 0);
  const mainRoadWalk = await bridgeCall<Snapshot>(page, "simulate", 8.5, ["ShiftLeft", "KeyW"]);
  expect(mainRoadWalk.z).toBeGreaterThan(100);
  await capture(page, testInfo, "reference-route-main-road");

  await bridgeCall(page, "teleport", 0, 208, 0);
  const throughNorthGate = await bridgeCall<Snapshot>(page, "simulate", 3.5, ["ShiftLeft", "KeyW"]);
  expect(throughNorthGate.z).toBeGreaterThan(225);

  await bridgeCall(page, "unlockVerticalSlice");
  await bridgeCall(page, "checkpoint", "foundry-breach");
  const insideBreach = await bridgeCall<Snapshot>(page, "simulate", 8, ["KeyW"]);
  expect(insideBreach.x).toBeGreaterThan(462);
  expect(insideBreach.z).toBeLessThan(-461.5);

  for (const view of ["foundry-entry", "foundry-core", "pillar-lift"]) {
    await bridgeCall(page, "checkpoint", view);
    await bridgeCall(page, "simulate", 0.12);
    await capture(page, testInfo, view);
  }

  const runtimeErrors = await bridgeCall<string[]>(page, "errors");
  await writeFile(testInfo.outputPath("reference-vertical-slice-errors.json"), JSON.stringify({ consoleErrors, runtimeErrors }, null, 2));
  expect(runtimeErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
