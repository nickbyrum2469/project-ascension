interface Point2 {
  x: number;
  z: number;
}

interface RectAudit {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface FrontageSpec {
  id: string;
  x: number;
  minZ: number;
  maxZ: number;
  collectorZ: number;
}

interface RoadConnectivityAudit {
  version: number;
  milestone: string;
  mainRoadWidth: number;
  collectorRoadCount: number;
  frontageRoadCount: number;
  junctionPatchCount: number;
  disconnectedCollectorCount: number;
  disconnectedFrontageCount: number;
  buriedSurfaceVertexCount: number;
  minimumSurfaceClearance: number;
  northGateCovered: boolean;
  southGateCovered: boolean;
  wellCanopyRemoved: boolean;
  pass: boolean;
}

const MAIN_ROAD_HALF_WIDTH = 9;
const COLLECTOR_HALF_WIDTH = 3;
const FRONTAGE_HALF_WIDTH = 2;
const FRONTAGE_OVERLAP = 3.2;
const SAMPLE_STEP = 2;
const MAIN_START_Z = 2;
const MAIN_END_Z = 242;
const COLLECTOR_MIN_X = -106;
const COLLECTOR_MAX_X = 106;
const COLLECTOR_LEVELS = [182, 124, 70];
const SOUTH_GATE_Z = 14;
const NORTH_GATE_Z = 228;

const rect = (id: string, x: number, z: number, width: number, depth: number): RectAudit => ({
  id,
  minX: x - width / 2,
  maxX: x + width / 2,
  minZ: z - depth / 2,
  maxZ: z + depth / 2
});

const intersects = (a: RectAudit, b: RectAudit): boolean => (
  a.minX < b.maxX
  && a.maxX > b.minX
  && a.minZ < b.maxZ
  && a.maxZ > b.minZ
);

const round = (value: number, precision = 3): number => Number(value.toFixed(precision));

const makeMaterial = (scene: any, name: string, color: string): any => {
  const material = new BABYLON.StandardMaterial(name, scene);
  material.diffuseColor = BABYLON.Color3.FromHexString(color);
  material.ambientColor = BABYLON.Color3.FromHexString(color).scale(0.36);
  material.specularColor = BABYLON.Color3.Black();
  material.alpha = 1;
  material.transparencyMode = 0;
  material.forceDepthWrite = true;
  material.backFaceCulling = false;
  return material;
};

export class CaelusRoadConnectivityDirector {
  private readonly scene: any;
  private readonly world: any;
  private readonly generated: any[] = [];
  private readonly collectorRects: RectAudit[] = [];
  private readonly frontageRects: RectAudit[] = [];
  private audit: RoadConnectivityAudit;

  constructor(game: any) {
    this.scene = game.world.scene;
    this.world = game.world;

    const frontageSpecs = this.captureFrontageSpecs();
    const roadMaterial = makeMaterial(this.scene, "caelus-connected-main-road-material-v2", "#9a8055");
    const collectorMaterial = makeMaterial(this.scene, "caelus-connected-collector-material-v2", "#8d7858");
    const frontageMaterial = makeMaterial(this.scene, "caelus-connected-frontage-material-v2", "#80725b");

    this.hideSupersededRoadMeshes();
    this.buildMainRoad(roadMaterial);
    this.buildCollectors(collectorMaterial);
    this.buildFrontages(frontageSpecs, frontageMaterial, collectorMaterial);
    this.buildGateAprons(roadMaterial);
    const wellCanopyRemoved = this.removeWellCanopy();

    this.audit = this.createAudit(frontageSpecs, wellCanopyRemoved);
    this.installPlaytestApi();

    this.scene.metadata = {
      ...(this.scene.metadata ?? {}),
      caelusRoadConnectivityVersion: 2,
      caelusRoadConnectivityAudit: { ...this.audit }
    };

    console.info(
      `[Caelus Roads v2] frontages=${this.audit.frontageRoadCount}, buried=${this.audit.buriedSurfaceVertexCount}, `
      + `gaps=${this.audit.disconnectedFrontageCount}, pass=${this.audit.pass}.`
    );
  }

  private captureFrontageSpecs(): FrontageSpec[] {
    const specs: FrontageSpec[] = [];
    const meshes = (this.scene.meshes as any[]).filter((mesh) => {
      const name = String(mesh.name ?? "");
      return name.startsWith("caelus-reference-frontage-")
        && !name.startsWith("caelus-reference-frontage-collector-")
        && mesh.isEnabled?.();
    });

    for (const mesh of meshes) {
      mesh.computeWorldMatrix?.(true);
      const box = mesh.getBoundingInfo?.().boundingBox;
      const minimum = box?.minimumWorld;
      const maximum = box?.maximumWorld;
      if (!minimum || !maximum) continue;
      const centerZ = (Number(minimum.z) + Number(maximum.z)) * 0.5;
      const collectorZ = COLLECTOR_LEVELS.reduce((best, level) => (
        Math.abs(level - centerZ) < Math.abs(best - centerZ) ? level : best
      ), COLLECTOR_LEVELS[0]);
      specs.push({
        id: String(mesh.name).replace("caelus-reference-frontage-", ""),
        x: (Number(minimum.x) + Number(maximum.x)) * 0.5,
        minZ: Number(minimum.z),
        maxZ: Number(maximum.z),
        collectorZ
      });
    }
    return specs;
  }

  private hideSupersededRoadMeshes(): void {
    for (const mesh of this.scene.meshes as any[]) {
      const name = String(mesh.name ?? "");
      const oldReferenceRoad = name === "caelus-reference-main-street-road-surface"
        || name.startsWith("caelus-reference-frontage-");
      const oldConnectedRoad = name.startsWith("caelus-connected-");
      if (!oldReferenceRoad && !oldConnectedRoad) continue;
      mesh.setEnabled?.(false);
      mesh.isVisible = false;
      mesh.isPickable = false;
      mesh.metadata = { ...(mesh.metadata ?? {}), supersededByTerrainRoadNetwork: true };
    }
  }

  private buildMainRoad(material: any): void {
    this.createTerrainRibbon(
      "caelus-connected-v2-main-road",
      { x: 0, z: MAIN_START_Z },
      { x: 0, z: MAIN_END_Z },
      MAIN_ROAD_HALF_WIDTH * 2,
      material,
      0.15,
      "main"
    );
  }

  private buildCollectors(material: any): void {
    for (const z of COLLECTOR_LEVELS) {
      this.createTerrainRibbon(
        `caelus-connected-v2-collector-${z}`,
        { x: COLLECTOR_MIN_X, z },
        { x: COLLECTOR_MAX_X, z },
        COLLECTOR_HALF_WIDTH * 2,
        material,
        0.16,
        "collector"
      );
      this.collectorRects.push(rect(
        `collector-${z}`,
        (COLLECTOR_MIN_X + COLLECTOR_MAX_X) * 0.5,
        z,
        COLLECTOR_MAX_X - COLLECTOR_MIN_X,
        COLLECTOR_HALF_WIDTH * 2
      ));
      this.createTerrainPatch(
        `caelus-connected-v2-main-junction-${z}`,
        0,
        z,
        MAIN_ROAD_HALF_WIDTH * 2 + 2.4,
        COLLECTOR_HALF_WIDTH * 2 + 2.4,
        material,
        0.18,
        "main-junction"
      );
    }
  }

  private buildFrontages(specs: FrontageSpec[], material: any, junctionMaterial: any): void {
    for (const spec of specs) {
      const minZ = Math.min(spec.minZ, spec.collectorZ) - FRONTAGE_OVERLAP;
      const maxZ = Math.max(spec.maxZ, spec.collectorZ) + FRONTAGE_OVERLAP;
      this.createTerrainRibbon(
        `caelus-connected-v2-frontage-${spec.id}`,
        { x: spec.x, z: minZ },
        { x: spec.x, z: maxZ },
        FRONTAGE_HALF_WIDTH * 2,
        material,
        0.17,
        "frontage"
      );
      this.frontageRects.push(rect(
        `frontage-${spec.id}`,
        spec.x,
        (minZ + maxZ) * 0.5,
        FRONTAGE_HALF_WIDTH * 2,
        maxZ - minZ
      ));
      this.createTerrainPatch(
        `caelus-connected-v2-frontage-junction-${spec.id}`,
        spec.x,
        spec.collectorZ,
        FRONTAGE_HALF_WIDTH * 2 + 2.2,
        COLLECTOR_HALF_WIDTH * 2 + 2.2,
        junctionMaterial,
        0.19,
        "frontage-junction"
      );
    }
  }

  private buildGateAprons(material: any): void {
    for (const [id, z] of [["south", SOUTH_GATE_Z], ["north", NORTH_GATE_Z]] as const) {
      this.createTerrainPatch(
        `caelus-connected-v2-${id}-gate-apron`,
        0,
        z,
        MAIN_ROAD_HALF_WIDTH * 2 + 2.6,
        22,
        material,
        0.19,
        "gate-apron"
      );
    }
  }

  private removeWellCanopy(): boolean {
    const canopy = this.scene.getMeshByName?.("caelus-reference-well-canopy");
    if (!canopy) return true;
    canopy.setEnabled?.(false);
    canopy.isVisible = false;
    canopy.isPickable = false;
    canopy.metadata = { ...(canopy.metadata ?? {}), removedForOpenWellFrame: true };
    return !canopy.isEnabled?.();
  }

  private createTerrainRibbon(
    name: string,
    start: Point2,
    end: Point2,
    width: number,
    material: any,
    yOffset: number,
    roadRole: string
  ): any {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.max(0.001, Math.hypot(dx, dz));
    const segments = Math.max(1, Math.ceil(length / SAMPLE_STEP));
    const nx = -dz / length * width / 2;
    const nz = dx / length * width / 2;
    const positions: number[] = [];

    for (let index = 0; index <= segments; index += 1) {
      const amount = index / segments;
      const centerX = start.x + dx * amount;
      const centerZ = start.z + dz * amount;
      for (const side of [1, -1]) {
        const x = centerX + nx * side;
        const z = centerZ + nz * side;
        positions.push(x, this.world.heightAt(x, z) + yOffset, z);
      }
    }

    const indices: number[] = [];
    for (let index = 0; index < segments; index += 1) {
      const base = index * 2;
      indices.push(base, base + 1, base + 3, base, base + 3, base + 2);
    }
    return this.createMesh(name, positions, indices, material, roadRole);
  }

  private createTerrainPatch(
    name: string,
    centerX: number,
    centerZ: number,
    width: number,
    depth: number,
    material: any,
    yOffset: number,
    roadRole: string
  ): any {
    const columns = Math.max(1, Math.ceil(width / SAMPLE_STEP));
    const rows = Math.max(1, Math.ceil(depth / SAMPLE_STEP));
    const positions: number[] = [];

    for (let row = 0; row <= rows; row += 1) {
      const z = centerZ - depth / 2 + depth * row / rows;
      for (let column = 0; column <= columns; column += 1) {
        const x = centerX - width / 2 + width * column / columns;
        positions.push(x, this.world.heightAt(x, z) + yOffset, z);
      }
    }

    const indices: number[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const base = row * (columns + 1) + column;
        const next = base + columns + 1;
        indices.push(base, base + 1, next + 1, base, next + 1, next);
      }
    }
    return this.createMesh(name, positions, indices, material, roadRole);
  }

  private createMesh(name: string, positions: number[], indices: number[], material: any, roadRole: string): any {
    const normals: number[] = [];
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);
    const data = new BABYLON.VertexData();
    data.positions = positions;
    data.indices = indices;
    data.normals = normals;
    const mesh = new BABYLON.Mesh(name, this.scene);
    data.applyToMesh(mesh);
    mesh.material = material;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    mesh.metadata = { referenceTown: true, roadRole, terrainFollowing: true };
    this.generated.push(mesh);
    return mesh;
  }

  private createAudit(specs: FrontageSpec[], wellCanopyRemoved: boolean): RoadConnectivityAudit {
    const mainRoad = rect(
      "main-road",
      0,
      (MAIN_START_Z + MAIN_END_Z) * 0.5,
      MAIN_ROAD_HALF_WIDTH * 2,
      MAIN_END_Z - MAIN_START_Z
    );
    const disconnectedCollectorCount = this.collectorRects.filter((collector) => !intersects(collector, mainRoad)).length;
    const disconnectedFrontageCount = this.frontageRects.filter((frontage) => (
      !this.collectorRects.some((collector) => intersects(frontage, collector))
    )).length;

    let buriedSurfaceVertexCount = 0;
    let minimumSurfaceClearance = Number.POSITIVE_INFINITY;
    for (const mesh of this.generated) {
      const positions = mesh.getVerticesData?.(BABYLON.VertexBuffer.PositionKind) as number[] | null;
      if (!positions) continue;
      for (let index = 0; index < positions.length; index += 3) {
        const x = Number(positions[index]);
        const y = Number(positions[index + 1]);
        const z = Number(positions[index + 2]);
        const clearance = y - this.world.heightAt(x, z);
        minimumSurfaceClearance = Math.min(minimumSurfaceClearance, clearance);
        if (clearance < 0.12) buriedSurfaceVertexCount += 1;
      }
    }

    const northGateCovered = NORTH_GATE_Z >= mainRoad.minZ && NORTH_GATE_Z <= mainRoad.maxZ;
    const southGateCovered = SOUTH_GATE_Z >= mainRoad.minZ && SOUTH_GATE_Z <= mainRoad.maxZ;
    const junctionPatchCount = this.generated.filter((mesh) => String(mesh.metadata?.roadRole ?? "").includes("junction")).length;

    const pass = specs.length === 21
      && this.frontageRects.length === 21
      && this.collectorRects.length === 3
      && disconnectedCollectorCount === 0
      && disconnectedFrontageCount === 0
      && buriedSurfaceVertexCount === 0
      && minimumSurfaceClearance >= 0.12
      && northGateCovered
      && southGateCovered
      && wellCanopyRemoved;

    return {
      version: 2,
      milestone: "Set 1 / Milestone 1.4.2 — Road and Roof Alignment",
      mainRoadWidth: MAIN_ROAD_HALF_WIDTH * 2,
      collectorRoadCount: this.collectorRects.length,
      frontageRoadCount: this.frontageRects.length,
      junctionPatchCount,
      disconnectedCollectorCount,
      disconnectedFrontageCount,
      buriedSurfaceVertexCount,
      minimumSurfaceClearance: round(minimumSurfaceClearance),
      northGateCovered,
      southGateCovered,
      wellCanopyRemoved,
      pass
    };
  }

  private installPlaytestApi(): void {
    const bridge = (globalThis as any).__ASCENSION_PLAYTEST__;
    if (!bridge) return;
    bridge.roadConnectivityAudit = () => JSON.parse(JSON.stringify(this.audit));
    bridge.roadConnectivityMeshes = () => this.generated.filter((mesh) => mesh.isEnabled?.()).map((mesh) => String(mesh.name));
  }
}
