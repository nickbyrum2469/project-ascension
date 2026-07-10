import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";

const requiredFiles = [
  "index.html",
  "src/main.ts",
  "src/game/Game.ts",
  "src/game/Player.ts",
  "src/game/QuestSystem.ts",
  "src/game/RiftBoar.ts",
  "src/world/World.ts",
  "src/world/FoundryLabyrinth.ts",
  "src/world/ProceduralAssets.ts",
  "src/ui/Hud.ts",
  "src/audio/AudioDirector.ts",
  "public/assets/asset-manifest.json",
  "public/assets/branding/ascension-mark.svg"
];

await Promise.all(requiredFiles.map((file) => access(file, constants.R_OK)));

const html = await readFile("index.html", "utf8");
const ids = ["render-canvas", "enter-world", "hud", "dialogue-panel", "pause-panel"];
for (const id of ids) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Missing required UI id: ${id}`);
}

const sourceFiles = await Promise.all([
  "src/main.ts",
  "src/game/Game.ts",
  "src/game/Player.ts",
  "src/game/QuestSystem.ts",
  "src/game/RiftBoar.ts",
  "src/world/World.ts",
  "src/world/FoundryLabyrinth.ts",
  "src/world/ProceduralAssets.ts",
  "src/ui/Hud.ts"
].map((file) => readFile(file, "utf8")));
const productionSource = sourceFiles.join("\n").toLowerCase();
for (const banned of ["todo:", "replace later", "temporary asset", "placeholder asset", "navigationrect"]) {
  if (productionSource.includes(banned)) throw new Error(`Production source contains banned marker: ${banned}`);
}

for (const requiredFeature of [
  "foundrylabyrinth",
  "sigilsactivated",
  "guardiandefeated",
  "foundry sentinel",
  "slam",
  "restorecore",
  "shortcutopened",
  "createterrainribbon",
  "samplecatmullrom",
  "resolveplayerposition",
  "rightforearm",
  "leftshin",
  "connectedweapon",
  "animatefirstpersonattack",
  "animatefirstpersonguard",
  "resolvevisiblegates",
  "foundation-rib-collar"
]) {
  if (!productionSource.includes(requiredFeature)) {
    throw new Error(`Missing required reconstruction feature: ${requiredFeature}`);
  }
}

const manifest = JSON.parse(await readFile("public/assets/asset-manifest.json", "utf8"));
if (!Array.isArray(manifest.assets) || manifest.assets.length < 3) {
  throw new Error("Asset manifest is incomplete.");
}
for (const asset of manifest.assets) {
  if (!asset.id || !asset.type || !asset.creator || !asset.source || !asset.license || !asset.usage) {
    throw new Error(`Asset manifest entry is incomplete: ${JSON.stringify(asset)}`);
  }
}

console.log("Project Ascension reconstruction smoke checks passed.");
