interface IntegratedBridgeApi {
  integratedCityAudit?: () => Record<string, unknown>;
  combatRigAudit?: () => Record<string, unknown>;
  setGuardHeld?: (held: boolean) => void;
  setPlayerHeading?: (yaw: number) => void;
}

export class CaelusIntegratedPlaytestExtension {
  constructor(private readonly game: any) {
    if (!new URLSearchParams(window.location.search).has("playtest")) return;
    const bridge = (globalThis as typeof globalThis & {
      __ASCENSION_PLAYTEST__?: IntegratedBridgeApi;
    }).__ASCENSION_PLAYTEST__;
    if (!bridge) return;

    bridge.integratedCityAudit = (): Record<string, unknown> => {
      const scene = game.world.scene;
      const metadata = scene.metadata ?? {};
      const hiddenSuperseded = scene.meshes.filter((mesh: any) => (
        mesh.metadata?.supersededByIntegratedCity === true
        && mesh.isVisible === false
      )).length;
      const visibleSuperseded = scene.meshes.filter((mesh: any) => (
        mesh.metadata?.supersededByIntegratedCity === true
        && mesh.isVisible !== false
        && Number(mesh.visibility ?? 1) > 0.001
      )).map((mesh: any) => mesh.name);
      const integratedMaterials = scene.materials.filter((material: any) => (
        String(material.name ?? "").startsWith("caelus-integrated-")
      ));
      const transparentIntegratedMaterials = integratedMaterials.filter((material: any) => (
        Number(material.alpha ?? 1) < 0.999
        || Number(material.transparencyMode ?? 0) !== 0
        || material.forceDepthWrite !== true
      )).map((material: any) => material.name);
      const roadMeshes = scene.meshes.filter((mesh: any) => (
        String(mesh.name ?? "").startsWith("caelus-integrated-road-")
      ));
      const frontageMeshes = scene.meshes.filter((mesh: any) => (
        String(mesh.name ?? "").includes("-frontage")
        && String(mesh.name ?? "").startsWith("caelus-integrated-")
      ));
      const gateMeshes = scene.meshes.filter((mesh: any) => mesh.metadata?.closedSolidGeometry === true);
      const boardPosition = (game as any).frontierContracts?.boardPosition ?? null;

      return {
        version: Number(metadata.caelusIntegratedCityVersion ?? 0),
        audit: metadata.integratedTownAudit ?? null,
        roadCount: Number(metadata.integratedRoadCount ?? 0),
        junctionCount: Number(metadata.integratedJunctionCount ?? 0),
        buildingCount: Number(metadata.integratedBuildingCount ?? 0),
        frontageCount: Number(metadata.integratedFrontageCount ?? 0),
        curbCount: Number(metadata.integratedCurbCount ?? 0),
        channelCount: Number(metadata.integratedChannelCount ?? 0),
        roadMeshCount: roadMeshes.length,
        frontageMeshCount: frontageMeshes.length,
        hiddenSuperseded,
        visibleSuperseded,
        transparentIntegratedMaterials,
        integratedMaterialCount: integratedMaterials.length,
        gateSolidMeshCount: gateMeshes.length,
        wellHasDarkShaft: Boolean(scene.getMeshByName?.("caelus-integrated-well-dark-shaft")),
        guildHallPresent: Boolean(scene.getMeshByName?.("caelus-integrated-guild-hall-body")),
        guildBoardPosition: metadata.integratedGuildBoardPosition ?? boardPosition,
        wellPosition: metadata.integratedWellPosition ?? null
      };
    };

    bridge.combatRigAudit = (): Record<string, unknown> => {
      const metadata = game.world.scene.metadata ?? {};
      const player = game.player as any;
      const sword = player.visual?.sword;
      const hilt = game.world.scene.getTransformNodeByName?.("warden-sword-hilt-marker")?.getAbsolutePosition?.();
      const tip = game.world.scene.getTransformNodeByName?.("warden-sword-tip-marker")?.getAbsolutePosition?.();
      const forward = player.forward?.();
      let liveForwardDot = 0;
      if (hilt && tip && forward) {
        const blade = tip.subtract(hilt);
        blade.y = 0;
        if (blade.lengthSquared() > 0.0001) blade.normalize();
        if (forward.lengthSquared() > 0.0001) forward.normalize();
        liveForwardDot = BABYLON.Vector3.Dot(blade, forward);
      }
      return {
        version: Number(metadata.combatRigCorrectionVersion ?? 0),
        swordForwardRuleInstalled: Boolean(metadata.swordForwardRuleInstalled),
        stableGuardRuleInstalled: Boolean(metadata.stableGuardRuleInstalled),
        liveForwardDot: Number(liveForwardDot.toFixed(4)),
        metadataForwardDot: Number(metadata.swordForwardDot ?? 0),
        guardFramesStable: Number(metadata.guardFramesStable ?? 0),
        guardAnchorActive: Boolean(metadata.guardAnchorActive),
        guardRootRoll: Number(player.root?.rotation?.z?.toFixed?.(4) ?? 0),
        guardRootPitch: Number(player.root?.rotation?.x?.toFixed?.(4) ?? 0),
        rootX: Number(player.root?.position?.x?.toFixed?.(4) ?? 0),
        rootZ: Number(player.root?.position?.z?.toFixed?.(4) ?? 0),
        swordParent: sword?.parent?.name ?? null,
        swordRotationX: Number(sword?.rotation?.x?.toFixed?.(4) ?? 0)
      };
    };

    bridge.setGuardHeld = (held: boolean): void => {
      const input = game.input as any;
      input.mouseBlock = held;
    };

    bridge.setPlayerHeading = (yaw: number): void => {
      const player = game.player as any;
      player.yaw = yaw;
      player.root.rotation.y = yaw;
      player.lockTarget = null;
    };
  }
}
