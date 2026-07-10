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

const seeded = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const distance2d = (x: number, z: number, cx: number, cz: number): number => Math.hypot(x - cx, z - cz);

export class World {
  public readonly scene: any;
  public readonly camera: any;
  public readonly shadowGenerator: any;
  public readonly glowLayer: any;
  public readonly mara: HumanoidVisual;
  public readonly marker: any;
  public readonly markerPosition = new BABYLON.Vector3(218, 0, -338);
  public readonly labyrinthPosition = new BABYLON.Vector3(382, 0, -515);
  public readonly spawnPoints = [
    new BABYLON.Vector3(-18, 0, -82),
    new BABYLON.Vector3(28, 0, -148),
    new BABYLON.Vector3(-42, 0, -224),
    new BABYLON.Vector3(72, 0, -282),
    new BABYLON.Vector3(168, 0, -326)
  ];

  private readonly random = seeded(8675309);

  constructor(public readonly engine: any) {
    this.scene = new BABYLON.Scene(engine);
    this.scene.clearColor = new BABYLON.Color4(0.025, 0.06, 0.09, 1);
    this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.00108;
    this.scene.fogColor = new BABYLON.Color3(0.14, 0.27, 0.31);
    this.scene.environmentIntensity = 0.72;

    this.camera = new BABYLON.FreeCamera("player-camera", new BABYLON.Vector3(0, 4, 8), this.scene);
    this.camera.minZ = 0.05;
    this.camera.maxZ = 2800;
    this.camera.fov = BABYLON.Tools.ToRadians(75);
    this.scene.activeCamera = this.camera;

    const hemisphere = new BABYLON.HemisphericLight("foundation-fill", new BABYLON.Vector3(0.15, 1, 0.1), this.scene);
    hemisphere.intensity = 0.91;
    hemisphere.diffuse = BABYLON.Color3.FromHexString("#bfe9e7");
    hemisphere.groundColor = BABYLON.Color3.FromHexString("#1b2834");

    const sun = new BABYLON.DirectionalLight("artificial-sun", new BABYLON.Vector3(-0.52, -1, -0.26), this.scene);
    sun.position = new BABYLON.Vector3(180, 310, 130);
    sun.intensity = 3.05;
    sun.diffuse = BABYLON.Color3.FromHexString("#ffe1ad");
    this.shadowGenerator = new BABYLON.ShadowGenerator(2048, sun);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = 18;
    this.shadowGenerator.darkness = 0.34;

    this.glowLayer = new BABYLON.GlowLayer("rift-glow", this.scene, { blurKernelSize: 48 });
    this.glowLayer.intensity = 0.6;

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

    const pipeline = new BABYLON.DefaultRenderingPipeline("foundation-pipeline", true, this.scene, [this.camera]);
    pipeline.fxaaEnabled = true;
    pipeline.samples = 2;
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.72;
    pipeline.bloomWeight = 0.14;
    pipeline.bloomKernel = 48;
    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.contrast = 1.13;
    pipeline.imageProcessing.exposure = 1.02;
  }

  public heightAt(x: number, z: number): number {
    const broad = Math.sin(x * 0.012) * 3.4 + Math.cos(z * 0.0105) * 3.1;
    const rolling = Math.sin((x + z) * 0.025) * 1.35 + Math.cos((x - z) * 0.019) * 1.1;
    const westernRidge = Math.exp(-Math.pow((x + 265) / 105, 2) - Math.pow((z + 330) / 250, 2)) * 24;
    const easternHighland = Math.exp(-Math.pow((x - 300) / 150, 2) - Math.pow((z + 420) / 230, 2)) * 31;
    const aqueductShelf = Math.exp(-Math.pow((x - 215) / 130, 2) - Math.pow((z + 330) / 125, 2)) * 8;
    const northernBasin = -Math.exp(-Math.pow(x / 180, 2) - Math.pow((z + 180) / 210, 2)) * 5.5;
    let height = broad + rolling + westernRidge + easternHighland + aqueductShelf + northernBasin;

    const cityMask = Math.exp(-Math.pow(x / 118, 8) - Math.pow((z - 104) / 92, 8));
    height *= 1 - cityMask * 0.96;

    const roadCenterX = z < -250 ? Math.max(0, Math.min(260, (-z - 250) * 0.92)) : 0;
    const roadMask = Math.exp(-Math.pow((x - roadCenterX) / 11, 2)) * Math.exp(-Math.pow((z + 225) / 360, 2));
    height *= 1 - roadMask * 0.72;

    const labyrinthShelf = Math.exp(-Math.pow((x - 382) / 62, 2) - Math.pow((z + 515) / 70, 2));
    height = height * (1 - labyrinthShelf * 0.72) + 14 * labyrinthShelf;
    return height;
  }

  private createTerrain(): void {
    const ground = BABYLON.MeshBuilder.CreateGround("windscar-terrain", {
      width: 1200,
      height: 1400,
      subdivisions: 190,
      updatable: true
    }, this.scene);
    const positions = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind) as number[];
    const indices = ground.getIndices() as number[];
    const normals = ground.getVerticesData(BABYLON.VertexBuffer.NormalKind) as number[];
    for (let index = 0; index < positions.length; index += 3) {
      const x = positions[index];
      const z = positions[index + 2];
      positions[index + 1] = this.heightAt(x, z);
    }
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);
    ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
    ground.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
    ground.refreshBoundingInfo();
    ground.receiveShadows = true;
    ground.isPickable = true;

    const terrainMaterial = createMaterial(this.scene, "windscar-ground", "#506d54", 0.96, 0.01);
    const texture = new BABYLON.DynamicTexture("windscar-ground-texture", { width: 768, height: 768 }, this.scene, false);
    const context = texture.getContext();
    const gradient = context.createLinearGradient(0, 0, 768, 768);
    gradient.addColorStop(0, "#687d56");
    gradient.addColorStop(0.42, "#455f49");
    gradient.addColorStop(0.74, "#36534a");
    gradient.addColorStop(1, "#29423f");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 768, 768);
    for (let index = 0; index < 3600; index += 1) {
      const green = 66 + Math.floor(this.random() * 62);
      const alpha = 0.035 + this.random() * 0.12;
      context.fillStyle = `rgba(${38 + Math.floor(this.random() * 38)}, ${green}, ${42 + Math.floor(this.random() * 38)}, ${alpha})`;
      const size = 1 + this.random() * 4;
      context.fillRect(this.random() * 768, this.random() * 768, size, size * 2.4);
    }
    texture.update(false);
    texture.uScale = 58;
    texture.vScale = 68;
    terrainMaterial.albedoTexture = texture;
    terrainMaterial.bumpTexture = texture;
    terrainMaterial.bumpTexture.level = 0.1;
    ground.material = terrainMaterial;
  }

  private createSkyAndCeiling(): void {
    const sky = BABYLON.MeshBuilder.CreateSphere("foundation-sky", { diameter: 2200, segments: 32 }, this.scene);
    const skyMaterial = new BABYLON.StandardMaterial("foundation-sky-mat", this.scene);
    skyMaterial.backFaceCulling = false;
    skyMaterial.disableLighting = true;
    skyMaterial.emissiveColor = BABYLON.Color3.FromHexString("#4b8792");
    skyMaterial.diffuseColor = BABYLON.Color3.Black();
    sky.material = skyMaterial;
    sky.isPickable = false;

    const ceiling = BABYLON.MeshBuilder.CreateSphere("upper-floor-vault", { diameter: 1750, segments: 48 }, this.scene);
    ceiling.scaling = new BABYLON.Vector3(1, 0.18, 1);
    ceiling.position.y = 285;
    const ceilingMaterial = new BABYLON.StandardMaterial("upper-floor-vault-mat", this.scene);
    ceilingMaterial.backFaceCulling = false;
    ceilingMaterial.alpha = 0.22;
    ceilingMaterial.emissiveColor = BABYLON.Color3.FromHexString("#162d3b");
    ceilingMaterial.diffuseColor = BABYLON.Color3.FromHexString("#2e5260");
    ceiling.material = ceilingMaterial;
    ceiling.isPickable = false;

    [430, 590, 760].forEach((diameter, index) => {
      const ring = BABYLON.MeshBuilder.CreateTorus(`ceiling-structure-ring-${index}`, {
        diameter,
        thickness: 4 + index * 1.4,
        tessellation: 96
      }, this.scene);
      ring.position.y = 240 + index * 17;
      ring.rotation.x = Math.PI / 2;
      ring.material = createMaterial(this.scene, `ceiling-ring-mat-${index}`, "#253d49", 0.5, 0.45);
      ring.isPickable = false;
    });
  }

  private createBoundaryStructure(): void {
    const wallMaterial = createMaterial(this.scene, "floor-boundary-wall", "#263b43", 0.7, 0.28);
    const braceMaterial = createMaterial(this.scene, "floor-boundary-brace", "#3c535a", 0.58, 0.44);
    const walls = [
      { x: -610, z: -150, width: 28, depth: 1180 },
      { x: 610, z: -150, width: 28, depth: 1180 },
      { x: 0, z: -710, width: 1240, depth: 28 }
    ];
    walls.forEach((definition, index) => {
      const wall = BABYLON.MeshBuilder.CreateBox(`foundation-boundary-${index}`, {
        width: definition.width,
        height: 190,
        depth: definition.depth
      }, this.scene);
      wall.position = new BABYLON.Vector3(definition.x, 91, definition.z);
      wall.material = wallMaterial;
      wall.receiveShadows = true;

      const braceCount = definition.width > definition.depth ? 12 : 10;
      for (let braceIndex = 0; braceIndex < braceCount; braceIndex += 1) {
        const brace = BABYLON.MeshBuilder.CreateBox(`boundary-brace-${index}-${braceIndex}`, {
          width: definition.width > definition.depth ? 6 : 34,
          height: 202,
          depth: definition.width > definition.depth ? 34 : 6
        }, this.scene);
        const fraction = braceIndex / Math.max(1, braceCount - 1);
        brace.position = definition.width > definition.depth
          ? new BABYLON.Vector3(-560 + fraction * 1120, 95, definition.z + 1)
          : new BABYLON.Vector3(definition.x + 1, 95, -650 + fraction * 1000);
        brace.material = braceMaterial;
      }
    });
  }

  private createCaelusReach(): void {
    const stone = createMaterial(this.scene, "caelus-wall-stone", "#485b60", 0.8, 0.12);
    const darkStone = createMaterial(this.scene, "caelus-wall-shadow", "#293e46", 0.72, 0.24);
    const roofBlue = createMaterial(this.scene, "caelus-roof-blue", "#284b5c", 0.8, 0.15);
    const roofGreen = createMaterial(this.scene, "caelus-roof-green", "#355846", 0.86, 0.08);
    const plasterA = createMaterial(this.scene, "caelus-plaster-a", "#8a8a75", 0.94, 0.02);
    const plasterB = createMaterial(this.scene, "caelus-plaster-b", "#6e8179", 0.94, 0.02);
    const timber = createMaterial(this.scene, "caelus-timber", "#493b31", 0.94, 0.02);
    const gold = createMaterial(this.scene, "caelus-civic-gold", "#c5a45e", 0.35, 0.62);
    const glow = createMaterial(this.scene, "caelus-civic-glow", "#7ceef2", 0.16, 0.18, "#42dce7");

    const createWallSegment = (name: string, x: number, z: number, width: number, depth: number): void => {
      const baseY = this.heightAt(x, z);
      const wall = BABYLON.MeshBuilder.CreateBox(name, { width, height: 9.5, depth }, this.scene);
      wall.position = new BABYLON.Vector3(x, baseY + 4.75, z);
      wall.material = stone;
      wall.receiveShadows = true;
      this.shadowGenerator.addShadowCaster(wall);
      const cap = BABYLON.MeshBuilder.CreateBox(`${name}-cap`, { width: width + 1, height: 0.7, depth: depth + 1 }, this.scene);
      cap.position = new BABYLON.Vector3(x, baseY + 9.65, z);
      cap.material = darkStone;
      this.shadowGenerator.addShadowCaster(cap);
    };

    [-82, -48, -22, 22, 48, 82].forEach((x, index) => createWallSegment(`caelus-south-wall-${index}`, x, 27, index === 0 || index === 5 ? 28 : 22, 4));
    for (let index = 0; index < 9; index += 1) createWallSegment(`caelus-north-wall-${index}`, -88 + index * 22, 181, 23, 4);
    for (let index = 0; index < 7; index += 1) {
      const z = 45 + index * 22;
      createWallSegment(`caelus-west-wall-${index}`, -105, z, 4, 23);
      createWallSegment(`caelus-east-wall-${index}`, 105, z, 4, 23);
    }

    const towerLocations = [
      [-105, 27], [105, 27], [-105, 181], [105, 181], [-105, 103], [105, 103]
    ];
    towerLocations.forEach(([x, z], index) => {
      const baseY = this.heightAt(x, z);
      const tower = BABYLON.MeshBuilder.CreateCylinder(`caelus-wall-tower-${index}`, {
        height: 16,
        diameterTop: 8.6,
        diameterBottom: 10.5,
        tessellation: 8
      }, this.scene);
      tower.position = new BABYLON.Vector3(x, baseY + 8, z);
      tower.material = stone;
      tower.receiveShadows = true;
      this.shadowGenerator.addShadowCaster(tower);
      const crown = BABYLON.MeshBuilder.CreateCylinder(`caelus-wall-tower-crown-${index}`, {
        height: 2.8,
        diameterTop: 11,
        diameterBottom: 9.2,
        tessellation: 8
      }, this.scene);
      crown.position = new BABYLON.Vector3(x, baseY + 17.2, z);
      crown.material = roofBlue;
      this.shadowGenerator.addShadowCaster(crown);
    });

    const gate = createGate(this.scene, new BABYLON.Vector3(0, this.heightAt(0, 25), 24));
    gate.rotation.y = Math.PI;
    gate.scaling = new BABYLON.Vector3(1.55, 1.55, 1.55);
    gate.getChildMeshes().forEach((mesh: any) => {
      mesh.receiveShadows = true;
      this.shadowGenerator.addShadowCaster(mesh);
    });

    const plaza = BABYLON.MeshBuilder.CreateCylinder("caelus-central-plaza", {
      height: 0.28,
      diameter: 42,
      tessellation: 18
    }, this.scene);
    plaza.position = new BABYLON.Vector3(0, this.heightAt(0, 103) + 0.08, 103);
    plaza.material = darkStone;
    plaza.receiveShadows = true;

    const keep = BABYLON.MeshBuilder.CreateCylinder("caelus-expedition-keep", {
      height: 27,
      diameterTop: 18,
      diameterBottom: 23,
      tessellation: 10
    }, this.scene);
    keep.position = new BABYLON.Vector3(0, this.heightAt(0, 151) + 13.5, 151);
    keep.material = stone;
    keep.receiveShadows = true;
    this.shadowGenerator.addShadowCaster(keep);
    const keepRoof = BABYLON.MeshBuilder.CreateCylinder("caelus-expedition-keep-roof", {
      height: 8,
      diameterTop: 0,
      diameterBottom: 26,
      tessellation: 10
    }, this.scene);
    keepRoof.position = new BABYLON.Vector3(0, this.heightAt(0, 151) + 31, 151);
    keepRoof.material = roofBlue;
    this.shadowGenerator.addShadowCaster(keepRoof);
    const keepRune = BABYLON.MeshBuilder.CreateTorus("caelus-expedition-keep-rune", { diameter: 5.2, thickness: 0.3, tessellation: 22 }, this.scene);
    keepRune.position = new BABYLON.Vector3(0, this.heightAt(0, 151) + 17, 162.3);
    keepRune.rotation.x = Math.PI / 2;
    keepRune.material = glow;

    let buildingIndex = 0;
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        const x = -78 + column * 26 + (row % 2) * 4;
        const z = 54 + row * 27;
        if (Math.abs(x) < 17 || distance2d(x, z, 0, 103) < 29 || distance2d(x, z, 0, 151) < 28) continue;
        const width = 12 + this.random() * 6;
        const depth = 10 + this.random() * 5;
        const height = 7 + this.random() * 5;
        const baseY = this.heightAt(x, z);
        const building = BABYLON.MeshBuilder.CreateBox(`caelus-building-${buildingIndex}`, { width, height, depth }, this.scene);
        building.position = new BABYLON.Vector3(x, baseY + height / 2, z);
        building.material = buildingIndex % 2 ? plasterA : plasterB;
        building.receiveShadows = true;
        this.shadowGenerator.addShadowCaster(building);

        const lowerBand = BABYLON.MeshBuilder.CreateBox(`caelus-building-band-${buildingIndex}`, { width: width + 0.3, height: 1.1, depth: depth + 0.3 }, this.scene);
        lowerBand.position = new BABYLON.Vector3(x, baseY + 1.5, z);
        lowerBand.material = timber;
        this.shadowGenerator.addShadowCaster(lowerBand);

        const roof = BABYLON.MeshBuilder.CreateCylinder(`caelus-building-roof-${buildingIndex}`, {
          height: 4.4,
          diameterTop: 0,
          diameterBottom: Math.max(width, depth) * 1.35,
          tessellation: 4
        }, this.scene);
        roof.position = new BABYLON.Vector3(x, baseY + height + 2.15, z);
        roof.rotation.y = Math.PI / 4;
        roof.scaling.z = depth / width;
        roof.material = buildingIndex % 3 === 0 ? roofGreen : roofBlue;
        this.shadowGenerator.addShadowCaster(roof);

        const sign = BABYLON.MeshBuilder.CreateBox(`caelus-building-sign-${buildingIndex}`, { width: 1.7, height: 1.2, depth: 0.16 }, this.scene);
        sign.position = new BABYLON.Vector3(x, baseY + 3.8, z - depth / 2 - 0.12);
        sign.material = buildingIndex % 4 === 0 ? gold : timber;
        this.shadowGenerator.addShadowCaster(sign);
        buildingIndex += 1;
      }
    }

    for (let index = 0; index < 12; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const z = 42 + Math.floor(index / 2) * 22;
      this.createLantern(`city-lantern-${index}`, side * 12, z, gold, glow, 1.2);
    }
  }

  private createFrontierRoad(): void {
    const road = createMaterial(this.scene, "frontier-road", "#766a54", 0.98, 0.01);
    const edge = createMaterial(this.scene, "frontier-road-edge", "#4e564d", 0.98, 0.01);
    const segments = 74;
    for (let index = 0; index < segments; index += 1) {
      const t = index / (segments - 1);
      const z = 17 - t * 548;
      const bend = Math.max(0, t - 0.43) / 0.57;
      const x = bend * bend * 360;
      const nextT = Math.min(1, (index + 1) / (segments - 1));
      const nextZ = 17 - nextT * 548;
      const nextBend = Math.max(0, nextT - 0.43) / 0.57;
      const nextX = nextBend * nextBend * 360;
      const length = Math.hypot(nextX - x, nextZ - z) + 1;
      const heading = Math.atan2(nextX - x, nextZ - z);
      const y = this.heightAt(x, z) + 0.07;
      const strip = BABYLON.MeshBuilder.CreateBox(`frontier-road-${index}`, { width: 9.5, height: 0.18, depth: length }, this.scene);
      strip.position = new BABYLON.Vector3(x, y, z);
      strip.rotation.y = heading;
      strip.material = road;
      strip.receiveShadows = true;
      if (index % 5 === 0) {
        const verge = BABYLON.MeshBuilder.CreateBox(`frontier-road-verge-${index}`, { width: 13, height: 0.12, depth: length + 0.4 }, this.scene);
        verge.position = new BABYLON.Vector3(x, y - 0.06, z);
        verge.rotation.y = heading;
        verge.material = edge;
        verge.receiveShadows = true;
      }
    }
  }

  private createLandmarks(): void {
    const aqueduct = createAqueduct(this.scene, new BABYLON.Vector3(226, this.heightAt(226, -365), -365));
    aqueduct.rotation.y = -0.42;
    aqueduct.scaling = new BABYLON.Vector3(2.4, 2.4, 2.4);
    aqueduct.getChildMeshes().forEach((mesh: any) => {
      mesh.receiveShadows = true;
      this.shadowGenerator.addShadowCaster(mesh);
    });

    const pillarLocations = [
      new BABYLON.Vector3(-505, -2, -545),
      new BABYLON.Vector3(505, -2, -560),
      new BABYLON.Vector3(-520, -2, 160),
      new BABYLON.Vector3(525, -2, 135),
      new BABYLON.Vector3(438, 8, -575)
    ];
    pillarLocations.forEach((location, index) => createMegastructurePillar(this.scene, location, index === 4 ? 1.75 : 1.5, index));

    const metal = createMaterial(this.scene, "expedition-lantern-metal", "#2f454c", 0.33, 0.66);
    const lightMaterial = createMaterial(this.scene, "expedition-lantern-flame", "#ffd788", 0.1, 0, "#ff9f43");
    this.createLantern("expedition-lantern", -4.5, -18, metal, lightMaterial, 1.8);
  }

  private createLabyrinthBreach(): void {
    this.labyrinthPosition.y = this.heightAt(this.labyrinthPosition.x, this.labyrinthPosition.z);
    const cliff = createMaterial(this.scene, "foundry-cliff", "#354a49", 0.92, 0.04);
    const cliffDark = createMaterial(this.scene, "foundry-cliff-dark", "#172629", 0.86, 0.12);
    const voidMaterial = new BABYLON.StandardMaterial("labyrinth-void", this.scene);
    voidMaterial.diffuseColor = BABYLON.Color3.FromHexString("#020405");
    voidMaterial.emissiveColor = BABYLON.Color3.FromHexString("#020607");
    const rune = createMaterial(this.scene, "labyrinth-rune", "#68e8ed", 0.18, 0.22, "#39d6df");

    for (let index = 0; index < 11; index += 1) {
      const angle = -1.15 + index * 0.23;
      const radius = 58 + Math.sin(index * 1.7) * 8;
      const x = this.labyrinthPosition.x + Math.sin(angle) * radius;
      const z = this.labyrinthPosition.z + Math.cos(angle) * radius;
      const height = 24 + (index % 4) * 6;
      const rock = BABYLON.MeshBuilder.CreatePolyhedron(`labyrinth-cliff-${index}`, { type: index % 5, size: 14 }, this.scene);
      rock.position = new BABYLON.Vector3(x, this.heightAt(x, z) + height * 0.42, z);
      rock.scaling = new BABYLON.Vector3(1.5 + (index % 3) * 0.4, height / 14, 1.15 + (index % 2) * 0.3);
      rock.rotation = new BABYLON.Vector3(index * 0.17, angle, index * 0.09);
      rock.material = index % 3 === 0 ? cliffDark : cliff;
      rock.receiveShadows = true;
      this.shadowGenerator.addShadowCaster(rock);
    }

    const mouth = BABYLON.MeshBuilder.CreateBox("labyrinth-mouth", { width: 13, height: 12, depth: 2.5 }, this.scene);
    mouth.position = new BABYLON.Vector3(this.labyrinthPosition.x, this.labyrinthPosition.y + 6, this.labyrinthPosition.z + 2);
    mouth.material = voidMaterial;

    for (let index = 0; index < 15; index += 1) {
      const angle = Math.PI * (index / 14);
      const block = BABYLON.MeshBuilder.CreatePolyhedron(`labyrinth-arch-${index}`, { type: 1, size: 1.65 }, this.scene);
      block.position = new BABYLON.Vector3(
        this.labyrinthPosition.x + Math.cos(angle) * 7.5,
        this.labyrinthPosition.y + 5.5 + Math.sin(angle) * 7.4,
        this.labyrinthPosition.z
      );
      block.rotation.z = -angle;
      block.material = index % 3 === 0 ? rune : cliffDark;
      this.shadowGenerator.addShadowCaster(block);
    }

    const threshold = BABYLON.MeshBuilder.CreateBox("labyrinth-threshold", { width: 15, height: 0.6, depth: 11 }, this.scene);
    threshold.position = new BABYLON.Vector3(this.labyrinthPosition.x, this.labyrinthPosition.y + 0.2, this.labyrinthPosition.z + 7);
    threshold.material = cliffDark;
    threshold.receiveShadows = true;

    for (let index = 0; index < 5; index += 1) {
      const sigil = BABYLON.MeshBuilder.CreateTorus(`labyrinth-sigil-${index}`, { diameter: 1.3 + index * 0.12, thickness: 0.08, tessellation: 14 }, this.scene);
      sigil.position = new BABYLON.Vector3(this.labyrinthPosition.x - 5 + index * 2.5, this.labyrinthPosition.y + 1.1, this.labyrinthPosition.z + 2.5);
      sigil.rotation.x = Math.PI / 2;
      sigil.material = rune;
    }
  }

  private createFoliage(): void {
    let treeIndex = 0;
    for (let index = 0; index < 128; index += 1) {
      const x = this.random() * 1080 - 540;
      const z = this.random() * 820 - 610;
      const roadCenterX = z < -250 ? Math.max(0, Math.min(360, Math.pow(Math.max(0, (-z - 250) / 298), 2) * 360)) : 0;
      const nearRoad = Math.abs(x - roadCenterX) < 19;
      const nearCity = Math.abs(x) < 125 && z > 12 && z < 195;
      const nearSpawn = Math.hypot(x, z + 18) < 24;
      const nearAqueduct = distance2d(x, z, 226, -365) < 52;
      const nearLabyrinth = distance2d(x, z, this.labyrinthPosition.x, this.labyrinthPosition.z) < 78;
      if (nearRoad || nearCity || nearSpawn || nearAqueduct || nearLabyrinth) continue;
      createTree(this.scene, new BABYLON.Vector3(x, this.heightAt(x, z), z), 0.75 + this.random() * 1.25, treeIndex);
      treeIndex += 1;
    }

    for (let index = 0; index < 190; index += 1) {
      const x = this.random() * 1110 - 555;
      const z = this.random() * 860 - 630;
      if (Math.abs(x) < 14 && z > -250 && z < 15) continue;
      if (Math.abs(x) < 120 && z > 10 && z < 195) continue;
      createRock(this.scene, new BABYLON.Vector3(x, this.heightAt(x, z) - 0.12, z), 0.4 + this.random() * 1.25, index);
    }

    const bladeMaterial = createMaterial(this.scene, "red-grass-mat", "#874b4e", 0.96, 0);
    bladeMaterial.backFaceCulling = false;
    for (let patch = 0; patch < 64; patch += 1) {
      const angle = this.random() * Math.PI * 2;
      const radius = 18 + this.random() * 78;
      const x = this.markerPosition.x + Math.cos(angle) * radius;
      const z = this.markerPosition.z + Math.sin(angle) * radius;
      const root = new BABYLON.TransformNode(`red-grass-patch-${patch}`, this.scene);
      root.position = new BABYLON.Vector3(x, this.heightAt(x, z), z);
      for (let blade = 0; blade < 5; blade += 1) {
        const mesh = BABYLON.MeshBuilder.CreateCylinder(`red-grass-${patch}-${blade}`, {
          height: 0.8 + this.random() * 0.7,
          diameterTop: 0.01,
          diameterBottom: 0.08,
          tessellation: 3
        }, this.scene);
        mesh.material = bladeMaterial;
        mesh.position = new BABYLON.Vector3((this.random() - 0.5) * 1.1, mesh.getBoundingInfo().boundingBox.extendSize.y, (this.random() - 0.5) * 1.1);
        mesh.rotation.z = (this.random() - 0.5) * 0.35;
        mesh.parent = root;
      }
    }
  }

  private createAtmosphere(): void {
    const dustTexture = new BABYLON.DynamicTexture("dust-particle-texture", { width: 32, height: 32 }, this.scene, false);
    const context = dustTexture.getContext();
    const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, "rgba(210,246,255,0.9)");
    gradient.addColorStop(0.35, "rgba(118,222,242,0.42)");
    gradient.addColorStop(1, "rgba(60,160,190,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
    dustTexture.update(false);

    const dust = new BABYLON.ParticleSystem("foundation-dust", 700, this.scene);
    dust.particleTexture = dustTexture;
    dust.emitter = new BABYLON.Vector3(0, 35, -235);
    dust.minEmitBox = new BABYLON.Vector3(-520, -25, -430);
    dust.maxEmitBox = new BABYLON.Vector3(520, 65, 520);
    dust.color1 = new BABYLON.Color4(0.45, 0.85, 0.9, 0.14);
    dust.color2 = new BABYLON.Color4(0.7, 0.9, 0.75, 0.08);
    dust.minSize = 0.08;
    dust.maxSize = 0.34;
    dust.minLifeTime = 7;
    dust.maxLifeTime = 16;
    dust.emitRate = 48;
    dust.gravity = new BABYLON.Vector3(0, 0.02, 0);
    dust.direction1 = new BABYLON.Vector3(-0.6, 0.04, -0.18);
    dust.direction2 = new BABYLON.Vector3(1, 0.16, 0.55);
    dust.minAngularSpeed = 0;
    dust.maxAngularSpeed = 0.5;
    dust.start();
  }

  private createLantern(name: string, x: number, z: number, metal: any, lightMaterial: any, intensity: number): void {
    const root = new BABYLON.TransformNode(name, this.scene);
    root.position = new BABYLON.Vector3(x, this.heightAt(x, z), z);
    const pole = BABYLON.MeshBuilder.CreateCylinder(`${name}-pole`, { height: 3.2, diameterTop: 0.07, diameterBottom: 0.17, tessellation: 8 }, this.scene);
    pole.material = metal;
    pole.position.y = 1.6;
    pole.parent = root;
    const arm = BABYLON.MeshBuilder.CreateCylinder(`${name}-arm`, { height: 0.75, diameter: 0.07, tessellation: 8 }, this.scene);
    arm.material = metal;
    arm.rotation.z = Math.PI / 2;
    arm.position = new BABYLON.Vector3(0.28, 2.85, 0);
    arm.parent = root;
    const cage = BABYLON.MeshBuilder.CreatePolyhedron(`${name}-cage`, { type: 1, size: 0.38 }, this.scene);
    cage.material = metal;
    cage.position = new BABYLON.Vector3(0.6, 2.7, 0);
    cage.parent = root;
    const flame = BABYLON.MeshBuilder.CreateSphere(`${name}-flame`, { diameter: 0.24, segments: 8 }, this.scene);
    flame.material = lightMaterial;
    flame.scaling.y = 1.5;
    flame.position = new BABYLON.Vector3(0.6, 2.7, 0);
    flame.parent = root;
    const point = new BABYLON.PointLight(`${name}-light`, new BABYLON.Vector3(0.6, 2.7, 0), this.scene);
    point.diffuse = BABYLON.Color3.FromHexString("#ffbd72");
    point.intensity = intensity;
    point.range = 17;
    point.parent = root;
  }
}
