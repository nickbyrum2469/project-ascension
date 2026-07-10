import {
  createMara,
  createMaterial,
  type HumanoidVisual
} from "../world/ProceduralAssets.js";

interface RoutePoint {
  x: number;
  z: number;
}

interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface AmbientCitizen {
  visual: HumanoidVisual;
  route: any[];
  routeIndex: number;
  speed: number;
  phase: number;
}

interface StaticBatch {
  name: string;
  meshes: any[];
  receiveShadows: boolean;
  cameraCollision?: boolean;
  glow?: boolean;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const smooth = (value: number): number => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount;

export class VerticalSliceDirector {
  private readonly game: any;
  private readonly world: any;
  private readonly scene: any;
  private readonly originalHeightAt: (x: number, z: number) => number;
  private readonly route: RoutePoint[];
  private readonly citizens: AmbientCitizen[] = [];
  private elapsed = 0;
  private citizenAccumulator = 0;

  constructor(game: any) {
    this.game = game;
    this.world = game.world;
    this.scene = game.world.scene;
    this.originalHeightAt = game.world.heightAt.bind(game.world);
    this.route = this.sampleCatmullRom([
      { x: 0, z: 18 },
      { x: 0, z: -68 },
      { x: -34, z: -154 },
      { x: 18, z: -246 },
      { x: 132, z: -332 },
      { x: 286, z: -419 },
      { x: 420, z: -454 },
      { x: 475, z: -485 },
      { x: 475, z: -598 }
    ], 12);

    this.disableLegacySliceGeometry();
    this.installSculptedTerrain();
    this.rebaseExistingWorldObjects();
    this.buildCaelusDistrict();
    this.buildFrontierRoute();
    this.buildFoundryBreach();
    this.buildPillarConnection();
    this.createAmbientCitizens();
    this.tuneVerticalSliceLighting();

    this.scene.metadata = {
      ...(this.scene.metadata ?? {}),
      verticalSliceVersion: 2,
      verticalSliceRoute: "Caelus Reach → Windscar Road → Foundry Breach → Eastern Pillar"
    };

    this.scene.onBeforeRenderObservable.add(() => {
      const delta = Math.min(0.05, Math.max(0.001, this.world.engine.getDeltaTime() / 1000));
      this.update(delta);
    });
  }

  private disableLegacySliceGeometry(): void {
    const prefixes = [
      "spawn-trail-",
      "frontier-path-",
      "frontier-route-",
      "frontier-road",
      "western-expedition-road",
      "north-basin-road",
      "caelus-cobble-",
      "caelus-boulevard-",
      "caelus-building-",
      "labyrinth-cliff-",
      "labyrinth-mouth",
      "labyrinth-arch-",
      "labyrinth-tunnel-rib-"
    ];
    for (const mesh of this.scene.meshes) {
      const name = String(mesh.name ?? "");
      if (prefixes.some((prefix) => name.startsWith(prefix))) mesh.setEnabled(false);
    }
  }

  private installSculptedTerrain(): void {
    this.world.heightAt = (x: number, z: number): number => this.sculptedHeightAt(x, z);
    const terrain = this.scene.getMeshByName?.("windscar-terrain");
    if (!terrain) return;
    terrain.unfreezeWorldMatrix?.();
    const positions = terrain.getVerticesData(BABYLON.VertexBuffer.PositionKind) as number[] | null;
    const indices = terrain.getIndices() as number[] | null;
    const normals = terrain.getVerticesData(BABYLON.VertexBuffer.NormalKind) as number[] | null;
    if (!positions || !indices || !normals) return;

    for (let index = 0; index < positions.length; index += 3) {
      const worldX = positions[index] + terrain.position.x;
      const worldZ = positions[index + 2] + terrain.position.z;
      positions[index + 1] = this.sculptedHeightAt(worldX, worldZ) - terrain.position.y;
    }
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);
    terrain.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
    terrain.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
    terrain.refreshBoundingInfo();
    terrain.computeWorldMatrix(true);
  }

  private sculptedHeightAt(x: number, z: number): number {
    let height = this.originalHeightAt(x, z);

    if (z >= 20 && z <= 210 && Math.abs(x) <= 140) {
      const lateral = 1 - smooth((Math.abs(x) - 112) / 27);
      const middleTier = smooth((z - 78) / 18) * 2.25;
      const upperTier = smooth((z - 138) / 20) * 2.75;
      height += (middleTier + upperTier) * lateral;
    }

    if (z <= 24) {
      const nearest = this.nearestRouteSample(x, z);
      const routeBlend = 1 - smooth((nearest.distance - 5.2) / 13.5);
      if (routeBlend > 0) {
        const centerHeight = this.originalHeightAt(nearest.x, nearest.z)
          + this.foundryDepthDelta(nearest.x, nearest.z);
        height = lerp(height, centerHeight, routeBlend * 0.86);
      }
    }

    height += this.foundryDepthDelta(x, z);
    return height;
  }

  private foundryDepthDelta(x: number, z: number): number {
    if (z > -448 || z < -635) return 0;
    const lateral = 1 - smooth((Math.abs(x - 475) - 30) / 28);
    if (lateral <= 0) return 0;
    const descent = smooth((-z - 448) / 142);
    return -10.5 * descent * lateral;
  }

  private nearestRouteSample(x: number, z: number): { x: number; z: number; distance: number } {
    let best = { x: this.route[0].x, z: this.route[0].z, distance: Number.POSITIVE_INFINITY };
    for (let index = 0; index < this.route.length - 1; index += 1) {
      const from = this.route[index];
      const to = this.route[index + 1];
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      const lengthSquared = dx * dx + dz * dz;
      const t = lengthSquared > 0
        ? clamp01(((x - from.x) * dx + (z - from.z) * dz) / lengthSquared)
        : 0;
      const px = from.x + dx * t;
      const pz = from.z + dz * t;
      const distance = Math.hypot(x - px, z - pz);
      if (distance < best.distance) best = { x: px, z: pz, distance };
    }
    return best;
  }

  private rebaseExistingWorldObjects(): void {
    for (const mesh of this.scene.meshes) {
      if (mesh.parent || mesh.isDisposed?.()) continue;
      const name = String(mesh.name ?? "");
      const x = Number(mesh.position?.x ?? 0);
      const z = Number(mesh.position?.z ?? 0);
      if (name.startsWith("caelus-") || name.startsWith("city-lantern-")) {
        mesh.position.y += this.sculptedHeightAt(x, z) - this.originalHeightAt(x, z);
      }
      if (name.startsWith("foundry-") || name.startsWith("labyrinth-")) {
        if (name.includes("floor") && mesh.getVerticesData?.(BABYLON.VertexBuffer.PositionKind)) {
          this.deformMeshToSculptedGround(mesh, 0.08);
        } else {
          mesh.position.y += this.foundryDepthDelta(x, z);
        }
      }
    }

    const labyrinth = this.game.labyrinth;
    labyrinth.entryPosition.y = this.world.heightAt(labyrinth.entryPosition.x, labyrinth.entryPosition.z);
    labyrinth.corePosition.y = this.world.heightAt(labyrinth.corePosition.x, labyrinth.corePosition.z);
    labyrinth.shortcutPosition.y = this.world.heightAt(labyrinth.shortcutPosition.x, labyrinth.shortcutPosition.z);
    labyrinth.sigilPositions.forEach((position: any) => {
      position.y = this.world.heightAt(position.x, position.z);
    });

    const expedition = this.game.expedition;
    const liftX = this.world.labyrinthPosition.x;
    const liftZ = this.world.labyrinthPosition.z - 126;
    const liftDelta = this.foundryDepthDelta(liftX, liftZ);
    expedition.liftRoot.position.y += liftDelta;
    expedition.liftBaseY += liftDelta;
    expedition.liftTopY += liftDelta;
    expedition.liftConsolePosition.y += liftDelta;

    const sentinel = this.game.enemies?.[4];
    if (sentinel?.root) sentinel.root.position.y = this.world.heightAt(sentinel.root.position.x, sentinel.root.position.z);
  }

  private deformMeshToSculptedGround(mesh: any, offset: number): void {
    const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind) as number[] | null;
    const indices = mesh.getIndices() as number[] | null;
    const normals = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind) as number[] | null;
    if (!positions || !indices || !normals) return;
    for (let index = 0; index < positions.length; index += 3) {
      const worldX = positions[index] + mesh.position.x;
      const worldZ = positions[index + 2] + mesh.position.z;
      positions[index + 1] = this.world.heightAt(worldX, worldZ) + offset - mesh.position.y;
    }
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);
    mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
    mesh.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals);
    mesh.refreshBoundingInfo();
  }

  private buildCaelusDistrict(): void {
    const street = createMaterial(this.scene, "vertical-slice-city-street", "#394846", 0.96, 0.01);
    const curb = createMaterial(this.scene, "vertical-slice-city-curb", "#68736d", 0.9, 0.03);
    const plazaStone = createMaterial(this.scene, "vertical-slice-plaza-stone", "#53625f", 0.92, 0.03);
    const plasterA = createMaterial(this.scene, "vertical-slice-plaster-a", "#8d927d", 0.95, 0.01);
    const plasterB = createMaterial(this.scene, "vertical-slice-plaster-b", "#71877d", 0.95, 0.01);
    const timber = createMaterial(this.scene, "vertical-slice-timber", "#4c3d31", 0.92, 0.03);
    const roofBlue = createMaterial(this.scene, "vertical-slice-roof-blue", "#2d5361", 0.84, 0.12);
    const roofGreen = createMaterial(this.scene, "vertical-slice-roof-green", "#405f48", 0.9, 0.06);
    const windowGlow = createMaterial(this.scene, "vertical-slice-window-glow", "#d8f8d8", 0.3, 0.02, "#8fdca7");
    const banner = createMaterial(this.scene, "vertical-slice-banner", "#315a6d", 0.88, 0.02);
    const marketCloth = createMaterial(this.scene, "vertical-slice-market-cloth", "#8e6452", 0.92, 0.01);

    this.createTerrainRibbon(
      "vertical-slice-caelus-boulevard",
      this.linearRoute({ x: 0, z: 24 }, { x: 0, z: 198 }, 60),
      7.2,
      street,
      0.06
    );
    for (const z of [58, 94, 132, 168]) {
      this.createTerrainRibbon(
        `vertical-slice-side-street-${z}`,
        this.linearRoute({ x: -118, z }, { x: 118, z }, 48),
        4.2,
        street,
        0.055
      );
    }

    [72, 112, 166].forEach((z, index) => {
      const plaza = BABYLON.MeshBuilder.CreateCylinder(`vertical-slice-plaza-${index}`, {
        height: 0.26,
        diameter: index === 1 ? 44 : 30,
        tessellation: 32
      }, this.scene);
      plaza.position = new BABYLON.Vector3(0, this.world.heightAt(0, z) + 0.09, z);
      plaza.material = plazaStone;
      plaza.receiveShadows = true;
      plaza.metadata = { cameraCollision: true };
    });

    const bodiesA: any[] = [];
    const bodiesB: any[] = [];
    const bands: any[] = [];
    const roofsBlue: any[] = [];
    const roofsGreen: any[] = [];
    const doors: any[] = [];
    const windows: any[] = [];
    const chimneys: any[] = [];
    let buildingIndex = 0;
    for (const z of [46, 72, 100, 130, 160, 186]) {
      for (const side of [-1, 1]) {
        for (let lane = 0; lane < 3; lane += 1) {
          const x = side * (27 + lane * 30 + (buildingIndex % 2) * 2.2);
          if (Math.abs(x) > 108) continue;
          const width = 15 + (buildingIndex % 3) * 2.2;
          const depth = 15 + (buildingIndex % 2) * 2.4;
          const height = 10 + (buildingIndex % 4) * 2.2;
          const ground = this.world.heightAt(x, z);
          const body = BABYLON.MeshBuilder.CreateBox(`vertical-slice-rowhouse-${buildingIndex}`, {
            width,
            height,
            depth
          }, this.scene);
          body.position = new BABYLON.Vector3(x, ground + height / 2, z);
          body.material = buildingIndex % 2 === 0 ? plasterA : plasterB;
          body.receiveShadows = true;
          body.metadata = { cameraCollision: true };
          (buildingIndex % 2 === 0 ? bodiesA : bodiesB).push(body);
          this.addCollisionBox(x, z, width, depth, 0.7);

          const band = BABYLON.MeshBuilder.CreateBox(`vertical-slice-rowhouse-band-${buildingIndex}`, {
            width: width + 0.24,
            height: 1.1,
            depth: depth + 0.24
          }, this.scene);
          band.position = new BABYLON.Vector3(x, ground + 1.45, z);
          band.material = timber;
          bands.push(band);

          const roof = BABYLON.MeshBuilder.CreateCylinder(`vertical-slice-rowhouse-roof-${buildingIndex}`, {
            height: 4.8,
            diameterTop: 0,
            diameterBottom: Math.max(width, depth) * 1.34,
            tessellation: 4
          }, this.scene);
          roof.position = new BABYLON.Vector3(x, ground + height + 2.35, z);
          roof.rotation.y = Math.PI / 4;
          roof.scaling.z = depth / width;
          roof.material = buildingIndex % 3 === 0 ? roofGreen : roofBlue;
          (buildingIndex % 3 === 0 ? roofsGreen : roofsBlue).push(roof);

          const facadeX = x - side * (width / 2 + 0.07);
          const door = BABYLON.MeshBuilder.CreateBox(`vertical-slice-rowhouse-door-${buildingIndex}`, {
            width: 0.18,
            height: 2.5,
            depth: 1.35
          }, this.scene);
          door.position = new BABYLON.Vector3(facadeX, ground + 1.25, z - depth * 0.18);
          door.material = timber;
          doors.push(door);

          for (let windowIndex = 0; windowIndex < 2; windowIndex += 1) {
            const window = BABYLON.MeshBuilder.CreateBox(`vertical-slice-rowhouse-window-${buildingIndex}-${windowIndex}`, {
              width: 0.12,
              height: 1.15,
              depth: 1.05
            }, this.scene);
            window.position = new BABYLON.Vector3(
              facadeX - side * 0.02,
              ground + 4.1 + windowIndex * 2.55,
              z + (windowIndex === 0 ? depth * 0.2 : -depth * 0.24)
            );
            window.material = windowGlow;
            windows.push(window);
          }

          if (buildingIndex % 3 === 0) {
            const chimney = BABYLON.MeshBuilder.CreateBox(`vertical-slice-rowhouse-chimney-${buildingIndex}`, {
              width: 1.05,
              height: 4.4,
              depth: 1.05
            }, this.scene);
            chimney.position = new BABYLON.Vector3(
              x + side * width * 0.22,
              ground + height + 4.2,
              z + depth * 0.16
            );
            chimney.material = timber;
            chimneys.push(chimney);
          }
          buildingIndex += 1;
        }
      }
    }

    this.mergeStatic({ name: "vertical-slice-city-bodies-a", meshes: bodiesA, receiveShadows: true, cameraCollision: true });
    this.mergeStatic({ name: "vertical-slice-city-bodies-b", meshes: bodiesB, receiveShadows: true, cameraCollision: true });
    this.mergeStatic({ name: "vertical-slice-city-bands", meshes: bands, receiveShadows: true });
    this.mergeStatic({ name: "vertical-slice-city-roofs-blue", meshes: roofsBlue, receiveShadows: true });
    this.mergeStatic({ name: "vertical-slice-city-roofs-green", meshes: roofsGreen, receiveShadows: true });
    this.mergeStatic({ name: "vertical-slice-city-doors", meshes: doors, receiveShadows: false });
    this.mergeStatic({ name: "vertical-slice-city-windows", meshes: windows, receiveShadows: false, glow: true });
    this.mergeStatic({ name: "vertical-slice-city-chimneys", meshes: chimneys, receiveShadows: true });

    const stallWood: any[] = [];
    const stallCloth: any[] = [];
    for (let index = 0; index < 8; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const z = 63 + Math.floor(index / 2) * 18;
      const x = side * 15.5;
      const ground = this.world.heightAt(x, z);
      for (const postOffset of [-1.7, 1.7]) {
        const post = BABYLON.MeshBuilder.CreateBox(`vertical-slice-stall-post-${index}-${postOffset}`, {
          width: 0.22,
          height: 2.9,
          depth: 0.22
        }, this.scene);
        post.position = new BABYLON.Vector3(x + postOffset, ground + 1.45, z);
        post.material = timber;
        stallWood.push(post);
      }
      const counter = BABYLON.MeshBuilder.CreateBox(`vertical-slice-stall-counter-${index}`, {
        width: 3.8,
        height: 0.5,
        depth: 1.3
      }, this.scene);
      counter.position = new BABYLON.Vector3(x, ground + 1, z);
      counter.material = timber;
      stallWood.push(counter);
      const canopy = BABYLON.MeshBuilder.CreateBox(`vertical-slice-stall-canopy-${index}`, {
        width: 4.4,
        height: 0.16,
        depth: 2.5
      }, this.scene);
      canopy.position = new BABYLON.Vector3(x, ground + 3.05, z);
      canopy.rotation.z = side * 0.07;
      canopy.material = index % 3 === 0 ? banner : marketCloth;
      stallCloth.push(canopy);
    }
    this.mergeStatic({ name: "vertical-slice-market-wood", meshes: stallWood, receiveShadows: true });
    this.mergeStatic({ name: "vertical-slice-market-canopies", meshes: stallCloth, receiveShadows: false });

    this.buildGatehouse(street, curb, roofBlue, banner, windowGlow);
    this.buildWallWalks(curb, timber);
    this.buildPlazaMonuments(plazaStone, timber, windowGlow);
  }

  private buildGatehouse(street: any, stone: any, roof: any, banner: any, glow: any): void {
    const towerMeshes: any[] = [];
    const roofMeshes: any[] = [];
    const bannerMeshes: any[] = [];
    const ground = this.world.heightAt(0, 20);
    for (const side of [-1, 1]) {
      const x = side * 19;
      const tower = BABYLON.MeshBuilder.CreateCylinder(`vertical-slice-gate-tower-${side}`, {
        height: 23,
        diameterTop: 12,
        diameterBottom: 15,
        tessellation: 12
      }, this.scene);
      tower.position = new BABYLON.Vector3(x, ground + 11.5, 20);
      tower.material = stone;
      tower.receiveShadows = true;
      towerMeshes.push(tower);
      this.addCollisionBox(x, 20, 13, 13, 0.8);

      const crown = BABYLON.MeshBuilder.CreateCylinder(`vertical-slice-gate-crown-${side}`, {
        height: 5.5,
        diameterTop: 0,
        diameterBottom: 17,
        tessellation: 12
      }, this.scene);
      crown.position = new BABYLON.Vector3(x, ground + 25.5, 20);
      crown.material = roof;
      roofMeshes.push(crown);

      const hanging = BABYLON.MeshBuilder.CreateBox(`vertical-slice-gate-banner-${side}`, {
        width: 0.18,
        height: 6.4,
        depth: 2.8
      }, this.scene);
      hanging.position = new BABYLON.Vector3(x - side * 7.1, ground + 14.8, 18.8);
      hanging.material = banner;
      bannerMeshes.push(hanging);

      const rune = BABYLON.MeshBuilder.CreateTorus(`vertical-slice-gate-rune-${side}`, {
        diameter: 2.3,
        thickness: 0.13,
        tessellation: 22
      }, this.scene);
      rune.position = new BABYLON.Vector3(x, ground + 14.5, 12.5);
      rune.rotation.x = Math.PI / 2;
      rune.material = glow;
    }

    const bridge = BABYLON.MeshBuilder.CreateBox("vertical-slice-gate-bridge", {
      width: 23,
      height: 4.2,
      depth: 6.5
    }, this.scene);
    bridge.position = new BABYLON.Vector3(0, ground + 17.4, 20);
    bridge.material = stone;
    towerMeshes.push(bridge);

    const threshold = BABYLON.MeshBuilder.CreateBox("vertical-slice-gate-threshold", {
      width: 15.5,
      height: 0.22,
      depth: 9
    }, this.scene);
    threshold.position = new BABYLON.Vector3(0, ground + 0.08, 20);
    threshold.material = street;

    this.mergeStatic({ name: "vertical-slice-gatehouse-stone", meshes: towerMeshes, receiveShadows: true, cameraCollision: true });
    this.mergeStatic({ name: "vertical-slice-gatehouse-roofs", meshes: roofMeshes, receiveShadows: true });
    this.mergeStatic({ name: "vertical-slice-gatehouse-banners", meshes: bannerMeshes, receiveShadows: false });
  }

  private buildWallWalks(stone: any, timber: any): void {
    const walks: any[] = [];
    const merlons: any[] = [];
    for (const side of [-1, 1]) {
      for (let segment = 0; segment < 8; segment += 1) {
        const z = 42 + segment * 21;
        const y = this.world.heightAt(side * 124, z) + 10.6;
        const walk = BABYLON.MeshBuilder.CreateBox(`vertical-slice-wall-walk-${side}-${segment}`, {
          width: 5.8,
          height: 0.5,
          depth: 21.5
        }, this.scene);
        walk.position = new BABYLON.Vector3(side * 124, y, z);
        walk.material = stone;
        walks.push(walk);
        for (let merlon = -2; merlon <= 2; merlon += 1) {
          const block = BABYLON.MeshBuilder.CreateBox(`vertical-slice-wall-merlon-${side}-${segment}-${merlon}`, {
            width: 1.1,
            height: 1.3,
            depth: 1.1
          }, this.scene);
          block.position = new BABYLON.Vector3(side * 121.3, y + 0.9, z + merlon * 4.2);
          block.material = stone;
          merlons.push(block);
        }
      }
      for (let step = 0; step < 10; step += 1) {
        const stair = BABYLON.MeshBuilder.CreateBox(`vertical-slice-wall-stair-${side}-${step}`, {
          width: 4.1,
          height: 0.55,
          depth: 1.3
        }, this.scene);
        stair.position = new BABYLON.Vector3(
          side * (111 + step * 1.2),
          this.world.heightAt(side * 112, 45) + 0.28 + step * 0.95,
          45 + step * 1.25
        );
        stair.material = timber;
        walks.push(stair);
      }
    }
    this.mergeStatic({ name: "vertical-slice-wall-walks", meshes: walks, receiveShadows: true });
    this.mergeStatic({ name: "vertical-slice-wall-merlons", meshes: merlons, receiveShadows: true });
  }

  private buildPlazaMonuments(stone: any, metal: any, glow: any): void {
    const parts: any[] = [];
    for (const [index, z] of [72, 112, 166].entries()) {
      const y = this.world.heightAt(0, z);
      const base = BABYLON.MeshBuilder.CreateCylinder(`vertical-slice-monument-base-${index}`, {
        height: 1.2,
        diameterTop: 5.2,
        diameterBottom: 6.4,
        tessellation: 10
      }, this.scene);
      base.position = new BABYLON.Vector3(0, y + 0.6, z);
      base.material = stone;
      parts.push(base);
      const spine = BABYLON.MeshBuilder.CreateCylinder(`vertical-slice-monument-spine-${index}`, {
        height: 7 + index * 2,
        diameterTop: 0.8,
        diameterBottom: 1.6,
        tessellation: 8
      }, this.scene);
      spine.position = new BABYLON.Vector3(0, y + 4.5 + index, z);
      spine.material = metal;
      parts.push(spine);
      const ring = BABYLON.MeshBuilder.CreateTorus(`vertical-slice-monument-ring-${index}`, {
        diameter: 3 + index * 0.45,
        thickness: 0.16,
        tessellation: 24
      }, this.scene);
      ring.position = new BABYLON.Vector3(0, y + 7.4 + index * 1.9, z);
      ring.rotation.x = Math.PI / 2;
      ring.material = glow;
    }
    this.mergeStatic({ name: "vertical-slice-plaza-monuments", meshes: parts, receiveShadows: true });
  }

  private buildFrontierRoute(): void {
    const verge = createMaterial(this.scene, "vertical-slice-road-verge", "#50604d", 0.98, 0.01);
    const road = createMaterial(this.scene, "vertical-slice-road", "#756a50", 0.97, 0.01);
    const roadDark = createMaterial(this.scene, "vertical-slice-road-dark", "#554b39", 0.96, 0.02);
    const stone = createMaterial(this.scene, "vertical-slice-road-stone", "#66716b", 0.94, 0.02);
    const wood = createMaterial(this.scene, "vertical-slice-road-wood", "#4b3d31", 0.92, 0.02);
    const leafA = createMaterial(this.scene, "vertical-slice-route-leaf-a", "#466549", 0.98, 0);
    const leafB = createMaterial(this.scene, "vertical-slice-route-leaf-b", "#617b52", 0.98, 0);
    const markerGlow = createMaterial(this.scene, "vertical-slice-route-glow", "#b7fff1", 0.18, 0.04, "#42d9ce");

    const routeToBreach = this.route.filter((point) => point.z >= -487);
    this.createTerrainRibbon("vertical-slice-road-verge", routeToBreach, 9.2, verge, 0.025);
    this.createTerrainRibbon("vertical-slice-road-surface", routeToBreach, 6.1, road, 0.07);
    this.createTerrainRibbon("vertical-slice-road-center", routeToBreach, 1.15, roadDark, 0.085);

    const edgeStones: any[] = [];
    const markerParts: any[] = [];
    const bushesA: any[] = [];
    const bushesB: any[] = [];
    const rocks: any[] = [];
    const fences: any[] = [];
    const trunks: any[] = [];
    const canopies: any[] = [];

    for (let index = 4; index < routeToBreach.length - 4; index += 4) {
      const point = routeToBreach[index];
      const previous = routeToBreach[index - 1];
      const next = routeToBreach[index + 1];
      const tangent = new BABYLON.Vector3(next.x - previous.x, 0, next.z - previous.z).normalize();
      const sideVector = new BABYLON.Vector3(-tangent.z, 0, tangent.x);
      for (const side of [-1, 1]) {
        const edgeX = point.x + sideVector.x * 7.15 * side;
        const edgeZ = point.z + sideVector.z * 7.15 * side;
        const edge = BABYLON.MeshBuilder.CreatePolyhedron(`vertical-slice-edge-stone-${index}-${side}`, {
          type: 1 + index % 3,
          size: 0.52 + (index % 4) * 0.08
        }, this.scene);
        edge.position = new BABYLON.Vector3(edgeX, this.world.heightAt(edgeX, edgeZ) + 0.25, edgeZ);
        edge.scaling = new BABYLON.Vector3(1.3, 0.62, 1.05);
        edge.rotation = new BABYLON.Vector3(index * 0.07, index * 0.41, side * 0.08);
        edge.material = stone;
        edgeStones.push(edge);
      }

      if (index % 12 === 0) {
        for (const side of [-1, 1]) {
          const x = point.x + sideVector.x * 8.4 * side;
          const z = point.z + sideVector.z * 8.4 * side;
          const y = this.world.heightAt(x, z);
          const post = BABYLON.MeshBuilder.CreateCylinder(`vertical-slice-route-marker-post-${index}-${side}`, {
            height: 2.4,
            diameterTop: 0.16,
            diameterBottom: 0.32,
            tessellation: 6
          }, this.scene);
          post.position = new BABYLON.Vector3(x, y + 1.2, z);
          post.material = wood;
          markerParts.push(post);
          const rune = BABYLON.MeshBuilder.CreatePolyhedron(`vertical-slice-route-marker-rune-${index}-${side}`, {
            type: 1,
            size: 0.38
          }, this.scene);
          rune.position = new BABYLON.Vector3(x, y + 2.65, z);
          rune.material = markerGlow;
        }
      }
    }

    for (let index = 0; index < 86; index += 1) {
      const routeIndex = 8 + (index * 5) % Math.max(9, routeToBreach.length - 16);
      const point = routeToBreach[routeIndex];
      const previous = routeToBreach[Math.max(0, routeIndex - 1)];
      const next = routeToBreach[Math.min(routeToBreach.length - 1, routeIndex + 1)];
      const tangent = new BABYLON.Vector3(next.x - previous.x, 0, next.z - previous.z).normalize();
      const sideVector = new BABYLON.Vector3(-tangent.z, 0, tangent.x);
      const side = index % 2 === 0 ? -1 : 1;
      const distance = 11 + (index % 7) * 3.1;
      const along = ((index % 5) - 2) * 1.8;
      const x = point.x + sideVector.x * distance * side + tangent.x * along;
      const z = point.z + sideVector.z * distance * side + tangent.z * along;
      const y = this.world.heightAt(x, z);

      if (index % 5 === 0) {
        const trunk = BABYLON.MeshBuilder.CreateCylinder(`vertical-slice-route-tree-trunk-${index}`, {
          height: 4.2 + index % 3,
          diameterTop: 0.42,
          diameterBottom: 0.78,
          tessellation: 7
        }, this.scene);
        trunk.position = new BABYLON.Vector3(x, y + 2.2, z);
        trunk.material = wood;
        trunks.push(trunk);
        const canopy = BABYLON.MeshBuilder.CreatePolyhedron(`vertical-slice-route-tree-canopy-${index}`, {
          type: 2,
          size: 2.5 + (index % 4) * 0.35
        }, this.scene);
        canopy.position = new BABYLON.Vector3(x, y + 5.7, z);
        canopy.scaling = new BABYLON.Vector3(1.1, 1.35, 1.05);
        canopy.rotation.y = index * 0.63;
        canopy.material = index % 10 === 0 ? leafB : leafA;
        canopies.push(canopy);
      } else {
        const bush = BABYLON.MeshBuilder.CreateSphere(`vertical-slice-route-bush-${index}`, {
          diameter: 1.6 + (index % 4) * 0.2,
          segments: 6
        }, this.scene);
        bush.position = new BABYLON.Vector3(x, y + 0.45, z);
        bush.scaling = new BABYLON.Vector3(1.4, 0.58, 1.1);
        bush.rotation.y = index * 0.77;
        bush.material = index % 3 === 0 ? leafB : leafA;
        (index % 3 === 0 ? bushesB : bushesA).push(bush);
      }

      if (index % 7 === 0) {
        const rock = BABYLON.MeshBuilder.CreatePolyhedron(`vertical-slice-route-rock-${index}`, {
          type: 1 + index % 4,
          size: 0.9 + (index % 3) * 0.25
        }, this.scene);
        rock.position = new BABYLON.Vector3(x + side * 2.3, y + 0.45, z - 1.5);
        rock.scaling = new BABYLON.Vector3(1.35, 0.72, 1.05);
        rock.rotation = new BABYLON.Vector3(index * 0.05, index * 0.49, index * 0.03);
        rock.material = stone;
        rocks.push(rock);
      }
    }

    for (let section = 0; section < 14; section += 1) {
      const point = routeToBreach[Math.min(routeToBreach.length - 8, 12 + section * 6)];
      const previous = routeToBreach[Math.max(0, 11 + section * 6)];
      const next = routeToBreach[Math.min(routeToBreach.length - 1, 13 + section * 6)];
      const tangent = new BABYLON.Vector3(next.x - previous.x, 0, next.z - previous.z).normalize();
      const sideVector = new BABYLON.Vector3(-tangent.z, 0, tangent.x);
      const side = section % 2 === 0 ? -1 : 1;
      const x = point.x + sideVector.x * 10.8 * side;
      const z = point.z + sideVector.z * 10.8 * side;
      const y = this.world.heightAt(x, z);
      for (const offset of [-2.7, 2.7]) {
        const post = BABYLON.MeshBuilder.CreateCylinder(`vertical-slice-road-fence-post-${section}-${offset}`, {
          height: 1.75,
          diameterTop: 0.16,
          diameterBottom: 0.28,
          tessellation: 6
        }, this.scene);
        post.position = new BABYLON.Vector3(x + tangent.x * offset, y + 0.86, z + tangent.z * offset);
        post.material = wood;
        fences.push(post);
      }
      const rail = BABYLON.MeshBuilder.CreateBox(`vertical-slice-road-fence-rail-${section}`, {
        width: 0.18,
        height: 0.2,
        depth: 5.9
      }, this.scene);
      rail.position = new BABYLON.Vector3(x, y + 1.08, z);
      rail.rotation.y = Math.atan2(tangent.x, tangent.z);
      rail.material = wood;
      fences.push(rail);
    }

    this.mergeStatic({ name: "vertical-slice-road-edge-stones", meshes: edgeStones, receiveShadows: true });
    this.mergeStatic({ name: "vertical-slice-route-marker-parts", meshes: markerParts, receiveShadows: true });
    this.mergeStatic({ name: "vertical-slice-route-bushes-a", meshes: bushesA, receiveShadows: false });
    this.mergeStatic({ name: "vertical-slice-route-bushes-b", meshes: bushesB, receiveShadows: false });
    this.mergeStatic({ name: "vertical-slice-route-rocks", meshes: rocks, receiveShadows: true });
    this.mergeStatic({ name: "vertical-slice-route-fences", meshes: fences, receiveShadows: false });
    this.mergeStatic({ name: "vertical-slice-route-tree-trunks", meshes: trunks, receiveShadows: true });
    this.mergeStatic({ name: "vertical-slice-route-tree-canopies", meshes: canopies, receiveShadows: false });

    this.buildRoadLandmarks(stone, wood, markerGlow);
  }

  private buildRoadLandmarks(stone: any, wood: any, glow: any): void {
    const archPoint = { x: -26, z: -145 };
    const archY = this.world.heightAt(archPoint.x, archPoint.z);
    for (const side of [-1, 1]) {
      const pillar = BABYLON.MeshBuilder.CreateCylinder(`vertical-slice-way-arch-pillar-${side}`, {
        height: 8.5,
        diameterTop: 1.4,
        diameterBottom: 2.1,
        tessellation: 8
      }, this.scene);
      pillar.position = new BABYLON.Vector3(archPoint.x + side * 6.6, archY + 4.25, archPoint.z);
      pillar.material = stone;
      this.addCollisionBox(pillar.position.x, pillar.position.z, 2.2, 2.2, 0.3);
    }
    const lintel = BABYLON.MeshBuilder.CreateBox("vertical-slice-way-arch-lintel", {
      width: 15.3,
      height: 1.4,
      depth: 2.1
    }, this.scene);
    lintel.position = new BABYLON.Vector3(archPoint.x, archY + 8.15, archPoint.z);
    lintel.material = stone;
    const archRune = BABYLON.MeshBuilder.CreateTorus("vertical-slice-way-arch-rune", {
      diameter: 3.2,
      thickness: 0.18,
      tessellation: 24
    }, this.scene);
    archRune.position = new BABYLON.Vector3(archPoint.x, archY + 8.15, archPoint.z - 1.15);
    archRune.rotation.x = Math.PI / 2;
    archRune.material = glow;

    const campX = 76;
    const campZ = -286;
    const campY = this.world.heightAt(campX, campZ);
    const tent = BABYLON.MeshBuilder.CreateCylinder("vertical-slice-road-camp-tent", {
      height: 4.8,
      diameterTop: 0,
      diameterBottom: 8.8,
      tessellation: 4
    }, this.scene);
    tent.position = new BABYLON.Vector3(campX, campY + 2.3, campZ);
    tent.rotation.y = Math.PI / 4;
    tent.scaling.z = 0.62;
    tent.material = wood;
    this.addCollisionBox(campX, campZ, 6.5, 5, 0.4);

    const overlookX = 225;
    const overlookZ = -385;
    const overlookY = this.world.heightAt(overlookX, overlookZ);
    const watch = BABYLON.MeshBuilder.CreateCylinder("vertical-slice-foundry-watchtower", {
      height: 16,
      diameterTop: 6,
      diameterBottom: 9,
      tessellation: 10
    }, this.scene);
    watch.position = new BABYLON.Vector3(overlookX, overlookY + 8, overlookZ);
    watch.material = stone;
    this.addCollisionBox(overlookX, overlookZ, 8, 8, 0.5);
  }

  private buildFoundryBreach(): void {
    const cliff = createMaterial(this.scene, "vertical-slice-foundry-cliff", "#334a45", 0.97, 0.01);
    const cliffDark = createMaterial(this.scene, "vertical-slice-foundry-cliff-dark", "#172625", 0.95, 0.04);
    const metal = createMaterial(this.scene, "vertical-slice-foundry-metal", "#405a60", 0.38, 0.68);
    const glow = createMaterial(this.scene, "vertical-slice-foundry-glow", "#a9fff4", 0.12, 0.08, "#3ee2d7");
    const centerX = 475;

    const cliffMeshes: any[] = [];
    for (let index = 0; index < 34; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const row = Math.floor(index / 2);
      const z = -448 - row * 4.1;
      const corridorHalfWidth = 8.8 + row * 0.12;
      const x = centerX + side * (corridorHalfWidth + 5.8 + (row % 3) * 1.8);
      const y = this.world.heightAt(x, z);
      const rock = BABYLON.MeshBuilder.CreatePolyhedron(`vertical-slice-breach-rock-${index}`, {
        type: 1 + index % 4,
        size: 5.8 + (index % 5) * 0.8
      }, this.scene);
      rock.position = new BABYLON.Vector3(x, y + 5.3 + (index % 3), z);
      rock.scaling = new BABYLON.Vector3(1.4, 1.35 + (index % 4) * 0.2, 1.15);
      rock.rotation = new BABYLON.Vector3(index * 0.05, side * 0.38 + index * 0.27, index * 0.035);
      rock.material = index % 5 === 0 ? cliffDark : cliff;
      cliffMeshes.push(rock);
      if (row % 3 === 0) this.addCollisionBox(x, z, 7.2, 6.8, 0.6);
    }
    this.mergeStatic({ name: "vertical-slice-foundry-cliff-wall", meshes: cliffMeshes, receiveShadows: true, cameraCollision: true });

    const tunnelRoute = this.linearRoute({ x: centerX, z: -456 }, { x: centerX, z: -520 }, 22);
    this.createTerrainRibbon("vertical-slice-foundry-tunnel-floor", tunnelRoute, 6.8, cliffDark, 0.08);

    const tunnelWalls: any[] = [];
    const tunnelBeams: any[] = [];
    for (let index = 0; index < 11; index += 1) {
      const z = -462 - index * 5.7;
      const y = this.world.heightAt(centerX, z);
      for (const side of [-1, 1]) {
        const wall = BABYLON.MeshBuilder.CreateBox(`vertical-slice-tunnel-wall-${index}-${side}`, {
          width: 3.3,
          height: 9.2,
          depth: 6.2
        }, this.scene);
        wall.position = new BABYLON.Vector3(centerX + side * 8.5, y + 4.6, z);
        wall.rotation.z = side * -0.05;
        wall.material = cliff;
        tunnelWalls.push(wall);
        this.addCollisionBox(wall.position.x, z, 3.4, 6.2, 0.1);
      }
      const beam = BABYLON.MeshBuilder.CreateBox(`vertical-slice-tunnel-beam-${index}`, {
        width: 17.2,
        height: 0.8,
        depth: 0.9
      }, this.scene);
      beam.position = new BABYLON.Vector3(centerX, y + 8.7, z);
      beam.material = index % 2 === 0 ? metal : cliffDark;
      tunnelBeams.push(beam);
      if (index % 3 === 0) {
        const lamp = BABYLON.MeshBuilder.CreatePolyhedron(`vertical-slice-tunnel-lamp-${index}`, {
          type: 1,
          size: 0.42
        }, this.scene);
        lamp.position = new BABYLON.Vector3(centerX, y + 7.9, z + 0.65);
        lamp.material = glow;
      }
    }
    this.mergeStatic({ name: "vertical-slice-foundry-tunnel-walls", meshes: tunnelWalls, receiveShadows: true, cameraCollision: true });
    this.mergeStatic({ name: "vertical-slice-foundry-tunnel-beams", meshes: tunnelBeams, receiveShadows: true });

    const thresholdY = this.world.heightAt(centerX, -456);
    const threshold = BABYLON.MeshBuilder.CreateTorus("vertical-slice-foundry-threshold", {
      diameter: 17.2,
      thickness: 0.8,
      tessellation: 26,
      arc: 0.5
    }, this.scene);
    threshold.position = new BABYLON.Vector3(centerX, thresholdY + 3.9, -456);
    threshold.rotation.x = Math.PI / 2;
    threshold.rotation.z = Math.PI / 2;
    threshold.material = metal;
  }

  private buildPillarConnection(): void {
    const stone = createMaterial(this.scene, "vertical-slice-pillar-stone", "#263b3e", 0.86, 0.16);
    const metal = createMaterial(this.scene, "vertical-slice-pillar-metal", "#405a62", 0.3, 0.74);
    const dark = createMaterial(this.scene, "vertical-slice-pillar-dark", "#101d1f", 0.82, 0.22);
    const glow = createMaterial(this.scene, "vertical-slice-pillar-glow", "#b7fff5", 0.1, 0.12, "#42ebdf");
    const x = this.world.labyrinthPosition.x;
    const z = this.world.labyrinthPosition.z - 126;
    const baseY = this.world.heightAt(x, z);

    const coreToLift = this.linearRoute({ x, z: z + 19 }, { x, z }, 12);
    this.createTerrainRibbon("vertical-slice-core-to-pillar-catwalk", coreToLift, 5.5, stone, 0.12);

    const shell: any[] = [];
    const braces: any[] = [];
    const rings: any[] = [];
    for (let index = 0; index < 18; index += 1) {
      const angle = index / 18 * Math.PI * 2;
      if (Math.cos(angle) > 0.72) continue;
      const radius = 25;
      const px = x + Math.sin(angle) * radius;
      const pz = z + Math.cos(angle) * radius;
      const column = BABYLON.MeshBuilder.CreateBox(`vertical-slice-pillar-shell-${index}`, {
        width: 6.8,
        height: 126,
        depth: 4.4
      }, this.scene);
      column.position = new BABYLON.Vector3(px, baseY + 63, pz);
      column.rotation.y = angle;
      column.material = index % 3 === 0 ? metal : stone;
      shell.push(column);
      this.addCollisionBox(px, pz, 6.3, 5.2, 0.4);
    }

    for (let level = 0; level < 5; level += 1) {
      const ring = BABYLON.MeshBuilder.CreateTorus(`vertical-slice-pillar-collar-${level}`, {
        diameter: 49,
        thickness: 1.15,
        tessellation: 40
      }, this.scene);
      ring.position = new BABYLON.Vector3(x, baseY + 12 + level * 25, z);
      ring.rotation.x = Math.PI / 2;
      ring.material = level % 2 === 0 ? metal : dark;
      rings.push(ring);
    }

    for (const side of [-1, 1]) {
      const rail = BABYLON.MeshBuilder.CreateBox(`vertical-slice-lift-rail-${side}`, {
        width: 0.8,
        height: 92,
        depth: 0.8
      }, this.scene);
      rail.position = new BABYLON.Vector3(x + side * 4.3, baseY + 46, z);
      rail.material = metal;
      braces.push(rail);
      for (let index = 0; index < 8; index += 1) {
        const brace = BABYLON.MeshBuilder.CreateBox(`vertical-slice-lift-brace-${side}-${index}`, {
          width: 8.8,
          height: 0.35,
          depth: 0.45
        }, this.scene);
        brace.position = new BABYLON.Vector3(x, baseY + 7 + index * 11.5, z + side * 0.22);
        brace.rotation.z = side * 0.08;
        brace.material = dark;
        braces.push(brace);
      }
    }

    const ascentRune = BABYLON.MeshBuilder.CreateTorus("vertical-slice-pillar-ascent-rune", {
      diameter: 9,
      thickness: 0.34,
      tessellation: 32
    }, this.scene);
    ascentRune.position = new BABYLON.Vector3(x, baseY + 23, z - 24.5);
    ascentRune.rotation.x = Math.PI / 2;
    ascentRune.material = glow;

    this.mergeStatic({ name: "vertical-slice-pillar-shell", meshes: shell, receiveShadows: true, cameraCollision: true });
    this.mergeStatic({ name: "vertical-slice-pillar-braces", meshes: braces, receiveShadows: true });
    this.mergeStatic({ name: "vertical-slice-pillar-collars", meshes: rings, receiveShadows: true });
  }

  private createAmbientCitizens(): void {
    const definitions = [
      { color: "#526c82", route: [[-18, 48], [-18, 93], [18, 93], [18, 48]], speed: 1.05 },
      { color: "#6f5748", route: [[-46, 66], [-46, 126], [-20, 126], [-20, 66]], speed: 0.82 },
      { color: "#526c4d", route: [[46, 80], [46, 166], [24, 166], [24, 80]], speed: 0.96 },
      { color: "#6e5576", route: [[-82, 104], [-82, 171], [-54, 171], [-54, 104]], speed: 0.76 }
    ];
    definitions.forEach((definition, index) => {
      const visual = createMara(this.scene);
      visual.root.name = `vertical-slice-citizen-${index}`;
      visual.root.scaling.setAll(0.82 + index * 0.025);
      visual.cape.material = createMaterial(
        this.scene,
        `vertical-slice-citizen-cape-${index}`,
        definition.color,
        0.92,
        0.02
      );
      const route = definition.route.map(([x, z]) => new BABYLON.Vector3(
        x,
        this.world.heightAt(x, z),
        z
      ));
      visual.root.position.copyFrom(route[0]);
      visual.root.getChildMeshes().forEach((mesh: any) => this.world.shadowGenerator.addShadowCaster(mesh));
      this.citizens.push({
        visual,
        route,
        routeIndex: 1,
        speed: definition.speed,
        phase: index * 1.37
      });
    });
  }

  private update(delta: number): void {
    this.elapsed += delta;
    this.citizenAccumulator += delta;
    if (this.citizenAccumulator < 1 / 30) return;
    const step = this.citizenAccumulator;
    this.citizenAccumulator = 0;

    for (let index = 0; index < this.citizens.length; index += 1) {
      const citizen = this.citizens[index];
      const root = citizen.visual.root;
      const target = citizen.route[citizen.routeIndex];
      const direction = target.subtract(root.position);
      direction.y = 0;
      const distance = direction.length();
      if (distance < 0.45) {
        citizen.routeIndex = (citizen.routeIndex + 1) % citizen.route.length;
      } else {
        direction.scaleInPlace(1 / Math.max(0.001, distance));
        root.position.addInPlace(direction.scale(citizen.speed * step));
        root.position.y = this.world.heightAt(root.position.x, root.position.z);
        root.rotation.y = Math.atan2(direction.x, direction.z);
      }
      const cycle = this.elapsed * (4.2 + citizen.speed) + citizen.phase;
      const stride = distance > 0.55 ? Math.sin(cycle) * 0.3 : 0;
      citizen.visual.leftThigh.rotation.x = stride;
      citizen.visual.rightThigh.rotation.x = -stride;
      citizen.visual.leftShin.rotation.x = Math.max(0, -stride) * 0.48;
      citizen.visual.rightShin.rotation.x = Math.max(0, stride) * 0.48;
      citizen.visual.leftUpperArm.rotation.x = -stride * 0.45;
      citizen.visual.rightUpperArm.rotation.x = stride * 0.45 - 0.1;
      citizen.visual.cape.rotation.x = 0.08 + Math.sin(cycle * 0.5) * 0.035;
    }
  }

  private tuneVerticalSliceLighting(): void {
    this.scene.fogDensity = Math.min(this.scene.fogDensity, 0.00042);
    this.scene.fogColor = BABYLON.Color3.FromHexString("#789fa0");
    const fill = this.scene.getLightByName?.("foundation-fill");
    if (fill) {
      fill.intensity = 1.22;
      fill.groundColor = BABYLON.Color3.FromHexString("#485b48");
    }
    const sun = this.scene.getLightByName?.("artificial-sun");
    if (sun) sun.intensity = 2.05;

    const lights = [
      { name: "vertical-slice-gate-light", x: 0, z: 20, y: 11, color: "#9ce9d8", intensity: 0.42, range: 34 },
      { name: "vertical-slice-market-light", x: 0, z: 96, y: 8, color: "#ffd59a", intensity: 0.36, range: 42 },
      { name: "vertical-slice-breach-light", x: 475, z: -466, y: 7, color: "#78f2e6", intensity: 0.48, range: 38 }
    ];
    lights.forEach((definition) => {
      const light = new BABYLON.PointLight(
        definition.name,
        new BABYLON.Vector3(
          definition.x,
          this.world.heightAt(definition.x, definition.z) + definition.y,
          definition.z
        ),
        this.scene
      );
      light.diffuse = BABYLON.Color3.FromHexString(definition.color);
      light.intensity = definition.intensity;
      light.range = definition.range;
      light.includedOnlyMeshes = [];
    });
  }

  private createTerrainRibbon(
    name: string,
    points: RoutePoint[],
    halfWidth: number,
    material: any,
    yOffset: number
  ): any {
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    points.forEach((point, index) => {
      const previous = points[Math.max(0, index - 1)];
      const next = points[Math.min(points.length - 1, index + 1)];
      const tangent = new BABYLON.Vector3(next.x - previous.x, 0, next.z - previous.z);
      if (tangent.lengthSquared() < 0.001) tangent.z = 1;
      tangent.normalize();
      const side = new BABYLON.Vector3(-tangent.z, 0, tangent.x);
      const leftX = point.x + side.x * halfWidth;
      const leftZ = point.z + side.z * halfWidth;
      const rightX = point.x - side.x * halfWidth;
      const rightZ = point.z - side.z * halfWidth;
      positions.push(leftX, this.world.heightAt(leftX, leftZ) + yOffset, leftZ);
      positions.push(rightX, this.world.heightAt(rightX, rightZ) + yOffset, rightZ);
      uvs.push(0, index / Math.max(1, points.length - 1));
      uvs.push(1, index / Math.max(1, points.length - 1));
      if (index < points.length - 1) {
        const base = index * 2;
        indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      }
    });
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);
    const data = new BABYLON.VertexData();
    data.positions = positions;
    data.indices = indices;
    data.normals = normals;
    data.uvs = uvs;
    const mesh = new BABYLON.Mesh(name, this.scene);
    data.applyToMesh(mesh);
    mesh.material = material;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    mesh.computeWorldMatrix(true);
    mesh.freezeWorldMatrix();
    return mesh;
  }

  private mergeStatic(batch: StaticBatch): any | null {
    if (batch.meshes.length === 0) return null;
    batch.meshes.forEach((mesh) => mesh.computeWorldMatrix(true));
    const merged = BABYLON.Mesh.MergeMeshes(batch.meshes, true, true, undefined, false, false);
    if (!merged) return null;
    merged.name = batch.name;
    merged.receiveShadows = batch.receiveShadows;
    merged.metadata = batch.cameraCollision ? { cameraCollision: true } : {};
    merged.isPickable = Boolean(batch.cameraCollision);
    if (!batch.glow) this.world.glowLayer?.addExcludedMesh?.(merged);
    merged.computeWorldMatrix(true);
    merged.freezeWorldMatrix();
    return merged;
  }

  private addCollisionBox(x: number, z: number, width: number, depth: number, inset: number): void {
    const boxes = this.world.collisionBoxes as CollisionBox[];
    boxes.push({
      minX: x - width / 2 + inset,
      maxX: x + width / 2 - inset,
      minZ: z - depth / 2 + inset,
      maxZ: z + depth / 2 - inset
    });
  }

  private linearRoute(from: RoutePoint, to: RoutePoint, segments: number): RoutePoint[] {
    return Array.from({ length: segments + 1 }, (_, index) => {
      const t = index / segments;
      return { x: lerp(from.x, to.x, t), z: lerp(from.z, to.z, t) };
    });
  }

  private sampleCatmullRom(points: RoutePoint[], segmentsPerSpan: number): RoutePoint[] {
    const output: RoutePoint[] = [];
    for (let span = 0; span < points.length - 1; span += 1) {
      const p0 = points[Math.max(0, span - 1)];
      const p1 = points[span];
      const p2 = points[span + 1];
      const p3 = points[Math.min(points.length - 1, span + 2)];
      for (let step = 0; step < segmentsPerSpan; step += 1) {
        const t = step / segmentsPerSpan;
        const t2 = t * t;
        const t3 = t2 * t;
        output.push({
          x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          z: 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3)
        });
      }
    }
    output.push(points[points.length - 1]);
    return output;
  }
}
