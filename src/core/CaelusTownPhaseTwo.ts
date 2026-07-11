interface TownPoint {
  x: number;
  z: number;
}

interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface RoadDefinition {
  id: string;
  control: TownPoint[];
  edgeOffset: number;
  samplesPerSection: number;
}

const ROAD_DEFINITIONS: RoadDefinition[] = [
  {
    id: "main-street",
    edgeOffset: 6.65,
    samplesPerSection: 12,
    control: [
      { x: 0, z: 23 },
      { x: -2, z: 49 },
      { x: 5, z: 77 },
      { x: -3, z: 105 },
      { x: 6, z: 136 },
      { x: -1, z: 166 },
      { x: 0, z: 200 }
    ]
  },
  {
    id: "market-lane",
    edgeOffset: 4.15,
    samplesPerSection: 10,
    control: [
      { x: 1, z: 86 },
      { x: -19, z: 94 },
      { x: -39, z: 108 },
      { x: -46, z: 126 },
      { x: -35, z: 143 },
      { x: -8, z: 149 }
    ]
  },
  {
    id: "guild-lane",
    edgeOffset: 4.15,
    samplesPerSection: 10,
    control: [
      { x: -1, z: 101 },
      { x: 18, z: 106 },
      { x: 38, z: 118 },
      { x: 47, z: 137 },
      { x: 31, z: 155 },
      { x: 4, z: 161 }
    ]
  },
  {
    id: "residential-loop",
    edgeOffset: 3.55,
    samplesPerSection: 8,
    control: [
      { x: -5, z: 151 },
      { x: -31, z: 163 },
      { x: -61, z: 174 },
      { x: -74, z: 192 },
      { x: -42, z: 201 },
      { x: -5, z: 194 }
    ]
  },
  {
    id: "service-lane",
    edgeOffset: 3.45,
    samplesPerSection: 8,
    control: [
      { x: 4, z: 73 },
      { x: 30, z: 83 },
      { x: 61, z: 93 },
      { x: 83, z: 111 },
      { x: 68, z: 137 },
      { x: 45, z: 151 }
    ]
  }
];

const catmullRom = (
  a: number,
  b: number,
  c: number,
  d: number,
  amount: number
): number => {
  const amount2 = amount * amount;
  const amount3 = amount2 * amount;
  return 0.5 * (
    2 * b
    + (-a + c) * amount
    + (2 * a - 5 * b + 4 * c - d) * amount2
    + (-a + 3 * b - 3 * c + d) * amount3
  );
};

const samplePath = (control: TownPoint[], samplesPerSection: number): TownPoint[] => {
  if (control.length < 2) return [...control];
  const points: TownPoint[] = [];
  for (let section = 0; section < control.length - 1; section += 1) {
    const p0 = control[Math.max(0, section - 1)];
    const p1 = control[section];
    const p2 = control[section + 1];
    const p3 = control[Math.min(control.length - 1, section + 2)];
    for (let sample = 0; sample < samplesPerSection; sample += 1) {
      const amount = sample / samplesPerSection;
      points.push({
        x: catmullRom(p0.x, p1.x, p2.x, p3.x, amount),
        z: catmullRom(p0.z, p1.z, p2.z, p3.z, amount)
      });
    }
  }
  points.push({ ...control[control.length - 1] });
  return points;
};

const createGroundMaterial = (
  scene: any,
  name: string,
  diffuse: string
): any => {
  const material = new BABYLON.StandardMaterial(name, scene);
  material.diffuseColor = BABYLON.Color3.FromHexString(diffuse);
  material.ambientColor = BABYLON.Color3.FromHexString(diffuse).scale(0.22);
  material.specularColor = BABYLON.Color3.Black();
  material.emissiveColor = BABYLON.Color3.Black();
  material.alpha = 1;
  material.transparencyMode = 0;
  material.forceDepthWrite = true;
  material.backFaceCulling = false;
  return material;
};

const createDrainageChannel = (
  scene: any,
  world: any,
  name: string,
  path: TownPoint[],
  offset: number,
  halfWidth: number,
  heightOffset: number,
  material: any
): any => {
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];

  for (let index = 0; index < path.length; index += 1) {
    const previous = path[Math.max(0, index - 1)];
    const next = path[Math.min(path.length - 1, index + 1)];
    const deltaX = next.x - previous.x;
    const deltaZ = next.z - previous.z;
    const length = Math.max(0.0001, Math.hypot(deltaX, deltaZ));
    const normalX = -deltaZ / length;
    const normalZ = deltaX / length;
    const centerX = path[index].x + normalX * offset;
    const centerZ = path[index].z + normalZ * offset;

    for (const side of [-1, 1]) {
      const x = centerX + normalX * halfWidth * side;
      const z = centerZ + normalZ * halfWidth * side;
      positions.push(x, world.heightAt(x, z) + heightOffset, z);
    }
  }

  for (let index = 0; index < path.length - 1; index += 1) {
    const base = index * 2;
    const next = base + 2;
    indices.push(base, next, next + 1, base, next + 1, base + 1);
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
  mesh.metadata = {
    phase: 2,
    purpose: "drainage-channel",
    halfWidth,
    heightOffset
  };
  mesh.computeWorldMatrix(true);
  mesh.freezeWorldMatrix();
  return mesh;
};

const createSegmentedCurb = (
  scene: any,
  world: any,
  name: string,
  path: TownPoint[],
  offset: number,
  halfWidth: number,
  baseOffset: number,
  blockHeight: number,
  gapRatio: number,
  material: any
): any => {
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  let blockCount = 0;

  for (let index = 0; index < path.length - 1; index += 1) {
    const start = path[index];
    const end = path[index + 1];
    const deltaX = end.x - start.x;
    const deltaZ = end.z - start.z;
    const length = Math.hypot(deltaX, deltaZ);
    if (length < 0.15) continue;

    const tangentX = deltaX / length;
    const tangentZ = deltaZ / length;
    const normalX = -tangentZ;
    const normalZ = tangentX;
    const centerX = (start.x + end.x) * 0.5 + normalX * offset;
    const centerZ = (start.z + end.z) * 0.5 + normalZ * offset;
    const halfLength = length * (1 - gapRatio) * 0.5;
    const corners = [
      { x: centerX - tangentX * halfLength - normalX * halfWidth, z: centerZ - tangentZ * halfLength - normalZ * halfWidth },
      { x: centerX + tangentX * halfLength - normalX * halfWidth, z: centerZ + tangentZ * halfLength - normalZ * halfWidth },
      { x: centerX + tangentX * halfLength + normalX * halfWidth, z: centerZ + tangentZ * halfLength + normalZ * halfWidth },
      { x: centerX - tangentX * halfLength + normalX * halfWidth, z: centerZ - tangentZ * halfLength + normalZ * halfWidth }
    ];
    const vertexBase = positions.length / 3;
    const blockVariation = Math.sin(index * 1.91) * 0.014;

    for (const corner of corners) {
      const ground = world.heightAt(corner.x, corner.z) + baseOffset + blockVariation;
      positions.push(corner.x, ground, corner.z);
    }
    for (const corner of corners) {
      const ground = world.heightAt(corner.x, corner.z) + baseOffset + blockVariation;
      positions.push(corner.x, ground + blockHeight, corner.z);
    }

    indices.push(
      vertexBase, vertexBase + 2, vertexBase + 1,
      vertexBase, vertexBase + 3, vertexBase + 2,
      vertexBase + 4, vertexBase + 5, vertexBase + 6,
      vertexBase + 4, vertexBase + 6, vertexBase + 7,
      vertexBase, vertexBase + 1, vertexBase + 5,
      vertexBase, vertexBase + 5, vertexBase + 4,
      vertexBase + 1, vertexBase + 2, vertexBase + 6,
      vertexBase + 1, vertexBase + 6, vertexBase + 5,
      vertexBase + 2, vertexBase + 3, vertexBase + 7,
      vertexBase + 2, vertexBase + 7, vertexBase + 6,
      vertexBase + 3, vertexBase, vertexBase + 4,
      vertexBase + 3, vertexBase + 4, vertexBase + 7
    );
    blockCount += 1;
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
  mesh.metadata = {
    phase: 2,
    purpose: "segmented-road-curb",
    halfWidth,
    heightOffset: baseOffset,
    blockHeight,
    gapRatio,
    blockCount
  };
  mesh.computeWorldMatrix(true);
  mesh.freezeWorldMatrix();
  return mesh;
};

const overlaps = (left: CollisionBox, right: CollisionBox): boolean => (
  left.minX < right.maxX
  && left.maxX > right.minX
  && left.minZ < right.maxZ
  && left.maxZ > right.minZ
);

export class CaelusTownPhaseTwo {
  private readonly scene: any;
  private readonly world: any;

  constructor(game: any) {
    this.scene = game.world.scene;
    this.world = game.world;

    const wellRecovered = this.relocateAndRecollideTownWell();
    const drainageBands = this.buildRoadDrainageBands();
    const collisionAudit = this.auditCollisionNetwork();
    this.tuneRoadMaterials();

    this.scene.metadata = {
      ...(this.scene.metadata ?? {}),
      caelusTownPhaseTwoVersion: 1,
      phaseTwoWellRecovered: wellRecovered,
      phaseTwoDrainageBands: drainageBands,
      phaseTwoCollisionAudit: collisionAudit,
      phaseTwoRoadVisualRevision: 3
    };
  }

  private relocateAndRecollideTownWell(): boolean {
    const well = this.scene.getMeshByName?.("caelus-phase1-town-well");
    if (!well) return false;

    well.unfreezeWorldMatrix?.();
    well.position.x -= 7;
    well.metadata = {
      ...(well.metadata ?? {}),
      phaseTwoRelocated: true,
      collisionCenter: { x: -10, z: 112 }
    };
    well.computeWorldMatrix(true);
    well.freezeWorldMatrix();

    const collisionBoxes = this.world.collisionBoxes as CollisionBox[];
    if (!Array.isArray(collisionBoxes)) return false;
    const wellCollision: CollisionBox = {
      minX: -13.45,
      maxX: -6.55,
      minZ: 108.55,
      maxZ: 115.45
    };
    const duplicate = collisionBoxes.some((box) => (
      Math.abs(box.minX - wellCollision.minX) < 0.05
      && Math.abs(box.maxX - wellCollision.maxX) < 0.05
      && Math.abs(box.minZ - wellCollision.minZ) < 0.05
      && Math.abs(box.maxZ - wellCollision.maxZ) < 0.05
    ));
    if (!duplicate) collisionBoxes.push(wellCollision);
    return true;
  }

  private buildRoadDrainageBands(): number {
    const stone = createGroundMaterial(this.scene, "caelus-phase2-drainage-stone", "#303936");
    const channel = createGroundMaterial(this.scene, "caelus-phase2-drainage-channel", "#18211f");
    let count = 0;

    for (const definition of ROAD_DEFINITIONS) {
      const path = samplePath(definition.control, definition.samplesPerSection);
      for (const side of [-1, 1]) {
        createSegmentedCurb(
          this.scene,
          this.world,
          `caelus-phase2-${definition.id}-curb-${side < 0 ? "left" : "right"}`,
          path,
          definition.edgeOffset * side,
          0.22,
          0.032,
          0.14,
          0.28,
          stone
        );
        createDrainageChannel(
          this.scene,
          this.world,
          `caelus-phase2-${definition.id}-channel-${side < 0 ? "left" : "right"}`,
          path,
          (definition.edgeOffset - 0.54) * side,
          0.14,
          0.045,
          channel
        );
        count += 2;
      }
    }

    stone.freeze?.();
    channel.freeze?.();
    return count;
  }

  private tuneRoadMaterials(): void {
    const road = this.scene.getMaterialByName?.("caelus-phase1-road");
    if (road) {
      road.unfreeze?.();
      road.albedoColor = BABYLON.Color3.FromHexString("#3b423c");
      road.roughness = 1;
      road.metallic = 0;
      road.environmentIntensity = 0.24;
      road.directIntensity = 0.68;
      road.alpha = 1;
      road.transparencyMode = 0;
      road.forceDepthWrite = true;
      road.markDirty?.();
      road.freeze?.();
    }

    const roadEdge = this.scene.getMaterialByName?.("caelus-phase1-road-edge");
    if (roadEdge) {
      roadEdge.unfreeze?.();
      roadEdge.albedoColor = BABYLON.Color3.FromHexString("#333a35");
      roadEdge.roughness = 1;
      roadEdge.metallic = 0;
      roadEdge.environmentIntensity = 0.08;
      roadEdge.directIntensity = 0.42;
      roadEdge.unlit = true;
      roadEdge.alpha = 1;
      roadEdge.transparencyMode = 0;
      roadEdge.forceDepthWrite = true;
      roadEdge.markDirty?.();
      roadEdge.freeze?.();
    }
  }

  private auditCollisionNetwork(): Record<string, number> {
    const collisionBoxes = this.world.collisionBoxes as CollisionBox[];
    if (!Array.isArray(collisionBoxes)) {
      return {
        total: 0,
        duplicatePairs: 0,
        mainRouteIntrusions: 0,
        wellCollisions: 0
      };
    }

    let duplicatePairs = 0;
    for (let left = 0; left < collisionBoxes.length; left += 1) {
      for (let right = left + 1; right < collisionBoxes.length; right += 1) {
        const a = collisionBoxes[left];
        const b = collisionBoxes[right];
        const same = (
          Math.abs(a.minX - b.minX) < 0.03
          && Math.abs(a.maxX - b.maxX) < 0.03
          && Math.abs(a.minZ - b.minZ) < 0.03
          && Math.abs(a.maxZ - b.maxZ) < 0.03
        );
        if (same) duplicatePairs += 1;
      }
    }

    const mainRoute: CollisionBox = {
      minX: -2.25,
      maxX: 2.25,
      minZ: 23,
      maxZ: 200
    };
    const mainRouteIntrusions = collisionBoxes.filter((box) => overlaps(box, mainRoute)).length;
    const wellRegion: CollisionBox = {
      minX: -14,
      maxX: -6,
      minZ: 108,
      maxZ: 116
    };
    const wellCollisions = collisionBoxes.filter((box) => overlaps(box, wellRegion)).length;

    return {
      total: collisionBoxes.length,
      duplicatePairs,
      mainRouteIntrusions,
      wellCollisions
    };
  }
}
