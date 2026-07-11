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
  integratedCityAudit?: () => Record<string, unknown>;
  guardStabilityProbe?: (seconds: number) => Record<string, unknown>;
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
      const representativeCurb = scene.getMeshByName?.("caelus-phase2-main-street-curb-left");
      const representativeChannel = scene.getMeshByName?.("caelus-phase2-main-street-channel-left");
      const transparentPhaseTwoMaterials = scene.materials.filter((material: any) => {
        const name = String(material.name ?? "");
        return name.startsWith("caelus-phase2-")
          && (Number(material.alpha ?? 1) < 0.999 || Number(material.transparencyMode ?? 0) !== 0);
      }).map((material: any) => material.name);

      return {
        version: Number(metadata.caelusTownPhaseTwoVersion ?? 0),
        roadVisualRevision: Number(metadata.phaseTwoRoadVisualRevision ?? 0),
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
        curbHalfWidth: Number(representativeCurb?.metadata?.halfWidth ?? 0),
        curbHeightOffset: Number(representativeCurb?.metadata?.heightOffset ?? 0),
        channelHalfWidth: Number(representativeChannel?.metadata?.halfWidth ?? 0),
        channelHeightOffset: Number(representativeChannel?.metadata?.heightOffset ?? 0),
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

    bridge.integratedCityAudit = (): Record<string, unknown> => {
      const scene = game.world.scene;
      const enabledIntegrated = scene.meshes.filter((mesh: any) => (
        String(mesh.name ?? "").startsWith("caelus-integrated-") && mesh.isEnabled?.()
      ));
      const hiddenLegacy = scene.meshes.filter((mesh: any) => mesh.metadata?.auditCompatibilityOnly === true);
      const junctionAwareCurbs = enabledIntegrated.filter((mesh: any) => mesh.metadata?.purpose === "junction-aware-curb");
      const frontagePaths = enabledIntegrated.filter((mesh: any) => mesh.metadata?.purpose === "door-to-road-frontage");
      const integratedMaterials = scene.materials.filter((material: any) => String(material.name ?? "").startsWith("caelus-integrated-"));
      const transparentIntegratedMaterials = integratedMaterials.filter((material: any) => (
        Number(material.alpha ?? 1) < 0.999 || Number(material.transparencyMode ?? 0) !== 0
      )).map((material: any) => material.name);
      const required = [
        "caelus-integrated-town-green-disc",
        "caelus-integrated-well-dark-shaft",
        "caelus-integrated-well-ring",
        "caelus-integrated-market-court",
        "caelus-integrated-guild-court",
        "caelus-integrated-guild-quest-board",
        "caelus-integrated-guild-hall-body",
        "caelus-integrated-gate-tower--1",
        "caelus-integrated-gate-tower-1",
        "caelus-integrated-gate-lintel"
      ];
      return {
        version: Number(scene.metadata?.caelusIntegratedRepairVersion ?? 0),
        buildingCount: Number(scene.metadata?.caelusIntegratedBuildingCount ?? 0),
        curbSegmentCount: Number(scene.metadata?.caelusIntegratedCurbSegments ?? 0),
        junctionCount: Number(scene.metadata?.caelusIntegratedJunctionCount ?? 0),
        removedCollision: Number(scene.metadata?.caelusIntegratedRemovedCollision ?? 0),
        hiddenLegacyCount: hiddenLegacy.length,
        enabledIntegratedCount: enabledIntegrated.length,
        junctionAwareCurbCount: junctionAwareCurbs.length,
        frontagePathCount: frontagePaths.length,
        missingRequired: required.filter((name) => !scene.getMeshByName?.(name)?.isEnabled?.()),
        transparentIntegratedMaterials,
        swordForwardVerified: Boolean(scene.metadata?.caelusSwordForwardVerified),
        swordForwardDotBeforeCorrection: Number(scene.metadata?.caelusSwordForwardDotBeforeCorrection ?? 0),
        stableGuardInstalled: Boolean(scene.metadata?.caelusIntegratedStableGuard)
      };
    };

    bridge.guardStabilityProbe = (seconds: number): Record<string, unknown> => {
      const player = game.player as any;
      const start = player.root.position.clone();
      const frames = Math.max(1, Math.min(600, Math.ceil(seconds * 60)));
      player.blocking = true;
      for (let index = 0; index < frames; index += 1) {
        game.world.scene.render();
      }
      const result = {
        frames,
        displacement: Number(BABYLON.Vector3.Distance(start, player.root.position).toFixed(5)),
        rootPitch: Number(player.root.rotation.x.toFixed(5)),
        rootRoll: Number(player.root.rotation.z.toFixed(5)),
        hipPitch: Number(player.visual.hips.rotation.x.toFixed(5)),
        hipRoll: Number(player.visual.hips.rotation.z.toFixed(5)),
        torsoOffsetY: Number(player.visual.torso.position.y.toFixed(5))
      };
      player.blocking = false;
      return result;
    };
  }
}
