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

export class World {
  public readonly scene: any;
  public readonly camera: any;
  public readonly shadowGenerator: any;
  public readonly glowLayer: any;
  public readonly mara: HumanoidVisual;
  public readonly marker: any;
  public readonly markerPosition = new BABYLON.Vector3(29, 0, -69);
  public readonly spawnPoints = [
    new BABYLON.Vector3(-9, 0, -22),
    new BABYLON.Vector3(12, 0, -34),
    new BABYLON.Vector3(-22, 0, -48),
    new BABYLON.Vector3(20, 0, -55),
    new BABYLON.Vector3(4, 0, -70)
  ];

  private readonly random = seeded(8675309);

  constructor(public readonly engine: any) {
    this.scene = new BABYLON.Scene(engine);
    this.scene.clearColor = new BABYLON.Color4(0.025, 0.06, 0.09, 1);
    this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.0031;
    this.scene.fogColor = new BABYLON.Color3(0.14, 0.27, 0.31);
    this.scene.environmentIntensity = 0.72;

    this.camera = new BABYLON.FreeCamera("player-camera", new BABYLON.Vector3(0, 4, 8), this.scene);
    this.camera.minZ = 0.05;
    this.camera.maxZ = 900;
    this.camera.fov = BABYLON.Tools.ToRadians(75);
    this.scene.activeCamera = this.camera;

    const hemisphere = new BABYLON.HemisphericLight("foundation-fill", new BABYLON.Vector3(0.15, 1, 0.1), this.scene);
    hemisphere.intensity = 0.88;
    hemisphere.diffuse = BABYLON.Color3.FromHexString("#bfe9e7");
    hemisphere.groundColor = BABYLON.Color3.FromHexString("#1b2834");

    const sun = new BABYLON.DirectionalLight("artificial-sun", new BABYLON.Vector3(-0.52, -1, -0.26), this.scene);
    sun.position = new BABYLON.Vector3(55, 92, 40);
    sun.intensity = 3.1;
    sun.diffuse = BABYLON.Color3.FromHexString("#ffe1ad");
    this.shadowGenerator = new BABYLON.ShadowGenerator(2048, sun);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = 18;
    this.shadowGenerator.darkness = 0.34;

    this.glowLayer = new BABYLON.GlowLayer("rift-glow", this.scene, { blurKernelSize: 48 });
    this.glowLayer.intensity = 0.62;

    this.createSkyAndCeiling();
    this.createTerrain();
    this.createLandmarks();
    this.createFoliage();
    this.createAtmosphere();

    this.mara = createMara(this.scene);
    this.mara.root.position = new BABYLON.Vector3(-5.4, this.heightAt(-5.4, -8.2), -8.2);
    this.mara.root.rotation.y = 0.35;
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
    pipeline.bloomWeight = 0.16;
    pipeline.bloomKernel = 48;
    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.contrast = 1.16;
    pipeline.imageProcessing.exposure = 1.04;
  }

  public heightAt(x: number, z: number): number {
    const broad = Math.sin(x * 0.036) * 1.15 + Math.cos(z * 0.031) * 1.05;
    const detail = Math.sin((x + z) * 0.082) * 0.34 + Math.cos((x - z) * 0.067) * 0.27;
    const basin = -Math.exp(-((x * x + (z + 18) * (z + 18)) / 740)) * 0.7;
    const pathFlatten = Math.exp(-Math.pow(x / 8.5, 2)) * Math.exp(-Math.pow((z + 37) / 64, 2));
    return (broad + detail + basin) * (1 - pathFlatten * 0.72);
  }

  private createTerrain(): void {
    const ground = BABYLON.MeshBuilder.CreateGround("windscar-terrain", {
      width: 210,
      height: 210,
      subdivisions: 110,
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
    const texture = new BABYLON.DynamicTexture("windscar-ground-texture", { width: 512, height: 512 }, this.scene, false);
    const context = texture.getContext();
    const gradient = context.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, "#637c56");
    gradient.addColorStop(0.48, "#425f49");
    gradient.addColorStop(1, "#2c4b46");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 512, 512);
    for (let index = 0; index < 1900; index += 1) {
      const green = 70 + Math.floor(this.random() * 55);
      const alpha = 0.04 + this.random() * 0.13;
      context.fillStyle = `rgba(${40 + Math.floor(this.random() * 35)}, ${green}, ${45 + Math.floor(this.random() * 35)}, ${alpha})`;
      const size = 1 + this.random() * 3;
      context.fillRect(this.random() * 512, this.random() * 512, size, size * 2.6);
    }
    texture.update(false);
    texture.uScale = 18;
    texture.vScale = 18;
    terrainMaterial.albedoTexture = texture;
    terrainMaterial.bumpTexture = texture;
    terrainMaterial.bumpTexture.level = 0.12;
    ground.material = terrainMaterial;
  }

  private createSkyAndCeiling(): void {
    const sky = BABYLON.MeshBuilder.CreateSphere("foundation-sky", { diameter: 620, segments: 32 }, this.scene);
    const skyMaterial = new BABYLON.StandardMaterial("foundation-sky-mat", this.scene);
    skyMaterial.backFaceCulling = false;
    skyMaterial.disableLighting = true;
    skyMaterial.emissiveColor = BABYLON.Color3.FromHexString("#4b8792");
    skyMaterial.diffuseColor = BABYLON.Color3.Black();
    sky.material = skyMaterial;
    sky.isPickable = false;

    const ceiling = BABYLON.MeshBuilder.CreateSphere("upper-floor-vault", { diameter: 370, segments: 48 }, this.scene);
    ceiling.scaling = new BABYLON.Vector3(1, 0.26, 1);
    ceiling.position.y = 132;
    const ceilingMaterial = new BABYLON.StandardMaterial("upper-floor-vault-mat", this.scene);
    ceilingMaterial.backFaceCulling = false;
    ceilingMaterial.alpha = 0.24;
    ceilingMaterial.emissiveColor = BABYLON.Color3.FromHexString("#162d3b");
    ceilingMaterial.diffuseColor = BABYLON.Color3.FromHexString("#2e5260");
    ceiling.material = ceilingMaterial;
    ceiling.isPickable = false;

    [86, 116, 148].forEach((diameter, index) => {
      const ring = BABYLON.MeshBuilder.CreateTorus(`ceiling-structure-ring-${index}`, {
        diameter,
        thickness: 1.3 + index * 0.4,
        tessellation: 72
      }, this.scene);
      ring.position.y = 110 + index * 7;
      ring.rotation.x = Math.PI / 2;
      ring.material = createMaterial(this.scene, `ceiling-ring-mat-${index}`, "#253d49", 0.5, 0.45);
      ring.isPickable = false;
    });
  }

  private createLandmarks(): void {
    const gate = createGate(this.scene, new BABYLON.Vector3(0, this.heightAt(0, 12), 15));
    gate.rotation.y = Math.PI;
    gate.getChildMeshes().forEach((mesh: any) => {
      mesh.receiveShadows = true;
      this.shadowGenerator.addShadowCaster(mesh);
    });

    const aqueduct = createAqueduct(this.scene, new BABYLON.Vector3(30, this.heightAt(30, -72), -72));
    aqueduct.rotation.y = -0.18;
    aqueduct.getChildMeshes().forEach((mesh: any) => {
      mesh.receiveShadows = true;
      this.shadowGenerator.addShadowCaster(mesh);
    });

    const pillarLocations = [
      new BABYLON.Vector3(-102, -1, -98),
      new BABYLON.Vector3(108, -1, -86),
      new BABYLON.Vector3(-116, -1, 86),
      new BABYLON.Vector3(124, -1, 74)
    ];
    pillarLocations.forEach((location, index) => createMegastructurePillar(this.scene, location, 1.05, index));

    const lanternRoot = new BABYLON.TransformNode("expedition-lantern", this.scene);
    lanternRoot.position = new BABYLON.Vector3(-3.4, this.heightAt(-3.4, -6.8), -6.8);
    const metal = createMaterial(this.scene, "lantern-metal", "#2f454c", 0.33, 0.66);
    const lightMaterial = createMaterial(this.scene, "lantern-flame", "#ffd788", 0.1, 0, "#ff9f43");
    const pole = BABYLON.MeshBuilder.CreateCylinder("lantern-pole", { height: 3.1, diameterTop: 0.08, diameterBottom: 0.18, tessellation: 8 }, this.scene);
    pole.material = metal;
    pole.position.y = 1.55;
    pole.parent = lanternRoot;
    const cage = BABYLON.MeshBuilder.CreatePolyhedron("lantern-cage", { type: 1, size: 0.4 }, this.scene);
    cage.material = metal;
    cage.position.y = 2.8;
    cage.parent = lanternRoot;
    const flame = BABYLON.MeshBuilder.CreateSphere("lantern-flame", { diameter: 0.26, segments: 8 }, this.scene);
    flame.material = lightMaterial;
    flame.scaling.y = 1.5;
    flame.position.y = 2.8;
    flame.parent = lanternRoot;
    const point = new BABYLON.PointLight("lantern-light", new BABYLON.Vector3(0, 2.8, 0), this.scene);
    point.diffuse = BABYLON.Color3.FromHexString("#ffbd72");
    point.intensity = 1.8;
    point.range = 15;
    point.parent = lanternRoot;
  }

  private createFoliage(): void {
    let treeIndex = 0;
    for (let index = 0; index < 44; index += 1) {
      const x = this.random() * 170 - 85;
      const z = this.random() * 170 - 82;
      const nearPath = Math.abs(x) < 8 && z > -84 && z < 10;
      const nearSpawn = Math.hypot(x, z + 6) < 14;
      const nearAqueduct = Math.hypot(x - 30, z + 72) < 18;
      if (nearPath || nearSpawn || nearAqueduct) continue;
      createTree(this.scene, new BABYLON.Vector3(x, this.heightAt(x, z), z), 0.7 + this.random() * 0.75, treeIndex);
      treeIndex += 1;
    }

    for (let index = 0; index < 70; index += 1) {
      const x = this.random() * 185 - 92.5;
      const z = this.random() * 185 - 91;
      if (Math.hypot(x, z + 8) < 8) continue;
      createRock(this.scene, new BABYLON.Vector3(x, this.heightAt(x, z) - 0.12, z), 0.3 + this.random() * 0.85, index);
    }

    const bladeMaterial = createMaterial(this.scene, "red-grass-mat", "#874b4e", 0.96, 0);
    bladeMaterial.backFaceCulling = false;
    for (let patch = 0; patch < 32; patch += 1) {
      const x = 19 + this.random() * 31;
      const z = -52 - this.random() * 34;
      const root = new BABYLON.TransformNode(`red-grass-patch-${patch}`, this.scene);
      root.position = new BABYLON.Vector3(x, this.heightAt(x, z), z);
      for (let blade = 0; blade < 5; blade += 1) {
        const mesh = BABYLON.MeshBuilder.CreateCylinder(`red-grass-${patch}-${blade}`, {
          height: 0.7 + this.random() * 0.55,
          diameterTop: 0.01,
          diameterBottom: 0.07,
          tessellation: 3
        }, this.scene);
        mesh.material = bladeMaterial;
        mesh.position = new BABYLON.Vector3((this.random() - 0.5) * 0.9, mesh.getBoundingInfo().boundingBox.extendSize.y, (this.random() - 0.5) * 0.9);
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

    const dust = new BABYLON.ParticleSystem("foundation-dust", 420, this.scene);
    dust.particleTexture = dustTexture;
    dust.emitter = new BABYLON.Vector3(0, 18, -25);
    dust.minEmitBox = new BABYLON.Vector3(-75, -15, -70);
    dust.maxEmitBox = new BABYLON.Vector3(75, 20, 70);
    dust.color1 = new BABYLON.Color4(0.45, 0.85, 0.9, 0.16);
    dust.color2 = new BABYLON.Color4(0.7, 0.9, 0.75, 0.09);
    dust.minSize = 0.08;
    dust.maxSize = 0.32;
    dust.minLifeTime = 5;
    dust.maxLifeTime = 12;
    dust.emitRate = 38;
    dust.gravity = new BABYLON.Vector3(0, 0.025, 0);
    dust.direction1 = new BABYLON.Vector3(-0.4, 0.05, -0.1);
    dust.direction2 = new BABYLON.Vector3(0.8, 0.18, 0.45);
    dust.minAngularSpeed = 0;
    dust.maxAngularSpeed = 0.5;
    dust.start();
  }
}
