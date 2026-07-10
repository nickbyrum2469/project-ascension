interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface ProtectedSegment {
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  clearance: number;
}

const pointInsideExpandedBox = (
  x: number,
  z: number,
  box: CollisionBox,
  clearance: number
): boolean => (
  x > box.minX - clearance
  && x < box.maxX + clearance
  && z > box.minZ - clearance
  && z < box.maxZ + clearance
);

const blocksProtectedSegment = (box: CollisionBox, segment: ProtectedSegment): boolean => {
  const distance = Math.hypot(segment.toX - segment.fromX, segment.toZ - segment.fromZ);
  const steps = Math.max(1, Math.ceil(distance / 1.25));
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const x = segment.fromX + (segment.toX - segment.fromX) * t;
    const z = segment.fromZ + (segment.toZ - segment.fromZ) * t;
    if (pointInsideExpandedBox(x, z, box, segment.clearance)) return true;
  }
  return false;
};

export class VerticalSliceTraversalGuard {
  constructor(game: any) {
    const boxes = game.world.collisionBoxes as CollisionBox[];
    if (!Array.isArray(boxes)) return;

    const protectedSegments: ProtectedSegment[] = [
      { fromX: 0, fromZ: -18, toX: 0, toZ: 194, clearance: 1.15 },
      { fromX: 448, fromZ: -451, toX: 475, toZ: -470, clearance: 1.2 },
      { fromX: 475, fromZ: -470, toX: 475, toZ: -528, clearance: 1.2 },
      { fromX: 475, fromZ: -575, toX: 475, toZ: -624, clearance: 1.15 }
    ];

    let writeIndex = 0;
    let removed = 0;
    for (const box of boxes) {
      const blocksProtectedRoute = protectedSegments.some((segment) => (
        blocksProtectedSegment(box, segment)
      ));
      if (blocksProtectedRoute) {
        removed += 1;
        continue;
      }
      boxes[writeIndex] = box;
      writeIndex += 1;
    }
    boxes.length = writeIndex;

    game.world.scene.metadata = {
      ...(game.world.scene.metadata ?? {}),
      protectedRouteCollisionVolumesRemoved: removed,
      protectedRouteCollisionMode: "sampled-centerline"
    };
  }
}
