import { createMara, createMaterial } from "../world/ProceduralAssets.js";

interface TownPoint {
  x: number;
  z: number;
}

interface BuildingSpec {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  wallHeight: number;
  gableHeight: number;
  yaw: number;
  wallPalette: "warm" | "sage";
  roofPalette: "blue" | "green";
  function: "home" | "merchant" | "guild" | "workshop" | "storehouse" | "outfitter";
  windows: number;
  chimney?: boolean;
}

interface MeshBuffers {
  positions: number[];
  indices: number[];
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const smooth = (value: number): number => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount;

const transformLocal = (x: number, z: number, localX: number, localZ: number, yaw: number): TownPoint => ({
  x: x + localX * Math.cos(yaw) + localZ * Math.sin(yaw),
  z: z - localX * Math.sin(yaw) + localZ * Math.cos(yaw)
});

const createAuthoredMesh = (
  scene: any,
  name: string,
  buffers: MeshBuffers,
  material: any
): any => {
  const normals: number[] = [];
  BABYLON.VertexData.ComputeNormals(buffers.positions, buffers.indices, normals);
  const data = new BABYLON.VertexData();
  data.positions = buffers.positions;
  data.indices = buffers.indices;
  data.normals = normals;
  const mesh = new BABYLON.Mesh(name, scene);
  data.applyToMesh(mesh);
  mesh.material = material;
  mesh.isPickable = false;
  return mesh;
};

const createChamferedBlock = (
  scene: any,
  name: string,
  width: number,
  height: number,
  depth: number,
  chamfer: number,
  material: any
): any => {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const halfDepth = depth / 2;
  const cut = Math.min(chamfer, halfWidth * 0.4, halfDepth * 0.4);
  const perimeter: Array<[number, number]> = [
    [-halfWidth + cut, -halfDepth],
    [halfWidth - cut, -halfDepth],
    [halfWidth, -halfDepth + cut],
    [halfWidth, halfDepth - cut],
    [halfWidth - cut, halfDepth],
    [-halfWidth + cut, halfDepth],
    [-halfWidth, halfDepth - cut],
    [-halfWidth, -halfDepth + cut]
  ];
  const positions: number[] = [];
  perimeter.forEach(([x, z]) => positions.push(x, -halfHeight, z));
  perimeter.forEach(([x, z]) => positions.push(x, halfHeight, z));
  positions.push(0, -halfHeight, 0, 0, halfHeight, 0);
  const bottomCenter = 16;
  const topCenter = 17;
  const indices: number[] = [];
  for (let index = 0; index < perimeter.length; index += 1) {
    const next = (index + 1) % perimeter.length;
    indices.push(bottomCenter, next, index);
    indices.push(topCenter, 8 + index, 8 + next);
    indices.push(index, next, 8 + next, index, 8 + next, 8 + index);
  }
  return createAuthoredMesh(scene, name, { positions, indices }, material);
};

const createGabledBody = (
  scene: any,
  name: string,
  width: number,
  wallHeight: number,
  gableHeight: number,
  depth: number,
  material: any
): any => {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const section: Array<[number, number]> = [
    [-halfWidth, 0],
    [halfWidth, 0],
    [halfWidth, wallHeight],
    [0, wallHeight + gableHeight],
    [-halfWidth, wallHeight]
  ];
  const positions: number[] = [];
  section.forEach(([x, y]) => positions.push(x, y, -halfDepth));
  section.forEach(([x, y]) => positions.push(x, y, halfDepth));
  const indices = [
    0, 1, 2, 0, 2, 4, 2, 3, 4,
    5, 7, 6, 5, 9, 7, 7, 9, 8
  ];
  for (let index = 0; index < section.length; index += 1) {
    const next = (index + 1) % section.length;
    indices.push(index, next, 5 + next, index, 5 + next, 5 + index);
  }
  return createAuthoredMesh(scene, name, { positions, indices }, material);
};

const createPitchedRoof = (
  scene: any,
  name: string,
  width: number,
  depth: number,
  gableHeight: number,
  overhang: number,
  material: any
): any => {
  const halfWidth = width / 2 + overhang;
  const halfDepth = depth / 2 + overhang;
  const positions = [
    -halfWidth, 0, -halfDepth,
    halfWidth, 0, -halfDepth,
    0, gableHeight + overhang * 0.25, -halfDepth,
    -halfWidth, 0, halfDepth,
    halfWidth, 0, halfDepth,
    0, gableHeight + overhang * 0.25, halfDepth
  ];
  const indices = [
    0, 1, 2,
    3, 5, 4,
    0, 3, 4, 0, 4, 1,
    1, 4, 5, 1, 5, 2,
    2, 5, 3, 2, 3, 0
  ];
  return createAuthoredMesh(scene, name, { positions, indices }, material);
};

const createDisc = (
  scene: any,
  name: string,
  radius: number,
  segments: number,
  material: any
): any => {
  const positions = [0, 0, 0];
  const indices: number[] = [];
  for (let index = 0; index < segments; index += 1) {
    const angle = index / segments * Math.PI * 2;
    positions.push(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
  }
  for (let index = 0; index < segments; index += 1) {
    const current = 1 + index;
    const next = 1 + (index + 1) % segments;
    indices.push(0, current, next);
  }
  return createAuthoredMesh(scene, name, { positions, indices }, material);
};

const createOctahedron = (scene: any, name: string, radius: number, material: any): any => {
  const positions = [
    0, radius, 0,
    radius, 0, 0,
    0, 0, radius,
    -radius, 0, 0,
    0, 0, -radius,
    0, -radius, 0
  ];
  const indices = [
    0, 2, 1, 0, 3, 2, 0, 4, 3, 0, 1, 4,
    5, 1, 2, 5, 2, 3, 5, 3, 4, 5, 4, 1
  ];
  return createAuthoredMesh(scene, name, { positions, indices }, material);
};

const hardenMaterial = (material: any): any => {
  material.alpha = 1;
  material.transparencyMode = 0;
  material.forceDepthWrite = true;
  material.useAlphaFromAlbedoTexture = false;
  material.backFaceCulling = false;
  return material;
};

const addCollisionForYaw = (
  director: any,
  x: number,
  z: number,
  width: number,
  depth: number,
  yaw: number,
  inset = 0.65
): void => {
  const cosine = Math.abs(Math.cos(yaw));
  const sine = Math.abs(Math.sin(yaw));
  const boundsWidth = cosine * width + sine * depth;
  const boundsDepth = sine * width + cosine * depth;
  director.addCollisionBox(x, z, boundsWidth, boundsDepth, inset);
};

const BUILDINGS: BuildingSpec[] = [
  { id: "gate-cottage-west", x: -34, z: 43, width: 16, depth: 14, wallHeight: 8.6, gableHeight: 3.8, yaw: 0.17, wallPalette: "warm", roofPalette: "blue", function: "home", windows: 2, chimney: true },
  { id: "gate-cottage-east", x: 31, z: 47, width: 15, depth: 13, wallHeight: 8.2, gableHeight: 3.5, yaw: -0.21, wallPalette: "sage", roofPalette: "green", function: "home", windows: 2 },
  { id: "main-merchant-west", x: -27, z: 69, width: 18, depth: 15, wallHeight: 10.2, gableHeight: 4.2, yaw: 0.11, wallPalette: "sage", roofPalette: "blue", function: "merchant", windows: 3, chimney: true },
  { id: "main-workshop-east", x: 34, z: 73, width: 20, depth: 16, wallHeight: 9.3, gableHeight: 3.9, yaw: -0.2, wallPalette: "warm", roofPalette: "green", function: "workshop", windows: 2, chimney: true },
  { id: "market-house-west", x: -59, z: 91, width: 16, depth: 14, wallHeight: 8.4, gableHeight: 3.5, yaw: 0.34, wallPalette: "warm", roofPalette: "green", function: "home", windows: 2 },
  { id: "market-merchant-north", x: -52, z: 121, width: 21, depth: 16, wallHeight: 10.8, gableHeight: 4.6, yaw: 0.58, wallPalette: "sage", roofPalette: "blue", function: "merchant", windows: 4, chimney: true },
  { id: "market-storehouse", x: -66, z: 146, width: 22, depth: 17, wallHeight: 8.5, gableHeight: 3.2, yaw: 0.28, wallPalette: "warm", roofPalette: "green", function: "storehouse", windows: 1 },
  { id: "market-corner-home", x: -38, z: 155, width: 15, depth: 13, wallHeight: 9.2, gableHeight: 3.7, yaw: -0.19, wallPalette: "sage", roofPalette: "blue", function: "home", windows: 3 },
  { id: "guild-hall", x: 48, z: 125, width: 25, depth: 19, wallHeight: 13.2, gableHeight: 5.4, yaw: -0.38, wallPalette: "warm", roofPalette: "blue", function: "guild", windows: 5, chimney: true },
  { id: "guild-annex", x: 66, z: 151, width: 17, depth: 14, wallHeight: 9.1, gableHeight: 3.8, yaw: -0.08, wallPalette: "sage", roofPalette: "green", function: "workshop", windows: 2 },
  { id: "service-store", x: 78, z: 93, width: 20, depth: 16, wallHeight: 8.7, gableHeight: 3.3, yaw: -0.48, wallPalette: "warm", roofPalette: "green", function: "storehouse", windows: 1 },
  { id: "service-cottage", x: 88, z: 124, width: 15, depth: 13, wallHeight: 8.2, gableHeight: 3.4, yaw: -0.19, wallPalette: "sage", roofPalette: "blue", function: "home", windows: 2 },
  { id: "residence-west-a", x: -82, z: 174, width: 16, depth: 14, wallHeight: 8.9, gableHeight: 3.8, yaw: 0.44, wallPalette: "warm", roofPalette: "blue", function: "home", windows: 3, chimney: true },
  { id: "residence-west-b", x: -54, z: 188, width: 14, depth: 12, wallHeight: 8.1, gableHeight: 3.2, yaw: 0.12, wallPalette: "sage", roofPalette: "green", function: "home", windows: 2 },
  { id: "residence-east-a", x: 71, z: 181, width: 17, depth: 14, wallHeight: 9.4, gableHeight: 3.8, yaw: -0.31, wallPalette: "sage", roofPalette: "blue", function: "home", windows: 3 },
  { id: "supply-house", x: 31, z: 184, width: 21, depth: 16, wallHeight: 10.1, gableHeight: 4.4, yaw: -0.12, wallPalette: "warm", roofPalette: "green", function: "outfitter", windows: 4, chimney: true },
  { id: "north-home", x: -24, z: 188, width: 15, depth: 13, wallHeight: 8.7, gableHeight: 3.5, yaw: 0.09, wallPalette: "sage", roofPalette: "blue", function: "home", windows: 2 },
  { id: "north-workshop", x: 93, z: 166, width: 19, depth: 15, wallHeight: 8.9, gableHeight: 3.7, yaw: -0.51, wallPalette: "warm", roofPalette: "green", function: "workshop", windows: 2, chimney: true }
];

const buildAuthoredTown = function buildAuthoredTown(this: any): void {
  for (const mesh of this.scene.meshes) {
    const name = String(mesh.name ?? "");
    if (name.startsWith("city-lantern-")) mesh.setEnabled(false);
  }

  const road = hardenMaterial(createMaterial(this.scene, "caelus-phase1-road", "#4d5148", 0.97, 0.01));
  const roadEdge = hardenMaterial(createMaterial(this.scene, "caelus-phase1-road-edge", "#70705e", 0.95, 0.01));
  const plaza = hardenMaterial(createMaterial(this.scene, "caelus-phase1-plaza", "#5b625a", 0.93, 0.02));
  const foundation = hardenMaterial(createMaterial(this.scene, "caelus-phase1-foundation", "#45504c", 0.92, 0.04));
  const plasterWarm = hardenMaterial(createMaterial(this.scene, "caelus-phase1-plaster-warm", "#8d846f", 0.96, 0.01));
  const plasterSage = hardenMaterial(createMaterial(this.scene, "caelus-phase1-plaster-sage", "#687a6c", 0.96, 0.01));
  const timber = hardenMaterial(createMaterial(this.scene, "caelus-phase1-timber", "#47372d", 0.93, 0.02));
  const roofBlue = hardenMaterial(createMaterial(this.scene, "caelus-phase1-roof-blue", "#2b5060", 0.86, 0.1));
  const roofGreen = hardenMaterial(createMaterial(this.scene, "caelus-phase1-roof-green", "#425c43", 0.9, 0.05));
  const doorMaterial = hardenMaterial(createMaterial(this.scene, "caelus-phase1-door", "#34271f", 0.9, 0.03));
  const windowMaterial = hardenMaterial(createMaterial(this.scene, "caelus-phase1-window", "#d4e6b4", 0.34, 0.02, "#507752"));
  const marketCloth = hardenMaterial(createMaterial(this.scene, "caelus-phase1-market-cloth", "#845346", 0.9, 0.01));
  const lanternGlow = hardenMaterial(createMaterial(this.scene, "caelus-phase1-lantern-glow", "#c8fff0", 0.18, 0.03, "#42cfae"));

  const mainStreet = this.sampleCatmullRom([
    { x: 0, z: 23 },
    { x: -2, z: 49 },
    { x: 5, z: 77 },
    { x: -3, z: 105 },
    { x: 6, z: 136 },
    { x: -1, z: 166 },
    { x: 0, z: 200 }
  ], 12);
  const marketLane = this.sampleCatmullRom([
    { x: 1, z: 86 },
    { x: -19, z: 94 },
    { x: -39, z: 108 },
    { x: -46, z: 126 },
    { x: -35, z: 143 },
    { x: -8, z: 149 }
  ], 10);
  const guildLane = this.sampleCatmullRom([
    { x: -1, z: 101 },
    { x: 18, z: 106 },
    { x: 38, z: 118 },
    { x: 47, z: 137 },
    { x: 31, z: 155 },
    { x: 4, z: 161 }
  ], 10);
  const residentialLoop = this.sampleCatmullRom([
    { x: -5, z: 151 },
    { x: -31, z: 163 },
    { x: -61, z: 174 },
    { x: -74, z: 192 },
    { x: -42, z: 201 },
    { x: -5, z: 194 }
  ], 8);
  const serviceLane = this.sampleCatmullRom([
    { x: 4, z: 73 },
    { x: 30, z: 83 },
    { x: 61, z: 93 },
    { x: 83, z: 111 },
    { x: 68, z: 137 },
    { x: 45, z: 151 }
  ], 8);

  this.createTerrainRibbon("caelus-phase1-main-street-edge", mainStreet, 8.1, roadEdge, 0.045);
  this.createTerrainRibbon("caelus-phase1-main-street", mainStreet, 6.2, road, 0.07);
  this.createTerrainRibbon("caelus-phase1-market-lane-edge", marketLane, 5.1, roadEdge, 0.04);
  this.createTerrainRibbon("caelus-phase1-market-lane", marketLane, 3.8, road, 0.065);
  this.createTerrainRibbon("caelus-phase1-guild-lane-edge", guildLane, 5.1, roadEdge, 0.04);
  this.createTerrainRibbon("caelus-phase1-guild-lane", guildLane, 3.8, road, 0.065);
  this.createTerrainRibbon("caelus-phase1-residential-loop-edge", residentialLoop, 4.4, roadEdge, 0.04);
  this.createTerrainRibbon("caelus-phase1-residential-loop", residentialLoop, 3.2, road, 0.065);
  this.createTerrainRibbon("caelus-phase1-service-lane-edge", serviceLane, 4.4, roadEdge, 0.04);
  this.createTerrainRibbon("caelus-phase1-service-lane", serviceLane, 3.1, road, 0.065);

  const townCenter = createDisc(this.scene, "caelus-phase1-town-center", 18.5, 28, plaza);
  townCenter.position.set(-3, this.world.heightAt(-3, 112) + 0.09, 112);
  townCenter.receiveShadows = true;
  townCenter.freezeWorldMatrix();
  const marketSquare = createDisc(this.scene, "caelus-phase1-market-square", 14.5, 24, plaza);
  marketSquare.position.set(-35, this.world.heightAt(-35, 119) + 0.095, 119);
  marketSquare.receiveShadows = true;
  marketSquare.freezeWorldMatrix();
  const guildCourt = createDisc(this.scene, "caelus-phase1-guild-court", 12.5, 22, plaza);
  guildCourt.position.set(35, this.world.heightAt(35, 130) + 0.095, 130);
  guildCourt.receiveShadows = true;
  guildCourt.freezeWorldMatrix();

  const bodiesWarm: any[] = [];
  const bodiesSage: any[] = [];
  const foundations: any[] = [];
  const roofsBlue: any[] = [];
  const roofsGreen: any[] = [];
  const doors: any[] = [];
  const windows: any[] = [];
  const trims: any[] = [];
  const chimneys: any[] = [];

  for (const spec of BUILDINGS) {
    const ground = this.world.heightAt(spec.x, spec.z);
    const base = createChamferedBlock(
      this.scene,
      `caelus-phase1-${spec.id}-foundation`,
      spec.width + 1.15,
      0.75,
      spec.depth + 1.15,
      0.55,
      foundation
    );
    base.position.set(spec.x, ground + 0.34, spec.z);
    base.rotation.y = spec.yaw;
    foundations.push(base);

    const body = createGabledBody(
      this.scene,
      `caelus-phase1-${spec.id}-body`,
      spec.width,
      spec.wallHeight,
      spec.gableHeight,
      spec.depth,
      spec.wallPalette === "warm" ? plasterWarm : plasterSage
    );
    body.position.set(spec.x, ground + 0.72, spec.z);
    body.rotation.y = spec.yaw;
    body.receiveShadows = true;
    (spec.wallPalette === "warm" ? bodiesWarm : bodiesSage).push(body);

    const roof = createPitchedRoof(
      this.scene,
      `caelus-phase1-${spec.id}-roof`,
      spec.width,
      spec.depth,
      spec.gableHeight,
      0.75,
      spec.roofPalette === "blue" ? roofBlue : roofGreen
    );
    roof.position.set(spec.x, ground + 0.72 + spec.wallHeight, spec.z);
    roof.rotation.y = spec.yaw;
    roof.receiveShadows = true;
    (spec.roofPalette === "blue" ? roofsBlue : roofsGreen).push(roof);

    const doorPoint = transformLocal(spec.x, spec.z, 0, -spec.depth / 2 - 0.11, spec.yaw);
    const door = createChamferedBlock(
      this.scene,
      `caelus-phase1-${spec.id}-door`,
      Math.min(2.25, spec.width * 0.16),
      spec.function === "guild" ? 3.7 : 3.05,
      0.24,
      0.1,
      doorMaterial
    );
    door.position.set(doorPoint.x, ground + 0.72 + (spec.function === "guild" ? 1.85 : 1.52), doorPoint.z);
    door.rotation.y = spec.yaw;
    doors.push(door);

    const windowCount = Math.max(1, spec.windows);
    for (let index = 0; index < windowCount; index += 1) {
      const row = index >= 3 ? 1 : 0;
      const inRow = row === 0 ? Math.min(index, 2) : index - 3;
      const countInRow = row === 0 ? Math.min(windowCount, 3) : Math.max(1, windowCount - 3);
      const spacing = Math.min(3.2, spec.width / Math.max(3, countInRow + 1));
      const localX = (inRow - (countInRow - 1) / 2) * spacing;
      if (Math.abs(localX) < 0.8 && row === 0) continue;
      const windowPoint = transformLocal(spec.x, spec.z, localX, -spec.depth / 2 - 0.14, spec.yaw);
      const window = createChamferedBlock(
        this.scene,
        `caelus-phase1-${spec.id}-window-${index}`,
        1.2,
        1.45,
        0.18,
        0.12,
        windowMaterial
      );
      window.position.set(windowPoint.x, ground + 0.72 + 4.15 + row * 2.35, windowPoint.z);
      window.rotation.y = spec.yaw;
      windows.push(window);
    }

    if (spec.function === "merchant" || spec.function === "guild" || spec.function === "outfitter") {
      const signPoint = transformLocal(spec.x, spec.z, spec.width * 0.28, -spec.depth / 2 - 0.48, spec.yaw);
      const signPost = createChamferedBlock(
        this.scene,
        `caelus-phase1-${spec.id}-sign-post`,
        0.26,
        2.8,
        0.26,
        0.07,
        timber
      );
      signPost.position.set(signPoint.x, ground + 2.45, signPoint.z);
      signPost.rotation.y = spec.yaw;
      trims.push(signPost);
      const sign = createChamferedBlock(
        this.scene,
        `caelus-phase1-${spec.id}-sign`,
        2.1,
        1.05,
        0.24,
        0.14,
        timber
      );
      sign.position.set(signPoint.x, ground + 3.65, signPoint.z);
      sign.rotation.y = spec.yaw;
      trims.push(sign);
    }

    if (spec.chimney) {
      const chimneyPoint = transformLocal(spec.x, spec.z, spec.width * 0.22, spec.depth * 0.13, spec.yaw);
      const chimney = createChamferedBlock(
        this.scene,
        `caelus-phase1-${spec.id}-chimney`,
        1.25,
        4.1,
        1.25,
        0.22,
        timber
      );
      chimney.position.set(chimneyPoint.x, ground + spec.wallHeight + spec.gableHeight + 1.1, chimneyPoint.z);
      chimney.rotation.y = spec.yaw;
      chimneys.push(chimney);
    }

    addCollisionForYaw(this, spec.x, spec.z, spec.width, spec.depth, spec.yaw);
  }

  this.mergeStatic({ name: "caelus-phase1-buildings-warm", meshes: bodiesWarm, receiveShadows: true, cameraCollision: true });
  this.mergeStatic({ name: "caelus-phase1-buildings-sage", meshes: bodiesSage, receiveShadows: true, cameraCollision: true });
  this.mergeStatic({ name: "caelus-phase1-foundations", meshes: foundations, receiveShadows: true });
  this.mergeStatic({ name: "caelus-phase1-roofs-blue", meshes: roofsBlue, receiveShadows: true });
  this.mergeStatic({ name: "caelus-phase1-roofs-green", meshes: roofsGreen, receiveShadows: true });
  this.mergeStatic({ name: "caelus-phase1-doors", meshes: doors, receiveShadows: false });
  this.mergeStatic({ name: "caelus-phase1-windows", meshes: windows, receiveShadows: false, glow: true });
  this.mergeStatic({ name: "caelus-phase1-signage", meshes: trims, receiveShadows: true });
  this.mergeStatic({ name: "caelus-phase1-chimneys", meshes: chimneys, receiveShadows: true });

  const marketWood: any[] = [];
  const marketRoofs: any[] = [];
  const marketSheds = [
    { id: "produce", x: -34, z: 103, yaw: -0.08, cloth: marketCloth },
    { id: "provisions", x: -46, z: 129, yaw: 0.34, cloth: roofGreen }
  ];
  for (const shed of marketSheds) {
    const ground = this.world.heightAt(shed.x, shed.z);
    const width = 8.4;
    const depth = 5.4;
    for (const localX of [-width / 2 + 0.45, width / 2 - 0.45]) {
      for (const localZ of [-depth / 2 + 0.35, depth / 2 - 0.35]) {
        const point = transformLocal(shed.x, shed.z, localX, localZ, shed.yaw);
        const post = createChamferedBlock(
          this.scene,
          `caelus-phase1-market-${shed.id}-post-${localX}-${localZ}`,
          0.32,
          3.25,
          0.32,
          0.08,
          timber
        );
        post.position.set(point.x, ground + 1.63, point.z);
        post.rotation.y = shed.yaw;
        marketWood.push(post);
      }
    }
    const counterPoint = transformLocal(shed.x, shed.z, 0, -depth * 0.22, shed.yaw);
    const counter = createChamferedBlock(
      this.scene,
      `caelus-phase1-market-${shed.id}-counter`,
      width - 1,
      0.72,
      1.25,
      0.18,
      timber
    );
    counter.position.set(counterPoint.x, ground + 1.05, counterPoint.z);
    counter.rotation.y = shed.yaw;
    marketWood.push(counter);
    const roof = createPitchedRoof(
      this.scene,
      `caelus-phase1-market-${shed.id}-roof`,
      width,
      depth,
      1.2,
      0.55,
      shed.cloth
    );
    roof.position.set(shed.x, ground + 3.15, shed.z);
    roof.rotation.y = shed.yaw;
    marketRoofs.push(roof);
    addCollisionForYaw(this, shed.x, shed.z, width, 1.4, shed.yaw, 0.25);
  }
  this.mergeStatic({ name: "caelus-phase1-market-wood", meshes: marketWood, receiveShadows: true });
  this.mergeStatic({ name: "caelus-phase1-market-roofs", meshes: marketRoofs, receiveShadows: false });

  const wellStones: any[] = [];
  const wellX = -3;
  const wellZ = 112;
  const wellGround = this.world.heightAt(wellX, wellZ);
  for (let index = 0; index < 12; index += 1) {
    const angle = index / 12 * Math.PI * 2;
    const stone = createChamferedBlock(
      this.scene,
      `caelus-phase1-well-stone-${index}`,
      1.55,
      0.9,
      0.85,
      0.2,
      foundation
    );
    stone.position.set(wellX + Math.sin(angle) * 3.2, wellGround + 0.48, wellZ + Math.cos(angle) * 3.2);
    stone.rotation.y = angle;
    wellStones.push(stone);
  }
  const wellBeam = createChamferedBlock(this.scene, "caelus-phase1-well-beam", 6.8, 0.42, 0.42, 0.1, timber);
  wellBeam.position.set(wellX, wellGround + 3.8, wellZ);
  wellStones.push(wellBeam);
  for (const side of [-1, 1]) {
    const post = createChamferedBlock(this.scene, `caelus-phase1-well-post-${side}`, 0.45, 5.9, 0.45, 0.11, timber);
    post.position.set(wellX + side * 2.85, wellGround + 2.95, wellZ);
    wellStones.push(post);
  }
  this.mergeStatic({ name: "caelus-phase1-town-well", meshes: wellStones, receiveShadows: true });
  this.addCollisionBox(wellX, wellZ, 7.3, 7.3, 0.4);

  const lanternPoles: any[] = [];
  const lanternRunes: any[] = [];
  const lanterns = [
    [-9, 42], [8, 62], [-9, 82], [7, 101], [-13, 127], [12, 145], [-10, 169], [8, 190],
    [-25, 101], [-45, 117], [24, 112], [43, 141]
  ];
  lanterns.forEach(([x, z], index) => {
    const ground = this.world.heightAt(x, z);
    const pole = createChamferedBlock(this.scene, `caelus-phase1-lantern-pole-${index}`, 0.34, 4.7, 0.34, 0.08, timber);
    pole.position.set(x, ground + 2.35, z);
    lanternPoles.push(pole);
    const rune = createOctahedron(this.scene, `caelus-phase1-lantern-rune-${index}`, 0.5, lanternGlow);
    rune.position.set(x, ground + 5.15, z);
    lanternRunes.push(rune);
  });
  this.mergeStatic({ name: "caelus-phase1-lantern-poles", meshes: lanternPoles, receiveShadows: false });
  this.mergeStatic({ name: "caelus-phase1-lantern-runes", meshes: lanternRunes, receiveShadows: false, glow: true });

  this.buildGatehouse(road, foundation, roofBlue, roofGreen, windowMaterial);

  this.scene.metadata = {
    ...(this.scene.metadata ?? {}),
    caelusTownPhaseOneVersion: 1,
    caelusTownDistricts: {
      gate: { x: 0, z: 25 },
      mainStreet: { x: 0, z: 82 },
      townCenter: { x: -3, z: 112 },
      market: { x: -35, z: 119 },
      guild: { x: 35, z: 130 },
      residential: { x: -61, z: 174 },
      service: { x: 72, z: 111 },
      supply: { x: 25, z: 184 }
    },
    caelusTownBuildingCount: BUILDINGS.length
  };
};

const buildOrganicCitizens = function buildOrganicCitizens(this: any): void {
  const definitions = [
    { color: "#526c82", scale: 0.78, route: [[-7, 43], [4, 78], [-6, 111], [8, 147], [-4, 184]], speed: 1.02 },
    { color: "#7b5945", scale: 0.84, route: [[-10, 99], [-34, 108], [-44, 127], [-28, 143], [-5, 149]], speed: 0.78 },
    { color: "#4f704d", scale: 0.89, route: [[5, 103], [27, 111], [43, 132], [29, 151], [4, 160]], speed: 0.9 },
    { color: "#765675", scale: 0.75, route: [[-6, 154], [-35, 166], [-67, 184], [-41, 199], [-7, 191]], speed: 0.72 },
    { color: "#6e7352", scale: 0.92, route: [[4, 76], [35, 86], [72, 103], [64, 133], [42, 149]], speed: 0.83 }
  ];
  definitions.forEach((definition, index) => {
    const visual = createMara(this.scene);
    visual.root.name = `caelus-phase1-citizen-${index}`;
    visual.root.scaling.setAll(definition.scale);
    visual.cape.material = createMaterial(
      this.scene,
      `caelus-phase1-citizen-cape-${index}`,
      definition.color,
      0.92,
      0.02
    );
    const route = definition.route.map(([x, z]) => new BABYLON.Vector3(
      x,
      this.world.heightAt(x, z),
      z
    ));
    visual.root.position.copyFrom(route[0]);
    visual.root.getChildMeshes().forEach((mesh: any) => this.world.shadowGenerator.addShadowCaster(mesh));
    this.citizens.push({
      visual,
      route,
      routeIndex: 1,
      speed: definition.speed,
      phase: index * 1.17
    });
  });
};

export const installCaelusTownPhaseOne = (DirectorClass: any): void => {
  const prototype = DirectorClass.prototype as any;
  if (prototype.__caelusTownPhaseOneInstalled) return;

  prototype.sculptedHeightAt = function phaseOneHeightAt(this: any, x: number, z: number): number {
    const original = this.originalHeightAt(x, z);
    let height = original;

    const townLongitudinal = smooth((z - 12) / 18) * (1 - smooth((z - 205) / 18));
    const townLateral = 1 - smooth((Math.abs(x) - 105) / 35);
    const townBlend = clamp01(townLongitudinal * townLateral);
    if (townBlend > 0) {
      const gateBase = this.originalHeightAt(0, 26);
      const centerTier = smooth((z - 82) / 35) * 0.72;
      const northTier = smooth((z - 154) / 28) * 0.58;
      const controlledVariation = Math.sin(x * 0.035 + z * 0.017) * 0.08 * (1 - townBlend * 0.75);
      const target = gateBase + centerTier + northTier + controlledVariation;
      height = lerp(original, target, townBlend * 0.94);
    }

    if (z <= 24) {
      const nearest = this.nearestRouteSample(x, z);
      const routeBlend = 1 - smooth((nearest.distance - 5.2) / 13.5);
      if (routeBlend > 0) {
        const centerHeight = this.originalHeightAt(nearest.x, nearest.z)
          + this.foundryDepthDelta(nearest.x, nearest.z);
        height = lerp(height, centerHeight, routeBlend * 0.86);
      }
    }

    height += this.foundryDepthDelta(x, z);
    return height;
  };

  prototype.buildCaelusDistrict = buildAuthoredTown;
  prototype.createAmbientCitizens = buildOrganicCitizens;

  const originalLighting = prototype.tuneVerticalSliceLighting;
  prototype.tuneVerticalSliceLighting = function phaseOneLighting(this: any): void {
    originalLighting.call(this);
    const marketLight = this.scene.getLightByName?.("vertical-slice-market-light");
    if (marketLight) {
      marketLight.position.x = -34;
      marketLight.position.z = 119;
      marketLight.position.y = this.world.heightAt(-34, 119) + 8;
      marketLight.range = 48;
      marketLight.intensity = 0.42;
    }
  };

  prototype.__caelusTownPhaseOneInstalled = true;
};
