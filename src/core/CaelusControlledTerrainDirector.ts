interface TerrainPoint { x: number; z: number; }
interface TerrainZone extends TerrainPoint { id: string; label: string; radiusX: number; radiusZ: number; rise: number; color: string; }
interface TerrainPad extends TerrainPoint { id: string; width: number; depth: number; yaw: number; }
interface TerrainCorridor { id: string; halfWidth: number; points: TerrainPoint[]; }
interface TerrainSample { height: number; routeInfluence: number; padInfluence: number; }
interface PadAudit { id: string; variance: number; minimum: number; maximum: number; }
interface CorridorAudit { id: string; maximumGrade: number; averageGrade: number; }
interface ControlledTerrainAudit {
  version: number;
  milestone: string;
  buildingPads: PadAudit[];
  corridors: CorridorAudit[];
  maximumBuildingVariance: number;
  maximumCorridorGrade: number;
  minimumHeight: number;
  maximumHeight: number;
  heightRange: number;
  sampleCount: number;
  pass: boolean;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const smooth = (value: number): number => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount;

const FINAL_PERIMETER: TerrainPoint[] = [
  { x: -48, z: 18 }, { x: 48, z: 18 }, { x: 66, z: 42 }, { x: 92, z: 82 },
  { x: 102, z: 126 }, { x: 90, z: 166 }, { x: 58, z: 204 }, { x: 28, z: 224 },
  { x: -34, z: 224 }, { x: -70, z: 210 }, { x: -96, z: 178 }, { x: -104, z: 132 },
  { x: -92, z: 86 }, { x: -70, z: 48 }
];

const TERRAIN_ZONES: TerrainZone[] = [
  { id: "gate", label: "Gate apron", x: 0, z: 38, radiusX: 54, radiusZ: 28, rise: 0.05, color: "#536a54" },
  { id: "center", label: "Civic terrace", x: 0, z: 112, radiusX: 40, radiusZ: 38, rise: 0.55, color: "#566b58" },
  { id: "market", label: "Market terrace", x: -52, z: 116, radiusX: 38, radiusZ: 42, rise: 0.42, color: "#5f6b53" },
  { id: "guild", label: "Guild terrace", x: 62, z: 132, radiusX: 35, radiusZ: 42, rise: 0.82, color: "#52645a" },
  { id: "service", label: "Service terrace", x: 76, z: 102, radiusX: 27, radiusZ: 34, rise: 0.65, color: "#5a6558" },
  { id: "residential", label: "Residential rise", x: -58, z: 184, radiusX: 45, radiusZ: 34, rise: 1.02, color: "#4d684e" },
  { id: "frontier", label: "Frontier exit tier", x: 0, z: 204, radiusX: 40, radiusZ: 26, rise: 1.16, color: "#506452" }
];

const BUILDING_PADS: TerrainPad[] = [
  { id: "gate-cottage-west", x: -34, z: 43, width: 16, depth: 14, yaw: 0.17 },
  { id: "gate-cottage-east", x: 31, z: 47, width: 15, depth: 13, yaw: -0.21 },
  { id: "main-merchant-west", x: -27, z: 69, width: 18, depth: 15, yaw: 0.11 },
  { id: "main-workshop-east", x: 34, z: 73, width: 20, depth: 16, yaw: -0.2 },
  { id: "market-house-west", x: -59, z: 91, width: 16, depth: 14, yaw: 0.34 },
  { id: "market-merchant-north", x: -52, z: 121, width: 21, depth: 16, yaw: 0.58 },
  { id: "market-storehouse", x: -66, z: 146, width: 22, depth: 17, yaw: 0.28 },
  { id: "market-corner-home", x: -38, z: 155, width: 15, depth: 13, yaw: -0.19 },
  { id: "guild-hall", x: 48, z: 125, width: 25, depth: 19, yaw: -0.38 },
  { id: "guild-annex", x: 66, z: 151, width: 17, depth: 14, yaw: -0.08 },
  { id: "service-store", x: 78, z: 93, width: 20, depth: 16, yaw: -0.48 },
  { id: "service-cottage", x: 88, z: 124, width: 15, depth: 13, yaw: -0.19 },
  { id: "residence-west-a", x: -82, z: 174, width: 16, depth: 14, yaw: 0.44 },
  { id: "residence-west-b", x: -54, z: 188, width: 14, depth: 12, yaw: 0.12 },
  { id: "residence-east-a", x: 71, z: 181, width: 17, depth: 14, yaw: -0.31 },
  { id: "supply-house", x: 31, z: 184, width: 21, depth: 16, yaw: -0.12 },
  { id: "north-home", x: -24, z: 188, width: 15, depth: 13, yaw: 0.09 },
  { id: "north-workshop", x: 93, z: 166, width: 19, depth: 15, yaw: -0.51 }
];

const CORRIDORS: TerrainCorridor[] = [
  { id: "main-street", halfWidth: 7, points: [{ x: 0, z: 23 }, { x: -2, z: 49 }, { x: 5, z: 77 }, { x: -3, z: 105 }, { x: 6, z: 136 }, { x: -1, z: 166 }, { x: 0, z: 200 }] },
  { id: "market-loop", halfWidth: 5, points: [{ x: 1, z: 86 }, { x: -19, z: 94 }, { x: -39, z: 108 }, { x: -46, z: 126 }, { x: -35, z: 143 }, { x: -8, z: 149 }] },
  { id: "guild-loop", halfWidth: 5, points: [{ x: -1, z: 101 }, { x: 18, z: 106 }, { x: 38, z: 118 }, { x: 47, z: 137 }, { x: 31, z: 155 }, { x: 4, z: 161 }] },
  { id: "residential-loop", halfWidth: 4.5, points: [{ x: -5, z: 151 }, { x: -31, z: 163 }, { x: -61, z: 174 }, { x: -74, z: 192 }, { x: -42, z: 201 }, { x: -5, z: 194 }] },
  { id: "service-loop", halfWidth: 4.5, points: [{ x: 4, z: 73 }, { x: 30, z: 83 }, { x: 61, z: 93 }, { x: 83, z: 111 }, { x: 68, z: 137 }, { x: 45, z: 151 }] }
];

const pointInPolygon = (point: TerrainPoint, polygon: TerrainPoint[]): boolean => {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const intersects = ((currentPoint.z > point.z) !== (previousPoint.z > point.z))
      && point.x < (previousPoint.x - currentPoint.x) * (point.z - currentPoint.z)
      / ((previousPoint.z - currentPoint.z) || 0.0001) + currentPoint.x;
    if (intersects) inside = !inside;
  }
  return inside;
};

const segmentSample = (point: TerrainPoint, start: TerrainPoint, end: TerrainPoint): { distance: number; amount: number } => {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  const amount = lengthSquared <= 0.0001 ? 0 : clamp01(((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared);
  return {
    distance: Math.hypot(point.x - (start.x + dx * amount), point.z - (start.z + dz * amount)),
    amount
  };
};

const perimeterDistance = (point: TerrainPoint): number => {
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < FINAL_PERIMETER.length; index += 1) {
    const sample = segmentSample(point, FINAL_PERIMETER[index], FINAL_PERIMETER[(index + 1) % FINAL_PERIMETER.length]);
    nearest = Math.min(nearest, sample.distance);
  }
  return nearest;
};

const zoneInfluence = (point: TerrainPoint, zone: TerrainZone): number => {
  const radial = Math.hypot((point.x - zone.x) / zone.radiusX, (point.z - zone.z) / zone.radiusZ);
  return 1 - smooth((radial - 0.52) / 0.48);
};

const baseTerrainOffset = (x: number, z: number): number => {
  const longitudinal = smooth((z - 24) / 180);
  let weighted = 0.05 + 1.08 * longitudinal;
  let weight = 1;
  for (const zone of TERRAIN_ZONES) {
    const influence = zoneInfluence({ x, z }, zone) * 1.4;
    weighted += zone.rise * influence;
    weight += influence;
  }
  return weighted / weight;
};

const corridorSample = (point: TerrainPoint, corridor: TerrainCorridor): { distance: number; heightOffset: number } => {
  let nearestDistance = Number.POSITIVE_INFINITY;
  let nearestHeight = baseTerrainOffset(point.x, point.z);
  for (let index = 0; index < corridor.points.length - 1; index += 1) {
    const start = corridor.points[index];
    const end = corridor.points[index + 1];
    const sample = segmentSample(point, start, end);
    if (sample.distance >= nearestDistance) continue;
    nearestDistance = sample.distance;
    nearestHeight = lerp(baseTerrainOffset(start.x, start.z), baseTerrainOffset(end.x, end.z), sample.amount);
  }
  return { distance: nearestDistance, heightOffset: nearestHeight };
};

const padInfluence = (point: TerrainPoint, pad: TerrainPad): number => {
  const dx = point.x - pad.x;
  const dz = point.z - pad.z;
  const localX = dx * Math.cos(pad.yaw) - dz * Math.sin(pad.yaw);
  const localZ = dx * Math.sin(pad.yaw) + dz * Math.cos(pad.yaw);
  const edge = Math.max(
    Math.abs(localX) - (pad.width / 2 + 1.4),
    Math.abs(localZ) - (pad.depth / 2 + 1.4)
  );
  return edge <= 0 ? 1 : 1 - smooth(edge / 4.8);
};

const controlledTerrainSample = (x: number, z: number, gateBase: number): TerrainSample => {
  const point = { x, z };
  let weightedHeight = gateBase + baseTerrainOffset(x, z);
  let weight = 1;
  let routeInfluence = 0;
  for (const corridor of CORRIDORS) {
    const sample = corridorSample(point, corridor);
    const influence = (1 - smooth((sample.distance - corridor.halfWidth) / 6)) * 1.6;
    if (influence <= 0) continue;
    weightedHeight += (gateBase + sample.heightOffset) * influence;
    weight += influence;
    routeInfluence = Math.max(routeInfluence, influence / 1.6);
  }
  let height = weightedHeight / weight;
  let strongestPad = 0;
  let padHeight = height;
  for (const pad of BUILDING_PADS) {
    const influence = padInfluence(point, pad);
    if (influence <= strongestPad) continue;
    strongestPad = influence;
    padHeight = gateBase + baseTerrainOffset(pad.x, pad.z);
  }
  height = lerp(height, padHeight, strongestPad);
  return { height, routeInfluence, padInfluence: strongestPad };
};

export const installCaelusControlledTerrain = (DirectorClass: any): void => {
  const prototype = DirectorClass.prototype as any;
  if (prototype.__caelusControlledTerrainInstalled) return;
  const previousHeight = prototype.sculptedHeightAt;
  prototype.sculptedHeightAt = function controlledTerrainHeight(this: any, x: number, z: number): number {
    const previous = previousHeight.call(this, x, z);
    const sample = controlledTerrainSample(x, z, this.originalHeightAt(0, 26));
    const inside = pointInPolygon({ x, z }, FINAL_PERIMETER);
    if (!inside && sample.routeInfluence <= 0 && sample.padInfluence <= 0) return previous;
    const boundaryInfluence = inside ? smooth(perimeterDistance({ x, z }) / 13) : 0;
    const influence = Math.max(boundaryInfluence, sample.routeInfluence * 0.92, sample.padInfluence);
    return lerp(previous, sample.height, influence);
  };
  prototype.__caelusControlledTerrainInstalled = true;
};

export class CaelusControlledTerrainDirector {
  private readonly world: any;
  private readonly scene: any;
  private readonly debugMeshes: any[] = [];
  private overlay: HTMLElement | null = null;
  private visible = false;
  private readonly audit: ControlledTerrainAudit;

  constructor(game: any) {
    this.world = game.world;
    this.scene = game.world.scene;
    this.createTerrainFinishing();
    this.audit = this.buildAudit();
    this.createDebugGeometry();
    this.createHudOverlay();
    this.installApi();
    this.scene.metadata = {
      ...(this.scene.metadata ?? {}),
      caelusControlledTerrainVersion: 1,
      caelusControlledTerrainMilestone: "Set 1 / Milestone 1.3",
      caelusControlledTerrainPass: this.audit.pass,
      caelusControlledTerrainMaximumBuildingVariance: this.audit.maximumBuildingVariance,
      caelusControlledTerrainMaximumCorridorGrade: this.audit.maximumCorridorGrade
    };
    window.addEventListener("keydown", (event) => {
      if (event.code !== "F7") return;
      event.preventDefault();
      this.setVisible(!this.visible);
    });
    if (new URLSearchParams(window.location.search).has("terrainTiers")) this.setVisible(true);
    console.info(`[Caelus Terrain] pads=${BUILDING_PADS.length}, corridors=${CORRIDORS.length}, pass=${this.audit.pass}.`);
  }

  private createTerrainFinishing(): void {
    TERRAIN_ZONES.forEach((zone, index) => {
      const material = new BABYLON.StandardMaterial(`caelus-terrain-zone-material-${zone.id}`, this.scene);
      material.diffuseColor = BABYLON.Color3.FromHexString(zone.color);
      material.ambientColor = BABYLON.Color3.FromHexString(zone.color).scale(0.65);
      material.specularColor = BABYLON.Color3.Black();
      material.alpha = 0.34;
      material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
      material.forceDepthWrite = false;
      const positions: number[] = [zone.x, this.world.heightAt(zone.x, zone.z) + 0.025, zone.z];
      const indices: number[] = [];
      const segments = 18;
      for (let segment = 0; segment < segments; segment += 1) {
        const angle = segment / segments * Math.PI * 2;
        const variation = 0.9 + ((segment * 7 + index * 3) % 5) * 0.025;
        const x = zone.x + Math.sin(angle) * zone.radiusX * variation;
        const z = zone.z + Math.cos(angle) * zone.radiusZ * variation;
        positions.push(x, this.world.heightAt(x, z) + 0.025, z);
      }
      for (let segment = 0; segment < segments; segment += 1) {
        indices.push(0, 1 + segment, 1 + (segment + 1) % segments);
      }
      const normals: number[] = [];
      BABYLON.VertexData.ComputeNormals(positions, indices, normals);
      const data = new BABYLON.VertexData();
      data.positions = positions;
      data.indices = indices;
      data.normals = normals;
      const patch = new BABYLON.Mesh(`caelus-controlled-terrain-${zone.id}`, this.scene);
      data.applyToMesh(patch);
      patch.material = material;
      patch.isPickable = false;
      patch.receiveShadows = true;
      patch.metadata = { terrainTier: zone.id, terrainTierLabel: zone.label };
      patch.freezeWorldMatrix();
    });
  }

  private buildAudit(): ControlledTerrainAudit {
    const buildingPads = BUILDING_PADS.map((pad) => {
      const heights: number[] = [];
      for (const localX of [-pad.width / 2, 0, pad.width / 2]) {
        for (const localZ of [-pad.depth / 2, 0, pad.depth / 2]) {
          const x = pad.x + localX * Math.cos(pad.yaw) + localZ * Math.sin(pad.yaw);
          const z = pad.z - localX * Math.sin(pad.yaw) + localZ * Math.cos(pad.yaw);
          heights.push(this.world.heightAt(x, z));
        }
      }
      const minimum = Math.min(...heights);
      const maximum = Math.max(...heights);
      return { id: pad.id, variance: maximum - minimum, minimum, maximum };
    });
    const corridors = CORRIDORS.map((corridor) => {
      const grades: number[] = [];
      for (let index = 0; index < corridor.points.length - 1; index += 1) {
        const start = corridor.points[index];
        const end = corridor.points[index + 1];
        const distance = Math.hypot(end.x - start.x, end.z - start.z);
        const steps = Math.max(1, Math.ceil(distance / 2));
        let previous = start;
        for (let step = 1; step <= steps; step += 1) {
          const amount = step / steps;
          const current = { x: lerp(start.x, end.x, amount), z: lerp(start.z, end.z, amount) };
          const run = Math.hypot(current.x - previous.x, current.z - previous.z);
          grades.push(Math.abs(this.world.heightAt(current.x, current.z) - this.world.heightAt(previous.x, previous.z)) / Math.max(0.001, run));
          previous = current;
        }
      }
      return {
        id: corridor.id,
        maximumGrade: Math.max(...grades),
        averageGrade: grades.reduce((total, grade) => total + grade, 0) / Math.max(1, grades.length)
      };
    });
    const sampledHeights: number[] = [];
    for (let x = -104; x <= 102; x += 6) {
      for (let z = 18; z <= 224; z += 6) {
        if (pointInPolygon({ x, z }, FINAL_PERIMETER)) sampledHeights.push(this.world.heightAt(x, z));
      }
    }
    const maximumBuildingVariance = Math.max(...buildingPads.map((pad) => pad.variance));
    const maximumCorridorGrade = Math.max(...corridors.map((corridor) => corridor.maximumGrade));
    const minimumHeight = Math.min(...sampledHeights);
    const maximumHeight = Math.max(...sampledHeights);
    return {
      version: 1,
      milestone: "Set 1 / Milestone 1.3",
      buildingPads,
      corridors,
      maximumBuildingVariance,
      maximumCorridorGrade,
      minimumHeight,
      maximumHeight,
      heightRange: maximumHeight - minimumHeight,
      sampleCount: sampledHeights.length,
      pass: maximumBuildingVariance <= 0.08 && maximumCorridorGrade <= 0.07 && maximumHeight - minimumHeight <= 2.4
    };
  }

  private createDebugGeometry(): void {
    const colors = ["#65f5a3", "#f1d06f", "#6fc9f1", "#c48cf1", "#f18b82", "#83d49b", "#8ed2c6"];
    TERRAIN_ZONES.forEach((zone, index) => {
      const points: any[] = [];
      for (let segment = 0; segment <= 36; segment += 1) {
        const angle = segment / 36 * Math.PI * 2;
        const x = zone.x + Math.sin(angle) * zone.radiusX;
        const z = zone.z + Math.cos(angle) * zone.radiusZ;
        points.push(new BABYLON.Vector3(x, this.world.heightAt(x, z) + 0.3, z));
      }
      const line = BABYLON.MeshBuilder.CreateLines(`caelus-terrain-debug-zone-${zone.id}`, { points }, this.scene);
      line.color = BABYLON.Color3.FromHexString(colors[index % colors.length]);
      line.isPickable = false;
      this.debugMeshes.push(line);
    });
    for (const corridor of CORRIDORS) {
      const points = corridor.points.map((point) => new BABYLON.Vector3(point.x, this.world.heightAt(point.x, point.z) + 0.42, point.z));
      const line = BABYLON.MeshBuilder.CreateLines(`caelus-terrain-debug-corridor-${corridor.id}`, { points }, this.scene);
      line.color = BABYLON.Color3.FromHexString("#f6fbff");
      line.isPickable = false;
      this.debugMeshes.push(line);
    }
    BUILDING_PADS.forEach((pad) => {
      const marker = BABYLON.MeshBuilder.CreateCylinder(`caelus-terrain-debug-pad-${pad.id}`, { height: 0.15, diameter: 1.2, tessellation: 8 }, this.scene);
      marker.position.set(pad.x, this.world.heightAt(pad.x, pad.z) + 0.22, pad.z);
      const material = new BABYLON.StandardMaterial(`caelus-terrain-debug-pad-material-${pad.id}`, this.scene);
      material.emissiveColor = BABYLON.Color3.FromHexString("#fff4b1");
      material.disableLighting = true;
      marker.material = material;
      marker.isPickable = false;
      this.debugMeshes.push(marker);
    });
    this.debugMeshes.forEach((mesh) => mesh.setEnabled(false));
  }

  private createHudOverlay(): void {
    const overlay = document.createElement("section");
    overlay.id = "caelus-controlled-terrain-overlay";
    overlay.style.cssText = "position:fixed;top:72px;right:18px;width:330px;z-index:40;padding:14px 16px;background:rgba(8,19,22,.93);border:1px solid rgba(126,239,205,.5);border-radius:10px;color:#dffbf1;font:12px/1.45 ui-monospace,monospace;display:none;pointer-events:none;box-shadow:0 12px 32px rgba(0,0,0,.4)";
    overlay.innerHTML = `<strong style="display:block;color:#8ff2d1;font-size:14px;margin-bottom:7px">CONTROLLED TERRAIN · 1.3</strong>
      <div>Terrain tiers: ${TERRAIN_ZONES.length}</div>
      <div>Foundation pads: ${BUILDING_PADS.length}</div>
      <div>Walking corridors: ${CORRIDORS.length}</div>
      <div>Maximum pad variance: ${this.audit.maximumBuildingVariance.toFixed(3)}</div>
      <div>Maximum corridor grade: ${(this.audit.maximumCorridorGrade * 100).toFixed(2)}%</div>
      <div>Town height range: ${this.audit.heightRange.toFixed(3)}</div>
      <div style="margin-top:8px;color:${this.audit.pass ? "#8ff2a5" : "#ff9b91"}">Milestone gate: ${this.audit.pass ? "PASS" : "FAIL"}</div>
      <div style="margin-top:6px;color:#a9c7c0">F7 toggles this terrain diagnostic.</div>`;
    document.body.appendChild(overlay);
    this.overlay = overlay;
  }

  private installApi(): void {
    const bridge = (globalThis as any).__ASCENSION_PLAYTEST__;
    if (!bridge) return;
    bridge.controlledTerrainAudit = () => JSON.parse(JSON.stringify(this.audit));
    bridge.setControlledTerrainVisible = (visible: boolean) => this.setVisible(Boolean(visible));
    bridge.controlledTerrainVisible = () => this.visible;
  }

  private setVisible(visible: boolean): boolean {
    this.visible = visible;
    this.debugMeshes.forEach((mesh) => mesh.setEnabled(visible));
    if (this.overlay) this.overlay.style.display = visible ? "block" : "none";
    return visible;
  }
}
