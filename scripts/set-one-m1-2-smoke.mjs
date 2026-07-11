import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";

const requiredFiles = [
  "src/world/CaelusTownPlan.ts",
  "src/core/CaelusTownBoundaryDirector.ts",
  "tests/browser/caelus-town-boundary.spec.mts"
];

await Promise.all(requiredFiles.map((file) => access(file, constants.R_OK)));

const [main, plan, director, browserTest, workflow] = await Promise.all([
  readFile("src/main.ts", "utf8"),
  readFile("src/world/CaelusTownPlan.ts", "utf8"),
  readFile("src/core/CaelusTownBoundaryDirector.ts", "utf8"),
  readFile("tests/browser/caelus-town-boundary.spec.mts", "utf8"),
  readFile(".github/workflows/quality.yml", "utf8")
]);

const bridgeIndex = main.indexOf("new PlaytestBridge(game, renderer)");
const boundaryIndex = main.indexOf("new CaelusTownBoundaryDirector(game)");
const surveyIndex = main.indexOf("new CaelusBaselineSurveyDirector(game)");
if (bridgeIndex < 0 || boundaryIndex <= bridgeIndex || surveyIndex <= boundaryIndex) {
  throw new Error("Milestone 1.2 boundary director must install after PlaytestBridge and before the baseline survey.");
}

for (const marker of [
  "Set 1 / Milestone 1.2 — Final Town Boundary",
  "Compact Floor-One frontier town",
  "version: 2",
  "id: \"gate-watch\"",
  "id: \"main-street\"",
  "id: \"market-square\"",
  "id: \"town-center\"",
  "id: \"guild-court\"",
  "id: \"residential-lane\"",
  "id: \"service-yard\"",
  "id: \"frontier-supply\"",
  "id: \"primary-spine\"",
  "id: \"market-cut-through\"",
  "id: \"residential-loop\"",
  "id: \"guild-shortcut\"",
  "id: \"service-access\"",
  "id: \"gate-to-center\"",
  "id: \"center-to-frontier\"",
  "requiredAdjacency",
  "polygonArea",
  "pointInPolygon",
  "samplePolyline"
]) {
  if (!plan.includes(marker)) throw new Error(`Missing canonical Milestone 1.2 plan marker: ${marker}`);
}

for (const feature of [
  "__CAELUS_TOWN_BOUNDARY__",
  "__CAELUS_TOWN_PLAN__",
  "townBoundaryAudit",
  "setTownBoundaryVisible",
  "townBoundaryVisible",
  "caelus-town-boundary-overlay",
  "event.code !== \"F8\"",
  "ACTIVE_BUILDING_OUTSIDE_FINAL_BOUNDARY",
  "DISTRICT_OUTSIDE_FINAL_BOUNDARY",
  "INVALID_DISTRICT_TOPOLOGY",
  "PROTECTED_GATE_TO_FRONTIER_ROUTE_FAILED",
  "SECONDARY_CORRIDOR_RELOCATION_REQUIRED",
  "REQUIRED_SIGHTLINE_BLOCKED",
  "FINAL_BOUNDARY_LOCKED",
  "caelusTownBoundaryProtectedRoutePreserved"
]) {
  if (!director.includes(feature)) throw new Error(`Missing Milestone 1.2 boundary feature: ${feature}`);
}

for (const assertion of [
  'bridgeCall<TownBoundaryReport>(page, "townBoundaryAudit")',
  "report.plan.boundaryVertices",
  "report.plan.footprintReduction",
  "report.plan.districtCount",
  "report.plan.anchorCount",
  "report.plan.corridorCount",
  "report.plan.sightlineCount",
  "report.activeBuildingsOutsideBoundary",
  "report.districtVerticesOutsideBoundary",
  "report.topologyViolations",
  "report.protectedRoute.preserved",
  'bridgeCall(page, "setTownBoundaryVisible", true)',
  "caelus-final-town-boundary.png",
  "caelus-final-town-boundary.json",
  "expect(runtimeErrors).toEqual([])",
  "expect(consoleErrors).toEqual([])"
]) {
  if (!browserTest.includes(assertion)) throw new Error(`Missing Milestone 1.2 browser assertion: ${assertion}`);
}

if (!workflow.includes("caelus-town-boundary.spec.mts") || !workflow.includes("town-boundary")) {
  throw new Error("Milestone 1.2 browser suite is not present in the permanent quality matrix.");
}

const combined = `${plan}\n${director}\n${browserTest}`.toLowerCase();
for (const banned of ["placeholder asset", "replace later", "temporary asset", "todo:"]) {
  if (combined.includes(banned)) throw new Error(`Milestone 1.2 source contains banned marker: ${banned}`);
}

console.log("Project Ascension Set 1 Milestone 1.2 final town boundary smoke checks passed.");
