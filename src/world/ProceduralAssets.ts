export interface HumanoidVisual {
  root: any;
  hips: any;
  torso: any;
  head: any;
  leftArm: any;
  rightArm: any;
  leftLeg: any;
  rightLeg: any;
  sword: any;
  cape: any;
  rune: any;
}

export interface BoarVisual {
  root: any;
  body: any;
  head: any;
  legs: any[];
  rune: any;
  tusks: any[];
}

const color = (hex: string): any => BABYLON.Color3.FromHexString(hex);

export const createMaterial = (
  scene: any,
  name: string,
  baseHex: string,
  roughness = 0.78,
  metallic = 0.04,
  emissiveHex?: string
): any => {
  const material = new BABYLON.PBRMaterial(name, scene);
  material.albedoColor = color(baseHex);
  material.roughness = roughness;
  material.metallic = metallic;
  if (emissiveHex) {
    material.emissiveColor = color(emissiveHex);
    material.emissiveIntensity = 1.15;
  }
  return material;
};

const attach = (mesh: any, parent: any, position: any, rotation?: any): any => {
  mesh.parent = parent;
  mesh.position.copyFrom(position);
  if (rotation) mesh.rotation.copyFrom(rotation);
  return mesh;
};

const createTaperedLimb = (
  scene: any,
  name: string,
  height: number,
  top: number,
  bottom: number,
  material: any
): any => {
  const limb = BABYLON.MeshBuilder.CreateCylinder(name, {
    height,
    diameterTop: top,
    diameterBottom: bottom,
    tessellation: 7
  }, scene);
  limb.material = material;
  return limb;
};

const createSwordMesh = (scene: any, name: string, glowMaterial: any, darkMaterial: any): any => {
  const root = new BABYLON.TransformNode(`${name}-root`, scene);
  const blade = BABYLON.MeshBuilder.CreateCylinder(`${name}-blade`, {
    height: 1.55,
    diameterTop: 0.025,
    diameterBottom: 0.16,
    tessellation: 4
  }, scene);
  blade.material = glowMaterial;
  blade.rotation.z = Math.PI;
  blade.position.y = 0.93;
  blade.parent = root;

  const fuller = BABYLON.MeshBuilder.CreateCylinder(`${name}-fuller`, {
    height: 1.12,
    diameterTop: 0.012,
    diameterBottom: 0.04,
    tessellation: 4
  }, scene);
  fuller.material = darkMaterial;
  fuller.position.y = 0.9;
  fuller.rotation.z = Math.PI;
  fuller.parent = root;

  const guard = BABYLON.MeshBuilder.CreateCylinder(`${name}-guard`, {
    height: 0.52,
    diameter: 0.07,
    tessellation: 8
  }, scene);
  guard.material = darkMaterial;
  guard.rotation.z = Math.PI / 2;
  guard.position.y = 0.15;
  guard.parent = root;

  const grip = BABYLON.MeshBuilder.CreateCylinder(`${name}-grip`, {
    height: 0.36,
    diameterTop: 0.085,
    diameterBottom: 0.105,
    tessellation: 8
  }, scene);
  grip.material = darkMaterial;
  grip.position.y = -0.08;
  grip.parent = root;

  const pommel = BABYLON.MeshBuilder.CreatePolyhedron(`${name}-pommel`, { type: 1, size: 0.13 }, scene);
  pommel.material = glowMaterial;
  pommel.position.y = -0.29;
  pommel.parent = root;
  return root;
};

const createCape = (scene: any, material: any): any => {
  const pathArray: any[][] = [];
  for (let row = 0; row < 5; row += 1) {
    const y = 0.35 - row * 0.33;
    const width = 0.42 + row * 0.07;
    const back = -0.2 - row * 0.035;
    pathArray.push([
      new BABYLON.Vector3(-width, y, back),
      new BABYLON.Vector3(0, y - 0.025, back - 0.05),
      new BABYLON.Vector3(width, y, back)
    ]);
  }
  const cape = BABYLON.MeshBuilder.CreateRibbon("warden-cape", {
    pathArray,
    closeArray: false,
    closePath: false,
    sideOrientation: BABYLON.Mesh.DOUBLESIDE
  }, scene);
  cape.material = material;
  return cape;
};

export const createWarden = (scene: any): HumanoidVisual => {
  const root = new BABYLON.TransformNode("warden-root", scene);
  const hips = new BABYLON.TransformNode("warden-hips", scene);
  hips.parent = root;
  hips.position.y = 0.92;

  const armor = createMaterial(scene, "warden-armor", "#233948", 0.36, 0.45);
  const cloth = createMaterial(scene, "warden-cloth", "#11212d", 0.9, 0.02);
  const trim = createMaterial(scene, "warden-trim", "#d1a85f", 0.28, 0.72);
  const glow = createMaterial(scene, "warden-riftglass", "#6beeff", 0.16, 0.24, "#3ad8ff");
  const skin = createMaterial(scene, "warden-skin", "#c58f72", 0.82, 0.01);
  const capeMaterial = createMaterial(scene, "warden-cape-mat", "#263855", 0.95, 0.01);
  capeMaterial.backFaceCulling = false;

  const torso = BABYLON.MeshBuilder.CreateCylinder("warden-torso", {
    height: 0.82,
    diameterTop: 0.72,
    diameterBottom: 0.49,
    tessellation: 8
  }, scene);
  torso.material = armor;
  attach(torso, hips, new BABYLON.Vector3(0, 0.48, 0));

  const chestRune = BABYLON.MeshBuilder.CreateTorus("warden-chest-rune", {
    diameter: 0.29,
    thickness: 0.025,
    tessellation: 18
  }, scene);
  chestRune.material = glow;
  attach(chestRune, torso, new BABYLON.Vector3(0, 0.07, 0.34), new BABYLON.Vector3(Math.PI / 2, 0, 0));

  const waist = BABYLON.MeshBuilder.CreateCylinder("warden-waist", {
    height: 0.22,
    diameterTop: 0.5,
    diameterBottom: 0.54,
    tessellation: 8
  }, scene);
  waist.material = cloth;
  attach(waist, hips, new BABYLON.Vector3(0, 0.02, 0));

  const belt = BABYLON.MeshBuilder.CreateTorus("warden-belt", {
    diameter: 0.55,
    thickness: 0.06,
    tessellation: 12
  }, scene);
  belt.material = trim;
  attach(belt, hips, new BABYLON.Vector3(0, 0.08, 0), new BABYLON.Vector3(Math.PI / 2, 0, 0));

  const neck = createTaperedLimb(scene, "warden-neck", 0.17, 0.18, 0.2, skin);
  attach(neck, torso, new BABYLON.Vector3(0, 0.49, 0));

  const head = BABYLON.MeshBuilder.CreateSphere("warden-head", { diameter: 0.36, segments: 12 }, scene);
  head.material = skin;
  head.scaling.y = 1.08;
  attach(head, torso, new BABYLON.Vector3(0, 0.72, 0));

  const helmet = BABYLON.MeshBuilder.CreatePolyhedron("warden-helmet", { type: 2, size: 0.31 }, scene);
  helmet.material = armor;
  helmet.scaling = new BABYLON.Vector3(0.9, 0.9, 0.95);
  attach(helmet, torso, new BABYLON.Vector3(0, 0.78, -0.015));

  const visor = BABYLON.MeshBuilder.CreateCylinder("warden-visor", {
    height: 0.24,
    diameterTop: 0.16,
    diameterBottom: 0.28,
    tessellation: 4
  }, scene);
  visor.material = glow;
  visor.scaling.z = 0.28;
  attach(visor, torso, new BABYLON.Vector3(0, 0.75, 0.235), new BABYLON.Vector3(Math.PI / 2, Math.PI / 4, 0));

  const leftArm = new BABYLON.TransformNode("warden-left-arm", scene);
  leftArm.parent = torso;
  leftArm.position = new BABYLON.Vector3(-0.48, 0.3, 0);
  const leftUpper = createTaperedLimb(scene, "warden-left-upper", 0.55, 0.25, 0.19, armor);
  leftUpper.position.y = -0.23;
  leftUpper.parent = leftArm;
  const leftGauntlet = createTaperedLimb(scene, "warden-left-gauntlet", 0.48, 0.19, 0.14, cloth);
  leftGauntlet.position.y = -0.7;
  leftGauntlet.parent = leftArm;
  const leftShoulder = BABYLON.MeshBuilder.CreatePolyhedron("warden-left-shoulder", { type: 1, size: 0.3 }, scene);
  leftShoulder.material = trim;
  leftShoulder.scaling = new BABYLON.Vector3(1.2, 0.55, 1);
  leftShoulder.position.y = 0.02;
  leftShoulder.parent = leftArm;

  const rightArm = new BABYLON.TransformNode("warden-right-arm", scene);
  rightArm.parent = torso;
  rightArm.position = new BABYLON.Vector3(0.48, 0.3, 0);
  const rightUpper = createTaperedLimb(scene, "warden-right-upper", 0.55, 0.25, 0.19, armor);
  rightUpper.position.y = -0.23;
  rightUpper.parent = rightArm;
  const rightGauntlet = createTaperedLimb(scene, "warden-right-gauntlet", 0.48, 0.19, 0.14, cloth);
  rightGauntlet.position.y = -0.7;
  rightGauntlet.parent = rightArm;
  const rightShoulder = BABYLON.MeshBuilder.CreatePolyhedron("warden-right-shoulder", { type: 1, size: 0.3 }, scene);
  rightShoulder.material = trim;
  rightShoulder.scaling = new BABYLON.Vector3(1.2, 0.55, 1);
  rightShoulder.position.y = 0.02;
  rightShoulder.parent = rightArm;

  const leftLeg = new BABYLON.TransformNode("warden-left-leg", scene);
  leftLeg.parent = hips;
  leftLeg.position = new BABYLON.Vector3(-0.2, -0.08, 0);
  const leftThigh = createTaperedLimb(scene, "warden-left-thigh", 0.68, 0.28, 0.21, cloth);
  leftThigh.position.y = -0.32;
  leftThigh.parent = leftLeg;
  const leftBoot = createTaperedLimb(scene, "warden-left-boot", 0.64, 0.22, 0.17, armor);
  leftBoot.position.y = -0.9;
  leftBoot.parent = leftLeg;
  leftBoot.rotation.x = -0.05;

  const rightLeg = new BABYLON.TransformNode("warden-right-leg", scene);
  rightLeg.parent = hips;
  rightLeg.position = new BABYLON.Vector3(0.2, -0.08, 0);
  const rightThigh = createTaperedLimb(scene, "warden-right-thigh", 0.68, 0.28, 0.21, cloth);
  rightThigh.position.y = -0.32;
  rightThigh.parent = rightLeg;
  const rightBoot = createTaperedLimb(scene, "warden-right-boot", 0.64, 0.22, 0.17, armor);
  rightBoot.position.y = -0.9;
  rightBoot.parent = rightLeg;
  rightBoot.rotation.x = -0.05;

  const sword = createSwordMesh(scene, "riftglass-edge", glow, trim);
  sword.parent = rightArm;
  sword.position = new BABYLON.Vector3(0, -0.94, 0.05);
  sword.rotation = new BABYLON.Vector3(0.08, 0, Math.PI);

  const cape = createCape(scene, capeMaterial);
  cape.parent = torso;
  cape.position = new BABYLON.Vector3(0, 0.31, -0.22);

  root.getChildMeshes().forEach((mesh: any) => {
    mesh.receiveShadows = true;
    mesh.isPickable = false;
  });

  return { root, hips, torso, head, leftArm, rightArm, leftLeg, rightLeg, sword, cape, rune: chestRune };
};

export const createMara = (scene: any): HumanoidVisual => {
  const visual = createWarden(scene);
  visual.root.name = "mara-venn-root";
  visual.root.scaling = new BABYLON.Vector3(0.93, 0.93, 0.93);
  visual.sword.setEnabled(false);
  visual.rune.material = createMaterial(scene, "mara-rune", "#ffd788", 0.25, 0.25, "#ffb64d");
  visual.cape.material = createMaterial(scene, "mara-cloak", "#5f3145", 0.9, 0.01);
  return visual;
};

export const createRiftBoar = (scene: any, index: number): BoarVisual => {
  const root = new BABYLON.TransformNode(`rift-boar-${index}`, scene);
  const hide = createMaterial(scene, `boar-hide-${index}`, "#463536", 0.92, 0.01);
  const armor = createMaterial(scene, `boar-carapace-${index}`, "#2d3f46", 0.48, 0.42);
  const runeMat = createMaterial(scene, `boar-rune-${index}`, "#6beeff", 0.18, 0.15, "#28d8ff");
  const tuskMat = createMaterial(scene, `boar-tusk-${index}`, "#e4d7b8", 0.62, 0.02);

  const body = BABYLON.MeshBuilder.CreateSphere(`boar-body-${index}`, { diameter: 1.55, segments: 10 }, scene);
  body.material = hide;
  body.scaling = new BABYLON.Vector3(1.28, 0.74, 1);
  body.parent = root;
  body.position.y = 0.78;

  const carapace = BABYLON.MeshBuilder.CreatePolyhedron(`boar-carapace-${index}`, { type: 2, size: 0.74 }, scene);
  carapace.material = armor;
  carapace.scaling = new BABYLON.Vector3(1.2, 0.42, 0.86);
  carapace.position = new BABYLON.Vector3(0, 1.2, -0.05);
  carapace.parent = root;

  const head = BABYLON.MeshBuilder.CreateSphere(`boar-head-${index}`, { diameter: 0.88, segments: 9 }, scene);
  head.material = hide;
  head.scaling = new BABYLON.Vector3(0.8, 0.72, 1.05);
  head.position = new BABYLON.Vector3(0, 0.83, 0.92);
  head.parent = root;

  const snout = BABYLON.MeshBuilder.CreateCylinder(`boar-snout-${index}`, {
    height: 0.48,
    diameterTop: 0.42,
    diameterBottom: 0.3,
    tessellation: 8
  }, scene);
  snout.material = hide;
  snout.rotation.x = Math.PI / 2;
  snout.position = new BABYLON.Vector3(0, 0.72, 1.38);
  snout.parent = root;

  const rune = BABYLON.MeshBuilder.CreateTorus(`boar-rune-${index}`, {
    diameter: 0.38,
    thickness: 0.045,
    tessellation: 14
  }, scene);
  rune.material = runeMat;
  rune.position = new BABYLON.Vector3(0, 1.3, 0.22);
  rune.rotation.x = Math.PI / 2;
  rune.parent = root;

  const tusks: any[] = [];
  [-1, 1].forEach((side) => {
    const tusk = BABYLON.MeshBuilder.CreateCylinder(`boar-tusk-${index}-${side}`, {
      height: 0.42,
      diameterTop: 0.01,
      diameterBottom: 0.12,
      tessellation: 8
    }, scene);
    tusk.material = tuskMat;
    tusk.position = new BABYLON.Vector3(side * 0.25, 0.64, 1.55);
    tusk.rotation = new BABYLON.Vector3(-0.48, 0, side * 0.36);
    tusk.parent = root;
    tusks.push(tusk);
  });

  const legs: any[] = [];
  const legPositions = [
    new BABYLON.Vector3(-0.48, 0.42, 0.46),
    new BABYLON.Vector3(0.48, 0.42, 0.46),
    new BABYLON.Vector3(-0.48, 0.42, -0.47),
    new BABYLON.Vector3(0.48, 0.42, -0.47)
  ];
  legPositions.forEach((position, legIndex) => {
    const leg = createTaperedLimb(scene, `boar-leg-${index}-${legIndex}`, 0.62, 0.19, 0.13, hide);
    leg.position = position;
    leg.parent = root;
    legs.push(leg);
  });

  root.getChildMeshes().forEach((mesh: any) => {
    mesh.receiveShadows = true;
    mesh.isPickable = false;
  });
  return { root, body, head, legs, rune, tusks };
};

export const createTree = (scene: any, position: any, scale: number, seed: number): any => {
  const root = new BABYLON.TransformNode(`windscar-tree-${seed}`, scene);
  root.position.copyFrom(position);
  root.scaling = new BABYLON.Vector3(scale, scale, scale);
  const bark = createMaterial(scene, `bark-${seed}`, seed % 2 ? "#58412f" : "#49382d", 1, 0);
  const leaf = createMaterial(scene, `leaf-${seed}`, seed % 3 === 0 ? "#5d8f62" : "#477856", 0.93, 0.01);

  const trunkPath = [
    new BABYLON.Vector3(0, 0, 0),
    new BABYLON.Vector3(0.08, 0.9, 0),
    new BABYLON.Vector3(-0.05, 1.8, 0),
    new BABYLON.Vector3(0.12, 2.8, 0),
    new BABYLON.Vector3(0.06, 3.7, 0)
  ];
  const trunk = BABYLON.MeshBuilder.CreateTube(`tree-trunk-${seed}`, {
    path: trunkPath,
    radius: 0.2,
    tessellation: 7,
    cap: BABYLON.Mesh.CAP_ALL
  }, scene);
  trunk.material = bark;
  trunk.parent = root;

  const clusters = [
    new BABYLON.Vector3(-0.5, 2.55, 0.05),
    new BABYLON.Vector3(0.5, 2.75, 0.1),
    new BABYLON.Vector3(0, 3.25, 0),
    new BABYLON.Vector3(-0.2, 3.65, -0.05)
  ];
  clusters.forEach((clusterPosition, clusterIndex) => {
    const crown = BABYLON.MeshBuilder.CreatePolyhedron(`tree-crown-${seed}-${clusterIndex}`, {
      type: (clusterIndex + seed) % 4,
      size: 0.88 + clusterIndex * 0.08
    }, scene);
    crown.material = leaf;
    crown.scaling = new BABYLON.Vector3(1.2, 0.9, 1.05);
    crown.position.copyFrom(clusterPosition);
    crown.rotation.y = seed * 0.47 + clusterIndex;
    crown.parent = root;
  });
  return root;
};

export const createRock = (scene: any, position: any, scale: number, seed: number): any => {
  const rock = BABYLON.MeshBuilder.CreatePolyhedron(`windscar-rock-${seed}`, {
    type: seed % 5,
    size: scale
  }, scene);
  rock.material = createMaterial(scene, `rock-mat-${seed}`, seed % 2 ? "#4f5e5d" : "#596861", 0.95, 0.01);
  rock.position.copyFrom(position);
  rock.scaling = new BABYLON.Vector3(1.15 + (seed % 3) * 0.18, 0.7 + (seed % 4) * 0.11, 0.9);
  rock.rotation = new BABYLON.Vector3(seed * 0.31, seed * 0.77, seed * 0.13);
  rock.receiveShadows = true;
  return rock;
};

export const createMegastructurePillar = (scene: any, position: any, scale: number, index: number): any => {
  const root = new BABYLON.TransformNode(`foundation-pillar-${index}`, scene);
  root.position.copyFrom(position);
  root.scaling = new BABYLON.Vector3(scale, scale, scale);
  const stone = createMaterial(scene, `pillar-stone-${index}`, "#344952", 0.75, 0.22);
  const glow = createMaterial(scene, `pillar-glow-${index}`, "#79e8ff", 0.2, 0.28, "#2ecbe8");
  const shaft = BABYLON.MeshBuilder.CreateCylinder(`pillar-shaft-${index}`, {
    height: 126,
    diameterTop: 9.8,
    diameterBottom: 14,
    tessellation: 16
  }, scene);
  shaft.material = stone;
  shaft.position.y = 63;
  shaft.parent = root;

  [10, 34, 58, 82, 106].forEach((height, ringIndex) => {
    const ring = BABYLON.MeshBuilder.CreateTorus(`pillar-ring-${index}-${ringIndex}`, {
      diameter: 13 - ringIndex * 0.4,
      thickness: 0.55,
      tessellation: 24
    }, scene);
    ring.material = ringIndex % 2 ? glow : stone;
    ring.position.y = height;
    ring.rotation.x = Math.PI / 2;
    ring.parent = root;
  });
  return root;
};

export const createGate = (scene: any, position: any): any => {
  const root = new BABYLON.TransformNode("caelus-gate", scene);
  root.position.copyFrom(position);
  const stone = createMaterial(scene, "gate-stone", "#3f5360", 0.76, 0.15);
  const roof = createMaterial(scene, "gate-roof", "#24435a", 0.74, 0.18);
  const gold = createMaterial(scene, "gate-gold", "#d2ad62", 0.3, 0.7);
  const glow = createMaterial(scene, "gate-light", "#6beeff", 0.18, 0.2, "#27cbef");

  [-1, 1].forEach((side) => {
    const tower = BABYLON.MeshBuilder.CreateCylinder(`gate-tower-${side}`, {
      height: 12,
      diameterTop: 4.2,
      diameterBottom: 5.1,
      tessellation: 10
    }, scene);
    tower.material = stone;
    tower.position = new BABYLON.Vector3(side * 5.1, 6, 0);
    tower.parent = root;

    const crown = BABYLON.MeshBuilder.CreateCylinder(`gate-crown-${side}`, {
      height: 2.1,
      diameterTop: 5.3,
      diameterBottom: 4.5,
      tessellation: 10
    }, scene);
    crown.material = roof;
    crown.position = new BABYLON.Vector3(side * 5.1, 12.6, 0);
    crown.parent = root;

    const rune = BABYLON.MeshBuilder.CreateTorus(`gate-rune-${side}`, {
      diameter: 1.3,
      thickness: 0.1,
      tessellation: 18
    }, scene);
    rune.material = glow;
    rune.position = new BABYLON.Vector3(side * 5.1, 8.2, 2.2);
    rune.rotation.x = Math.PI / 2;
    rune.parent = root;
  });

  const bridge = BABYLON.MeshBuilder.CreateCylinder("gate-bridge", {
    height: 10.2,
    diameter: 0.72,
    tessellation: 12
  }, scene);
  bridge.material = gold;
  bridge.rotation.z = Math.PI / 2;
  bridge.position.y = 10.5;
  bridge.parent = root;

  const archSegments = 15;
  for (let segment = 0; segment < archSegments; segment += 1) {
    const angle = Math.PI * (segment / (archSegments - 1));
    const block = BABYLON.MeshBuilder.CreateCylinder(`gate-arch-${segment}`, {
      height: 0.8,
      diameterTop: 0.68,
      diameterBottom: 0.9,
      tessellation: 6
    }, scene);
    block.material = stone;
    block.position = new BABYLON.Vector3(Math.cos(angle) * 4.2, 6.1 + Math.sin(angle) * 4.2, 0);
    block.rotation.z = -angle + Math.PI / 2;
    block.parent = root;
  }
  return root;
};

export const createAqueduct = (scene: any, position: any): any => {
  const root = new BABYLON.TransformNode("broken-aqueduct", scene);
  root.position.copyFrom(position);
  const stone = createMaterial(scene, "aqueduct-stone", "#68706b", 0.94, 0.01);
  const moss = createMaterial(scene, "aqueduct-moss", "#476c50", 1, 0);
  for (let span = 0; span < 5; span += 1) {
    const x = (span - 2) * 6.2;
    const column = BABYLON.MeshBuilder.CreateCylinder(`aqueduct-column-${span}`, {
      height: 8.5 - Math.max(0, span - 3) * 1.7,
      diameterTop: 1.2,
      diameterBottom: 1.7,
      tessellation: 8
    }, scene);
    column.material = stone;
    column.position = new BABYLON.Vector3(x, column.getBoundingInfo().boundingBox.extendSize.y, 0);
    column.parent = root;
    const cap = BABYLON.MeshBuilder.CreatePolyhedron(`aqueduct-cap-${span}`, { type: 1, size: 1.2 }, scene);
    cap.material = moss;
    cap.scaling = new BABYLON.Vector3(1.5, 0.28, 1.15);
    cap.position = new BABYLON.Vector3(x, 8.35 - Math.max(0, span - 3) * 1.7, 0);
    cap.parent = root;
  }
  const channel = BABYLON.MeshBuilder.CreateCylinder("aqueduct-channel", {
    height: 25.4,
    diameter: 1.05,
    tessellation: 8
  }, scene);
  channel.material = stone;
  channel.rotation.z = Math.PI / 2;
  channel.position = new BABYLON.Vector3(-1.4, 8.7, 0);
  channel.parent = root;
  return root;
};

export const createResonantMarker = (scene: any, position: any): any => {
  const root = new BABYLON.TransformNode("resonant-marker", scene);
  root.position.copyFrom(position);
  const stone = createMaterial(scene, "marker-stone", "#283d46", 0.62, 0.25);
  const glow = createMaterial(scene, "marker-glow", "#6beeff", 0.12, 0.25, "#34ddff");

  const obelisk = BABYLON.MeshBuilder.CreateCylinder("marker-obelisk", {
    height: 3.8,
    diameterTop: 0.08,
    diameterBottom: 1.25,
    tessellation: 5
  }, scene);
  obelisk.material = stone;
  obelisk.position.y = 1.9;
  obelisk.parent = root;

  [0.8, 1.55, 2.3].forEach((height, index) => {
    const ring = BABYLON.MeshBuilder.CreateTorus(`marker-ring-${index}`, {
      diameter: 1.16 - index * 0.22,
      thickness: 0.045,
      tessellation: 16
    }, scene);
    ring.material = glow;
    ring.position.y = height;
    ring.rotation.x = Math.PI / 2;
    ring.parent = root;
  });
  return root;
};
