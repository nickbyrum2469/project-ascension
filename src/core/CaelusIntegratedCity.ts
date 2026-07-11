import { createMaterial } from "../world/ProceduralAssets.js";

interface TownPoint {
  x: number;
  z: number;
}

interface RoadDefinition {
  id: string;
  halfWidth: number;
  samplesPerSection: number;
  control: TownPoint[];
}

interface JunctionMask extends TownPoint {
  id: string;
  radius: number;
}

interface BuildingDefinition extends TownPoint {
  id: string;
  width: number;
  depth: number;
  height: number;
  roofHeight: number;
  function: "home" | "merchant" | "workshop" | "storehouse" | "outfitter" | "guild" | "inn";
  palette: "warm" | "sage" | "stone";
  target: TownPoint;
  windows: number;
  chimney?: boolean;
}

interface BuildingFootprint extends TownPoint {
  id: string;
  halfWidth: number;
  halfDepth: number;
  yaw: number;
  frontageConnected: boolean;
}

interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface CitizenRecord {
  root: any;
  route: TownPoint[];
  index: number;
  speed: number;
}

const ROAD_DEFINITIONS: RoadDefinition[] = [
  {
    id: "main-street",
    halfWidth: 5.7,
    samplesPerSection: 12,
    control: [
      { x: 0, z: 22 },
      { x: -1, z: 48 },
      { x: 4, z: 74 },
      { x: -2, z: 101 },
      { x: 2, z: 126 },
      { x: 4, z: 154 },
      { x: -1, z: 181 },
      { x: 0, z: 202 }
    ]
  },
  {
    id: "service-lane",
    halfWidth: 3.35,
    samplesPerSection: 10,
    control: [
      { x: 3, z: 73 },
      { x: 21, z: 76 },
      { x: 42, z: 83 },
      { x: 65, z: 94 },
      { x: 78, z: 110 }
    ]
  },
  {
    id: "market-lane",
    halfWidth: 3.55,
    samplesPerSection: 10,
    control: [
      { x: 1, z: 89 },
      { x: -16, z: 95 },
      { x: -33, z: 106 },
      { x: -47, z: 118 },
      { x: -53, z: 132 }
    ]
  },
  {
    id: "guild-lane",
    halfWidth: 3.65,
    samplesPerSection: 10,
    control: [
      { x: -1, z: 104 },
      { x: 16, z: 109 },
      { x: 31, z: 118 },
      { x: 43, z: 128 },
      { x: 52, z: 145 }
    ]
  },
  {
    id: "residential-lane",
    halfWidth: 3.2,
    samplesPerSection: 9,
    control: [
      { x: 3, z: 153 },
      { x: -18, z: 159 },
      { x: -39, z: 169 },
      { x: -57, z: 183 },
      { x: -67, z: 199 }
    ]
  }
];

const JUNCTION_MASKS: JunctionMask[] = [
  { id: "service-junction", x: 3, z: 73, radius: 9.2 },
  { id: "market-junction", x: 1, z: 89, radius: 9.5 },
  { id: "guild-junction", x: -1, z: 104, radius: 9.8 },
  { id: "town-center", x: -1, z: 118, radius: 15.2 },
  { id: "residential-junction", x: 3, z: 153, radius: 9.5 },
  { id: "market-square", x: -48, z: 119, radius: 13.8 },
  { id: "guild-court", x: 43, z: 128, radius: 12.7 }
];

const BUILDINGS: BuildingDefinition[] = [
  { id: "gate-inn-west", x: -25, z: 49, width: 16, depth: 13, height: 8.8, roofHeight: 3.6, function: "inn", palette: "warm", target: { x: -1, z: 49 }, windows: 4, chimney: true },
  { id: "gate-home-east", x: 25, z: 50, width: 14, depth: 12, height: 8.1, roofHeight: 3.2, function: "home", palette: "sage", target: { x: -1, z: 50 }, windows: 3, chimney: true },
  { id: "main-merchant-west", x: -28, z: 73, width: 18, depth: 14, height: 9.6, roofHeight: 4.1, function: "merchant", palette: "sage", target: { x: 4, z: 74 }, windows: 4, chimney: true },
  { id: "main-workshop-east", x: 30, z: 82, width: 19, depth: 15, height: 9.2, roofHeight: 3.8, function: "workshop", palette: "warm", target: { x: 3, z: 80 }, windows: 3, chimney: true },
  { id: "service-store", x: 58, z: 70, width: 18, depth: 14, height: 8.5, roofHeight: 3.2, function: "storehouse", palette: "stone", target: { x: 35, z: 80 }, windows: 2 },
  { id: "service-smith", x: 88, z: 95, width: 20, depth: 16, height: 9.3, roofHeight: 3.6, function: "workshop", palette: "warm", target: { x: 67, z: 96 }, windows: 3, chimney: true },
  { id: "market-hall", x: -70, z: 107, width: 21, depth: 16, height: 10.4, roofHeight: 4.4, function: "merchant", palette: "warm", target: { x: -48, z: 119 }, windows: 5, chimney: true },
  { id: "market-storehouse", x: -73, z: 142, width: 22, depth: 17, height: 8.8, roofHeight: 3.2, function: "storehouse", palette: "stone", target: { x: -52, z: 132 }, windows: 2 },
  { id: "guild-hall", x: 69, z: 129, width: 28, depth: 20, height: 13.2, roofHeight: 5.5, function: "guild", palette: "stone", target: { x: 43, z: 128 }, windows: 6, chimney: true },
  { id: "guild-annex", x: 70, z: 158, width: 17, depth: 14, height: 8.9, roofHeight: 3.6, function: "outfitter", palette: "sage", target: { x: 52, z: 145 }, windows: 3, chimney: true },
  { id: "center-home-west", x: -29, z: 143, width: 15, depth: 13, height: 8.4, roofHeight: 3.4, function: "home", palette: "sage", target: { x: 2, z: 142 }, windows: 3 },
  { id: "center-home-east", x: 31, z: 151, width: 15, depth: 13, height: 8.6, roofHeight: 3.5, function: "home", palette: "warm", target: { x: 3, z: 153 }, windows: 3, chimney: true },
  { id: "residence-west", x: -66, z: 164, width: 16, depth: 13, height: 8.8, roofHeight: 3.5, function: "home", palette: "warm", target: { x: -39, z: 169 }, windows: 3, chimney: true },
  { id: "residence-north", x: -83, z: 190, width: 17, depth: 14, height: 8.9, roofHeight: 3.7, function: "home", palette: "sage", target: { x: -62, z: 193 }, windows: 3 },
  { id: "supply-outfitter", x: 29, z: 186, width: 21, depth: 16, height: 10.1, roofHeight: 4.3, function: "outfitter", palette: "warm", target: { x: -1, z: 185 }, windows: 5, chimney: true }
];

const catmullRom = (a: number, b: number, c: number, d: number, amount: number): number => {
  const amount2 = amount * amount;
  const amount3 = amount2 * amount;
  return 0.5 * (
    2 * b
    + (-a + c) * amount
    + (2 * a - 5 * b + 4 * c - d) * amount2
    + (-a + 3 * b - 3 * c + d) * amount3
  );
};

const samplePath = (definition: RoadDefinition): TownPoint[] => {
  const points: TownPoint[] = [];
  for (let section = 0; section < definition.control.length - 1; section += 1) {
    const p0 = definition.control[Math.max(0, section - 1)];
    const p1 = definition.control[section];
    const p2 = definition.control[section + 1];
    const p3 = definition.control[Math.min(definition.control.length - 1, section + 2)];
    for (let sample = 0; sample < definition.samplesPerSection; sample += 1) {
      const amount = sample / definition.samplesPerSection;
      points.push({
        x: catmullRom(p0.x, p1.x, p2.x, p3.x, amount),
        z: catmullRom(p0.z, p1.z, p2.z, p3.z, amount)
      });
    }
  }
  points.push({ ...definition.control[definition.control.length - 1] });
  return points;
};

const distance2d = (a: TownPoint, b: TownPoint): number => Math.hypot(a.x - b.x, a.z - b.z);

const hardenMaterial = (material: any): any => {
  material.alpha = 1;
  material.transparencyMode = 0;
  material.forceDepthWrite = true;
  material.useAlphaFromAlbedoTexture = false;
  material.backFaceCulling = true;
  return material;
};

const createGroundDisc = (
  scene: any,
  world: any,
  name: string,
  x: number,
  z: number,
  radius: number,
  segments: number,
  material: any,
  heightOffset: number
): any => {
  const positions = [x, world.heightAt(x, z) + heightOffset, z];
  const indices: number[] = [];
  const normals: number[] = [];
  for (let index = 0; index < segments; index += 1) {
    const angle = index / segments * Math.PI * 2;
    const px = x + Math.sin(angle) * radius;
    const pz = z + Math.cos(angle) * radius;
    positions.push(px, world.heightAt(px, pz) + heightOffset, pz);
  }
  for (let index = 0; index < segments; index += 1) {
    const current = 1 + index;
    const next = 1 + (index + 1) % segments;
    indices.push(0, next, current);
  }
  BABYLON.VertexData.ComputeNormals(positions, indices, normals);
  const data = new BABYLON.VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  const mesh = new BABYLON.Mesh(name, scene);
  data.applyToMesh(mesh);
  mesh.material = material;
  mesh.receiveShadows = true;
  mesh.isPickable = false;
  mesh.computeWorldMatrix(true);
  mesh.freezeWorldMatrix();
  return mesh;
};

const createTerrainRibbon = (
  scene: any,
  world: any,
  name: string,
  path: TownPoint[],
  halfWidth: number,
  material: any,
  heightOffset: number
): any => {
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  for (let index = 0; index < path.length; index += 1) {
    const previous = path[Math.max(0, index - 1)];
    const next = path[Math.min(path.length - 1, index + 1)];
    const dx = next.x - previous.x;
    const dz = next.z - previous.z;
    const length = Math.max(0.001, Math.hypot(dx, dz));
    const nx = -dz / length;
    const nz = dx / length;
    for (const side of [-1, 1]) {
      const x = path[index].x + nx * halfWidth * side;
      const z = path[index].z + nz * halfWidth * side;
      positions.push(x, world.heightAt(x, z) + heightOffset, z);
    }
  }
  for (let index = 0; index < path.length - 1; index += 1) {
    const base = index * 2;
    const next = base + 2;
    indices.push(base, next + 1, next, base, base + 1, next + 1);
  }
  BABYLON.VertexData.ComputeNormals(positions, indices, normals);
  const data = new BABYLON.VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  const mesh = new BABYLON.Mesh(name, scene);
  data.applyToMesh(mesh);
  mesh.material = material;
  mesh.receiveShadows = true;
  mesh.isPickable = false;
  mesh.computeWorldMatrix(true);
  mesh.freezeWorldMatrix();
  return mesh;
};

const createGabledRoof = (
  scene: any,
  name: string,
  width: number,
  depth: number,
  roofHeight: number,
  material: any
): any => {
  const halfWidth = width / 2 + 0.65;
  const halfDepth = depth / 2 + 0.65;
  const positions = [
    -halfWidth, 0, -halfDepth,
    halfWidth, 0, -halfDepth,
    0, roofHeight, -halfDepth,
    -halfWidth, 0, halfDepth,
    halfWidth, 0, halfDepth,
    0, roofHeight, halfDepth
  ];
  const indices = [
    0, 2, 1, 3, 4, 5,
    0, 3, 5, 0, 5, 2,
    1, 2, 5, 1, 5, 4,
    0, 1, 4, 0, 4, 3
  ];
  const normals: number[] = [];
  BABYLON.VertexData.ComputeNormals(positions, indices, normals);
  const data = new BABYLON.VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  const mesh = new BABYLON.Mesh(name, scene);
  data.applyToMesh(mesh);
  mesh.material = material;
  return mesh;
};

const transformLocal = (origin: TownPoint, localX: number, localZ: number, yaw: number): TownPoint => ({
  x: origin.x + localX * Math.cos(yaw) + localZ * Math.sin(yaw),
  z: origin.z - localX * Math.sin(yaw) + localZ * Math.cos(yaw)
});

export class CaelusIntegratedCity {
  private readonly scene: any;
  private readonly world: any;
  private readonly roadPaths = new Map<string, TownPoint[]>();
  private readonly footprints: BuildingFootprint[] = [];
  private readonly citizens: CitizenRecord[] = [];
  private frontageCount = 0;
  private curbCount = 0;
  private channelCount = 0;
  private hiddenLegacyMeshes = 0;

  constructor(private readonly game: any, private readonly contracts: any) {
    this.scene = game.world.scene;
    this.world = game.world;

    this.hideSupersededTownMeshes();
    this.clearTownCollisionNetwork();
    const materials = this.createMaterials();
    this.buildRoadTopology(materials);
    this.buildCivicSpaces(materials);
    this.buildBuildings(materials);
    this.buildMarket(materials);
    this.buildGatehouse(materials);
    this.relocateContractBoard();
    this.buildLanterns(materials);
    this.buildCitizens(materials);

    const audit = this.auditTownPlan();
    this.scene.metadata = {
      ...(this.scene.metadata ?? {}),
      caelusIntegratedCityVersion: 1,
      integratedRoadCount: ROAD_DEFINITIONS.length,
      integratedJunctionCount: JUNCTION_MASKS.length,
      integratedBuildingCount: BUILDINGS.length,
      integratedFrontageCount: this.frontageCount,
      integratedCurbCount: this.curbCount,
      integratedChannelCount: this.channelCount,
      hiddenSupersededTownMeshes: this.hiddenLegacyMeshes,
      integratedTownAudit: audit,
      integratedGuildBoardPosition: { x: 35, z: 128 },
      integratedWellPosition: { x: -19, z: 121 }
    };
  }

  private createMaterials(): Record<string, any> {
    const material = (name: string, color: string, roughness = 0.92, metallic = 0.02, emissive?: string): any => (
      hardenMaterial(createMaterial(this.scene, name, color, roughness, metallic, emissive))
    );
    return {
      road: material("caelus-integrated-road", "#3b423c", 1, 0),
      plaza: material("caelus-integrated-plaza", "#59625c", 0.98, 0),
      path: material("caelus-integrated-frontage-path", "#6b695b", 1, 0),
      curb: material("caelus-integrated-curb", "#49534d", 1, 0),
      channel: material("caelus-integrated-channel", "#18211f", 1, 0),
      grass: material("caelus-integrated-town-grass", "#344b38", 1, 0),
      stone: material("caelus-integrated-stone", "#56625f", 0.96, 0.02),
      darkStone: material("caelus-integrated-dark-stone", "#263330", 1, 0),
      wellDark: material("caelus-integrated-well-depth", "#05090a", 1, 0),
      plasterWarm: material("caelus-integrated-plaster-warm", "#8d846f", 0.98, 0),
      plasterSage: material("caelus-integrated-plaster-sage", "#687a6c", 0.98, 0),
      plasterStone: material("caelus-integrated-plaster-stone", "#66706d", 0.98, 0),
      timber: material("caelus-integrated-timber", "#47372d", 0.96, 0.02),
      roofBlue: material("caelus-integrated-roof-blue", "#2b5060", 0.9, 0.04),
      roofGreen: material("caelus-integrated-roof-green", "#425c43", 0.93, 0.02),
      door: material("caelus-integrated-door", "#34271f", 0.94, 0.02),
      window: material("caelus-integrated-window", "#cde7bf", 0.38, 0.02, "#466f52"),
      clothRed: material("caelus-integrated-cloth-red", "#845346", 0.98, 0),
      clothBlue: material("caelus-integrated-cloth-blue", "#365b6d", 0.98, 0),
      glow: material("caelus-integrated-glow", "#c8fff0", 0.18, 0.03, "#42cfae")
    };
  }

  private hideSupersededTownMeshes(): void {
    const prefixes = [
      "caelus-phase1-",
      "caelus-phase2-",
      "vertical-slice-city-",
      "vertical-slice-gate-",
      "vertical-slice-plaster-",
      "vertical-slice-roof-",
      "vertical-slice-market-",
      "vertical-slice-plaza-",
      "vertical-slice-wall-",
      "city-lantern-"
    ];
    for (const mesh of this.scene.meshes) {
      const name = String(mesh.name ?? "");
      if (!prefixes.some((prefix) => name.startsWith(prefix))) continue;
      mesh.visibility = 0;
      mesh.isVisible = false;
      mesh.isPickable = false;
      mesh.metadata = { ...(mesh.metadata ?? {}), supersededByIntegratedCity: true };
      this.hiddenLegacyMeshes += 1;
    }
  }

  private clearTownCollisionNetwork(): void {
    const boxes = this.world.collisionBoxes as CollisionBox[];
    if (!Array.isArray(boxes)) return;
    let write = 0;
    for (const box of boxes) {
      const centerX = (box.minX + box.maxX) * 0.5;
      const centerZ = (box.minZ + box.maxZ) * 0.5;
      const townCollision = centerX > -120 && centerX < 120 && centerZ > 15 && centerZ < 212;
      if (townCollision) continue;
      boxes[write] = box;
      write += 1;
    }
    boxes.length = write;
  }

  private addCollision(x: number, z: number, width: number, depth: number): void {
    const boxes = this.world.collisionBoxes as CollisionBox[];
    if (!Array.isArray(boxes)) return;
    boxes.push({
      minX: x - width / 2,
      maxX: x + width / 2,
      minZ: z - depth / 2,
      maxZ: z + depth / 2
    });
  }

  private buildRoadTopology(materials: Record<string, any>): void {
    for (const definition of ROAD_DEFINITIONS) {
      const path = samplePath(definition);
      this.roadPaths.set(definition.id, path);
      createTerrainRibbon(
        this.scene,
        this.world,
        `caelus-integrated-road-${definition.id}`,
        path,
        definition.halfWidth,
        materials.road,
        0.082
      );
      this.buildRoadFurniture(definition, path, materials);
    }

    for (const mask of JUNCTION_MASKS) {
      const isMajor = mask.id === "town-center" || mask.id === "market-square" || mask.id === "guild-court";
      createGroundDisc(
        this.scene,
        this.world,
        `caelus-integrated-junction-${mask.id}`,
        mask.x,
        mask.z,
        mask.radius,
        isMajor ? 32 : 24,
        isMajor ? materials.plaza : materials.road,
        isMajor ? 0.09 : 0.087
      );
    }
  }

  private buildRoadFurniture(
    definition: RoadDefinition,
    path: TownPoint[],
    materials: Record<string, any>
  ): void {
    for (let index = 0; index < path.length - 1; index += 1) {
      const start = path[index];
      const end = path[index + 1];
      const midpoint = { x: (start.x + end.x) * 0.5, z: (start.z + end.z) * 0.5 };
      if (JUNCTION_MASKS.some((mask) => distance2d(midpoint, mask) < mask.radius)) continue;

      const dx = end.x - start.x;
      const dz = end.z - start.z;
      const length = Math.hypot(dx, dz);
      if (length < 0.2) continue;
      const tangentX = dx / length;
      const tangentZ = dz / length;
      const normalX = -tangentZ;
      const normalZ = tangentX;
      const yaw = Math.atan2(tangentX, tangentZ);

      for (const side of [-1, 1]) {
        const curbOffset = definition.halfWidth + 0.56;
        const curbX = midpoint.x + normalX * curbOffset * side;
        const curbZ = midpoint.z + normalZ * curbOffset * side;
        const curb = BABYLON.MeshBuilder.CreateBox(
          `caelus-integrated-${definition.id}-curb-${index}-${side}`,
          { width: 0.44, height: 0.14, depth: Math.max(0.35, length * 0.72) },
          this.scene
        );
        curb.position.set(curbX, this.world.heightAt(curbX, curbZ) + 0.12, curbZ);
        curb.rotation.y = yaw;
        curb.material = materials.curb;
        curb.receiveShadows = true;
        curb.isPickable = false;
        curb.metadata = { integratedRoadCurb: true, road: definition.id, midpoint };
        curb.computeWorldMatrix(true);
        curb.freezeWorldMatrix();
        this.curbCount += 1;

        const channelOffset = definition.halfWidth + 0.16;
        const channelX = midpoint.x + normalX * channelOffset * side;
        const channelZ = midpoint.z + normalZ * channelOffset * side;
        const channel = BABYLON.MeshBuilder.CreateBox(
          `caelus-integrated-${definition.id}-channel-${index}-${side}`,
          { width: 0.25, height: 0.035, depth: Math.max(0.35, length * 0.82) },
          this.scene
        );
        channel.position.set(channelX, this.world.heightAt(channelX, channelZ) + 0.094, channelZ);
        channel.rotation.y = yaw;
        channel.material = materials.channel;
        channel.isPickable = false;
        channel.metadata = { integratedRoadChannel: true, road: definition.id, midpoint };
        channel.computeWorldMatrix(true);
        channel.freezeWorldMatrix();
        this.channelCount += 1;
      }
    }
  }

  private buildCivicSpaces(materials: Record<string, any>): void {
    createGroundDisc(this.scene, this.world, "caelus-integrated-well-green", -19, 121, 8.3, 28, materials.grass, 0.103);
    createGroundDisc(this.scene, this.world, "caelus-integrated-well-apron", -19, 121, 4.65, 24, materials.stone, 0.118);
    createGroundDisc(this.scene, this.world, "caelus-integrated-well-dark-shaft", -19, 121, 2.12, 24, materials.wellDark, 0.135);

    const wellGround = this.world.heightAt(-19, 121);
    for (let index = 0; index < 14; index += 1) {
      const angle = index / 14 * Math.PI * 2;
      const stone = BABYLON.MeshBuilder.CreateBox(
        `caelus-integrated-well-rim-${index}`,
        { width: 1.28, height: 0.82, depth: 0.82 },
        this.scene
      );
      stone.position.set(
        -19 + Math.sin(angle) * 3.05,
        wellGround + 0.52,
        121 + Math.cos(angle) * 3.05
      );
      stone.rotation.y = angle;
      stone.material = materials.stone;
      stone.receiveShadows = true;
      stone.computeWorldMatrix(true);
      stone.freezeWorldMatrix();
    }

    for (const side of [-1, 1]) {
      const post = BABYLON.MeshBuilder.CreateBox(
        `caelus-integrated-well-post-${side}`,
        { width: 0.48, height: 5.7, depth: 0.48 },
        this.scene
      );
      post.position.set(-19 + side * 2.85, wellGround + 2.9, 121);
      post.material = materials.timber;
      post.receiveShadows = true;
      post.computeWorldMatrix(true);
      post.freezeWorldMatrix();
    }
    const axle = BABYLON.MeshBuilder.CreateCylinder(
      "caelus-integrated-well-axle",
      { height: 6.1, diameter: 0.34, tessellation: 10 },
      this.scene
    );
    axle.position.set(-19, wellGround + 4.55, 121);
    axle.rotation.z = Math.PI / 2;
    axle.material = materials.timber;
    axle.computeWorldMatrix(true);
    axle.freezeWorldMatrix();

    const rope = BABYLON.MeshBuilder.CreateCylinder(
      "caelus-integrated-well-rope",
      { height: 3.3, diameter: 0.09, tessellation: 8 },
      this.scene
    );
    rope.position.set(-19, wellGround + 2.9, 121);
    rope.material = materials.timber;
    rope.computeWorldMatrix(true);
    rope.freezeWorldMatrix();
    this.addCollision(-19, 121, 7.1, 7.1);
  }

  private nearestRoadPoint(point: TownPoint): { road: RoadDefinition; point: TownPoint; distance: number } {
    let bestRoad = ROAD_DEFINITIONS[0];
    let bestPoint = this.roadPaths.get(bestRoad.id)?.[0] ?? bestRoad.control[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const road of ROAD_DEFINITIONS) {
      const path = this.roadPaths.get(road.id) ?? [];
      for (const candidate of path) {
        const distance = distance2d(point, candidate);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestRoad = road;
          bestPoint = candidate;
        }
      }
    }
    return { road: bestRoad, point: bestPoint, distance: bestDistance };
  }

  private buildBuildings(materials: Record<string, any>): void {
    for (const definition of BUILDINGS) this.buildBuilding(definition, materials);
  }

  private buildBuilding(definition: BuildingDefinition, materials: Record<string, any>): void {
    const ground = this.world.heightAt(definition.x, definition.z);
    const directionX = definition.target.x - definition.x;
    const directionZ = definition.target.z - definition.z;
    const yaw = Math.atan2(-directionX, -directionZ);
    const wallMaterial = definition.palette === "warm"
      ? materials.plasterWarm
      : definition.palette === "sage"
        ? materials.plasterSage
        : materials.plasterStone;
    const roofMaterial = definition.id.length % 2 === 0 ? materials.roofBlue : materials.roofGreen;

    const foundation = BABYLON.MeshBuilder.CreateBox(
      `caelus-integrated-${definition.id}-foundation`,
      { width: definition.width + 1.25, height: 0.7, depth: definition.depth + 1.25 },
      this.scene
    );
    foundation.position.set(definition.x, ground + 0.35, definition.z);
    foundation.rotation.y = yaw;
    foundation.material = materials.darkStone;
    foundation.receiveShadows = true;
    foundation.computeWorldMatrix(true);
    foundation.freezeWorldMatrix();

    const body = BABYLON.MeshBuilder.CreateBox(
      `caelus-integrated-${definition.id}-body`,
      { width: definition.width, height: definition.height, depth: definition.depth },
      this.scene
    );
    body.position.set(definition.x, ground + 0.7 + definition.height / 2, definition.z);
    body.rotation.y = yaw;
    body.material = wallMaterial;
    body.receiveShadows = true;
    body.metadata = { cameraCollision: true, integratedBuilding: definition.id };
    body.isPickable = true;
    body.computeWorldMatrix(true);
    body.freezeWorldMatrix();

    const roof = createGabledRoof(
      this.scene,
      `caelus-integrated-${definition.id}-roof`,
      definition.width,
      definition.depth,
      definition.roofHeight,
      roofMaterial
    );
    roof.position.set(definition.x, ground + 0.7 + definition.height, definition.z);
    roof.rotation.y = yaw;
    roof.receiveShadows = true;
    roof.computeWorldMatrix(true);
    roof.freezeWorldMatrix();

    const front = transformLocal(definition, 0, -definition.depth / 2 - 0.16, yaw);
    const doorHeight = definition.function === "guild" ? 4.2 : 3.2;
    const door = BABYLON.MeshBuilder.CreateBox(
      `caelus-integrated-${definition.id}-door`,
      { width: definition.function === "guild" ? 3.2 : 2.25, height: doorHeight, depth: 0.3 },
      this.scene
    );
    door.position.set(front.x, ground + 0.72 + doorHeight / 2, front.z);
    door.rotation.y = yaw;
    door.material = materials.door;
    door.computeWorldMatrix(true);
    door.freezeWorldMatrix();

    const beamHeight = ground + 0.7 + definition.height * 0.58;
    const band = BABYLON.MeshBuilder.CreateBox(
      `caelus-integrated-${definition.id}-timber-band`,
      { width: definition.width + 0.12, height: 0.34, depth: definition.depth + 0.12 },
      this.scene
    );
    band.position.set(definition.x, beamHeight, definition.z);
    band.rotation.y = yaw;
    band.material = materials.timber;
    band.computeWorldMatrix(true);
    band.freezeWorldMatrix();

    for (const localX of [-definition.width / 2 + 0.35, definition.width / 2 - 0.35]) {
      const beamPoint = transformLocal(definition, localX, -definition.depth / 2 - 0.08, yaw);
      const beam = BABYLON.MeshBuilder.CreateBox(
        `caelus-integrated-${definition.id}-front-beam-${localX}`,
        { width: 0.34, height: definition.height - 0.4, depth: 0.34 },
        this.scene
      );
      beam.position.set(beamPoint.x, ground + 0.8 + (definition.height - 0.4) / 2, beamPoint.z);
      beam.rotation.y = yaw;
      beam.material = materials.timber;
      beam.computeWorldMatrix(true);
      beam.freezeWorldMatrix();
    }

    for (let index = 0; index < definition.windows; index += 1) {
      const row = index >= 3 ? 1 : 0;
      const inRow = row === 0 ? index : index - 3;
      const count = row === 0 ? Math.min(3, definition.windows) : Math.max(1, definition.windows - 3);
      const localX = (inRow - (count - 1) / 2) * Math.min(3.6, definition.width / 4);
      if (Math.abs(localX) < 1.45 && row === 0) continue;
      const point = transformLocal(definition, localX, -definition.depth / 2 - 0.19, yaw);
      const window = BABYLON.MeshBuilder.CreateBox(
        `caelus-integrated-${definition.id}-window-${index}`,
        { width: 1.35, height: 1.55, depth: 0.2 },
        this.scene
      );
      window.position.set(point.x, ground + 4.2 + row * 2.55, point.z);
      window.rotation.y = yaw;
      window.material = materials.window;
      window.computeWorldMatrix(true);
      window.freezeWorldMatrix();
    }

    if (definition.chimney) {
      const point = transformLocal(definition, definition.width * 0.23, definition.depth * 0.12, yaw);
      const chimney = BABYLON.MeshBuilder.CreateBox(
        `caelus-integrated-${definition.id}-chimney`,
        { width: 1.25, height: 4.2, depth: 1.25 },
        this.scene
      );
      chimney.position.set(point.x, ground + definition.height + definition.roofHeight + 1.1, point.z);
      chimney.rotation.y = yaw;
      chimney.material = materials.timber;
      chimney.receiveShadows = true;
      chimney.computeWorldMatrix(true);
      chimney.freezeWorldMatrix();
    }

    const frontageTarget = definition.target;
    createTerrainRibbon(
      this.scene,
      this.world,
      `caelus-integrated-${definition.id}-frontage`,
      [front, frontageTarget],
      definition.function === "guild" ? 2.2 : 1.05,
      materials.path,
      0.105
    );
    this.frontageCount += 1;

    if (["merchant", "outfitter", "inn", "guild"].includes(definition.function)) {
      this.buildSign(definition, front, yaw, ground, materials);
    }
    if (definition.function === "guild") this.decorateGuild(definition, yaw, ground, materials);

    const cosine = Math.abs(Math.cos(yaw));
    const sine = Math.abs(Math.sin(yaw));
    const collisionWidth = cosine * definition.width + sine * definition.depth;
    const collisionDepth = sine * definition.width + cosine * definition.depth;
    this.addCollision(definition.x, definition.z, collisionWidth - 0.65, collisionDepth - 0.65);
    this.footprints.push({
      id: definition.id,
      x: definition.x,
      z: definition.z,
      halfWidth: collisionWidth / 2,
      halfDepth: collisionDepth / 2,
      yaw,
      frontageConnected: true
    });
  }

  private buildSign(
    definition: BuildingDefinition,
    front: TownPoint,
    yaw: number,
    ground: number,
    materials: Record<string, any>
  ): void {
    const side = transformLocal(front, definition.width * 0.22, -0.45, yaw);
    const post = BABYLON.MeshBuilder.CreateBox(
      `caelus-integrated-${definition.id}-sign-post`,
      { width: 0.28, height: 3, depth: 0.28 },
      this.scene
    );
    post.position.set(side.x, ground + 2.25, side.z);
    post.rotation.y = yaw;
    post.material = materials.timber;
    post.computeWorldMatrix(true);
    post.freezeWorldMatrix();

    const sign = BABYLON.MeshBuilder.CreateBox(
      `caelus-integrated-${definition.id}-sign`,
      { width: definition.function === "guild" ? 3.3 : 2.3, height: 1.15, depth: 0.28 },
      this.scene
    );
    sign.position.set(side.x, ground + 3.55, side.z);
    sign.rotation.y = yaw;
    sign.material = definition.function === "guild" ? materials.clothBlue : materials.timber;
    sign.computeWorldMatrix(true);
    sign.freezeWorldMatrix();
  }

  private decorateGuild(
    definition: BuildingDefinition,
    yaw: number,
    ground: number,
    materials: Record<string, any>
  ): void {
    const porchPoint = transformLocal(definition, 0, -definition.depth / 2 - 2.2, yaw);
    const porch = BABYLON.MeshBuilder.CreateBox(
      "caelus-integrated-guild-porch",
      { width: 11.5, height: 0.65, depth: 4.2 },
      this.scene
    );
    porch.position.set(porchPoint.x, ground + 0.35, porchPoint.z);
    porch.rotation.y = yaw;
    porch.material = materials.stone;
    porch.receiveShadows = true;
    porch.computeWorldMatrix(true);
    porch.freezeWorldMatrix();

    for (let step = 0; step < 3; step += 1) {
      const point = transformLocal(definition, 0, -definition.depth / 2 - 4.45 - step * 0.72, yaw);
      const stair = BABYLON.MeshBuilder.CreateBox(
        `caelus-integrated-guild-step-${step}`,
        { width: 8.5 - step * 0.7, height: 0.22 + step * 0.16, depth: 0.85 },
        this.scene
      );
      stair.position.set(point.x, ground + 0.11 + step * 0.08, point.z);
      stair.rotation.y = yaw;
      stair.material = materials.stone;
      stair.computeWorldMatrix(true);
      stair.freezeWorldMatrix();
    }

    for (const side of [-1, 1]) {
      const bannerPoint = transformLocal(definition, side * 7.2, -definition.depth / 2 - 0.35, yaw);
      const banner = BABYLON.MeshBuilder.CreateBox(
        `caelus-integrated-guild-banner-${side}`,
        { width: 2.2, height: 5.5, depth: 0.18 },
        this.scene
      );
      banner.position.set(bannerPoint.x, ground + 7.1, bannerPoint.z);
      banner.rotation.y = yaw;
      banner.material = materials.clothBlue;
      banner.computeWorldMatrix(true);
      banner.freezeWorldMatrix();
    }

    const crestPoint = transformLocal(definition, 0, -definition.depth / 2 - 0.45, yaw);
    const crest = BABYLON.MeshBuilder.CreateTorus(
      "caelus-integrated-guild-crest",
      { diameter: 2.4, thickness: 0.22, tessellation: 28 },
      this.scene
    );
    crest.position.set(crestPoint.x, ground + 9.2, crestPoint.z);
    crest.rotation.x = Math.PI / 2;
    crest.rotation.y = yaw;
    crest.material = materials.glow;
    crest.computeWorldMatrix(true);
    crest.freezeWorldMatrix();
  }

  private buildMarket(materials: Record<string, any>): void {
    const stalls = [
      { id: "produce", x: -59, z: 108, yaw: 0.48, cloth: materials.clothRed },
      { id: "supplies", x: -62, z: 127, yaw: -0.15, cloth: materials.clothBlue },
      { id: "provisions", x: -42, z: 132, yaw: -0.55, cloth: materials.clothRed }
    ];
    for (const stall of stalls) {
      const ground = this.world.heightAt(stall.x, stall.z);
      const width = 7.8;
      const depth = 4.8;
      for (const localX of [-width / 2 + 0.4, width / 2 - 0.4]) {
        for (const localZ of [-depth / 2 + 0.35, depth / 2 - 0.35]) {
          const point = transformLocal(stall, localX, localZ, stall.yaw);
          const post = BABYLON.MeshBuilder.CreateBox(
            `caelus-integrated-market-${stall.id}-post-${localX}-${localZ}`,
            { width: 0.3, height: 3.3, depth: 0.3 },
            this.scene
          );
          post.position.set(point.x, ground + 1.65, point.z);
          post.rotation.y = stall.yaw;
          post.material = materials.timber;
          post.computeWorldMatrix(true);
          post.freezeWorldMatrix();
        }
      }
      const counterPoint = transformLocal(stall, 0, -depth * 0.22, stall.yaw);
      const counter = BABYLON.MeshBuilder.CreateBox(
        `caelus-integrated-market-${stall.id}-counter`,
        { width: width - 0.8, height: 0.85, depth: 1.25 },
        this.scene
      );
      counter.position.set(counterPoint.x, ground + 1.05, counterPoint.z);
      counter.rotation.y = stall.yaw;
      counter.material = materials.timber;
      counter.computeWorldMatrix(true);
      counter.freezeWorldMatrix();

      const canopy = BABYLON.MeshBuilder.CreateBox(
        `caelus-integrated-market-${stall.id}-canopy`,
        { width: width + 0.55, height: 0.2, depth: depth + 0.55 },
        this.scene
      );
      canopy.position.set(stall.x, ground + 3.35, stall.z);
      canopy.rotation.y = stall.yaw;
      canopy.rotation.z = 0.04;
      canopy.material = stall.cloth;
      canopy.computeWorldMatrix(true);
      canopy.freezeWorldMatrix();
      this.addCollision(counterPoint.x, counterPoint.z, width - 1, 1.2);
    }
  }

  private buildGatehouse(materials: Record<string, any>): void {
    const gateZ = 24;
    const ground = this.world.heightAt(0, gateZ);
    for (const side of [-1, 1]) {
      const x = side * 11.5;
      const base = BABYLON.MeshBuilder.CreateBox(
        `caelus-integrated-gate-tower-${side}`,
        { width: 9.5, height: 14, depth: 11.5 },
        this.scene
      );
      base.position.set(x, ground + 7, gateZ);
      base.material = materials.stone;
      base.receiveShadows = true;
      base.isPickable = true;
      base.metadata = { cameraCollision: true, closedSolidGeometry: true };
      base.computeWorldMatrix(true);
      base.freezeWorldMatrix();

      const roof = BABYLON.MeshBuilder.CreateCylinder(
        `caelus-integrated-gate-roof-${side}`,
        { height: 4.6, diameterTop: 0.6, diameterBottom: 12.2, tessellation: 4 },
        this.scene
      );
      roof.position.set(x, ground + 16.2, gateZ);
      roof.rotation.y = Math.PI / 4;
      roof.material = side < 0 ? materials.roofBlue : materials.roofGreen;
      roof.receiveShadows = true;
      roof.computeWorldMatrix(true);
      roof.freezeWorldMatrix();
      this.addCollision(x, gateZ, 9.2, 11.2);
    }

    const lintel = BABYLON.MeshBuilder.CreateBox(
      "caelus-integrated-gate-lintel",
      { width: 13.5, height: 3.2, depth: 5.2 },
      this.scene
    );
    lintel.position.set(0, ground + 12.4, gateZ);
    lintel.material = materials.stone;
    lintel.receiveShadows = true;
    lintel.metadata = { cameraCollision: true, closedSolidGeometry: true };
    lintel.isPickable = true;
    lintel.computeWorldMatrix(true);
    lintel.freezeWorldMatrix();

    for (const side of [-1, 1]) {
      const wallCenterX = side * 60.5;
      const wall = BABYLON.MeshBuilder.CreateBox(
        `caelus-integrated-gate-wall-${side}`,
        { width: 88, height: 7.5, depth: 4.2 },
        this.scene
      );
      wall.position.set(wallCenterX, ground + 3.75, gateZ);
      wall.material = materials.stone;
      wall.receiveShadows = true;
      wall.metadata = { cameraCollision: true, closedSolidGeometry: true };
      wall.isPickable = true;
      wall.computeWorldMatrix(true);
      wall.freezeWorldMatrix();
      this.addCollision(wallCenterX, gateZ, 88, 4.2);
    }

    for (const side of [-1, 1]) {
      const door = BABYLON.MeshBuilder.CreateBox(
        `caelus-integrated-gate-door-${side}`,
        { width: 5.6, height: 8.6, depth: 0.55 },
        this.scene
      );
      door.position.set(side * 5.8, ground + 4.3, gateZ + 0.6);
      door.rotation.y = side * -0.92;
      door.material = materials.timber;
      door.receiveShadows = true;
      door.computeWorldMatrix(true);
      door.freezeWorldMatrix();
    }
  }

  private relocateContractBoard(): void {
    const oldPosition = (this.contracts as any)?.boardPosition;
    if (!oldPosition) return;
    const newPosition = new BABYLON.Vector3(35, this.world.heightAt(35, 128), 128);
    const delta = newPosition.subtract(oldPosition);
    for (const mesh of this.scene.meshes) {
      const name = String(mesh.name ?? "");
      if (!name.startsWith("batched-contract-board-")) continue;
      mesh.unfreezeWorldMatrix?.();
      mesh.position.addInPlace(delta);
      mesh.computeWorldMatrix(true);
      mesh.freezeWorldMatrix();
    }
    oldPosition.copyFrom(newPosition);
    this.addCollision(35, 128, 6.1, 1.8);
  }

  private buildLanterns(materials: Record<string, any>): void {
    const positions = [
      [-8, 45], [8, 61], [-9, 82], [9, 98], [-10, 137], [10, 164], [-9, 188],
      [-25, 101], [-44, 111], [-48, 131], [23, 115], [42, 141], [58, 91]
    ];
    positions.forEach(([x, z], index) => {
      const ground = this.world.heightAt(x, z);
      const pole = BABYLON.MeshBuilder.CreateBox(
        `caelus-integrated-lantern-pole-${index}`,
        { width: 0.3, height: 4.8, depth: 0.3 },
        this.scene
      );
      pole.position.set(x, ground + 2.4, z);
      pole.material = materials.timber;
      pole.computeWorldMatrix(true);
      pole.freezeWorldMatrix();
      const light = BABYLON.MeshBuilder.CreatePolyhedron(
        `caelus-integrated-lantern-light-${index}`,
        { type: 1, size: 0.52 },
        this.scene
      );
      light.position.set(x, ground + 5.2, z);
      light.material = materials.glow;
      light.computeWorldMatrix(true);
      light.freezeWorldMatrix();
    });
  }

  private buildCitizens(materials: Record<string, any>): void {
    const definitions = [
      { color: "#6c7e91", scale: 0.92, speed: 1.05, route: [{ x: -6, z: 47 }, { x: 3, z: 82 }, { x: -2, z: 120 }, { x: 3, z: 165 }] },
      { color: "#8a624c", scale: 1.03, speed: 0.78, route: [{ x: -9, z: 90 }, { x: -30, z: 104 }, { x: -48, z: 119 }, { x: -53, z: 132 }] },
      { color: "#5e7958", scale: 0.86, speed: 0.9, route: [{ x: 3, z: 105 }, { x: 25, z: 116 }, { x: 43, z: 128 }, { x: 52, z: 145 }] },
      { color: "#7b5d79", scale: 0.96, speed: 0.72, route: [{ x: 3, z: 154 }, { x: -20, z: 161 }, { x: -42, z: 172 }, { x: -62, z: 193 }] },
      { color: "#767a54", scale: 1.08, speed: 0.84, route: [{ x: 4, z: 73 }, { x: 28, z: 79 }, { x: 55, z: 90 }, { x: 76, z: 109 }] }
    ];

    definitions.forEach((definition, index) => {
      const root = new BABYLON.TransformNode(`caelus-integrated-citizen-${index}`, this.scene);
      const cloth = hardenMaterial(createMaterial(
        this.scene,
        `caelus-integrated-citizen-cloth-${index}`,
        definition.color,
        0.98,
        0
      ));
      const torso = BABYLON.MeshBuilder.CreateBox(
        `caelus-integrated-citizen-torso-${index}`,
        { width: 0.52, height: 0.9, depth: 0.34 },
        this.scene
      );
      torso.position.y = 1.15;
      torso.material = cloth;
      torso.parent = root;
      const head = BABYLON.MeshBuilder.CreateSphere(
        `caelus-integrated-citizen-head-${index}`,
        { diameter: 0.36, segments: 7 },
        this.scene
      );
      head.position.y = 1.82;
      head.material = materials.plasterWarm;
      head.parent = root;
      for (const side of [-1, 1]) {
        const leg = BABYLON.MeshBuilder.CreateCylinder(
          `caelus-integrated-citizen-leg-${index}-${side}`,
          { height: 0.72, diameterTop: 0.16, diameterBottom: 0.13, tessellation: 6 },
          this.scene
        );
        leg.position.set(side * 0.13, 0.42, 0);
        leg.material = materials.darkStone;
        leg.parent = root;
      }
      root.scaling.setAll(definition.scale);
      root.position.set(
        definition.route[0].x,
        this.world.heightAt(definition.route[0].x, definition.route[0].z),
        definition.route[0].z
      );
      this.citizens.push({ root, route: definition.route, index: 1, speed: definition.speed });
    });

    this.scene.onBeforeRenderObservable.add(() => this.updateCitizens());
  }

  private updateCitizens(): void {
    const delta = Math.min(0.05, Math.max(0.001, this.world.engine.getDeltaTime() / 1000));
    for (const citizen of this.citizens) {
      const target = citizen.route[citizen.index];
      const dx = target.x - citizen.root.position.x;
      const dz = target.z - citizen.root.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.35) {
        citizen.index = (citizen.index + 1) % citizen.route.length;
        continue;
      }
      const amount = Math.min(distance, citizen.speed * delta);
      citizen.root.position.x += dx / distance * amount;
      citizen.root.position.z += dz / distance * amount;
      citizen.root.position.y = this.world.heightAt(citizen.root.position.x, citizen.root.position.z);
      citizen.root.rotation.y = Math.atan2(dx, dz);
    }
  }

  private auditTownPlan(): Record<string, unknown> {
    let curbInsideJunction = 0;
    let channelInsideJunction = 0;
    for (const mesh of this.scene.meshes) {
      const midpoint = mesh.metadata?.midpoint as TownPoint | undefined;
      if (!midpoint) continue;
      const inside = JUNCTION_MASKS.some((mask) => distance2d(midpoint, mask) < mask.radius);
      if (inside && mesh.metadata?.integratedRoadCurb) curbInsideJunction += 1;
      if (inside && mesh.metadata?.integratedRoadChannel) channelInsideJunction += 1;
    }

    let roadBuildingOverlaps = 0;
    for (const footprint of this.footprints) {
      const nearest = this.nearestRoadPoint(footprint);
      const buildingClearance = Math.min(footprint.halfWidth, footprint.halfDepth) + 0.8;
      if (nearest.distance < nearest.road.halfWidth + buildingClearance) roadBuildingOverlaps += 1;
    }

    let buildingOverlapPairs = 0;
    for (let left = 0; left < this.footprints.length; left += 1) {
      for (let right = left + 1; right < this.footprints.length; right += 1) {
        const a = this.footprints[left];
        const b = this.footprints[right];
        const overlapX = Math.abs(a.x - b.x) < a.halfWidth + b.halfWidth + 1.2;
        const overlapZ = Math.abs(a.z - b.z) < a.halfDepth + b.halfDepth + 1.2;
        if (overlapX && overlapZ) buildingOverlapPairs += 1;
      }
    }

    const opaqueGateMaterials = this.scene.materials.filter((material: any) => (
      String(material.name ?? "").startsWith("caelus-integrated-")
      && Number(material.alpha ?? 1) >= 0.999
      && Number(material.transparencyMode ?? 0) === 0
    )).length;

    return {
      curbInsideJunction,
      channelInsideJunction,
      roadBuildingOverlaps,
      buildingOverlapPairs,
      disconnectedFrontages: this.footprints.filter((footprint) => !footprint.frontageConnected).length,
      buildingCount: this.footprints.length,
      frontageCount: this.frontageCount,
      citizenCount: this.citizens.length,
      opaqueIntegratedMaterials: opaqueGateMaterials,
      guildBoardRelocated: Math.abs(Number((this.contracts as any)?.boardPosition?.x ?? 0) - 35) < 0.1,
      boarContractAvailable: Boolean((this.contracts as any)?.state?.["boar-control"]),
      wellHasDarkShaft: Boolean(this.scene.getMeshByName?.("caelus-integrated-well-dark-shaft")),
      gateSolidMeshCount: this.scene.meshes.filter((mesh: any) => mesh.metadata?.closedSolidGeometry === true).length
    };
  }
}
