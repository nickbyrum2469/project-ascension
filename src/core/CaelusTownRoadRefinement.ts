import {
  ROAD_COLOR,
  ROAD_SURFACE_OFFSET,
  SPECIAL_BUILDINGS,
  clamp01,
  distance2d,
  smooth,
  type GroundPad,
  type RoadBand
} from "./CaelusTownRefinementShared.js";

export interface RoadRefinementResult {
  terrainUpdated: boolean;
  groundedRoadMeshCount: number;
  disabledGateApronCount: number;
  minimumRoadLift: number;
  maximumRoadLift: number;
  removedGhostGateMeshCount: number;
}

export class CaelusTownRoadRefiner {
  private readonly scene: any;
  private readonly world: any;
  private readonly roadBands: RoadBand[] = [];
  private readonly groundPads: GroundPad[] = SPECIAL_BUILDINGS.map((building) => ({
    id: building.id,
    x: building.x,
    z: building.z,
    width: building.width + 3,
    depth: building.depth + 3
  }));

  constructor(private readonly game: any, public readonly roadMaterial: any) {
    this.scene = game.world.scene;
    this.world = game.world;
  }

  public apply(): RoadRefinementResult {
    this.captureRoadBands();
    this.addSpecialFrontageBands();
    const terrainUpdated = this.installGroundedTownProfile();
    const roads = this.groundAndUnifyRoads();
    const removedGhostGateMeshCount = this.removeGhostGateGeometry();
    return { terrainUpdated, removedGhostGateMeshCount, ...roads };
  }

  public findGhostGateMeshes(): any[] {
    return (this.scene.meshes as any[]).filter((mesh) => {
      if (!mesh.isEnabled?.()) return false;
      const name = String(mesh.name ?? "").toLowerCase();
      if (name.startsWith("caelus-reference-")) return false;
      if (!/(gate|lintel|arch|portcullis|inner-shadow)/.test(name)) return false;
      mesh.computeWorldMatrix?.(true);
      const center = mesh.getBoundingInfo?.().boundingBox?.centerWorld ?? mesh.position;
      return Math.abs(Number(center?.x ?? 999)) <= 36
        && Number(center?.z ?? -999) >= 2
        && Number(center?.z ?? 999) <= 36;
    });
  }

  private captureRoadBands(): void {
    for (const mesh of this.scene.meshes as any[]) {
      const name = String(mesh.name ?? "");
      if (!mesh.isEnabled?.() || !name.startsWith("caelus-connected-v2-")) continue;
      if (name.includes("junction") || name.endsWith("gate-apron")) continue;
      mesh.computeWorldMatrix?.(true);
      const box = mesh.getBoundingInfo?.().boundingBox;
      const minimum = box?.minimumWorld;
      const maximum = box?.maximumWorld;
      if (!minimum || !maximum) continue;
      const width = Number(maximum.x) - Number(minimum.x);
      const depth = Number(maximum.z) - Number(minimum.z);
      if (width >= depth) {
        this.roadBands.push({
          id: name,
          start: { x: Number(minimum.x), z: (Number(minimum.z) + Number(maximum.z)) * 0.5 },
          end: { x: Number(maximum.x), z: (Number(minimum.z) + Number(maximum.z)) * 0.5 },
          halfWidth: Math.max(1.8, depth * 0.5)
        });
      } else {
        this.roadBands.push({
          id: name,
          start: { x: (Number(minimum.x) + Number(maximum.x)) * 0.5, z: Number(minimum.z) },
          end: { x: (Number(minimum.x) + Number(maximum.x)) * 0.5, z: Number(maximum.z) },
          halfWidth: Math.max(1.8, width * 0.5)
        });
      }
    }
  }

  private addSpecialFrontageBands(): void {
    for (const building of SPECIAL_BUILDINGS) {
      const frontZ = building.z + (building.doorSide === "north" ? building.depth * 0.5 + 0.8 : -building.depth * 0.5 - 0.8);
      this.roadBands.push({
        id: `special-frontage-${building.id}`,
        start: { x: building.x, z: Math.min(frontZ, building.collectorZ) },
        end: { x: building.x, z: Math.max(frontZ, building.collectorZ) },
        halfWidth: building.role === "guild" ? 2.8 : 2.25
      });
    }
  }

  private installGroundedTownProfile(): boolean {
    const previousHeightAt = this.world.heightAt.bind(this.world);
    const bands = this.roadBands.map((band) => ({ ...band, start: { ...band.start }, end: { ...band.end } }));
    const pads = this.groundPads.map((pad) => ({ ...pad }));

    this.world.heightAt = (x: number, z: number): number => {
      const point = { x, z };
      let weightedHeight = previousHeightAt(x, z);
      let totalWeight = 1;
      for (const band of bands) {
        const dx = band.end.x - band.start.x;
        const dz = band.end.z - band.start.z;
        const lengthSquared = Math.max(0.0001, dx * dx + dz * dz);
        const amount = clamp01(((x - band.start.x) * dx + (z - band.start.z) * dz) / lengthSquared);
        const nearest = { x: band.start.x + dx * amount, z: band.start.z + dz * amount };
        const influence = 1 - smooth((distance2d(point, nearest) - band.halfWidth) / 3.2);
        if (influence <= 0) continue;
        const weight = influence * 4.8;
        weightedHeight += previousHeightAt(nearest.x, nearest.z) * weight;
        totalWeight += weight;
      }
      for (const pad of pads) {
        const edge = Math.max(Math.abs(x - pad.x) - pad.width * 0.5, Math.abs(z - pad.z) - pad.depth * 0.5);
        const influence = edge <= 0 ? 1 : 1 - smooth(edge / 4.5);
        if (influence <= 0) continue;
        const weight = influence * 8;
        weightedHeight += previousHeightAt(pad.x, pad.z) * weight;
        totalWeight += weight;
      }
      return weightedHeight / totalWeight;
    };

    const terrain = this.scene.getMeshByName?.("windscar-terrain");
    const positions = terrain?.getVerticesData?.(BABYLON.VertexBuffer.PositionKind) as number[] | null;
    const indices = terrain?.getIndices?.() as number[] | null;
    const normals = terrain?.getVerticesData?.(BABYLON.VertexBuffer.NormalKind) as number[] | null;
    if (!terrain || !positions || !indices || !normals) return false;
    terrain.unfreezeWorldMatrix?.();
    for (let index = 0; index < positions.length; index += 3) {
      const worldX = Number(positions[index]) + Number(terrain.position.x ?? 0);
      const worldZ = Number(positions[index + 2]) + Number(terrain.position.z ?? 0);
      positions[index + 1] = this.world.heightAt(worldX, worldZ) - Number(terrain.position.y ?? 0);
    }
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);
    terrain.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
    terrain.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
    terrain.refreshBoundingInfo();
    terrain.computeWorldMatrix?.(true);
    return true;
  }

  private groundAndUnifyRoads(): Omit<RoadRefinementResult, "terrainUpdated" | "removedGhostGateMeshCount"> {
    let groundedRoadMeshCount = 0;
    let disabledGateApronCount = 0;
    let minimumRoadLift = Number.POSITIVE_INFINITY;
    let maximumRoadLift = Number.NEGATIVE_INFINITY;

    for (const mesh of this.scene.meshes as any[]) {
      const name = String(mesh.name ?? "");
      if (!mesh.isEnabled?.() || !name.startsWith("caelus-connected-v2-")) continue;
      if (name.endsWith("gate-apron")) {
        mesh.setEnabled?.(false);
        mesh.isVisible = false;
        mesh.isPickable = false;
        mesh.metadata = { ...(mesh.metadata ?? {}), removedToPreventGateZFighting: true };
        disabledGateApronCount += 1;
        continue;
      }
      const role = String(mesh.metadata?.roadRole ?? "road");
      const offset = role === "main"
        ? ROAD_SURFACE_OFFSET
        : role === "collector"
          ? ROAD_SURFACE_OFFSET + 0.002
          : role === "frontage"
            ? ROAD_SURFACE_OFFSET + 0.004
            : role === "main-junction"
              ? ROAD_SURFACE_OFFSET + 0.006
              : ROAD_SURFACE_OFFSET + 0.008;
      const positions = mesh.getVerticesData?.(BABYLON.VertexBuffer.PositionKind) as number[] | null;
      const indices = mesh.getIndices?.() as number[] | null;
      if (!positions || !indices) continue;
      const normals = mesh.getVerticesData?.(BABYLON.VertexBuffer.NormalKind) as number[] | null ?? [];
      for (let index = 0; index < positions.length; index += 3) {
        const worldX = Number(positions[index]) + Number(mesh.position?.x ?? 0);
        const worldZ = Number(positions[index + 2]) + Number(mesh.position?.z ?? 0);
        positions[index + 1] = this.world.heightAt(worldX, worldZ) + offset - Number(mesh.position?.y ?? 0);
        const lift = positions[index + 1] + Number(mesh.position?.y ?? 0) - this.world.heightAt(worldX, worldZ);
        minimumRoadLift = Math.min(minimumRoadLift, lift);
        maximumRoadLift = Math.max(maximumRoadLift, lift);
      }
      BABYLON.VertexData.ComputeNormals(positions, indices, normals);
      mesh.updateVerticesData?.(BABYLON.VertexBuffer.PositionKind, positions);
      mesh.updateVerticesData?.(BABYLON.VertexBuffer.NormalKind, normals);
      mesh.refreshBoundingInfo?.();
      mesh.material = this.roadMaterial;
      mesh.receiveShadows = true;
      mesh.isPickable = false;
      mesh.metadata = { ...(mesh.metadata ?? {}), groundedTownRoad: true, unifiedRoadColor: ROAD_COLOR };
      groundedRoadMeshCount += 1;
    }
    this.roadMaterial.freeze?.();
    return { groundedRoadMeshCount, disabledGateApronCount, minimumRoadLift, maximumRoadLift };
  }

  private removeGhostGateGeometry(): number {
    const ghosts = this.findGhostGateMeshes();
    for (const mesh of ghosts) {
      mesh.setEnabled?.(false);
      mesh.isVisible = false;
      mesh.isPickable = false;
      mesh.metadata = { ...(mesh.metadata ?? {}), removedForCleanReferenceGate: true };
    }

    const boxes = (this.world as any).collisionBoxes as Array<{ minX: number; maxX: number; minZ: number; maxZ: number }>;
    if (Array.isArray(boxes)) {
      let write = 0;
      for (const box of boxes) {
        const centerX = (box.minX + box.maxX) * 0.5;
        const centerZ = (box.minZ + box.maxZ) * 0.5;
        const obsoleteGateCollision = Math.abs(centerX) < 36 && centerZ > 18 && centerZ < 36;
        if (obsoleteGateCollision) continue;
        boxes[write] = box;
        write += 1;
      }
      boxes.length = write;
    }
    return ghosts.length;
  }
}
