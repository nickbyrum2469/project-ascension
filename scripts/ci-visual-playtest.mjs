import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const baseUrl = process.env.PLAYTEST_URL ?? "http://127.0.0.1:4173";
const outputDir = path.resolve(process.env.PLAYTEST_OUTPUT_DIR ?? "artifacts/visual-playtest");
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: [
    "--disable-dev-shm-usage",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--window-size=1600,900"
  ]
});

const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 1
});

// Chromium's headless AudioContext can remain suspended forever even after a
// synthetic Playwright click. Keep the real context, but cap resume() so the
// Begin Expedition handler can continue into the actual rendered game.
await context.addInitScript(() => {
  const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!AudioContextClass?.prototype?.resume) return;
  const nativeResume = AudioContextClass.prototype.resume;
  AudioContextClass.prototype.resume = function resumeForVisualPlaytest() {
    try {
      const nativeResult = nativeResume.call(this);
      return Promise.race([
        Promise.resolve(nativeResult).catch(() => undefined),
        new Promise((resolve) => globalThis.setTimeout(resolve, 150))
      ]);
    } catch {
      return Promise.resolve();
    }
  };
});

const page = await context.newPage();
const browserErrors = [];
const consoleMessages = [];

page.on("pageerror", (error) => {
  browserErrors.push(`pageerror: ${error.stack ?? error.message}`);
});

page.on("console", (message) => {
  const entry = `${message.type()}: ${message.text()}`;
  consoleMessages.push(entry);
  if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
});

const report = {
  url: `${baseUrl}/?playtest=1`,
  generatedAt: new Date().toISOString(),
  renderer: null,
  movement: {},
  views: [],
  geometryAudit: null,
  runtimeErrors: [],
  browserErrors,
  consoleMessages
};

const evaluateApi = async (expression, argument) => page.evaluate(
  ({ expression, argument }) => {
    const api = globalThis.__ASCENSION_PLAYTEST__;
    if (!api) throw new Error("Playtest API is not available");
    const fn = api[expression];
    if (typeof fn !== "function") throw new Error(`Unknown playtest API method: ${expression}`);
    return Array.isArray(argument) ? fn(...argument) : fn(argument);
  },
  { expression, argument }
);

const capture = async ({ name, checkpoint, pose, view = "third" }) => {
  await evaluateApi("checkpoint", checkpoint);
  await evaluateApi("setView", view);
  await evaluateApi("cameraPose", pose);
  await evaluateApi("renderFrame", []);
  await page.waitForTimeout(350);
  await evaluateApi("renderFrame", []);
  const snapshot = await evaluateApi("snapshot", []);
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(outputDir, file), animations: "disabled" });
  report.views.push({ name, checkpoint, pose, view, file, snapshot });
};

try {
  await page.goto(report.url, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForFunction(
    () => document.documentElement.dataset.playtestReady === "true" && Boolean(globalThis.__ASCENSION_PLAYTEST__),
    null,
    { timeout: 180_000 }
  );

  report.renderer = await page.evaluate(() => globalThis.__ASCENSION_PLAYTEST__.renderer);

  const enterButton = page.locator("#enter-world");
  if (await enterButton.isVisible()) {
    await enterButton.click({ force: true, timeout: 15_000 });
  }
  await page.waitForSelector("#hud:not(.hidden)", { timeout: 60_000 });
  await page.waitForTimeout(1_500);

  await evaluateApi("setPaused", true);
  await evaluateApi("clearErrors", []);

  await capture({
    name: "01-gate-exterior",
    checkpoint: "gate-exterior",
    pose: [0, 8, -16, 1.4]
  });
  await capture({
    name: "02-gate-interior",
    checkpoint: "gate-interior",
    pose: [0, 7, -14, 1.4]
  });
  await capture({
    name: "03-main-street",
    checkpoint: "city-main-south",
    pose: [-2, 9, -18, 1.5]
  });
  await capture({
    name: "04-market-square",
    checkpoint: "city-market",
    pose: [12, 11, -16, 1.6]
  });
  await capture({
    name: "05-town-center",
    checkpoint: "city-center",
    pose: [-14, 12, -17, 1.5]
  });
  await capture({
    name: "06-guild-court",
    checkpoint: "city-guild",
    pose: [-12, 10, -15, 1.5]
  });
  await capture({
    name: "07-residential-lane",
    checkpoint: "city-residential",
    pose: [12, 9, -15, 1.4]
  });
  await capture({
    name: "08-service-yard",
    checkpoint: "city-service",
    pose: [-13, 10, -15, 1.4]
  });
  await capture({
    name: "09-supply-row",
    checkpoint: "city-supply",
    pose: [-12, 10, -16, 1.5]
  });
  await capture({
    name: "10-town-north",
    checkpoint: "city-north",
    pose: [0, 12, 18, 1.5]
  });
  await capture({
    name: "11-first-person-town-center",
    checkpoint: "city-center",
    pose: [0, 1.65, 0.15, 1.55],
    view: "first"
  });

  await evaluateApi("clearCameraPose", []);
  await evaluateApi("setView", "third");
  await evaluateApi("checkpoint", "gate-exterior");
  const beforeForward = await evaluateApi("snapshot", []);
  const afterForward = await evaluateApi("simulate", [1.5, ["KeyW"]]);
  report.movement.forward = { before: beforeForward, after: afterForward };

  await evaluateApi("checkpoint", "gate-interior");
  const beforeReverse = await evaluateApi("snapshot", []);
  const afterReverse = await evaluateApi("simulate", [1.0, ["KeyS"]]);
  report.movement.reverse = { before: beforeReverse, after: afterReverse };

  report.geometryAudit = await evaluateApi("geometryAudit", []);
  report.runtimeErrors = await evaluateApi("errors", []);

  await fs.writeFile(path.join(outputDir, "playtest-report.json"), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(outputDir, "browser-console.log"), `${consoleMessages.join("\n")}\n`);

  const forwardDistance = Math.hypot(
    Number(afterForward.x) - Number(beforeForward.x),
    Number(afterForward.z) - Number(beforeForward.z)
  );
  const reverseDistance = Math.hypot(
    Number(afterReverse.x) - Number(beforeReverse.x),
    Number(afterReverse.z) - Number(beforeReverse.z)
  );

  const failures = [];
  if (forwardDistance < 0.5) failures.push(`Forward movement was only ${forwardDistance.toFixed(3)} units`);
  if (reverseDistance < 0.25) failures.push(`Reverse movement was only ${reverseDistance.toFixed(3)} units`);
  if (report.runtimeErrors.length) failures.push(`Playtest API recorded ${report.runtimeErrors.length} runtime error(s)`);
  if (browserErrors.length) failures.push(`Browser recorded ${browserErrors.length} error(s)`);

  if (failures.length) {
    throw new Error(`Visual playtest failed:\n- ${failures.join("\n- ")}`);
  }
} catch (error) {
  report.failure = error instanceof Error ? error.stack ?? error.message : String(error);
  await fs.writeFile(path.join(outputDir, "playtest-report.json"), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(outputDir, "browser-console.log"), `${consoleMessages.join("\n")}\n`);
  throw error;
} finally {
  await browser.close();
}
