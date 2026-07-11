import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";

const requiredFiles = [
  "src/core/CaelusReferenceTownDirector.ts",
  "src/core/CaelusReferenceTownPolishDirector.ts",
  "src/core/CaelusRoadConnectivityDirector.ts",
  "tests/browser/caelus-reference-town.spec.mts",
  "tests/browser/combat-reference.spec.mts",
  "tests/browser/vertical-slice-reference.spec.mts"
];
await Promise.all(requiredFiles.map((file) => access(file, constants.R_OK)));

const [main, director, polish, connectivity, referenceTest, combatTest, routeTest, workflow] = await Promise.all([
  readFile("src/main.ts", "utf8"),
  readFile("src/core/CaelusReferenceTownDirector.ts", "utf8"),
  readFile("src/core/CaelusReferenceTownPolishDirector.ts", "utf8"),
  readFile("src/core/CaelusRoadConnectivityDirector.ts", "utf8"),
  readFile("tests/browser/caelus-reference-town.spec.mts", "utf8"),
  readFile("tests/browser/combat-reference.spec.mts", "utf8"),
  readFile("tests/browser/vertical-slice-reference.spec.mts", "utf8"),
  readFile(".github/workflows/quality.yml", "utf8")
]);

const bridgeIndex = main.indexOf("new PlaytestBridge(game, renderer)");
const referenceIndex = main.indexOf("new CaelusReferenceTownDirector(game)");
const polishIndex = main.indexOf("new CaelusReferenceTownPolishDirector(game)");
const connectivityIndex = main.indexOf("new CaelusRoadConnectivityDirector(game)");
const surveyIndex = main.indexOf("new CaelusBaselineSurveyDirector(game)");
if (
  bridgeIndex < 0
  || referenceIndex <= bridgeIndex
  || polishIndex <= referenceIndex
  || connectivityIndex <= polishIndex
  || surveyIndex <= connectivityIndex
) {
  throw new Error("Reference town, polish, and road connectivity must install after PlaytestBridge and before city surveys.");
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
  "caelus-reference-well-dark-shaft",
  "this.createWall(\"south-left\"",
  "`caelus-reference-wall-${id}`",
  "supersededByReferenceTown"
]) {
  if (!director.includes(feature)) throw new Error(`Missing Set 1.4 production feature: ${feature}`);
}

for (const feature of [
  "const GATE_TOWER_X = 13",
  "const PATH_COLOR = \"#68705d\"",
  "const ROAD_COLOR = \"#18211f\"",
  "caelusReferenceGateClearWidth: 16.8",
  "referenceTownPolishAudit",
  "caelus-reference-gate-tower-"
]) {
  if (!polish.includes(feature)) throw new Error(`Missing Set 1.4 polish feature: ${feature}`);
}

for (const feature of [
  "Set 1 / Milestone 1.4.1 — Road Connectivity Cleanup",
  "const MAIN_ROAD_HALF_WIDTH = 9",
  "const COLLECTOR_HALF_WIDTH = 2.5",
  "caelus-connected-main-road",
  "caelus-connected-collector-",
  "caelus-connected-frontage-junction-",
  "roadConnectivityAudit",
  "roadConnectivityMeshes",
  "removedForOpenWellFrame",
  "disconnectedCollectorCount",
  "disconnectedFrontageCount",
  "wellCanopyRemoved"
]) {
  if (!connectivity.includes(feature)) throw new Error(`Missing Set 1.4.1 connectivity feature: ${feature}`);
}

const houseDefinitions = director.match(/id: "(?:upper|middle|lower)-/g) ?? [];
if (houseDefinitions.length !== 20) throw new Error(`Expected exactly 20 approved house definitions, found ${houseDefinitions.length}.`);

for (const assertion of [
  "expect(audit.houseCount).toBe(20)",
  "expect(audit.gateOpeningCount).toBe(2)",
  "expect(audit.townCenterPresent).toBe(false)",
  "expect(audit.houseRoadIntersections).toEqual([])",
  "expect(audit.houseCollectorIntersections).toEqual([])",
  "expect(audit.houseWallIntersections).toEqual([])",
  "expect(audit.houseHouseIntersections).toEqual([])",
  "expect(audit.blockedMainRouteSamples).toBe(0)",
  "expect(connectivity.mainRoadWidth).toBe(18)",
  "expect(connectivity.collectorRoadCount).toBe(3)",
  "expect(connectivity.frontageConnectorCount).toBe(21)",
  "expect(connectivity.disconnectedCollectorCount).toBe(0)",
  "expect(connectivity.disconnectedFrontageCount).toBe(0)",
  "expect(connectivity.wellCanopyRemoved).toBe(true)",
  "reference-town-connected-road-aerial",
  "reference-town-connected-paths",
  "reference-town-open-well"
]) {
  if (!referenceTest.includes(assertion)) throw new Error(`Missing Set 1.4.1 browser assertion: ${assertion}`);
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

const combined = `${director}\n${polish}\n${connectivity}\n${referenceTest}\n${combatTest}\n${routeTest}`.toLowerCase();
for (const banned of ["placeholder asset", "replace later", "temporary asset", "todo:"]) {
  if (combined.includes(banned)) throw new Error(`Set 1.4 source contains banned marker: ${banned}`);
}

console.log("Project Ascension Set 1 Milestone 1.4.1 connected-road smoke checks passed.");
