import type { LabyrinthSave } from "../data/GameTypes.js";
import { createMaterial } from "./ProceduralAssets.js";
import type { World } from "./World.js";

interface SigilVisual {
  root: any;
  ring: any;
  crystal: any;
}

export class FoundryLabyrinth {
  public readonly entryPosition: any;
  public readonly corePosition: any;
  public readonly shortcutPosition: any;
  public readonly sigilPositions: any[];

  private readonly sigils: SigilVisual[] = [];
  private readonly coreRings: any[] = [];
  private readonly sealedGate: any;
  private readonly coreGate: any;
  private readonly shortcutGate: any;
  private readonly dormantMaterial: any;
  private readonly activeMaterial: any;
  private readonly coreMaterial: any;
  private currentProgress: LabyrinthSave;
  private lastPlayerPosition: any = null;
  private elapsed = 0;

  constructor(private readonly world: World) {
    const origin = world.labyrinthPosition;
    this.entryPosition = new BABYLON.Vector3(
      origin.x,
      world.heightAt(origin.x, origin.z + 12),
      origin.z + 12
    );
    this.sigilPositions = [
      new BABYLON.Vector3(origin.x - 24, world.heightAt(origin.x - 24, origin.z - 52), origin.z - 52),
      new BABYLON.Vector3(origin.x + 24, world.heightAt(origin.x + 24, origin.z - 52), origin.z - 52),
      new BABYLON.Vector3(origin.x, world.heightAt(origin.x, origin.z - 78), origin.z - 78)
    ];
    this.corePosition = new BABYLON.Vector3(
      origin.x,
      world.heightAt(origin.x, origin.z - 112),
      origin.z - 112
    );
    this.shortcutPosition = new BABYLON.Vector3(
      origin.x + 33,
      world.heightAt(origin.x + 33, origin.z - 102),
      origin.z - 102
    );

    this.currentProgress = {
      unlocked: false,
      entered: false,
      sigilsActivated: [false, false, false],
      sentinelDefeated: false,
      coreRestored: false,
      shortcutOpened: false
    };

    this.dormantMaterial = createMaterial(
      world.scene,
      "foundry-dormant-rune",
      "#29474c",
      0.42,
      0.32,
      "#122b30"
    );
    this.activeMaterial = createMaterial(
      world.scene,
      "foundry-active-rune",
      "#8ff7f1",
      0.12,
      0.16,
      "#34e3df"
    );
    this.coreMaterial = createMaterial(
      world.scene,
      "foundry-core-rune",
      "#d8fff8",
      0.1,
      0.2,
      "#55f5e8"
    );

    this.createStructure();
    this.sealedGate = this.createGate(
      "foundry-sealed-gate",
      origin.x,
      origin.z - 18,
      world.heightAt(origin.x, origin.z - 18),
      13,
      this.dormantMaterial
    );
    this.coreGate = this.createGate(
      "foundry-core-gate",
      origin.x,
      origin.z - 91,
      world.heightAt(origin.x, origin.z - 91),
      15,
      this.dormantMaterial
    );
    this.shortcutGate = this.createGate(
      "foundry-shortcut-gate",
      this.shortcutPosition.x,
      this.shortcutPosition.z,
      this.shortcutPosition.y,
      9,
      this.dormantMaterial
    );
    this.createSigils();
    this.createCore();
  }

  public setProgress(save: LabyrinthSave): void {
    this.currentProgress = {
      ...save,
      sigilsActivated: [...save.sigilsActivated]
    };
    this.sealedGate.setEnabled(!save.entered);
    this.coreGate.setEnabled(!save.sigilsActivated.every(Boolean));
    this.shortcutGate.setEnabled(!save.shortcutOpened);

    this.sigils.forEach((sigil, index) => {
      const active = save.sigilsActivated[index] ?? false;
      sigil.ring.material = active ? this.activeMaterial : this.dormantMaterial;
      sigil.crystal.material = active ? this.activeMaterial : this.dormantMaterial;
      sigil.root.scaling.setAll(active ? 1.08 : 1);
    });

    this.coreRings.forEach((ring) => {
      ring.material = save.coreRestored ? this.coreMaterial : this.dormantMaterial;
    });
  }

  public update(delta: number): void {
    this.elapsed += delta;
    this.sigils.forEach((sigil, index) => {
      sigil.ring.rotation.y += delta * (index % 2 === 0 ? 0.65 : -0.65);
      const pulse = 1 + Math.sin(this.elapsed * 2.8 + index * 1.7) * 0.045;
      sigil.crystal.scaling.setAll(pulse);
    });
    this.coreRings.forEach((ring, index) => {
      ring.rotation.y += delta * (index % 2 === 0 ? 0.4 : -0.52);
      ring.rotation.z += delta * 0.08 * (index + 1);
    });
    this.resolveVisibleGates();
  }

  private resolveVisibleGates(): void {
    const player = this.world.scene.getTransformNodeByName("warden-root");
    if (!player) return;
    if (!this.lastPlayerPosition) {
      this.lastPlayerPosition = player.position.clone();
      return;
    }

    const origin = this.world.labyrinthPosition;
    const crossedEntryGate = !this.currentProgress.entered
      && Math.abs(player.position.x - origin.x) < 7.2
      && player.position.z < origin.z - 15
      && this.lastPlayerPosition.z >= origin.z - 15;
    const crossedCoreGate = !this.currentProgress.sigilsActivated.every(Boolean)
      && Math.abs(player.position.x - origin.x) < 8.2
      && player.position.z < origin.z - 88
      && this.lastPlayerPosition.z >= origin.z - 88;

    if (crossedEntryGate || crossedCoreGate) {
      player.position.copyFrom(this.lastPlayerPosition);
    }
    this.lastPlayerPosition.copyFrom(player.position);
  }

  private createStructure(): void {
    const stone = createMaterial(this.world.scene, "foundry-labyrinth-stone", "#33494c", 0.84, 0.2);
    const darkStone = createMaterial(this.world.scene, "foundry-labyrinth-shadow", "#182527", 0.9, 0.12);
    const metal = createMaterial(this.world.scene, "foundry-labyrinth-metal", "#496066", 0.34, 0.72);
    const origin = this.world.labyrinthPosition;

    const spine = [
      new BABYLON.Vector3(origin.x, 0, origin.z + 8),
      new BABYLON.Vector3(origin.x, 0, origin.z - 20),
      new BABYLON.Vector3(origin.x, 0, origin.z - 48),
      new BABYLON.Vector3(origin.x, 0, origin.z - 78),
      new BABYLON.Vector3(origin.x, 0, origin.z - 114)
    ];
    this.createFloorRibbon("foundry-spine-floor", spine, 8.4, stone);

    const leftBranch = [
      new BABYLON.Vector3(origin.x, 0, origin.z - 48),
      new BABYLON.Vector3(origin.x - 14, 0, origin.z - 52),
      new BABYLON.Vector3(origin.x - 27, 0, origin.z - 52)
    ];
    const rightBranch = [
      new BABYLON.Vector3(origin.x, 0, origin.z - 48),
      new BABYLON.Vector3(origin.x + 14, 0, origin.z - 52),
      new BABYLON.Vector3(origin.x + 27, 0, origin.z - 52)
    ];
    this.createFloorRibbon("foundry-left-branch", leftBranch, 6.7, stone);
    this.createFloorRibbon("foundry-right-branch", rightBranch, 6.7, stone);

    const arena = BABYLON.MeshBuilder.CreateCylinder("foundry-core-arena", {
      height: 0.6,
      diameter: 42,
      tessellation: 32
    }, this.world.scene);
    arena.position = new BABYLON.Vector3(
      origin.x,
      this.world.heightAt(origin.x, origin.z - 112) - 0.22,
      origin.z - 112
    );
    arena.material = stone;
    arena.receiveShadows = true;

    for (let index = 0; index < 24; index += 1) {
      const z = origin.z + 5 - index * 5.2;
      const y = this.world.heightAt(origin.x, z);
      const side = index % 2 === 0 ? -1 : 1;
      const support = BABYLON.MeshBuilder.CreateBox(`foundry-support-${index}`, {
        width: 1.25,
        height: 7.4,
        depth: 1.25
      }, this.world.scene);
      support.position = new BABYLON.Vector3(origin.x + side * 8.2, y + 3.7, z);
      support.material = metal;
      support.rotation.z = side * 0.035;
      this.world.shadowGenerator.addShadowCaster(support);

      if (index % 2 === 0) {
        const arch = BABYLON.MeshBuilder.CreateTorus(`foundry-arch-${index}`, {
          diameter: 16.5,
          thickness: 0.42,
          tessellation: 22,
          arc: 0.5
        }, this.world.scene);
        arch.position = new BABYLON.Vector3(origin.x, y + 3.1, z);
        arch.rotation.x = Math.PI / 2;
        arch.rotation.z = Math.PI / 2;
        arch.material = darkStone;
        this.world.shadowGenerator.addShadowCaster(arch);
      }
    }

    const chamberCenters = [
      [origin.x - 24, origin.z - 52],
      [origin.x + 24, origin.z - 52],
      [origin.x, origin.z - 78]
    ];
    chamberCenters.forEach(([x, z], index) => {
      const chamber = BABYLON.MeshBuilder.CreateCylinder(`foundry-relay-chamber-${index}`, {
        height: 0.55,
        diameter: index === 2 ? 24 : 20,
        tessellation: 24
      }, this.world.scene);
      chamber.position = new BABYLON.Vector3(x, this.world.heightAt(x, z) - 0.2, z);
      chamber.material = stone;
      chamber.receiveShadows = true;
      for (let pillarIndex = 0; pillarIndex < 6; pillarIndex += 1) {
        const angle = pillarIndex / 6 * Math.PI * 2;
        const radius = index === 2 ? 10 : 8;
        const pillar = BABYLON.MeshBuilder.CreateCylinder(
          `foundry-chamber-pillar-${index}-${pillarIndex}`,
          { height: 6.2, diameter: 0.9, tessellation: 8 },
          this.world.scene
        );
        const px = x + Math.cos(angle) * radius;
        const pz = z + Math.sin(angle) * radius;
        pillar.position = new BABYLON.Vector3(px, this.world.heightAt(px, pz) + 3.1, pz);
        pillar.material = metal;
        this.world.shadowGenerator.addShadowCaster(pillar);
      }
    });

    for (let index = 0; index < 20; index += 1) {
      const angle = index / 20 * Math.PI * 2;
      const radius = 22;
      const wall = BABYLON.MeshBuilder.CreateBox(`foundry-arena-wall-${index}`, {
        width: 7.4,
        height: 8,
        depth: 1.4
      }, this.world.scene);
      const x = origin.x + Math.sin(angle) * radius;
      const z = origin.z - 112 + Math.cos(angle) * radius;
      wall.position = new BABYLON.Vector3(x, this.world.heightAt(x, z) + 4, z);
      wall.rotation.y = angle;
      wall.material = darkStone;
      wall.receiveShadows = true;
      this.world.shadowGenerator.addShadowCaster(wall);
    }
  }

  private createFloorRibbon(name: string, points: any[], halfWidth: number, material: any): any {
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
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
      positions.push(leftX, this.world.heightAt(leftX, leftZ) + 0.08, leftZ);
      positions.push(rightX, this.world.heightAt(rightX, rightZ) + 0.08, rightZ);
      if (index < points.length - 1) {
        const base = index * 2;
        indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      }
    });
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);
    const mesh = new BABYLON.Mesh(name, this.world.scene);
    const data = new BABYLON.VertexData();
    data.positions = positions;
    data.indices = indices;
    data.normals = normals;
    data.applyToMesh(mesh, true);
    mesh.material = material;
    mesh.receiveShadows = true;
    return mesh;
  }

  private createSigils(): void {
    this.sigilPositions.forEach((position, index) => {
      const root = new BABYLON.TransformNode(`foundry-sigil-root-${index}`, this.world.scene);
      root.position = position.add(new BABYLON.Vector3(0, 0.15, 0));

      const dais = BABYLON.MeshBuilder.CreateCylinder(`foundry-sigil-dais-${index}`, {
        height: 0.7,
        diameterTop: 4.2,
        diameterBottom: 5.4,
        tessellation: 10
      }, this.world.scene);
      dais.position.y = 0.35;
      dais.material = createMaterial(
        this.world.scene,
        `foundry-sigil-stone-${index}`,
        "#3b5154",
        0.82,
        0.14
      );
      dais.parent = root;
      dais.receiveShadows = true;

      const ring = BABYLON.MeshBuilder.CreateTorus(`foundry-sigil-ring-${index}`, {
        diameter: 3.4,
        thickness: 0.16,
        tessellation: 20
      }, this.world.scene);
      ring.position.y = 1.3;
      ring.rotation.x = Math.PI / 2;
      ring.material = this.dormantMaterial;
      ring.parent = root;

      const crystal = BABYLON.MeshBuilder.CreatePolyhedron(`foundry-sigil-crystal-${index}`, {
        type: 1,
        size: 0.95
      }, this.world.scene);
      crystal.position.y = 1.35;
      crystal.scaling.y = 1.7;
      crystal.material = this.dormantMaterial;
      crystal.parent = root;
      this.world.shadowGenerator.addShadowCaster(crystal);

      this.sigils.push({ root, ring, crystal });
    });
  }

  private createCore(): void {
    const root = new BABYLON.TransformNode("foundry-core-root", this.world.scene);
    root.position = this.corePosition.add(new BABYLON.Vector3(0, 0.2, 0));

    const base = BABYLON.MeshBuilder.CreateCylinder("foundry-core-base", {
      height: 1.3,
      diameterTop: 7.5,
      diameterBottom: 9.5,
      tessellation: 12
    }, this.world.scene);
    base.position.y = 0.65;
    base.material = createMaterial(
      this.world.scene,
      "foundry-core-base-material",
      "#3a5054",
      0.72,
      0.28
    );
    base.parent = root;
    base.receiveShadows = true;

    const core = BABYLON.MeshBuilder.CreatePolyhedron("foundry-pillar-core", {
      type: 2,
      size: 2.5
    }, this.world.scene);
    core.position.y = 3.1;
    core.scaling.y = 1.8;
    core.material = this.coreMaterial;
    core.parent = root;
    this.world.shadowGenerator.addShadowCaster(core);

    [4.8, 6.5, 8.2].forEach((diameter, index) => {
      const ring = BABYLON.MeshBuilder.CreateTorus(`foundry-core-ring-${index}`, {
        diameter,
        thickness: 0.18,
        tessellation: 28
      }, this.world.scene);
      ring.position.y = 3.1;
      ring.rotation = new BABYLON.Vector3(index * 0.55, index * 0.78, index * 0.31);
      ring.material = this.dormantMaterial;
      ring.parent = root;
      this.coreRings.push(ring);
    });
  }

  private createGate(
    name: string,
    x: number,
    z: number,
    y: number,
    width: number,
    material: any
  ): any {
    const gate = new BABYLON.TransformNode(name, this.world.scene);
    gate.position = new BABYLON.Vector3(x, y, z);
    for (let index = 0; index < 9; index += 1) {
      const bar = BABYLON.MeshBuilder.CreateBox(`${name}-bar-${index}`, {
        width: 0.38,
        height: 6.4,
        depth: 0.48
      }, this.world.scene);
      bar.position = new BABYLON.Vector3(-width / 2 + (index / 8) * width, 3.2, 0);
      bar.material = material;
      bar.parent = gate;
      this.world.shadowGenerator.addShadowCaster(bar);
    }
    const crossbar = BABYLON.MeshBuilder.CreateBox(`${name}-crossbar`, {
      width: width + 1,
      height: 0.55,
      depth: 0.65
    }, this.world.scene);
    crossbar.position.y = 5.5;
    crossbar.material = material;
    crossbar.parent = gate;
    this.world.shadowGenerator.addShadowCaster(crossbar);
    return gate;
  }
}
