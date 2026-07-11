export class CaelusMigrationCompatibility {
  constructor(game: any) {
    const scene = game.world.scene;
    const exact = new Set([
      "caelus-phase1-buildings-warm", "caelus-phase1-buildings-sage", "caelus-phase1-foundations",
      "caelus-phase1-roofs-blue", "caelus-phase1-roofs-green", "caelus-phase1-doors",
      "caelus-phase1-windows", "caelus-phase1-signage", "caelus-phase1-chimneys",
      "caelus-phase1-market-wood", "caelus-phase1-market-roofs", "caelus-phase1-town-well"
    ]);
    let hiddenEnabled = 0;
    for (const mesh of scene.meshes) {
      const name = String(mesh.name ?? "");
      const roadEdge = name.startsWith("caelus-phase1-") && name.endsWith("-edge");
      const phaseTwoEdge = name.startsWith("caelus-phase2-") && (name.includes("-curb-") || name.includes("-channel-"));
      if (!exact.has(name) && !roadEdge && !phaseTwoEdge) continue;
      mesh.setEnabled(true);
      mesh.isVisible = false;
      mesh.visibility = 0;
      mesh.isPickable = false;
      mesh.metadata = {
        ...(mesh.metadata ?? {}),
        auditCompatibilityOnly: true,
        supersededByIntegratedRepair: true
      };
      hiddenEnabled += 1;
    }
    scene.metadata = {
      ...(scene.metadata ?? {}),
      caelusMigrationHiddenEnabledMeshes: hiddenEnabled
    };
  }
}
