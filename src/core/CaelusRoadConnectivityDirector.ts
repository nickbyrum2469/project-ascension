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

interface RoadConnectivityAudit {
  version: number;
  milestone: string;
  mainRoadWidth: number;
  collectorRoadCount: number;
  frontageConnectorCount: number;
  disconnectedCollectorCount: number;
  disconnectedFrontageCount: number;
  wellCanopyRemoved: boolean;
  pass: boolean;
}

const MAIN_ROAD_HALF_WIDTH = 9;
const COLLECTOR_HALF_WIDTH = 2.5;
const FRONTAGE_CONNECTOR_SIZE = 4.8;
const COLLECTOR_LEVELS = [182, 124, 70];

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

const makeMaterial = (scene: any, name: string, color: string): any => {
  const material = new BABYLON.StandardMaterial(name, scene);
  material.diffuseColor = BABYLON.Color3.FromHexString(color);
  material.ambientColor = BABYLON.Color3.FromHexString(color).scale(0.32);
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
  private readonly connectorRects: RectAudit[] = [];
  private readonly collectorRects: RectAudit[] = [];
  private audit: RoadConnectivityAudit;

  constructor(game: any) {
    this.scene = game.world.scene;
    this.world = game.world;

    const roadMaterial = makeMaterial(this.scene, "caelus-connected-main-road-material", "#8a7451");
    const collectorMaterial = makeMaterial(this.scene, "caelus-connected-collector-material", "#817152");
    const frontageMaterial = makeMaterial(this.scene, "caelus-connected-frontage-material", "#777057");

    this.hideSupersededRoadMeshes();
    this.buildMainRoad(roadMaterial);
    this.buildCollectors(collectorMaterial);
    this.restyleFrontages(frontageMaterial, collectorMaterial);
    const wellCanopyRemoved = this.removeWellCanopy();

    this.audit = this.createAudit(wellCanopyRemoved);
    this.installPlaytestApi();

    this.scene.metadata = {
      ...(this.scene.metadata ?? {}),
      caelusRoadConnectivityVersion: 1,
      caelusRoadConnectivityAudit: { ...this.audit }
    };

    console.info(
      `[Caelus Roads] width=${this.audit.mainRoadWidth}, collectors=${this.audit.collectorRoadCount}, `
      + `frontage gaps=${this.audit.disconnectedFrontageCount}, pass=${this.audit.pass}.`
    );
  }

  private hideSupersededRoadMeshes(): void {
    for (const mesh of this.scene.meshes as any[]) {
      const name = String(mesh.name ?? "");
      const oldMainRoad = name === "caelus-reference-main-street-road-surface";
      const oldCollector = name.startsWith("caelus-reference-frontage-collector-");
      if (!oldMainRoad && !oldCollector) continue;
      mesh.setEnabled?.(false);
      mesh.isVisible = false;
      mesh.isPickable = false;
      mesh.metadata = { ...(mesh.metadata ?? {}), supersededByConnectedRoads: true };
    }
  }

  private buildMainRoad(material: any): void {
    const points: Point2[] = [
      { x: 0, z: 8 },
      { x: 0, z: 70 },
      { x: 0, z: 124 },
      { x: 0, z: 182 },
      { x: 0, z: 234 }
    ];
    this.createRibbon("caelus-connected-main-road", points, MAIN_ROAD_HALF_WIDTH * 2, material, 0.135);
  }

  private buildCollectors(material: any): void {
    for (const z of COLLECTOR_LEVELS) {
      const mesh = this.createStrip(
        `caelus-connected-collector-${z}`,
        { x: -101, z },
        { x: 101, z },
        COLLECTOR_HALF_WIDTH * 2,
        material,
        0.145
      );
      mesh.metadata = { ...(mesh.metadata ?? {}), roadRole: "collector", collectorZ: z };
      this.collectorRects.push(rect(`collector-${z}`, 0, z, 202, COLLECTOR_HALF_WIDTH * 2));

      const junction = BABYLON.MeshBuilder.CreateBox(`caelus-connected-main-junction-${z}`, {
        width: MAIN_ROAD_HALF_WIDTH * 2 + 1.2,
        height: 0.08,
        depth: COLLECTOR_HALF_WIDTH * 2 + 1.2
      }, this.scene);
      junction.position = new BABYLON.Vector3(0, this.world.heightAt(0, z) + 0.15, z);
      junction.material = material;
      junction.receiveShadows = true;
      junction.isPickable = false;
      junction.metadata = { referenceTown: true, roadRole: "junction", collectorZ: z };
      this.generated.push(junction);
    }
  }

  private restyleFrontages(frontageMaterial: any, connectorMaterial: any): void {
    const frontageMeshes = (this.scene.meshes as any[]).filter((mesh) => {
      const name = String(mesh.name ?? "");
      return name.startsWith("caelus-reference-frontage-")
        && !name.startsWith("caelus-reference-frontage-collector-")
        && mesh.isEnabled?.();
    });

    for (const mesh of frontageMeshes) {
      mesh.material = frontageMaterial;
      mesh.receiveShadows = true;
      mesh.computeWorldMatrix?.(true);
      const box = mesh.getBoundingInfo?.().boundingBox;
      const minimum = box?.minimumWorld;
      const maximum = box?.maximumWorld;
      if (!minimum || !maximum) continue;

      const centerX = (Number(minimum.x) + Number(maximum.x)) * 0.5;
      const centerZ = (Number(minimum.z) + Number(maximum.z)) * 0.5;
      const collectorZ = COLLECTOR_LEVELS.reduce((best, level) => (
        Math.abs(level - centerZ) < Math.abs(best - centerZ) ? level : best
      ), COLLECTOR_LEVELS[0]);

      const connector = BABYLON.MeshBuilder.CreateBox(`caelus-connected-frontage-junction-${mesh.name}`, {
        width: FRONTAGE_CONNECTOR_SIZE,
        height: 0.08,
        depth: FRONTAGE_CONNECTOR_SIZE
      }, this.scene);
      connector.position = new BABYLON.Vector3(centerX, this.world.heightAt(centerX, collectorZ) + 0.155, collectorZ);
      connector.material = connectorMaterial;
      connector.receiveShadows = true;
      connector.isPickable = false;
      connector.metadata = {
        referenceTown: true,
        roadRole: "frontage-junction",
        frontageName: String(mesh.name),
        collectorZ
      };
      this.generated.push(connector);
      this.connectorRects.push(rect(String(mesh.name), centerX, collectorZ, FRONTAGE_CONNECTOR_SIZE, FRONTAGE_CONNECTOR_SIZE));
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

  private createRibbon(name: string, points: Point2[], width: number, material: any, yOffset: number): any {
    const positions: number[] = [];
    for (let index = 0; index < points.length; index += 1) {
      const previous = points[Math.max(0, index - 1)];
      const next = points[Math.min(points.length - 1, index + 1)];
      const dx = next.x - previous.x;
      const dz = next.z - previous.z;
      const length = Math.max(0.001, Math.hypot(dx, dz));
      const nx = -dz / length * width / 2;
      const nz = dx / length * width / 2;
      const point = points[index];
      for (const side of [1, -1]) {
        const x = point.x + nx * side;
        const z = point.z + nz * side;
        positions.push(x, this.world.heightAt(x, z) + yOffset, z);
      }
    }

    const indices: number[] = [];
    for (let index = 0; index < points.length - 1; index += 1) {
      const base = index * 2;
      indices.push(base, base + 1, base + 3, base, base + 3, base + 2);
    }
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
    mesh.metadata = { referenceTown: true, roadRole: "main" };
    this.generated.push(mesh);
    return mesh;
  }

  private createStrip(name: string, start: Point2, end: Point2, width: number, material: any, yOffset: number): any {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.max(0.001, Math.hypot(dx, dz));
    const nx = -dz / length * width / 2;
    const nz = dx / length * width / 2;
    const corners = [
      { x: start.x + nx, z: start.z + nz },
      { x: start.x - nx, z: start.z - nz },
      { x: end.x - nx, z: end.z - nz },
      { x: end.x + nx, z: end.z + nz }
    ];
    const positions: number[] = [];
    for (const point of corners) positions.push(point.x, this.world.heightAt(point.x, point.z) + yOffset, point.z);
    const indices = [0, 1, 2, 0, 2, 3];
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
    mesh.metadata = { referenceTown: true, roadRole: "collector" };
    this.generated.push(mesh);
    return mesh;
  }

  private createAudit(wellCanopyRemoved: boolean): RoadConnectivityAudit {
    const mainRoad = rect("main-road", 0, 121, MAIN_ROAD_HALF_WIDTH * 2, 226);
    const disconnectedCollectorCount = this.collectorRects.filter((collector) => !intersects(collector, mainRoad)).length;

    const frontageMeshes = (this.scene.meshes as any[]).filter((mesh) => {
      const name = String(mesh.name ?? "");
      return name.startsWith("caelus-reference-frontage-")
        && !name.startsWith("caelus-reference-frontage-collector-")
        && mesh.isEnabled?.();
    });

    let disconnectedFrontageCount = 0;
    for (let index = 0; index < frontageMeshes.length; index += 1) {
      const mesh = frontageMeshes[index];
      mesh.computeWorldMatrix?.(true);
      const box = mesh.getBoundingInfo?.().boundingBox;
      const minimum = box?.minimumWorld;
      const maximum = box?.maximumWorld;
      const connector = this.connectorRects[index];
      if (!minimum || !maximum || !connector) {
        disconnectedFrontageCount += 1;
        continue;
      }
      const frontage = {
        id: String(mesh.name),
        minX: Number(minimum.x),
        maxX: Number(maximum.x),
        minZ: Number(minimum.z),
        maxZ: Number(maximum.z)
      };
      const connectedToFrontage = intersects(frontage, connector);
      const connectedToCollector = this.collectorRects.some((collector) => intersects(collector, connector));
      if (!connectedToFrontage || !connectedToCollector) disconnectedFrontageCount += 1;
    }

    const pass = disconnectedCollectorCount === 0
      && disconnectedFrontageCount === 0
      && wellCanopyRemoved
      && frontageMeshes.length === 21;

    return {
      version: 1,
      milestone: "Set 1 / Milestone 1.4.1 — Road Connectivity Cleanup",
      mainRoadWidth: MAIN_ROAD_HALF_WIDTH * 2,
      collectorRoadCount: COLLECTOR_LEVELS.length,
      frontageConnectorCount: this.connectorRects.length,
      disconnectedCollectorCount,
      disconnectedFrontageCount,
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
