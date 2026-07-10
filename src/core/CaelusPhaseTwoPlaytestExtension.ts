interface PhaseTwoCollisionAudit {
  total: number;
  duplicatePairs: number;
  mainRouteIntrusions: number;
  wellCollisions: number;
}

interface PlaytestBridgeApi {
  phaseTwoAudit?: () => Record<string, unknown>;
  phaseTwoCollisionProbe?: (
    fromX: number,
    fromZ: number,
    toX: number,
    toZ: number
  ) => Record<string, unknown>;
}

export class CaelusPhaseTwoPlaytestExtension {
  constructor(game: any) {
    if (!new URLSearchParams(window.location.search).has("playtest")) return;
    const bridge = (globalThis as typeof globalThis & {
      __ASCENSION_PLAYTEST__?: PlaytestBridgeApi;
    }).__ASCENSION_PLAYTEST__;
    if (!bridge) return;

    bridge.phaseTwoAudit = (): Record<string, unknown> => {
      const scene = game.world.scene;
      const metadata = scene.metadata ?? {};
      const collisionAudit = metadata.phaseTwoCollisionAudit as PhaseTwoCollisionAudit | undefined;
      const requiredDrainageMeshes = [
        "caelus-phase2-main-street-curb-left",
        "caelus-phase2-main-street-curb-right",
        "caelus-phase2-main-street-channel-left",
        "caelus-phase2-main-street-channel-right",
        "caelus-phase2-market-lane-curb-left",
        "caelus-phase2-market-lane-curb-right",
        "caelus-phase2-market-lane-channel-left",
        "caelus-phase2-market-lane-channel-right",
        "caelus-phase2-guild-lane-curb-left",
        "caelus-phase2-guild-lane-curb-right",
        "caelus-phase2-guild-lane-channel-left",
        "caelus-phase2-guild-lane-channel-right",
        "caelus-phase2-residential-loop-curb-left",
        "caelus-phase2-residential-loop-curb-right",
        "caelus-phase2-residential-loop-channel-left",
        "caelus-phase2-residential-loop-channel-right",
        "caelus-phase2-service-lane-curb-left",
        "caelus-phase2-service-lane-curb-right",
        "caelus-phase2-service-lane-channel-left",
        "caelus-phase2-service-lane-channel-right"
      ];
      const missingDrainageMeshes = requiredDrainageMeshes.filter((name) => !scene.getMeshByName?.(name));
      const disabledDrainageMeshes = requiredDrainageMeshes.filter((name) => {
        const mesh = scene.getMeshByName?.(name);
        return mesh && !mesh.isEnabled?.();
      });
      const well = scene.getMeshByName?.("caelus-phase1-town-well");
      const transparentPhaseTwoMaterials = scene.materials.filter((material: any) => {
        const name = String(material.name ?? "");
        return name.startsWith("caelus-phase2-")
          && (Number(material.alpha ?? 1) < 0.999 || Number(material.transparencyMode ?? 0) !== 0);
      }).map((material: any) => material.name);

      return {
        version: Number(metadata.caelusTownPhaseTwoVersion ?? 0),
        wellRecovered: Boolean(metadata.phaseTwoWellRecovered),
        drainageBandCount: Number(metadata.phaseTwoDrainageBands ?? 0),
        collisionAudit: collisionAudit ?? null,
        missingDrainageMeshes,
        disabledDrainageMeshes,
        transparentPhaseTwoMaterials,
        wellRootOffsetX: Number(well?.position?.x?.toFixed?.(3) ?? 0),
        wellCollisionCenter: well?.metadata?.collisionCenter ?? null,
        wellRelocated: Boolean(well?.metadata?.phaseTwoRelocated),
        roadMaterialFrozen: Boolean(scene.getMaterialByName?.("caelus-phase1-road")?.isFrozen),
        roadEdgeMaterialFrozen: Boolean(scene.getMaterialByName?.("caelus-phase1-road-edge")?.isFrozen),
        phaseTwoMaterialCount: scene.materials.filter((material: any) => (
          String(material.name ?? "").startsWith("caelus-phase2-")
        )).length
      };
    };

    bridge.phaseTwoCollisionProbe = (
      fromX: number,
      fromZ: number,
      toX: number,
      toZ: number
    ): Record<string, unknown> => {
      const previous = new BABYLON.Vector3(
        fromX,
        game.world.heightAt(fromX, fromZ),
        fromZ
      );
      const position = new BABYLON.Vector3(
        toX,
        game.world.heightAt(toX, toZ),
        toZ
      );
      game.world.resolvePlayerPosition(position, previous);
      const blocked = Math.abs(position.x - previous.x) < 0.001
        && Math.abs(position.z - previous.z) < 0.001;
      return {
        fromX,
        fromZ,
        requestedX: toX,
        requestedZ: toZ,
        resolvedX: Number(position.x.toFixed(3)),
        resolvedZ: Number(position.z.toFixed(3)),
        blocked
      };
    };
  }
}
