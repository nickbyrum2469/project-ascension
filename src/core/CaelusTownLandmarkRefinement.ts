import { CaelusTownHouseRefiner } from "./CaelusTownHouseRefinement.js";
import {
  ROAD_SURFACE_OFFSET,
  SPECIAL_BUILDINGS,
  lerp,
  makeMaterial,
  type SpecialBuilding
} from "./CaelusTownRefinementShared.js";

export class CaelusTownLandmarkBuilder {
  private readonly scene: any;
  private readonly world: any;

  constructor(
    game: any,
    private readonly generated: any[],
    private readonly roadMaterial: any,
    private readonly houseRefiner: CaelusTownHouseRefiner
  ) {
    this.scene = game.world.scene;
    this.world = game.world;
  }

  public buildAll(): string[] {
    return SPECIAL_BUILDINGS.map((building) => {
      this.createSpecialBuilding(building);
      return building.id;
    });
  }

  private createSpecialBuilding(building: SpecialBuilding): void {
    const ground = this.world.heightAt(building.x, building.z);
    const wallMaterial = makeMaterial(this.scene, `caelus-${building.id}-wall-material`, building.wallColor);
    const roofMaterial = makeMaterial(this.scene, `caelus-${building.id}-roof-material`, building.roofColor);
    const accentMaterial = makeMaterial(this.scene, `caelus-${building.id}-accent-material`, building.accentColor);
    const stoneMaterial = makeMaterial(this.scene, `caelus-${building.id}-stone-material`, "#6d746c");
    const glassMaterial = makeMaterial(this.scene, `caelus-${building.id}-glass-material`, "#afd5d8", {
      alpha: 0.24,
      emissive: building.role === "blacksmith" ? "#6e2b14" : undefined,
      metallic: 0.3
    });
    glassMaterial.needDepthPrePass = true;

    const foundation = BABYLON.MeshBuilder.CreateBox(`caelus-special-${building.id}-foundation`, {
      width: building.width + 2.2,
      height: 0.7,
      depth: building.depth + 2.2
    }, this.scene);
    foundation.position.set(building.x, ground + 0.25, building.z);
    foundation.material = stoneMaterial;
    foundation.receiveShadows = true;
    foundation.metadata = { specialBuilding: true, buildingId: building.id, function: building.role };
    this.generated.push(foundation);

    const minX = building.x - building.width * 0.5;
    const maxX = building.x + building.width * 0.5;
    const minZ = building.z - building.depth * 0.5;
    const maxZ = building.z + building.depth * 0.5;
    const minY = ground + 0.6;
    const maxY = minY + building.height;
    const frontSign = building.doorSide === "north" ? 1 : -1;
    const doorWidth = building.role === "guild" ? 4.8 : building.role === "town-hall" ? 3.8 : 4.2;
    const doorHeight = building.role === "guild" ? 5.8 : 4.8;
    const windowWidth = building.role === "guild" ? 2.3 : 1.9;
    const windowHeight = building.role === "town-hall" ? 2.6 : 2.2;
    const windowY = minY + building.height * 0.46;
    const windowCenters = building.role === "guild"
      ? [-building.width * 0.34, -building.width * 0.19, building.width * 0.19, building.width * 0.34]
      : [-building.width * 0.28, building.width * 0.28];
    const openings = [
      { type: "door" as const, minX: building.x - doorWidth * 0.5, maxX: building.x + doorWidth * 0.5, minY, maxY: minY + doorHeight },
      ...windowCenters.map((offset) => ({
        type: "window" as const,
        minX: building.x + offset - windowWidth * 0.5,
        maxX: building.x + offset + windowWidth * 0.5,
        minY: windowY - windowHeight * 0.5,
        maxY: windowY + windowHeight * 0.5
      }))
    ].sort((a, b) => a.minX - b.minX);

    this.houseRefiner.createWallShell(
      `caelus-special-${building.id}`,
      { minX, maxX, minY, maxY, minZ, maxZ, frontSign },
      openings,
      wallMaterial,
      accentMaterial,
      glassMaterial,
      { specialBuilding: true, buildingId: building.id, function: building.role, futureInteriorShell: true }
    );
    this.createRidgeRoof(building, maxY + 0.15, roofMaterial);
    this.createSpecialEntrance(building, ground, accentMaterial, stoneMaterial);
    this.createBuildingSign(building, ground);
    this.createSpecialBuildingDetails(building, ground, maxY, accentMaterial, stoneMaterial, roofMaterial);
    this.createSpecialFrontage(building);
    this.addCollision(building.x, building.z, building.width, building.depth);
    [wallMaterial, roofMaterial, accentMaterial, stoneMaterial, glassMaterial].forEach((material) => material.freeze?.());
  }

  private createRidgeRoof(building: SpecialBuilding, baseY: number, material: any): void {
    const overhang = 1.2;
    const minX = building.x - building.width * 0.5 - overhang;
    const maxX = building.x + building.width * 0.5 + overhang;
    const minZ = building.z - building.depth * 0.5 - overhang;
    const maxZ = building.z + building.depth * 0.5 + overhang;
    const apexY = baseY + (building.role === "town-hall" ? 5.8 : building.role === "guild" ? 5.2 : 4.4);
    const positions: number[] = [];
    const indices: number[] = [];

    if (building.width >= building.depth) {
      positions.push(
        minX, baseY, minZ,
        maxX, baseY, minZ,
        maxX, baseY, maxZ,
        minX, baseY, maxZ,
        minX, apexY, building.z,
        maxX, apexY, building.z
      );
      indices.push(0, 1, 5, 0, 5, 4, 3, 4, 5, 3, 5, 2, 0, 4, 3, 1, 2, 5, 0, 3, 2, 0, 2, 1);
    } else {
      positions.push(
        minX, baseY, minZ,
        maxX, baseY, minZ,
        maxX, baseY, maxZ,
        minX, baseY, maxZ,
        building.x, apexY, minZ,
        building.x, apexY, maxZ
      );
      indices.push(0, 4, 5, 0, 5, 3, 4, 1, 2, 4, 2, 5, 0, 1, 4, 3, 5, 2, 0, 3, 2, 0, 2, 1);
    }

    const normals: number[] = [];
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);
    const data = new BABYLON.VertexData();
    data.positions = positions;
    data.indices = indices;
    data.normals = normals;
    const roof = new BABYLON.Mesh(`caelus-special-${building.id}-ridge-roof`, this.scene);
    data.applyToMesh(roof);
    roof.material = material;
    roof.receiveShadows = true;
    roof.metadata = { specialBuilding: true, buildingId: building.id, authoredRidgeRoof: true };
    this.world.shadowGenerator?.addShadowCaster?.(roof);
    this.generated.push(roof);
  }

  private createSpecialEntrance(building: SpecialBuilding, ground: number, accent: any, stone: any): void {
    const sign = building.doorSide === "north" ? 1 : -1;
    const frontZ = building.z + sign * building.depth * 0.5;
    const doorWidth = building.role === "guild" ? 4.8 : building.role === "town-hall" ? 3.8 : 4.2;
    const doorHeight = building.role === "guild" ? 5.8 : 4.8;
    const door = BABYLON.MeshBuilder.CreateBox(`caelus-special-${building.id}-double-door`, {
      width: doorWidth,
      height: doorHeight,
      depth: 0.28
    }, this.scene);
    door.position.set(building.x, ground + 0.6 + doorHeight * 0.5, frontZ + sign * 0.12);
    door.material = accent;
    door.metadata = { specialBuilding: true, buildingId: building.id, futureInteriorDoor: true };
    this.generated.push(door);

    const stepCount = building.role === "town-hall" ? 3 : 2;
    for (let index = 0; index < stepCount; index += 1) {
      const step = BABYLON.MeshBuilder.CreateBox(`caelus-special-${building.id}-step-${index}`, {
        width: doorWidth + 2.5 + index * 1.15,
        height: 0.28,
        depth: 1.1
      }, this.scene);
      step.position.set(building.x, ground + 0.13 + index * 0.18, frontZ + sign * (0.75 + index * 0.78));
      step.material = stone;
      step.receiveShadows = true;
      this.generated.push(step);
    }

    if (building.role === "guild") {
      const canopy = BABYLON.MeshBuilder.CreateBox(`caelus-special-${building.id}-entry-canopy`, {
        width: 12,
        height: 0.45,
        depth: 4.5
      }, this.scene);
      canopy.position.set(building.x, ground + 7.5, frontZ + sign * 2);
      canopy.material = accent;
      this.generated.push(canopy);
      for (const side of [-1, 1]) {
        const column = BABYLON.MeshBuilder.CreateCylinder(`caelus-special-${building.id}-column-${side}`, {
          height: 7,
          diameterTop: 0.65,
          diameterBottom: 0.9,
          tessellation: 8
        }, this.scene);
        column.position.set(building.x + side * 4.6, ground + 3.5, frontZ + sign * 2.9);
        column.material = stone;
        column.receiveShadows = true;
        this.generated.push(column);
      }
    }
  }

  private createBuildingSign(building: SpecialBuilding, ground: number): void {
    const sign = building.doorSide === "north" ? 1 : -1;
    const frontZ = building.z + sign * (building.depth * 0.5 + 0.22);
    const texture = new BABYLON.DynamicTexture(`caelus-${building.id}-sign-texture`, { width: 1024, height: 256 }, this.scene, false);
    const context = texture.getContext();
    context.fillStyle = "#2e2823";
    context.fillRect(0, 0, 1024, 256);
    context.strokeStyle = "#a8c7b5";
    context.lineWidth = 12;
    context.strokeRect(14, 14, 996, 228);
    context.font = "bold 82px Georgia, serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#e4dfbd";
    context.fillText(building.label, 512, 132);
    texture.update(false);
    const signMaterial = new BABYLON.StandardMaterial(`caelus-${building.id}-sign-material`, this.scene);
    signMaterial.diffuseTexture = texture;
    signMaterial.emissiveColor = BABYLON.Color3.FromHexString("#2b3029");
    signMaterial.specularColor = BABYLON.Color3.Black();
    signMaterial.backFaceCulling = false;

    const plaque = BABYLON.MeshBuilder.CreateBox(`caelus-special-${building.id}-sign`, {
      width: Math.min(building.width * 0.62, 18),
      height: 2.4,
      depth: 0.24
    }, this.scene);
    plaque.position.set(building.x, ground + building.height * 0.72, frontZ);
    plaque.material = signMaterial;
    plaque.metadata = { specialBuilding: true, buildingId: building.id, authoredSign: true };
    this.generated.push(plaque);
  }

  private createSpecialBuildingDetails(
    building: SpecialBuilding,
    ground: number,
    maxY: number,
    accent: any,
    stone: any,
    roof: any
  ): void {
    if (building.role === "guild") {
      const crest = BABYLON.MeshBuilder.CreateTorus(`caelus-special-${building.id}-crest`, {
        diameter: 3.4,
        thickness: 0.34,
        tessellation: 28
      }, this.scene);
      const sign = building.doorSide === "north" ? 1 : -1;
      crest.position.set(building.x, ground + 10.6, building.z + sign * (building.depth * 0.5 + 0.42));
      crest.rotation.x = Math.PI / 2;
      crest.material = makeMaterial(this.scene, `caelus-${building.id}-crest-material`, "#7fe0d0", { emissive: "#2a8c82" });
      this.generated.push(crest);
      for (const side of [-1, 1]) {
        const banner = BABYLON.MeshBuilder.CreateBox(`caelus-special-${building.id}-banner-${side}`, {
          width: 1.6,
          height: 5.4,
          depth: 0.16
        }, this.scene);
        banner.position.set(building.x + side * 8.2, ground + 8.8, building.z + sign * (building.depth * 0.5 + 0.34));
        banner.material = roof;
        this.generated.push(banner);
      }
    } else if (building.role === "town-hall") {
      const cupola = BABYLON.MeshBuilder.CreateCylinder(`caelus-special-${building.id}-cupola`, {
        diameter: 5.2,
        height: 5,
        tessellation: 8
      }, this.scene);
      cupola.position.set(building.x, maxY + 5.4, building.z);
      cupola.material = stone;
      this.generated.push(cupola);
      const cupolaRoof = BABYLON.MeshBuilder.CreateCylinder(`caelus-special-${building.id}-cupola-roof`, {
        diameterTop: 0,
        diameterBottom: 6.4,
        height: 3.2,
        tessellation: 8
      }, this.scene);
      cupolaRoof.position.set(building.x, maxY + 9.5, building.z);
      cupolaRoof.material = roof;
      this.generated.push(cupolaRoof);
      const bell = BABYLON.MeshBuilder.CreateTorus(`caelus-special-${building.id}-bell`, {
        diameter: 1.4,
        thickness: 0.28,
        tessellation: 18
      }, this.scene);
      bell.position.set(building.x, maxY + 5.1, building.z - 2.55);
      bell.rotation.x = Math.PI / 2;
      bell.material = accent;
      this.generated.push(bell);
    } else {
      const chimney = BABYLON.MeshBuilder.CreateBox(`caelus-special-${building.id}-chimney`, {
        width: 3.4,
        height: 10.5,
        depth: 3.4
      }, this.scene);
      chimney.position.set(building.x - building.width * 0.28, maxY + 2.2, building.z - building.depth * 0.18);
      chimney.material = stone;
      chimney.receiveShadows = true;
      this.generated.push(chimney);
      const cap = BABYLON.MeshBuilder.CreateBox(`caelus-special-${building.id}-chimney-cap`, {
        width: 4.2,
        height: 0.7,
        depth: 4.2
      }, this.scene);
      cap.position.set(chimney.position.x, chimney.position.y + 5.5, chimney.position.z);
      cap.material = accent;
      this.generated.push(cap);
      const sign = building.doorSide === "north" ? 1 : -1;
      const awning = BABYLON.MeshBuilder.CreateBox(`caelus-special-${building.id}-forge-awning`, {
        width: 11,
        height: 0.35,
        depth: 4.2
      }, this.scene);
      awning.position.set(building.x + 6, ground + 6.2, building.z + sign * (building.depth * 0.5 + 1.8));
      awning.rotation.x = sign * -0.12;
      awning.material = roof;
      this.generated.push(awning);
      const anvilPost = BABYLON.MeshBuilder.CreateBox(`caelus-special-${building.id}-anvil-post`, {
        width: 0.7,
        height: 3.2,
        depth: 0.7
      }, this.scene);
      anvilPost.position.set(building.x + 10.5, ground + 4.6, building.z + sign * (building.depth * 0.5 + 0.4));
      anvilPost.material = accent;
      this.generated.push(anvilPost);
      const anvil = BABYLON.MeshBuilder.CreateBox(`caelus-special-${building.id}-anvil-sign`, {
        width: 2.8,
        height: 0.9,
        depth: 1.1
      }, this.scene);
      anvil.position.set(anvilPost.position.x, anvilPost.position.y + 1.75, anvilPost.position.z);
      anvil.material = stone;
      this.generated.push(anvil);
    }
  }

  private createSpecialFrontage(building: SpecialBuilding): void {
    const frontZ = building.z + (building.doorSide === "north" ? building.depth * 0.5 + 1.25 : -building.depth * 0.5 - 1.25);
    const minZ = Math.min(frontZ, building.collectorZ);
    const maxZ = Math.max(frontZ, building.collectorZ);
    const width = building.role === "guild" ? 5.6 : 4.5;
    const segments = Math.max(1, Math.ceil((maxZ - minZ) / 2));
    const positions: number[] = [];
    for (let index = 0; index <= segments; index += 1) {
      const z = lerp(minZ, maxZ, index / segments);
      for (const side of [-1, 1]) {
        const x = building.x + side * width * 0.5;
        positions.push(x, this.world.heightAt(x, z) + ROAD_SURFACE_OFFSET + 0.004, z);
      }
    }
    const indices: number[] = [];
    for (let index = 0; index < segments; index += 1) {
      const base = index * 2;
      indices.push(base, base + 1, base + 3, base, base + 3, base + 2);
    }
    const normals: number[] = [];
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);
    const data = new BABYLON.VertexData();
    data.positions = positions;
    data.indices = indices;
    data.normals = normals;
    const path = new BABYLON.Mesh(`caelus-refined-special-frontage-${building.id}`, this.scene);
    data.applyToMesh(path);
    path.material = this.roadMaterial;
    path.receiveShadows = true;
    path.isPickable = false;
    path.metadata = { specialBuilding: true, buildingId: building.id, groundedTownRoad: true, roadRole: "frontage" };
    this.generated.push(path);
  }

  private addCollision(x: number, z: number, width: number, depth: number): void {
    const inset = 0.35;
    const boxes = (this.world as any).collisionBoxes as Array<{ minX: number; maxX: number; minZ: number; maxZ: number }>;
    boxes?.push({
      minX: x - width * 0.5 + inset,
      maxX: x + width * 0.5 - inset,
      minZ: z - depth * 0.5 + inset,
      maxZ: z + depth * 0.5 - inset
    });
  }
}
