import {
  createAqueduct,
  createGate,
  createMaterial,
  createMegastructurePillar,
  createMara,
  createResonantMarker,
  createRock,
  createTree,
  type HumanoidVisual
} from "./ProceduralAssets.js";

interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const seeded = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const distance2d = (x: number, z: number, cx: number, cz: number): number => Math.hypot(x - cx, z - cz);
const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = BABYLON.Scalar.Clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export class World {
  public readonly scene: any;
  public readonly camera: any;
  public readonly shadowGenerator: any;
  public readonly glowLayer: any;
  public readonly mara: HumanoidVisual;
  public readonly marker: any;
  public readonly markerPosition = new BABYLON.Vector3(235, 0, -330);
  public readonly labyrinthPosition = new BABYLON.Vector3(475, 0, -485);
  public readonly spawnPoints = [
    new BABYLON.Vector3(-52, 0, -108),
    new BABYLON.Vector3(42, 0, -184),
    new BABYLON.Vector3(-118, 0, -286),
    new BABYLON.Vector3(158, 0, -350),
    new BABYLON.Vector3(475, 0, -573)
  ];

  private readonly random = seeded(8675309);
  private readonly collisionBoxes: CollisionBox[] = [];
  private readonly floorRadius = 840;

  constructor(public readonly engine: any) {
    this.scene = new BABYLON.Scene(engine);
    this.scene.clearColor = new BABYLON.Color4(0.08, 0.16, 0.19, 1);
    this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.00072;
    this.scene.fogColor = BABYLON.Color3.FromHexString("#6f9ca3");
    this.scene.environmentIntensity = 0.84;

    this.camera = new BABYLON.FreeCamera("player-camera", new BABYLON.Vector3(0, 4, 8), this.scene);
    this.camera.minZ = 0.05;
    this.camera.maxZ = 3200;
    this.camera.fov = BABYLON.Tools.ToRadians(75);
    this.scene.activeCamera = this.camera;

    const hemisphere = new BABYLON.HemisphericLight(
      "foundation-fill",
      new BABYLON.Vector3(0.18, 1, 0.08),
      this.scene
    );
    hemisphere.intensity = 1.08;
    hemisphere.diffuse = BABYLON.Color3.FromHexString("#d7f0e6");
    hemisphere.groundColor = BABYLON.Color3.FromHexString("#273d3b");

    const sun = new BABYLON.DirectionalLight(
      "artificial-sun",
      new BABYLON.Vector3(-0.48, -1, -0.31),
      this.scene
    );
    sun.position = new BABYLON.Vector3(220, 360, 170);
    sun.intensity = 2.45;
    sun.diffuse = BABYLON.Color3.FromHexString("#ffe7bd");
    this.shadowGenerator = new BABYLON.ShadowGenerator(2048, sun);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = 14;
    this.shadowGenerator.darkness = 0.29;

    this.glowLayer = new BABYLON.GlowLayer("rift-glow", this.scene, { blurKernelSize: 32 });
    this.glowLayer.intensity = 0.42;

    this.createSkyAndCeiling();
    this.createTerrain();
    this.createBoundaryStructure();
    this.createCaelusReach();
    this.createFrontierRoad();
    this.createLandmarks();
    this.createLabyrinthBreach();
    this.createFoliage();
    this.createAtmosphere();

    this.mara = createMara(this.scene);
    this.mara.root.position = new BABYLON.Vector3(-7.5, this.heightAt(-7.5, -21), -21);
    this.mara.root.rotation.y = 0.25;
    this.mara.root.getChildMeshes().forEach((mesh: any) => this.shadowGenerator.addShadowCaster(mesh));

    this.markerPosition.y = this.heightAt(this.markerPosition.x, this.markerPosition.z);
    this.marker = createResonantMarker(this.scene, this.markerPosition);
    this.marker.getChildMeshes().forEach((mesh: any) => this.shadowGenerator.addShadowCaster(mesh));

    this.spawnPoints.forEach((point) => {
      point.y = this.heightAt(point.x, point.z);
    });

    const pipeline = new BABYLON.DefaultRenderingPipeline(
      "foundation-pipeline",
      true,
      this.scene,
      [this.camera]
    );
    pipeline.fxaaEnabled = true;
    pipeline.samples = 2;
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.88;
    pipeline.bloomWeight = 0.09;
    pipeline.bloomKernel = 36;
    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.contrast = 1.08;
    pipeline.imageProcessing.exposure = 0.96;
  }

  public heightAt(x: number, z: number): number {
    const radius = Math.hypot(x, z + 180);
    const broad = Math.sin(x * 0.0095) * 3.1 + Math.cos(z * 0.0087) * 2.8;
    const rolling = Math.sin((x + z) * 0.018) * 1.55 + Math.cos((x - z) * 0.015) * 1.2;
    const westernRidge = Math.exp(-Math.pow((x + 330) / 150, 2) - Math.pow((z + 335) / 300, 2)) * 28;
    const easternHighland = Math.exp(-Math.pow((x - 370) / 190, 2) - Math.pow((z + 390) / 260, 2)) * 34;
    const northernBasin = -Math.exp(-Math.pow((x + 30) / 250, 2) - Math.pow((z + 235) / 250, 2)) * 7;
    const outerRise = smoothstep(650, 825, radius) * 50;
    let height = broad + rolling + westernRidge + easternHighland + northernBasin + outerRise;

    const cityMask = Math.exp(-Math.pow(x / 145, 8) - Math.pow((z - 108) / 112, 8));
    height *= 1 - cityMask * 0.97;

    const labyrinthShelf = Math.exp(
      -Math.pow((x - this.labyrinthPosition.x) / 95, 2)
      - Math.pow((z - this.labyrinthPosition.z) / 115, 2)
    );
    height = height * (1 - labyrinthShelf * 0.68) + 15 * labyrinthShelf;

    return height;
  }

  public resolvePlayerPosition(position: any, previous: any): void {
    const centeredZ = position.z + 180;
    const radius = Math.hypot(position.x, centeredZ);
    const maximum = this.floorRadius - 28;
    if (radius > maximum) {
      const scale = maximum / radius;
      position.x *= scale;
      position.z = centeredZ * scale - 180;
    }

    for (const box of this.collisionBoxes) {
      if (
        position.x > box.minX
        && position.x < box.maxX
        && position.z > box.minZ
        && position.z < box.maxZ
      ) {
        position.x = previous.x;
        position.z = previous.z;
        break;
      }
    }
    position.y = this.heightAt(position.x, position.z);
  }

  private createTerrain(): void {
    const ground = BABYLON.MeshBuilder.CreateGround("windscar-terrain", {
      width: 1840,
      height: 1840,
      subdivisions: 250,
      updatable: true
    }, this.scene);
    ground.position.z = -180;
    const positions = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind) as number[];
    const indices = ground.getIndices() as number[];
    const normals = ground.getVerticesData(BABYLON.VertexBuffer.NormalKind) as number[];
    for (let index = 0; index < positions.length; index += 3) {
      const x = positions[index];
      const z = positions[index + 2] - 180;
      positions[index + 1] = this.heightAt(x, z);
    }
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);
    ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
    ground.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
    ground.refreshBoundingInfo();
    ground.receiveShadows = true;
    ground.isPickable = true;
    ground.metadata = { cameraCollision: true };

    const terrainMaterial = createMaterial(this.scene, "windscar-ground", "#4f6851", 0.96, 0.01);
    const texture = new BABYLON.DynamicTexture(
      "windscar-ground-texture",
      { width: 768, height: 768 },
      this.scene,
      false
    );
    const context = texture.getContext();
    const gradient = context.createLinearGradient(0, 0, 768, 768);
    gradient.addColorStop(0, "#75805a");
    gradient.addColorStop(0.34, "#586e50");
    gradient.addColorStop(0.7, "#3f5c4b");
    gradient.addColorStop(1, "#314b46");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 768, 768);
    for (let index = 0; index < 4200; index += 1) {
      const green = 72 + Math.floor(this.random() * 65);
      const alpha = 0.035 + this.random() * 0.11;
      context.fillStyle = `rgba(${42 + Math.floor(this.random() * 40)}, ${green}, ${40 + Math.floor(this.random() * 42)}, ${alpha})`;
      const size = 1 + this.random() * 4;
      context.fillRect(this.random() * 768, this.random() * 768, size, size * 2.2);
    }
    texture.update(false);
    texture.uScale = 72;
    texture.vScale = 72;
    terrainMaterial.albedoTexture = texture;
    terrainMaterial.bumpTexture = texture;
    terrainMaterial.bumpTexture.level = 0.08;
    terrainMaterial.ambientColor = BABYLON.Color3.FromHexString("#334b38");
    ground.material = terrainMaterial;
  }

  private createSkyAndCeiling(): void {
    const sky = BABYLON.MeshBuilder.CreateSphere("foundation-sky", { diameter: 2600, segments: 32 }, this.scene);
    const skyMaterial = new BABYLON.StandardMaterial("foundation-sky-mat", this.scene);
    skyMaterial.backFaceCulling = false;
    skyMaterial.disableLighting = true;
    skyMaterial.emissiveColor = BABYLON.Color3.FromHexString("#6ba5ad");
    skyMaterial.diffuseColor = BABYLON.Color3.Black();
    sky.material = skyMaterial;
    sky.isPickable = false;

    const ceiling = BABYLON.MeshBuilder.CreateSphere("upper-floor-vault", { diameter: 2050, segments: 48 }, this.scene);
    ceiling.scaling = new BABYLON.Vector3(1, 0.2, 1);
    ceiling.position.y = 320;
    ceiling.position.z = -180;
    const ceilingMaterial = new BABYLON.StandardMaterial("upper-floor-vault-mat", this.scene);
    ceilingMaterial.backFaceCulling = false;
    ceilingMaterial.alpha = 0.18;
    ceilingMaterial.emissiveColor = BABYLON.Color3.FromHexString("#203e49");
    ceilingMaterial.diffuseColor = BABYLON.Color3.FromHexString("#416875");
    ceiling.material = ceilingMaterial;
    ceiling.isPickable = false;
  }

  private createBoundaryStructure(): void {
    const wallMaterial = createMaterial(this.scene, "floor-boundary-wall", "#30474d", 0.74, 0.24);
    const braceMaterial = createMaterial(this.scene, "floor-boundary-brace", "#4a6267", 0.54, 0.42);
    const segmentCount = 96;
    const radius = this.floorRadius;
    const arcLength = (Math.PI * 2 * radius) / segmentCount;

    for (let index = 0; index < segmentCount; index += 1) {
      const angle = (index / segmentCount) * Math.PI * 2;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius - 180;
      const wall = BABYLON.MeshBuilder.CreateBox(`foundation-boundary-${index}`, {
        width: arcLength + 2.5,
        height: 150,
        depth: 24
      }, this.scene);
      wall.position = new BABYLON.Vector3(x, 74 + this.heightAt(x, z), z);
      wall.rotation.y = angle;
      wall.material = wallMaterial;
      wall.receiveShadows = true;
      wall.metadata = { cameraCollision: true };
      this.shadowGenerator.addShadowCaster(wall);

      if (index % 4 === 0) {
        const brace = BABYLON.MeshBuilder.CreateBox(`foundation-boundary-brace-${index}`, {
          width: 10,
          height: 164,
          depth: 38
        }, this.scene);
        brace.position = new BABYLON.Vector3(x, 80 + this.heightAt(x, z), z);
        brace.rotation.y = angle;
        brace.material = braceMaterial;
        brace.receiveShadows = true;
        this.shadowGenerator.addShadowCaster(brace);
      }
    }
  }

  private createCaelusReach(): void {
    const stone = createMaterial(this.scene, "caelus-wall-stone", "#52666a", 0.82, 0.12);
    const darkStone = createMaterial(this.scene, "caelus-wall-shadow", "#2d4348", 0.74, 0.23);
    const roofBlue = createMaterial(this.scene, "caelus-roof-blue", "#315567", 0.82, 0.14);
    const roofGreen = createMaterial(this.scene, "caelus-roof-green", "#416148", 0.88, 0.07);
    const plasterA = createMaterial(this.scene, "caelus-plaster-a", "#96957d", 0.94, 0.02);
    const plasterB = createMaterial(this.scene, "caelus-plaster-b", "#788c82", 0.94, 0.02);
    const timber = createMaterial(this.scene, "caelus-timber", "#514238", 0.94, 0.02);
    const gold = createMaterial(this.scene, "caelus-civic-gold", "#c8aa68", 0.35, 0.62);
    const glow = createMaterial(this.scene, "caelus-civic-glow", "#83edf0", 0.16, 0.18, "#3bd6df");

    const createWall = (
      name: string,
      x: number,
      z: number,
      width: number,
      depth: number,
      collision = true
    ): void => {
      const baseY = this.heightAt(x, z);
      const wall = BABYLON.MeshBuilder.CreateBox(name, { width, height: 11, depth }, this.scene);
      wall.position = new BABYLON.Vector3(x, baseY + 5.5, z);
      wall.material = stone;
      wall.receiveShadows = true;
      wall.metadata = { cameraCollision: true };
      this.shadowGenerator.addShadowCaster(wall);
      const cap = BABYLON.MeshBuilder.CreateBox(`${name}-cap`, {
        width: width + 1.2,
        height: 0.8,
        depth: depth + 1.2
      }, this.scene);
      cap.position = new BABYLON.Vector3(x, baseY + 11.35, z);
      cap.material = darkStone;
      this.shadowGenerator.addShadowCaster(cap);
      if (collision) {
        this.collisionBoxes.push({
          minX: x - width / 2,
          maxX: x + width / 2,
          minZ: z - depth / 2,
          maxZ: z + depth / 2
        });
      }
    };

    createWall("caelus-south-wall-left", -84, 22, 92, 6);
    createWall("caelus-south-wall-right", 84, 22, 92, 6);
    createWall("caelus-north-wall", 0, 205, 260, 6);
    createWall("caelus-west-wall", -130, 113.5, 6, 189);
    createWall("caelus-east-wall", 130, 113.5, 6, 189);

    const towerLocations = [
      [-130, 22], [130, 22], [-130, 205], [130, 205], [-130, 113], [130, 113]
    ];
    towerLocations.forEach(([x, z], index) => {
      const baseY = this.heightAt(x, z);
      const tower = BABYLON.MeshBuilder.CreateCylinder(`caelus-wall-tower-${index}`, {
        height: 18,
        diameterTop: 10,
        diameterBottom: 12.5,
        tessellation: 10
      }, this.scene);
      tower.position = new BABYLON.Vector3(x, baseY + 9, z);
      tower.material = stone;
      tower.receiveShadows = true;
      this.shadowGenerator.addShadowCaster(tower);
      const crown = BABYLON.MeshBuilder.CreateCylinder(`caelus-wall-tower-crown-${index}`, {
        height: 3.2,
        diameterTop: 13.4,
        diameterBottom: 10.8,
        tessellation: 10
      }, this.scene);
      crown.position = new BABYLON.Vector3(x, baseY + 19.6, z);
      crown.material = roofBlue;
      this.shadowGenerator.addShadowCaster(crown);
    });

    const gate = createGate(this.scene, new BABYLON.Vector3(0, this.heightAt(0, 20), 19));
    gate.rotation.y = Math.PI;
    gate.scaling = new BABYLON.Vector3(1.85, 1.85, 1.85);
    gate.getChildMeshes().forEach((mesh: any) => {
      mesh.receiveShadows = true;
      this.shadowGenerator.addShadowCaster(mesh);
    });

    const plaza = BABYLON.MeshBuilder.CreateCylinder("caelus-central-plaza", {
      height: 0.32,
      diameter: 52,
      tessellation: 24
    }, this.scene);
    plaza.position = new BABYLON.Vector3(0, this.heightAt(0, 112) + 0.1, 112);
    plaza.material = darkStone;
    plaza.receiveShadows = true;

    const keep = BABYLON.MeshBuilder.CreateCylinder("caelus-expedition-keep", {
      height: 31,
      diameterTop: 21,
      diameterBottom: 28,
      tessellation: 12
    }, this.scene);
    keep.position = new BABYLON.Vector3(0, this.heightAt(0, 172) + 15.5, 172);
    keep.material = stone;
    keep.receiveShadows = true;
    this.shadowGenerator.addShadowCaster(keep);
    const keepRoof = BABYLON.MeshBuilder.CreateCylinder("caelus-expedition-keep-roof", {
      height: 9,
      diameterTop: 0,
      diameterBottom: 31,
      tessellation: 12
    }, this.scene);
    keepRoof.position = new BABYLON.Vector3(0, this.heightAt(0, 172) + 35.5, 172);
    keepRoof.material = roofBlue;
    this.shadowGenerator.addShadowCaster(keepRoof);
    const keepRune = BABYLON.MeshBuilder.CreateTorus("caelus-expedition-keep-rune", {
      diameter: 6,
      thickness: 0.32,
      tessellation: 24
    }, this.scene);
    keepRune.position = new BABYLON.Vector3(0, this.heightAt(0, 172) + 19, 185.6);
    keepRune.rotation.x = Math.PI / 2;
    keepRune.material = glow;

    let buildingIndex = 0;
    for (let row = 0; row < 5; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        const x = -98 + column * 28 + (row % 2) * 3;
        const z = 49 + row * 27;
        if (Math.abs(x) < 18 || distance2d(x, z, 0, 112) < 32 || distance2d(x, z, 0, 172) < 32) continue;
        const width = 13 + this.random() * 6;
        const depth = 11 + this.random() * 5;
        const height = 8 + this.random() * 5;
        const baseY = this.heightAt(x, z);
        const building = BABYLON.MeshBuilder.CreateBox(`caelus-building-${buildingIndex}`, {
          width,
          height,
          depth
        }, this.scene);
        building.position = new BABYLON.Vector3(x, baseY + height / 2, z);
        building.material = buildingIndex % 2 ? plasterA : plasterB;
        building.receiveShadows = true;
        this.shadowGenerator.addShadowCaster(building);

        const lowerBand = BABYLON.MeshBuilder.CreateBox(`caelus-building-band-${buildingIndex}`, {
          width: width + 0.3,
          height: 1.2,
          depth: depth + 0.3
        }, this.scene);
        lowerBand.position = new BABYLON.Vector3(x, baseY + 1.6, z);
        lowerBand.material = timber;
        this.shadowGenerator.addShadowCaster(lowerBand);

        const roof = BABYLON.MeshBuilder.CreateCylinder(`caelus-building-roof-${buildingIndex}`, {
          height: 4.6,
          diameterTop: 0,
          diameterBottom: Math.max(width, depth) * 1.38,
          tessellation: 4
        }, this.scene);
        roof.position = new BABYLON.Vector3(x, baseY + height + 2.25, z);
        roof.rotation.y = Math.PI / 4;
        roof.scaling.z = depth / width;
        roof.material = buildingIndex % 3 === 0 ? roofGreen : roofBlue;
        this.shadowGenerator.addShadowCaster(roof);
        buildingIndex += 1;
      }
    }

    for (let index = 0; index < 14; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const z = 38 + Math.floor(index / 2) * 23;
      this.createLantern(`city-lantern-${index}`, side * 14, z, gold, glow, 1.1);
    }
  }

  private createFrontierRoad(): void {
    const roadMaterial = createMaterial(this.scene, "frontier-road", "#887b60", 0.97, 0.01);
    const vergeMaterial = createMaterial(this.scene, "frontier-road-verge", "#536151", 0.98, 0.01);
    const main = this.sampleCatmullRom([
      new BABYLON.Vector3(0, 0, 18),
      new BABYLON.Vector3(0, 0, -70),
      new BABYLON.Vector3(-36, 0, -155),
      new BABYLON.Vector3(12, 0, -245),
      new BABYLON.Vector3(128, 0, -330),
      new BABYLON.Vector3(285, 0, -420),
      new BABYLON.Vector3(458, 0, -480)
    ], 24);
    this.createTerrainRibbon("frontier-road-verge", main, 8.2, vergeMaterial, 0.025);
    this.createTerrainRibbon("frontier-road", main, 5.8, roadMaterial, 0.06);

    const western = this.sampleCatmullRom([
      new BABYLON.Vector3(-20, 0, -165),
      new BABYLON.Vector3(-120, 0, -230),
      new BABYLON.Vector3(-260, 0, -285),
      new BABYLON.Vector3(-405, 0, -360)
    ], 18);
    this.createTerrainRibbon("western-expedition-road-verge", western, 6.3, vergeMaterial, 0.02);
    this.createTerrainRibbon("western-expedition-road", western, 4.3, roadMaterial, 0.05);

    const northern = this.sampleCatmullRom([
      new BABYLON.Vector3(10, 0, -245),
      new BABYLON.Vector3(-20, 0, -345),
      new BABYLON.Vector3(35, 0, -455),
      new BABYLON.Vector3(100, 0, -570)
    ], 18);
    this.createTerrainRibbon("north-basin-road-verge", northern, 5.8, vergeMaterial, 0.02);
    this.createTerrainRibbon("north-basin-road", northern, 3.9, roadMaterial, 0.05);
  }

  private createLandmarks(): void {
    const aqueduct = createAqueduct(
      this.scene,
      new BABYLON.Vector3(235, this.heightAt(235, -350), -350)
    );
    aqueduct.rotation.y = -0.48;
    aqueduct.scaling = new BABYLON.Vector3(2.6, 2.6, 2.6);
    aqueduct.getChildMeshes().forEach((mesh: any) => {
      mesh.receiveShadows = true;
      this.shadowGenerator.addShadowCaster(mesh);
    });

    const pillarLocations = [
      new BABYLON.Vector3(-620, this.heightAt(-620, -520), -520),
      new BABYLON.Vector3(620, this.heightAt(620, -535), -535),
      new BABYLON.Vector3(-665, this.heightAt(-665, 75), 75),
      new BABYLON.Vector3(665, this.heightAt(665, 55), 55),
      new BABYLON.Vector3(535, this.heightAt(535, -560), -560)
    ];
    pillarLocations.forEach((location, index) => {
      createMegastructurePillar(this.scene, location, index === 4 ? 1.85 : 1.62, index);
    });

    const ribMaterial = createMaterial(this.scene, "foundation-rib", "#354c55", 0.38, 0.62);
    const anchorMaterial = createMaterial(this.scene, "foundation-rib-anchor", "#61747a", 0.3, 0.7);
    const anchors = [
      new BABYLON.Vector3(-620, 155, -520),
      new BABYLON.Vector3(620, 155, -535),
      new BABYLON.Vector3(-665, 155, 75),
      new BABYLON.Vector3(665, 155, 55)
    ];
    anchors.forEach((anchor, index) => {
      const targetAngle = index * Math.PI / 2 + Math.PI / 4;
      const path: any[] = [];
      for (let step = 0; step <= 28; step += 1) {
        const t = step / 28;
        const eased = t * t * (3 - 2 * t);
        path.push(new BABYLON.Vector3(
          BABYLON.Scalar.Lerp(anchor.x, Math.cos(targetAngle) * 95, eased),
          anchor.y + Math.sin(t * Math.PI) * 115 + t * 55,
          BABYLON.Scalar.Lerp(anchor.z, -180 + Math.sin(targetAngle) * 95, eased)
        ));
      }
      const rib = BABYLON.MeshBuilder.CreateTube(`foundation-rib-${index}`, {
        path,
        radius: 3.8,
        tessellation: 14,
        cap: BABYLON.Mesh.CAP_ALL
      }, this.scene);
      rib.material = ribMaterial;
      rib.isPickable = false;
      this.shadowGenerator.addShadowCaster(rib);

      const collar = BABYLON.MeshBuilder.CreateTorus(`foundation-rib-collar-${index}`, {
        diameter: 18,
        thickness: 1.3,
        tessellation: 24
      }, this.scene);
      collar.position.copyFrom(anchor);
      collar.rotation.x = Math.PI / 2;
      collar.material = anchorMaterial;
      this.shadowGenerator.addShadowCaster(collar);
    });

    const metal = createMaterial(this.scene, "expedition-lantern-metal", "#30474e", 0.33, 0.66);
    const lightMaterial = createMaterial(this.scene, "expedition-lantern-flame", "#ffd788", 0.1, 0, "#ff9f43");
    this.createLantern("expedition-lantern", -4.5, -18, metal, lightMaterial, 1.7);

    this.createRuinedCamp(-330, -340);
    this.createRuinedCamp(92, -535);
  }

  private createLabyrinthBreach(): void {
    this.labyrinthPosition.y = this.heightAt(this.labyrinthPosition.x, this.labyrinthPosition.z);
    const cliff = createMaterial(this.scene, "foundry-cliff", "#3d5551", 0.94, 0.03);
    const cliffDark = createMaterial(this.scene, "foundry-cliff-dark", "#1c2c2d", 0.9, 0.1);
    const voidMaterial = new BABYLON.StandardMaterial("labyrinth-void", this.scene);
    voidMaterial.diffuseColor = BABYLON.Color3.FromHexString("#030707");
    voidMaterial.emissiveColor = BABYLON.Color3.FromHexString("#071112");
    const rune = createMaterial(this.scene, "labyrinth-rune", "#71e8e9", 0.18, 0.22, "#2ccbd2");

    for (let index = 0; index < 28; index += 1) {
      const angle = -1.42 + index * 0.108;
      const radius = 50 + Math.sin(index * 1.9) * 7;
      const x = this.labyrinthPosition.x + Math.sin(angle) * radius;
      const z = this.labyrinthPosition.z + Math.cos(angle) * radius;
      const rockHeight = 22 + (index % 5) * 4.5;
      const rock = BABYLON.MeshBuilder.CreatePolyhedron(`labyrinth-cliff-${index}`, {
        type: index % 5,
        size: 14
      }, this.scene);
      rock.position = new BABYLON.Vector3(x, this.heightAt(x, z) + rockHeight * 0.43, z);
      rock.scaling = new BABYLON.Vector3(
        1.45 + (index % 3) * 0.35,
        rockHeight / 14,
        1.15 + (index % 2) * 0.28
      );
      rock.rotation = new BABYLON.Vector3(index * 0.13, angle, index * 0.07);
      rock.material = index % 4 === 0 ? cliffDark : cliff;
      rock.receiveShadows = true;
      this.shadowGenerator.addShadowCaster(rock);
    }

    const mouth = BABYLON.MeshBuilder.CreateBox("labyrinth-mouth", {
      width: 15,
      height: 13,
      depth: 6
    }, this.scene);
    mouth.position = new BABYLON.Vector3(
      this.labyrinthPosition.x,
      this.labyrinthPosition.y + 6.4,
      this.labyrinthPosition.z + 1
    );
    mouth.material = voidMaterial;

    for (let index = 0; index < 19; index += 1) {
      const angle = Math.PI * (index / 18);
      const block = BABYLON.MeshBuilder.CreatePolyhedron(`labyrinth-arch-${index}`, {
        type: 1,
        size: 1.75
      }, this.scene);
      block.position = new BABYLON.Vector3(
        this.labyrinthPosition.x + Math.cos(angle) * 8.5,
        this.labyrinthPosition.y + 5.5 + Math.sin(angle) * 8.4,
        this.labyrinthPosition.z + 3
      );
      block.rotation.z = -angle;
      block.material = index % 4 === 0 ? rune : cliffDark;
      this.shadowGenerator.addShadowCaster(block);
    }

    const tunnelPoints = [
      new BABYLON.Vector3(this.labyrinthPosition.x, 0, this.labyrinthPosition.z + 17),
      new BABYLON.Vector3(this.labyrinthPosition.x, 0, this.labyrinthPosition.z + 6),
      new BABYLON.Vector3(this.labyrinthPosition.x, 0, this.labyrinthPosition.z - 8),
      new BABYLON.Vector3(this.labyrinthPosition.x, 0, this.labyrinthPosition.z - 22)
    ];
    this.createTerrainRibbon("labyrinth-approach-floor", tunnelPoints, 7.4, cliffDark, 0.08);

    for (let index = 0; index < 7; index += 1) {
      const z = this.labyrinthPosition.z + 13 - index * 5.6;
      const rib = BABYLON.MeshBuilder.CreateTorus(`labyrinth-tunnel-rib-${index}`, {
        diameter: 15,
        thickness: 0.65,
        tessellation: 20,
        arc: 0.5
      }, this.scene);
      rib.position = new BABYLON.Vector3(
        this.labyrinthPosition.x,
        this.heightAt(this.labyrinthPosition.x, z) + 3.2,
        z
      );
      rib.rotation.x = Math.PI / 2;
      rib.rotation.z = Math.PI / 2;
      rib.material = cliffDark;
      this.shadowGenerator.addShadowCaster(rib);
    }
  }

  private createFoliage(): void {
    let treeIndex = 0;
    const clusters = [
      [-350, -250, 170],
      [300, -215, 145],
      [-210, -500, 165],
      [120, -560, 115],
      [500, -300, 95]
    ];
    clusters.forEach(([cx, cz, spread], clusterIndex) => {
      for (let index = 0; index < 68; index += 1) {
        const angle = this.random() * Math.PI * 2;
        const radius = Math.sqrt(this.random()) * spread;
        const x = cx + Math.cos(angle) * radius;
        const z = cz + Math.sin(angle) * radius;
        if (Math.hypot(x, z + 180) > this.floorRadius - 55) continue;
        if (this.nearImportantArea(x, z)) continue;
        createTree(
          this.scene,
          new BABYLON.Vector3(x, this.heightAt(x, z), z),
          0.7 + this.random() * 1.45,
          treeIndex + clusterIndex * 100
        );
        treeIndex += 1;
      }
    });

    for (let index = 0; index < 420; index += 1) {
      const angle = this.random() * Math.PI * 2;
      const radius = Math.sqrt(this.random()) * (this.floorRadius - 60);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius - 180;
      if (this.nearImportantArea(x, z)) continue;
      createRock(
        this.scene,
        new BABYLON.Vector3(x, this.heightAt(x, z) - 0.12, z),
        0.35 + this.random() * 1.5,
        index
      );
    }

    const bladeMaterial = createMaterial(this.scene, "red-grass-mat", "#94575a", 0.96, 0);
    bladeMaterial.backFaceCulling = false;
    for (let patch = 0; patch < 120; patch += 1) {
      const angle = this.random() * Math.PI * 2;
      const radius = 18 + this.random() * 105;
      const x = this.markerPosition.x + Math.cos(angle) * radius;
      const z = this.markerPosition.z + Math.sin(angle) * radius;
      const root = new BABYLON.TransformNode(`red-grass-patch-${patch}`, this.scene);
      root.position = new BABYLON.Vector3(x, this.heightAt(x, z), z);
      for (let blade = 0; blade < 6; blade += 1) {
        const mesh = BABYLON.MeshBuilder.CreateCylinder(`red-grass-${patch}-${blade}`, {
          height: 0.8 + this.random() * 0.8,
          diameterTop: 0.01,
          diameterBottom: 0.085,
          tessellation: 3
        }, this.scene);
        mesh.material = bladeMaterial;
        mesh.position = new BABYLON.Vector3(
          (this.random() - 0.5) * 1.25,
          0.45,
          (this.random() - 0.5) * 1.25
        );
        mesh.rotation.z = (this.random() - 0.5) * 0.35;
        mesh.parent = root;
      }
    }
  }

  private createAtmosphere(): void {
    const dustTexture = new BABYLON.DynamicTexture(
      "dust-particle-texture",
      { width: 32, height: 32 },
      this.scene,
      false
    );
    const context = dustTexture.getContext();
    const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, "rgba(220,250,255,0.8)");
    gradient.addColorStop(0.35, "rgba(128,224,232,0.34)");
    gradient.addColorStop(1, "rgba(60,160,190,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
    dustTexture.update(false);

    const dust = new BABYLON.ParticleSystem("foundation-dust", 500, this.scene);
    dust.particleTexture = dustTexture;
    dust.emitter = new BABYLON.Vector3(0, 42, -180);
    dust.minEmitBox = new BABYLON.Vector3(-720, -22, -670);
    dust.maxEmitBox = new BABYLON.Vector3(720, 80, 670);
    dust.color1 = new BABYLON.Color4(0.52, 0.88, 0.9, 0.12);
    dust.color2 = new BABYLON.Color4(0.72, 0.9, 0.7, 0.06);
    dust.minSize = 0.08;
    dust.maxSize = 0.28;
    dust.minLifeTime = 8;
    dust.maxLifeTime = 18;
    dust.emitRate = 34;
    dust.gravity = new BABYLON.Vector3(0, 0.018, 0);
    dust.direction1 = new BABYLON.Vector3(-0.55, 0.04, -0.18);
    dust.direction2 = new BABYLON.Vector3(0.9, 0.14, 0.5);
    dust.minAngularSpeed = 0;
    dust.maxAngularSpeed = 0.45;
    dust.start();
  }

  private createTerrainRibbon(
    name: string,
    points: any[],
    halfWidth: number,
    material: any,
    yOffset: number
  ): any {
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    let distance = 0;

    points.forEach((point, index) => {
      const previous = points[Math.max(0, index - 1)];
      const next = points[Math.min(points.length - 1, index + 1)];
      const tangent = new BABYLON.Vector3(next.x - previous.x, 0, next.z - previous.z);
      if (tangent.lengthSquared() < 0.0001) tangent.z = 1;
      tangent.normalize();
      const side = new BABYLON.Vector3(-tangent.z, 0, tangent.x);
      if (index > 0) distance += BABYLON.Vector3.Distance(points[index - 1], point);

      const leftX = point.x + side.x * halfWidth;
      const leftZ = point.z + side.z * halfWidth;
      const rightX = point.x - side.x * halfWidth;
      const rightZ = point.z - side.z * halfWidth;
      positions.push(leftX, this.heightAt(leftX, leftZ) + yOffset, leftZ);
      positions.push(rightX, this.heightAt(rightX, rightZ) + yOffset, rightZ);
      uvs.push(0, distance / 12, 1, distance / 12);

      if (index < points.length - 1) {
        const base = index * 2;
        indices.push(base, base + 2, base + 1);
        indices.push(base + 1, base + 2, base + 3);
      }
    });

    BABYLON.VertexData.ComputeNormals(positions, indices, normals);
    const mesh = new BABYLON.Mesh(name, this.scene);
    const data = new BABYLON.VertexData();
    data.positions = positions;
    data.indices = indices;
    data.normals = normals;
    data.uvs = uvs;
    data.applyToMesh(mesh, true);
    mesh.material = material;
    mesh.receiveShadows = true;
    mesh.isPickable = true;
    mesh.metadata = { cameraCollision: false, terrainRibbon: true };
    return mesh;
  }

  private sampleCatmullRom(controlPoints: any[], stepsPerSegment: number): any[] {
    const result: any[] = [];
    for (let index = 0; index < controlPoints.length - 1; index += 1) {
      const p0 = controlPoints[Math.max(0, index - 1)];
      const p1 = controlPoints[index];
      const p2 = controlPoints[index + 1];
      const p3 = controlPoints[Math.min(controlPoints.length - 1, index + 2)];
      for (let step = 0; step < stepsPerSegment; step += 1) {
        const t = step / stepsPerSegment;
        const t2 = t * t;
        const t3 = t2 * t;
        result.push(new BABYLON.Vector3(
          0.5 * (
            (2 * p1.x)
            + (-p0.x + p2.x) * t
            + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2
            + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
          ),
          0,
          0.5 * (
            (2 * p1.z)
            + (-p0.z + p2.z) * t
            + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2
            + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3
          )
        ));
      }
    }
    result.push(controlPoints[controlPoints.length - 1].clone());
    return result;
  }

  private nearImportantArea(x: number, z: number): boolean {
    const nearCity = Math.abs(x) < 155 && z > 0 && z < 220;
    const nearSpawn = Math.hypot(x, z + 18) < 32;
    const nearMarker = distance2d(x, z, this.markerPosition.x, this.markerPosition.z) < 28;
    const nearLabyrinth = distance2d(x, z, this.labyrinthPosition.x, this.labyrinthPosition.z) < 68;
    return nearCity || nearSpawn || nearMarker || nearLabyrinth;
  }

  private createRuinedCamp(x: number, z: number): void {
    const wood = createMaterial(this.scene, `camp-wood-${x}-${z}`, "#514336", 0.92, 0.02);
    const cloth = createMaterial(this.scene, `camp-cloth-${x}-${z}`, "#6e5c47", 0.96, 0.01);
    const stone = createMaterial(this.scene, `camp-stone-${x}-${z}`, "#5b6761", 0.95, 0.01);
    for (let index = 0; index < 5; index += 1) {
      const post = BABYLON.MeshBuilder.CreateCylinder(`camp-post-${x}-${z}-${index}`, {
        height: 3 + (index % 2) * 0.7,
        diameter: 0.18,
        tessellation: 6
      }, this.scene);
      post.position = new BABYLON.Vector3(
        x + (index - 2) * 2.1,
        this.heightAt(x + (index - 2) * 2.1, z) + 1.4,
        z + (index % 2) * 2
      );
      post.rotation.z = (index - 2) * 0.05;
      post.material = wood;
      this.shadowGenerator.addShadowCaster(post);
    }
    const awning = BABYLON.MeshBuilder.CreateBox(`camp-awning-${x}-${z}`, {
      width: 10,
      height: 0.18,
      depth: 5
    }, this.scene);
    awning.position = new BABYLON.Vector3(x, this.heightAt(x, z) + 3.4, z + 1);
    awning.rotation.z = -0.08;
    awning.material = cloth;
    this.shadowGenerator.addShadowCaster(awning);

    for (let index = 0; index < 9; index += 1) {
      createRock(
        this.scene,
        new BABYLON.Vector3(
          x + Math.cos(index / 9 * Math.PI * 2) * 3,
          this.heightAt(x, z),
          z + Math.sin(index / 9 * Math.PI * 2) * 3
        ),
        0.45,
        index + Math.abs(x)
      );
    }
    const fire = BABYLON.MeshBuilder.CreateSphere(`camp-fire-${x}-${z}`, {
      diameter: 0.55,
      segments: 8
    }, this.scene);
    fire.position = new BABYLON.Vector3(x, this.heightAt(x, z) + 0.4, z);
    fire.material = stone;
  }

  private createLantern(
    name: string,
    x: number,
    z: number,
    metal: any,
    lightMaterial: any,
    intensity: number
  ): void {
    const root = new BABYLON.TransformNode(name, this.scene);
    root.position = new BABYLON.Vector3(x, this.heightAt(x, z), z);
    const pole = BABYLON.MeshBuilder.CreateCylinder(`${name}-pole`, {
      height: 3.2,
      diameterTop: 0.07,
      diameterBottom: 0.17,
      tessellation: 8
    }, this.scene);
    pole.material = metal;
    pole.position.y = 1.6;
    pole.parent = root;
    const arm = BABYLON.MeshBuilder.CreateCylinder(`${name}-arm`, {
      height: 0.75,
      diameter: 0.07,
      tessellation: 8
    }, this.scene);
    arm.material = metal;
    arm.rotation.z = Math.PI / 2;
    arm.position = new BABYLON.Vector3(0.28, 2.85, 0);
    arm.parent = root;
    const cage = BABYLON.MeshBuilder.CreatePolyhedron(`${name}-cage`, { type: 1, size: 0.38 }, this.scene);
    cage.material = metal;
    cage.position = new BABYLON.Vector3(0.6, 2.7, 0);
    cage.parent = root;
    const flame = BABYLON.MeshBuilder.CreateSphere(`${name}-flame`, {
      diameter: 0.24,
      segments: 8
    }, this.scene);
    flame.material = lightMaterial;
    flame.scaling.y = 1.5;
    flame.position = new BABYLON.Vector3(0.6, 2.7, 0);
    flame.parent = root;
    const point = new BABYLON.PointLight(`${name}-light`, new BABYLON.Vector3(0.6, 2.7, 0), this.scene);
    point.parent = root;
    point.diffuse = BABYLON.Color3.FromHexString("#ffd38a");
    point.range = 14;
    point.intensity = intensity;
  }
}
