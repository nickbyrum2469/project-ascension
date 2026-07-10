interface PerformanceWorld {
  scene: any;
  shadowGenerator: any;
  glowLayer: any;
}

interface MergeResult {
  mesh: any | null;
  sourceCount: number;
}

const squaredDistance = (a: any, b: any): number => {
  const x = a.x - b.x;
  const z = a.z - b.z;
  return x * x + z * z;
};

const material = (
  scene: any,
  name: string,
  base: string,
  roughness: number,
  metallic: number
): any => {
  const value = new BABYLON.PBRMaterial(name, scene);
  value.albedoColor = BABYLON.Color3.FromHexString(base);
  value.roughness = roughness;
  value.metallic = metallic;
  value.freeze();
  return value;
};

export class PerformanceDirector {
  private readonly scene: any;
  private readonly playerRoot: any;
  private readonly maximumScale: number;
  private currentScale: number;
  private sampleTime = 0;
  private sampleFrames = 0;
  private cullTime = 0;
  private stableFastSamples = 0;
  private stableSlowSamples = 0;

  constructor(
    private readonly engine: any,
    private readonly world: PerformanceWorld,
    private readonly rendererName: string
  ) {
    this.scene = world.scene;
    this.playerRoot = this.scene.getTransformNodeByName?.("warden-root") ?? null;
    this.maximumScale = this.deviceIsConstrained() ? 2 : 1.8;
    this.currentScale = this.initialHardwareScale();

    this.configureScene();
    const mergedCasters = this.consolidateStaticGeometry();
    this.configureShadows(mergedCasters);
    this.freezeStaticGeometry();
    this.applyHardwareScale(this.currentScale);

    this.scene.onBeforeRenderObservable.add(() => this.update());
    window.addEventListener("resize", () => this.engine.resize());

    console.info(
      `[Performance] ${rendererName} recovery profile active at ${this.currentScale.toFixed(2)}x hardware scaling.`
    );
  }

  private configureScene(): void {
    this.scene.skipPointerMovePicking = true;
    this.scene.constantlyUpdateMeshUnderPointer = false;
    if (BABYLON.ScenePerformancePriority?.Intermediate !== undefined) {
      this.scene.performancePriority = BABYLON.ScenePerformancePriority.Intermediate;
    }

    if (this.world.glowLayer) {
      this.world.glowLayer.blurKernelSize = 16;
      this.world.glowLayer.intensity = 0.36;
    }

    const manager = this.scene.postProcessRenderPipelineManager as any;
    const pipeline = manager?.getPipelineByName?.("foundation-pipeline")
      ?? manager?._renderPipelines?.["foundation-pipeline"];
    if (pipeline) {
      pipeline.samples = 1;
      pipeline.bloomKernel = 22;
      pipeline.bloomScale = 0.5;
      pipeline.bloomWeight = Math.min(0.075, pipeline.bloomWeight ?? 0.075);
    }
  }

  private consolidateStaticGeometry(): any[] {
    const treeBark = material(this.scene, "batched-tree-bark", "#594b3c", 0.96, 0.01);
    const treeLeafA = material(this.scene, "batched-tree-leaf-a", "#6d8c63", 0.94, 0.01);
    const treeLeafB = material(this.scene, "batched-tree-leaf-b", "#88a36f", 0.94, 0.01);
    const rockA = material(this.scene, "batched-rock-a", "#647064", 0.96, 0.01);
    const rockB = material(this.scene, "batched-rock-b", "#56645c", 0.96, 0.01);

    const treeTrunks: any[] = [];
    const treeCrownsA: any[] = [];
    const treeCrownsB: any[] = [];
    const rocksA: any[] = [];
    const rocksB: any[] = [];
    const grass: any[] = [];
    const cityGroups = new Map<string, any[]>();
    const obsoleteMaterials = new Set<any>();

    for (const mesh of [...this.scene.meshes]) {
      if (!mesh || mesh.isDisposed?.()) continue;
      const name = String(mesh.name ?? "");

      if (/^tree-trunk-\d+$/.test(name)) {
        if (mesh.material) obsoleteMaterials.add(mesh.material);
        mesh.material = treeBark;
        treeTrunks.push(mesh);
        continue;
      }

      const crown = /^tree-crown-\d+-(\d+)$/.exec(name);
      if (crown) {
        if (mesh.material) obsoleteMaterials.add(mesh.material);
        const even = Number(crown[1]) % 2 === 0;
        mesh.material = even ? treeLeafA : treeLeafB;
        (even ? treeCrownsA : treeCrownsB).push(mesh);
        continue;
      }

      const rock = /^windscar-rock-(\d+)$/.exec(name);
      if (rock) {
        if (mesh.material) obsoleteMaterials.add(mesh.material);
        const primary = Number(rock[1]) % 3 === 0;
        mesh.material = primary ? rockA : rockB;
        (primary ? rocksA : rocksB).push(mesh);
        continue;
      }

      if (/^red-grass-\d+-\d+$/.test(name)) {
        grass.push(mesh);
        continue;
      }

      if (
        /^caelus-building-\d+$/.test(name)
        || /^caelus-building-band-\d+$/.test(name)
        || /^caelus-building-roof-\d+$/.test(name)
      ) {
        const key = String(mesh.material?.name ?? "city-default");
        const group = cityGroups.get(key) ?? [];
        group.push(mesh);
        cityGroups.set(key, group);
      }
    }

    const mergedCasters: any[] = [];
    this.mergeMeshes("batched-tree-trunks", treeTrunks, false);
    this.mergeMeshes("batched-tree-crowns-a", treeCrownsA, false);
    this.mergeMeshes("batched-tree-crowns-b", treeCrownsB, false);
    this.mergeMeshes("batched-rocks-a", rocksA, true);
    this.mergeMeshes("batched-rocks-b", rocksB, true);
    this.mergeMeshes("batched-red-grass", grass, false);

    for (const [key, meshes] of cityGroups) {
      const result = this.mergeMeshes(`batched-city-${key}`, meshes, true);
      if (result.mesh) mergedCasters.push(result.mesh);
    }

    for (const node of [...this.scene.transformNodes]) {
      const name = String(node.name ?? "");
      if ((/^windscar-tree-\d+$/.test(name) || /^red-grass-patch-\d+$/.test(name)) && node.getChildren().length === 0) {
        node.dispose();
      }
    }

    for (const oldMaterial of obsoleteMaterials) {
      if (!oldMaterial || oldMaterial.isDisposed?.()) continue;
      const stillUsed = this.scene.meshes.some((mesh: any) => mesh.material === oldMaterial);
      if (!stillUsed) oldMaterial.dispose(false, false);
    }

    console.info(
      `[Performance] Batched ${treeTrunks.length + treeCrownsA.length + treeCrownsB.length} tree meshes, ${rocksA.length + rocksB.length} rocks, ${grass.length} grass blades, and ${[...cityGroups.values()].reduce((sum, group) => sum + group.length, 0)} city pieces.`
    );
    return mergedCasters;
  }

  private mergeMeshes(name: string, meshes: any[], receiveShadows: boolean): MergeResult {
    const valid = meshes.filter((mesh) => mesh && !mesh.isDisposed?.());
    if (valid.length === 0) return { mesh: null, sourceCount: 0 };
    if (valid.length === 1) {
      const only = valid[0];
      only.name = name;
      only.isPickable = false;
      only.receiveShadows = receiveShadows;
      only.computeWorldMatrix(true);
      only.freezeWorldMatrix();
      return { mesh: only, sourceCount: 1 };
    }

    valid.forEach((mesh) => {
      mesh.isPickable = false;
      mesh.computeWorldMatrix(true);
    });

    const merged = BABYLON.Mesh.MergeMeshes(valid, true, true, undefined, false, false);
    if (!merged) {
      valid.forEach((mesh) => mesh.freezeWorldMatrix());
      return { mesh: null, sourceCount: valid.length };
    }

    merged.name = name;
    merged.isPickable = false;
    merged.receiveShadows = receiveShadows;
    merged.alwaysSelectAsActive = false;
    merged.computeWorldMatrix(true);
    merged.freezeWorldMatrix();
    return { mesh: merged, sourceCount: valid.length };
  }

  private configureShadows(mergedCasters: any[]): void {
    const generator = this.world.shadowGenerator;
    if (!generator) return;

    generator.useBlurExponentialShadowMap = false;
    generator.usePoissonSampling = true;
    generator.blurKernel = 4;
    generator.darkness = 0.27;

    const shadowMap = generator.getShadowMap?.();
    if (!shadowMap) return;
    shadowMap.refreshRate = BABYLON.RenderTargetTexture?.REFRESHRATE_RENDER_ONEVERYTWOFRAMES ?? 2;

    const excluded = [
      "foundation-boundary",
      "labyrinth-cliff",
      "labyrinth-arch",
      "labyrinth-tunnel-rib",
      "foundation-rib",
      "city-lantern",
      "caelus-building-band",
      "caelus-citizen",
      "foundation-beacon",
      "expedition-cache",
      "eastern-pillar-lift-column"
    ];

    const original = Array.isArray(shadowMap.renderList) ? shadowMap.renderList : [];
    const renderList = original.filter((mesh: any) => {
      if (!mesh || mesh.isDisposed?.()) return false;
      const name = String(mesh.name ?? "");
      return !excluded.some((prefix) => name.startsWith(prefix));
    });

    for (const mesh of mergedCasters) {
      if (mesh && !mesh.isDisposed?.() && !renderList.includes(mesh)) renderList.push(mesh);
    }
    shadowMap.renderList = renderList;
    console.info(`[Performance] Shadow caster list reduced to ${renderList.length} meshes and refreshed every second frame.`);
  }

  private freezeStaticGeometry(): void {
    const staticPrefixes = [
      "foundation-boundary",
      "foundation-sky",
      "upper-floor-vault",
      "windscar-terrain",
      "frontier-road",
      "western-expedition-road",
      "northern-expedition-road",
      "caelus-south-wall",
      "caelus-north-wall",
      "caelus-east-wall",
      "caelus-west-wall",
      "caelus-wall-tower",
      "caelus-expedition-keep",
      "gate-",
      "aqueduct-",
      "foundation-pillar",
      "foundation-rib",
      "labyrinth-cliff",
      "labyrinth-mouth",
      "labyrinth-arch",
      "labyrinth-tunnel-rib",
      "batched-"
    ];

    for (const mesh of this.scene.meshes) {
      if (!mesh || mesh.isDisposed?.()) continue;
      const name = String(mesh.name ?? "");
      if (!staticPrefixes.some((prefix) => name.startsWith(prefix))) continue;
      mesh.isPickable = Boolean(mesh.metadata?.cameraCollision);
      mesh.computeWorldMatrix(true);
      mesh.freezeWorldMatrix();
    }
  }

  private update(): void {
    const deltaMs = Math.min(100, Math.max(1, Number(this.engine.getDeltaTime?.() ?? 16.7)));
    this.sampleTime += deltaMs;
    this.sampleFrames += 1;
    this.cullTime += deltaMs;

    if (this.cullTime >= 300) {
      this.cullTime = 0;
      this.updateDistanceCulling();
    }

    if (this.sampleTime < 1500) return;
    const fps = (this.sampleFrames * 1000) / this.sampleTime;
    this.sampleTime = 0;
    this.sampleFrames = 0;

    if (fps < 46) {
      this.stableSlowSamples += 1;
      this.stableFastSamples = 0;
      if (this.stableSlowSamples >= 1) {
        this.applyHardwareScale(Math.min(this.maximumScale, this.currentScale + (fps < 36 ? 0.18 : 0.1)));
        this.stableSlowSamples = 0;
      }
    } else if (fps > 58) {
      this.stableFastSamples += 1;
      this.stableSlowSamples = 0;
      if (this.stableFastSamples >= 4) {
        const floor = this.initialHardwareScale();
        this.applyHardwareScale(Math.max(floor, this.currentScale - 0.08));
        this.stableFastSamples = 0;
      }
    } else {
      this.stableFastSamples = 0;
      this.stableSlowSamples = 0;
    }
  }

  private updateDistanceCulling(): void {
    const player = this.playerRoot ?? this.scene.getTransformNodeByName?.("warden-root");
    if (!player) return;
    const position = player.position;

    for (const node of this.scene.transformNodes) {
      if (!node || node === player || node.isDisposed?.()) continue;
      const name = String(node.name ?? "");
      let maximumDistance = 0;
      if (name.startsWith("caelus-citizen-")) maximumDistance = 180;
      else if (/^rift-boar-\d+$/.test(name) || /^rift-wisp-\d+$/.test(name)) maximumDistance = 330;
      if (maximumDistance === 0) continue;

      const visible = squaredDistance(node.position, position) <= maximumDistance * maximumDistance;
      if (node.isEnabled() !== visible) node.setEnabled(visible);
    }
  }

  private initialHardwareScale(): number {
    const memory = Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8);
    const touchDevice = navigator.maxTouchPoints > 0;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    if (memory <= 4 || (touchDevice && Math.min(innerWidth, innerHeight) < 900)) return 1.55;
    if (dpr >= 2) return 1.35;
    if (this.rendererName.toLowerCase().includes("webgl")) return 1.12;
    return 1;
  }

  private deviceIsConstrained(): boolean {
    const memory = Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8);
    return memory <= 4 || navigator.maxTouchPoints > 0;
  }

  private applyHardwareScale(scale: number): void {
    const rounded = Math.round(scale * 100) / 100;
    if (Math.abs(rounded - this.currentScale) < 0.025 && this.engine.getHardwareScalingLevel?.() === rounded) return;
    this.currentScale = rounded;
    this.engine.setHardwareScalingLevel?.(rounded);
    this.engine.resize();
  }
}
