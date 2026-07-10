interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface LegacyCollisionSpec {
  x: number;
  z: number;
  width: number;
  depth: number;
}

const approximately = (left: number, right: number, tolerance = 0.08): boolean => (
  Math.abs(left - right) <= tolerance
);

export class CaelusPhaseZeroDirector {
  private readonly game: any;
  private readonly scene: any;

  constructor(game: any) {
    this.game = game;
    this.scene = game.world.scene;

    const weaponMountInstalled = this.installThirdPersonWeaponCorrection();
    const legacyMeshesDisabled = this.disableLegacyCaelusLayer();
    const unsupportedMeshesDisabled = this.disableUnsupportedGeometry();
    const legacyCollisionVolumesRemoved = this.removeLegacyCollisionVolumes();
    const opaqueArchitectureMaterials = this.hardenArchitectureMaterials();
    this.tuneCityReadability();

    this.scene.metadata = {
      ...(this.scene.metadata ?? {}),
      caelusPhaseZeroVersion: 1,
      weaponMountInstalled,
      weaponMountRotation: weaponMountInstalled ? [0.48, 0.02, -0.12] : null,
      legacyCaelusMeshesDisabled: legacyMeshesDisabled,
      unsupportedCityMeshesDisabled: unsupportedMeshesDisabled,
      legacyCaelusCollisionVolumesRemoved: legacyCollisionVolumesRemoved,
      opaqueArchitectureMaterials
    };
  }

  private installThirdPersonWeaponCorrection(): boolean {
    const visual = this.game.player?.visual;
    const sword = visual?.sword;
    const hand = visual?.rightHand;
    if (!sword || !hand) return false;

    const existing = this.scene.getTransformNodeByName?.("caelus-third-person-sword-mount");
    if (existing) return true;

    const mount = new BABYLON.TransformNode("caelus-third-person-sword-mount", this.scene);
    mount.parent = hand;
    mount.position = new BABYLON.Vector3(0.08, -0.02, 0.12);
    mount.rotation = new BABYLON.Vector3(0.48, 0.02, -0.12);

    sword.parent = mount;
    sword.position = new BABYLON.Vector3(0, -0.02, 0.01);
    return true;
  }

  private disableLegacyCaelusLayer(): string[] {
    const disabled: string[] = [];
    const legacyPrefixes = [
      "caelus-south-wall-left",
      "caelus-south-wall-right",
      "caelus-north-wall",
      "caelus-west-wall",
      "caelus-east-wall",
      "caelus-wall-tower-",
      "caelus-central-plaza",
      "caelus-expedition-keep"
    ];

    for (const mesh of this.scene.meshes) {
      const name = String(mesh.name ?? "");
      if (!legacyPrefixes.some((prefix) => name.startsWith(prefix))) continue;
      if (mesh.isEnabled?.()) disabled.push(name);
      mesh.setEnabled(false);
      mesh.isPickable = false;
      mesh.metadata = {
        ...(mesh.metadata ?? {}),
        disabledByCaelusPhaseZero: true
      };
    }

    const legacyGate = this.scene.getTransformNodeByName?.("caelus-gate-root");
    if (legacyGate?.isEnabled?.()) {
      disabled.push("caelus-gate-root");
      legacyGate.setEnabled(false);
    }

    return disabled;
  }

  private disableUnsupportedGeometry(): string[] {
    const disabled: string[] = [];
    const exactNames = new Set([
      "vertical-slice-wall-walks",
      "vertical-slice-wall-merlons",
      "vertical-slice-pillar-collars",
      "vertical-slice-pillar-ascent-rune"
    ]);

    for (const mesh of this.scene.meshes) {
      const name = String(mesh.name ?? "");
      const unsupported = exactNames.has(name) || name.startsWith("vertical-slice-monument-ring-");
      if (!unsupported) continue;
      if (mesh.isEnabled?.()) disabled.push(name);
      mesh.setEnabled(false);
      mesh.isPickable = false;
      mesh.metadata = {
        ...(mesh.metadata ?? {}),
        disabledByCaelusPhaseZero: true,
        reason: "unsupported-or-nontraversable"
      };
    }

    return disabled;
  }

  private removeLegacyCollisionVolumes(): number {
    const boxes = this.game.world.collisionBoxes as CollisionBox[];
    if (!Array.isArray(boxes)) return 0;

    const legacy: LegacyCollisionSpec[] = [
      { x: -84, z: 22, width: 92, depth: 6 },
      { x: 84, z: 22, width: 92, depth: 6 },
      { x: 0, z: 205, width: 260, depth: 6 },
      { x: -130, z: 113.5, width: 6, depth: 189 },
      { x: 130, z: 113.5, width: 6, depth: 189 }
    ];

    const isLegacyBox = (box: CollisionBox): boolean => {
      const x = (box.minX + box.maxX) / 2;
      const z = (box.minZ + box.maxZ) / 2;
      const width = box.maxX - box.minX;
      const depth = box.maxZ - box.minZ;
      return legacy.some((spec) => (
        approximately(x, spec.x)
        && approximately(z, spec.z)
        && approximately(width, spec.width)
        && approximately(depth, spec.depth)
      ));
    };

    let writeIndex = 0;
    let removed = 0;
    for (const box of boxes) {
      if (isLegacyBox(box)) {
        removed += 1;
        continue;
      }
      boxes[writeIndex] = box;
      writeIndex += 1;
    }
    boxes.length = writeIndex;
    return removed;
  }

  private hardenArchitectureMaterials(): number {
    const architecturePrefixes = [
      "vertical-slice-city-",
      "vertical-slice-plaster-",
      "vertical-slice-roof-",
      "vertical-slice-timber",
      "vertical-slice-plaza-",
      "vertical-slice-gate-",
      "vertical-slice-market-",
      "vertical-slice-banner"
    ];
    const palette: Record<string, string> = {
      "vertical-slice-city-street": "#303d3b",
      "vertical-slice-city-curb": "#56615d",
      "vertical-slice-plaza-stone": "#485550",
      "vertical-slice-plaster-a": "#667064",
      "vertical-slice-plaster-b": "#50675d",
      "vertical-slice-timber": "#3d3028",
      "vertical-slice-roof-blue": "#244b59",
      "vertical-slice-roof-green": "#35513c",
      "vertical-slice-banner": "#294f60",
      "vertical-slice-market-cloth": "#7a4e43"
    };

    let hardened = 0;
    for (const material of this.scene.materials) {
      const name = String(material.name ?? "");
      if (!architecturePrefixes.some((prefix) => name.startsWith(prefix))) continue;

      material.alpha = 1;
      material.transparencyMode = 0;
      material.forceDepthWrite = true;
      material.useAlphaFromAlbedoTexture = false;
      material.backFaceCulling = true;
      if ("environmentIntensity" in material) material.environmentIntensity = 0.58;
      if ("directIntensity" in material) material.directIntensity = 0.92;

      const paletteHex = palette[name];
      if (paletteHex && material.albedoColor) {
        material.albedoColor = BABYLON.Color3.FromHexString(paletteHex);
      }

      if (name === "vertical-slice-window-glow") {
        material.albedoColor = BABYLON.Color3.FromHexString("#a8c9a7");
        material.emissiveColor = BABYLON.Color3.FromHexString("#3e7252");
        material.emissiveIntensity = 0.62;
      }

      material.markDirty?.();
      material.freeze?.();
      hardened += 1;
    }
    return hardened;
  }

  private tuneCityReadability(): void {
    this.scene.environmentIntensity = Math.min(0.72, Number(this.scene.environmentIntensity ?? 0.72));
    this.scene.fogDensity = Math.min(0.00034, Number(this.scene.fogDensity ?? 0.00034));
    this.scene.fogColor = BABYLON.Color3.FromHexString("#668584");

    const fill = this.scene.getLightByName?.("foundation-fill");
    if (fill) {
      fill.intensity = 0.92;
      fill.diffuse = BABYLON.Color3.FromHexString("#c4ded2");
      fill.groundColor = BABYLON.Color3.FromHexString("#33463c");
    }

    const sun = this.scene.getLightByName?.("artificial-sun");
    if (sun) {
      sun.intensity = 1.55;
      sun.diffuse = BABYLON.Color3.FromHexString("#f1d7ad");
    }

    if (this.game.world.glowLayer) this.game.world.glowLayer.intensity = 0.24;

    const image = this.scene.imageProcessingConfiguration;
    if (image) {
      image.exposure = 0.88;
      image.contrast = 1.18;
    }
  }
}
