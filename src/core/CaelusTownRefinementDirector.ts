import { CaelusTownHouseRefiner } from "./CaelusTownHouseRefinement.js";
import { CaelusTownLandmarkBuilder } from "./CaelusTownLandmarkRefinement.js";
import { CaelusTownRoadRefiner } from "./CaelusTownRoadRefinement.js";
import {
  LEGACY_BOARD_POSITION,
  QUEST_BOARD_POSITION,
  ROAD_COLOR,
  distance2d,
  makeMaterial,
  round,
  type TownRefinementAudit
} from "./CaelusTownRefinementShared.js";

export class CaelusTownRefinementDirector {
  private readonly scene: any;
  private readonly world: any;
  private readonly generated: any[] = [];
  private readonly roadMaterial: any;
  private readonly roadRefiner: CaelusTownRoadRefiner;
  private audit: TownRefinementAudit;

  constructor(private readonly game: any) {
    this.scene = game.world.scene;
    this.world = game.world;
    this.roadMaterial = makeMaterial(this.scene, "caelus-refined-road-material", ROAD_COLOR);
    this.roadRefiner = new CaelusTownRoadRefiner(game, this.roadMaterial);

    const roadResult = this.roadRefiner.apply();
    const houseRefiner = new CaelusTownHouseRefiner(game, this.generated);
    const converted = houseRefiner.convertHouseWindows();
    const landmarkBuilder = new CaelusTownLandmarkBuilder(
      game,
      this.generated,
      this.roadMaterial,
      houseRefiner
    );
    const specialBuildingIds = landmarkBuilder.buildAll();
    const questBoardRelocated = this.replaceAndRelocateQuestBoard();
    this.installQuestBoardInteractionProxy();
    this.batchBuildingShells();

    const activeGhostGateMeshCount = this.roadRefiner.findGhostGateMeshes().length;
    const roadMaterials = new Set(
      this.activeTownRoadMeshes().map((mesh) => String(mesh.material?.name ?? "missing"))
    );
    const activeGlowBlockWindowCount = (this.scene.meshes as any[]).filter((mesh) => (
      mesh.isEnabled?.()
      && String(mesh.name ?? "").startsWith("caelus-reference-house-")
      && String(mesh.name ?? "").includes("-window-")
    )).length;

    this.audit = {
      version: 1,
      milestone: "Set 1 / Milestone 1.4.3 — Town Grounding and Civic Identity",
      terrainUpdated: roadResult.terrainUpdated,
      groundedRoadMeshCount: roadResult.groundedRoadMeshCount,
      roadMaterialCount: roadMaterials.size,
      disabledGateApronCount: roadResult.disabledGateApronCount,
      minimumRoadLift: round(roadResult.minimumRoadLift),
      maximumRoadLift: round(roadResult.maximumRoadLift),
      removedGhostGateMeshCount: roadResult.removedGhostGateMeshCount,
      activeGhostGateMeshCount,
      questBoardPosition: { ...QUEST_BOARD_POSITION },
      questBoardRelocated,
      specialBuildingCount: specialBuildingIds.length,
      specialBuildingIds,
      convertedHouseCount: converted.convertedHouseCount,
      transparentWindowPaneCount: converted.transparentWindowPaneCount,
      activeGlowBlockWindowCount,
      pass: roadResult.terrainUpdated
        && roadResult.groundedRoadMeshCount >= 49
        && roadMaterials.size === 1
        && roadResult.disabledGateApronCount === 2
        && roadResult.minimumRoadLift >= 0.012
        && roadResult.maximumRoadLift <= 0.035
        && activeGhostGateMeshCount === 0
        && questBoardRelocated
        && specialBuildingIds.length === 3
        && converted.convertedHouseCount === 20
        && converted.transparentWindowPaneCount === 40
        && activeGlowBlockWindowCount === 0
    };

    this.scene.metadata = {
      ...(this.scene.metadata ?? {}),
      caelusTownRefinementVersion: 1,
      caelusTownRefinementAudit: { ...this.audit }
    };
    const bridge = (globalThis as any).__ASCENSION_PLAYTEST__;
    if (bridge) {
      bridge.townRefinementAudit = () => JSON.parse(JSON.stringify(this.audit));
      bridge.townRefinementMeshes = () => this.generated
        .filter((mesh) => mesh.isEnabled?.())
        .map((mesh) => String(mesh.name));
    }

    console.info(
      `[Caelus Refinement] roads=${this.audit.groundedRoadMeshCount}, windows=${this.audit.transparentWindowPaneCount}, `
      + `special=${this.audit.specialBuildingCount}, pass=${this.audit.pass}.`
    );
  }

  private activeTownRoadMeshes(): any[] {
    return (this.scene.meshes as any[]).filter((mesh) => (
      mesh.isEnabled?.()
      && (
        String(mesh.name ?? "").startsWith("caelus-connected-v2-")
        || String(mesh.name ?? "").startsWith("caelus-refined-special-frontage-")
      )
    ));
  }

  private replaceAndRelocateQuestBoard(): boolean {
    for (const mesh of this.scene.meshes as any[]) {
      if (!String(mesh.name ?? "").startsWith("batched-contract-board-")) continue;
      mesh.setEnabled?.(false);
      mesh.isVisible = false;
      mesh.isPickable = false;
      mesh.metadata = { ...(mesh.metadata ?? {}), supersededByRoadsideContractBoard: true };
    }

    const root = new BABYLON.TransformNode("caelus-refined-contract-board-root", this.scene);
    root.position.set(
      QUEST_BOARD_POSITION.x,
      this.world.heightAt(QUEST_BOARD_POSITION.x, QUEST_BOARD_POSITION.z),
      QUEST_BOARD_POSITION.z
    );
    root.rotation.y = Math.PI / 2;
    const timber = makeMaterial(this.scene, "caelus-refined-contract-board-timber", "#4d392c");
    const metal = makeMaterial(this.scene, "caelus-refined-contract-board-metal", "#59676a", { metallic: 0.75 });
    const parchment = makeMaterial(this.scene, "caelus-refined-contract-board-parchment", "#b8aa7f");
    const glow = makeMaterial(this.scene, "caelus-refined-contract-board-rune", "#79d8c8", { emissive: "#267d74" });

    for (const side of [-1, 1]) {
      const post = BABYLON.MeshBuilder.CreateCylinder(`caelus-refined-contract-board-post-${side}`, {
        height: 5.4,
        diameterTop: 0.34,
        diameterBottom: 0.55,
        tessellation: 8
      }, this.scene);
      post.position.set(side * 2.65, 2.7, 0);
      post.material = timber;
      post.parent = root;
      this.generated.push(post);
      const cap = BABYLON.MeshBuilder.CreateCylinder(`caelus-refined-contract-board-post-cap-${side}`, {
        height: 0.42,
        diameterTop: 0.25,
        diameterBottom: 0.72,
        tessellation: 8
      }, this.scene);
      cap.position.set(side * 2.65, 5.45, 0);
      cap.material = metal;
      cap.parent = root;
      this.generated.push(cap);
    }

    const board = BABYLON.MeshBuilder.CreateBox("caelus-refined-contract-board-face", {
      width: 6.2,
      height: 3.7,
      depth: 0.5
    }, this.scene);
    board.position.set(0, 3.35, 0);
    board.material = timber;
    board.parent = root;
    board.receiveShadows = true;
    board.metadata = { questBoard: true, interaction: "frontier-contracts" };
    this.generated.push(board);

    const top = BABYLON.MeshBuilder.CreateBox("caelus-refined-contract-board-top", {
      width: 7.1,
      height: 0.45,
      depth: 1.25
    }, this.scene);
    top.position.set(0, 5.45, 0);
    top.rotation.z = -0.04;
    top.material = metal;
    top.parent = root;
    this.generated.push(top);

    for (let index = 0; index < 6; index += 1) {
      const notice = BABYLON.MeshBuilder.CreateBox(`caelus-refined-contract-board-notice-${index}`, {
        width: index % 2 === 0 ? 1.5 : 1.25,
        height: 1.05,
        depth: 0.06
      }, this.scene);
      notice.position.set(-1.85 + (index % 3) * 1.85, 2.7 + Math.floor(index / 3) * 1.2, -0.29);
      notice.rotation.z = ((index % 3) - 1) * 0.045;
      notice.material = parchment;
      notice.parent = root;
      this.generated.push(notice);
    }

    const crest = BABYLON.MeshBuilder.CreateTorus("caelus-refined-contract-board-crest", {
      diameter: 1.25,
      thickness: 0.14,
      tessellation: 24
    }, this.scene);
    crest.position.set(0, 5.75, -0.28);
    crest.rotation.x = Math.PI / 2;
    crest.material = glow;
    crest.parent = root;
    this.generated.push(crest);

    root.getChildMeshes?.().forEach((mesh: any) => {
      mesh.computeWorldMatrix?.(true);
      mesh.freezeWorldMatrix?.();
    });
    this.addCollision(QUEST_BOARD_POSITION.x, QUEST_BOARD_POSITION.z, 1.6, 6.5);
    [timber, metal, parchment, glow].forEach((material) => material.freeze?.());
    return true;
  }

  private installQuestBoardInteractionProxy(): void {
    const previousInteraction = this.game.updateInteraction.bind(this.game);
    const realPosition = this.game.player.position.bind(this.game.player);
    this.game.updateInteraction = (input: any): void => {
      const position = realPosition();
      const current = { x: Number(position.x), z: Number(position.z) };
      if (distance2d(current, QUEST_BOARD_POSITION) <= 4.4) {
        const stored = this.game.player.position;
        this.game.player.position = () => new BABYLON.Vector3(
          LEGACY_BOARD_POSITION.x,
          this.world.heightAt(LEGACY_BOARD_POSITION.x, LEGACY_BOARD_POSITION.z),
          LEGACY_BOARD_POSITION.z
        );
        try {
          previousInteraction(input);
        } finally {
          this.game.player.position = stored;
        }
        return;
      }
      if (distance2d(current, LEGACY_BOARD_POSITION) <= 4.5) {
        const stored = this.game.player.position;
        this.game.player.position = () => new BABYLON.Vector3(9999, 0, 9999);
        try {
          previousInteraction(input);
        } finally {
          this.game.player.position = stored;
        }
        return;
      }
      previousInteraction(input);
    };
  }

  private batchBuildingShells(): void {
    const groups = new Map<string, any[]>();
    for (const mesh of this.generated) {
      if (mesh.parent || !mesh.material || mesh.isDisposed?.()) continue;
      if (mesh.metadata?.futureInteriorShell !== true || mesh.metadata?.transparentWindowPane === true) continue;
      const buildingId = String(mesh.metadata?.buildingId ?? "building");
      const key = `${buildingId}|${String(mesh.material.uniqueId ?? mesh.material.name ?? "material")}`;
      const group = groups.get(key) ?? [];
      group.push(mesh);
      groups.set(key, group);
    }

    let batchIndex = 0;
    for (const [key, meshes] of groups) {
      if (meshes.length < 2) continue;
      meshes.forEach((mesh) => {
        mesh.unfreezeWorldMatrix?.();
        mesh.computeWorldMatrix?.(true);
      });
      const merged = BABYLON.Mesh.MergeMeshes(meshes, true, true, undefined, false, false);
      if (!merged) continue;
      batchIndex += 1;
      const buildingId = key.split("|")[0];
      merged.name = `caelus-refined-shell-batch-${buildingId}-${batchIndex}`;
      merged.metadata = { futureInteriorShell: true, buildingId, townRefinementBatch: true };
      merged.isPickable = false;
      merged.receiveShadows = true;
      merged.computeWorldMatrix?.(true);
      merged.freezeWorldMatrix?.();
      this.generated.push(merged);
    }
  }

  private addCollision(x: number, z: number, width: number, depth: number): void {
    const inset = 0.35;
    const boxes = (this.world as any).collisionBoxes as Array<{ minX: number; maxX: number; minZ: number; maxZ: number }>;
    boxes?.push({
      minX: x - width * 0.5 + inset,
      maxX: x + width * 0.5 - inset,
      minZ: z - depth * 0.5 + inset,
      maxZ: z + depth * 0.5 - inset
    });
  }
}
