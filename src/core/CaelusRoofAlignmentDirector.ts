interface RoofAlignmentAudit {
  version: number;
  milestone: string;
  houseBodyCount: number;
  alignedRoofCount: number;
  retiredLegacyRoofCount: number;
  misalignedRoofCount: number;
  minimumOverhang: number;
  maximumCenterOffset: number;
  pass: boolean;
}

const ROOF_OVERHANG = 0.9;
const ROOF_HEIGHT = 4.2;

const round = (value: number, precision = 3): number => Number(value.toFixed(precision));

export class CaelusRoofAlignmentDirector {
  private readonly scene: any;
  private readonly shadowGenerator: any;
  private readonly generated: any[] = [];
  private audit: RoofAlignmentAudit;

  constructor(game: any) {
    this.scene = game.world.scene;
    this.shadowGenerator = game.world.shadowGenerator;

    const bodies = (this.scene.meshes as any[]).filter((mesh) => (
      String(mesh.name ?? "").startsWith("caelus-reference-house-")
      && String(mesh.name ?? "").endsWith("-body")
      && mesh.isEnabled?.()
    ));

    let retiredLegacyRoofCount = 0;
    let misalignedRoofCount = 0;
    let minimumOverhang = Number.POSITIVE_INFINITY;
    let maximumCenterOffset = 0;

    for (const body of bodies) {
      body.computeWorldMatrix?.(true);
      const bodyBox = body.getBoundingInfo?.().boundingBox;
      const minimum = bodyBox?.minimumWorld;
      const maximum = bodyBox?.maximumWorld;
      if (!minimum || !maximum) {
        misalignedRoofCount += 1;
        continue;
      }

      const bodyName = String(body.name);
      const houseId = bodyName
        .replace("caelus-reference-house-", "")
        .replace(/-body$/, "");
      const legacyRoof = this.scene.getMeshByName?.(`caelus-reference-house-${houseId}-roof`);
      const material = legacyRoof?.material;

      if (legacyRoof) {
        legacyRoof.setEnabled?.(false);
        legacyRoof.isVisible = false;
        legacyRoof.isPickable = false;
        legacyRoof.metadata = { ...(legacyRoof.metadata ?? {}), supersededByAlignedRoof: true };
        retiredLegacyRoofCount += 1;
      }

      const minX = Number(minimum.x) - ROOF_OVERHANG;
      const maxX = Number(maximum.x) + ROOF_OVERHANG;
      const minZ = Number(minimum.z) - ROOF_OVERHANG;
      const maxZ = Number(maximum.z) + ROOF_OVERHANG;
      const baseY = Number(maximum.y) + 0.16;
      const centerX = (minX + maxX) * 0.5;
      const centerZ = (minZ + maxZ) * 0.5;
      const apexY = baseY + ROOF_HEIGHT;

      const positions = [
        minX, baseY, minZ,
        maxX, baseY, minZ,
        maxX, baseY, maxZ,
        minX, baseY, maxZ,
        centerX, apexY, centerZ
      ];
      const indices = [
        0, 1, 4,
        1, 2, 4,
        2, 3, 4,
        3, 0, 4,
        0, 3, 2,
        0, 2, 1
      ];
      const normals: number[] = [];
      BABYLON.VertexData.ComputeNormals(positions, indices, normals);
      const data = new BABYLON.VertexData();
      data.positions = positions;
      data.indices = indices;
      data.normals = normals;

      const roof = new BABYLON.Mesh(`caelus-aligned-house-${houseId}-roof`, this.scene);
      data.applyToMesh(roof);
      roof.material = material;
      roof.receiveShadows = true;
      roof.isPickable = false;
      roof.metadata = {
        referenceTown: true,
        alignedHouseRoof: true,
        houseId,
        overhang: ROOF_OVERHANG,
        bodyBounds: {
          minX: Number(minimum.x),
          maxX: Number(maximum.x),
          minZ: Number(minimum.z),
          maxZ: Number(maximum.z)
        }
      };
      this.shadowGenerator?.addShadowCaster?.(roof);
      this.generated.push(roof);

      const bodyCenterX = (Number(minimum.x) + Number(maximum.x)) * 0.5;
      const bodyCenterZ = (Number(minimum.z) + Number(maximum.z)) * 0.5;
      const centerOffset = Math.hypot(centerX - bodyCenterX, centerZ - bodyCenterZ);
      maximumCenterOffset = Math.max(maximumCenterOffset, centerOffset);
      minimumOverhang = Math.min(
        minimumOverhang,
        Number(minimum.x) - minX,
        maxX - Number(maximum.x),
        Number(minimum.z) - minZ,
        maxZ - Number(maximum.z)
      );
      if (centerOffset > 0.01 || minimumOverhang < 0.75) misalignedRoofCount += 1;
    }

    this.audit = {
      version: 1,
      milestone: "Set 1 / Milestone 1.4.2 — Road and Roof Alignment",
      houseBodyCount: bodies.length,
      alignedRoofCount: this.generated.length,
      retiredLegacyRoofCount,
      misalignedRoofCount,
      minimumOverhang: round(minimumOverhang),
      maximumCenterOffset: round(maximumCenterOffset),
      pass: bodies.length === 20
        && this.generated.length === 20
        && retiredLegacyRoofCount === 20
        && misalignedRoofCount === 0
        && minimumOverhang >= 0.75
        && maximumCenterOffset <= 0.01
    };

    this.scene.metadata = {
      ...(this.scene.metadata ?? {}),
      caelusRoofAlignmentVersion: 1,
      caelusRoofAlignmentAudit: { ...this.audit }
    };

    const bridge = (globalThis as any).__ASCENSION_PLAYTEST__;
    if (bridge) {
      bridge.roofAlignmentAudit = () => JSON.parse(JSON.stringify(this.audit));
      bridge.alignedRoofMeshes = () => this.generated.filter((mesh) => mesh.isEnabled?.()).map((mesh) => String(mesh.name));
    }

    console.info(
      `[Caelus Roofs] aligned=${this.audit.alignedRoofCount}, retired=${this.audit.retiredLegacyRoofCount}, `
      + `misaligned=${this.audit.misalignedRoofCount}, pass=${this.audit.pass}.`
    );
  }
}
