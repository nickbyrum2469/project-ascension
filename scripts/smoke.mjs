import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";

const requiredFiles = [
  "index.html",
  "src/main.ts",
  "src/core/CombatFeelDirector.ts",
  "src/core/FloorTwoArrivalDirector.ts",
  "src/core/PerformanceDirector.ts",
  "src/game/Game.ts",
  "src/game/Player.ts",
  "src/game/QuestSystem.ts",
  "src/game/RiftBoar.ts",
  "src/world/World.ts",
  "src/world/FoundryLabyrinth.ts",
  "src/world/ExpeditionLayer.ts",
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
  "src/core/CombatFeelDirector.ts",
  "src/core/FloorTwoArrivalDirector.ts",
  "src/core/PerformanceDirector.ts",
  "src/data/GameTypes.ts",
  "src/game/Game.ts",
  "src/game/Player.ts",
  "src/game/QuestSystem.ts",
  "src/game/RiftBoar.ts",
  "src/world/World.ts",
  "src/world/FoundryLabyrinth.ts",
  "src/world/ExpeditionLayer.ts",
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
  "foundation-rib-collar",
  "expeditionsave",
  "activatedbeacons",
  "claimedcaches",
  "riftglassshards",
  "expeditionlayer",
  "foundation-beacon",
  "caelus-citizen",
  "eastern-pillar-lift",
  "updateambience",
  "respawnoutdoorenemies",
  "completeascent",
  "new performancedirector",
  "mesh.mergemeshes",
  "sethardwarescalinglevel",
  "new combatfeeldirector",
  "trailmesh",
  "warden-third-person-trail",
  "warden-first-person-trail",
  "confirmhit",
  "hitstop",
  "combat-damage-number",
  "updatedamagelabels",
  "startstagger",
  "combat-combo",
  "detectguardimpact",
  "updatecamerapunch",
  "new floortwoarrivaldirector",
  "floor-two-arrival-terrace",
  "floor-two-survey-console",
  "floor-two-threshold-fragment",
  "floor-two-return-console",
  "floor-two-rift-shear",
  "installmovementsurface",
  "this.game.finishascentcycle",
  "floortwosurveyed",
  "descend to the foundry core",
  "no loading boundary",
  "pillar descent complete",
  "the aerial scar",
  "installfloortwosafety",
  "state.upperactive && game.player.root.position.y < state.upperfloory - 18",
  "cameracollision: true",
  "consolidatefloortwostaticgeometry",
  "batched-floor-two-",
  "batched ${sourcecount} floor two static meshes"
]) {
  if (!productionSource.includes(requiredFeature)) {
    throw new Error(`Missing required production feature: ${requiredFeature}`);
  }
}

const combatSource = await readFile("src/core/CombatFeelDirector.ts", "utf8");
if (combatSource.includes("CreateTube") || combatSource.includes("CreateRibbon")) {
  throw new Error("Combat feedback must not rebuild trail geometry every frame.");
}
if (!combatSource.includes("current < previous")) {
  throw new Error("Hit-stop must be driven by confirmed enemy health loss.");
}
if (!combatSource.includes("copyFrom(pulse.originalScaling)")) {
  throw new Error("Enemy stagger feedback must restore the original enemy scale.");
}

const floorTwoSource = await readFile("src/core/FloorTwoArrivalDirector.ts", "utf8");
if (!floorTwoSource.includes("this.upperActive && this.resolvingPlayer")) {
  throw new Error("Upper-floor height must only override terrain while resolving the player.");
}
if (!floorTwoSource.includes("this.originalHeightAt(x, z)")) {
  throw new Error("Floor One terrain must remain available outside the upper staging zone.");
}
if (!floorTwoSource.includes('claimCache("floor-two-threshold-fragment")')) {
  throw new Error("Threshold-fragment recovery must use persistent expedition cache progression.");
}
const updateStart = floorTwoSource.indexOf("private update(): void");
const updateEnd = floorTwoSource.indexOf("private refreshObjective", updateStart);
const updateBody = floorTwoSource.slice(updateStart, updateEnd);
for (const forbiddenRuntimeAllocation of ["MeshBuilder.Create", "new BABYLON.PBRMaterial", "new BABYLON.StandardMaterial"]) {
  if (updateBody.includes(forbiddenRuntimeAllocation)) {
    throw new Error(`Floor Two update loop contains expensive runtime allocation: ${forbiddenRuntimeAllocation}`);
  }
}

const mainSource = await readFile("src/main.ts", "utf8");
const arrivalIndex = mainSource.indexOf("new FloorTwoArrivalDirector(game)");
const safetyIndex = mainSource.indexOf("installFloorTwoSafety(game, floorTwo)");
const batchIndex = mainSource.indexOf("consolidateFloorTwoStaticGeometry(game)");
const performanceIndex = mainSource.indexOf("new PerformanceDirector(engine, game.world, renderer)");
if (arrivalIndex < 0 || safetyIndex <= arrivalIndex) {
  throw new Error("Floor Two safety must wrap the player after the arrival director installs its upper movement surface.");
}
if (batchIndex <= safetyIndex || performanceIndex <= batchIndex) {
  throw new Error("Floor Two static batching must occur after collision metadata and before the global performance director.");
}
if (!mainSource.includes('name === "floor-two-arrival-terrace"') || !mainSource.includes('name.includes("-rail-")')) {
  throw new Error("Visible Floor Two floor and rail geometry must participate in camera collision.");
}
for (const dynamicName of [
  '"floor-two-rift-shear"',
  '"floor-two-threshold-fragment"',
  '"floor-two-survey-lens"'
]) {
  if (!mainSource.includes(dynamicName)) {
    throw new Error(`Floor Two batching must preserve dynamic mesh family: ${dynamicName}`);
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

console.log("Project Ascension Floor Two arrival production checks passed.");
