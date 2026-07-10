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
      BABYLON.Vector3.Zero()
    );
  }

  private wrapWeapon(weapon: any, name: string, correctionRotation: any): void {
    if (!weapon?.parent || weapon.metadata?.directionCorrected) return;
    const correction = new BABYLON.TransformNode(name, this.scene);
    correction.parent = weapon.parent;
    correction.position.copyFrom(weapon.position);
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

      collisionBoxes?.push({
        minX: x - 3.7,
        maxX: x + 3.7,
        minZ: 16.3,
        maxZ: 23.7
      });
    });
  }

  private buildSpawnTrail(): void {
    const roadStone = createMaterial(this.scene, "spawn-trail-stone", "#756449", 0.94, 0.01);
    roadStone.emissiveColor = BABYLON.Color3.FromHexString("#19150f");
    roadStone.emissiveIntensity = 0.025;
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

        if (index % 4 === 0) {
          const shrub = BABYLON.MeshBuilder.CreatePolyhedron(`spawn-shrub-${index}-${side}`, {
            type: index % 2,
            size: 0.62
          }, this.scene);
          shrub.position = new BABYLON.Vector3(sideX + side * 0.7, rootY + 0.35, z - 0.8);
          shrub.scaling = new BABYLON.Vector3(1.45, 0.62, 1.1);
          shrub.rotation.y = index * 0.73;
          shrub.material = verge;
          vergeMeshes.push(shrub);
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
