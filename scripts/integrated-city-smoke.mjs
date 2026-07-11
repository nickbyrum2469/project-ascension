import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";

const requiredFiles = [
  "src/core/CaelusIntegratedCity.ts",
  "src/core/CaelusIntegratedCityPolish.ts",
  "src/core/CombatRigCorrectionDirector.ts",
  "src/core/CaelusIntegratedPlaytestExtension.ts",
  "tests/browser/caelus-integrated.spec.mts"
];

await Promise.all(requiredFiles.map((file) => access(file, constants.R_OK)));

const [main, city, polish, combat, extension, browserTest] = await Promise.all([
  readFile("src/main.ts", "utf8"),
  readFile("src/core/CaelusIntegratedCity.ts", "utf8"),
  readFile("src/core/CaelusIntegratedCityPolish.ts", "utf8"),
  readFile("src/core/CombatRigCorrectionDirector.ts", "utf8"),
  readFile("src/core/CaelusIntegratedPlaytestExtension.ts", "utf8"),
  readFile("tests/browser/caelus-integrated.spec.mts", "utf8")
]);

for (const feature of [
  "new CaelusIntegratedCity(game, frontierContracts)",
  "new CaelusIntegratedCityPolish(game)",
  "new CombatRigCorrectionDirector(game)",
  "new CaelusIntegratedPlaytestExtension(game)"
]) {
  if (!main.includes(feature)) throw new Error(`Missing integrated main initialization: ${feature}`);
}

for (const feature of [
  "caelusIntegratedCityVersion: 1",
  "integratedRoadCount",
  "integratedJunctionCount",
  "integratedBuildingCount",
  "integratedFrontageCount",
  "curbInsideJunction",
  "channelInsideJunction",
  "roadBuildingOverlaps",
  "buildingOverlapPairs",
  "caelus-integrated-well-dark-shaft",
  "caelus-integrated-guild-hall-body",
  "boarContractAvailable",
  "closedSolidGeometry"
]) {
  if (!city.includes(feature)) throw new Error(`Missing integrated city feature: ${feature}`);
}

for (const feature of [
  "relocateServiceWorkshop",
  "integratedLayoutCorrectionVersion: 1",
  "roadBuildingOverlaps = 0",
  "main-workshop-east-frontage-corrected"
]) {
  if (!polish.includes(feature)) throw new Error(`Missing layout correction feature: ${feature}`);
}

for (const feature of [
  "combatRigCorrectionVersion: 1",
  "swordForwardRuleInstalled",
  "stableGuardRuleInstalled",
  "Math.PI / 2",
  "guardAnchor",
  "guardFramesStable",
  "swordForwardDot"
]) {
  if (!combat.includes(feature)) throw new Error(`Missing combat correction feature: ${feature}`);
}

for (const feature of [
  "integratedCityAudit",
  "combatRigAudit",
  "setGuardHeld",
  "setPlayerHeading",
  "visibleSuperseded",
  "transparentIntegratedMaterials"
]) {
  if (!extension.includes(feature)) throw new Error(`Missing integrated playtest feature: ${feature}`);
}

for (const assertion of [
  'bridgeCall<IntegratedCityAudit>(page, "integratedCityAudit")',
  'bridgeCall<CombatRigAudit>(page, "combatRigAudit")',
  'bridgeCall(page, "setGuardHeld", true)',
  'bridgeCall(page, "setPlayerHeading"',
  "audit.audit?.curbInsideJunction",
  "audit.audit?.roadBuildingOverlaps",
  '"integrated-gate-exterior"',
  '"integrated-town-center-well"',
  '"integrated-market-square"',
  '"integrated-guild-court"',
  '"integrated-guard-pose"',
  "expect(runtimeErrors).toEqual([])",
  "expect(consoleErrors).toEqual([])"
]) {
  if (!browserTest.includes(assertion)) throw new Error(`Missing integrated browser assertion: ${assertion}`);
}

const combined = `${city}\n${polish}\n${combat}\n${extension}\n${browserTest}`.toLowerCase();
for (const banned of ["placeholder asset", "replace later", "temporary asset", "todo:"]) {
  if (combined.includes(banned)) throw new Error(`Integrated source contains banned marker: ${banned}`);
}

console.log("Project Ascension integrated Caelus city and combat smoke checks passed.");
