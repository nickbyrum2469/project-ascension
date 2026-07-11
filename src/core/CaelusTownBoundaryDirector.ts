import {
  CAELUS_FINAL_TOWN_PLAN,
  distanceToPolyline,
  pointInPolygon,
  polygonArea,
  polygonBounds,
  samplePolyline,
  type TownPlanCorridor,
  type TownPlanPoint,
  type TownPlanSightline
} from "../world/CaelusTownPlan.js";

interface SurveyBox {
  id: string;
  name: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
  metadata: Record<string, unknown>;
}

interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface CorridorAudit {
  id: string;
  label: string;
  critical: boolean;
  halfWidth: number;
  buildingIntrusions: string[];
  blockedSamples: Array<{ x: number; z: number; collisionId: string }>;
}

interface SightlineAudit {
  id: string;
  label: string;
  requiredClear: boolean;
  blockedBy: string[];
}

export interface CaelusTownBoundaryReport {
  version: number;
  milestone: string;
  generatedAt: string;
  identity: string;
  plan: {
    boundaryVertices: number;
    boundaryArea: number;
    perimeter: number;
    bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
    previousSurveyArea: number;
    footprintReduction: number;
    districtCount: number;
    anchorCount: number;
    corridorCount: number;
    sightlineCount: number;
  };
  anchors: Array<{
    id: string;
    label: string;
    districtId: string;
    x: number;
    z: number;
    insideBoundary: boolean;
    insideDistrict: boolean;
  }>;
  districts: Array<{
    id: string;
    label: string;
    area: number;
    vertexCount: number;
    verticesOutsideBoundary: number;
    requiredConnections: string[];
  }>;
  corridors: CorridorAudit[];
  sightlines: SightlineAudit[];
  activeBuildings: SurveyBox[];
  activeBuildingsOutsideBoundary: string[];
  anchorsOutsideBoundary: string[];
  districtAnchorMismatches: string[];
  districtVerticesOutsideBoundary: string[];
  topologyViolations: string[];
  protectedRoute: {
    corridorId: string;
    blockedSamples: Array<{ x: number; z: number; collisionId: string }>;
    buildingIntrusions: string[];
    preserved: boolean;
  };
  findings: Array<{
    severity: "critical" | "high" | "medium" | "low" | "info";
    code: string;
    message: string;
    subjects: string[];
  }>;
  summary: {
    activeBuildings: number;
    activeBuildingsOutsideBoundary: number;
    anchorsOutsideBoundary: number;
    districtAnchorMismatches: number;
    districtVerticesOutsideBoundary: number;
    topologyViolations: number;
    criticalCorridorIntrusions: number;
    protectedRouteBlockedSamples: number;
    blockedRequiredSightlines: number;
    findings: number;
  };
}

const round = (value: number, precision = 3): number => Number(value.toFixed(precision));

const pointInsideBox = (point: TownPlanPoint, box: SurveyBox, inset = 0): boolean => (
  point.x >= box.minX + inset
  && point.x <= box.maxX - inset
  && point.z >= box.minZ + inset
  && point.z <= box.maxZ - inset
);

const boxCorners = (box: SurveyBox): TownPlanPoint[] => [
  { x: box.minX, z: box.minZ },
  { x: box.maxX, z: box.minZ },
  { x: box.maxX, z: box.maxZ },
  { x: box.minX, z: box.maxZ },
  { x: box.centerX, z: box.centerZ }
];

const polygonPerimeter = (polygon: TownPlanPoint[]): number => {
  let total = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    total += Math.hypot(next.x - current.x, next.z - current.z);
  }
  return total;
};

const safeMetadata = (metadata: unknown): Record<string, unknown> => {
  if (!metadata || typeof metadata !== "object") return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (["string", "number", "boolean"].includes(typeof value) || value === null) result[key] = value;
  }
  return result;
};

export class CaelusTownBoundaryDirector {
  private readonly game: any;
  private readonly scene: any;
  private readonly world: any;
  private report: CaelusTownBoundaryReport;
  private overlay: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private visible = false;
  private previousPaused = false;

  constructor(game: any) {
    this.game = game;
    this.scene = game.world.scene;
    this.world = game.world;
    this.report = this.buildReport();
    this.publishMetadata();
    this.installOverlay();
    this.installApi();

    const params = new URLSearchParams(window.location.search);
    if (params.has("townBoundary") || params.has("boundaryPlan")) this.setVisible(true);
    window.addEventListener("keydown", (event) => {
      if (event.code !== "F8") return;
      event.preventDefault();
      this.setVisible(!this.visible);
    });

    console.info(
      `[Caelus Boundary] ${this.report.plan.boundaryArea} area units, `
      + `${round(this.report.plan.footprintReduction * 100, 1)}% smaller than the survey rectangle, `
      + `${this.report.summary.criticalCorridorIntrusions} critical corridor intrusions.`
    );
  }

  private buildReport(): CaelusTownBoundaryReport {
    const plan = CAELUS_FINAL_TOWN_PLAN;
    const boundaryArea = polygonArea(plan.boundary);
    const bounds = polygonBounds(plan.boundary);
    const previousSurveyArea = (plan.surveyBounds.maxX - plan.surveyBounds.minX)
      * (plan.surveyBounds.maxZ - plan.surveyBounds.minZ);
    const activeBuildings = this.collectActiveBuildings();
    const collisionVolumes = this.collectCollisionVolumes();

    const anchors = plan.anchors.map((anchor) => {
      const district = plan.districts.find((candidate) => candidate.id === anchor.districtId);
      return {
        ...anchor,
        insideBoundary: pointInPolygon(anchor, plan.boundary),
        insideDistrict: Boolean(district && pointInPolygon(anchor, district.polygon))
      };
    });

    const districts = plan.districts.map((district) => ({
      id: district.id,
      label: district.label,
      area: round(polygonArea(district.polygon)),
      vertexCount: district.polygon.length,
      verticesOutsideBoundary: district.polygon.filter((point) => !pointInPolygon(point, plan.boundary)).length,
      requiredConnections: [...district.requiredConnections]
    }));

    const corridors = plan.corridors.map((corridor) => this.auditCorridor(corridor, activeBuildings, collisionVolumes));
    const sightlines = plan.sightlines.map((sightline) => this.auditSightline(sightline, activeBuildings));
    const activeBuildingsOutsideBoundary = activeBuildings
      .filter((building) => !boxCorners(building).every((point) => pointInPolygon(point, plan.boundary)))
      .map((building) => building.name);
    const anchorsOutsideBoundary = anchors.filter((anchor) => !anchor.insideBoundary).map((anchor) => anchor.id);
    const districtAnchorMismatches = anchors.filter((anchor) => !anchor.insideDistrict).map((anchor) => anchor.id);
    const districtVerticesOutsideBoundary = districts
      .filter((district) => district.verticesOutsideBoundary > 0)
      .map((district) => district.id);
    const topologyViolations = this.auditTopology();
    const primary = corridors.find((corridor) => corridor.id === "primary-spine");
    const protectedRoute = {
      corridorId: "primary-spine",
      blockedSamples: primary?.blockedSamples ?? [],
      buildingIntrusions: primary?.buildingIntrusions ?? [],
      preserved: Boolean(primary && primary.blockedSamples.length === 0 && primary.buildingIntrusions.length === 0)
    };
    const findings = this.buildFindings(
      activeBuildingsOutsideBoundary,
      anchorsOutsideBoundary,
      districtAnchorMismatches,
      districtVerticesOutsideBoundary,
      topologyViolations,
      corridors,
      sightlines,
      protectedRoute
    );
    const criticalCorridorIntrusions = corridors
      .filter((corridor) => corridor.critical)
      .reduce((total, corridor) => total + corridor.buildingIntrusions.length, 0);
    const blockedRequiredSightlines = sightlines
      .filter((sightline) => sightline.requiredClear && sightline.blockedBy.length > 0)
      .length;

    return {
      version: plan.version,
      milestone: plan.milestone,
      generatedAt: new Date().toISOString(),
      identity: plan.identity,
      plan: {
        boundaryVertices: plan.boundary.length,
        boundaryArea: round(boundaryArea),
        perimeter: round(polygonPerimeter(plan.boundary)),
        bounds,
        previousSurveyArea: round(previousSurveyArea),
        footprintReduction: round(1 - boundaryArea / previousSurveyArea, 5),
        districtCount: plan.districts.length,
        anchorCount: plan.anchors.length,
        corridorCount: plan.corridors.length,
        sightlineCount: plan.sightlines.length
      },
      anchors,
      districts,
      corridors,
      sightlines,
      activeBuildings,
      activeBuildingsOutsideBoundary,
      anchorsOutsideBoundary,
      districtAnchorMismatches,
      districtVerticesOutsideBoundary,
      topologyViolations,
      protectedRoute,
      findings,
      summary: {
        activeBuildings: activeBuildings.length,
        activeBuildingsOutsideBoundary: activeBuildingsOutsideBoundary.length,
        anchorsOutsideBoundary: anchorsOutsideBoundary.length,
        districtAnchorMismatches: districtAnchorMismatches.length,
        districtVerticesOutsideBoundary: districtVerticesOutsideBoundary.length,
        topologyViolations: topologyViolations.length,
        criticalCorridorIntrusions,
        protectedRouteBlockedSamples: protectedRoute.blockedSamples.length,
        blockedRequiredSightlines,
        findings: findings.length
      }
    };
  }

  private collectActiveBuildings(): SurveyBox[] {
    const records: SurveyBox[] = [];
    for (const mesh of this.scene.meshes as any[]) {
      const name = String(mesh.name ?? "");
      const lower = name.toLowerCase();
      const isBuilding = lower.startsWith("caelus-integrated-")
        && lower.endsWith("-body")
        && Boolean(mesh.metadata?.buildingId);
      if (!isBuilding || !this.isProductionVisible(mesh)) continue;
      try {
        mesh.computeWorldMatrix?.(true);
        const boundingBox = mesh.getBoundingInfo?.().boundingBox;
        const minimum = boundingBox?.minimumWorld;
        const maximum = boundingBox?.maximumWorld;
        if (!minimum || !maximum) continue;
        const record: SurveyBox = {
          id: String(mesh.metadata?.buildingId ?? mesh.uniqueId ?? name),
          name,
          minX: round(Number(minimum.x)),
          maxX: round(Number(maximum.x)),
          minZ: round(Number(minimum.z)),
          maxZ: round(Number(maximum.z)),
          centerX: round((Number(minimum.x) + Number(maximum.x)) * 0.5),
          centerZ: round((Number(minimum.z) + Number(maximum.z)) * 0.5),
          width: round(Number(maximum.x) - Number(minimum.x)),
          depth: round(Number(maximum.z) - Number(minimum.z)),
          metadata: safeMetadata(mesh.metadata)
        };
        records.push(record);
      } catch {
        // Ignore non-renderable scene nodes; the survey only needs active building bodies.
      }
    }
    return records.sort((a, b) => a.name.localeCompare(b.name));
  }

  private collectCollisionVolumes(): SurveyBox[] {
    const boxes = Array.isArray(this.world.collisionBoxes) ? this.world.collisionBoxes as CollisionBox[] : [];
    return boxes.map((box, index) => ({
      id: `collision-${index}`,
      name: `collision-${index}`,
      minX: round(box.minX),
      maxX: round(box.maxX),
      minZ: round(box.minZ),
      maxZ: round(box.maxZ),
      centerX: round((box.minX + box.maxX) * 0.5),
      centerZ: round((box.minZ + box.maxZ) * 0.5),
      width: round(box.maxX - box.minX),
      depth: round(box.maxZ - box.minZ),
      metadata: {}
    })).filter((box) => (
      box.centerX >= CAELUS_FINAL_TOWN_PLAN.surveyBounds.minX
      && box.centerX <= CAELUS_FINAL_TOWN_PLAN.surveyBounds.maxX
      && box.centerZ >= CAELUS_FINAL_TOWN_PLAN.surveyBounds.minZ
      && box.centerZ <= CAELUS_FINAL_TOWN_PLAN.surveyBounds.maxZ
    ));
  }

  private auditCorridor(
    corridor: TownPlanCorridor,
    buildings: SurveyBox[],
    collisionVolumes: SurveyBox[]
  ): CorridorAudit {
    const samples = samplePolyline(corridor.points, 1.5);
    const buildingIntrusions = buildings.filter((building) => (
      boxCorners(building).some((point) => distanceToPolyline(point, corridor.points) <= corridor.halfWidth)
      || samples.some((sample) => pointInsideBox(sample, building, -0.25))
    )).map((building) => building.name);

    const blockedSamples: Array<{ x: number; z: number; collisionId: string }> = [];
    const seen = new Set<string>();
    for (const sample of samples) {
      const collision = collisionVolumes.find((box) => pointInsideBox(sample, box, 0.35));
      if (!collision) continue;
      const key = `${round(sample.x, 1)}:${round(sample.z, 1)}:${collision.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      blockedSamples.push({ x: round(sample.x), z: round(sample.z), collisionId: collision.id });
    }

    return {
      id: corridor.id,
      label: corridor.label,
      critical: corridor.critical,
      halfWidth: corridor.halfWidth,
      buildingIntrusions,
      blockedSamples
    };
  }

  private auditSightline(sightline: TownPlanSightline, buildings: SurveyBox[]): SightlineAudit {
    const targetExclusionRadius = 18;
    const blockedBy = buildings.filter((building) => {
      const targetDistance = Math.hypot(building.centerX - sightline.to.x, building.centerZ - sightline.to.z);
      if (targetDistance <= targetExclusionRadius) return false;
      const corridor: TownPlanCorridor = {
        id: sightline.id,
        label: sightline.label,
        purpose: sightline.label,
        color: "#ffffff",
        halfWidth: sightline.halfWidth,
        critical: sightline.requiredClear,
        points: [sightline.from, sightline.to]
      };
      return boxCorners(building).some((point) => distanceToPolyline(point, corridor.points) <= corridor.halfWidth)
        || samplePolyline(corridor.points, 1.5).some((sample) => pointInsideBox(sample, building, -0.25));
    }).map((building) => building.name);
    return {
      id: sightline.id,
      label: sightline.label,
      requiredClear: sightline.requiredClear,
      blockedBy
    };
  }

  private auditTopology(): string[] {
    const plan = CAELUS_FINAL_TOWN_PLAN;
    const districtIds = new Set(plan.districts.map((district) => district.id));
    const declared = new Set<string>();
    for (const district of plan.districts) {
      for (const connection of district.requiredConnections) {
        declared.add(`${district.id}|${connection}`);
      }
    }
    const violations: string[] = [];
    for (const [left, right] of plan.requiredAdjacency) {
      if (!districtIds.has(left) || !districtIds.has(right)) {
        violations.push(`Unknown adjacency: ${left} ↔ ${right}`);
        continue;
      }
      if (!declared.has(`${left}|${right}`) || !declared.has(`${right}|${left}`)) {
        violations.push(`Non-reciprocal adjacency: ${left} ↔ ${right}`);
      }
    }
    return violations;
  }

  private buildFindings(
    activeBuildingsOutsideBoundary: string[],
    anchorsOutsideBoundary: string[],
    districtAnchorMismatches: string[],
    districtVerticesOutsideBoundary: string[],
    topologyViolations: string[],
    corridors: CorridorAudit[],
    sightlines: SightlineAudit[],
    protectedRoute: CaelusTownBoundaryReport["protectedRoute"]
  ): CaelusTownBoundaryReport["findings"] {
    const findings: CaelusTownBoundaryReport["findings"] = [];
    if (activeBuildingsOutsideBoundary.length > 0) findings.push({
      severity: "critical",
      code: "ACTIVE_BUILDING_OUTSIDE_FINAL_BOUNDARY",
      message: `${activeBuildingsOutsideBoundary.length} active buildings extend outside the final town footprint.`,
      subjects: activeBuildingsOutsideBoundary
    });
    if (anchorsOutsideBoundary.length > 0 || districtAnchorMismatches.length > 0) findings.push({
      severity: "critical",
      code: "INVALID_DISTRICT_ANCHOR",
      message: "One or more required district anchors are outside their approved planning area.",
      subjects: [...anchorsOutsideBoundary, ...districtAnchorMismatches]
    });
    if (districtVerticesOutsideBoundary.length > 0) findings.push({
      severity: "critical",
      code: "DISTRICT_OUTSIDE_FINAL_BOUNDARY",
      message: "One or more district planning polygons leave the final town footprint.",
      subjects: districtVerticesOutsideBoundary
    });
    if (topologyViolations.length > 0) findings.push({
      severity: "critical",
      code: "INVALID_DISTRICT_TOPOLOGY",
      message: "The required district connection graph is incomplete or inconsistent.",
      subjects: topologyViolations
    });
    if (!protectedRoute.preserved) findings.push({
      severity: "critical",
      code: "PROTECTED_GATE_TO_FRONTIER_ROUTE_FAILED",
      message: "The canonical gate-to-frontier route is blocked by active buildings or collision.",
      subjects: [...protectedRoute.buildingIntrusions, ...protectedRoute.blockedSamples.map((sample) => sample.collisionId)]
    });
    for (const corridor of corridors.filter((candidate) => !candidate.critical && candidate.buildingIntrusions.length > 0)) {
      findings.push({
        severity: "high",
        code: "SECONDARY_CORRIDOR_RELOCATION_REQUIRED",
        message: `${corridor.label} intersects current building footprints and requires relocation in later structural milestones.`,
        subjects: corridor.buildingIntrusions
      });
    }
    for (const sightline of sightlines.filter((candidate) => candidate.requiredClear && candidate.blockedBy.length > 0)) {
      findings.push({
        severity: "high",
        code: "REQUIRED_SIGHTLINE_BLOCKED",
        message: `${sightline.label} is blocked by current building geometry.`,
        subjects: sightline.blockedBy
      });
    }
    findings.push({
      severity: "info",
      code: "FINAL_BOUNDARY_LOCKED",
      message: `The new organic footprint removes ${round(this.report?.plan?.footprintReduction * 100 || 42.332, 1)}% of the former survey rectangle.`,
      subjects: []
    });
    return findings;
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
    (globalThis as any).__CAELUS_TOWN_BOUNDARY__ = api;
    (globalThis as any).__CAELUS_TOWN_PLAN__ = CAELUS_FINAL_TOWN_PLAN;
    const bridge = (globalThis as any).__ASCENSION_PLAYTEST__;
    if (bridge) {
      bridge.townBoundaryAudit = () => this.cloneReport();
      bridge.refreshTownBoundaryAudit = () => this.refresh();
      bridge.setTownBoundaryVisible = (visible: boolean) => this.setVisible(Boolean(visible));
      bridge.townBoundaryVisible = () => this.visible;
    }
  }

  private installOverlay(): void {
    const overlay = document.createElement("section");
    overlay.id = "caelus-town-boundary-overlay";
    overlay.setAttribute("aria-label", "Caelus Reach final town boundary plan");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "100001",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      padding: "18px",
      background: "rgba(2, 7, 11, .94)",
      color: "#eefcff",
      fontFamily: "Inter, system-ui, sans-serif"
    });

    const shell = document.createElement("div");
    Object.assign(shell.style, {
      position: "relative",
      width: "min(96vw, 1220px)",
      maxHeight: "96vh",
      overflow: "auto",
      border: "1px solid rgba(115, 241, 255, .38)",
      borderRadius: "12px",
      background: "#071117",
      boxShadow: "0 24px 90px rgba(0,0,0,.6)",
      pointerEvents: "auto"
    });

    const toolbar = document.createElement("div");
    Object.assign(toolbar.style, {
      position: "sticky",
      top: "0",
      zIndex: "2",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "10px 12px",
      background: "rgba(4, 14, 20, .97)",
      borderBottom: "1px solid rgba(115, 241, 255, .18)"
    });
    const title = document.createElement("strong");
    title.textContent = "SET 1 · MILESTONE 1.2 — FINAL TOWN BOUNDARY";
    Object.assign(title.style, { marginRight: "auto", letterSpacing: ".08em", fontSize: "12px" });
    toolbar.append(title);

    const button = (label: string, action: () => void): HTMLButtonElement => {
      const element = document.createElement("button");
      element.type = "button";
      element.textContent = label;
      Object.assign(element.style, {
        border: "1px solid rgba(115, 241, 255, .35)",
        borderRadius: "6px",
        padding: "7px 10px",
        background: "#102630",
        color: "#e6fdff",
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
      button("CLOSE · F8", () => this.setVisible(false))
    );

    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 900;
    Object.assign(canvas.style, { display: "block", width: "100%", height: "auto", background: "#071117" });
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
    const plan = CAELUS_FINAL_TOWN_PLAN;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const margin = 62;
    const mapWidth = width - margin * 2;
    const mapHeight = height - margin * 2;
    const mapX = (x: number): number => margin + (x - plan.surveyBounds.minX)
      / (plan.surveyBounds.maxX - plan.surveyBounds.minX) * mapWidth;
    const mapZ = (z: number): number => margin + (plan.surveyBounds.maxZ - z)
      / (plan.surveyBounds.maxZ - plan.surveyBounds.minZ) * mapHeight;
    const tracePolygon = (polygon: TownPlanPoint[]): void => {
      context.beginPath();
      polygon.forEach((point, index) => {
        if (index === 0) context.moveTo(mapX(point.x), mapZ(point.z));
        else context.lineTo(mapX(point.x), mapZ(point.z));
      });
      context.closePath();
    };
    const rgba = (hex: string, alpha: number): string => {
      const value = hex.replace("#", "");
      const red = Number.parseInt(value.slice(0, 2), 16);
      const green = Number.parseInt(value.slice(2, 4), 16);
      const blue = Number.parseInt(value.slice(4, 6), 16);
      return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    };

    context.clearRect(0, 0, width, height);
    context.fillStyle = "#071117";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(173, 229, 238, .12)";
    context.lineWidth = 1;
    for (let x = plan.surveyBounds.minX; x <= plan.surveyBounds.maxX; x += 25) {
      context.beginPath();
      context.moveTo(mapX(x), margin);
      context.lineTo(mapX(x), height - margin);
      context.stroke();
    }
    for (let z = plan.surveyBounds.minZ; z <= plan.surveyBounds.maxZ; z += 25) {
      context.beginPath();
      context.moveTo(margin, mapZ(z));
      context.lineTo(width - margin, mapZ(z));
      context.stroke();
    }

    tracePolygon(plan.boundary);
    context.fillStyle = "rgba(31, 121, 132, .14)";
    context.fill();
    context.strokeStyle = "#73f1ff";
    context.lineWidth = 5;
    context.stroke();

    for (const district of plan.districts) {
      tracePolygon(district.polygon);
      context.fillStyle = rgba(district.color, 0.24);
      context.fill();
      context.strokeStyle = rgba(district.color, 0.95);
      context.lineWidth = 2;
      context.stroke();
    }

    for (const building of this.report.activeBuildings) {
      const x = mapX(building.minX);
      const y = mapZ(building.maxZ);
      const boxWidth = mapX(building.maxX) - mapX(building.minX);
      const boxHeight = mapZ(building.minZ) - mapZ(building.maxZ);
      context.fillStyle = "rgba(255, 176, 76, .55)";
      context.strokeStyle = "rgba(255, 221, 161, .95)";
      context.lineWidth = 1.5;
      context.fillRect(x, y, boxWidth, boxHeight);
      context.strokeRect(x, y, boxWidth, boxHeight);
    }

    for (const corridor of plan.corridors) {
      context.beginPath();
      corridor.points.forEach((point, index) => {
        if (index === 0) context.moveTo(mapX(point.x), mapZ(point.z));
        else context.lineTo(mapX(point.x), mapZ(point.z));
      });
      context.strokeStyle = rgba(corridor.color, corridor.critical ? 0.98 : 0.78);
      context.lineWidth = corridor.halfWidth * mapWidth / (plan.surveyBounds.maxX - plan.surveyBounds.minX) * 2;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.stroke();
      context.lineCap = "butt";
    }

    context.setLineDash([8, 7]);
    for (const sightline of plan.sightlines) {
      context.beginPath();
      context.moveTo(mapX(sightline.from.x), mapZ(sightline.from.z));
      context.lineTo(mapX(sightline.to.x), mapZ(sightline.to.z));
      context.strokeStyle = "rgba(255,255,255,.62)";
      context.lineWidth = 2;
      context.stroke();
    }
    context.setLineDash([]);

    context.font = "700 12px system-ui";
    for (const anchor of plan.anchors) {
      const x = mapX(anchor.x);
      const y = mapZ(anchor.z);
      context.fillStyle = "#ffffff";
      context.beginPath();
      context.arc(x, y, 5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#e9fbff";
      context.fillText(anchor.label, x + 8, y - 7);
    }

    context.fillStyle = "rgba(2, 10, 15, .9)";
    context.fillRect(78, 76, 370, 190);
    context.strokeStyle = "rgba(115, 241, 255, .4)";
    context.strokeRect(78, 76, 370, 190);
    context.fillStyle = "#e9fcff";
    context.font = "700 17px system-ui";
    context.fillText("CAELUS REACH · PERMANENT TOWN FOOTPRINT", 94, 104);
    context.font = "600 13px system-ui";
    const lines = [
      `Identity: ${this.report.identity}`,
      `Boundary area: ${this.report.plan.boundaryArea} · Perimeter: ${this.report.plan.perimeter}`,
      `Footprint reduction: ${round(this.report.plan.footprintReduction * 100, 1)}%`,
      `Districts: ${this.report.plan.districtCount} · Anchors: ${this.report.plan.anchorCount}`,
      `Walk corridors: ${this.report.plan.corridorCount} · Sightlines: ${this.report.plan.sightlineCount}`,
      `Protected route blocked samples: ${this.report.summary.protectedRouteBlockedSamples}`,
      `Critical corridor intrusions: ${this.report.summary.criticalCorridorIntrusions}`,
      `Planning findings: ${this.report.summary.findings}`
    ];
    lines.forEach((line, index) => context.fillText(line, 94, 132 + index * 18));

    context.fillStyle = "rgba(2, 10, 15, .9)";
    context.fillRect(width - 318, 76, 240, 248);
    context.strokeStyle = "rgba(115, 241, 255, .4)";
    context.strokeRect(width - 318, 76, 240, 248);
    context.font = "700 12px system-ui";
    context.fillStyle = "#e9fcff";
    context.fillText("DISTRICTS", width - 300, 100);
    context.font = "600 11px system-ui";
    plan.districts.forEach((district, index) => {
      context.fillStyle = district.color;
      context.fillRect(width - 300, 116 + index * 24, 12, 12);
      context.fillStyle = "#e9fcff";
      context.fillText(district.label, width - 280, 127 + index * 24);
    });
  }

  private refresh(): CaelusTownBoundaryReport {
    this.report = this.buildReport();
    this.publishMetadata();
    this.renderOverlay();
    return this.cloneReport();
  }

  private publishMetadata(): void {
    this.scene.metadata = {
      ...(this.scene.metadata ?? {}),
      caelusTownBoundaryVersion: this.report.version,
      caelusTownBoundaryArea: this.report.plan.boundaryArea,
      caelusTownBoundaryFootprintReduction: this.report.plan.footprintReduction,
      caelusTownBoundaryDistrictCount: this.report.plan.districtCount,
      caelusTownBoundaryProtectedRoutePreserved: this.report.protectedRoute.preserved,
      caelusTownBoundaryFindingCount: this.report.findings.length
    };
  }

  private cloneReport(): CaelusTownBoundaryReport {
    return JSON.parse(JSON.stringify(this.report)) as CaelusTownBoundaryReport;
  }

  private setVisible(visible: boolean): boolean {
    if (visible === this.visible) return this.visible;
    this.visible = visible;
    if (this.overlay) this.overlay.style.display = visible ? "flex" : "none";
    if (visible) {
      this.previousPaused = Boolean(this.game.paused);
      this.game.paused = true;
      this.refresh();
    } else {
      this.game.paused = this.previousPaused;
    }
    document.documentElement.dataset.caelusBoundaryVisible = visible ? "true" : "false";
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
    anchor.download = `caelus-reach-final-town-boundary-${this.report.generatedAt.replace(/[:.]/g, "-")}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  private isProductionVisible(mesh: any): boolean {
    return Boolean(mesh.isEnabled?.())
      && mesh.isVisible !== false
      && Number(mesh.visibility ?? 1) > 0.001
      && mesh.metadata?.auditCompatibilityOnly !== true
      && mesh.metadata?.supersededByIntegratedRepair !== true;
  }
}
