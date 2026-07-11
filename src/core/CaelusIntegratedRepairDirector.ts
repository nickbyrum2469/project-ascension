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

interface BuildingDefinition {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  yaw: number;
  kind: "home" | "shop" | "guild" | "workshop" | "storehouse";
  doorSide: "north" | "south" | "east" | "west";
}

const ROAD_DEFINITIONS: RoadDefinition[] = [
  {
    id: "main-street",
    edgeOffset: 6.65,
    samplesPerSection: 12,
    control: [
      { x: 0, z: 23 }, { x: -2, z: 49 }, { x: 5, z: 77 },
      { x: -3, z: 105 }, { x: 6, z: 136 }, { x: -1, z: 166 }, { x: 0, z: 200 }
    ]
  },
  {
    id: "market-lane",
    edgeOffset: 4.15,
    samplesPerSection: 10,
    control: [
      { x: 1, z: 86 }, { x: -19, z: 94 }, { x: -39, z: 108 },
      { x: -46, z: 126 }, { x: -35, z: 143 }, { x: -8, z: 149 }
    ]
  },
  {
    id: "guild-lane",
    edgeOffset: 4.15,
    samplesPerSection: 10,
    control: [
      { x: -1, z: 101 }, { x: 18, z: 106 }, { x: 38, z: 118 },
      { x: 47, z: 137 }, { x: 31, z: 155 }, { x: 4, z: 161 }
    ]
  },
  {
    id: "residential-loop",
    edgeOffset: 3.55,
    samplesPerSection: 8,
    control: [
      { x: -5, z: 151 }, { x: -31, z: 163 }, { x: -61, z: 174 },
      { x: -74, z: 192 }, { x: -42, z: 201 }, { x: -5, z: 194 }
    ]
  },
  {
    id: "service-lane",
    edgeOffset: 3.45,
    samplesPerSection: 8,
    control: [
      { x: 4, z: 73 }, { x: 30, z: 83 }, { x: 61, z: 93 },
      { x: 83, z: 111 }, { x: 68, z: 137 }, { x: 45, z: 151 }
    ]
  }
];

const JUNCTIONS = [
  { x: 2, z: 78, radius: 10.5 },
  { x: 0, z: 91, radius: 11.5 },
  { x: 0, z: 104, radius: 11.5 },
  { x: 1, z: 151, radius: 12.5 },
  { x: 2, z: 161, radius: 11.5 },
  { x: -8, z: 149, radius: 9.5 },
  { x: 45, z: 151, radius: 9.5 }
];

const OLD_BUILDING_CENTERS: TownPoint[] = [
  { x: -34, z: 43 }, { x: 31, z: 47 }, { x: -27, z: 69 }, { x: 34, z: 73 },
  { x: -59, z: 91 }, { x: -52, z: 121 }, { x: -66, z: 146 }, { x: -38, z: 155 },
  { x: 48, z: 125 }, { x: 66, z: 151 }, { x: 78, z: 93 }, { x: 88, z: 124 },
  { x: -82, z: 174 }, { x: -54, z: 188 }, { x: 71, z: 181 }, { x: 31, z: 184 },
  { x: -24, z: 188 }, { x: 93, z: 166 }, { x: -34, z: 103 }, { x: -46, z: 129 },
  { x: -10, z: 112 }
];

const BUILDINGS: BuildingDefinition[] = [
  { id: "gate-west", x: -28, z: 48, width: 15, depth: 13, height: 8.2, yaw: 0.12, kind: "home", doorSide: "east" },
  { id: "gate-east", x: 29, z: 50, width: 15, depth: 13, height: 8.2, yaw: -0.1, kind: "home", doorSide: "west" },
  { id: "main-shop-west", x: -24, z: 72, width: 18, depth: 14, height: 9.5, yaw: 0.08, kind: "shop", doorSide: "east" },
  { id: "main-workshop-east", x: 30, z: 76, width: 19, depth: 15, height: 9.2, yaw: -0.12, kind: "workshop", doorSide: "west" },
  { id: "market-house-a", x: -62, z: 101, width: 16, depth: 14, height: 8.4, yaw: 0.22, kind: "home", doorSide: "east" },
  { id: "market-house-b", x: -67, z: 145, width: 18, depth: 15, height: 8.8, yaw: -0.14, kind: "storehouse", doorSide: "east" },
  { id: "guild-hall", x: 66, z: 128, width: 27, depth: 20, height: 13.4, yaw: -0.08, kind: "guild", doorSide: "west" },
  { id: "guild-annex", x: 69, z: 157, width: 17, depth: 14, height: 9, yaw: -0.16, kind: "workshop", doorSide: "west" },
  { id: "service-store", x: 86, z: 89, width: 20, depth: 16, height: 8.8, yaw: -0.34, kind: "storehouse", doorSide: "south" },
  { id: "service-home", x: 98, z: 126, width: 15, depth: 13, height: 8.3, yaw: -0.1, kind: "home", doorSide: "west" },
  { id: "residence-west-a", x: -91, z: 174, width: 16, depth: 14, height: 8.8, yaw: 0.34, kind: "home", doorSide: "east" },
  { id: "residence-west-b", x: -58, z: 211, width: 15, depth: 13, height: 8.2, yaw: 0.08, kind: "home", doorSide: "north" },
  { id: "supply-house", x: 29, z: 188, width: 21, depth: 16, height: 10, yaw: -0.08, kind: "shop", doorSide: "west" },
  { id: "north-home", x: -27, z: 211, width: 15, depth: 13, height: 8.5, yaw: 0.08, kind: "home", doorSide: "north" }
];

const catmullRom = (a: number, b: number, c: number, d: number, t: number): number => {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
};

const samplePath = (control: TownPoint[], samplesPerSection: number): TownPoint[] => {
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

const distanceSquared = (a: TownPoint, b: TownPoint): number => {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
};

const makeMaterial = (scene: any, name: string, color: string, emissive?: string): any => {
  const material = new BABYLON.StandardMaterial(name, scene);
  material.diffuseColor = BABYLON.Color3.FromHexString(color);
  material.ambientColor = BABYLON.Color3.FromHexString(color).scale(0.28);
  material.specularColor = BABYLON.Color3.Black();
  material.emissiveColor = emissive ? BABYLON.Color3.FromHexString(emissive) : BABYLON.Color3.Black();
  material.alpha = 1;
  material.transparencyMode = 0;
  material.forceDepthWrite = true;
  material.backFaceCulling = false;
  return material;
};

export class CaelusIntegratedRepairDirector {
  private readonly scene: any;
  private readonly world: any;
  private readonly player: any;
  private readonly generated: any[] = [];
  private swordDirectionVerified = false;

  constructor(game: any) {
    this.scene = game.world.scene;
    this.world = game.world;
    this.player = game.player;

    this.removeSupersededVisuals();
    const removedCollision = this.removeSupersededCollision();
    const curbSegments = this.rebuildRoadEdges();
    const buildingCount = this.rebuildBuildingsAndFrontages();
    this.rebuildTownGreenAndWell();
    this.rebuildMarketCourt();
    this.rebuildGuildCourt();
    this.rebuildSolidGatehouse();
    this.repositionQuestActors();
    this.installCombatCorrections();

    this.scene.metadata = {
      ...(this.scene.metadata ?? {}),
      caelusIntegratedRepairVersion: 1,
      caelusIntegratedRemovedCollision: removedCollision,
      caelusIntegratedCurbSegments: curbSegments,
      caelusIntegratedBuildingCount: buildingCount,
      caelusIntegratedJunctionCount: JUNCTIONS.length,
      caelusIntegratedSwordCorrection: true,
      caelusIntegratedStableGuard: true
    };
  }

  private removeSupersededVisuals(): void {
    const exact = new Set([
      "caelus-phase1-buildings-warm", "caelus-phase1-buildings-sage", "caelus-phase1-foundations",
      "caelus-phase1-roofs-blue", "caelus-phase1-roofs-green", "caelus-phase1-doors",
      "caelus-phase1-windows", "caelus-phase1-signage", "caelus-phase1-chimneys",
      "caelus-phase1-market-wood", "caelus-phase1-market-roofs", "caelus-phase1-town-well"
    ]);
    for (const mesh of this.scene.meshes) {
      const name = String(mesh.name ?? "");
      const roadEdge = name.startsWith("caelus-phase1-") && name.endsWith("-edge");
      const phaseTwoEdge = name.startsWith("caelus-phase2-") && (name.includes("-curb-") || name.includes("-channel-"));
      if (!exact.has(name) && !roadEdge && !phaseTwoEdge) continue;
      mesh.setEnabled(false);
      mesh.isPickable = false;
      mesh.metadata = { ...(mesh.metadata ?? {}), supersededByIntegratedRepair: true };
    }
  }

  private removeSupersededCollision(): number {
    const boxes = this.world.collisionBoxes as CollisionBox[];
    if (!Array.isArray(boxes)) return 0;
    let removed = 0;
    let write = 0;
    for (const box of boxes) {
      const center = { x: (box.minX + box.maxX) * 0.5, z: (box.minZ + box.maxZ) * 0.5 };
      const superseded = OLD_BUILDING_CENTERS.some((point) => distanceSquared(point, center) < 20);
      if (superseded) {
        removed += 1;
        continue;
      }
      boxes[write] = box;
      write += 1;
    }
    boxes.length = write;
    return removed;
  }

  private rebuildRoadEdges(): number {
    const stone = makeMaterial(this.scene, "caelus-integrated-curb-stone", "#59615a");
    const drain = makeMaterial(this.scene, "caelus-integrated-drain", "#18201d");
    let count = 0;
    for (const definition of ROAD_DEFINITIONS) {
      const path = samplePath(definition.control, definition.samplesPerSection);
      for (let index = 0; index < path.length - 1; index += 1) {
        const start = path[index];
        const end = path[index + 1];
        const midpoint = { x: (start.x + end.x) * 0.5, z: (start.z + end.z) * 0.5 };
        if (JUNCTIONS.some((junction) => distanceSquared(midpoint, junction) < junction.radius * junction.radius)) continue;
        const dx = end.x - start.x;
        const dz = end.z - start.z;
        const length = Math.hypot(dx, dz);
        if (length < 0.2) continue;
        const tangentX = dx / length;
        const tangentZ = dz / length;
        const normalX = -tangentZ;
        const normalZ = tangentX;
        const yaw = Math.atan2(dx, dz);
        for (const side of [-1, 1]) {
          const curbX = midpoint.x + normalX * definition.edgeOffset * side;
          const curbZ = midpoint.z + normalZ * definition.edgeOffset * side;
          const curb = BABYLON.MeshBuilder.CreateBox(`caelus-integrated-${definition.id}-curb-${index}-${side}`, {
            width: 0.48,
            height: 0.18,
            depth: Math.max(0.25, length * 0.72)
          }, this.scene);
          curb.position.set(curbX, this.world.heightAt(curbX, curbZ) + 0.09, curbZ);
          curb.rotation.y = yaw;
          curb.material = stone;
          curb.receiveShadows = true;
          curb.isPickable = false;
          curb.metadata = { purpose: "junction-aware-curb", road: definition.id };
          curb.freezeWorldMatrix();
          this.generated.push(curb);

          const drainX = midpoint.x + normalX * (definition.edgeOffset - 0.54) * side;
          const drainZ = midpoint.z + normalZ * (definition.edgeOffset - 0.54) * side;
          const channel = BABYLON.MeshBuilder.CreateBox(`caelus-integrated-${definition.id}-drain-${index}-${side}`, {
            width: 0.28,
            height: 0.035,
            depth: Math.max(0.25, length * 0.78)
          }, this.scene);
          channel.position.set(drainX, this.world.heightAt(drainX, drainZ) + 0.025, drainZ);
          channel.rotation.y = yaw;
          channel.material = drain;
          channel.isPickable = false;
          channel.metadata = { purpose: "junction-aware-drain", road: definition.id };
          channel.freezeWorldMatrix();
          this.generated.push(channel);
          count += 2;
        }
      }
    }
    stone.freeze?.();
    drain.freeze?.();
    return count;
  }

  private rebuildBuildingsAndFrontages(): number {
    const plaster = makeMaterial(this.scene, "caelus-integrated-plaster", "#8f8877");
    const plasterAlt = makeMaterial(this.scene, "caelus-integrated-plaster-alt", "#77877a");
    const timber = makeMaterial(this.scene, "caelus-integrated-timber", "#3b2e25");
    const roof = makeMaterial(this.scene, "caelus-integrated-roof", "#344f56");
    const roofAlt = makeMaterial(this.scene, "caelus-integrated-roof-alt", "#465944");
    const window = makeMaterial(this.scene, "caelus-integrated-window", "#c9ddb1", "#557a57");
    const frontage = makeMaterial(this.scene, "caelus-integrated-frontage", "#555e57");

    BUILDINGS.forEach((building, index) => {
      const ground = this.world.heightAt(building.x, building.z);
      const foundation = BABYLON.MeshBuilder.CreateBox(`caelus-integrated-${building.id}-foundation`, {
        width: building.width + 1.2, height: 0.7, depth: building.depth + 1.2
      }, this.scene);
      foundation.position.set(building.x, ground + 0.33, building.z);
      foundation.rotation.y = building.yaw;
      foundation.material = frontage;

      const body = BABYLON.MeshBuilder.CreateBox(`caelus-integrated-${building.id}-body`, {
        width: building.width, height: building.height, depth: building.depth
      }, this.scene);
      body.position.set(building.x, ground + 0.7 + building.height * 0.5, building.z);
      body.rotation.y = building.yaw;
      body.material = index % 2 === 0 ? plaster : plasterAlt;
      body.receiveShadows = true;
      body.isPickable = true;
      body.metadata = { cameraCollision: true, buildingId: building.id, buildingKind: building.kind };

      const roofMesh = BABYLON.MeshBuilder.CreateCylinder(`caelus-integrated-${building.id}-roof`, {
        height: building.depth + 1.4,
        diameter: building.width * 0.78,
        tessellation: 3
      }, this.scene);
      roofMesh.position.set(building.x, ground + building.height + 2.5, building.z);
      roofMesh.rotation.set(Math.PI / 2, building.yaw + Math.PI / 2, 0);
      roofMesh.scaling.z = 0.72;
      roofMesh.material = index % 3 === 0 ? roofAlt : roof;
      roofMesh.receiveShadows = true;

      const door = this.doorPosition(building);
      const doorMesh = BABYLON.MeshBuilder.CreateBox(`caelus-integrated-${building.id}-door`, {
        width: 2.1, height: building.kind === "guild" ? 4.2 : 3.2, depth: 0.28
      }, this.scene);
      doorMesh.position.set(door.x, ground + (building.kind === "guild" ? 2.8 : 2.25), door.z);
      doorMesh.rotation.y = building.yaw + (building.doorSide === "east" || building.doorSide === "west" ? Math.PI / 2 : 0);
      doorMesh.material = timber;

      for (const offset of [-0.28, 0.28]) {
        const localX = building.width * offset;
        const cos = Math.cos(building.yaw);
        const sin = Math.sin(building.yaw);
        const frontDepth = -building.depth * 0.5 - 0.18;
        const wx = building.x + localX * cos + frontDepth * sin;
        const wz = building.z - localX * sin + frontDepth * cos;
        const windowMesh = BABYLON.MeshBuilder.CreateBox(`caelus-integrated-${building.id}-window-${offset}`, {
          width: 1.35, height: 1.55, depth: 0.18
        }, this.scene);
        windowMesh.position.set(wx, ground + 4.8, wz);
        windowMesh.rotation.y = building.yaw;
        windowMesh.material = window;
      }

      this.addCollision(building.x, building.z, building.width + 0.5, building.depth + 0.5, building.yaw);
      this.createFrontagePath(building, door, frontage);
      [foundation, body, roofMesh, doorMesh].forEach((mesh) => {
        mesh.computeWorldMatrix(true);
        mesh.freezeWorldMatrix();
        this.generated.push(mesh);
      });
    });

    [plaster, plasterAlt, timber, roof, roofAlt, window, frontage].forEach((material) => material.freeze?.());
    return BUILDINGS.length;
  }

  private doorPosition(building: BuildingDefinition): TownPoint {
    const cos = Math.cos(building.yaw);
    const sin = Math.sin(building.yaw);
    let localX = 0;
    let localZ = 0;
    if (building.doorSide === "north") localZ = building.depth * 0.5 + 0.18;
    if (building.doorSide === "south") localZ = -building.depth * 0.5 - 0.18;
    if (building.doorSide === "east") localX = building.width * 0.5 + 0.18;
    if (building.doorSide === "west") localX = -building.width * 0.5 - 0.18;
    return {
      x: building.x + localX * cos + localZ * sin,
      z: building.z - localX * sin + localZ * cos
    };
  }

  private createFrontagePath(building: BuildingDefinition, door: TownPoint, material: any): void {
    const roadTarget = this.closestRoadPoint(door);
    const dx = roadTarget.x - door.x;
    const dz = roadTarget.z - door.z;
    const length = Math.max(1.2, Math.hypot(dx, dz));
    const midpoint = { x: (door.x + roadTarget.x) * 0.5, z: (door.z + roadTarget.z) * 0.5 };
    const path = BABYLON.MeshBuilder.CreateBox(`caelus-integrated-${building.id}-frontage`, {
      width: building.kind === "guild" ? 4.5 : 2.2,
      height: 0.08,
      depth: length
    }, this.scene);
    path.position.set(midpoint.x, this.world.heightAt(midpoint.x, midpoint.z) + 0.055, midpoint.z);
    path.rotation.y = Math.atan2(dx, dz);
    path.material = material;
    path.receiveShadows = true;
    path.isPickable = false;
    path.metadata = { purpose: "door-to-road-frontage", buildingId: building.id };
    path.freezeWorldMatrix();
    this.generated.push(path);
  }

  private closestRoadPoint(point: TownPoint): TownPoint {
    let closest = ROAD_DEFINITIONS[0].control[0];
    let best = Number.POSITIVE_INFINITY;
    for (const road of ROAD_DEFINITIONS) {
      for (const sample of samplePath(road.control, road.samplesPerSection)) {
        const distance = distanceSquared(point, sample);
        if (distance < best) {
          best = distance;
          closest = sample;
        }
      }
    }
    return closest;
  }

  private rebuildTownGreenAndWell(): void {
    const grass = makeMaterial(this.scene, "caelus-integrated-town-green", "#405842");
    const stone = makeMaterial(this.scene, "caelus-integrated-well-stone", "#626b64");
    const darkness = makeMaterial(this.scene, "caelus-integrated-well-depth", "#050807");
    const timber = makeMaterial(this.scene, "caelus-integrated-well-timber", "#36281f");
    const x = -21;
    const z = 118;
    const ground = this.world.heightAt(x, z);

    const green = BABYLON.MeshBuilder.CreateCylinder("caelus-integrated-town-green-disc", {
      diameter: 18, height: 0.09, tessellation: 32
    }, this.scene);
    green.position.set(x, ground + 0.04, z);
    green.material = grass;

    const shaft = BABYLON.MeshBuilder.CreateCylinder("caelus-integrated-well-dark-shaft", {
      diameter: 4.6, height: 0.24, tessellation: 32
    }, this.scene);
    shaft.position.set(x, ground + 0.12, z);
    shaft.material = darkness;

    const ring = BABYLON.MeshBuilder.CreateTorus("caelus-integrated-well-ring", {
      diameter: 6.3, thickness: 1.05, tessellation: 32
    }, this.scene);
    ring.position.set(x, ground + 0.56, z);
    ring.material = stone;

    for (const side of [-1, 1]) {
      const post = BABYLON.MeshBuilder.CreateBox(`caelus-integrated-well-post-${side}`, {
        width: 0.48, height: 5.5, depth: 0.48
      }, this.scene);
      post.position.set(x + side * 2.7, ground + 2.75, z);
      post.material = timber;
      const beam = side === 1 ? BABYLON.MeshBuilder.CreateBox("caelus-integrated-well-beam", {
        width: 6.2, height: 0.45, depth: 0.45
      }, this.scene) : null;
      if (beam) {
        beam.position.set(x, ground + 5.1, z);
        beam.material = timber;
      }
    }
    const rope = BABYLON.MeshBuilder.CreateCylinder("caelus-integrated-well-rope", {
      height: 3.7, diameter: 0.12, tessellation: 8
    }, this.scene);
    rope.position.set(x, ground + 3.2, z);
    rope.material = timber;

    this.addCollision(x, z, 6.4, 6.4, 0);
    [grass, stone, darkness, timber].forEach((material) => material.freeze?.());
  }

  private rebuildMarketCourt(): void {
    const paving = makeMaterial(this.scene, "caelus-integrated-market-paving", "#59625a");
    const timber = makeMaterial(this.scene, "caelus-integrated-market-timber", "#3a2b22");
    const clothA = makeMaterial(this.scene, "caelus-integrated-market-cloth-a", "#8a5748");
    const clothB = makeMaterial(this.scene, "caelus-integrated-market-cloth-b", "#526b55");
    const center = { x: -49, z: 121 };
    const ground = this.world.heightAt(center.x, center.z);
    const court = BABYLON.MeshBuilder.CreateCylinder("caelus-integrated-market-court", {
      diameter: 24, height: 0.08, tessellation: 28
    }, this.scene);
    court.position.set(center.x, ground + 0.05, center.z);
    court.material = paving;

    const stalls = [
      { x: -56, z: 115, yaw: 0.55, cloth: clothA },
      { x: -57, z: 128, yaw: 2.55, cloth: clothB },
      { x: -43, z: 132, yaw: -2.45, cloth: clothA }
    ];
    stalls.forEach((stall, index) => {
      const stallGround = this.world.heightAt(stall.x, stall.z);
      const counter = BABYLON.MeshBuilder.CreateBox(`caelus-integrated-market-counter-${index}`, {
        width: 6.2, height: 1.1, depth: 1.4
      }, this.scene);
      counter.position.set(stall.x, stallGround + 0.7, stall.z);
      counter.rotation.y = stall.yaw;
      counter.material = timber;
      const canopy = BABYLON.MeshBuilder.CreateBox(`caelus-integrated-market-canopy-${index}`, {
        width: 7.2, height: 0.25, depth: 4.2
      }, this.scene);
      canopy.position.set(stall.x, stallGround + 3.6, stall.z);
      canopy.rotation.y = stall.yaw;
      canopy.material = stall.cloth;
      this.addCollision(stall.x, stall.z, 6.5, 1.8, stall.yaw);
    });
    [paving, timber, clothA, clothB].forEach((material) => material.freeze?.());
  }

  private rebuildGuildCourt(): void {
    const paving = makeMaterial(this.scene, "caelus-integrated-guild-paving", "#626b63");
    const banner = makeMaterial(this.scene, "caelus-integrated-guild-banner", "#264f61", "#173540");
    const timber = makeMaterial(this.scene, "caelus-integrated-guild-board", "#3c2b21");
    const ground = this.world.heightAt(50, 130);
    const court = BABYLON.MeshBuilder.CreateCylinder("caelus-integrated-guild-court", {
      diameter: 22, height: 0.09, tessellation: 28
    }, this.scene);
    court.position.set(50, ground + 0.055, 130);
    court.material = paving;

    const board = BABYLON.MeshBuilder.CreateBox("caelus-integrated-guild-quest-board", {
      width: 5.8, height: 3.5, depth: 0.38
    }, this.scene);
    board.position.set(47, ground + 2.3, 124);
    board.rotation.y = -0.25;
    board.material = timber;
    board.metadata = { interaction: "boar-contract-board", quest: "Boar Cull" };
    this.addCollision(47, 124, 5.9, 1.1, -0.25);

    for (const side of [-1, 1]) {
      const post = BABYLON.MeshBuilder.CreateBox(`caelus-integrated-guild-banner-post-${side}`, {
        width: 0.35, height: 7.2, depth: 0.35
      }, this.scene);
      post.position.set(52, ground + 3.6, 130 + side * 5.5);
      post.material = timber;
      const flag = BABYLON.MeshBuilder.CreateBox(`caelus-integrated-guild-banner-${side}`, {
        width: 0.18, height: 3.6, depth: 2.2
      }, this.scene);
      flag.position.set(52.35, ground + 5.1, 130 + side * 5.5);
      flag.material = banner;
    }
    [paving, banner, timber].forEach((material) => material.freeze?.());
  }

  private rebuildSolidGatehouse(): void {
    const stone = makeMaterial(this.scene, "caelus-integrated-gate-stone", "#5b6865");
    const darkStone = makeMaterial(this.scene, "caelus-integrated-gate-dark", "#394644");
    const glow = makeMaterial(this.scene, "caelus-integrated-gate-rune", "#baf8df", "#4acfac");
    const ground = this.world.heightAt(0, 25);
    for (const side of [-1, 1]) {
      const tower = BABYLON.MeshBuilder.CreateCylinder(`caelus-integrated-gate-tower-${side}`, {
        diameter: 13, height: 24, tessellation: 12, cap: BABYLON.Mesh.CAP_ALL
      }, this.scene);
      tower.position.set(side * 13.5, ground + 12, 25);
      tower.material = stone;
      tower.isPickable = true;
      tower.metadata = { cameraCollision: true, closedGeometry: true };
      const cap = BABYLON.MeshBuilder.CreateCylinder(`caelus-integrated-gate-cap-${side}`, {
        diameterTop: 2, diameterBottom: 15.5, height: 5.2, tessellation: 12, cap: BABYLON.Mesh.CAP_ALL
      }, this.scene);
      cap.position.set(side * 13.5, ground + 26.6, 25);
      cap.material = darkStone;
      const rune = BABYLON.MeshBuilder.CreateTorus(`caelus-integrated-gate-rune-${side}`, {
        diameter: 3.2, thickness: 0.38, tessellation: 24
      }, this.scene);
      rune.position.set(side * 13.5, ground + 15, 18.45);
      rune.rotation.x = Math.PI / 2;
      rune.material = glow;
      this.addCollision(side * 13.5, 25, 13.2, 13.2, 0);
    }
    const lintel = BABYLON.MeshBuilder.CreateBox("caelus-integrated-gate-lintel", {
      width: 21, height: 5.5, depth: 7.5
    }, this.scene);
    lintel.position.set(0, ground + 20.5, 25);
    lintel.material = stone;
    lintel.isPickable = true;
    lintel.metadata = { cameraCollision: true, closedGeometry: true };
    const inner = BABYLON.MeshBuilder.CreateBox("caelus-integrated-gate-inner-shadow", {
      width: 12, height: 13, depth: 0.55
    }, this.scene);
    inner.position.set(0, ground + 6.5, 28.6);
    inner.material = darkStone;
    inner.isPickable = false;
    [stone, darkStone, glow].forEach((material) => material.freeze?.());
  }

  private repositionQuestActors(): void {
    for (const node of [...this.scene.meshes, ...this.scene.transformNodes]) {
      const name = String(node.name ?? "").toLowerCase();
      if (!name.includes("quest") && !name.includes("mara") && !name.includes("board")) continue;
      if (!node.position || Math.abs(Number(node.position.x ?? 999)) > 140 || Number(node.position.z ?? -999) < 20) continue;
      node.unfreezeWorldMatrix?.();
      if (name.includes("board")) node.position.set(47, this.world.heightAt(47, 124), 124);
      else node.position.set(55, this.world.heightAt(55, 132), 132);
      node.computeWorldMatrix?.(true);
      node.freezeWorldMatrix?.();
    }
  }

  private installCombatCorrections(): void {
    const mount = this.scene.getTransformNodeByName?.("caelus-third-person-sword-mount");
    if (mount) {
      mount.unfreezeWorldMatrix?.();
      mount.position.set(0.08, -0.02, 0.12);
      mount.rotation.set(0.48, Math.PI, -0.12);
    }

    this.scene.onAfterRenderObservable.add(() => {
      const visual = this.player.visual;
      if (!visual?.root?.isEnabled?.()) return;
      const attacking = Boolean(this.player.attack);
      if (!attacking && mount) {
        mount.rotation.x = 0.48;
        mount.rotation.z = -0.12;
      }
      if (!attacking && visual.sword) {
        visual.sword.rotation.set(-Math.PI / 2, 0, -0.08);
      }
      if (!this.swordDirectionVerified && !attacking) this.verifySwordDirection(mount, visual.sword);

      if (this.player.blocking) {
        visual.root.rotation.z = 0;
        visual.root.rotation.x = 0;
        visual.hips.rotation.x = -0.08;
        visual.hips.rotation.y = 0;
        visual.hips.rotation.z = 0;
        visual.leftThigh.rotation.x = -0.12;
        visual.rightThigh.rotation.x = -0.08;
        visual.leftShin.rotation.x = 0.18;
        visual.rightShin.rotation.x = 0.15;
        visual.torso.position.y = 0;
        visual.torso.rotation.x = 0;
        visual.torso.rotation.z = 0;
        visual.leftForearm.rotation.z = 0.12;
        visual.rightForearm.rotation.z = -0.08;
      }
    });
  }

  private verifySwordDirection(mount: any, sword: any): void {
    if (!mount || !sword) {
      this.swordDirectionVerified = true;
      return;
    }
    sword.computeWorldMatrix?.(true);
    const hilt = sword.getAbsolutePosition?.() ?? sword.absolutePosition;
    const tipProbe = new BABYLON.Vector3(0, 2.8, 0);
    const tip = BABYLON.Vector3.TransformCoordinates(tipProbe, sword.getWorldMatrix());
    const forward = this.player.forward();
    const dot = BABYLON.Vector3.Dot(tip.subtract(hilt), forward);
    if (dot < 0) mount.rotation.y += Math.PI;
    mount.computeWorldMatrix?.(true);
    this.swordDirectionVerified = true;
    this.scene.metadata = {
      ...(this.scene.metadata ?? {}),
      caelusSwordForwardDotBeforeCorrection: Number(dot.toFixed(4)),
      caelusSwordForwardVerified: true
    };
  }

  private addCollision(x: number, z: number, width: number, depth: number, yaw: number): void {
    const cosine = Math.abs(Math.cos(yaw));
    const sine = Math.abs(Math.sin(yaw));
    const boundsWidth = cosine * width + sine * depth;
    const boundsDepth = sine * width + cosine * depth;
    const inset = 0.35;
    (this.world.collisionBoxes as CollisionBox[]).push({
      minX: x - boundsWidth * 0.5 + inset,
      maxX: x + boundsWidth * 0.5 - inset,
      minZ: z - boundsDepth * 0.5 + inset,
      maxZ: z + boundsDepth * 0.5 - inset
    });
  }
}
