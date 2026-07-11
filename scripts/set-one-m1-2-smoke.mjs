import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";

const files = [
  "src/core/CaelusTownBoundaryDirector.ts",
  "tests/browser/caelus-town-boundary.spec.mts"
];
await Promise.all(files.map((file) => access(file, constants.R_OK)));
const [main, boundary, browser] = await Promise.all([
  readFile("src/main.ts", "utf8"),
  readFile(files[0], "utf8"),
  readFile(files[1], "utf8")
]);

if (!main.includes("new CaelusTownBoundaryDirector(game)")) throw new Error("Town boundary director is not installed.");
for (const token of [
  "Set 1 / Milestone 1.2",
  "FINAL_PERIMETER",
  "Gate & Watch",
  "Main Street",
  "Town Center",
  "Market Square",
  "Guild Court",
  "Residential Lane",
  "Service Yard",
  "Frontier Supply Row & Exit",
  "gate-to-frontier",
  "gate-to-center",
  "center-to-frontier",
  "caelus-boundary-final-perimeter",
  "caelus-town-boundary-overlay",
  "event.code !== \"F8\"",
  "townBoundaryAudit",
  "districtOverlapPairs.length === 0",
  "foundrySeparation >= 20",
  "compactness >= 0.64"
]) {
  if (!boundary.includes(token)) throw new Error(`Missing Set 1.2 boundary feature: ${token}`);
}
for (const assertion of [
  'bridgeCall<BoundaryAudit>(page, "townBoundaryAudit")',
  "expect(audit.pass).toBe(true)",
  "expect(audit.districts).toHaveLength(8)",
  "expect(audit.corridors).toHaveLength(4)",
  "expect(audit.districtOverlapPairs).toEqual([])",
  "expect(audit.protectedRouteInsideBoundary).toBe(true)",
  'bridgeCall(page, "setTownBoundaryVisible", true)',
  "caelus-town-boundary-overlay",
  "town-boundary-debug.png"
]) {
  if (!browser.includes(assertion)) throw new Error(`Missing Set 1.2 browser assertion: ${assertion}`);
}
console.log("Project Ascension Set 1 Milestone 1.2 boundary smoke checks passed.");
