interface StaticGroup {
  name: string;
  meshes: any[];
  receiveShadows: boolean;
}

interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export class VisualPolishDirector {
  private readonly scene: any;
  private readonly world: any;

  constructor(game: any) {
    this.scene = game.world.scene;
    this.world = game.world;

    this.clearCentralGateCollision();
    this.replaceBrightRouteBatches();
    this.rebuildSpawnToFrontierPath();
    this.rebuildCaelusBoulevard();
    this.enrichFrontierApproach();
    this.stabilizeGateBanners();
  }

  private clearCentralGateCollision(): void {
    const boxes = this.world.collisionBoxes as CollisionBox[];
    if (!Array.isArray(boxes)) return;
    for (let index = boxes.length - 1; index >= 0; index -= 1) {
      const box = boxes[index];
      const intersectsCentralOpening = box.minX < 5
        && box.maxX > -5
        && box.minZ < 27
        && box.maxZ > 14;
      if (intersectsCentralOpening) boxes.splice(index, 1);
    }
  }

  private replaceBrightRouteBatches(): void {
    [
      "spawn-trail-pavers-batch",
      "caelus-boulevard-stone-batch",
      "caelus-boulevard-curb-batch"
    ].forEach((name) => {
      const mesh = this.scene.getMeshByName?.(name);
      if (mesh) mesh.setEnabled(false);
    });
  }

  private rebuildSpawnToFrontierPath(): void {
    const stoneA = this.unlitMaterial("frontier-path-stone-a", "#625640");
    const stoneB = this.unlitMaterial("frontier-path-stone-b", "#74664b");
    const stonesA: any[] = [];
    const stonesB: any[] = [];

    for (let index = 0; index < 40; index += 1) {
      const z = -6 - index * 4.35;
      const x = Math.sin(index * 0.47) * 0.52;
      const paver = BABYLON.MeshBuilder.CreateBox(`frontier-path-paver-${index}`, {
        width: 3.05 + (index % 4) * 0.16,
        height: 0.09,
        depth: 1.48 + (index % 2) * 0.15
      }, this.scene);
      paver.position = new BABYLON.Vector3(x, this.world.heightAt(x, z) + 0.045, z);
      paver.rotation.y = Math.sin(index * 0.73) * 0.045;
      paver.material = index % 2 === 0 ? stoneA : stoneB;
      paver.receiveShadows = true;
      (index % 2 === 0 ? stonesA : stonesB).push(paver);
    }

    this.mergeStatic({ name: "frontier-path-stone-a-batch", meshes: stonesA, receiveShadows: true });
    this.mergeStatic({ name: "frontier-path-stone-b-batch", meshes: stonesB, receiveShadows: true });
  }

  private rebuildCaelusBoulevard(): void {
    const cobbleA = this.unlitMaterial("caelus-cobble-a", "#465451");
    const cobbleB = this.unlitMaterial("caelus-cobble-b", "#53615c");
    const curb = this.unlitMaterial("caelus-cobble-curb", "#77817b");
    const cobblesA: any[] = [];
    const cobblesB: any[] = [];
    const curbs: any[] = [];

    for (let row = 0; row < 55; row += 1) {
      const z = 30 + row * 3.05;
      if (Math.abs(z - 112) < 29) continue;
      const y = this.world.heightAt(0, z);
      for (let column = -1; column <= 1; column += 1) {
        const x = column * 3.7 + (row % 2 === 0 ? -0.28 : 0.28);
        const stone = BABYLON.MeshBuilder.CreateBox(`caelus-cobble-${row}-${column}`, {
          width: 3.35,
          height: 0.1,
          depth: 2.35
        }, this.scene);
        stone.position = new BABYLON.Vector3(x, y + 0.05, z);
        stone.rotation.y = ((row + column) % 3 - 1) * 0.015;
        stone.material = (row + column) % 2 === 0 ? cobbleA : cobbleB;
        stone.receiveShadows = true;
        ((row + column) % 2 === 0 ? cobblesA : cobblesB).push(stone);
      }

      [-1, 1].forEach((side) => {
        const edge = BABYLON.MeshBuilder.CreateBox(`caelus-cobble-edge-${row}-${side}`, {
          width: 0.42,
          height: 0.24,
          depth: 2.75
        }, this.scene);
        edge.position = new BABYLON.Vector3(side * 6.2, y + 0.12, z);
        edge.material = curb;
        curbs.push(edge);
      });
    }

    this.mergeStatic({ name: "caelus-cobble-a-batch", meshes: cobblesA, receiveShadows: true });
    this.mergeStatic({ name: "caelus-cobble-b-batch", meshes: cobblesB, receiveShadows: true });
    this.mergeStatic({ name: "caelus-cobble-curb-batch", meshes: curbs, receiveShadows: false });
  }

  private enrichFrontierApproach(): void {
    const bushA = this.unlitMaterial("frontier-bush-a", "#506d53");
    const bushB = this.unlitMaterial("frontier-bush-b", "#657e5c");
    const rockMaterial = this.unlitMaterial("frontier-route-rock", "#68736c");
    const wood = this.unlitMaterial("frontier-fence-wood", "#544536");
    const bushesA: any[] = [];
    const bushesB: any[] = [];
    const rocks: any[] = [];
    const fenceMeshes: any[] = [];

    for (let index = 0; index < 32; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const z = -18 - index * 5.2;
      const x = side * (8.5 + (index % 5) * 2.6);
      const y = this.world.heightAt(x, z);
      const bush = BABYLON.MeshBuilder.CreateSphere(`frontier-route-bush-${index}`, {
        diameter: 1.45 + (index % 3) * 0.18,
        segments: 6
      }, this.scene);
      bush.position = new BABYLON.Vector3(x, y + 0.42, z);
      bush.scaling = new BABYLON.Vector3(1.45, 0.58, 1.05 + (index % 2) * 0.18);
      bush.rotation.y = index * 0.87;
      bush.material = index % 3 === 0 ? bushB : bushA;
      (index % 3 === 0 ? bushesB : bushesA).push(bush);

      if (index % 3 === 0) {
        const rockX = x + side * 2.1;
        const rockZ = z - 1.7;
        const rock = BABYLON.MeshBuilder.CreatePolyhedron(`frontier-route-rock-${index}`, {
          type: 1 + index % 3,
          size: 0.7 + (index % 2) * 0.2
        }, this.scene);
        rock.position = new BABYLON.Vector3(
          rockX,
          this.world.heightAt(rockX, rockZ) + 0.34,
          rockZ
        );
        rock.scaling = new BABYLON.Vector3(1.35, 0.72, 1.05);
        rock.rotation = new BABYLON.Vector3(index * 0.11, index * 0.69, index * 0.07);
        rock.material = rockMaterial;
        rocks.push(rock);
      }
    }

    for (let section = 0; section < 8; section += 1) {
      const side = section % 2 === 0 ? -1 : 1;
      const x = side * (9.2 + (section % 3) * 1.4);
      const z = -24 - section * 19;
      const y = this.world.heightAt(x, z);
      [-2.7, 2.7].forEach((zOffset, postIndex) => {
        const post = BABYLON.MeshBuilder.CreateCylinder(`frontier-fence-post-${section}-${postIndex}`, {
          height: 1.65,
          diameterTop: 0.16,
          diameterBottom: 0.25,
          tessellation: 6
        }, this.scene);
        post.position = new BABYLON.Vector3(x, y + 0.82, z + zOffset);
        post.rotation.z = side * (postIndex === 0 ? -0.05 : 0.05);
        post.material = wood;
        fenceMeshes.push(post);
      });

      for (let railIndex = 0; railIndex < 2; railIndex += 1) {
        const rail = BABYLON.MeshBuilder.CreateBox(`frontier-fence-rail-${section}-${railIndex}`, {
          width: 0.16,
          height: 0.18,
          depth: 5.7
        }, this.scene);
        rail.position = new BABYLON.Vector3(x, y + 0.72 + railIndex * 0.52, z);
        rail.rotation.x = railIndex === 0 ? 0.03 : -0.04;
        rail.material = wood;
        fenceMeshes.push(rail);
      }
    }

    this.mergeStatic({ name: "frontier-route-bush-a-batch", meshes: bushesA, receiveShadows: false });
    this.mergeStatic({ name: "frontier-route-bush-b-batch", meshes: bushesB, receiveShadows: false });
    this.mergeStatic({ name: "frontier-route-rock-batch", meshes: rocks, receiveShadows: true });
    this.mergeStatic({ name: "frontier-route-fence-batch", meshes: fenceMeshes, receiveShadows: false });
  }

  private stabilizeGateBanners(): void {
    const banner = this.scene.getMeshByName?.("caelus-gate-banners-batch");
    if (banner) {
      banner.material = this.unlitMaterial("caelus-gate-banner-unlit", "#31566a");
      this.world.glowLayer?.addExcludedMesh?.(banner);
    }
  }

  private unlitMaterial(name: string, hex: string): any {
    const material = new BABYLON.StandardMaterial(name, this.scene);
    material.disableLighting = true;
    material.diffuseColor = BABYLON.Color3.Black();
    material.specularColor = BABYLON.Color3.Black();
    material.emissiveColor = BABYLON.Color3.FromHexString(hex);
    material.freeze();
    return material;
  }

  private mergeStatic(group: StaticGroup): void {
    if (group.meshes.length === 0) return;
    group.meshes.forEach((mesh) => mesh.computeWorldMatrix(true));
    const merged = BABYLON.Mesh.MergeMeshes(group.meshes, true, true, undefined, false, false);
    if (!merged) return;
    merged.name = group.name;
    merged.receiveShadows = group.receiveShadows;
    merged.isPickable = false;
    this.world.glowLayer?.addExcludedMesh?.(merged);
    merged.computeWorldMatrix(true);
    merged.freezeWorldMatrix();
  }
}
