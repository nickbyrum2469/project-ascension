interface TownPoint { x: number; z: number; }
interface TownDistrict {
  id: string;
  label: string;
  purpose: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  anchor: TownPoint;
}
interface WalkCorridor { id: string; label: string; halfWidth: number; points: TownPoint[]; }
interface Sightline { id: string; label: string; from: TownPoint; to: TownPoint; halfWidth: number; }
interface TownBoundaryAudit {
  version: number;
  milestone: string;
  perimeter: TownPoint[];
  perimeterArea: number;
  perimeterWidth: number;
  perimeterDepth: number;
  compactness: number;
  districts: TownDistrict[];
  corridors: WalkCorridor[];
  sightlines: Array<Sightline & { blockedSamples: number }>;
  protectedRouteInsideBoundary: boolean;
  districtAnchorsInsideBoundary: boolean;
  districtOverlapPairs: string[];
  foundrySeparation: number;
  deadSpaceRatio: number;
  pass: boolean;
}

const FINAL_PERIMETER: TownPoint[] = [
  { x: -48, z: 18 }, { x: 48, z: 18 }, { x: 66, z: 42 }, { x: 92, z: 82 },
  { x: 102, z: 126 }, { x: 90, z: 166 }, { x: 58, z: 204 }, { x: 28, z: 224 },
  { x: -34, z: 224 }, { x: -70, z: 210 }, { x: -96, z: 178 }, { x: -104, z: 132 },
  { x: -92, z: 86 }, { x: -70, z: 48 }
];

const DISTRICTS: TownDistrict[] = [
  { id: "gate-watch", label: "Gate & Watch", purpose: "Arrival, guards, and orientation.", minX: -42, maxX: 42, minZ: 20, maxZ: 60, anchor: { x: 0, z: 38 } },
  { id: "main-street", label: "Main Street", purpose: "Primary civic and commercial spine.", minX: -18, maxX: 18, minZ: 48, maxZ: 190, anchor: { x: 0, z: 112 } },
  { id: "town-center", label: "Town Center", purpose: "Well, green, and central landmark.", minX: -30, maxX: 30, minZ: 86, maxZ: 136, anchor: { x: 0, z: 108 } },
  { id: "market", label: "Market Square", purpose: "Pedestrian trading court.", minX: -84, maxX: -24, minZ: 82, maxZ: 148, anchor: { x: -52, z: 116 } },
  { id: "guild-court", label: "Guild Court", purpose: "Guild Hall, contracts, and civic authority.", minX: 30, maxX: 86, minZ: 112, maxZ: 170, anchor: { x: 62, z: 136 } },
  { id: "residential-lane", label: "Residential Lane", purpose: "Homes and quieter town life.", minX: -92, maxX: -38, minZ: 150, maxZ: 218, anchor: { x: -62, z: 184 } },
  { id: "service-yard", label: "Service Yard", purpose: "Workshops, storage, carts, and deliveries.", minX: 50, maxX: 96, minZ: 62, maxZ: 108, anchor: { x: 76, z: 92 } },
  { id: "frontier-exit", label: "Frontier Supply Row & Exit", purpose: "Expedition preparation and northern transition.", minX: -34, maxX: 38, minZ: 174, maxZ: 224, anchor: { x: 0, z: 204 } }
];

const CORRIDORS: WalkCorridor[] = [
  { id: "gate-to-frontier", label: "Gate → Town Center → Frontier Exit", halfWidth: 7, points: [
    { x: 0, z: 20 }, { x: -1, z: 50 }, { x: 3, z: 78 }, { x: 0, z: 108 },
    { x: 4, z: 142 }, { x: 0, z: 176 }, { x: 0, z: 224 }
  ] },
  { id: "market-loop", label: "Market Loop", halfWidth: 5, points: [
    { x: 0, z: 90 }, { x: -22, z: 98 }, { x: -52, z: 116 }, { x: -62, z: 140 },
    { x: -32, z: 154 }, { x: 0, z: 150 }
  ] },
  { id: "guild-loop", label: "Guild Loop", halfWidth: 5, points: [
    { x: 0, z: 104 }, { x: 24, z: 110 }, { x: 58, z: 132 }, { x: 68, z: 154 },
    { x: 36, z: 166 }, { x: 0, z: 160 }
  ] },
  { id: "residential-loop", label: "Residential Loop", halfWidth: 4.5, points: [
    { x: 0, z: 154 }, { x: -28, z: 166 }, { x: -62, z: 184 }, { x: -72, z: 204 },
    { x: -36, z: 214 }, { x: 0, z: 198 }
  ] }
];

const SIGHTLINES: Sightline[] = [
  { id: "gate-to-center", label: "Gate frames Town Center", from: { x: 0, z: 24 }, to: { x: 0, z: 108 }, halfWidth: 3.5 },
  { id: "center-to-frontier", label: "Town Center reveals Frontier Exit", from: { x: 0, z: 108 }, to: { x: 0, z: 216 }, halfWidth: 3.5 }
];

const pointInPolygon = (point: TownPoint, polygon: TownPoint[]): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (((a.z > point.z) !== (b.z > point.z))
      && point.x < (b.x - a.x) * (point.z - a.z) / ((b.z - a.z) || 0.0001) + a.x) inside = !inside;
  }
  return inside;
};

const polygonArea = (polygon: TownPoint[]): number => {
  let area = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const next = polygon[(i + 1) % polygon.length];
    area += polygon[i].x * next.z - next.x * polygon[i].z;
  }
  return Math.abs(area) * 0.5;
};

const overlaps = (a: TownDistrict, b: TownDistrict): boolean => (
  a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ
);

export class CaelusTownBoundaryDirector {
  private readonly game: any;
  private readonly scene: any;
  private readonly world: any;
  private readonly debugMeshes: any[] = [];
  private overlay: HTMLElement | null = null;
  private visible = false;
  private readonly audit: TownBoundaryAudit;

  constructor(game: any) {
    this.game = game;
    this.scene = game.world.scene;
    this.world = game.world;
    this.audit = this.buildAudit();
    this.createWorldOverlay();
    this.createHudOverlay();
    this.installApi();
    this.scene.metadata = {
      ...(this.scene.metadata ?? {}),
      caelusTownBoundaryVersion: 1,
      caelusTownBoundaryMilestone: "Set 1 / Milestone 1.2",
      caelusTownBoundaryPass: this.audit.pass,
      caelusTownBoundaryArea: this.audit.perimeterArea,
      caelusTownBoundaryCompactness: this.audit.compactness,
      caelusTownBoundaryDistrictCount: DISTRICTS.length,
      caelusTownBoundaryCorridorCount: CORRIDORS.length
    };
    window.addEventListener("keydown", (event) => {
      if (event.code !== "F8") return;
      event.preventDefault();
      this.setVisible(!this.visible);
    });
    if (new URLSearchParams(window.location.search).has("townBoundary")) this.setVisible(true);
    console.info(`[Caelus Boundary] area=${this.audit.perimeterArea}, compactness=${this.audit.compactness}, pass=${this.audit.pass}.`);
  }

  private buildAudit(): TownBoundaryAudit {
    const xs = FINAL_PERIMETER.map((point) => point.x);
    const zs = FINAL_PERIMETER.map((point) => point.z);
    const width = Math.max(...xs) - Math.min(...xs);
    const depth = Math.max(...zs) - Math.min(...zs);
    const area = polygonArea(FINAL_PERIMETER);
    const compactness = area / (width * depth);
    const districtArea = DISTRICTS.reduce((total, district) => total + (district.maxX - district.minX) * (district.maxZ - district.minZ), 0);
    const districtOverlapPairs: string[] = [];
    for (let left = 0; left < DISTRICTS.length; left += 1) {
      for (let right = left + 1; right < DISTRICTS.length; right += 1) {
        const a = DISTRICTS[left];
        const b = DISTRICTS[right];
        if (!overlaps(a, b)) continue;
        const circulationOverlap = a.id === "main-street" || b.id === "main-street" || a.id === "town-center" || b.id === "town-center";
        if (!circulationOverlap) districtOverlapPairs.push(`${a.id}:${b.id}`);
      }
    }

    const collisionBoxes = Array.isArray(this.world.collisionBoxes) ? this.world.collisionBoxes : [];
    const sightlines = SIGHTLINES.map((sightline) => {
      let blockedSamples = 0;
      for (let index = 1; index < 30; index += 1) {
        const t = index / 30;
        const x = sightline.from.x + (sightline.to.x - sightline.from.x) * t;
        const z = sightline.from.z + (sightline.to.z - sightline.from.z) * t;
        if (collisionBoxes.some((box: any) => x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ)) blockedSamples += 1;
      }
      return { ...sightline, blockedSamples };
    });

    const protectedRouteInsideBoundary = CORRIDORS[0].points.every((point) => pointInPolygon(point, FINAL_PERIMETER));
    const districtAnchorsInsideBoundary = DISTRICTS.every((district) => pointInPolygon(district.anchor, FINAL_PERIMETER));
    const foundrySeparation = 250 - Math.max(...zs);
    const deadSpaceRatio = Math.max(0, 1 - Math.min(1, districtArea / area));
    const pass = protectedRouteInsideBoundary
      && districtAnchorsInsideBoundary
      && districtOverlapPairs.length === 0
      && foundrySeparation >= 20
      && area <= 43000
      && compactness >= 0.64
      && deadSpaceRatio <= 0.32;

    return {
      version: 1,
      milestone: "Set 1 / Milestone 1.2 — Define the Final Town Boundary",
      perimeter: FINAL_PERIMETER.map((point) => ({ ...point })),
      perimeterArea: Number(area.toFixed(2)),
      perimeterWidth: width,
      perimeterDepth: depth,
      compactness: Number(compactness.toFixed(3)),
      districts: DISTRICTS.map((district) => ({ ...district, anchor: { ...district.anchor } })),
      corridors: CORRIDORS.map((corridor) => ({ ...corridor, points: corridor.points.map((point) => ({ ...point })) })),
      sightlines,
      protectedRouteInsideBoundary,
      districtAnchorsInsideBoundary,
      districtOverlapPairs,
      foundrySeparation,
      deadSpaceRatio: Number(deadSpaceRatio.toFixed(3)),
      pass
    };
  }

  private createWorldOverlay(): void {
    const makePath = (name: string, points: TownPoint[], yOffset: number, color: any, closed = false): void => {
      const vectors = points.map((point) => new BABYLON.Vector3(point.x, this.world.heightAt(point.x, point.z) + yOffset, point.z));
      if (closed) vectors.push(vectors[0].clone());
      const mesh = BABYLON.MeshBuilder.CreateLines(name, { points: vectors }, this.scene);
      mesh.color = color;
      mesh.isPickable = false;
      mesh.setEnabled(false);
      mesh.metadata = { debugOnly: true, milestone: "1.2" };
      this.debugMeshes.push(mesh);
    };

    makePath("caelus-boundary-final-perimeter", FINAL_PERIMETER, 0.42, new BABYLON.Color3(0.15, 0.95, 1), true);
    for (const corridor of CORRIDORS) makePath(`caelus-boundary-corridor-${corridor.id}`, corridor.points, 0.48, new BABYLON.Color3(0.2, 1, 0.45));
    for (const sightline of SIGHTLINES) makePath(`caelus-boundary-sightline-${sightline.id}`, [sightline.from, sightline.to], 0.62, new BABYLON.Color3(1, 0.85, 0.18));

    for (const district of DISTRICTS) {
      makePath(`caelus-boundary-district-${district.id}`, [
        { x: district.minX, z: district.minZ }, { x: district.maxX, z: district.minZ },
        { x: district.maxX, z: district.maxZ }, { x: district.minX, z: district.maxZ }
      ], 0.52, new BABYLON.Color3(0.85, 0.35, 1), true);
      const marker = BABYLON.MeshBuilder.CreateCylinder(`caelus-boundary-anchor-${district.id}`, { height: 3.4, diameter: 0.55, tessellation: 8 }, this.scene);
      marker.position.set(district.anchor.x, this.world.heightAt(district.anchor.x, district.anchor.z) + 1.7, district.anchor.z);
      const material = new BABYLON.StandardMaterial(`caelus-boundary-anchor-material-${district.id}`, this.scene);
      material.diffuseColor = new BABYLON.Color3(0.8, 0.25, 1);
      material.emissiveColor = new BABYLON.Color3(0.35, 0.06, 0.5);
      marker.material = material;
      marker.isPickable = false;
      marker.setEnabled(false);
      marker.metadata = { debugOnly: true, districtId: district.id, milestone: "1.2" };
      this.debugMeshes.push(marker);
    }
  }

  private createHudOverlay(): void {
    const overlay = document.createElement("aside");
    overlay.id = "caelus-town-boundary-overlay";
    Object.assign(overlay.style, {
      position: "fixed", left: "18px", top: "18px", zIndex: "90000", width: "360px",
      maxHeight: "calc(100vh - 36px)", overflow: "auto", display: "none", padding: "14px",
      border: "1px solid rgba(120,235,255,.45)", borderRadius: "10px", background: "rgba(3,11,17,.94)",
      color: "#e9fbff", fontFamily: "Inter, system-ui, sans-serif", pointerEvents: "auto"
    });
    overlay.innerHTML = `<strong>SET 1.2 · FINAL TOWN BOUNDARY</strong><br><span style="opacity:.72">F8 toggles diagnostics</span>`
      + `<div style="font-size:12px;line-height:1.55;margin-top:12px">`
      + `Perimeter: <b>${this.audit.perimeterArea}</b> units²<br>`
      + `Compactness: <b>${this.audit.compactness}</b><br>`
      + `Districts: <b>${this.audit.districts.length}</b><br>`
      + `Walk corridors: <b>${this.audit.corridors.length}</b><br>`
      + `Foundry separation: <b>${this.audit.foundrySeparation}</b> units<br>`
      + `Dead-space ratio: <b>${this.audit.deadSpaceRatio}</b><br>`
      + `Milestone gate: <b style="color:${this.audit.pass ? "#66ff9c" : "#ff6d6d"}">${this.audit.pass ? "PASS" : "FAIL"}</b></div>`
      + this.audit.districts.map((district) => `<div style="margin:8px 0;padding:8px;border-left:3px solid #d15cff;background:rgba(255,255,255,.035)"><b>${district.label}</b><br><span style="font-size:11px;opacity:.75">${district.purpose}</span></div>`).join("");
    document.body.append(overlay);
    this.overlay = overlay;
  }

  private installApi(): void {
    const api = {
      audit: () => JSON.parse(JSON.stringify(this.audit)),
      show: () => this.setVisible(true),
      hide: () => this.setVisible(false),
      toggle: () => this.setVisible(!this.visible),
      visible: () => this.visible
    };
    (globalThis as any).__CAELUS_TOWN_BOUNDARY__ = api;
    const bridge = (globalThis as any).__ASCENSION_PLAYTEST__;
    if (bridge) {
      bridge.townBoundaryAudit = api.audit;
      bridge.setTownBoundaryVisible = (visible: boolean) => this.setVisible(Boolean(visible));
      bridge.townBoundaryVisible = api.visible;
    }
  }

  private setVisible(visible: boolean): boolean {
    this.visible = visible;
    for (const mesh of this.debugMeshes) mesh.setEnabled(visible);
    if (this.overlay) this.overlay.style.display = visible ? "block" : "none";
    document.documentElement.dataset.caelusTownBoundaryVisible = visible ? "true" : "false";
    return visible;
  }
}
