interface PerimeterPoint { x: number; z: number; }

const FINAL_PERIMETER: PerimeterPoint[] = [
  { x: -48, z: 18 }, { x: 48, z: 18 }, { x: 66, z: 42 }, { x: 92, z: 82 },
  { x: 102, z: 126 }, { x: 90, z: 166 }, { x: 58, z: 204 }, { x: 28, z: 224 },
  { x: -34, z: 224 }, { x: -70, z: 210 }, { x: -96, z: 178 }, { x: -104, z: 132 },
  { x: -92, z: 86 }, { x: -70, z: 48 }
];

const pointInPolygon = (point: PerimeterPoint): boolean => {
  let inside = false;
  for (let index = 0, previous = FINAL_PERIMETER.length - 1; index < FINAL_PERIMETER.length; previous = index, index += 1) {
    const currentPoint = FINAL_PERIMETER[index];
    const previousPoint = FINAL_PERIMETER[previous];
    const intersects = ((currentPoint.z > point.z) !== (previousPoint.z > point.z))
      && point.x < (previousPoint.x - currentPoint.x) * (point.z - currentPoint.z)
      / ((previousPoint.z - currentPoint.z) || 0.0001) + currentPoint.x;
    if (intersects) inside = !inside;
  }
  return inside;
};

export const installCaelusControlledTerrainPerimeterGuard = (DirectorClass: any): void => {
  const prototype = DirectorClass.prototype as any;
  if (prototype.__caelusControlledTerrainPerimeterGuardInstalled) return;
  const controlledHeight = prototype.sculptedHeightAt;
  prototype.sculptedHeightAt = function guardedControlledTerrainHeight(this: any, x: number, z: number): number {
    const height = controlledHeight.call(this, x, z);
    if (!pointInPolygon({ x, z })) return height;
    const minimumTownFloor = this.originalHeightAt(0, 26) + 0.02;
    return Math.max(height, minimumTownFloor);
  };
  prototype.__caelusControlledTerrainPerimeterGuardInstalled = true;
};
