import type { LabyrinthSave } from "../data/GameTypes.js";
import { createMaterial } from "./ProceduralAssets.js";
import type { World } from "./World.js";

interface SigilVisual {
  root: any;
  ring: any;
  crystal: any;
}

interface NavigationRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export class FoundryLabyrinth {
  public readonly entryPosition: any;
  public readonly corePosition: any;
  public readonly shortcutPosition: any;
  public readonly sigilPositions: any[];

  private readonly sigils: SigilVisual[] = [];
  private readonly coreRings: any[] = [];
  private readonly navigationRects: NavigationRect[];
  private readonly sealedGate: any;
  private readonly shortcutGate: any;
  private readonly dormantMaterial: any;
  private readonly activeMaterial: any;
  private readonly coreMaterial: any;
  private readonly originX: number;
  private readonly originZ: number;
  private elapsed = 0;

  constructor(private readonly world: World) {
    const origin = world.labyrinthPosition;
    this.originX = origin.x;
    this.originZ = origin.z;
    const baseY = world.heightAt(origin.x, origin.z);
    this.entryPosition = new BABYLON.Vector3(origin.x, baseY, origin.z - 3);
    this.sigilPositions = [
      new BABYLON.Vector3(origin.x - 25, world.heightAt(origin.x - 25, origin.z - 31), origin.z - 31),
      new BABYLON.Vector3(origin.x + 25, world.heightAt(origin.x + 25, origin.z - 31), origin.z - 31),
      new BABYLON.Vector3(origin.x, world.heightAt(origin.x, origin.z - 58), origin.z - 58)
    ];
    this.corePosition = new BABYLON.Vector3(origin.x, world.heightAt(origin.x, origin.z - 88), origin.z - 88);
    this.shortcutPosition = new BABYLON.Vector3(origin.x + 29, world.heightAt(origin.x + 29, origin.z - 78), origin.z - 78);
    this.navigationRects = [
      { minX: origin.x - 7.2, maxX: origin.x + 7.2, minZ: origin.z - 103, maxZ: origin.z - 5 },
      { minX: origin.x - 44, maxX: origin.x - 7, minZ: origin.z - 40, maxZ: origin.z - 22 },
      { minX: origin.x + 7, maxX: origin.x + 44, minZ: origin.z - 40, maxZ: origin.z - 22 },
      { minX: origin.x - 15, maxX: origin.x + 15, minZ: origin.z - 73, maxZ: origin.z - 45 },
      { minX: origin.x - 22, maxX: origin.x + 22, minZ: origin.z - 104, maxZ: origin.z - 72 },
      { minX: origin.x + 18, maxX: origin.x + 36, minZ: origin.z - 91, maxZ: origin.z - 59 }
    ];

    this.dormantMaterial = createMaterial(world.scene, "foundry-dormant-rune", "#24434b", 0.42, 0.32, "#10262d");
    this.activeMaterial = createMaterial(world.scene, "foundry-active-rune", "#8ff7f1", 0.12, 0.16, "#34e3df");
    this.coreMaterial = createMaterial(world.scene, "foundry-core-rune", "#d8fff8", 0.1, 0.2, "#55f5e8");

    this.createStructure();
    this.sealedGate = this.createGate(
      "foundry-sealed-gate",
      origin.x,
      origin.z - 10,
      world.heightAt(origin.x, origin.z - 10),
      11,
      this.dormantMaterial
    );
    this.shortcutGate = this.createGate(
      "foundry-shortcut-gate",
      this.shortcutPosition.x,
      this.shortcutPosition.z,
      this.shortcutPosition.y,
      8,
      this.dormantMaterial
    );
    this.createSigils();
    this.createCore();
  }

  public setProgress(save: LabyrinthSave): void {
    this.sealedGate.setEnabled(!save.entered);
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

  public resolvePlayerPosition(position: any, previous: any, save: LabyrinthSave): void {
    const inEnvelope = position.x >= this.originX - 48
      && position.x <= this.originX + 48
      && position.z <= this.originZ - 4
      && position.z >= this.originZ - 108;
    if (!inEnvelope) return;

    if (!save.entered && position.z < this.originZ - 9) {
      position.x = previous.x;
      position.z = previous.z;
      return;
    }

    const insideWalkableSpace = this.navigationRects.some((rect) => this.isInsideRect(position.x, position.z, rect));
    if (!insideWalkableSpace) {
      position.x = previous.x;
      position.z = previous.z;
      return;
    }

    const insideShortcut = position.x > this.originX + 18
      && position.z < this.originZ - 59
      && position.z > this.originZ - 91;
    if (insideShortcut && !save.shortcutOpened) {
      position.x = previous.x;
      position.z = previous.z;
    }
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
  }

  private createStructure(): void {
    const stone = createMaterial(this.world.scene, "foundry-labyrinth-stone", "#283b40", 0.82, 0.24);
    const darkStone = createMaterial(this.world.scene, "foundry-labyrinth-shadow", "#111c20", 0.9, 0.12);
    const metal = createMaterial(this.world.scene, "foundry-labyrinth-metal", "#3d555b", 0.34, 0.72);
    const origin = this.world.labyrinthPosition;

    this.createHall(origin.x, origin.z - 31, 15, 56, stone, darkStone, metal);
    this.createHall(origin.x - 25, origin.z - 31, 34, 18, stone, darkStone, metal);
    this.createHall(origin.x + 25, origin.z - 31, 34, 18, stone, darkStone, metal);
    this.createHall(origin.x, origin.z - 58, 30, 26, stone, darkStone, metal);
    this.createHall(origin.x, origin.z - 86, 42, 30, stone, darkStone, metal);
    this.createHall(origin.x + 27, origin.z - 75, 16, 30, stone, darkStone, metal);

    const pathPoints = [
      [origin.x, origin.z - 18],
      [origin.x, origin.z - 36],
      [origin.x, origin.z - 56],
      [origin.x, origin.z - 76],
      [origin.x, origin.z - 92]
    ];
    pathPoints.forEach(([x, z], index) => {
      const rune = BABYLON.MeshBuilder.CreateBox(`foundry-path-rune-${index}`, {
        width: 1.4,
        height: 0.08,
        depth: 3.6
      }, this.world.scene);
      rune.position = new BABYLON.Vector3(x, this.world.heightAt(x, z) + 0.08, z);
      rune.material = this.dormantMaterial;
      rune.rotation.y = index % 2 === 0 ? 0.1 : -0.1;
    });

    for (let index = 0; index < 12; index += 1) {
      const z = origin.z - 18 - index * 6.2;
      const xOffset = index % 2 === 0 ? -7.2 : 7.2;
      const support = BABYLON.MeshBuilder.CreateBox(`foundry-support-${index}`, {
        width: 1.3,
        height: 7.2,
        depth: 1.3
      }, this.world.scene);
      support.position = new BABYLON.Vector3(origin.x + xOffset, this.world.heightAt(origin.x + xOffset, z) + 3.6, z);
      support.material = metal;
      support.rotation.z = (index % 2 === 0 ? 1 : -1) * 0.04;
      this.world.shadowGenerator.addShadowCaster(support);
    }
  }

  private createHall(
    x: number,
    z: number,
    width: number,
    depth: number,
    stone: any,
    darkStone: any,
    metal: any
  ): void {
    const y = this.world.heightAt(x, z);
    const floor = BABYLON.MeshBuilder.CreateBox(`foundry-floor-${x}-${z}`, {
      width,
      height: 0.55,
      depth
    }, this.world.scene);
    floor.position = new BABYLON.Vector3(x, y - 0.28, z);
    floor.material = stone;
    floor.receiveShadows = true;

    const sideOffset = width / 2;
    [-1, 1].forEach((side) => {
      const wall = BABYLON.MeshBuilder.CreateBox(`foundry-wall-${x}-${z}-${side}`, {
        width: 1.1,
        height: 6.8,
        depth
      }, this.world.scene);
      wall.position = new BABYLON.Vector3(x + side * sideOffset, y + 3.15, z);
      wall.material = darkStone;
      wall.receiveShadows = true;
      wall.metadata = { cameraCollision: true };
      this.world.shadowGenerator.addShadowCaster(wall);
    });

    const ribCount = Math.max(2, Math.floor(depth / 8));
    for (let index = 0; index < ribCount; index += 1) {
      const fraction = ribCount === 1 ? 0.5 : index / (ribCount - 1);
      const ribZ = z - depth / 2 + fraction * depth;
      const rib = BABYLON.MeshBuilder.CreateTorus(`foundry-rib-${x}-${z}-${index}`, {
        diameter: Math.max(7, width - 1.5),
        thickness: 0.34,
        tessellation: 18,
        arc: 0.5
      }, this.world.scene);
      rib.position = new BABYLON.Vector3(x, this.world.heightAt(x, ribZ) + 2.7, ribZ);
      rib.rotation.x = Math.PI / 2;
      rib.rotation.z = Math.PI / 2;
      rib.material = metal;
      this.world.shadowGenerator.addShadowCaster(rib);
    }
  }

  private createSigils(): void {
    this.sigilPositions.forEach((position, index) => {
      const root = new BABYLON.TransformNode(`foundry-sigil-root-${index}`, this.world.scene);
      root.position = position.add(new BABYLON.Vector3(0, 0.15, 0));

      const dais = BABYLON.MeshBuilder.CreateCylinder(`foundry-sigil-dais-${index}`, {
        height: 0.7,
        diameterTop: 4.2,
        diameterBottom: 5.4,
        tessellation: 8
      }, this.world.scene);
      dais.position.y = 0.35;
      dais.material = createMaterial(this.world.scene, `foundry-sigil-stone-${index}`, "#334a50", 0.82, 0.14);
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
    base.material = createMaterial(this.world.scene, "foundry-core-base-material", "#31464c", 0.72, 0.28);
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

  private createGate(name: string, x: number, z: number, y: number, width: number, material: any): any {
    const gate = new BABYLON.TransformNode(name, this.world.scene);
    gate.position = new BABYLON.Vector3(x, y, z);
    for (let index = 0; index < 7; index += 1) {
      const bar = BABYLON.MeshBuilder.CreateBox(`${name}-bar-${index}`, {
        width: 0.45,
        height: 6.2,
        depth: 0.45
      }, this.world.scene);
      bar.position = new BABYLON.Vector3(-width / 2 + (index / 6) * width, 3.1, 0);
      bar.material = material;
      bar.parent = gate;
      this.world.shadowGenerator.addShadowCaster(bar);
    }
    return gate;
  }

  private isInsideRect(x: number, z: number, rect: NavigationRect): boolean {
    return x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ;
  }
}
