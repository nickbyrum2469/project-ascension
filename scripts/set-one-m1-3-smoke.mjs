import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";

const files = [
  "src/core/CaelusControlledTerrainDirector.ts",
  "tests/browser/caelus-town-boundary.spec.mts"
];
await Promise.all(files.map((file) => access(file, constants.R_OK)));
const [main, terrain, browser] = await Promise.all([
  readFile("src/main.ts", "utf8"),
  readFile(files[0], "utf8"),
  readFile(files[1], "utf8")
]);

for (const token of [
  "installCaelusControlledTerrain(VerticalSliceDirector)",
  "new CaelusControlledTerrainDirector(game)"
]) {
  if (!main.includes(token)) throw new Error(`Controlled terrain is not installed: ${token}`);
}
for (const token of [
  "Set 1 / Milestone 1.3",
  "TERRAIN_ZONES",
  "BUILDING_PADS",
  "CORRIDORS",
  "controlledTerrainSample",
  "maximumBuildingVariance <= 0.08",
  "maximumCorridorGrade <= 0.07",
  "caelus-controlled-terrain-overlay",
  "event.code !== \"F7\"",
  "controlledTerrainAudit",
  "controlled-terrain-aerial-clean.png",
  "controlled-terrain-aerial-debug.png",
  "controlled-terrain-street-level.png"
]) {
  if (!terrain.includes(token) && !browser.includes(token)) throw new Error(`Missing Set 1.3 feature: ${token}`);
}
console.log("Project Ascension Set 1 Milestone 1.3 controlled terrain smoke checks passed.");
