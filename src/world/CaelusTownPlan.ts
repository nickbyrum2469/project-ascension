export interface TownPlanPoint {
  x: number;
  z: number;
}

export interface TownPlanAnchor extends TownPlanPoint {
  id: string;
  label: string;
  districtId: string;
  landmark: string;
}

export interface TownPlanDistrict {
  id: string;
  label: string;
  purpose: string;
  color: string;
  polygon: TownPlanPoint[];
  anchorId: string;
  requiredConnections: string[];
}

export interface TownPlanCorridor {
  id: string;
  label: string;
  purpose: string;
  color: string;
  halfWidth: number;
  critical: boolean;
  points: TownPlanPoint[];
}

export interface TownPlanSightline {
  id: string;
  label: string;
  from: TownPlanPoint;
  to: TownPlanPoint;
  halfWidth: number;
  requiredClear: boolean;
}

export interface CaelusTownPlan {
  version: number;
  milestone: string;
  identity: string;
  surveyBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  boundary: TownPlanPoint[];
  anchors: TownPlanAnchor[];
  districts: TownPlanDistrict[];
  corridors: TownPlanCorridor[];
  sightlines: TownPlanSightline[];
  requiredAdjacency: Array<[string, string]>;
}

export const CAELUS_FINAL_TOWN_PLAN: CaelusTownPlan = {
  version: 2,
  milestone: "Set 1 / Milestone 1.2 — Final Town Boundary",
  identity: "Compact Floor-One frontier town",
  surveyBounds: {
    minX: -125,
    maxX: 125,
    minZ: 0,
    maxZ: 235
  },
  boundary: [
    { x: -36, z: 18 },
    { x: 36, z: 18 },
    { x: 52, z: 44 },
    { x: 83, z: 67 },
    { x: 107, z: 82 },
    { x: 116, z: 112 },
    { x: 112, z: 140 },
    { x: 88, z: 168 },
    { x: 54, z: 190 },
    { x: 34, z: 222 },
    { x: 0, z: 232 },
    { x: -34, z: 225 },
    { x: -65, z: 221 },
    { x: -101, z: 197 },
    { x: -112, z: 171 },
    { x: -104, z: 145 },
    { x: -88, z: 125 },
    { x: -83, z: 96 },
    { x: -62, z: 73 },
    { x: -47, z: 48 }
  ],
  anchors: [
    {
      id: "arrival-gate",
      label: "Arrival Gate",
      districtId: "gate-watch",
      landmark: "Gatehouse and watch bell",
      x: 0,
      z: 28
    },
    {
      id: "main-street-south",
      label: "Main Street South",
      districtId: "main-street",
      landmark: "First framed street view",
      x: 0,
      z: 68
    },
    {
      id: "market-square",
      label: "Market Square",
      districtId: "market-square",
      landmark: "Pedestrian market court",
      x: -48,
      z: 121
    },
    {
      id: "town-center",
      label: "Town Center",
      districtId: "town-center",
      landmark: "Town green and well",
      x: 0,
      z: 120
    },
    {
      id: "guild-court",
      label: "Guild Court",
      districtId: "guild-court",
      landmark: "Guild Hall and contract board",
      x: 61,
      z: 133
    },
    {
      id: "residential-lane",
      label: "Residential Lane",
      districtId: "residential-lane",
      landmark: "Lantern bend and shared yard",
      x: -68,
      z: 183
    },
    {
      id: "service-yard",
      label: "Service Yard",
      districtId: "service-yard",
      landmark: "Workshop yard and storage crane",
      x: 78,
      z: 105
    },
    {
      id: "frontier-supply",
      label: "Frontier Supply Row",
      districtId: "frontier-supply",
      landmark: "Outfitter and expedition staging",
      x: 15,
      z: 190
    },
    {
      id: "frontier-exit",
      label: "Frontier Exit",
      districtId: "frontier-supply",
      landmark: "Exit post and Foundry route sightline",
      x: 0,
      z: 220
    }
  ],
  districts: [
    {
      id: "gate-watch",
      label: "Gate and Watch District",
      purpose: "Arrival, safety, and the first uninterrupted view into town",
      color: "#4fb7d8",
      anchorId: "arrival-gate",
      requiredConnections: ["main-street"],
      polygon: [
        { x: -38, z: 28 }, { x: 38, z: 28 }, { x: 47, z: 50 },
        { x: 34, z: 64 }, { x: -34, z: 64 }, { x: -47, z: 50 }
      ]
    },
    {
      id: "main-street",
      label: "Main Street",
      purpose: "Primary readable navigation spine from gate to frontier",
      color: "#d9c77a",
      anchorId: "main-street-south",
      requiredConnections: ["gate-watch", "town-center", "market-square", "guild-court", "frontier-supply"],
      polygon: [
        { x: -12, z: 50 }, { x: 12, z: 50 }, { x: 15, z: 86 },
        { x: 13, z: 116 }, { x: 14, z: 153 }, { x: 11, z: 188 },
        { x: -11, z: 188 }, { x: -14, z: 153 }, { x: -13, z: 116 },
        { x: -15, z: 86 }
      ]
    },
    {
      id: "market-square",
      label: "Market Square",
      purpose: "Compact pedestrian commerce court west of the main route",
      color: "#d58f56",
      anchorId: "market-square",
      requiredConnections: ["main-street", "town-center", "residential-lane"],
      polygon: [
        { x: -17, z: 88 }, { x: -48, z: 91 }, { x: -75, z: 108 },
        { x: -78, z: 136 }, { x: -57, z: 153 }, { x: -22, z: 151 },
        { x: -9, z: 134 }, { x: -10, z: 105 }
      ]
    },
    {
      id: "town-center",
      label: "Town Center",
      purpose: "Shared landmark space joining all major districts",
      color: "#6fbf78",
      anchorId: "town-center",
      requiredConnections: ["main-street", "market-square", "guild-court", "residential-lane", "frontier-supply"],
      polygon: [
        { x: -18, z: 98 }, { x: 18, z: 98 }, { x: 35, z: 111 },
        { x: 34, z: 139 }, { x: 18, z: 154 }, { x: -18, z: 154 },
        { x: -36, z: 139 }, { x: -35, z: 112 }
      ]
    },
    {
      id: "guild-court",
      label: "Guild Court",
      purpose: "Civic identity, contracts, and an obvious Guild Hall approach",
      color: "#7d8fd7",
      anchorId: "guild-court",
      requiredConnections: ["main-street", "town-center", "service-yard", "frontier-supply"],
      polygon: [
        { x: 20, z: 102 }, { x: 55, z: 102 }, { x: 85, z: 117 },
        { x: 91, z: 145 }, { x: 73, z: 168 }, { x: 39, z: 164 },
        { x: 18, z: 145 }
      ]
    },
    {
      id: "residential-lane",
      label: "Residential Lane",
      purpose: "Quiet lived-in loop with homes, shared yards, and a return path",
      color: "#b58ac9",
      anchorId: "residential-lane",
      requiredConnections: ["market-square", "town-center", "frontier-supply"],
      polygon: [
        { x: -25, z: 151 }, { x: -54, z: 155 }, { x: -91, z: 168 },
        { x: -102, z: 190 }, { x: -77, z: 213 }, { x: -38, z: 220 },
        { x: -19, z: 201 }, { x: -15, z: 174 }
      ]
    },
    {
      id: "service-yard",
      label: "Service Yard",
      purpose: "Workshops, storage, deliveries, and utility activity away from the market",
      color: "#aa865f",
      anchorId: "service-yard",
      requiredConnections: ["main-street", "guild-court"],
      polygon: [
        { x: 36, z: 69 }, { x: 72, z: 71 }, { x: 101, z: 85 },
        { x: 108, z: 113 }, { x: 97, z: 139 }, { x: 69, z: 151 },
        { x: 45, z: 142 }, { x: 32, z: 108 }
      ]
    },
    {
      id: "frontier-supply",
      label: "Frontier Supply Row",
      purpose: "The town-to-wilderness transition and expedition staging area",
      color: "#5ea6a0",
      anchorId: "frontier-supply",
      requiredConnections: ["main-street", "town-center", "guild-court", "residential-lane"],
      polygon: [
        { x: -18, z: 160 }, { x: 18, z: 160 }, { x: 43, z: 177 },
        { x: 38, z: 207 }, { x: 22, z: 222 }, { x: -22, z: 222 },
        { x: -42, z: 205 }, { x: -39, z: 179 }
      ]
    }
  ],
  corridors: [
    {
      id: "primary-spine",
      label: "Arrival Gate → Town Center → Frontier Exit",
      purpose: "Protected player, NPC, and camera route",
      color: "#73f1ff",
      halfWidth: 7.5,
      critical: true,
      points: [
        { x: 0, z: 20 }, { x: 0, z: 48 }, { x: 1, z: 76 },
        { x: 0, z: 108 }, { x: 1, z: 142 }, { x: 0, z: 174 },
        { x: 0, z: 202 }, { x: 0, z: 220 }
      ]
    },
    {
      id: "market-cut-through",
      label: "Market Cut-Through",
      purpose: "Main Street to Market Square to Town Center",
      color: "#f2a65a",
      halfWidth: 4.5,
      critical: false,
      points: [
        { x: -2, z: 94 }, { x: -22, z: 101 }, { x: -48, z: 119 },
        { x: -34, z: 139 }, { x: -5, z: 150 }
      ]
    },
    {
      id: "residential-loop",
      label: "Residential Loop",
      purpose: "Town Center through homes and back toward the frontier supply row",
      color: "#d39be8",
      halfWidth: 4.25,
      critical: false,
      points: [
        { x: -5, z: 151 }, { x: -31, z: 163 }, { x: -68, z: 180 },
        { x: -61, z: 204 }, { x: -28, z: 213 }, { x: -4, z: 192 }
      ]
    },
    {
      id: "guild-shortcut",
      label: "Guild Shortcut",
      purpose: "Main Street side route to Guild Court and back north",
      color: "#99a8ff",
      halfWidth: 4.5,
      critical: false,
      points: [
        { x: 2, z: 105 }, { x: 25, z: 112 }, { x: 53, z: 130 },
        { x: 43, z: 153 }, { x: 4, z: 161 }
      ]
    },
    {
      id: "service-access",
      label: "Service Access",
      purpose: "Deliveries and work traffic without cutting through the market",
      color: "#c39a6b",
      halfWidth: 4,
      critical: false,
      points: [
        { x: 4, z: 74 }, { x: 32, z: 82 }, { x: 70, z: 100 },
        { x: 65, z: 126 }, { x: 45, z: 149 }
      ]
    }
  ],
  sightlines: [
    {
      id: "gate-to-center",
      label: "Arrival Gate to Town Center landmark",
      from: { x: 0, z: 24 },
      to: { x: 0, z: 120 },
      halfWidth: 5.5,
      requiredClear: true
    },
    {
      id: "center-to-frontier",
      label: "Town Center to Frontier Exit",
      from: { x: 0, z: 120 },
      to: { x: 0, z: 220 },
      halfWidth: 5.5,
      requiredClear: true
    },
    {
      id: "center-to-market",
      label: "Town Center to Market landmark",
      from: { x: 0, z: 120 },
      to: { x: -48, z: 121 },
      halfWidth: 3.5,
      requiredClear: true
    },
    {
      id: "center-to-guild",
      label: "Town Center to Guild Hall landmark",
      from: { x: 0, z: 120 },
      to: { x: 61, z: 133 },
      halfWidth: 3.5,
      requiredClear: true
    }
  ],
  requiredAdjacency: [
    ["gate-watch", "main-street"],
    ["main-street", "town-center"],
    ["main-street", "market-square"],
    ["main-street", "guild-court"],
    ["main-street", "frontier-supply"],
    ["market-square", "town-center"],
    ["market-square", "residential-lane"],
    ["town-center", "guild-court"],
    ["town-center", "residential-lane"],
    ["town-center", "frontier-supply"],
    ["guild-court", "service-yard"],
    ["guild-court", "frontier-supply"],
    ["residential-lane", "frontier-supply"]
  ]
};

export const polygonArea = (polygon: TownPlanPoint[]): number => {
  let total = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    total += current.x * next.z - next.x * current.z;
  }
  return Math.abs(total) * 0.5;
};

export const polygonBounds = (polygon: TownPlanPoint[]): { minX: number; maxX: number; minZ: number; maxZ: number } => ({
  minX: Math.min(...polygon.map((point) => point.x)),
  maxX: Math.max(...polygon.map((point) => point.x)),
  minZ: Math.min(...polygon.map((point) => point.z)),
  maxZ: Math.max(...polygon.map((point) => point.z))
});

export const pointInPolygon = (point: TownPlanPoint, polygon: TownPlanPoint[]): boolean => {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const crosses = (currentPoint.z > point.z) !== (previousPoint.z > point.z)
      && point.x < (previousPoint.x - currentPoint.x) * (point.z - currentPoint.z)
      / (previousPoint.z - currentPoint.z) + currentPoint.x;
    if (crosses) inside = !inside;
  }
  return inside;
};

export const distanceToSegment = (point: TownPlanPoint, start: TownPlanPoint, end: TownPlanPoint): number => {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared <= 0.000001) return Math.hypot(point.x - start.x, point.z - start.z);
  const amount = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared));
  return Math.hypot(point.x - (start.x + dx * amount), point.z - (start.z + dz * amount));
};

export const distanceToPolyline = (point: TownPlanPoint, points: TownPlanPoint[]): number => {
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < points.length - 1; index += 1) {
    distance = Math.min(distance, distanceToSegment(point, points[index], points[index + 1]));
  }
  return distance;
};

export const samplePolyline = (points: TownPlanPoint[], step = 1.5): TownPlanPoint[] => {
  const samples: TownPlanPoint[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const length = Math.hypot(end.x - start.x, end.z - start.z);
    const count = Math.max(1, Math.ceil(length / step));
    for (let sample = 0; sample < count; sample += 1) {
      const amount = sample / count;
      samples.push({
        x: start.x + (end.x - start.x) * amount,
        z: start.z + (end.z - start.z) * amount
      });
    }
  }
  samples.push({ ...points[points.length - 1] });
  return samples;
};
