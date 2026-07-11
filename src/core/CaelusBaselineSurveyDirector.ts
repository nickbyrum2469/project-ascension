interface SurveyBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface SurveyBox {
  id: string;
  name: string;
  category: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
  enabled: boolean;
  material: string | null;
  vertices: number;
  metadata: Record<string, unknown>;
  samples?: Array<{ x: number; z: number }>;
}

interface SurveyPoint {
  id: string;
  name: string;
  category: string;
  x: number;
  y: number;
  z: number;
  enabled: boolean;
}

interface TerrainSample {
  x: number;
  z: number;
  height: number;
  slope: number;
}

interface SurveyFinding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  code: string;
  message: string;
  subjects: string[];
}

interface SurveyRoutePoint {
  id: string;
  label: string;
  x: number;
  z: number;
  height: number;
}

interface CaelusBaselineSurveyReport {
  version: number;
  milestone: string;
  generatedAt: string;
  bounds: SurveyBounds;
  summary: Record<string, number>;
  roads: SurveyBox[];
  frontages: SurveyBox[];
  buildings: SurveyBox[];
  walls: SurveyBox[];
  civicObjects: SurveyBox[];
  npcs: SurveyPoint[];
  questObjects: SurveyPoint[];
  collisionVolumes: SurveyBox[];
  terrain: {
    step: number;
    samples: TerrainSample[];
    minHeight: number;
    maxHeight: number;
    heightRange: number;
    maxSlope: number;
    roughSampleCount: number;
  };
  protectedRoute: {
    points: SurveyRoutePoint[];
    blockedSamples: Array<{ x: number; z: number; collisionId: string }>;
  };
  findings: SurveyFinding[];
}

interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const TOWN_BOUNDS: SurveyBounds = {
  minX: -125,
  maxX: 125,
  minZ: 0,
  maxZ: 230
};

const TERRAIN_STEP = 10;
const ROUGH_SLOPE = 0.34;
const BUILDING_GROUND_RANGE = 0.45;

const ROUTE_DEFINITION = [
  { id: "gate-exterior", label: "Gate exterior", x: 0, z: 5 },
  { id: "gate-interior", label: "Gate interior", x: 0, z: 34 },
  { id: "main-south", label: "Main Street south", x: 2, z: 67 },
  { id: "town-center", label: "Town center", x: 0, z: 108 },
  { id: "main-north", label: "Main Street north", x: 2, z: 161 },
  { id: "supply-row", label: "Frontier supply row", x: 0, z: 196 },
  { id: "frontier-exit", label: "Frontier exit", x: 0, z: 220 }
];

const round = (value: number, precision = 3): number => Number(value.toFixed(precision));

const overlaps = (a: SurveyBox, b: SurveyBox, inset = 0): boolean => (
  a.minX + inset < b.maxX - inset
  && a.maxX - inset > b.minX + inset
  && a.minZ + inset < b.maxZ - inset
  && a.maxZ - inset > b.minZ + inset
);

const pointInside = (x: number, z: number, box: SurveyBox, margin = 0): boolean => (
  x >= box.minX - margin
  && x <= box.maxX + margin
  && z >= box.minZ - margin
  && z <= box.maxZ + margin
);

const safeMetadata = (metadata: unknown): Record<string, unknown> => {
  if (!metadata || typeof metadata !== "object") return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (["string", "number", "boolean"].includes(typeof value) || value === null) result[key] = value;
  }
  return result;
};

export class CaelusBaselineSurveyDirector {
  private readonly game: any;
  private readonly scene: any;
  private readonly world: any;
  private overlay: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private report: CaelusBaselineSurveyReport;
  private visible = false;

  constructor(game: any) {
    this.game = game;
    this.scene = game.world.scene;
    this.world = game.world;
    this.report = this.buildReport();
    this.scene.metadata = {
      ...(this.scene.metadata ?? {}),
      caelusBaselineSurveyVersion: 1,
      caelusBaselineSurveyMilestone: "Set 1 / Milestone 1.1",
      caelusBaselineSurveySummary: { ...this.report.summary },
      caelusBaselineSurveyFindingCount: this.report.findings.length
    };

    this.installOverlay();
    this.installApi();

    const params = new URLSearchParams(window.location.search);
    if (params.has("survey") || params.has("citySurvey")) this.setVisible(true);
    window.addEventListener("keydown", (event) => {
      if (event.code !== "F9") return;
      event.preventDefault();
      this.setVisible(!this.visible);
    });

    console.info(
      `[Caelus Survey] ${this.report.summary.buildings} buildings, ${this.report.summary.roads} roads, `
      + `${this.report.summary.collisionVolumes} collision volumes, ${this.report.findings.length} findings.`
    );
  }

  private buildReport(): CaelusBaselineSurveyReport {
    const roads = this.collectMeshes("road", (name) => (
      !name.includes("curb")
      && !name.includes("drain")
      && !name.includes("frontage")
      && (
        name.includes("main-street")
        || name.includes("market-lane")
        || name.includes("guild-lane")
        || name.includes("residential-loop")
        || name.includes("service-lane")
        || name.includes("road-surface")
        || name.includes("town-center")
        || name.includes("market-square")
      )
    ), true);

    const frontages = this.collectMeshes("frontage", (name) => name.includes("frontage"));
    const buildings = this.collectMeshes("building", (name, mesh) => (
      name.startsWith("caelus-integrated-")
      && name.endsWith("-body")
      || Boolean(mesh.metadata?.buildingId) && name.includes("body")
    ));
    const walls = this.collectMeshes("wall", (name) => (
      name.includes("wall")
      || name.includes("gate-tower")
      || name.includes("gate-lintel")
      || name.includes("gate-cap")
      || name.includes("parapet")
      || name.includes("merlon")
    ));
    const civicObjects = this.collectMeshes("civic", (name) => (
      name.includes("well")
      || name.includes("market-court")
      || name.includes("market-counter")
      || name.includes("market-canopy")
      || name.includes("guild-court")
      || name.includes("guild-quest-board")
      || name.includes("town-green")
    ));
    const npcs = this.collectPoints("npc", [
      "citizen", "mara", "npc", "guard", "merchant", "vendor", "worker", "adventurer", "warden"
    ]);
    const questObjects = this.collectPoints("quest", [
      "quest", "contract", "board", "marker", "mara", "boar"
    ]);
    const collisionVolumes = this.collectCollisions();
    const terrain = this.collectTerrain();
    const protectedRoute = this.collectProtectedRoute(collisionVolumes);
    const findings = this.buildFindings(
      roads,
      frontages,
      buildings,
      walls,
      civicObjects,
      npcs,
      questObjects,
      collisionVolumes,
      terrain,
      protectedRoute
    );

    return {
      version: 1,
      milestone: "Set 1 / Milestone 1.1 — Baseline City Survey",
      generatedAt: new Date().toISOString(),
      bounds: { ...TOWN_BOUNDS },
      summary: {
        roads: roads.length,
        frontages: frontages.length,
        buildings: buildings.length,
        walls: walls.length,
        civicObjects: civicObjects.length,
        npcs: npcs.length,
        questObjects: questObjects.length,
        collisionVolumes: collisionVolumes.length,
        terrainSamples: terrain.samples.length,
        protectedRoutePoints: protectedRoute.points.length,
        blockedRouteSamples: protectedRoute.blockedSamples.length,
        findings: findings.length,
        criticalFindings: findings.filter((finding) => finding.severity === "critical").length,
        highFindings: findings.filter((finding) => finding.severity === "high").length
      },
      roads,
      frontages,
      buildings,
      walls,
      civicObjects,
      npcs,
      questObjects,
      collisionVolumes,
      terrain,
      protectedRoute,
      findings
    };
  }

  private collectMeshes(
    category: string,
    predicate: (name: string, mesh: any) => boolean,
    includeSamples = false
  ): SurveyBox[] {
    const records: SurveyBox[] = [];
    for (const mesh of this.scene.meshes as any[]) {
      const name = String(mesh.name ?? "").toLowerCase();
      if (!predicate(name, mesh)) continue;
      const record = this.meshRecord(mesh, category, includeSamples);
      if (!record || !this.inTown(record.centerX, record.centerZ)) continue;
      records.push(record);
    }
    return records.sort((a, b) => a.name.localeCompare(b.name));
  }

  private meshRecord(mesh: any, category: string, includeSamples: boolean): SurveyBox | null {
    try {
      mesh.computeWorldMatrix?.(true);
      const bounds = mesh.getBoundingInfo?.().boundingBox;
      const minimum = bounds?.minimumWorld;
      const maximum = bounds?.maximumWorld;
      if (!minimum || !maximum) return null;
      const minX = Number(minimum.x);
      const maxX = Number(maximum.x);
      const minZ = Number(minimum.z);
      const maxZ = Number(maximum.z);
      if (![minX, maxX, minZ, maxZ].every(Number.isFinite)) return null;
      const record: SurveyBox = {
        id: `${category}-${String(mesh.uniqueId ?? mesh.name)}`,
        name: String(mesh.name ?? "unnamed"),
        category,
        minX: round(minX),
        maxX: round(maxX),
        minZ: round(minZ),
        maxZ: round(maxZ),
        centerX: round((minX + maxX) * 0.5),
        centerZ: round((minZ + maxZ) * 0.5),
        width: round(maxX - minX),
        depth: round(maxZ - minZ),
        enabled: Boolean(mesh.isEnabled?.()),
        material: mesh.material?.name ? String(mesh.material.name) : null,
        vertices: Number(mesh.getTotalVertices?.() ?? 0),
        metadata: safeMetadata(mesh.metadata)
      };
      if (includeSamples) record.samples = this.meshSamples(mesh);
      return record;
    } catch {
      return null;
    }
  }

  private meshSamples(mesh: any): Array<{ x: number; z: number }> {
    const data = mesh.getVerticesData?.(BABYLON.VertexBuffer.PositionKind) as number[] | null;
    if (!data || data.length < 3) return [];
    const matrix = mesh.getWorldMatrix();
    const vertexCount = Math.floor(data.length / 3);
    const stride = Math.max(1, Math.floor(vertexCount / 220));
    const samples: Array<{ x: number; z: number }> = [];
    for (let index = 0; index < vertexCount; index += stride) {
      const offset = index * 3;
      const world = BABYLON.Vector3.TransformCoordinates(
        new BABYLON.Vector3(data[offset], data[offset + 1], data[offset + 2]),
        matrix
      );
      samples.push({ x: round(world.x), z: round(world.z) });
    }
    return samples;
  }

  private collectPoints(category: string, tokens: string[]): SurveyPoint[] {
    const records: SurveyPoint[] = [];
    const seen = new Set<string>();
    const nodes = [...this.scene.transformNodes, ...this.scene.meshes] as any[];
    for (const node of nodes) {
      const name = String(node.name ?? "");
      const lower = name.toLowerCase();
      if (!tokens.some((token) => lower.includes(token))) continue;
      const position = node.getAbsolutePosition?.() ?? node.absolutePosition ?? node.position;
      if (!position || !this.inTown(Number(position.x), Number(position.z))) continue;
      const key = `${name}:${round(Number(position.x), 1)}:${round(Number(position.z), 1)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      records.push({
        id: `${category}-${String(node.uniqueId ?? name)}`,
        name,
        category,
        x: round(Number(position.x)),
        y: round(Number(position.y)),
        z: round(Number(position.z)),
        enabled: typeof node.isEnabled === "function" ? Boolean(node.isEnabled()) : true
      });
    }
    return records.sort((a, b) => a.name.localeCompare(b.name));
  }

  private collectCollisions(): SurveyBox[] {
    const boxes = Array.isArray(this.world.collisionBoxes) ? this.world.collisionBoxes as CollisionBox[] : [];
    return boxes.map((box, index) => ({
      id: `collision-${index}`,
      name: `collision-${index}`,
      category: "collision",
      minX: round(box.minX),
      maxX: round(box.maxX),
      minZ: round(box.minZ),
      maxZ: round(box.maxZ),
      centerX: round((box.minX + box.maxX) * 0.5),
      centerZ: round((box.minZ + box.maxZ) * 0.5),
      width: round(box.maxX - box.minX),
      depth: round(box.maxZ - box.minZ),
      enabled: true,
      material: null,
      vertices: 0,
      metadata: {}
    })).filter((box) => this.inTown(box.centerX, box.centerZ));
  }

  private collectTerrain(): CaelusBaselineSurveyReport["terrain"] {
    const samples: TerrainSample[] = [];
    let minHeight = Number.POSITIVE_INFINITY;
    let maxHeight = Number.NEGATIVE_INFINITY;
    let maxSlope = 0;
    let roughSampleCount = 0;
    const gradientStep = 2;
    for (let z = TOWN_BOUNDS.minZ; z <= TOWN_BOUNDS.maxZ; z += TERRAIN_STEP) {
      for (let x = TOWN_BOUNDS.minX; x <= TOWN_BOUNDS.maxX; x += TERRAIN_STEP) {
        const height = Number(this.world.heightAt(x, z));
        const dx = (Number(this.world.heightAt(x + gradientStep, z)) - Number(this.world.heightAt(x - gradientStep, z))) / (gradientStep * 2);
        const dz = (Number(this.world.heightAt(x, z + gradientStep)) - Number(this.world.heightAt(x, z - gradientStep))) / (gradientStep * 2);
        const slope = Math.hypot(dx, dz);
        if (slope >= ROUGH_SLOPE) roughSampleCount += 1;
        minHeight = Math.min(minHeight, height);
        maxHeight = Math.max(maxHeight, height);
        maxSlope = Math.max(maxSlope, slope);
        samples.push({ x, z, height: round(height), slope: round(slope) });
      }
    }
    return {
      step: TERRAIN_STEP,
      samples,
      minHeight: round(minHeight),
      maxHeight: round(maxHeight),
      heightRange: round(maxHeight - minHeight),
      maxSlope: round(maxSlope),
      roughSampleCount
    };
  }

  private collectProtectedRoute(collisionVolumes: SurveyBox[]): CaelusBaselineSurveyReport["protectedRoute"] {
    const points = ROUTE_DEFINITION.map((point) => ({
      ...point,
      height: round(Number(this.world.heightAt(point.x, point.z)))
    }));
    const blockedSamples: Array<{ x: number; z: number; collisionId: string }> = [];
    const seen = new Set<string>();
    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      const length = Math.hypot(end.x - start.x, end.z - start.z);
      const steps = Math.max(1, Math.ceil(length / 1.5));
      for (let step = 0; step <= steps; step += 1) {
        const amount = step / steps;
        const x = start.x + (end.x - start.x) * amount;
        const z = start.z + (end.z - start.z) * amount;
        const collision = collisionVolumes.find((box) => pointInside(x, z, box, -0.35));
        if (!collision) continue;
        const key = `${round(x, 1)}:${round(z, 1)}:${collision.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        blockedSamples.push({ x: round(x), z: round(z), collisionId: collision.id });
      }
    }
    return { points, blockedSamples };
  }

  private buildFindings(
    roads: SurveyBox[],
    frontages: SurveyBox[],
    buildings: SurveyBox[],
    walls: SurveyBox[],
    civicObjects: SurveyBox[],
    npcs: SurveyPoint[],
    questObjects: SurveyPoint[],
    collisionVolumes: SurveyBox[],
    terrain: CaelusBaselineSurveyReport["terrain"],
    protectedRoute: CaelusBaselineSurveyReport["protectedRoute"]
  ): SurveyFinding[] {
    const findings: SurveyFinding[] = [];

    for (let left = 0; left < buildings.length; left += 1) {
      for (let right = left + 1; right < buildings.length; right += 1) {
        if (!overlaps(buildings[left], buildings[right], 0.2)) continue;
        findings.push({
          severity: "critical",
          code: "BUILDING_FOOTPRINT_OVERLAP",
          message: `${buildings[left].name} overlaps ${buildings[right].name}.`,
          subjects: [buildings[left].name, buildings[right].name]
        });
      }
    }

    for (const building of buildings) {
      for (const road of roads) {
        const roadSamples = road.samples ?? [];
        if (!roadSamples.some((sample) => pointInside(sample.x, sample.z, building, 0.2))) continue;
        findings.push({
          severity: "high",
          code: "BUILDING_ROAD_BROADPHASE_INTERSECTION",
          message: `${building.name} contains sampled geometry from ${road.name}.`,
          subjects: [building.name, road.name]
        });
      }

      const heights = [
        [building.centerX, building.centerZ],
        [building.minX, building.minZ],
        [building.minX, building.maxZ],
        [building.maxX, building.minZ],
        [building.maxX, building.maxZ]
      ].map(([x, z]) => Number(this.world.heightAt(x, z)));
      const range = Math.max(...heights) - Math.min(...heights);
      if (range > BUILDING_GROUND_RANGE) {
        findings.push({
          severity: range > 1.2 ? "high" : "medium",
          code: "BUILDING_UNEVEN_GROUND",
          message: `${building.name} spans ${round(range)} terrain-height units.`,
          subjects: [building.name]
        });
      }

      const buildingId = String(building.metadata.buildingId ?? building.name.replace(/-body$/, "").replace(/^caelus-integrated-/, ""));
      if (!frontages.some((frontage) => frontage.name.includes(buildingId))) {
        findings.push({
          severity: "high",
          code: "BUILDING_MISSING_FRONTAGE",
          message: `${building.name} has no detected door-to-road frontage.`,
          subjects: [building.name]
        });
      }
    }

    for (const frontage of frontages) {
      if (Math.max(frontage.width, frontage.depth) > 18) {
        findings.push({
          severity: "medium",
          code: "EXCESSIVE_FRONTAGE_LENGTH",
          message: `${frontage.name} is ${round(Math.max(frontage.width, frontage.depth))} units long.`,
          subjects: [frontage.name]
        });
      }
      const crossedBuildings = buildings.filter((building) => overlaps(frontage, building, 0.35));
      if (crossedBuildings.length > 1) {
        findings.push({
          severity: "high",
          code: "FRONTAGE_CROSSES_BUILDING",
          message: `${frontage.name} intersects multiple building footprints.`,
          subjects: [frontage.name, ...crossedBuildings.map((building) => building.name)]
        });
      }
    }

    for (let left = 0; left < collisionVolumes.length; left += 1) {
      for (let right = left + 1; right < collisionVolumes.length; right += 1) {
        if (!overlaps(collisionVolumes[left], collisionVolumes[right], 0.2)) continue;
        const overlapWidth = Math.min(collisionVolumes[left].maxX, collisionVolumes[right].maxX)
          - Math.max(collisionVolumes[left].minX, collisionVolumes[right].minX);
        const overlapDepth = Math.min(collisionVolumes[left].maxZ, collisionVolumes[right].maxZ)
          - Math.max(collisionVolumes[left].minZ, collisionVolumes[right].minZ);
        if (overlapWidth * overlapDepth < 1.5) continue;
        findings.push({
          severity: "medium",
          code: "COLLISION_VOLUME_OVERLAP",
          message: `${collisionVolumes[left].name} overlaps ${collisionVolumes[right].name}.`,
          subjects: [collisionVolumes[left].name, collisionVolumes[right].name]
        });
      }
    }

    if (protectedRoute.blockedSamples.length > 0) {
      findings.push({
        severity: "critical",
        code: "PROTECTED_ROUTE_BLOCKED",
        message: `${protectedRoute.blockedSamples.length} samples on the gate-to-frontier route lie inside collision volumes.`,
        subjects: Array.from(new Set(protectedRoute.blockedSamples.map((sample) => sample.collisionId)))
      });
    }

    if (terrain.roughSampleCount > 0) {
      findings.push({
        severity: "high",
        code: "ROUGH_TOWN_TERRAIN",
        message: `${terrain.roughSampleCount} terrain samples exceed the structural slope threshold.`,
        subjects: []
      });
    }

    if (walls.length < 5) {
      findings.push({
        severity: "high",
        code: "INCOMPLETE_VISIBLE_PERIMETER",
        message: `Only ${walls.length} enabled wall or gate structures were detected inside the town survey bounds.`,
        subjects: walls.map((wall) => wall.name)
      });
    }

    if (npcs.length < 8) {
      findings.push({
        severity: "medium",
        code: "LOW_TOWN_POPULATION",
        message: `Only ${npcs.length} town NPC candidates were detected.`,
        subjects: npcs.map((npc) => npc.name)
      });
    }

    if (questObjects.length === 0) {
      findings.push({
        severity: "high",
        code: "NO_QUEST_OBJECTS",
        message: "No town quest objects were detected.",
        subjects: []
      });
    }

    const roadMaterials = new Set(roads.map((road) => road.material).filter(Boolean));
    if (roadMaterials.size > 4) {
      findings.push({
        severity: "low",
        code: "ROAD_MATERIAL_FRAGMENTATION",
        message: `${roadMaterials.size} different road materials were detected.`,
        subjects: Array.from(roadMaterials) as string[]
      });
    }

    const transparentTownMaterials = (this.scene.materials as any[]).filter((material: any) => {
      const name = String(material.name ?? "").toLowerCase();
      if (!name.includes("caelus") && !name.includes("town") && !name.includes("gate")) return false;
      return Number(material.alpha ?? 1) < 0.999 || Number(material.transparencyMode ?? 0) !== 0;
    }).map((material: any) => String(material.name ?? "unnamed"));
    if (transparentTownMaterials.length > 0) {
      findings.push({
        severity: "high",
        code: "TRANSPARENT_TOWN_MATERIAL",
        message: `${transparentTownMaterials.length} town materials still use transparency.`,
        subjects: transparentTownMaterials
      });
    }

    const disabledVisibleStructures = [...roads, ...buildings, ...walls, ...civicObjects]
      .filter((record) => !record.enabled)
      .map((record) => record.name);
    if (disabledVisibleStructures.length > 0) {
      findings.push({
        severity: "info",
        code: "DISABLED_SURVEY_STRUCTURES",
        message: `${disabledVisibleStructures.length} classified town structures are disabled legacy or superseded meshes.`,
        subjects: disabledVisibleStructures
      });
    }

    return findings.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return order[a.severity] - order[b.severity] || a.code.localeCompare(b.code);
    });
  }

  private installApi(): void {
    const api = {
      report: () => this.cloneReport(),
      refresh: () => this.refresh(),
      show: () => this.setVisible(true),
      hide: () => this.setVisible(false),
      toggle: () => this.setVisible(!this.visible),
      download: () => this.downloadReport()
    };
    (globalThis as any).__CAELUS_BASELINE_SURVEY__ = api;
    const bridge = (globalThis as any).__ASCENSION_PLAYTEST__;
    if (bridge) {
      bridge.baselineSurvey = () => this.cloneReport();
      bridge.refreshBaselineSurvey = () => this.refresh();
      bridge.setBaselineSurveyVisible = (visible: boolean) => this.setVisible(Boolean(visible));
      bridge.baselineSurveyVisible = () => this.visible;
    }
  }

  private installOverlay(): void {
    const overlay = document.createElement("section");
    overlay.id = "caelus-baseline-survey-overlay";
    overlay.setAttribute("aria-label", "Caelus Reach baseline city survey");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "100000",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      padding: "18px",
      background: "rgba(3, 8, 12, 0.92)",
      color: "#eafcff",
      fontFamily: "Inter, system-ui, sans-serif"
    });

    const shell = document.createElement("div");
    Object.assign(shell.style, {
      position: "relative",
      width: "min(96vw, 1180px)",
      maxHeight: "96vh",
      border: "1px solid rgba(141, 238, 255, 0.35)",
      borderRadius: "12px",
      background: "#091116",
      boxShadow: "0 24px 80px rgba(0,0,0,.55)",
      overflow: "auto",
      pointerEvents: "auto"
    });

    const toolbar = document.createElement("div");
    Object.assign(toolbar.style, {
      position: "sticky",
      top: "0",
      zIndex: "2",
      display: "flex",
      gap: "8px",
      alignItems: "center",
      padding: "10px 12px",
      background: "rgba(5, 14, 20, .96)",
      borderBottom: "1px solid rgba(141, 238, 255, 0.18)"
    });
    const title = document.createElement("strong");
    title.textContent = "SET 1 · MILESTONE 1.1 — CAELUS BASELINE SURVEY";
    title.style.marginRight = "auto";
    title.style.letterSpacing = ".08em";
    title.style.fontSize = "12px";
    toolbar.append(title);

    const button = (label: string, action: () => void): HTMLButtonElement => {
      const element = document.createElement("button");
      element.type = "button";
      element.textContent = label;
      Object.assign(element.style, {
        border: "1px solid rgba(141, 238, 255, .35)",
        borderRadius: "6px",
        padding: "7px 10px",
        background: "#10232b",
        color: "#d9fbff",
        cursor: "pointer",
        font: "600 11px system-ui"
      });
      element.addEventListener("click", action);
      return element;
    };
    toolbar.append(
      button("REFRESH", () => this.refresh()),
      button("COPY JSON", () => void this.copyReport()),
      button("DOWNLOAD JSON", () => this.downloadReport()),
      button("CLOSE · F9", () => this.setVisible(false))
    );

    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 900;
    Object.assign(canvas.style, {
      display: "block",
      width: "100%",
      height: "auto",
      background: "#081015"
    });

    shell.append(toolbar, canvas);
    overlay.append(shell);
    document.body.append(overlay);
    this.overlay = overlay;
    this.canvas = canvas;
    this.renderOverlay();
  }

  private renderOverlay(): void {
    if (!this.canvas) return;
    const context = this.canvas.getContext("2d");
    if (!context) return;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const margin = 68;
    const mapWidth = width - margin * 2;
    const mapHeight = height - margin * 2;
    const mapX = (x: number): number => margin + (x - TOWN_BOUNDS.minX) / (TOWN_BOUNDS.maxX - TOWN_BOUNDS.minX) * mapWidth;
    const mapZ = (z: number): number => margin + (TOWN_BOUNDS.maxZ - z) / (TOWN_BOUNDS.maxZ - TOWN_BOUNDS.minZ) * mapHeight;
    const boxRect = (box: SurveyBox): [number, number, number, number] => [
      mapX(box.minX),
      mapZ(box.maxZ),
      Math.max(1, mapX(box.maxX) - mapX(box.minX)),
      Math.max(1, mapZ(box.minZ) - mapZ(box.maxZ))
    ];

    context.clearRect(0, 0, width, height);
    context.fillStyle = "#081015";
    context.fillRect(0, 0, width, height);

    const terrain = this.report.terrain;
    const terrainRange = Math.max(0.001, terrain.heightRange);
    for (const sample of terrain.samples) {
      const amount = (sample.height - terrain.minHeight) / terrainRange;
      const hue = 205 - amount * 135;
      const x = mapX(sample.x - terrain.step * 0.5);
      const y = mapZ(sample.z + terrain.step * 0.5);
      const cellWidth = mapX(sample.x + terrain.step * 0.5) - x;
      const cellHeight = mapZ(sample.z - terrain.step * 0.5) - y;
      context.fillStyle = `hsla(${hue}, 55%, ${18 + amount * 20}%, ${sample.slope >= ROUGH_SLOPE ? 0.72 : 0.36})`;
      context.fillRect(x, y, cellWidth + 1, cellHeight + 1);
    }

    context.strokeStyle = "rgba(165, 224, 236, .18)";
    context.lineWidth = 1;
    for (let x = TOWN_BOUNDS.minX; x <= TOWN_BOUNDS.maxX; x += 25) {
      context.beginPath();
      context.moveTo(mapX(x), margin);
      context.lineTo(mapX(x), height - margin);
      context.stroke();
    }
    for (let z = TOWN_BOUNDS.minZ; z <= TOWN_BOUNDS.maxZ; z += 25) {
      context.beginPath();
      context.moveTo(margin, mapZ(z));
      context.lineTo(width - margin, mapZ(z));
      context.stroke();
    }

    for (const road of this.report.roads) {
      context.fillStyle = road.enabled ? "rgba(76, 176, 255, .9)" : "rgba(76, 176, 255, .18)";
      for (const sample of road.samples ?? []) context.fillRect(mapX(sample.x) - 2, mapZ(sample.z) - 2, 4, 4);
    }

    context.strokeStyle = "rgba(255, 72, 72, .52)";
    context.lineWidth = 1;
    for (const collision of this.report.collisionVolumes) {
      const [x, y, w, h] = boxRect(collision);
      context.strokeRect(x, y, w, h);
    }

    const drawBoxes = (records: SurveyBox[], fill: string, stroke: string): void => {
      for (const record of records) {
        const [x, y, w, h] = boxRect(record);
        context.fillStyle = record.enabled ? fill : "rgba(110, 110, 110, .16)";
        context.strokeStyle = record.enabled ? stroke : "rgba(160, 160, 160, .25)";
        context.fillRect(x, y, w, h);
        context.strokeRect(x, y, w, h);
      }
    };
    drawBoxes(this.report.frontages, "rgba(212, 102, 255, .36)", "rgba(235, 169, 255, .9)");
    drawBoxes(this.report.buildings, "rgba(255, 172, 76, .48)", "rgba(255, 210, 149, .95)");
    drawBoxes(this.report.walls, "rgba(175, 191, 196, .52)", "rgba(227, 242, 246, .95)");
    drawBoxes(this.report.civicObjects, "rgba(153, 104, 255, .44)", "rgba(207, 184, 255, .95)");

    context.strokeStyle = "#72f2ff";
    context.lineWidth = 4;
    context.beginPath();
    this.report.protectedRoute.points.forEach((point, index) => {
      if (index === 0) context.moveTo(mapX(point.x), mapZ(point.z));
      else context.lineTo(mapX(point.x), mapZ(point.z));
    });
    context.stroke();

    for (const point of this.report.protectedRoute.points) {
      context.fillStyle = "#d8fcff";
      context.beginPath();
      context.arc(mapX(point.x), mapZ(point.z), 5, 0, Math.PI * 2);
      context.fill();
    }
    for (const blocked of this.report.protectedRoute.blockedSamples) {
      context.fillStyle = "#ff3333";
      context.fillRect(mapX(blocked.x) - 3, mapZ(blocked.z) - 3, 6, 6);
    }

    for (const npc of this.report.npcs) {
      context.fillStyle = npc.enabled ? "#6aff8d" : "#335f3d";
      context.beginPath();
      context.arc(mapX(npc.x), mapZ(npc.z), 4, 0, Math.PI * 2);
      context.fill();
    }
    for (const quest of this.report.questObjects) {
      const x = mapX(quest.x);
      const y = mapZ(quest.z);
      context.fillStyle = "#ffe86b";
      context.beginPath();
      context.moveTo(x, y - 6);
      context.lineTo(x + 6, y);
      context.lineTo(x, y + 6);
      context.lineTo(x - 6, y);
      context.closePath();
      context.fill();
    }

    context.fillStyle = "#e8fbff";
    context.font = "600 12px system-ui";
    for (const building of this.report.buildings) {
      context.fillText(building.name.replace("caelus-integrated-", "").replace("-body", ""), mapX(building.centerX) + 5, mapZ(building.centerZ) - 5);
    }

    context.fillStyle = "rgba(4, 11, 16, .88)";
    context.fillRect(76, 76, 322, 154);
    context.strokeStyle = "rgba(126, 235, 255, .35)";
    context.strokeRect(76, 76, 322, 154);
    context.fillStyle = "#dffbff";
    context.font = "700 17px system-ui";
    context.fillText("CAELUS REACH · CURRENT PRODUCTION BASELINE", 92, 104);
    context.font = "600 13px system-ui";
    const summaryLines = [
      `Road meshes: ${this.report.summary.roads}  ·  Buildings: ${this.report.summary.buildings}`,
      `Walls/gate: ${this.report.summary.walls}  ·  Civic objects: ${this.report.summary.civicObjects}`,
      `NPC candidates: ${this.report.summary.npcs}  ·  Quest objects: ${this.report.summary.questObjects}`,
      `Collision volumes: ${this.report.summary.collisionVolumes}`,
      `Terrain range: ${this.report.terrain.heightRange}  ·  Rough samples: ${this.report.terrain.roughSampleCount}`,
      `Findings: ${this.report.summary.findings}  ·  Critical: ${this.report.summary.criticalFindings}`
    ];
    summaryLines.forEach((line, index) => context.fillText(line, 92, 130 + index * 18));

    const legend = [
      ["#4cb0ff", "Road geometry"], ["#ffac4c", "Buildings"], ["#b7c5ca", "Walls / gate"],
      ["#d466ff", "Frontage paths"], ["#9968ff", "Civic objects"], ["#ff4848", "Collision boxes"],
      ["#6aff8d", "NPCs"], ["#ffe86b", "Quest objects"], ["#72f2ff", "Protected route"]
    ];
    context.fillStyle = "rgba(4, 11, 16, .88)";
    context.fillRect(width - 290, 76, 214, 216);
    context.strokeStyle = "rgba(126, 235, 255, .35)";
    context.strokeRect(width - 290, 76, 214, 216);
    context.font = "600 12px system-ui";
    legend.forEach(([color, label], index) => {
      context.fillStyle = color;
      context.fillRect(width - 272, 94 + index * 21, 12, 12);
      context.fillStyle = "#dffbff";
      context.fillText(label, width - 251, 105 + index * 21);
    });
  }

  private refresh(): CaelusBaselineSurveyReport {
    this.report = this.buildReport();
    this.renderOverlay();
    this.scene.metadata.caelusBaselineSurveySummary = { ...this.report.summary };
    this.scene.metadata.caelusBaselineSurveyFindingCount = this.report.findings.length;
    return this.cloneReport();
  }

  private cloneReport(): CaelusBaselineSurveyReport {
    return JSON.parse(JSON.stringify(this.report)) as CaelusBaselineSurveyReport;
  }

  private setVisible(visible: boolean): boolean {
    this.visible = visible;
    if (this.overlay) this.overlay.style.display = visible ? "flex" : "none";
    if (visible) {
      this.game.paused = true;
      this.refresh();
    }
    document.documentElement.dataset.caelusSurveyVisible = visible ? "true" : "false";
    return visible;
  }

  private async copyReport(): Promise<void> {
    const text = JSON.stringify(this.report, null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
  }

  private downloadReport(): void {
    const blob = new Blob([JSON.stringify(this.report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `caelus-reach-baseline-survey-${this.report.generatedAt.replace(/[:.]/g, "-")}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  private inTown(x: number, z: number): boolean {
    return Number.isFinite(x)
      && Number.isFinite(z)
      && x >= TOWN_BOUNDS.minX
      && x <= TOWN_BOUNDS.maxX
      && z >= TOWN_BOUNDS.minZ
      && z <= TOWN_BOUNDS.maxZ;
  }
}
