import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";

const requiredFiles = [
  "src/core/CaelusReferenceTownDirector.ts",
  "src/core/CaelusReferenceTownPolishDirector.ts",
  "src/core/CaelusRoofAlignmentDirector.ts",
  "src/core/CaelusRoadConnectivityDirector.ts",
  "tests/browser/caelus-reference-town.spec.mts",
  "tests/browser/combat-reference.spec.mts",
  "tests/browser/vertical-slice-reference.spec.mts"
];
await Promise.all(requiredFiles.map((file) => access(file, constants.R_OK)));

const [main, director, polish, roofs, connectivity, referenceTest, combatTest, routeTest, workflow] = await Promise.all([
  readFile("src/main.ts", "utf8"),
  readFile("src/core/CaelusReferenceTownDirector.ts", "utf8"),
  readFile("src/core/CaelusReferenceTownPolishDirector.ts", "utf8"),
  readFile("src/core/CaelusRoofAlignmentDirector.ts", "utf8"),
  readFile("src/core/CaelusRoadConnectivityDirector.ts", "utf8"),
  readFile("tests/browser/caelus-reference-town.spec.mts", "utf8"),
  readFile("tests/browser/combat-reference.spec.mts", "utf8"),
  readFile("tests/browser/vertical-slice-reference.spec.mts", "utf8"),
  readFile(".github/workflows/quality.yml", "utf8")
]);

const bridgeIndex = main.indexOf("new PlaytestBridge(game, renderer)");
const referenceIndex = main.indexOf("new CaelusReferenceTownDirector(game)");
const polishIndex = main.indexOf("new CaelusReferenceTownPolishDirector(game)");
const roofIndex = main.indexOf("new CaelusRoofAlignmentDirector(game)");
const connectivityIndex = main.indexOf("new CaelusRoadConnectivityDirector(game)");
const surveyIndex = main.indexOf("new CaelusBaselineSurveyDirector(game)");
if (
  bridgeIndex < 0
  || referenceIndex <= bridgeIndex
  || polishIndex <= referenceIndex
  || roofIndex <= polishIndex
  || connectivityIndex <= roofIndex
  || surveyIndex <= connectivityIndex
) {
  throw new Error("Reference town, polish, roof alignment, and road connectivity must install after PlaytestBridge and before city surveys.");
}

for (const feature of [
  "Set 1 / Milestone 1.4 — Approved Reference Layout",
  "const WALL_X = 116",
  "const SOUTH_WALL_Z = 14",
  "const NORTH_WALL_Z = 228",
  "const WELL_POSITION: Point2 = { x: -91, z: 207 }",
  "houseCount: HOUSES.length",
  "gateOpeningCount: 2",
  "townCenterPresent: false",
  "blockedMainRouteSamples",
  "referenceTownAudit",
  "referenceTownMeshes",
  "caelus-reference-well-dark-shaft",
  "supersededByReferenceTown"
]) {
  if (!director.includes(feature)) throw new Error(`Missing Set 1.4 production feature: ${feature}`);
}

for (const feature of [
  "const GATE_TOWER_X = 13",
  "caelusReferenceGateClearWidth: 16.8",
  "referenceTownPolishAudit",
  "caelus-reference-gate-tower-"
]) {
  if (!polish.includes(feature)) throw new Error(`Missing Set 1.4 polish feature: ${feature}`);
}

for (const feature of [
  "Set 1 / Milestone 1.4.2 — Road and Roof Alignment",
  "const ROOF_OVERHANG = 0.9",
  "const ROOF_HEIGHT = 4.2",
  "caelus-aligned-house-",
  "supersededByAlignedRoof",
  "roofAlignmentAudit",
  "alignedRoofMeshes",
  "misalignedRoofCount",
  "minimumOverhang",
  "maximumCenterOffset"
]) {
  if (!roofs.includes(feature)) throw new Error(`Missing Set 1.4.2 roof feature: ${feature}`);
}

for (const feature of [
  "Set 1 / Milestone 1.4.2 — Road and Roof Alignment",
  "const MAIN_ROAD_HALF_WIDTH = 9",
  "const COLLECTOR_HALF_WIDTH = 3",
  "const FRONTAGE_OVERLAP = 3.2",
  "const SAMPLE_STEP = 2",
  "caelus-connected-v2-main-road",
  "caelus-connected-v2-collector-",
  "caelus-connected-v2-frontage-",
  "caelus-connected-v2-north-gate-apron",
  "caelus-connected-v2-south-gate-apron",
  "terrainFollowing: true",
  "roadConnectivityAudit",
  "buriedSurfaceVertexCount",
  "minimumSurfaceClearance",
  "northGateCovered",
  "southGateCovered"
]) {
  if (!connectivity.includes(feature)) throw new Error(`Missing Set 1.4.2 road feature: ${feature}`);
}

const houseDefinitions = director.match(/id: "(?:upper|middle|lower)-/g) ?? [];
if (houseDefinitions.length !== 20) throw new Error(`Expected exactly 20 approved house definitions, found ${houseDefinitions.length}.`);

for (const assertion of [
  "expect(audit.houseCount).toBe(20)",
  "expect(audit.gateOpeningCount).toBe(2)",
  "expect(audit.houseRoadIntersections).toEqual([])",
  "expect(audit.houseCollectorIntersections).toEqual([])",
  "expect(audit.houseWallIntersections).toEqual([])",
  "expect(audit.houseHouseIntersections).toEqual([])",
  "expect(roofs.alignedRoofCount).toBe(20)",
  "expect(roofs.retiredLegacyRoofCount).toBe(20)",
  "expect(roofs.misalignedRoofCount).toBe(0)",
  "expect(roofs.minimumOverhang).toBeGreaterThanOrEqual(0.75)",
  "expect(roofs.maximumCenterOffset).toBeLessThanOrEqual(0.01)",
  "expect(connectivity.frontageRoadCount).toBe(21)",
  "expect(connectivity.junctionPatchCount).toBe(24)",
  "expect(connectivity.disconnectedCollectorCount).toBe(0)",
  "expect(connectivity.disconnectedFrontageCount).toBe(0)",
  "expect(connectivity.buriedSurfaceVertexCount).toBe(0)",
  "expect(connectivity.minimumSurfaceClearance).toBeGreaterThanOrEqual(0.12)",
  "expect(connectivity.northGateCovered).toBe(true)",
  "expect(connectivity.southGateCovered).toBe(true)",
  "reference-town-v2-top-down-roads-roofs",
  "reference-town-v2-lower-road-connections",
  "reference-town-v2-north-gate-road",
  "reference-town-v2-house-roof-alignment"
]) {
  if (!referenceTest.includes(assertion)) throw new Error(`Missing Set 1.4.2 browser assertion: ${assertion}`);
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
if (!workflow.includes("branches: [main, site-test]")) {
  throw new Error("Quality workflow must validate pull requests targeting both main and site-test.");
}

const combined = `${director}\n${polish}\n${roofs}\n${connectivity}\n${referenceTest}\n${combatTest}\n${routeTest}`.toLowerCase();
for (const banned of ["placeholder asset", "replace later", "temporary asset", "todo:"]) {
  if (combined.includes(banned)) throw new Error(`Set 1.4 source contains banned marker: ${banned}`);
}

console.log("Project Ascension Set 1 Milestone 1.4.2 terrain-road and aligned-roof smoke checks passed.");
