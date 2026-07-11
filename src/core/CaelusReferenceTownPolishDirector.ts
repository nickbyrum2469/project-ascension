interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const GATE_TOWER_X = 13;
const SOUTH_GATE_Z = 14;
const NORTH_GATE_Z = 228;
const PATH_COLOR = "#68705d";
const ROAD_COLOR = "#18211f";

export class CaelusReferenceTownPolishDirector {
  constructor(game: any) {
    const scene = game.world.scene;
    const world = game.world as any;

    const pathMaterial = scene.getMaterialByName?.("caelus-reference-path");
    if (pathMaterial) {
      const pathColor = BABYLON.Color3.FromHexString(PATH_COLOR);
      pathMaterial.diffuseColor = pathColor;
      pathMaterial.ambientColor = pathColor.scale(0.24);
      pathMaterial.specularColor = BABYLON.Color3.Black();
    }

    const roadMaterial = scene.getMaterialByName?.("caelus-reference-road");
    if (roadMaterial) {
      const roadColor = BABYLON.Color3.FromHexString(ROAD_COLOR);
      roadMaterial.diffuseColor = roadColor;
      roadMaterial.ambientColor = roadColor.scale(0.35);
      roadMaterial.specularColor = BABYLON.Color3.Black();
    }

    const gateTowerLayout = [
      { index: 4, x: -GATE_TOWER_X, z: SOUTH_GATE_Z },
      { index: 5, x: GATE_TOWER_X, z: SOUTH_GATE_Z },
      { index: 6, x: -GATE_TOWER_X, z: NORTH_GATE_Z },
      { index: 7, x: GATE_TOWER_X, z: NORTH_GATE_Z }
    ];

    for (const gate of gateTowerLayout) {
      const tower = scene.getMeshByName?.(`caelus-reference-gate-tower-${gate.index}`);
      const roof = scene.getMeshByName?.(`caelus-reference-gate-tower-roof-${gate.index}`);
      if (tower) tower.position.x = gate.x;
      if (roof) roof.position.x = gate.x;
    }

    const boxes = world.collisionBoxes as CollisionBox[];
    if (Array.isArray(boxes)) {
      let write = 0;
      for (const box of boxes) {
        const centerX = (box.minX + box.maxX) * 0.5;
        const centerZ = (box.minZ + box.maxZ) * 0.5;
        const width = box.maxX - box.minX;
        const oldGateTower = Math.abs(Math.abs(centerX) - 10) < 0.25
          && (Math.abs(centerZ - SOUTH_GATE_Z) < 0.25 || Math.abs(centerZ - NORTH_GATE_Z) < 0.25)
          && width > 8 && width < 10;
        if (oldGateTower) continue;
        boxes[write] = box;
        write += 1;
      }
      boxes.length = write;

      for (const gate of gateTowerLayout) {
        boxes.push({
          minX: gate.x - 4.6,
          maxX: gate.x + 4.6,
          minZ: gate.z - 4.6,
          maxZ: gate.z + 4.6
        });
      }
    }

    scene.metadata = {
      ...(scene.metadata ?? {}),
      caelusReferenceTownPolishVersion: 2,
      caelusReferencePathColor: PATH_COLOR,
      caelusReferenceRoadColor: ROAD_COLOR,
      caelusReferenceGateClearWidth: 16.8
    };

    const bridge = (globalThis as any).__ASCENSION_PLAYTEST__;
    if (bridge) {
      bridge.referenceTownPolishAudit = () => ({
        version: 2,
        pathColor: PATH_COLOR,
        roadColor: ROAD_COLOR,
        gateTowerX: GATE_TOWER_X,
        gateClearWidth: 16.8,
        southGateZ: SOUTH_GATE_Z,
        northGateZ: NORTH_GATE_Z
      });
    }
  }
}
