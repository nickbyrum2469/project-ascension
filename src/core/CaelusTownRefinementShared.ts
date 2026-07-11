export interface TownPoint {
  x: number;
  z: number;
}

export interface RoadBand {
  id: string;
  start: TownPoint;
  end: TownPoint;
  halfWidth: number;
}

export interface GroundPad extends TownPoint {
  id: string;
  width: number;
  depth: number;
}

export interface SpecialBuilding extends GroundPad {
  label: string;
  role: "guild" | "town-hall" | "blacksmith";
  height: number;
  doorSide: "north" | "south";
  collectorZ: number;
  wallColor: string;
  roofColor: string;
  accentColor: string;
}

export interface TownRefinementAudit {
  version: number;
  milestone: string;
  terrainUpdated: boolean;
  groundedRoadMeshCount: number;
  roadMaterialCount: number;
  disabledGateApronCount: number;
  minimumRoadLift: number;
  maximumRoadLift: number;
  removedGhostGateMeshCount: number;
  activeGhostGateMeshCount: number;
  questBoardPosition: TownPoint;
  questBoardRelocated: boolean;
  specialBuildingCount: number;
  specialBuildingIds: string[];
  convertedHouseCount: number;
  transparentWindowPaneCount: number;
  activeGlowBlockWindowCount: number;
  pass: boolean;
}

export const ROAD_COLOR = "#877454";
export const ROAD_SURFACE_OFFSET = 0.018;
export const QUEST_BOARD_POSITION: TownPoint = { x: 18, z: 52 };
export const LEGACY_BOARD_POSITION: TownPoint = { x: -24, z: 52 };

export const SPECIAL_BUILDINGS: SpecialBuilding[] = [
  {
    id: "adventurers-guild",
    label: "ADVENTURERS' GUILD",
    role: "guild",
    x: 47,
    z: 41,
    width: 44,
    depth: 24,
    height: 13.5,
    doorSide: "north",
    collectorZ: 70,
    wallColor: "#8f927b",
    roofColor: "#315d68",
    accentColor: "#3d3028"
  },
  {
    id: "windscar-hall",
    label: "WINDSCAR HALL",
    role: "town-hall",
    x: -24,
    z: 150,
    width: 20,
    depth: 30,
    height: 15,
    doorSide: "south",
    collectorZ: 124,
    wallColor: "#aaa17f",
    roofColor: "#42665c",
    accentColor: "#49392d"
  },
  {
    id: "riftiron-forge",
    label: "RIFTIRON FORGE",
    role: "blacksmith",
    x: -78,
    z: 41,
    width: 30,
    depth: 22,
    height: 11.5,
    doorSide: "north",
    collectorZ: 70,
    wallColor: "#8e8b72",
    roofColor: "#454f4d",
    accentColor: "#403028"
  }
];

export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
export const smooth = (value: number): number => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
export const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount;
export const round = (value: number, precision = 3): number => Number(value.toFixed(precision));
export const distance2d = (a: TownPoint, b: TownPoint): number => Math.hypot(a.x - b.x, a.z - b.z);

export const makeMaterial = (
  scene: any,
  name: string,
  color: string,
  options: { alpha?: number; emissive?: string; metallic?: number } = {}
): any => {
  const material = new BABYLON.StandardMaterial(name, scene);
  const base = BABYLON.Color3.FromHexString(color);
  material.diffuseColor = base;
  material.ambientColor = base.scale(0.32);
  material.specularColor = options.metallic
    ? BABYLON.Color3.FromHexString("#889495").scale(options.metallic)
    : BABYLON.Color3.Black();
  material.emissiveColor = options.emissive
    ? BABYLON.Color3.FromHexString(options.emissive)
    : BABYLON.Color3.Black();
  material.alpha = options.alpha ?? 1;
  material.transparencyMode = material.alpha < 1
    ? BABYLON.Material.MATERIAL_ALPHABLEND
    : BABYLON.Material.MATERIAL_OPAQUE;
  material.forceDepthWrite = material.alpha >= 1;
  material.backFaceCulling = false;
  return material;
};
