import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";

const requiredFiles = [
  "src/core/CaelusBaselineSurveyDirector.ts",
  "tests/browser/caelus-baseline-survey.spec.mts"
];

await Promise.all(requiredFiles.map((file) => access(file, constants.R_OK)));

const [main, survey, browserTest] = await Promise.all([
  readFile("src/main.ts", "utf8"),
  readFile("src/core/CaelusBaselineSurveyDirector.ts", "utf8"),
  readFile("tests/browser/caelus-baseline-survey.spec.mts", "utf8")
]);

const bridgeIndex = main.indexOf("new PlaytestBridge(game, renderer)");
const surveyIndex = main.indexOf("new CaelusBaselineSurveyDirector(game)");
const phaseTwoExtensionIndex = main.indexOf("new CaelusPhaseTwoPlaytestExtension(game)");
if (bridgeIndex < 0 || surveyIndex <= bridgeIndex || phaseTwoExtensionIndex <= surveyIndex) {
  throw new Error("Milestone 1.1 survey must install after PlaytestBridge and before the Phase Two extension.");
}

for (const feature of [
  "Set 1 / Milestone 1.1 — Baseline City Survey",
  "caelusBaselineSurveyVersion: 1",
  "__CAELUS_BASELINE_SURVEY__",
  "baselineSurvey = () => this.cloneReport()",
  "setBaselineSurveyVisible",
  "TOWN_BOUNDS",
  "TERRAIN_STEP",
  "ROUTE_DEFINITION",
  "BUILDING_FOOTPRINT_OVERLAP",
  "BUILDING_ROAD_BROADPHASE_INTERSECTION",
  "BUILDING_UNEVEN_GROUND",
  "BUILDING_MISSING_FRONTAGE",
  "FRONTAGE_CROSSES_BUILDING",
  "COLLISION_VOLUME_OVERLAP",
  "PROTECTED_ROUTE_BLOCKED",
  "ROUGH_TOWN_TERRAIN",
  "INCOMPLETE_VISIBLE_PERIMETER",
  "TRANSPARENT_TOWN_MATERIAL",
  "caelus-baseline-survey-overlay",
  "DOWNLOAD JSON",
  "event.code !== \"F9\""
]) {
  if (!survey.includes(feature)) throw new Error(`Missing Milestone 1.1 survey feature: ${feature}`);
}

for (const assertion of [
  'bridgeCall<BaselineSurveyReport>(page, "baselineSurvey")',
  'bridgeCall(page, "setBaselineSurveyVisible", true)',
  "report.version",
  "report.summary.buildings",
  "report.summary.roads",
  "report.summary.collisionVolumes",
  "report.terrain.samples.length",
  "report.protectedRoute.points.length",
  "caelus-baseline-survey-map",
  "baseline-survey-report.json",
  "expect(runtimeErrors).toEqual([])",
  "expect(consoleErrors).toEqual([])"
]) {
  if (!browserTest.includes(assertion)) throw new Error(`Missing Milestone 1.1 browser assertion: ${assertion}`);
}

const combined = `${survey}\n${browserTest}`.toLowerCase();
for (const banned of ["placeholder asset", "replace later", "temporary asset", "todo:"]) {
  if (combined.includes(banned)) throw new Error(`Milestone 1.1 source contains banned marker: ${banned}`);
}

console.log("Project Ascension Set 1 Milestone 1.1 baseline survey smoke checks passed.");
