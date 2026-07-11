import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";

const requiredFiles = [
  "src/core/CaelusTownPhaseTwo.ts",
  "src/core/CaelusPhaseTwoPlaytestExtension.ts",
  "tests/browser/caelus-phase-two.spec.mts"
];

await Promise.all(requiredFiles.map((file) => access(file, constants.R_OK)));

const [main, director, extension, browserTest] = await Promise.all([
  readFile("src/main.ts", "utf8"),
  readFile("src/core/CaelusTownPhaseTwo.ts", "utf8"),
  readFile("src/core/CaelusPhaseTwoPlaytestExtension.ts", "utf8"),
  readFile("tests/browser/caelus-phase-two.spec.mts", "utf8")
]);

const traversalIndex = main.indexOf("new VerticalSliceTraversalGuard(game)");
const phaseTwoIndex = main.indexOf("new CaelusTownPhaseTwo(game)");
const playtestIndex = main.indexOf("new PlaytestBridge(game, renderer)");
const extensionIndex = main.indexOf("new CaelusPhaseTwoPlaytestExtension(game)");
if (
  traversalIndex < 0
  || phaseTwoIndex <= traversalIndex
  || playtestIndex <= phaseTwoIndex
  || extensionIndex <= playtestIndex
) {
  throw new Error("Phase Two initialization order must preserve route cleanup and playtest extension ordering.");
}

for (const feature of [
  "caelusTownPhaseTwoVersion: 1",
  "phaseTwoRoadVisualRevision: 3",
  "phaseTwoWellRecovered",
  "phaseTwoDrainageBands",
  "phaseTwoCollisionAudit",
  'id: "main-street"',
  'id: "market-lane"',
  'id: "guild-lane"',
  'id: "residential-loop"',
  'id: "service-lane"',
  "`caelus-phase2-${definition.id}-curb-${",
  "`caelus-phase2-${definition.id}-channel-${",
  "0.22,",
  "0.032,",
  "0.14,",
  "0.28,",
  "0.045,",
  "collisionCenter: { x: -10, z: 112 }",
  "duplicatePairs",
  "mainRouteIntrusions",
  "wellCollisions"
]) {
  if (!director.includes(feature)) throw new Error(`Missing Phase Two production feature: ${feature}`);
}

for (const feature of [
  "phaseTwoAudit",
  "phaseTwoCollisionProbe",
  "roadVisualRevision",
  "missingDrainageMeshes",
  "transparentPhaseTwoMaterials",
  "wellRootOffsetX",
  "roadMaterialFrozen",
  "curbHalfWidth",
  "channelHalfWidth",
  '"caelus-phase2-main-street-curb-left"',
  '"caelus-phase2-service-lane-channel-right"'
]) {
  if (!extension.includes(feature)) throw new Error(`Missing Phase Two playtest feature: ${feature}`);
}

for (const assertion of [
  'bridgeCall<PhaseTwoAudit>(page, "phaseTwoAudit")',
  'bridgeCall<CollisionProbe>(page, "phaseTwoCollisionProbe"',
  "audit.roadVisualRevision",
  "audit.curbHalfWidth",
  "audit.channelHalfWidth",
  "audit.drainageBandCount",
  "audit.collisionAudit?.duplicatePairs",
  "audit.collisionAudit?.mainRouteIntrusions",
  "captureLockedView",
  '"phase2-main-road-drainage"',
  '"phase2-relocated-town-well"',
  '"phase2-market-lane-drainage"',
  '"phase2-guild-lane-drainage"',
  "expect(runtimeErrors).toEqual([])",
  "expect(consoleErrors).toEqual([])"
]) {
  if (!browserTest.includes(assertion)) throw new Error(`Missing Phase Two browser assertion: ${assertion}`);
}

const combined = `${director}\n${extension}\n${browserTest}`.toLowerCase();
for (const banned of ["placeholder asset", "replace later", "temporary asset", "todo:"]) {
  if (combined.includes(banned)) throw new Error(`Phase Two source contains banned marker: ${banned}`);
}

console.log("Project Ascension Caelus Phase Two road and collision smoke checks passed.");
