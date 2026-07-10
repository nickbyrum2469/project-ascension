import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";

const requiredFiles = [
  "index.html",
  "src/main.ts",
  "src/core/PerformanceDirector.ts",
  "src/core/PlaytestBridge.ts",
  "src/core/VerticalSliceDirector.ts",
  "src/core/VerticalSliceRuntimeGuard.ts",
  "src/core/VerticalSliceActorRebase.ts",
  "src/core/VerticalSliceTraversalGuard.ts",
  "src/core/CaelusPhaseZeroDirector.ts",
  "src/core/CombatPresentationDirector.ts",
  "src/audio/RouteAudioDirector.ts",
  "src/combat-presentation.css",
  "src/game/Game.ts",
  "src/game/Player.ts",
  "src/game/QuestSystem.ts",
  "src/game/RiftBoar.ts",
  "src/world/World.ts",
  "src/world/FoundryLabyrinth.ts",
  "src/world/ProceduralAssets.ts",
  "src/world/RiftWispAsset.ts",
  "src/ui/Hud.ts",
  "src/ui/ExpeditionJournal.ts",
  "src/ui/LoadoutOverlay.ts",
  "src/audio/AudioDirector.ts",
  "playwright.config.mts",
  "tests/browser/vertical-slice.spec.mts",
  ".github/workflows/quality.yml",
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
  "src/core/PerformanceDirector.ts",
  "src/core/PlaytestBridge.ts",
  "src/core/VerticalSliceDirector.ts",
  "src/core/VerticalSliceRuntimeGuard.ts",
  "src/core/VerticalSliceActorRebase.ts",
  "src/core/VerticalSliceTraversalGuard.ts",
  "src/core/CaelusPhaseZeroDirector.ts",
  "src/core/CombatPresentationDirector.ts",
  "src/audio/RouteAudioDirector.ts",
  "src/game/Game.ts",
  "src/game/Player.ts",
  "src/game/QuestSystem.ts",
  "src/game/RiftBoar.ts",
  "src/world/World.ts",
  "src/world/FoundryLabyrinth.ts",
  "src/world/ProceduralAssets.ts",
  "src/world/RiftWispAsset.ts",
  "src/ui/Hud.ts",
  "src/ui/ExpeditionJournal.ts",
  "src/ui/LoadoutOverlay.ts"
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
  "airbornecollisionguard",
  "rightforearm",
  "leftshin",
  "connectedweapon",
  "animatefirstpersonattack",
  "animatefirstpersonguard",
  "resolvevisiblegates",
  "foundation-rib-collar",
  "createcombattelegraph",
  "boar-danger-ring",
  "boar-danger-sweep",
  "updatecombattelegraph",
  "emissiveintensity",
  "rift wisp constellation",
  "createriftwisp",
  "spawnwispbolt",
  "wisp core recovered",
  "fracturedust",
  "weaponrank",
  "wardrank",
  "equippedcharm",
  "outgoingdamagemultiplier",
  "incomingdamagemultiplier",
  "sentinel remnant",
  "wayfinder thread",
  "data-tab=\"loadout\"",
  "western-watch",
  "aqueduct-overlook",
  "foundry-threshold",
  "new loadoutoverlay",
  "project-ascension-equip-charm",
  "setequippedcharm",
  "canequipcharm",
  "wayfinder thread unlocked",
  "sentinel remnant unlocked",
  "oran pell · riftglass attunement",
  "data-charm",
  "keyl",
  "loadout-strip",
  "installinterfacepauseguard",
  ".journal-shell.open, .loadout-overlay.open",
  ".journal-shell.open, .pause-panel:not(.hidden), .dialogue-panel:not(.hidden)",
  "new performancedirector",
  "mesh.mergemeshes",
  "batched-tree-trunks",
  "batched-red-grass",
  "batched-city-",
  "usepoissonsampling",
  "refreshrate_render_oneverytwoframes",
  "sethardwarescalinglevel",
  "updatedistanceculling",
  "skippointermovepicking",
  "bloomscale",
  "freezeworldmatrix",
  "applyemergencygpubudget",
  "shadowmap.resize(1024)",
  "antialias: false",
  "new babylon.engine(canvas, false",
  "dust.emitrate",
  "__ascension_playtest__",
  "geometryaudit",
  "unlockverticalslice",
  "simulate: (seconds",
  "this.game.update(1 / 60)",
  "verticalsliceversion: 2",
  "sculptedheightat",
  "vertical-slice-caelus-boulevard",
  "vertical-slice-city-bodies-a",
  "vertical-slice-market-canopies",
  "vertical-slice-road-surface",
  "vertical-slice-route-bushes-a",
  "vertical-slice-foundry-cliff-wall",
  "vertical-slice-foundry-tunnel-floor",
  "vertical-slice-core-to-pillar-catwalk",
  "vertical-slice-pillar-shell",
  "__routedensityguardinstalled",
  "new verticalsliceactorrebase",
  "dynamicactorsrebased",
  "new verticalslicetraversalguard",
  "protectedroutecollisionvolumesremoved",
  "new caelusphasezerodirector",
  "caelusphasezeroversion: 1",
  "caelus-third-person-sword-mount",
  "legacycaeluscollisionvolumesremoved",
  "transparentarchitecturematerials",
  "new combatpresentationdirector",
  "combat-stance-indicator",
  "combat-impact-burst",
  "regionat(position.x, position.y, position.z)",
  "new routeaudiodirector",
  "foundrygain"
]) {
  if (!productionSource.includes(requiredFeature)) {
    throw new Error(`Missing required production feature: ${requiredFeature}`);
  }
}

const questSource = await readFile("src/game/QuestSystem.ts", "utf8");
if (questSource.includes('this.save.equipment.equippedCharm = this.save.labyrinth.guardianDefeated')) {
  throw new Error("Charm selection must not be overwritten automatically by guardian progression.");
}

const performanceSource = await readFile("src/core/PerformanceDirector.ts", "utf8");
for (const forbiddenRegression of [
  "useBlurExponentialShadowMap = true",
  "pipeline.samples = 2",
  "shadowMap.refreshRate = 1"
]) {
  if (performanceSource.includes(forbiddenRegression)) {
    throw new Error(`Performance recovery regressed to an expensive setting: ${forbiddenRegression}`);
  }
}

const mainSource = await readFile("src/main.ts", "utf8");
if (mainSource.includes("new BABYLON.Engine(canvas, true")) {
  throw new Error("Engine-level antialiasing must remain disabled while FXAA is active.");
}
const recoveryIndex = mainSource.indexOf("new VisualRecoveryDirector(game)");
const guardIndex = mainSource.indexOf("installVerticalSliceRuntimeGuard(VerticalSliceDirector)");
const sliceIndex = mainSource.indexOf("new VerticalSliceDirector(game)");
const phaseZeroIndex = mainSource.indexOf("new CaelusPhaseZeroDirector(game)");
const actorRebaseIndex = mainSource.indexOf("new VerticalSliceActorRebase(game)");
const floorTwoIndex = mainSource.indexOf("new FloorTwoArrivalDirector(game)");
const contractIndex = mainSource.indexOf("new FrontierContractDirector(game)");
const traversalIndex = mainSource.indexOf("new VerticalSliceTraversalGuard(game)");
const performanceIndex = mainSource.indexOf("new PerformanceDirector(engine, game.world, renderer)");
const feelIndex = mainSource.indexOf("new CombatFeelDirector(game, engine)");
const presentationIndex = mainSource.indexOf("new CombatPresentationDirector(game)");
const routeAudioIndex = mainSource.indexOf("new RouteAudioDirector(game)");
const bridgeIndex = mainSource.indexOf("new PlaytestBridge(game, renderer)");
if (
  guardIndex < 0
  || recoveryIndex < 0
  || sliceIndex <= recoveryIndex
  || phaseZeroIndex <= sliceIndex
  || actorRebaseIndex <= phaseZeroIndex
  || floorTwoIndex <= actorRebaseIndex
  || contractIndex <= floorTwoIndex
  || traversalIndex <= contractIndex
  || performanceIndex <= traversalIndex
  || feelIndex <= performanceIndex
  || presentationIndex <= feelIndex
  || routeAudioIndex <= presentationIndex
  || bridgeIndex <= routeAudioIndex
) {
  throw new Error("Vertical slice, Caelus recovery, traversal, combat, audio, and playtest initialization order is invalid.");
}

const workflow = await readFile(".github/workflows/quality.yml", "utf8");
for (const requiredWorkflowRule of [
  "@playwright/test@1.55.0",
  "playwright install --with-deps chromium",
  "npm run test:browser",
  "project-ascension-browser-playtest"
]) {
  if (!workflow.includes(requiredWorkflowRule)) {
    throw new Error(`Permanent browser gate is missing workflow rule: ${requiredWorkflowRule}`);
  }
}

const browserTest = await readFile("tests/browser/vertical-slice.spec.mts", "utf8");
for (const requiredBrowserRule of [
  'bridgeCall(page, "keyDown", "KeyW")',
  'simulate(page, 1.85, ["KeyW"])',
  'simulate(page, 0.08, ["Space"])',
  'simulate(page, 0.08, ["KeyQ"])',
  'simulate(page, 0.05, ["KeyV"])',
  'expect(heldInput.activeKeys).toContain("KeyW")',
  'bridgeCall<GeometryAudit>(page, "geometryAudit")',
  '"weapon-idle-right-profile"',
  'audit.legacyCaelusMeshesEnabled',
  'audit.transparentArchitectureMaterials',
  '"foundry-core"',
  '"pillar-lift"',
  "await capture(page, testInfo, view)",
  "expect(runtimeErrors).toEqual([])",
  "expect(consoleErrors).toEqual([])"
]) {
  if (!browserTest.includes(requiredBrowserRule)) {
    throw new Error(`Permanent browser gate is missing assertion: ${requiredBrowserRule}`);
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

console.log("Project Ascension Caelus phase zero and permanent browser gate checks passed.");
