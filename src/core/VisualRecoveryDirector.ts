import { createMaterial } from "../world/ProceduralAssets.js";

interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export class VisualRecoveryDirector {
  private readonly scene: any;
  private readonly world: any;
  private readonly player: any;

  constructor(game: any) {
    this.scene = game.world.scene;
    this.world = game.world;
    this.player = game.player;

    this.recoverLightingAndTerrain();
    this.removeDisconnectedRibs();
    this.correctWeaponMounts();
    this.closeCaelusGateSeams();
    this.enrichCaelusReach();
    this.buildSpawnTrail();
  }

  private recoverLightingAndTerrain(): void {
    this.scene.clearColor = new BABYLON.Color4(0.26, 0.46, 0.5, 1);
    this.scene.fogColor = BABYLON.Color3.FromHexString("#789fa0");
    this.scene.fogDensity = 0.00048;
    this.scene.environmentIntensity = 1.02;

    const hemisphere = this.scene.getLightByName?.("foundation-fill");
    if (hemisphere) {
      hemisphere.intensity = 1.34;
      hemisphere.diffuse = BABYLON.Color3.FromHexString("#e8f4df");
      hemisphere.groundColor = BABYLON.Color3.FromHexString("#536450");
    }

    const sun = this.scene.getLightByName?.("artificial-sun");
    if (sun) {
      sun.intensity = 2.15;
      sun.diffuse = BABYLON.Color3.FromHexString("#ffe8c4");
    }

    const terrain = this.scene.getMaterialByName?.("windscar-ground");
    if (terrain) {
      terrain.unfreeze?.();
      terrain.albedoColor = BABYLON.Color3.FromHexString("#71815c");
      terrain.ambientColor = BABYLON.Color3.FromHexString("#5d7053");
      terrain.emissiveColor = BABYLON.Color3.FromHexString("#172218");
      terrain.emissiveIntensity = 0.18;
      terrain.roughness = 0.9;
      terrain.metallic = 0;
      terrain.bumpTexture = null;
      if (terrain.albedoTexture) terrain.albedoTexture.level = 0.72;
    }

    this.tuneMaterial("frontier-road", "#927b56", "#241f17", 0.045);
    this.tuneMaterial("frontier-road-verge", "#68755a", "#1b261b", 0.06);
    this.tuneMaterial("caelus-wall-stone", "#6f8584", "#182627", 0.08);
    this.tuneMaterial("caelus-wall-shadow", "#40595c", "#10191a", 0.07);
    this.tuneMaterial("caelus-plaster-a", "#aaa88a", "#262419", 0.05);
    this.tuneMaterial("caelus-plaster-b", "#879b8f", "#1b2922", 0.05);

    const manager = this.scene.postProcessRenderPipelineManager as any;
    const pipeline = manager?.getPipelineByName?.("foundation-pipeline")
      ?? manager?._renderPipelines?.["foundation-pipeline"];
    if (pipeline?.imageProcessing) {
      pipeline.imageProcessing.exposure = 1.04;
      pipeline.imageProcessing.contrast = 1.04;
    }
  }

  private tuneMaterial(name: string, albedo: string, emissive: string, intensity: number): void {
    const material = this.scene.getMaterialByName?.(name);
    if (!material) return;
    material.unfreeze?.();
    material.albedoColor = BABYLON.Color3.FromHexString(albedo);
    material.emissiveColor = BABYLON.Color3.FromHexString(emissive);
    material.emissiveIntensity = intensity;
  }

  private removeDisconnectedRibs(): void {
    for (const mesh of this.scene.meshes) {
      const name = String(mesh.name ?? "");
      if (name.startsWith("foundation-rib-") || name.startsWith("foundation-rib-collar-")) {
        mesh.setEnabled(false);
      }
    }
  }

  private correctWeaponMounts(): void {
    this.wrapWeapon(
      this.player.visual?.sword,
      "third-person-sword-direction-fix",
      new BABYLON.Vector3(Math.PI / 2, 0, -0.18)
    );
    this.wrapWeapon(
      this.player.fpSword,
      "first-person-sword-direction-fix",
      new BABYLON.Vector3(0, 0.6, 0.25),
      new BABYLON.Vector3(-0.25, -0.84, 0.04)
    );
  }

  private wrapWeapon(
    weapon: any,
    name: string,
    correctionRotation: any,
    correctionPosition?: any
  ): void {
    if (!weapon?.parent || weapon.metadata?.directionCorrected) return;
    const correction = new BABYLON.TransformNode(name, this.scene);
    correction.parent = weapon.parent;
    correction.position.copyFrom(correctionPosition ?? weapon.position);
    correction.rotation.copyFrom(correctionRotation);
    weapon.parent = correction;
    weapon.position = BABYLON.Vector3.Zero();
    weapon.metadata = { ...(weapon.metadata ?? {}), directionCorrected: true };
  }

  private closeCaelusGateSeams(): void {
    const stone = this.scene.getMaterialByName?.("caelus-wall-stone")
      ?? createMaterial(this.scene, "caelus-recovery-stone", "#6f8584", 0.82, 0.1);
    const dark = this.scene.getMaterialByName?.("caelus-wall-shadow")
      ?? createMaterial(this.scene, "caelus-recovery-dark", "#40595c", 0.76, 0.2);
    const glow = this.scene.getMaterialByName?.("caelus-civic-glow")
      ?? createMaterial(this.scene, "caelus-recovery-glow", "#9ff8f2", 0.14, 0.16, "#43dcd7");
    const bannerMaterial = createMaterial(this.scene, "caelus-gate-banner", "#365466", 0.88, 0.02);

    const collisionBoxes = this.world.collisionBoxes as CollisionBox[];
    const wallDefinitions = [
      { name: "caelus-south-wall-infill-left", x: -27, width: 22 },
      { name: "caelus-south-wall-infill-right", x: 27, width: 22 }
    ];

    for (const definition of wallDefinitions) {
      const y = this.world.heightAt(definition.x, 22);
      const wall = BABYLON.MeshBuilder.CreateBox(definition.name, {
        width: definition.width,
        height: 11,
        depth: 6
      }, this.scene);
      wall.position = new BABYLON.Vector3(definition.x, y + 5.5, 22);
      wall.material = stone;
      wall.receiveShadows = true;
      wall.metadata = { cameraCollision: true };
      wall.isPickable = true;

      const cap = BABYLON.MeshBuilder.CreateBox(`${definition.name}-cap`, {
        width: definition.width + 1.2,
        height: 0.8,
        depth: 7.2
      }, this.scene);
      cap.position = new BABYLON.Vector3(definition.x, y + 11.35, 22);
      cap.material = dark;

      collisionBoxes?.push({
        minX: definition.x - definition.width / 2,
        maxX: definition.x + definition.width / 2,
        minZ: 19,
        maxZ: 25
      });
    }

    const battlements: any[] = [];
    const banners: any[] = [];
    const bannerRunes: any[] = [];
    const merlonX = [-35, -31, -27, -23, -19, 19, 23, 27, 31, 35];
    merlonX.forEach((x, index) => {
      const y = this.world.heightAt(x, 22);
      const merlon = BABYLON.MeshBuilder.CreateBox(`caelus-gate-merlon-${index}`, {
        width: 2.7,
        height: 2.2,
        depth: 4.8
      }, this.scene);
      merlon.position = new BABYLON.Vector3(x, y + 12.7, 22);
      merlon.material = dark;
      battlements.push(merlon);
    });

    [-1, 1].forEach((side) => {
      const x = side * 15.8;
      const y = this.world.heightAt(x, 20);
      const buttress = BABYLON.MeshBuilder.CreateCylinder(`caelus-gatehouse-buttress-${side}`, {
        height: 16,
        diameterTop: 5.2,
        diameterBottom: 7.5,
        tessellation: 8
      }, this.scene);
      buttress.position = new BABYLON.Vector3(x, y + 8, 20);
      buttress.material = stone;
      buttress.receiveShadows = true;
      buttress.metadata = { cameraCollision: true };
      buttress.isPickable = true;

      const beacon = BABYLON.MeshBuilder.CreatePolyhedron(`caelus-gatehouse-beacon-${side}`, {
        type: 1,
        size: 0.65
      }, this.scene);
      beacon.position = new BABYLON.Vector3(x, y + 17.2, 20);
      beacon.material = glow;

      const banner = BABYLON.MeshBuilder.CreateBox(`caelus-gate-banner-${side}`, {
        width: 2.7,
        height: 5.2,
        depth: 0.12
      }, this.scene);
      banner.position = new BABYLON.Vector3(x, y + 9.1, 16.18);
      banner.material = bannerMaterial;
      banners.push(banner);

      const rune = BABYLON.MeshBuilder.CreateTorus(`caelus-gate-banner-rune-${side}`, {
        diameter: 1.15,
        thickness: 0.12,
        tessellation: 20
      }, this.scene);
      rune.position = new BABYLON.Vector3(x, y + 9.65, 16.08);
      rune.rotation.x = Math.PI / 2;
      rune.material = glow;
      bannerRunes.push(rune);

      collisionBoxes?.push({
        minX: x - 3.7,
        maxX: x + 3.7,
        minZ: 16.3,
        maxZ: 23.7
      });
    });

    this.mergeStatic("caelus-gate-battlements-batch", battlements, false);
    this.mergeStatic("caelus-gate-banners-batch", banners, false);
    this.mergeStatic("caelus-gate-banner-runes-batch", bannerRunes, false);
  }

  private enrichCaelusReach(): void {
    const streetMaterial = createMaterial(this.scene, "caelus-boulevard-stone", "#566461", 0.94, 0.01);
    streetMaterial.emissiveColor = BABYLON.Color3.FromHexString("#121918");
    streetMaterial.emissiveIntensity = 0.035;
    const curbMaterial = createMaterial(this.scene, "caelus-boulevard-curb", "#87918a", 0.9, 0.02);
    const windowMaterial = createMaterial(
      this.scene,
      "caelus-window-light",
      "#f5d69b",
      0.22,
      0.02,
      "#ffbd63"
    );
    windowMaterial.emissiveIntensity = 1.35;
    const doorMaterial = createMaterial(this.scene, "caelus-door-timber", "#493a31", 0.92, 0.02);
    const marketWood = createMaterial(this.scene, "caelus-market-wood", "#5b4637", 0.94, 0.02);
    const marketBlue = createMaterial(this.scene, "caelus-market-blue", "#46697a", 0.92, 0.01);
    const marketWine = createMaterial(this.scene, "caelus-market-wine", "#735568", 0.92, 0.01);
    const monumentStone = createMaterial(this.scene, "caelus-monument-stone", "#71817d", 0.82, 0.08);
    const monumentDark = createMaterial(this.scene, "caelus-monument-dark", "#31474a", 0.58, 0.36);
    const glow = this.scene.getMaterialByName?.("caelus-civic-glow")
      ?? createMaterial(this.scene, "caelus-monument-glow", "#8ef7f1", 0.14, 0.14, "#43dcd7");

    const streetMeshes: any[] = [];
    const curbMeshes: any[] = [];
    for (let index = 0; index < 28; index += 1) {
      const z = 30 + index * 5.8;
      if (Math.abs(z - 112) < 28) continue;
      const y = this.world.heightAt(0, z);
      const slab = BABYLON.MeshBuilder.CreateBox(`caelus-boulevard-slab-${index}`, {
        width: 12.5,
        height: 0.14,
        depth: 5.15
      }, this.scene);
      slab.position = new BABYLON.Vector3(0, y + 0.07, z);
      slab.material = streetMaterial;
      slab.receiveShadows = true;
      streetMeshes.push(slab);

      [-1, 1].forEach((side) => {
        const curb = BABYLON.MeshBuilder.CreateBox(`caelus-boulevard-curb-${index}-${side}`, {
          width: 0.48,
          height: 0.28,
          depth: 5.25
        }, this.scene);
        curb.position = new BABYLON.Vector3(side * 6.45, y + 0.14, z);
        curb.material = curbMaterial;
        curbMeshes.push(curb);
      });
    }

    const windows: any[] = [];
    const doors: any[] = [];
    const awningsBlue: any[] = [];
    const awningsWine: any[] = [];
    const buildings = this.scene.meshes.filter((mesh: any) => /^caelus-building-\d+$/.test(String(mesh.name ?? "")));
    buildings.forEach((building: any, index: number) => {
      building.computeWorldMatrix(true);
      const bounds = building.getBoundingInfo().boundingBox;
      const extent = bounds.extendSizeWorld;
      const baseY = building.position.y - extent.y;
      const towardStreet = building.position.x < 0 ? 1 : -1;
      const faceX = building.position.x + towardStreet * (extent.x + 0.08);

      [-0.3, 0.3].forEach((zFactor, windowIndex) => {
        const window = BABYLON.MeshBuilder.CreateBox(`caelus-window-${index}-${windowIndex}`, {
          width: 0.13,
          height: 1.25,
          depth: 1.45
        }, this.scene);
        window.position = new BABYLON.Vector3(
          faceX,
          baseY + Math.max(3.5, extent.y * 1.08),
          building.position.z + extent.z * zFactor
        );
        window.material = windowMaterial;
        windows.push(window);
      });

      const door = BABYLON.MeshBuilder.CreateBox(`caelus-door-${index}`, {
        width: 0.18,
        height: 2.55,
        depth: 1.55
      }, this.scene);
      door.position = new BABYLON.Vector3(faceX, baseY + 1.28, building.position.z);
      door.material = doorMaterial;
      doors.push(door);

      if (index % 3 === 0) {
        const awning = BABYLON.MeshBuilder.CreateBox(`caelus-awning-${index}`, {
          width: 1.65,
          height: 0.14,
          depth: 3.8
        }, this.scene);
        awning.position = new BABYLON.Vector3(
          faceX + towardStreet * 0.72,
          baseY + 3.25,
          building.position.z
        );
        awning.rotation.z = towardStreet * -0.09;
        awning.material = index % 2 === 0 ? marketBlue : marketWine;
        (index % 2 === 0 ? awningsBlue : awningsWine).push(awning);
      }
    });

    const plazaY = this.world.heightAt(0, 112);
    const monumentStoneMeshes: any[] = [];
    const monumentDarkMeshes: any[] = [];
    const monumentGlowMeshes: any[] = [];
    const monumentBase = BABYLON.MeshBuilder.CreateCylinder("caelus-plaza-monument-base", {
      height: 0.9,
      diameterTop: 7,
      diameterBottom: 8.6,
      tessellation: 12
    }, this.scene);
    monumentBase.position = new BABYLON.Vector3(0, plazaY + 0.55, 112);
    monumentBase.material = monumentDark;
    monumentDarkMeshes.push(monumentBase);

    const monument = BABYLON.MeshBuilder.CreateCylinder("caelus-plaza-monument", {
      height: 6.8,
      diameterTop: 0.75,
      diameterBottom: 2.15,
      tessellation: 8
    }, this.scene);
    monument.position = new BABYLON.Vector3(0, plazaY + 4.3, 112);
    monument.material = monumentStone;
    monumentStoneMeshes.push(monument);

    for (let index = 0; index < 2; index += 1) {
      const ring = BABYLON.MeshBuilder.CreateTorus(`caelus-plaza-monument-ring-${index}`, {
        diameter: 2.4 + index * 1.6,
        thickness: 0.16,
        tessellation: 24
      }, this.scene);
      ring.position = new BABYLON.Vector3(0, plazaY + 5.4 + index * 0.8, 112);
      ring.rotation.x = Math.PI / 2 + index * 0.42;
      ring.material = glow;
      monumentGlowMeshes.push(ring);
    }

    const marketWoodMeshes: any[] = [];
    const marketBlueMeshes: any[] = [];
    const marketWineMeshes: any[] = [];
    const stallPositions = [
      [-22, 91], [22, 91], [-22, 133], [22, 133]
    ];
    stallPositions.forEach(([x, z], index) => {
      const y = this.world.heightAt(x, z);
      const table = BABYLON.MeshBuilder.CreateBox(`caelus-market-table-${index}`, {
        width: 5.2,
        height: 0.9,
        depth: 2.5
      }, this.scene);
      table.position = new BABYLON.Vector3(x, y + 0.45, z);
      table.material = marketWood;
      marketWoodMeshes.push(table);

      [-1, 1].forEach((side) => {
        const post = BABYLON.MeshBuilder.CreateCylinder(`caelus-market-post-${index}-${side}`, {
          height: 3.2,
          diameter: 0.17,
          tessellation: 6
        }, this.scene);
        post.position = new BABYLON.Vector3(x + side * 2.15, y + 1.65, z);
        post.material = marketWood;
        marketWoodMeshes.push(post);
      });

      const canopy = BABYLON.MeshBuilder.CreateBox(`caelus-market-canopy-${index}`, {
        width: 5.8,
        height: 0.16,
        depth: 3.25
      }, this.scene);
      canopy.position = new BABYLON.Vector3(x, y + 3.18, z);
      canopy.rotation.z = index % 2 === 0 ? -0.07 : 0.07;
      canopy.material = index % 2 === 0 ? marketBlue : marketWine;
      (index % 2 === 0 ? marketBlueMeshes : marketWineMeshes).push(canopy);
    });

    const collisionBoxes = this.world.collisionBoxes as CollisionBox[];
    collisionBoxes?.push({ minX: -4.3, maxX: 4.3, minZ: 107.7, maxZ: 116.3 });

    this.mergeStatic("caelus-boulevard-stone-batch", streetMeshes, true);
    this.mergeStatic("caelus-boulevard-curb-batch", curbMeshes, false);
    this.mergeStatic("caelus-window-light-batch", windows, false);
    this.mergeStatic("caelus-door-batch", doors, false);
    this.mergeStatic("caelus-awning-blue-batch", awningsBlue, false);
    this.mergeStatic("caelus-awning-wine-batch", awningsWine, false);
    this.mergeStatic("caelus-monument-stone-batch", monumentStoneMeshes, true);
    this.mergeStatic("caelus-monument-dark-batch", monumentDarkMeshes, true);
    this.mergeStatic("caelus-monument-glow-batch", monumentGlowMeshes, false);
    this.mergeStatic("caelus-market-wood-batch", marketWoodMeshes, false);
    this.mergeStatic("caelus-market-blue-batch", marketBlueMeshes, false);
    this.mergeStatic("caelus-market-wine-batch", marketWineMeshes, false);
  }

  private buildSpawnTrail(): void {
    const roadStone = createMaterial(this.scene, "spawn-trail-stone", "#665740", 0.96, 0.01);
    roadStone.emissiveColor = BABYLON.Color3.FromHexString("#15120d");
    roadStone.emissiveIntensity = 0.012;
    const verge = createMaterial(this.scene, "spawn-trail-verge", "#789064", 0.94, 0.01);
    verge.emissiveColor = BABYLON.Color3.FromHexString("#172116");
    verge.emissiveIntensity = 0.045;
    const markerGlow = createMaterial(
      this.scene,
      "spawn-trail-marker-glow",
      "#a9eee4",
      0.16,
      0.08,
      "#3acbbb"
    );

    const pavers: any[] = [];
    const vergeMeshes: any[] = [];
    const markerMeshes: any[] = [];

    for (let index = 0; index < 20; index += 1) {
      const z = -6 - index * 4.45;
      const x = Math.sin(index * 0.42) * 0.58;
      const paver = BABYLON.MeshBuilder.CreateBox(`spawn-trail-paver-${index}`, {
        width: 3.25 + (index % 3) * 0.22,
        height: 0.11,
        depth: 1.65 + (index % 2) * 0.14
      }, this.scene);
      paver.position = new BABYLON.Vector3(x, this.world.heightAt(x, z) + 0.055, z);
      paver.rotation.y = Math.sin(index * 0.61) * 0.035;
      paver.material = roadStone;
      paver.receiveShadows = true;
      pavers.push(paver);

      [-1, 1].forEach((side) => {
        if (index % 2 !== 0) return;
        const sideX = x + side * (4.4 + (index % 3) * 0.35);
        const rootY = this.world.heightAt(sideX, z);
        for (let bladeIndex = 0; bladeIndex < 3; bladeIndex += 1) {
          const blade = BABYLON.MeshBuilder.CreateCylinder(`spawn-verge-${index}-${side}-${bladeIndex}`, {
            height: 0.62 + bladeIndex * 0.11,
            diameterTop: 0.018,
            diameterBottom: 0.085,
            tessellation: 3
          }, this.scene);
          blade.position = new BABYLON.Vector3(
            sideX + (bladeIndex - 1) * 0.18,
            rootY + 0.31,
            z + (bladeIndex - 1) * 0.14
          );
          blade.rotation.z = side * (bladeIndex - 1) * 0.08;
          blade.material = verge;
          vergeMeshes.push(blade);
        }
      });
    }

    [-1, 1].forEach((side) => {
      for (let index = 0; index < 4; index += 1) {
        const z = -12 - index * 20;
        const x = side * 5.9;
        const baseY = this.world.heightAt(x, z);
        const post = BABYLON.MeshBuilder.CreateCylinder(`spawn-waymarker-post-${side}-${index}`, {
          height: 1.55,
          diameterTop: 0.16,
          diameterBottom: 0.25,
          tessellation: 6
        }, this.scene);
        post.position = new BABYLON.Vector3(x, baseY + 0.77, z);
        post.material = roadStone;
        markerMeshes.push(post);

        const light = BABYLON.MeshBuilder.CreatePolyhedron(`spawn-waymarker-light-${side}-${index}`, {
          type: 1,
          size: 0.23
        }, this.scene);
        light.position = new BABYLON.Vector3(x, baseY + 1.66, z);
        light.material = markerGlow;
        markerMeshes.push(light);
      }
    });

    this.mergeStatic("spawn-trail-pavers-batch", pavers, true);
    this.mergeStatic("spawn-trail-verge-batch", vergeMeshes, false);
    this.mergeStatic("spawn-trail-markers-batch", markerMeshes, false);
  }

  private mergeStatic(name: string, meshes: any[], receiveShadows: boolean): void {
    if (meshes.length === 0) return;
    meshes.forEach((mesh) => mesh.computeWorldMatrix(true));
    const merged = BABYLON.Mesh.MergeMeshes(meshes, true, true, undefined, false, false);
    if (!merged) return;
    merged.name = name;
    merged.receiveShadows = receiveShadows;
    merged.isPickable = false;
    merged.computeWorldMatrix(true);
    merged.freezeWorldMatrix();
  }
}
