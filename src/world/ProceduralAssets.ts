export interface HumanoidVisual {
  root: any;
  hips: any;
  torso: any;
  head: any;
  leftArm: any;
  rightArm: any;
  leftLeg: any;
  rightLeg: any;
  leftUpperArm: any;
  leftForearm: any;
  leftHand: any;
  rightUpperArm: any;
  rightForearm: any;
  rightHand: any;
  leftThigh: any;
  leftShin: any;
  leftFoot: any;
  rightThigh: any;
  rightShin: any;
  rightFoot: any;
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

const limbMesh = (
  scene: any,
  name: string,
  height: number,
  top: number,
  bottom: number,
  material: any
): any => {
  const mesh = BABYLON.MeshBuilder.CreateCylinder(name, {
    height,
    diameterTop: top,
    diameterBottom: bottom,
    tessellation: 8
  }, scene);
  mesh.material = material;
  return mesh;
};

const createHand = (scene: any, name: string, material: any): any => {
  const hand = BABYLON.MeshBuilder.CreateSphere(name, { diameter: 0.19, segments: 8 }, scene);
  hand.scaling = new BABYLON.Vector3(0.78, 1, 0.82);
  hand.material = material;
  return hand;
};

export const createRiftglassSword = (
  scene: any,
  name: string,
  glowMaterial?: any,
  darkMaterial?: any
): any => {
  const glow = glowMaterial ?? createMaterial(scene, `${name}-glow`, "#76efff", 0.12, 0.2, "#35d8ff");
  const dark = darkMaterial ?? createMaterial(scene, `${name}-metal`, "#2b3740", 0.28, 0.76);
  const gripMaterial = createMaterial(scene, `${name}-grip-material`, "#594637", 0.8, 0.08);
  const root = new BABYLON.TransformNode(`${name}-root`, scene);

  const grip = BABYLON.MeshBuilder.CreateCylinder(`${name}-grip`, {
    height: 0.42,
    diameterTop: 0.095,
    diameterBottom: 0.115,
    tessellation: 10
  }, scene);
  grip.position.y = 0.06;
  grip.material = gripMaterial;
  grip.parent = root;

  const pommel = BABYLON.MeshBuilder.CreatePolyhedron(`${name}-pommel`, { type: 1, size: 0.14 }, scene);
  pommel.position.y = -0.2;
  pommel.material = glow;
  pommel.parent = root;

  const guard = BABYLON.MeshBuilder.CreateCylinder(`${name}-guard`, {
    height: 0.62,
    diameter: 0.075,
    tessellation: 10
  }, scene);
  guard.position.y = 0.3;
  guard.rotation.z = Math.PI / 2;
  guard.material = dark;
  guard.parent = root;

  const bladeBase = BABYLON.MeshBuilder.CreateBox(`${name}-blade-base`, {
    width: 0.21,
    height: 0.32,
    depth: 0.085
  }, scene);
  bladeBase.position.y = 0.49;
  bladeBase.material = dark;
  bladeBase.parent = root;

  const blade = BABYLON.MeshBuilder.CreateCylinder(`${name}-blade`, {
    height: 1.58,
    diameterTop: 0.035,
    diameterBottom: 0.19,
    tessellation: 4
  }, scene);
  blade.position.y = 1.36;
  blade.rotation.y = Math.PI / 4;
  blade.material = glow;
  blade.parent = root;

  const fuller = BABYLON.MeshBuilder.CreateCylinder(`${name}-fuller`, {
    height: 1.22,
    diameterTop: 0.012,
    diameterBottom: 0.045,
    tessellation: 4
  }, scene);
  fuller.position.y = 1.29;
  fuller.rotation.y = Math.PI / 4;
  fuller.material = dark;
  fuller.parent = root;

  root.metadata = { connectedWeapon: true, grip, guard, blade };
  return root;
};

const createCape = (scene: any, material: any): any => {
  const paths: any[][] = [];
  for (let row = 0; row < 6; row += 1) {
    const y = 0.37 - row * 0.29;
    const width = 0.4 + row * 0.075;
    const back = -0.21 - row * 0.04;
    paths.push([
      new BABYLON.Vector3(-width, y, back),
      new BABYLON.Vector3(0, y - 0.03, back - 0.06),
      new BABYLON.Vector3(width, y, back)
    ]);
  }
  const cape = BABYLON.MeshBuilder.CreateRibbon("warden-cape", {
    pathArray: paths,
    closeArray: false,
    closePath: false,
    sideOrientation: BABYLON.Mesh.DOUBLESIDE
  }, scene);
  cape.material = material;
  return cape;
};

const createArmRig = (
  scene: any,
  prefix: string,
  torso: any,
  shoulderX: number,
  armor: any,
  cloth: any,
  skin: any
): { upper: any; forearm: any; hand: any } => {
  const upper = new BABYLON.TransformNode(`${prefix}-upper-arm`, scene);
  upper.parent = torso;
  upper.position = new BABYLON.Vector3(shoulderX, 0.31, 0);

  const upperMesh = limbMesh(scene, `${prefix}-upper-arm-mesh`, 0.56, 0.25, 0.2, armor);
  upperMesh.position.y = -0.25;
  upperMesh.parent = upper;

  const elbow = BABYLON.MeshBuilder.CreateSphere(`${prefix}-elbow`, { diameter: 0.22, segments: 8 }, scene);
  elbow.position.y = -0.53;
  elbow.material = armor;
  elbow.parent = upper;

  const forearm = new BABYLON.TransformNode(`${prefix}-forearm`, scene);
  forearm.parent = upper;
  forearm.position = new BABYLON.Vector3(0, -0.53, 0);

  const forearmMesh = limbMesh(scene, `${prefix}-forearm-mesh`, 0.48, 0.2, 0.145, cloth);
  forearmMesh.position.y = -0.21;
  forearmMesh.parent = forearm;

  const handNode = new BABYLON.TransformNode(`${prefix}-hand`, scene);
  handNode.parent = forearm;
  handNode.position = new BABYLON.Vector3(0, -0.45, 0);
  const handMesh = createHand(scene, `${prefix}-hand-mesh`, skin);
  handMesh.parent = handNode;

  return { upper, forearm, hand: handNode };
};

const createLegRig = (
  scene: any,
  prefix: string,
  hips: any,
  hipX: number,
  armor: any,
  cloth: any
): { thigh: any; shin: any; foot: any } => {
  const thigh = new BABYLON.TransformNode(`${prefix}-thigh`, scene);
  thigh.parent = hips;
  thigh.position = new BABYLON.Vector3(hipX, -0.05, 0);

  const thighMesh = limbMesh(scene, `${prefix}-thigh-mesh`, 0.66, 0.28, 0.22, armor);
  thighMesh.position.y = -0.29;
  thighMesh.parent = thigh;

  const knee = BABYLON.MeshBuilder.CreateSphere(`${prefix}-knee`, { diameter: 0.24, segments: 8 }, scene);
  knee.position.y = -0.62;
  knee.scaling.z = 0.78;
  knee.material = armor;
  knee.parent = thigh;

  const shin = new BABYLON.TransformNode(`${prefix}-shin`, scene);
  shin.parent = thigh;
  shin.position = new BABYLON.Vector3(0, -0.63, 0);

  const shinMesh = limbMesh(scene, `${prefix}-shin-mesh`, 0.61, 0.22, 0.16, cloth);
  shinMesh.position.y = -0.27;
  shinMesh.parent = shin;

  const foot = new BABYLON.TransformNode(`${prefix}-foot`, scene);
  foot.parent = shin;
  foot.position = new BABYLON.Vector3(0, -0.57, 0.08);
  const boot = BABYLON.MeshBuilder.CreateBox(`${prefix}-boot`, {
    width: 0.24,
    height: 0.18,
    depth: 0.42
  }, scene);
  boot.position.z = 0.11;
  boot.material = cloth;
  boot.parent = foot;

  return { thigh, shin, foot };
};

export const createWarden = (scene: any): HumanoidVisual => {
  const root = new BABYLON.TransformNode("warden-root", scene);
  const hips = new BABYLON.TransformNode("warden-hips", scene);
  hips.parent = root;
  hips.position.y = 1.25;

  const armor = createMaterial(scene, "warden-armor", "#2b4352", 0.36, 0.46);
  const cloth = createMaterial(scene, "warden-cloth", "#142631", 0.9, 0.02);
  const trim = createMaterial(scene, "warden-trim", "#d2af69", 0.28, 0.72);
  const glow = createMaterial(scene, "warden-riftglass", "#79efff", 0.14, 0.24, "#32d9ff");
  const skin = createMaterial(scene, "warden-skin", "#c58f72", 0.82, 0.01);
  const capeMaterial = createMaterial(scene, "warden-cape-mat", "#31425f", 0.95, 0.01);
  capeMaterial.backFaceCulling = false;

  const waist = BABYLON.MeshBuilder.CreateCylinder("warden-waist", {
    height: 0.26,
    diameterTop: 0.54,
    diameterBottom: 0.58,
    tessellation: 8
  }, scene);
  waist.position.y = 0.05;
  waist.material = cloth;
  waist.parent = hips;

  const torso = new BABYLON.TransformNode("warden-torso-rig", scene);
  torso.parent = hips;
  torso.position.y = 0.54;
  const chest = BABYLON.MeshBuilder.CreateCylinder("warden-torso", {
    height: 0.9,
    diameterTop: 0.78,
    diameterBottom: 0.52,
    tessellation: 8
  }, scene);
  chest.material = armor;
  chest.parent = torso;

  const chestRune = BABYLON.MeshBuilder.CreateTorus("warden-chest-rune", {
    diameter: 0.31,
    thickness: 0.027,
    tessellation: 18
  }, scene);
  chestRune.position = new BABYLON.Vector3(0, 0.08, 0.37);
  chestRune.rotation.x = Math.PI / 2;
  chestRune.material = glow;
  chestRune.parent = torso;

  const leftPauldron = BABYLON.MeshBuilder.CreatePolyhedron("warden-left-pauldron", { type: 1, size: 0.38 }, scene);
  leftPauldron.position = new BABYLON.Vector3(-0.49, 0.33, 0);
  leftPauldron.scaling = new BABYLON.Vector3(1.3, 0.62, 1);
  leftPauldron.material = trim;
  leftPauldron.parent = torso;
  const rightPauldron = leftPauldron.clone("warden-right-pauldron");
  rightPauldron.position.x = 0.49;
  rightPauldron.parent = torso;

  const neck = limbMesh(scene, "warden-neck", 0.18, 0.18, 0.2, skin);
  neck.position.y = 0.55;
  neck.parent = torso;

  const head = new BABYLON.TransformNode("warden-head-rig", scene);
  head.parent = torso;
  head.position.y = 0.8;
  const headMesh = BABYLON.MeshBuilder.CreateSphere("warden-head", { diameter: 0.38, segments: 12 }, scene);
  headMesh.scaling.y = 1.08;
  headMesh.material = skin;
  headMesh.parent = head;

  const helmet = BABYLON.MeshBuilder.CreatePolyhedron("warden-helmet", { type: 2, size: 0.33 }, scene);
  helmet.position.y = 0.03;
  helmet.scaling = new BABYLON.Vector3(0.92, 0.92, 0.98);
  helmet.material = armor;
  helmet.parent = head;

  const visor = BABYLON.MeshBuilder.CreateCylinder("warden-visor", {
    height: 0.26,
    diameterTop: 0.17,
    diameterBottom: 0.3,
    tessellation: 4
  }, scene);
  visor.position = new BABYLON.Vector3(0, 0, 0.25);
  visor.rotation = new BABYLON.Vector3(Math.PI / 2, Math.PI / 4, 0);
  visor.scaling.z = 0.28;
  visor.material = glow;
  visor.parent = head;

  const leftArmRig = createArmRig(scene, "warden-left", torso, -0.5, armor, cloth, skin);
  const rightArmRig = createArmRig(scene, "warden-right", torso, 0.5, armor, cloth, skin);
  const leftLegRig = createLegRig(scene, "warden-left", hips, -0.18, armor, cloth);
  const rightLegRig = createLegRig(scene, "warden-right", hips, 0.18, armor, cloth);

  const sword = createRiftglassSword(scene, "riftglass-edge", glow, trim);
  sword.parent = rightArmRig.hand;
  sword.position = new BABYLON.Vector3(0, -0.02, 0.01);
  sword.rotation = new BABYLON.Vector3(-Math.PI / 2, 0, -0.08);

  const cape = createCape(scene, capeMaterial);
  cape.parent = torso;
  cape.position = new BABYLON.Vector3(0, 0.2, -0.35);

  return {
    root,
    hips,
    torso,
    head,
    leftArm: leftArmRig.upper,
    rightArm: rightArmRig.upper,
    leftLeg: leftLegRig.thigh,
    rightLeg: rightLegRig.thigh,
    leftUpperArm: leftArmRig.upper,
    leftForearm: leftArmRig.forearm,
    leftHand: leftArmRig.hand,
    rightUpperArm: rightArmRig.upper,
    rightForearm: rightArmRig.forearm,
    rightHand: rightArmRig.hand,
    leftThigh: leftLegRig.thigh,
    leftShin: leftLegRig.shin,
    leftFoot: leftLegRig.foot,
    rightThigh: rightLegRig.thigh,
    rightShin: rightLegRig.shin,
    rightFoot: rightLegRig.foot,
    sword,
    cape,
    rune: chestRune
  };
};

export const createMara = (scene: any): HumanoidVisual => {
  const visual = createWarden(scene);
  visual.root.name = "mara-venn-root";
  visual.root.scaling = new BABYLON.Vector3(0.94, 0.94, 0.94);
  visual.sword.setEnabled(false);
  visual.cape.material = createMaterial(scene, "mara-cape", "#744d62", 0.94, 0.01);
  visual.torso.getChildMeshes().forEach((mesh: any) => {
    if (mesh.name.includes("torso")) {
      mesh.material = createMaterial(scene, "mara-armor", "#4b5365", 0.5, 0.3);
    }
  });
  return visual;
};

export const createRiftBoar = (scene: any, index: number): BoarVisual => {
  const root = new BABYLON.TransformNode(`rift-boar-${index}`, scene);
  const fur = createMaterial(scene, `rift-boar-fur-${index}`, "#4e5350", 0.92, 0.02);
  const armor = createMaterial(scene, `rift-boar-plate-${index}`, "#303d43", 0.52, 0.42);
  const tuskMaterial = createMaterial(scene, `rift-boar-tusk-${index}`, "#d7d0a9", 0.78, 0.04);
  const glow = createMaterial(scene, `rift-boar-rune-${index}`, "#78edf1", 0.12, 0.14, "#2bd4dc");

  const body = BABYLON.MeshBuilder.CreatePolyhedron(`rift-boar-body-${index}`, { type: 2, size: 0.95 }, scene);
  body.position.y = 0.85;
  body.scaling = new BABYLON.Vector3(1.35, 0.85, 1.75);
  body.material = fur;
  body.parent = root;

  const shoulderPlate = BABYLON.MeshBuilder.CreatePolyhedron(`rift-boar-plate-${index}`, { type: 1, size: 0.72 }, scene);
  shoulderPlate.position = new BABYLON.Vector3(0, 1.18, 0.05);
  shoulderPlate.scaling = new BABYLON.Vector3(1.3, 0.48, 1.2);
  shoulderPlate.material = armor;
  shoulderPlate.parent = root;

  const head = new BABYLON.TransformNode(`rift-boar-head-rig-${index}`, scene);
  head.parent = root;
  head.position = new BABYLON.Vector3(0, 0.8, 1.35);
  const headMesh = BABYLON.MeshBuilder.CreatePolyhedron(`rift-boar-head-${index}`, { type: 1, size: 0.72 }, scene);
  headMesh.scaling = new BABYLON.Vector3(1.05, 0.8, 1.15);
  headMesh.material = fur;
  headMesh.parent = head;

  const tusks: any[] = [];
  [-1, 1].forEach((side) => {
    const tusk = BABYLON.MeshBuilder.CreateCylinder(`rift-boar-tusk-${index}-${side}`, {
      height: 0.62,
      diameterTop: 0.02,
      diameterBottom: 0.13,
      tessellation: 6
    }, scene);
    tusk.position = new BABYLON.Vector3(side * 0.34, -0.04, 0.47);
    tusk.rotation.x = Math.PI / 2 - 0.35;
    tusk.rotation.z = side * -0.25;
    tusk.material = tuskMaterial;
    tusk.parent = head;
    tusks.push(tusk);
  });

  const rune = BABYLON.MeshBuilder.CreateTorus(`rift-boar-rune-${index}`, {
    diameter: 0.42,
    thickness: 0.045,
    tessellation: 16
  }, scene);
  rune.position = new BABYLON.Vector3(0, 0.08, 0.69);
  rune.rotation.x = Math.PI / 2;
  rune.material = glow;
  rune.parent = head;

  const legs: any[] = [];
  [
    [-0.47, 0.62],
    [0.47, 0.62],
    [-0.47, -0.62],
    [0.47, -0.62]
  ].forEach(([x, z], legIndex) => {
    const leg = new BABYLON.TransformNode(`rift-boar-leg-rig-${index}-${legIndex}`, scene);
    leg.parent = root;
    leg.position = new BABYLON.Vector3(x, 0.5, z);
    const mesh = limbMesh(scene, `rift-boar-leg-${index}-${legIndex}`, 0.72, 0.22, 0.15, fur);
    mesh.position.y = -0.31;
    mesh.parent = leg;
    legs.push(leg);
  });

  return { root, body, head, legs, rune, tusks };
};

export const createTree = (scene: any, position: any, scale: number, index: number): any => {
  const root = new BABYLON.TransformNode(`windscar-tree-${index}`, scene);
  root.position.copyFrom(position);
  root.scaling.setAll(scale);
  root.rotation.y = (index * 1.618) % (Math.PI * 2);
  const bark = createMaterial(scene, `tree-bark-${index}`, "#594b3c", 0.96, 0.01);
  const leafA = createMaterial(scene, `tree-leaf-a-${index}`, "#6d8c63", 0.94, 0.01);
  const leafB = createMaterial(scene, `tree-leaf-b-${index}`, "#88a36f", 0.94, 0.01);

  const trunk = BABYLON.MeshBuilder.CreateCylinder(`tree-trunk-${index}`, {
    height: 3.8,
    diameterTop: 0.28,
    diameterBottom: 0.58,
    tessellation: 6
  }, scene);
  trunk.position.y = 1.9;
  trunk.rotation.z = ((index % 5) - 2) * 0.025;
  trunk.material = bark;
  trunk.parent = root;

  for (let layer = 0; layer < 4; layer += 1) {
    const crown = BABYLON.MeshBuilder.CreatePolyhedron(`tree-crown-${index}-${layer}`, {
      type: layer % 2,
      size: 1.25 - layer * 0.1
    }, scene);
    crown.position = new BABYLON.Vector3(
      ((layer % 2) - 0.5) * 0.38,
      3.1 + layer * 0.55,
      ((layer + index) % 3 - 1) * 0.18
    );
    crown.scaling = new BABYLON.Vector3(1.35 - layer * 0.08, 0.72, 1.15);
    crown.material = layer % 2 ? leafA : leafB;
    crown.parent = root;
  }
  return root;
};

export const createRock = (scene: any, position: any, scale: number, index: number): any => {
  const rock = BABYLON.MeshBuilder.CreatePolyhedron(`windscar-rock-${index}`, {
    type: index % 5,
    size: scale
  }, scene);
  rock.position.copyFrom(position);
  rock.scaling = new BABYLON.Vector3(1.2 + (index % 3) * 0.12, 0.7 + (index % 4) * 0.1, 1);
  rock.rotation = new BABYLON.Vector3(index * 0.13, index * 0.71, index * 0.09);
  rock.material = createMaterial(scene, `windscar-rock-material-${index}`, index % 3 === 0 ? "#647064" : "#56645c", 0.96, 0.01);
  rock.receiveShadows = true;
  return rock;
};

export const createGate = (scene: any, position: any): any => {
  const root = new BABYLON.TransformNode("caelus-gate-root", scene);
  root.position.copyFrom(position);
  const stone = createMaterial(scene, "gate-stone", "#53686d", 0.78, 0.16);
  const trim = createMaterial(scene, "gate-trim", "#c8aa68", 0.34, 0.65);
  const glow = createMaterial(scene, "gate-rune", "#76edf1", 0.12, 0.2, "#34d5de");

  [-1, 1].forEach((side) => {
    const tower = BABYLON.MeshBuilder.CreateCylinder(`gate-tower-${side}`, {
      height: 13,
      diameterTop: 5.8,
      diameterBottom: 7,
      tessellation: 10
    }, scene);
    tower.position = new BABYLON.Vector3(side * 7.2, 6.5, 0);
    tower.material = stone;
    tower.parent = root;
    const rune = BABYLON.MeshBuilder.CreateTorus(`gate-rune-${side}`, {
      diameter: 2.2,
      thickness: 0.16,
      tessellation: 20
    }, scene);
    rune.position = new BABYLON.Vector3(side * 7.2, 8, 3);
    rune.rotation.x = Math.PI / 2;
    rune.material = glow;
    rune.parent = root;
  });
  const beam = BABYLON.MeshBuilder.CreateBox("gate-beam", { width: 14.4, height: 1.2, depth: 2 }, scene);
  beam.position.y = 12.2;
  beam.material = trim;
  beam.parent = root;
  return root;
};

export const createAqueduct = (scene: any, position: any): any => {
  const root = new BABYLON.TransformNode("broken-aqueduct", scene);
  root.position.copyFrom(position);
  const stone = createMaterial(scene, "aqueduct-stone", "#778078", 0.94, 0.02);
  for (let index = 0; index < 7; index += 1) {
    const column = BABYLON.MeshBuilder.CreateCylinder(`aqueduct-column-${index}`, {
      height: 8.5 - (index === 0 || index === 6 ? 1.5 : 0),
      diameterTop: 1.15,
      diameterBottom: 1.45,
      tessellation: 8
    }, scene);
    column.position = new BABYLON.Vector3((index - 3) * 4.2, 4.25, 0);
    column.rotation.z = index === 0 ? -0.1 : index === 6 ? 0.12 : 0;
    column.material = stone;
    column.parent = root;
    const cap = BABYLON.MeshBuilder.CreateBox(`aqueduct-cap-${index}`, {
      width: 2.1,
      height: 0.55,
      depth: 2.1
    }, scene);
    cap.position = new BABYLON.Vector3((index - 3) * 4.2, 8.7, 0);
    cap.material = stone;
    cap.parent = root;
  }
  const channel = BABYLON.MeshBuilder.CreateBox("aqueduct-channel", { width: 27, height: 1, depth: 2.2 }, scene);
  channel.position.y = 9.4;
  channel.material = stone;
  channel.parent = root;
  return root;
};

export const createMegastructurePillar = (
  scene: any,
  position: any,
  scale: number,
  index: number
): any => {
  const root = new BABYLON.TransformNode(`foundation-pillar-${index}`, scene);
  root.position.copyFrom(position);
  root.scaling.setAll(scale);
  const stone = createMaterial(scene, `pillar-stone-${index}`, "#3c5259", 0.5, 0.4);
  const glow = createMaterial(scene, `pillar-glow-${index}`, "#75eaf0", 0.12, 0.16, "#31cfd7");
  const shaft = BABYLON.MeshBuilder.CreateCylinder(`pillar-shaft-${index}`, {
    height: 105,
    diameterTop: 15,
    diameterBottom: 21,
    tessellation: 12
  }, scene);
  shaft.position.y = 52.5;
  shaft.material = stone;
  shaft.parent = root;
  const collar = BABYLON.MeshBuilder.CreateTorus(`pillar-collar-${index}`, {
    diameter: 18,
    thickness: 0.65,
    tessellation: 28
  }, scene);
  collar.position.y = 67;
  collar.rotation.x = Math.PI / 2;
  collar.material = glow;
  collar.parent = root;
  const head = BABYLON.MeshBuilder.CreateCylinder(`pillar-head-${index}`, {
    height: 8,
    diameterTop: 29,
    diameterBottom: 18,
    tessellation: 12
  }, scene);
  head.position.y = 108;
  head.material = stone;
  head.parent = root;
  return root;
};

export const createResonantMarker = (scene: any, position: any): any => {
  const root = new BABYLON.TransformNode("resonant-marker", scene);
  root.position.copyFrom(position);
  const stone = createMaterial(scene, "marker-stone", "#40555a", 0.72, 0.25);
  const glow = createMaterial(scene, "marker-glow", "#74edf1", 0.1, 0.18, "#2dd5dc");
  const base = BABYLON.MeshBuilder.CreateCylinder("marker-base", {
    height: 1,
    diameterTop: 2.8,
    diameterBottom: 3.6,
    tessellation: 8
  }, scene);
  base.position.y = 0.5;
  base.material = stone;
  base.parent = root;
  const crystal = BABYLON.MeshBuilder.CreatePolyhedron("marker-crystal", { type: 1, size: 1.15 }, scene);
  crystal.position.y = 2.1;
  crystal.scaling.y = 1.7;
  crystal.material = glow;
  crystal.parent = root;
  [2.8, 4, 5.2].forEach((diameter, index) => {
    const ring = BABYLON.MeshBuilder.CreateTorus(`marker-ring-${index}`, {
      diameter,
      thickness: 0.12,
      tessellation: 20
    }, scene);
    ring.position.y = 2.1;
    ring.rotation = new BABYLON.Vector3(index * 0.5, index * 0.7, index * 0.3);
    ring.material = glow;
    ring.parent = root;
  });
  return root;
};
