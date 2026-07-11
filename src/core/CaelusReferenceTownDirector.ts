interface Point2 {
  x: number;
  z: number;
}

interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface HouseSpec extends Point2 {
  id: string;
  width: number;
  depth: number;
  height: number;
  doorSide: "north" | "south";
  collectorZ: number;
  palette: "warm" | "sage";
  roof: "blue" | "green";
}

interface RectAudit {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface ReferenceTownAudit {
  version: number;
  milestone: string;
  retiredMeshes: number;
  removedCollisionVolumes: number;
  houseCount: number;
  mainRoadCount: number;
  collectorPathCount: number;
  frontagePathCount: number;
  wallSegmentCount: number;
  towerCount: number;
  gateOpeningCount: number;
  wellPosition: Point2;
  townCenterPresent: boolean;
  houseRoadIntersections: string[];
  houseCollectorIntersections: string[];
  houseWallIntersections: string[];
  houseHouseIntersections: string[];
  blockedMainRouteSamples: number;
  minimumWallClearance: number;
  minimumHouseSpacing: number;
  pass: boolean;
}

const MAIN_ROAD_HALF_WIDTH = 6;
const PATH_HALF_WIDTH = 1.45;
const WALL_X = 116;
const SOUTH_WALL_Z = 14;
const NORTH_WALL_Z = 228;
const GATE_HALF_WIDTH = 10;
const WELL_POSITION: Point2 = { x: -91, z: 207 };
const COLLECTOR_LEVELS = [182, 124, 70];

const HOUSES: HouseSpec[] = [
  { id: "upper-left-west", x: -63, z: 202, width: 17, depth: 14, height: 9.0, doorSide: "south", collectorZ: 182, palette: "warm", roof: "blue" },
  { id: "upper-left-east", x: -31, z: 201, width: 16, depth: 13, height: 8.5, doorSide: "south", collectorZ: 182, palette: "sage", roof: "green" },
  { id: "upper-left-lower-west", x: -83, z: 162, width: 17, depth: 14, height: 8.8, doorSide: "north", collectorZ: 182, palette: "sage", roof: "blue" },
  { id: "upper-left-lower-east", x: -48, z: 162, width: 18, depth: 14, height: 9.2, doorSide: "north", collectorZ: 182, palette: "warm", roof: "green" },

  { id: "upper-right-west", x: 31, z: 201, width: 16, depth: 13, height: 8.6, doorSide: "south", collectorZ: 182, palette: "sage", roof: "blue" },
  { id: "upper-right-east", x: 63, z: 202, width: 17, depth: 14, height: 9.0, doorSide: "south", collectorZ: 182, palette: "warm", roof: "green" },
  { id: "upper-right-lower-west", x: 48, z: 162, width: 18, depth: 14, height: 9.2, doorSide: "north", collectorZ: 182, palette: "warm", roof: "blue" },
  { id: "upper-right-lower-east", x: 83, z: 162, width: 17, depth: 14, height: 8.8, doorSide: "north", collectorZ: 182, palette: "sage", roof: "green" },

  { id: "middle-left-west", x: -86, z: 143, width: 17, depth: 14, height: 9.0, doorSide: "south", collectorZ: 124, palette: "warm", roof: "green" },
  { id: "middle-left-east", x: -54, z: 143, width: 16, depth: 13, height: 8.7, doorSide: "south", collectorZ: 124, palette: "sage", roof: "blue" },
  { id: "middle-left-lower", x: -27, z: 104, width: 17, depth: 14, height: 9.1, doorSide: "north", collectorZ: 124, palette: "warm", roof: "blue" },

  { id: "middle-right-west", x: 27, z: 143, width: 17, depth: 14, height: 9.1, doorSide: "south", collectorZ: 124, palette: "warm", roof: "green" },
  { id: "middle-right-center", x: 57, z: 143, width: 16, depth: 13, height: 8.7, doorSide: "south", collectorZ: 124, palette: "sage", roof: "blue" },
  { id: "middle-right-lower", x: 87, z: 104, width: 17, depth: 14, height: 9.0, doorSide: "north", collectorZ: 124, palette: "warm", roof: "green" },

  { id: "lower-left-west", x: -90, z: 89, width: 17, depth: 14, height: 8.8, doorSide: "south", collectorZ: 70, palette: "sage", roof: "blue" },
  { id: "lower-left-east", x: -57, z: 89, width: 16, depth: 13, height: 8.6, doorSide: "south", collectorZ: 70, palette: "warm", roof: "green" },
  { id: "lower-left-south", x: -31, z: 48, width: 18, depth: 14, height: 9.3, doorSide: "north", collectorZ: 70, palette: "warm", roof: "blue" },

  { id: "lower-right-west", x: 31, z: 89, width: 17, depth: 14, height: 8.8, doorSide: "south", collectorZ: 70, palette: "sage", roof: "green" },
  { id: "lower-right-center", x: 63, z: 89, width: 16, depth: 13, height: 8.6, doorSide: "south", collectorZ: 70, palette: "warm", roof: "blue" },
  { id: "lower-right-south", x: 91, z: 48, width: 18, depth: 14, height: 9.3, doorSide: "north", collectorZ: 70, palette: "sage", roof: "green" }
];

const round = (value: number, precision = 3): number => Number(value.toFixed(precision));

const intersects = (a: RectAudit, b: RectAudit, inset = 0): boolean => (
  a.minX + inset < b.maxX - inset
  && a.maxX - inset > b.minX + inset
  && a.minZ + inset < b.maxZ - inset
  && a.maxZ - inset > b.minZ + inset
);

const rect = (id: string, x: number, z: number, width: number, depth: number): RectAudit => ({
  id,
  minX: x - width / 2,
  maxX: x + width / 2,
  minZ: z - depth / 2,
  maxZ: z + depth / 2
});

const makeMaterial = (scene: any, name: string, color: string, emissive?: string): any => {
  const material = new BABYLON.StandardMaterial(name, scene);
  material.diffuseColor = BABYLON.Color3.FromHexString(color);
  material.ambientColor = BABYLON.Color3.FromHexString(color).scale(0.3);
  material.specularColor = BABYLON.Color3.Black();
  material.emissiveColor = emissive ? BABYLON.Color3.FromHexString(emissive) : BABYLON.Color3.Black();
  material.alpha = 1;
  material.transparencyMode = 0;
  material.forceDepthWrite = true;
  material.backFaceCulling = false;
  return material;
};

export class CaelusReferenceTownDirector {
  private readonly scene: any;
  private readonly world: any;
  private readonly shadowGenerator: any;
  private readonly generated: any[] = [];
  private readonly houseRects: RectAudit[] = [];
  private readonly collectorRects: RectAudit[] = [];
  private readonly frontageRects: RectAudit[] = [];
  private readonly wallRects: RectAudit[] = [];
  private audit: ReferenceTownAudit;

  constructor(game: any) {
    this.scene = game.world.scene;
    this.world = game.world;
    this.shadowGenerator = game.world.shadowGenerator;

    const retiredMeshes = this.retireOldTown();
    const removedCollisionVolumes = this.clearOldTownCollision();
    this.buildReferenceLayout();
    this.repositionMara();
    this.audit = this.createAudit(retiredMeshes, removedCollisionVolumes);
    this.installPlaytestApi();

    this.scene.metadata = {
      ...(this.scene.metadata ?? {}),
      caelusReferenceTownVersion: 1,
      caelusReferenceTownMilestone: "Set 1 / Milestone 1.4 — Approved Reference Layout",
      caelusReferenceTownAudit: { ...this.audit }
    };

    console.info(
      `[Caelus Reference Town] ${this.audit.houseCount} houses, ${this.audit.frontagePathCount} frontages, `
      + `${this.audit.wallSegmentCount} wall segments, pass=${this.audit.pass}.`
    );
  }

  private retireOldTown(): number {
    let retired = 0;
    const townTokens = [
      "caelus-", "city-lantern-", "gate-tower-", "gate-rune-", "gate-beam",
      "guild-", "market-", "town-green", "town-center", "well-", "frontage-",
      "main-shop", "main-workshop", "service-store", "service-home", "residence-", "supply-house"
    ];

    for (const node of [...this.scene.meshes, ...this.scene.transformNodes] as any[]) {
      const name = String(node.name ?? "").toLowerCase();
      if (name.startsWith("caelus-reference-")) continue;
      if (!townTokens.some((token) => name.includes(token))) continue;
      const position = node.getAbsolutePosition?.() ?? node.position;
      const insideTown = !position || (
        Number(position.x) >= -145 && Number(position.x) <= 145
        && Number(position.z) >= 0 && Number(position.z) <= 240
      );
      if (!insideTown) continue;
      node.setEnabled?.(false);
      node.isVisible = false;
      node.isPickable = false;
      node.metadata = { ...(node.metadata ?? {}), supersededByReferenceTown: true };
      retired += 1;
    }
    return retired;
  }

  private clearOldTownCollision(): number {
    const boxes = (this.world as any).collisionBoxes as CollisionBox[];
    if (!Array.isArray(boxes)) return 0;
    let removed = 0;
    let write = 0;
    for (const box of boxes) {
      const centerX = (box.minX + box.maxX) * 0.5;
      const centerZ = (box.minZ + box.maxZ) * 0.5;
      const insideTown = centerX >= -140 && centerX <= 140 && centerZ >= 0 && centerZ <= 240;
      if (insideTown) {
        removed += 1;
        continue;
      }
      boxes[write] = box;
      write += 1;
    }
    boxes.length = write;
    return removed;
  }

  private buildReferenceLayout(): void {
    const road = makeMaterial(this.scene, "caelus-reference-road", "#303a37");
    const path = makeMaterial(this.scene, "caelus-reference-path", "#a5ab8b");
    const foundation = makeMaterial(this.scene, "caelus-reference-foundation", "#6a7166");
    const plasterWarm = makeMaterial(this.scene, "caelus-reference-plaster-warm", "#b2ad93");
    const plasterSage = makeMaterial(this.scene, "caelus-reference-plaster-sage", "#8fa094");
    const roofBlue = makeMaterial(this.scene, "caelus-reference-roof-blue", "#426779");
    const roofGreen = makeMaterial(this.scene, "caelus-reference-roof-green", "#57704e");
    const timber = makeMaterial(this.scene, "caelus-reference-timber", "#514238");
    const window = makeMaterial(this.scene, "caelus-reference-window", "#fff4b5", "#e8dd91");
    const wall = makeMaterial(this.scene, "caelus-reference-wall", "#6f7b78");
    const wallDark = makeMaterial(this.scene, "caelus-reference-wall-dark", "#495653");
    const wellStone = makeMaterial(this.scene, "caelus-reference-well-stone", "#747b72");
    const wellVoid = makeMaterial(this.scene, "caelus-reference-well-void", "#070a09");

    this.createStrip("caelus-reference-main-street-road-surface", { x: 0, z: 8 }, { x: 0, z: 234 }, MAIN_ROAD_HALF_WIDTH * 2, road, 0.075);

    for (const collectorZ of COLLECTOR_LEVELS) {
      this.createCollector(`left-${collectorZ}`, { x: -100, z: collectorZ }, { x: -MAIN_ROAD_HALF_WIDTH, z: collectorZ }, path);
      this.createCollector(`right-${collectorZ}`, { x: MAIN_ROAD_HALF_WIDTH, z: collectorZ }, { x: 100, z: collectorZ }, path);
    }

    for (const house of HOUSES) {
      this.createHouse(house, foundation, house.palette === "warm" ? plasterWarm : plasterSage, house.roof === "blue" ? roofBlue : roofGreen, timber, window);
      this.createHouseFrontage(house, path);
    }

    this.createWell(path, wellStone, timber, roofGreen, wellVoid);
    this.createPerimeterWalls(wall, wallDark);
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
    const normals: number[] = [];
    const indices = [0, 1, 2, 0, 2, 3];
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
    mesh.metadata = { referenceTown: true, cameraCollision: false };
    this.generated.push(mesh);
    return mesh;
  }

  private createCollector(id: string, start: Point2, end: Point2, material: any): void {
    this.createStrip(`caelus-reference-frontage-collector-${id}`, start, end, PATH_HALF_WIDTH * 2, material, 0.09);
    this.collectorRects.push(rect(`collector-${id}`, (start.x + end.x) / 2, (start.z + end.z) / 2, Math.abs(end.x - start.x), PATH_HALF_WIDTH * 2));
  }

  private createHouse(house: HouseSpec, foundationMaterial: any, wallMaterial: any, roofMaterial: any, timber: any, windowMaterial: any): void {
    const ground = this.world.heightAt(house.x, house.z);
    const foundation = BABYLON.MeshBuilder.CreateBox(`caelus-reference-house-${house.id}-foundation`, {
      width: house.width + 1.4,
      height: 0.55,
      depth: house.depth + 1.4
    }, this.scene);
    foundation.position = new BABYLON.Vector3(house.x, ground + 0.2, house.z);
    foundation.material = foundationMaterial;
    foundation.receiveShadows = true;
    foundation.metadata = { referenceTown: true };
    this.generated.push(foundation);

    const body = BABYLON.MeshBuilder.CreateBox(`caelus-reference-house-${house.id}-body`, {
      width: house.width,
      height: house.height,
      depth: house.depth
    }, this.scene);
    body.position = new BABYLON.Vector3(house.x, ground + 0.55 + house.height / 2, house.z);
    body.material = wallMaterial;
    body.receiveShadows = true;
    body.metadata = { referenceTown: true, buildingId: house.id, function: "home", cameraCollision: true };
    this.shadowGenerator?.addShadowCaster?.(body);
    this.generated.push(body);

    const band = BABYLON.MeshBuilder.CreateBox(`caelus-reference-house-${house.id}-band`, {
      width: house.width + 0.25,
      height: 1.0,
      depth: house.depth + 0.25
    }, this.scene);
    band.position = new BABYLON.Vector3(house.x, ground + 1.3, house.z);
    band.material = timber;
    this.generated.push(band);

    const roof = BABYLON.MeshBuilder.CreateCylinder(`caelus-reference-house-${house.id}-roof`, {
      height: 4.2,
      diameterTop: 0,
      diameterBottom: Math.max(house.width, house.depth) * 1.34,
      tessellation: 4
    }, this.scene);
    roof.position = new BABYLON.Vector3(house.x, ground + house.height + 2.5, house.z);
    roof.rotation.y = Math.PI / 4;
    roof.scaling.z = house.depth / house.width;
    roof.material = roofMaterial;
    roof.receiveShadows = true;
    this.shadowGenerator?.addShadowCaster?.(roof);
    this.generated.push(roof);

    const doorZ = house.z + (house.doorSide === "north" ? house.depth / 2 + 0.06 : -house.depth / 2 - 0.06);
    const door = BABYLON.MeshBuilder.CreateBox(`caelus-reference-house-${house.id}-door`, {
      width: 2.1,
      height: 3.5,
      depth: 0.24
    }, this.scene);
    door.position = new BABYLON.Vector3(house.x, ground + 2.1, doorZ);
    door.material = timber;
    this.generated.push(door);

    for (const side of [-1, 1]) {
      const window = BABYLON.MeshBuilder.CreateBox(`caelus-reference-house-${house.id}-window-${side}`, {
        width: 1.45,
        height: 1.45,
        depth: 0.18
      }, this.scene);
      window.position = new BABYLON.Vector3(house.x + side * house.width * 0.27, ground + 4.4, doorZ);
      window.material = windowMaterial;
      this.generated.push(window);
    }

    this.addCollision(house.x, house.z, house.width, house.depth, 0.45);
    this.houseRects.push(rect(house.id, house.x, house.z, house.width, house.depth));
  }

  private createHouseFrontage(house: HouseSpec, material: any): void {
    const houseEdge = house.doorSide === "north"
      ? house.z + house.depth / 2 + 0.7
      : house.z - house.depth / 2 - 0.7;
    const collectorEdge = house.doorSide === "north"
      ? house.collectorZ - PATH_HALF_WIDTH
      : house.collectorZ + PATH_HALF_WIDTH;
    const start = { x: house.x, z: Math.min(houseEdge, collectorEdge) };
    const end = { x: house.x, z: Math.max(houseEdge, collectorEdge) };
    const length = Math.max(0.25, end.z - start.z);
    const midpointZ = (start.z + end.z) / 2;
    this.createStrip(`caelus-reference-frontage-${house.id}`, start, end, PATH_HALF_WIDTH * 2, material, 0.095);
    this.frontageRects.push(rect(`frontage-${house.id}`, house.x, midpointZ, PATH_HALF_WIDTH * 2, length));
  }

  private createWell(pathMaterial: any, stone: any, timber: any, roof: any, voidMaterial: any): void {
    const ground = this.world.heightAt(WELL_POSITION.x, WELL_POSITION.z);
    const pathEnd = { x: WELL_POSITION.x, z: WELL_POSITION.z - 8.8 };
    this.createStrip("caelus-reference-frontage-well", { x: WELL_POSITION.x, z: 182 + PATH_HALF_WIDTH }, pathEnd, PATH_HALF_WIDTH * 2, pathMaterial, 0.095);
    this.frontageRects.push(rect("frontage-well", WELL_POSITION.x, (182 + PATH_HALF_WIDTH + pathEnd.z) / 2, PATH_HALF_WIDTH * 2, pathEnd.z - (182 + PATH_HALF_WIDTH)));

    const apron = BABYLON.MeshBuilder.CreateCylinder("caelus-reference-well-apron", {
      height: 0.22,
      diameter: 18,
      tessellation: 32
    }, this.scene);
    apron.position = new BABYLON.Vector3(WELL_POSITION.x, ground + 0.08, WELL_POSITION.z);
    apron.material = pathMaterial;
    apron.receiveShadows = true;
    apron.metadata = { referenceTown: true };
    this.generated.push(apron);

    const shaft = BABYLON.MeshBuilder.CreateCylinder("caelus-reference-well-dark-shaft", {
      height: 0.32,
      diameter: 6.2,
      tessellation: 32
    }, this.scene);
    shaft.position = new BABYLON.Vector3(WELL_POSITION.x, ground + 0.18, WELL_POSITION.z);
    shaft.material = voidMaterial;
    this.generated.push(shaft);

    for (let index = 0; index < 12; index += 1) {
      const angle = index / 12 * Math.PI * 2;
      const stoneBlock = BABYLON.MeshBuilder.CreateBox(`caelus-reference-well-stone-${index}`, {
        width: 2.1,
        height: 1.2,
        depth: 1.25
      }, this.scene);
      stoneBlock.position = new BABYLON.Vector3(
        WELL_POSITION.x + Math.sin(angle) * 4.15,
        ground + 0.72,
        WELL_POSITION.z + Math.cos(angle) * 4.15
      );
      stoneBlock.rotation.y = angle;
      stoneBlock.material = stone;
      stoneBlock.receiveShadows = true;
      this.generated.push(stoneBlock);
      this.addCollision(stoneBlock.position.x, stoneBlock.position.z, 2.0, 1.1, 0.05);
    }

    for (const side of [-1, 1]) {
      const post = BABYLON.MeshBuilder.CreateBox(`caelus-reference-well-post-${side}`, {
        width: 0.9,
        height: 7.2,
        depth: 0.9
      }, this.scene);
      post.position = new BABYLON.Vector3(WELL_POSITION.x + side * 4.8, ground + 3.8, WELL_POSITION.z);
      post.material = timber;
      this.generated.push(post);
    }
    const beam = BABYLON.MeshBuilder.CreateBox("caelus-reference-well-beam", { width: 10.5, height: 0.8, depth: 0.8 }, this.scene);
    beam.position = new BABYLON.Vector3(WELL_POSITION.x, ground + 7.1, WELL_POSITION.z);
    beam.material = timber;
    this.generated.push(beam);

    const canopy = BABYLON.MeshBuilder.CreateCylinder("caelus-reference-well-canopy", {
      height: 3.2,
      diameterTop: 0,
      diameterBottom: 13,
      tessellation: 4
    }, this.scene);
    canopy.position = new BABYLON.Vector3(WELL_POSITION.x, ground + 8.8, WELL_POSITION.z);
    canopy.rotation.y = Math.PI / 4;
    canopy.scaling.z = 0.65;
    canopy.material = roof;
    this.generated.push(canopy);
  }

  private createPerimeterWalls(wallMaterial: any, capMaterial: any): void {
    this.createWall("south-left", -63, SOUTH_WALL_Z, 106, 4, wallMaterial, capMaterial);
    this.createWall("south-right", 63, SOUTH_WALL_Z, 106, 4, wallMaterial, capMaterial);
    this.createWall("north-left", -63, NORTH_WALL_Z, 106, 4, wallMaterial, capMaterial);
    this.createWall("north-right", 63, NORTH_WALL_Z, 106, 4, wallMaterial, capMaterial);
    this.createWall("west", -WALL_X, (SOUTH_WALL_Z + NORTH_WALL_Z) / 2, 4, NORTH_WALL_Z - SOUTH_WALL_Z, wallMaterial, capMaterial);
    this.createWall("east", WALL_X, (SOUTH_WALL_Z + NORTH_WALL_Z) / 2, 4, NORTH_WALL_Z - SOUTH_WALL_Z, wallMaterial, capMaterial);

    const towers: Point2[] = [
      { x: -WALL_X, z: SOUTH_WALL_Z }, { x: WALL_X, z: SOUTH_WALL_Z },
      { x: -WALL_X, z: NORTH_WALL_Z }, { x: WALL_X, z: NORTH_WALL_Z },
      { x: -GATE_HALF_WIDTH, z: SOUTH_WALL_Z }, { x: GATE_HALF_WIDTH, z: SOUTH_WALL_Z },
      { x: -GATE_HALF_WIDTH, z: NORTH_WALL_Z }, { x: GATE_HALF_WIDTH, z: NORTH_WALL_Z }
    ];
    towers.forEach((point, index) => this.createTower(point.x, point.z, index, wallMaterial, capMaterial));
  }

  private createWall(id: string, x: number, z: number, width: number, depth: number, material: any, capMaterial: any): void {
    const ground = this.world.heightAt(x, z);
    const wall = BABYLON.MeshBuilder.CreateBox(`caelus-reference-wall-${id}`, { width, height: 9.5, depth }, this.scene);
    wall.position = new BABYLON.Vector3(x, ground + 4.75, z);
    wall.material = material;
    wall.receiveShadows = true;
    wall.metadata = { referenceTown: true, cameraCollision: true };
    this.shadowGenerator?.addShadowCaster?.(wall);
    this.generated.push(wall);

    const cap = BABYLON.MeshBuilder.CreateBox(`caelus-reference-wall-${id}-cap`, { width: width + 0.5, height: 0.65, depth: depth + 0.5 }, this.scene);
    cap.position = new BABYLON.Vector3(x, ground + 9.8, z);
    cap.material = capMaterial;
    this.generated.push(cap);

    const horizontal = width > depth;
    const span = horizontal ? width : depth;
    const merlonCount = Math.max(2, Math.floor(span / 5));
    for (let index = 0; index < merlonCount; index += 1) {
      const amount = merlonCount <= 1 ? 0.5 : index / (merlonCount - 1);
      const merlon = BABYLON.MeshBuilder.CreateBox(`caelus-reference-wall-${id}-merlon-${index}`, { width: 1.8, height: 1.35, depth: 1.8 }, this.scene);
      merlon.position = new BABYLON.Vector3(
        horizontal ? x - span / 2 + 2.4 + amount * (span - 4.8) : x,
        ground + 10.7,
        horizontal ? z : z - span / 2 + 2.4 + amount * (span - 4.8)
      );
      merlon.material = material;
      this.generated.push(merlon);
    }

    this.addCollision(x, z, width, depth, 0);
    this.wallRects.push(rect(`wall-${id}`, x, z, width, depth));
  }

  private createTower(x: number, z: number, index: number, material: any, capMaterial: any): void {
    const ground = this.world.heightAt(x, z);
    const tower = BABYLON.MeshBuilder.CreateCylinder(`caelus-reference-gate-tower-${index}`, {
      height: 14,
      diameterTop: 9.5,
      diameterBottom: 11,
      tessellation: 10
    }, this.scene);
    tower.position = new BABYLON.Vector3(x, ground + 7, z);
    tower.material = material;
    tower.receiveShadows = true;
    tower.metadata = { referenceTown: true, cameraCollision: true };
    this.shadowGenerator?.addShadowCaster?.(tower);
    this.generated.push(tower);

    const roof = BABYLON.MeshBuilder.CreateCylinder(`caelus-reference-gate-tower-roof-${index}`, {
      height: 4.2,
      diameterTop: 0,
      diameterBottom: 13,
      tessellation: 10
    }, this.scene);
    roof.position = new BABYLON.Vector3(x, ground + 16, z);
    roof.material = capMaterial;
    this.generated.push(roof);
    this.addCollision(x, z, 9.5, 9.5, 0.15);
  }

  private addCollision(x: number, z: number, width: number, depth: number, inset: number): void {
    const boxes = (this.world as any).collisionBoxes as CollisionBox[];
    if (!Array.isArray(boxes)) return;
    boxes.push({
      minX: x - width / 2 + inset,
      maxX: x + width / 2 - inset,
      minZ: z - depth / 2 + inset,
      maxZ: z + depth / 2 - inset
    });
  }

  private repositionMara(): void {
    const mara = this.world.mara?.root;
    if (!mara) return;
    mara.position.x = -8;
    mara.position.z = 31;
    mara.position.y = this.world.heightAt(-8, 31) + 0.31;
    mara.rotation.y = 0.2;
  }

  private createAudit(retiredMeshes: number, removedCollisionVolumes: number): ReferenceTownAudit {
    const mainRoad = rect("main-road", 0, 121, MAIN_ROAD_HALF_WIDTH * 2, 226);
    const houseRoadIntersections = this.houseRects.filter((house) => intersects(house, mainRoad, 0.25)).map((house) => house.id);
    const houseCollectorIntersections = this.houseRects.flatMap((house) => (
      this.collectorRects.filter((collector) => intersects(house, collector, 0.3)).map((collector) => `${house.id}:${collector.id}`)
    ));
    const houseWallIntersections = this.houseRects.flatMap((house) => (
      this.wallRects.filter((wall) => intersects(house, wall, 0.2)).map((wall) => `${house.id}:${wall.id}`)
    ));
    const houseHouseIntersections: string[] = [];
    let minimumHouseSpacing = Number.POSITIVE_INFINITY;
    for (let left = 0; left < this.houseRects.length; left += 1) {
      for (let right = left + 1; right < this.houseRects.length; right += 1) {
        const a = this.houseRects[left];
        const b = this.houseRects[right];
        if (intersects(a, b, 0.1)) houseHouseIntersections.push(`${a.id}:${b.id}`);
        const gapX = Math.max(0, Math.max(a.minX, b.minX) - Math.min(a.maxX, b.maxX));
        const gapZ = Math.max(0, Math.max(a.minZ, b.minZ) - Math.min(a.maxZ, b.maxZ));
        minimumHouseSpacing = Math.min(minimumHouseSpacing, Math.hypot(gapX, gapZ));
      }
    }

    const minimumWallClearance = Math.min(...this.houseRects.map((house) => Math.min(
      house.minX - (-WALL_X + 2),
      (WALL_X - 2) - house.maxX,
      house.minZ - (SOUTH_WALL_Z + 2),
      (NORTH_WALL_Z - 2) - house.maxZ
    )));

    const boxes = (this.world as any).collisionBoxes as CollisionBox[];
    let blockedMainRouteSamples = 0;
    for (let z = 20; z <= 222; z += 2) {
      const blocked = boxes.some((box) => 0 > box.minX && 0 < box.maxX && z > box.minZ && z < box.maxZ);
      if (blocked) blockedMainRouteSamples += 1;
    }

    const pass = houseRoadIntersections.length === 0
      && houseCollectorIntersections.length === 0
      && houseWallIntersections.length === 0
      && houseHouseIntersections.length === 0
      && blockedMainRouteSamples === 0
      && minimumWallClearance >= 12
      && HOUSES.length === 20;

    return {
      version: 1,
      milestone: "Set 1 / Milestone 1.4 — Approved Reference Layout",
      retiredMeshes,
      removedCollisionVolumes,
      houseCount: HOUSES.length,
      mainRoadCount: 1,
      collectorPathCount: COLLECTOR_LEVELS.length * 2,
      frontagePathCount: HOUSES.length + 1,
      wallSegmentCount: 6,
      towerCount: 8,
      gateOpeningCount: 2,
      wellPosition: { ...WELL_POSITION },
      townCenterPresent: false,
      houseRoadIntersections,
      houseCollectorIntersections,
      houseWallIntersections,
      houseHouseIntersections,
      blockedMainRouteSamples,
      minimumWallClearance: round(minimumWallClearance),
      minimumHouseSpacing: round(minimumHouseSpacing),
      pass
    };
  }

  private installPlaytestApi(): void {
    const bridge = (globalThis as any).__ASCENSION_PLAYTEST__;
    if (!bridge) return;
    bridge.referenceTownAudit = () => JSON.parse(JSON.stringify(this.audit));
    bridge.referenceTownMeshes = () => this.generated.filter((mesh) => mesh.isEnabled?.()).map((mesh) => String(mesh.name));
  }
}
