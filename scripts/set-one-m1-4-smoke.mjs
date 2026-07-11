import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";

const requiredFiles = [
  "src/core/CaelusReferenceTownDirector.ts",
  "src/core/CaelusReferenceTownPolishDirector.ts",
  "tests/browser/caelus-reference-town.spec.mts",
  "tests/browser/combat-reference.spec.mts",
  "tests/browser/vertical-slice-reference.spec.mts"
];
await Promise.all(requiredFiles.map((file) => access(file, constants.R_OK)));

const [main, director, polish, referenceTest, combatTest, routeTest, workflow] = await Promise.all([
  readFile("src/main.ts", "utf8"),
  readFile("src/core/CaelusReferenceTownDirector.ts", "utf8"),
  readFile("src/core/CaelusReferenceTownPolishDirector.ts", "utf8"),
  readFile("tests/browser/caelus-reference-town.spec.mts", "utf8"),
  readFile("tests/browser/combat-reference.spec.mts", "utf8"),
  readFile("tests/browser/vertical-slice-reference.spec.mts", "utf8"),
  readFile(".github/workflows/quality.yml", "utf8")
]);

const bridgeIndex = main.indexOf("new PlaytestBridge(game, renderer)");
const referenceIndex = main.indexOf("new CaelusReferenceTownDirector(game)");
const polishIndex = main.indexOf("new CaelusReferenceTownPolishDirector(game)");
const surveyIndex = main.indexOf("new CaelusBaselineSurveyDirector(game)");
if (bridgeIndex < 0 || referenceIndex <= bridgeIndex || polishIndex <= referenceIndex || surveyIndex <= polishIndex) {
  throw new Error("Reference town and final polish must install after PlaytestBridge and before city surveys.");
}

for (const feature of [
  "Set 1 / Milestone 1.4 — Approved Reference Layout",
  "const MAIN_ROAD_HALF_WIDTH = 6",
  "const WALL_X = 116",
  "const SOUTH_WALL_Z = 14",
  "const NORTH_WALL_Z = 228",
  "const GATE_HALF_WIDTH = 10",
  "const WELL_POSITION: Point2 = { x: -91, z: 207 }",
  "const COLLECTOR_LEVELS = [182, 124, 70]",
  "houseCount: HOUSES.length",
  "gateOpeningCount: 2",
  "townCenterPresent: false",
  "blockedMainRouteSamples",
  "referenceTownAudit",
  "referenceTownMeshes",
  "caelus-reference-main-street-road-surface",
  "caelus-reference-well-dark-shaft",
  "this.createWall(\"south-left\"",
  "`caelus-reference-wall-${id}`",
  "supersededByReferenceTown"
]) {
  if (!director.includes(feature)) throw new Error(`Missing Set 1.4 production feature: ${feature}`);
}

for (const feature of [
  "const GATE_TOWER_X = 13",
  "#7f876f",
  "caelusReferenceGateClearWidth: 16.8",
  "referenceTownPolishAudit",
  "caelus-reference-gate-tower-"
]) {
  if (!polish.includes(feature)) throw new Error(`Missing Set 1.4 polish feature: ${feature}`);
}

const houseDefinitions = director.match(/id: "(?:upper|middle|lower)-/g) ?? [];
if (houseDefinitions.length !== 20) throw new Error(`Expected exactly 20 approved house definitions, found ${houseDefinitions.length}.`);

for (const assertion of [
  "expect(audit.houseCount).toBe(20)",
  "expect(audit.collectorPathCount).toBe(6)",
  "expect(audit.frontagePathCount).toBe(21)",
  "expect(audit.gateOpeningCount).toBe(2)",
  "expect(audit.townCenterPresent).toBe(false)",
  "expect(audit.houseRoadIntersections).toEqual([])",
  "expect(audit.houseCollectorIntersections).toEqual([])",
  "expect(audit.houseWallIntersections).toEqual([])",
  "expect(audit.houseHouseIntersections).toEqual([])",
  "expect(audit.blockedMainRouteSamples).toBe(0)",
  "expect(polish.pathColor).toBe(\"#7f876f\")",
  "expect(polish.gateClearWidth).toBeGreaterThan(16)",
  "reference-town-aerial",
  "reference-town-upper-left-well"
]) {
  if (!referenceTest.includes(assertion)) throw new Error(`Missing Set 1.4 browser assertion: ${assertion}`);
}

for (const feature of ["guardStabilityProbe", "swordForwardVerified", "referenceTownAudit"]) {
  if (!combatTest.includes(feature)) throw new Error(`Missing reference combat regression: ${feature}`);
}
for (const feature of ["foundry-breach", "pillar-lift", "referenceTownAudit", "throughNorthGate", "10.5"]) {
  if (!routeTest.includes(feature)) throw new Error(`Missing reference vertical-slice regression: ${feature}`);
}
for (const file of [
  "tests/browser/vertical-slice-reference.spec.mts",
  "tests/browser/combat-reference.spec.mts",
  "tests/browser/caelus-reference-town.spec.mts"
]) {
  if (!workflow.includes(file)) throw new Error(`Quality workflow does not run ${file}.`);
}

const combined = `${director}\n${polish}\n${referenceTest}\n${combatTest}\n${routeTest}`.toLowerCase();
for (const banned of ["placeholder asset", "replace later", "temporary asset", "todo:"]) {
  if (combined.includes(banned)) throw new Error(`Set 1.4 source contains banned marker: ${banned}`);
}

console.log("Project Ascension Set 1 Milestone 1.4 approved reference-layout smoke checks passed.");
