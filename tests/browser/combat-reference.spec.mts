import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

interface ReferenceTownAudit {
  pass: boolean;
  blockedMainRouteSamples: number;
}

interface IntegratedCityAudit {
  swordForwardVerified: boolean;
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

interface Snapshot {
  z: number;
  cameraMode: "first" | "third";
  attack: string | null;
  stamina: number;
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

test("combat and sword presentation remain stable inside the reference town", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`console: ${message.text()}`);
  });

  await page.goto("/?playtest=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean((globalThis as any).__ASCENSION_PLAYTEST__), null, { timeout: 45_000 });
  await page.locator("#enter-world").click();
  await expect(page.locator("#hud")).not.toHaveClass(/hidden/);

  const town = await bridgeCall<ReferenceTownAudit>(page, "referenceTownAudit");
  expect(town.pass).toBe(true);
  expect(town.blockedMainRouteSamples).toBe(0);

  const integrated = await bridgeCall<IntegratedCityAudit>(page, "integratedCityAudit");
  expect(integrated.swordForwardVerified).toBe(true);
  expect(integrated.stableGuardInstalled).toBe(true);

  const guard = await bridgeCall<GuardStabilityProbe>(page, "guardStabilityProbe", 0.5);
  expect(guard.frames).toBe(30);
  expect(guard.displacement).toBeLessThan(0.01);
  expect(Math.abs(guard.rootPitch)).toBeLessThan(0.001);
  expect(Math.abs(guard.rootRoll)).toBeLessThan(0.001);
  expect(Math.abs(guard.hipPitch)).toBeLessThan(0.2);
  expect(Math.abs(guard.hipRoll)).toBeLessThan(0.001);
  expect(Math.abs(guard.torsoOffsetY)).toBeLessThan(0.001);

  await bridgeCall(page, "teleport", 0, 26, 0);
  const start = await bridgeCall<Snapshot>(page, "snapshot");
  const roadWalk = await bridgeCall<Snapshot>(page, "simulate", 5.5, ["ShiftLeft", "KeyW"]);
  expect(roadWalk.z).toBeGreaterThan(start.z + 28);

  const staminaBefore = roadWalk.stamina;
  const heavy = await bridgeCall<Snapshot>(page, "simulate", 0.08, ["KeyQ"]);
  expect(heavy.attack).toBe("heavy");
  expect(heavy.stamina).toBeLessThan(staminaBefore);

  await bridgeCall(page, "teleport", 12, 121, 0);
  await bridgeCall(page, "setPaused", true);
  await bridgeCall(page, "cameraPose", 4.4, 2.0, 0, 1.25);
  await capture(page, testInfo, "reference-town-sword-profile");
  await bridgeCall(page, "clearCameraPose");
  await bridgeCall(page, "setPaused", false);

  const runtimeErrors = await bridgeCall<string[]>(page, "errors");
  expect(runtimeErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
