interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface ProtectedLane {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const overlaps = (box: CollisionBox, lane: ProtectedLane): boolean => (
  box.maxX > lane.minX
  && box.minX < lane.maxX
  && box.maxZ > lane.minZ
  && box.minZ < lane.maxZ
);

export class VerticalSliceTraversalGuard {
  constructor(game: any) {
    const boxes = game.world.collisionBoxes as CollisionBox[];
    if (!Array.isArray(boxes)) return;

    const protectedLanes: ProtectedLane[] = [
      { minX: -7.2, maxX: 7.2, minZ: -18, maxZ: 38 },
      { minX: -6.8, maxX: 6.8, minZ: 38, maxZ: 194 },
      { minX: 466.5, maxX: 483.5, minZ: -528, maxZ: -448 },
      { minX: 469, maxX: 481, minZ: -624, maxZ: -575 }
    ];

    let writeIndex = 0;
    let removed = 0;
    for (const box of boxes) {
      const blocksProtectedLane = protectedLanes.some((lane) => overlaps(box, lane));
      if (blocksProtectedLane) {
        removed += 1;
        continue;
      }
      boxes[writeIndex] = box;
      writeIndex += 1;
    }
    boxes.length = writeIndex;

    game.world.scene.metadata = {
      ...(game.world.scene.metadata ?? {}),
      protectedRouteCollisionVolumesRemoved: removed
    };
  }
}
