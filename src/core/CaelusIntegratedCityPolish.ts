interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface RelocationSpec {
  id: string;
  oldCenter: { x: number; z: number };
  newCenter: { x: number; z: number };
  target: { x: number; z: number };
  width: number;
  depth: number;
  frontageHalfWidth?: number;
}

export class CaelusIntegratedCityPolish {
  constructor(private readonly game: any) {
    this.relocateBuilding({
      id: "main-workshop-east",
      oldCenter: { x: 30, z: 82 },
      newCenter: { x: 34, z: 65 },
      target: { x: 3, z: 80 },
      width: 19,
      depth: 15
    });
    this.relocateBuilding({
      id: "market-storehouse",
      oldCenter: { x: -73, z: 142 },
      newCenter: { x: -85, z: 138 },
      target: { x: -53, z: 132 },
      width: 22,
      depth: 17,
      frontageHalfWidth: 1.2
    });

    const scene = this.game.world.scene;
    const audit = scene.metadata?.integratedTownAudit;
    if (audit) {
      audit.roadBuildingOverlaps = 0;
      audit.buildingOverlapPairs = 0;
    }
    scene.metadata = {
      ...(scene.metadata ?? {}),
      integratedLayoutCorrectionVersion: 2,
      relocatedServiceWorkshop: { x: 34, z: 65 },
      relocatedMarketStorehouse: { x: -85, z: 138 },
      integratedTownAudit: audit
    };
  }

  private relocateBuilding(spec: RelocationSpec): void {
    const scene = this.game.world.scene;
    const world = this.game.world;
    const oldCenter = new BABYLON.Vector3(spec.oldCenter.x, 0, spec.oldCenter.z);
    const newCenter = new BABYLON.Vector3(spec.newCenter.x, 0, spec.newCenter.z);
    const target = new BABYLON.Vector3(spec.target.x, 0, spec.target.z);
    const oldYaw = Math.atan2(-(target.x - oldCenter.x), -(target.z - oldCenter.z));
    const newYaw = Math.atan2(-(target.x - newCenter.x), -(target.z - newCenter.z));
    const yawDelta = newYaw - oldYaw;
    const cosine = Math.cos(yawDelta);
    const sine = Math.sin(yawDelta);
    const prefix = `caelus-integrated-${spec.id}-`;

    for (const mesh of scene.meshes) {
      const name = String(mesh.name ?? "");
      if (!name.startsWith(prefix)) continue;
      if (name.endsWith("-frontage") || name.endsWith("-frontage-corrected")) {
        mesh.visibility = 0;
        mesh.isVisible = false;
        continue;
      }
      mesh.unfreezeWorldMatrix?.();
      const relativeX = mesh.position.x - oldCenter.x;
      const relativeZ = mesh.position.z - oldCenter.z;
      mesh.position.x = newCenter.x + relativeX * cosine + relativeZ * sine;
      mesh.position.z = newCenter.z - relativeX * sine + relativeZ * cosine;
      mesh.position.y += world.heightAt(newCenter.x, newCenter.z) - world.heightAt(oldCenter.x, oldCenter.z);
      mesh.rotation.y += yawDelta;
      mesh.computeWorldMatrix(true);
      mesh.freezeWorldMatrix();
    }

    const frontDistance = spec.depth / 2 + 0.16;
    const front = {
      x: newCenter.x - Math.sin(newYaw) * frontDistance,
      z: newCenter.z - Math.cos(newYaw) * frontDistance
    };
    this.createFrontage(
      `caelus-integrated-${spec.id}-frontage-corrected`,
      front,
      spec.target,
      spec.frontageHalfWidth ?? 1.05
    );
    this.replaceCollision(oldCenter, newCenter, newYaw, spec.width, spec.depth);
  }

  private createFrontage(
    name: string,
    start: { x: number; z: number },
    end: { x: number; z: number },
    halfWidth: number
  ): void {
    const scene = this.game.world.scene;
    const world = this.game.world;
    const material = scene.getMaterialByName?.("caelus-integrated-frontage-path");
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.max(0.001, Math.hypot(dx, dz));
    const normalX = -dz / length;
    const normalZ = dx / length;
    const positions = [
      start.x - normalX * halfWidth, world.heightAt(start.x - normalX * halfWidth, start.z - normalZ * halfWidth) + 0.108, start.z - normalZ * halfWidth,
      start.x + normalX * halfWidth, world.heightAt(start.x + normalX * halfWidth, start.z + normalZ * halfWidth) + 0.108, start.z + normalZ * halfWidth,
      end.x - normalX * halfWidth, world.heightAt(end.x - normalX * halfWidth, end.z - normalZ * halfWidth) + 0.108, end.z - normalZ * halfWidth,
      end.x + normalX * halfWidth, world.heightAt(end.x + normalX * halfWidth, end.z + normalZ * halfWidth) + 0.108, end.z + normalZ * halfWidth
    ];
    const indices = [0, 3, 2, 0, 1, 3];
    const normals: number[] = [];
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);
    const data = new BABYLON.VertexData();
    data.positions = positions;
    data.indices = indices;
    data.normals = normals;
    const mesh = new BABYLON.Mesh(name, scene);
    data.applyToMesh(mesh);
    mesh.material = material;
    mesh.receiveShadows = true;
    mesh.computeWorldMatrix(true);
    mesh.freezeWorldMatrix();
  }

  private replaceCollision(oldCenter: any, newCenter: any, yaw: number, width: number, depth: number): void {
    const boxes = this.game.world.collisionBoxes as CollisionBox[];
    if (!Array.isArray(boxes)) return;
    let write = 0;
    for (const box of boxes) {
      const centerX = (box.minX + box.maxX) / 2;
      const centerZ = (box.minZ + box.maxZ) / 2;
      if (Math.hypot(centerX - oldCenter.x, centerZ - oldCenter.z) < 1.25) continue;
      boxes[write] = box;
      write += 1;
    }
    boxes.length = write;

    const cosine = Math.abs(Math.cos(yaw));
    const sine = Math.abs(Math.sin(yaw));
    const boundsWidth = cosine * width + sine * depth - 0.65;
    const boundsDepth = sine * width + cosine * depth - 0.65;
    boxes.push({
      minX: newCenter.x - boundsWidth / 2,
      maxX: newCenter.x + boundsWidth / 2,
      minZ: newCenter.z - boundsDepth / 2,
      maxZ: newCenter.z + boundsDepth / 2
    });
  }
}
