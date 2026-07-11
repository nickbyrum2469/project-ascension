import { makeMaterial } from "./CaelusTownRefinementShared.js";

export interface HouseWindowResult {
  convertedHouseCount: number;
  transparentWindowPaneCount: number;
}

interface Opening {
  type: "window" | "door";
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface ShellBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  frontSign: number;
}

export class CaelusTownHouseRefiner {
  private readonly scene: any;

  constructor(private readonly game: any, private readonly generated: any[]) {
    this.scene = game.world.scene;
  }

  public convertHouseWindows(): HouseWindowResult {
    const frameMaterial = this.scene.getMaterialByName?.("caelus-reference-timber")
      ?? makeMaterial(this.scene, "caelus-refined-window-frame", "#4c3c31");
    const glassMaterial = makeMaterial(this.scene, "caelus-refined-house-glass", "#b2d9dd", {
      alpha: 0.26,
      metallic: 0.32
    });
    glassMaterial.needDepthPrePass = true;

    let convertedHouseCount = 0;
    let transparentWindowPaneCount = 0;
    const bodies = (this.scene.meshes as any[]).filter((mesh) => (
      mesh.isEnabled?.()
      && String(mesh.name ?? "").startsWith("caelus-reference-house-")
      && String(mesh.name ?? "").endsWith("-body")
    ));

    for (const body of bodies) {
      body.computeWorldMatrix?.(true);
      const bodyBox = body.getBoundingInfo?.().boundingBox;
      const minimum = bodyBox?.minimumWorld;
      const maximum = bodyBox?.maximumWorld;
      if (!minimum || !maximum) continue;
      const houseId = String(body.name).replace("caelus-reference-house-", "").replace(/-body$/, "");
      const door = this.scene.getMeshByName?.(`caelus-reference-house-${houseId}-door`);
      const windows = (this.scene.meshes as any[]).filter((mesh) => (
        mesh.isEnabled?.() && String(mesh.name ?? "").startsWith(`caelus-reference-house-${houseId}-window-`)
      ));
      if (!door || windows.length !== 2) continue;
      door.computeWorldMatrix?.(true);
      windows.forEach((window) => window.computeWorldMatrix?.(true));

      const minX = Number(minimum.x);
      const maxX = Number(maximum.x);
      const minY = Number(minimum.y);
      const maxY = Number(maximum.y);
      const minZ = Number(minimum.z);
      const maxZ = Number(maximum.z);
      const centerZ = (minZ + maxZ) * 0.5;
      const doorCenter = door.getBoundingInfo?.().boundingBox?.centerWorld ?? door.position;
      const frontSign = Number(doorCenter.z) >= centerZ ? 1 : -1;
      const wallMaterial = body.material;

      body.setEnabled?.(false);
      body.isVisible = false;
      body.isPickable = false;
      body.metadata = { ...(body.metadata ?? {}), replacedWithWindowReadyShell: true };
      windows.forEach((window) => {
        window.setEnabled?.(false);
        window.isVisible = false;
        window.isPickable = false;
        window.metadata = { ...(window.metadata ?? {}), replacedWithTransparentPane: true };
      });

      const windowOpenings: Opening[] = windows.map((window) => {
        const box = window.getBoundingInfo?.().boundingBox;
        return {
          type: "window" as const,
          minX: Number(box.minimumWorld.x),
          maxX: Number(box.maximumWorld.x),
          minY: Number(box.minimumWorld.y),
          maxY: Number(box.maximumWorld.y)
        };
      });
      const doorBox = door.getBoundingInfo?.().boundingBox;
      const openings: Opening[] = [
        ...windowOpenings,
        {
          type: "door" as const,
          minX: Number(doorBox.minimumWorld.x),
          maxX: Number(doorBox.maximumWorld.x),
          minY,
          maxY: Number(doorBox.maximumWorld.y)
        }
      ].sort((a, b) => a.minX - b.minX);

      this.createWallShell(
        `caelus-refined-house-${houseId}`,
        { minX, maxX, minY, maxY, minZ, maxZ, frontSign },
        openings,
        wallMaterial,
        frameMaterial,
        glassMaterial,
        { buildingId: houseId, futureInteriorShell: true }
      );
      convertedHouseCount += 1;
      transparentWindowPaneCount += windowOpenings.length;
    }

    glassMaterial.freeze?.();
    return { convertedHouseCount, transparentWindowPaneCount };
  }

  public createWallShell(
    prefix: string,
    bounds: ShellBounds,
    openings: Opening[],
    wallMaterial: any,
    frameMaterial: any,
    glassMaterial: any,
    metadata: Record<string, unknown>
  ): void {
    const thickness = 0.36;
    const frontZ = bounds.frontSign > 0 ? bounds.maxZ : bounds.minZ;
    const backZ = bounds.frontSign > 0 ? bounds.minZ : bounds.maxZ;
    const frontCenterZ = frontZ - bounds.frontSign * thickness * 0.5;
    const backCenterZ = backZ + bounds.frontSign * thickness * 0.5;

    this.createPanel(`${prefix}-wall-left`, bounds.minX, bounds.minX + thickness, bounds.minY, bounds.maxY, bounds.minZ, bounds.maxZ, wallMaterial, metadata);
    this.createPanel(`${prefix}-wall-right`, bounds.maxX - thickness, bounds.maxX, bounds.minY, bounds.maxY, bounds.minZ, bounds.maxZ, wallMaterial, metadata);
    this.createPanel(
      `${prefix}-wall-back`,
      bounds.minX + thickness,
      bounds.maxX - thickness,
      bounds.minY,
      bounds.maxY,
      backCenterZ - thickness * 0.5,
      backCenterZ + thickness * 0.5,
      wallMaterial,
      metadata
    );

    let cursor = bounds.minX + thickness;
    for (const opening of openings) {
      if (opening.minX > cursor + 0.04) {
        this.createPanel(
          `${prefix}-wall-front-gap-${cursor.toFixed(2)}`,
          cursor,
          opening.minX,
          bounds.minY,
          bounds.maxY,
          frontCenterZ - thickness * 0.5,
          frontCenterZ + thickness * 0.5,
          wallMaterial,
          metadata
        );
      }
      if (opening.minY > bounds.minY + 0.04) {
        this.createPanel(
          `${prefix}-wall-front-lower-${opening.minX.toFixed(2)}`,
          opening.minX,
          opening.maxX,
          bounds.minY,
          opening.minY,
          frontCenterZ - thickness * 0.5,
          frontCenterZ + thickness * 0.5,
          wallMaterial,
          metadata
        );
      }
      if (opening.maxY < bounds.maxY - 0.04) {
        this.createPanel(
          `${prefix}-wall-front-upper-${opening.minX.toFixed(2)}`,
          opening.minX,
          opening.maxX,
          opening.maxY,
          bounds.maxY,
          frontCenterZ - thickness * 0.5,
          frontCenterZ + thickness * 0.5,
          wallMaterial,
          metadata
        );
      }
      if (opening.type === "window") {
        const glassZ = frontZ + bounds.frontSign * 0.035;
        const pane = this.createPanel(
          `${prefix}-glass-${opening.minX.toFixed(2)}`,
          opening.minX + 0.08,
          opening.maxX - 0.08,
          opening.minY + 0.08,
          opening.maxY - 0.08,
          glassZ - 0.04,
          glassZ + 0.04,
          glassMaterial,
          { ...metadata, transparentWindowPane: true }
        );
        pane.receiveShadows = false;
        this.createWindowFrame(prefix, opening, glassZ, frameMaterial, metadata);
      }
      cursor = Math.max(cursor, opening.maxX);
    }
    if (cursor < bounds.maxX - thickness - 0.04) {
      this.createPanel(
        `${prefix}-wall-front-final`,
        cursor,
        bounds.maxX - thickness,
        bounds.minY,
        bounds.maxY,
        frontCenterZ - thickness * 0.5,
        frontCenterZ + thickness * 0.5,
        wallMaterial,
        metadata
      );
    }
  }

  private createWindowFrame(
    prefix: string,
    opening: Opening,
    z: number,
    material: any,
    metadata: Record<string, unknown>
  ): void {
    const bar = 0.13;
    const depth = 0.12;
    const centerX = (opening.minX + opening.maxX) * 0.5;
    const centerY = (opening.minY + opening.maxY) * 0.5;
    this.createPanel(`${prefix}-frame-left-${centerX.toFixed(2)}`, opening.minX, opening.minX + bar, opening.minY, opening.maxY, z - depth * 0.5, z + depth * 0.5, material, metadata);
    this.createPanel(`${prefix}-frame-right-${centerX.toFixed(2)}`, opening.maxX - bar, opening.maxX, opening.minY, opening.maxY, z - depth * 0.5, z + depth * 0.5, material, metadata);
    this.createPanel(`${prefix}-frame-top-${centerX.toFixed(2)}`, opening.minX, opening.maxX, opening.maxY - bar, opening.maxY, z - depth * 0.5, z + depth * 0.5, material, metadata);
    this.createPanel(`${prefix}-frame-bottom-${centerX.toFixed(2)}`, opening.minX, opening.maxX, opening.minY, opening.minY + bar, z - depth * 0.5, z + depth * 0.5, material, metadata);
    this.createPanel(`${prefix}-frame-cross-v-${centerX.toFixed(2)}`, centerX - bar * 0.45, centerX + bar * 0.45, opening.minY, opening.maxY, z - depth * 0.5, z + depth * 0.5, material, metadata);
    this.createPanel(`${prefix}-frame-cross-h-${centerX.toFixed(2)}`, opening.minX, opening.maxX, centerY - bar * 0.45, centerY + bar * 0.45, z - depth * 0.5, z + depth * 0.5, material, metadata);
  }

  private createPanel(
    name: string,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    minZ: number,
    maxZ: number,
    material: any,
    metadata: Record<string, unknown>
  ): any {
    const panel = BABYLON.MeshBuilder.CreateBox(name, {
      width: Math.max(0.04, maxX - minX),
      height: Math.max(0.04, maxY - minY),
      depth: Math.max(0.04, maxZ - minZ)
    }, this.scene);
    panel.position.set((minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5);
    panel.material = material;
    panel.receiveShadows = true;
    panel.isPickable = false;
    panel.metadata = { ...metadata };
    this.game.world.shadowGenerator?.addShadowCaster?.(panel);
    this.generated.push(panel);
    return panel;
  }
}
