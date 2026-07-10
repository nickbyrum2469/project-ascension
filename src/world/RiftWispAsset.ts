import { createMaterial, type BoarVisual } from "./ProceduralAssets.js";

export const createRiftWisp = (scene: any, index: number): BoarVisual => {
  const root = new BABYLON.TransformNode(`rift-wisp-${index}`, scene);
  const shell = createMaterial(scene, `rift-wisp-shell-${index}`, "#263b4a", 0.28, 0.72);
  const edge = createMaterial(scene, `rift-wisp-edge-${index}`, "#6de9ef", 0.12, 0.18, "#22cfdc");
  const warning = createMaterial(scene, `rift-wisp-warning-${index}`, "#ffc66b", 0.1, 0.12, "#ff8f42");
  edge.emissiveIntensity = 2.1;
  warning.emissiveIntensity = 1.8;

  const body = BABYLON.MeshBuilder.CreatePolyhedron(`rift-wisp-body-${index}`, {
    type: 2,
    size: 0.74
  }, scene);
  body.scaling = new BABYLON.Vector3(1.1, 0.78, 1.1);
  body.material = shell;
  body.parent = root;

  const head = new BABYLON.TransformNode(`rift-wisp-core-rig-${index}`, scene);
  head.parent = root;

  const core = BABYLON.MeshBuilder.CreatePolyhedron(`rift-wisp-core-${index}`, {
    type: 1,
    size: 0.48
  }, scene);
  core.scaling = new BABYLON.Vector3(0.8, 1.35, 0.8);
  core.rotation = new BABYLON.Vector3(0.2, Math.PI / 4, 0.12);
  core.material = edge;
  core.parent = head;

  const rune = BABYLON.MeshBuilder.CreateTorus(`rift-wisp-rune-${index}`, {
    diameter: 1.45,
    thickness: 0.055,
    tessellation: 28
  }, scene);
  rune.rotation.x = Math.PI / 2;
  rune.material = edge;
  rune.parent = root;

  const secondRing = BABYLON.MeshBuilder.CreateTorus(`rift-wisp-ring-secondary-${index}`, {
    diameter: 2.05,
    thickness: 0.035,
    tessellation: 28
  }, scene);
  secondRing.rotation = new BABYLON.Vector3(Math.PI / 2 - 0.45, 0.25, 0.35);
  secondRing.material = edge;
  secondRing.parent = root;

  const legs: any[] = [];
  const tusks: any[] = [];
  for (let bladeIndex = 0; bladeIndex < 4; bladeIndex += 1) {
    const bladeRig = new BABYLON.TransformNode(`rift-wisp-blade-rig-${index}-${bladeIndex}`, scene);
    bladeRig.parent = root;
    bladeRig.rotation.y = (bladeIndex / 4) * Math.PI * 2;

    const blade = BABYLON.MeshBuilder.CreatePolyhedron(`rift-wisp-blade-${index}-${bladeIndex}`, {
      type: 1,
      size: 0.34
    }, scene);
    blade.position = new BABYLON.Vector3(0, bladeIndex % 2 === 0 ? 0.18 : -0.18, 1.05);
    blade.scaling = new BABYLON.Vector3(0.34, 1.25, 0.72);
    blade.rotation.x = bladeIndex % 2 === 0 ? 0.38 : -0.38;
    blade.material = bladeIndex === 0 ? warning : shell;
    blade.parent = bladeRig;
    legs.push(bladeRig);
    tusks.push(blade);
  }

  const satelliteOffsets = [
    new BABYLON.Vector3(-1.18, 0.42, 0.1),
    new BABYLON.Vector3(1.08, -0.34, -0.12),
    new BABYLON.Vector3(0.15, 0.72, -1.02)
  ];
  satelliteOffsets.forEach((offset, satelliteIndex) => {
    const satellite = BABYLON.MeshBuilder.CreatePolyhedron(`rift-wisp-satellite-${index}-${satelliteIndex}`, {
      type: 1,
      size: 0.19 + satelliteIndex * 0.025
    }, scene);
    satellite.position.copyFrom(offset);
    satellite.material = satelliteIndex === 0 ? warning : edge;
    satellite.parent = root;
    tusks.push(satellite);
  });

  root.metadata = {
    wispVisual: true,
    secondaryRing: secondRing,
    warningMaterial: warning,
    edgeMaterial: edge
  };

  return { root, body, head, legs, rune, tusks };
};
