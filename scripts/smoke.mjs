import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";

const requiredFiles = [
  "index.html",
  "src/main.ts",
  "src/core/CombatFeelDirector.ts",
  "src/core/FloorTwoArrivalDirector.ts",
  "src/core/FrontierContractDirector.ts",
  "src/core/PerformanceDirector.ts",
  "src/core/VisualRecoveryDirector.ts",
  "src/core/VisualPolishDirector.ts",
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
  "src/core/FrontierContractDirector.ts",
  "src/core/PerformanceDirector.ts",
  "src/core/VisualRecoveryDirector.ts",
  "src/core/VisualPolishDirector.ts",
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
  "batched ${sourcecount} floor two static meshes",
  "new frontiercontractdirector",
  "caelus-frontier-contract-board",
  "review caelus frontier contracts",
  "rift herd control",
  "wisp suppression",
  "foundation survey",
  "boar-control",
  "wisp-suppression",
  "foundation-survey",
  "contract reward attuned",
  "frontier-contract-tracker",
  "this.quests.recordenemydefeat =",
  "this.quests.activatebeacon =",
  "this.quests.claimcache =",
  "expedition.contracts = state",
  "new visualrecoverydirector",
  "third-person-sword-direction-fix",
  "first-person-sword-direction-fix",
  "terrain.bumptexture = null",
  "caelus-south-wall-infill-left",
  "caelus-south-wall-infill-right",
  "caelus-gatehouse-buttress",
  "spawn-trail-pavers-batch",
  "spawn-trail-verge-batch",
  "spawn-trail-markers-batch",
  "new visualpolishdirector",
  "clearcentralgatecollision",
  "frontier-path-stone-a-batch",
  "frontier-path-stone-b-batch",
  "caelus-cobble-a-batch",
  "caelus-cobble-b-batch",
  "caelus-cobble-curb-batch",
  "frontier-route-bush-a-batch",
  "frontier-route-bush-b-batch",
  "frontier-route-rock-batch",
  "frontier-route-fence-batch",
  "addexcludedmesh"
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

const contractSource = await readFile("src/core/FrontierContractDirector.ts", "utf8");
for (const requiredContractRule of [
  "record.progress = Math.min(target, record.progress + 1)",
  "record.completions += 1",
  "record.progress = 0",
  "record.active = false",
  "fractureDust += 4",
  "fractureDust += 6",
  "riftglassShards += 1",
  "riftglassShards += 2",
  "recalculateEquipment?.(true)",
  "collisionBoxes?.push",
  "cameraCollision: true",
  "snapshot === this.lastTrackerSnapshot"
]) {
  if (!contractSource.includes(requiredContractRule)) {
    throw new Error(`Missing frontier contract rule: ${requiredContractRule}`);
  }
}
if (contractSource.includes("onBeforeRenderObservable")) {
  throw new Error("Frontier contracts must remain event-driven rather than adding another frame callback.");
}
if (!contractSource.includes("recordEnemyDefeat(kind);\n      this.recordEnemyProgress(kind);")) {
  throw new Error("Contract kill progress must run after the canonical enemy reward method.");
}
if (!contractSource.includes('if (claimed && !id.startsWith("contract-reward-"))')) {
  throw new Error("Survey progress must ignore synthetic contract reward cache identifiers.");
}

const visualSource = await readFile("src/core/VisualRecoveryDirector.ts", "utf8");
for (const requiredVisualRule of [
  'terrain.bumpTexture = null',
  'name.startsWith("foundation-rib-")',
  'mesh.setEnabled(false)',
  'new BABYLON.Vector3(Math.PI / 2, 0, -0.18)',
  'new BABYLON.Vector3(0, 0.6, 0.25)',
  'new BABYLON.Vector3(-0.25, -0.84, 0.04)',
  'directionCorrected: true',
  'collisionBoxes?.push',
  'const z = -6 - index * 4.45',
  'spawn-trail-pavers-batch',
  'spawn-trail-verge-batch',
  'spawn-trail-markers-batch',
  'caelus-window-light-batch',
  'caelus-market-wood-batch',
  'caelus-plaza-monument'
]) {
  if (!visualSource.includes(requiredVisualRule)) {
    throw new Error(`Missing visual recovery rule: ${requiredVisualRule}`);
  }
}
if (visualSource.includes("spawn-shrub-")) {
  throw new Error("Malformed polyhedron shrubs must not return to the spawn route.");
}
if (visualSource.includes("onBeforeRenderObservable")) {
  throw new Error("Visual recovery must remain a one-time authored correction without another frame callback.");
}

const polishSource = await readFile("src/core/VisualPolishDirector.ts", "utf8");
for (const requiredPolishRule of [
  'this.clearCentralGateCollision()',
  'box.minX < 5',
  'box.maxX > -5',
  'box.minZ < 27',
  'box.maxZ > 14',
  'boxes.splice(index, 1)',
  'mesh.setEnabled(false)',
  'for (let index = 0; index < 40; index += 1)',
  'frontier-path-stone-a-batch',
  'caelus-cobble-a-batch',
  'frontier-route-bush-a-batch',
  'frontier-route-fence-batch',
  'material.disableLighting = true',
  'material.diffuseColor = BABYLON.Color3.Black()',
  'material.emissiveColor = BABYLON.Color3.FromHexString(hex)',
  'this.world.glowLayer?.addExcludedMesh?.(merged)'
]) {
  if (!polishSource.includes(requiredPolishRule)) {
    throw new Error(`Missing final visual polish rule: ${requiredPolishRule}`);
  }
}
if (polishSource.includes("onBeforeRenderObservable")) {
  throw new Error("Final visual polish must remain static and must not add another frame callback.");
}

const mainSource = await readFile("src/main.ts", "utf8");
const arrivalIndex = mainSource.indexOf("new FloorTwoArrivalDirector(game)");
const safetyIndex = mainSource.indexOf("installFloorTwoSafety(game, floorTwo)");
const contractIndex = mainSource.indexOf("new FrontierContractDirector(game)");
const visualIndex = mainSource.indexOf("new VisualRecoveryDirector(game)");
const polishIndex = mainSource.indexOf("new VisualPolishDirector(game)");
const batchIndex = mainSource.indexOf("consolidateFloorTwoStaticGeometry(game)");
const performanceIndex = mainSource.indexOf("new PerformanceDirector(engine, game.world, renderer)");
const combatIndex = mainSource.indexOf("new CombatFeelDirector(game, engine)");
if (arrivalIndex < 0 || safetyIndex <= arrivalIndex) {
  throw new Error("Floor Two safety must wrap the player after the arrival director installs its upper movement surface.");
}
if (
  contractIndex <= safetyIndex
  || visualIndex <= contractIndex
  || polishIndex <= visualIndex
  || batchIndex <= polishIndex
  || performanceIndex <= batchIndex
  || combatIndex <= performanceIndex
) {
  throw new Error("Visual recovery and final polish must run before static freezing, performance setup, and combat trails.");
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

console.log("Project Ascension visual playtest recovery checks passed.");
