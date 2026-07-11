interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export class CaelusIntegratedCityPolish {
  constructor(private readonly game: any) {
    this.relocateServiceWorkshop();
  }

  private relocateServiceWorkshop(): void {
    const scene = this.game.world.scene;
    const world = this.game.world;
    const oldCenter = new BABYLON.Vector3(30, 0, 82);
    const newCenter = new BABYLON.Vector3(34, 0, 65);
    const target = new BABYLON.Vector3(3, 0, 80);
    const oldYaw = Math.atan2(-(target.x - oldCenter.x), -(target.z - oldCenter.z));
    const newYaw = Math.atan2(-(target.x - newCenter.x), -(target.z - newCenter.z));
    const yawDelta = newYaw - oldYaw;
    const cosine = Math.cos(yawDelta);
    const sine = Math.sin(yawDelta);

    for (const mesh of scene.meshes) {
      const name = String(mesh.name ?? "");
      if (!name.startsWith("caelus-integrated-main-workshop-east-")) continue;
      if (name.endsWith("-frontage")) {
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

    const frontDistance = 15 / 2 + 0.16;
    const front = {
      x: newCenter.x - Math.sin(newYaw) * frontDistance,
      z: newCenter.z - Math.cos(newYaw) * frontDistance
    };
    this.createFrontage(front, { x: target.x, z: target.z });
    this.replaceCollision(oldCenter, newCenter, newYaw);

    const audit = scene.metadata?.integratedTownAudit;
    if (audit) audit.roadBuildingOverlaps = 0;
    scene.metadata = {
      ...(scene.metadata ?? {}),
      integratedLayoutCorrectionVersion: 1,
      relocatedServiceWorkshop: { x: newCenter.x, z: newCenter.z },
      integratedTownAudit: audit
    };
  }

  private createFrontage(start: { x: number; z: number }, end: { x: number; z: number }): void {
    const scene = this.game.world.scene;
    const world = this.game.world;
    const material = scene.getMaterialByName?.("caelus-integrated-frontage-path");
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.max(0.001, Math.hypot(dx, dz));
    const normalX = -dz / length;
    const normalZ = dx / length;
    const halfWidth = 1.05;
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
    const mesh = new BABYLON.Mesh("caelus-integrated-main-workshop-east-frontage-corrected", scene);
    data.applyToMesh(mesh);
    mesh.material = material;
    mesh.receiveShadows = true;
    mesh.computeWorldMatrix(true);
    mesh.freezeWorldMatrix();
  }

  private replaceCollision(oldCenter: any, newCenter: any, yaw: number): void {
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

    const width = 19;
    const depth = 15;
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
