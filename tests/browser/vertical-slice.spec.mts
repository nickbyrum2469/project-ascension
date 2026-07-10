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
  x: number;
  y: number;
  z: number;
  ground: number;
  grounded: boolean;
  cameraMode: "first" | "third";
  stamina: number;
  attack: string | null;
  verticalSliceVersion: number | null;
  protectedRouteCollisionVolumesRemoved: number;
  runtimeErrors: string[];
}

interface GeometryAudit {
  unsupportedRibs: string[];
  missingRequiredMeshes: string[];
  disabledRequiredMeshes: string[];
  terrainBumpTexture: string | null;
  collisionBoxes: number;
  verticalSliceVersion: number | null;
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

const keyDown = async (page: Page, code: string): Promise<void> => {
  await bridgeCall(page, "keyDown", code);
};

const keyUp = async (page: Page, code: string): Promise<void> => {
  await bridgeCall(page, "keyUp", code);
};

const tapKey = async (page: Page, code: string): Promise<void> => {
  await keyDown(page, code);
  await page.waitForTimeout(42);
  await keyUp(page, code);
};

const settle = async (page: Page, milliseconds = 450): Promise<void> => {
  await page.waitForTimeout(milliseconds);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
};

const capture = async (page: Page, testInfo: TestInfo, name: string): Promise<void> => {
  const path = testInfo.outputPath("visual", `${name}.png`);
  await mkdir(dirname(path), { recursive: true });
  await page.locator("#render-canvas").screenshot({ path });
};

test("production vertical slice remains traversable and visually auditable", async ({ page }, testInfo) => {
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
  await settle(page, 650);

  const start = await bridgeCall<Snapshot>(page, "snapshot");
  expect(start.started).toBe(true);
  expect(start.paused).toBe(false);
  expect(start.interfaceOpen).toBe(false);
  expect(start.dialogueOpen).toBe(false);
  expect(start.liftActive).toBe(false);
  expect(start.inputEnabled).toBe(true);
  expect(start.cameraMode).toBe("third");
  expect(start.verticalSliceVersion).toBe(2);

  await keyDown(page, "KeyW");
  await page.waitForTimeout(150);
  const heldInput = await bridgeCall<Snapshot>(page, "snapshot");
  expect(heldInput.activeKeys).toContain("KeyW");
  await page.waitForTimeout(1_700);
  await keyUp(page, "KeyW");
  await settle(page, 180);
  const frontierMovement = await bridgeCall<Snapshot>(page, "snapshot");
  expect(frontierMovement.z).toBeLessThan(start.z - 3.5);

  await tapKey(page, "Space");
  await page.waitForTimeout(140);
  const airborne = await bridgeCall<Snapshot>(page, "snapshot");
  expect(airborne.y).toBeGreaterThan(airborne.ground + 0.08);
  await page.waitForTimeout(1_050);
  const landed = await bridgeCall<Snapshot>(page, "snapshot");
  expect(landed.grounded).toBe(true);
  expect(Math.abs(landed.y - landed.ground)).toBeLessThan(0.08);

  const staminaBeforeHeavy = landed.stamina;
  await tapKey(page, "KeyQ");
  await page.waitForTimeout(160);
  const heavy = await bridgeCall<Snapshot>(page, "snapshot");
  expect(heavy.stamina).toBeLessThan(staminaBeforeHeavy - 20);
  expect(heavy.attack).toBe("heavy");
  await expect(page.locator("#combat-stance-indicator")).toHaveAttribute("data-state", "heavy");
  await capture(page, testInfo, "combat-third-person-heavy");
  await settle(page, 1_000);

  await tapKey(page, "KeyV");
  await settle(page, 260);
  expect((await bridgeCall<Snapshot>(page, "snapshot")).cameraMode).toBe("first");
  await tapKey(page, "KeyQ");
  await page.waitForTimeout(160);
  expect((await bridgeCall<Snapshot>(page, "snapshot")).attack).toBe("heavy");
  await capture(page, testInfo, "combat-first-person-heavy");
  await settle(page, 1_000);
  await tapKey(page, "KeyV");
  await settle(page, 260);
  expect((await bridgeCall<Snapshot>(page, "snapshot")).cameraMode).toBe("third");

  await bridgeCall(page, "checkpoint", "gate-exterior");
  await settle(page);
  await keyDown(page, "ShiftLeft");
  await keyDown(page, "KeyW");
  await page.waitForTimeout(4_500);
  await keyUp(page, "KeyW");
  await keyUp(page, "ShiftLeft");
  await settle(page, 220);
  const throughGate = await bridgeCall<Snapshot>(page, "snapshot");
  expect(throughGate.z).toBeGreaterThan(27);

  const audit = await bridgeCall<GeometryAudit>(page, "geometryAudit");
  expect(audit.unsupportedRibs).toEqual([]);
  expect(audit.missingRequiredMeshes).toEqual([]);
  expect(audit.disabledRequiredMeshes).toEqual([]);
  expect(audit.terrainBumpTexture).toBeNull();
  expect(audit.collisionBoxes).toBeGreaterThan(20);
  expect(audit.verticalSliceVersion).toBe(2);
  expect(audit.dynamicActorsRebased).toBe(true);
  expect(audit.protectedRouteCollisionVolumesRemoved).toBeGreaterThan(0);

  const views = [
    "spawn",
    "gate-exterior",
    "city-boulevard",
    "city-plaza",
    "frontier",
    "foundry-breach"
  ];
  for (const view of views) {
    await bridgeCall(page, "checkpoint", view);
    await settle(page, 420);
    await capture(page, testInfo, view);
  }

  await bridgeCall(page, "unlockVerticalSlice");
  await bridgeCall(page, "checkpoint", "foundry-breach");
  await keyDown(page, "KeyW");
  await page.waitForTimeout(4_500);
  await keyUp(page, "KeyW");
  await settle(page, 250);
  const insideBreach = await bridgeCall<Snapshot>(page, "snapshot");
  expect(insideBreach.x).toBeGreaterThan(458);
  expect(insideBreach.z).toBeLessThan(-462);

  for (const view of ["foundry-entry", "foundry-core", "pillar-lift"]) {
    await bridgeCall(page, "checkpoint", view);
    await settle(page, 420);
    await capture(page, testInfo, view);
  }

  const runtimeErrors = await bridgeCall<string[]>(page, "errors");
  const evidencePath = testInfo.outputPath("browser-console.json");
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, JSON.stringify({ consoleErrors, runtimeErrors }, null, 2));

  expect(runtimeErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
