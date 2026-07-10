import { createMaterial } from "../world/ProceduralAssets.js";

interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface HazardBlade {
  rig: any;
  blade: any;
  phase: number;
}

const planarDistance = (a: any, b: any): number => Math.hypot(a.x - b.x, a.z - b.z);

export class FloorTwoArrivalDirector {
  private readonly world: any;
  private readonly player: any;
  private readonly expedition: any;
  private readonly hud: any;
  private readonly audio: any;
  private readonly centerX: number;
  private readonly centerZ: number;
  private readonly upperFloorY: number;
  private readonly minX: number;
  private readonly maxX: number;
  private readonly minZ: number;
  private readonly maxZ: number;
  private readonly returnConsolePosition: any;
  private readonly surveyConsolePosition: any;
  private readonly fragmentPosition: any;
  private readonly sealPosition: any;
  private readonly objective: HTMLDivElement;
  private readonly zoneTitle: HTMLDivElement;
  private readonly hazardRoot: any;
  private readonly hazardBlades: HazardBlade[] = [];
  private readonly upperCollisions: CollisionBox[] = [];
  private readonly originalHeightAt: (x: number, z: number) => number;
  private readonly originalResolvePlayerPosition: (position: any, previous: any) => void;
  private readonly originalPlayerUpdate: (...args: any[]) => void;
  private readonly originalUpdateInteraction: (input: any) => void;
  private upperActive = false;
  private resolvingPlayer = false;
  private hazardTime = 0;
  private hazardDamageCooldown = 0;
  private lastObjective = "";

  constructor(private readonly game: any) {
    this.world = game.world;
    this.player = game.player;
    this.expedition = game.expedition;
    this.hud = game.hud;
    this.audio = game.audio;
    this.centerX = Number(this.expedition.liftRoot.position.x);
    this.centerZ = Number(this.expedition.liftRoot.position.z) - 27;
    this.upperFloorY = Number(this.expedition.liftTopY) + 0.06;
    this.minX = this.centerX - 43;
    this.maxX = this.centerX + 43;
    this.minZ = this.centerZ - 34;
    this.maxZ = this.centerZ + 36;
    this.returnConsolePosition = new BABYLON.Vector3(this.centerX + 5.4, this.upperFloorY, this.maxZ - 2.5);
    this.surveyConsolePosition = new BABYLON.Vector3(this.centerX - 27, this.upperFloorY, this.centerZ - 3);
    this.fragmentPosition = new BABYLON.Vector3(this.centerX + 25, this.upperFloorY, this.centerZ - 16);
    this.sealPosition = new BABYLON.Vector3(this.centerX, this.upperFloorY, this.minZ + 2.2);

    this.installStyles();
    this.objective = document.createElement("div");
    this.objective.className = "floor-two-objective";
    this.zoneTitle = document.createElement("div");
    this.zoneTitle.className = "floor-two-zone-title";
    this.zoneTitle.innerHTML = "<small>FLOOR II THRESHOLD</small><strong>The Aerial Scar</strong><span>Upper Foundation staging terrace</span>";
    document.body.append(this.objective, this.zoneTitle);

    this.hazardRoot = this.createArrivalZone();
    this.originalHeightAt = this.world.heightAt.bind(this.world);
    this.originalResolvePlayerPosition = this.world.resolvePlayerPosition.bind(this.world);
    this.originalPlayerUpdate = this.player.update.bind(this.player);
    this.originalUpdateInteraction = this.game.updateInteraction.bind(this.game);
    this.installMovementSurface();
    this.installProgressionHooks();
    this.world.scene.onBeforeRenderObservable.add(() => this.update());
    this.refreshProgressVisuals();
  }

  private createArrivalZone(): any {
    const scene = this.world.scene;
    const stone = createMaterial(scene, "floor-two-arrival-stone", "#42555c", 0.82, 0.2);
    const dark = createMaterial(scene, "floor-two-arrival-dark", "#1c2c33", 0.68, 0.34);
    const metal = createMaterial(scene, "floor-two-arrival-metal", "#52646d", 0.34, 0.68);
    const glow = createMaterial(scene, "floor-two-arrival-glow", "#b7fff2", 0.1, 0.14, "#48ead6");
    const warning = createMaterial(scene, "floor-two-rift-shear", "#ffd18a", 0.12, 0.18, "#ff8b48");
    glow.emissiveIntensity = 1.7;
    warning.emissiveIntensity = 2.15;

    const floor = BABYLON.MeshBuilder.CreateBox("floor-two-arrival-terrace", {
      width: this.maxX - this.minX,
      height: 0.72,
      depth: this.maxZ - this.minZ
    }, scene);
    floor.position = new BABYLON.Vector3(this.centerX, this.upperFloorY - 0.36, this.centerZ + 1);
    floor.material = stone;
    floor.receiveShadows = true;

    const innerPlate = BABYLON.MeshBuilder.CreateBox("floor-two-arrival-inner-plate", {
      width: 63,
      height: 0.18,
      depth: 45
    }, scene);
    innerPlate.position = new BABYLON.Vector3(this.centerX, this.upperFloorY + 0.05, this.centerZ - 4);
    innerPlate.material = dark;

    for (let index = 0; index < 7; index += 1) {
      const strip = BABYLON.MeshBuilder.CreateBox(`floor-two-arrival-inlay-${index}`, {
        width: 0.24,
        height: 0.08,
        depth: 42
      }, scene);
      strip.position = new BABYLON.Vector3(this.centerX - 24 + index * 8, this.upperFloorY + 0.16, this.centerZ - 4);
      strip.material = index % 3 === 0 ? glow : metal;
    }

    this.createBoundaryRails(stone, metal, glow);
    this.createSurveyConsole(stone, metal, glow);
    this.createFragmentAltar(stone, dark, glow);
    this.createReturnConsole(metal, glow);
    this.createSealGate(stone, metal, glow);
    this.createStructuralVista(stone, metal, glow);

    const hazardRoot = new BABYLON.TransformNode("floor-two-rift-shear-root", scene);
    hazardRoot.position.copyFrom(this.fragmentPosition.add(new BABYLON.Vector3(0, 1.3, 0)));
    const core = BABYLON.MeshBuilder.CreatePolyhedron("floor-two-rift-shear-core", {
      type: 1,
      size: 0.72
    }, scene);
    core.scaling = new BABYLON.Vector3(0.72, 1.45, 0.72);
    core.material = warning;
    core.parent = hazardRoot;

    const orbitRing = BABYLON.MeshBuilder.CreateTorus("floor-two-rift-shear-ring", {
      diameter: 9.6,
      thickness: 0.08,
      tessellation: 36
    }, scene);
    orbitRing.rotation.x = Math.PI / 2;
    orbitRing.material = warning;
    orbitRing.parent = hazardRoot;

    for (let index = 0; index < 3; index += 1) {
      const rig = new BABYLON.TransformNode(`floor-two-rift-shear-rig-${index}`, scene);
      rig.parent = hazardRoot;
      rig.rotation.y = (index / 3) * Math.PI * 2;
      const blade = BABYLON.MeshBuilder.CreateBox(`floor-two-rift-shear-blade-${index}`, {
        width: 0.24,
        height: 2.7,
        depth: 0.58
      }, scene);
      blade.position = new BABYLON.Vector3(0, index % 2 === 0 ? 0.25 : -0.1, 4.8);
      blade.rotation.x = index % 2 === 0 ? 0.32 : -0.32;
      blade.rotation.z = 0.45;
      blade.material = warning;
      blade.parent = rig;
      this.hazardBlades.push({ rig, blade, phase: index * 1.7 });
    }

    const threshold = scene.getMeshByName?.("floor-two-sealed-threshold");
    if (threshold) {
      threshold.position = new BABYLON.Vector3(this.sealPosition.x, this.upperFloorY + 6.3, this.sealPosition.z);
      threshold.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0);
      threshold.scaling.setAll(1.22);
    }

    for (const mesh of scene.meshes) {
      const name = String(mesh.name ?? "");
      if (!name.startsWith("floor-two-")) continue;
      mesh.isPickable = false;
      if (!name.startsWith("floor-two-rift-shear")) {
        mesh.computeWorldMatrix(true);
        mesh.freezeWorldMatrix();
      }
    }

    return hazardRoot;
  }

  private createBoundaryRails(stone: any, metal: any, glow: any): void {
    const scene = this.world.scene;
    const createRail = (name: string, x: number, z: number, width: number, depth: number): void => {
      const base = BABYLON.MeshBuilder.CreateBox(`${name}-base`, {
        width,
        height: 1.15,
        depth
      }, scene);
      base.position = new BABYLON.Vector3(x, this.upperFloorY + 0.55, z);
      base.material = stone;
      const cap = BABYLON.MeshBuilder.CreateBox(`${name}-cap`, {
        width: width + 0.15,
        height: 0.14,
        depth: depth + 0.15
      }, scene);
      cap.position = new BABYLON.Vector3(x, this.upperFloorY + 1.2, z);
      cap.material = metal;
      this.upperCollisions.push({
        minX: x - width / 2,
        maxX: x + width / 2,
        minZ: z - depth / 2,
        maxZ: z + depth / 2
      });
    };

    createRail("floor-two-west-rail", this.minX + 0.65, this.centerZ + 1, 1.3, this.maxZ - this.minZ);
    createRail("floor-two-east-rail", this.maxX - 0.65, this.centerZ + 1, 1.3, this.maxZ - this.minZ);
    createRail("floor-two-north-rail", this.centerX, this.minZ + 0.65, this.maxX - this.minX, 1.3);
    createRail("floor-two-south-rail-left", this.centerX - 27, this.maxZ - 0.65, 31, 1.3);
    createRail("floor-two-south-rail-right", this.centerX + 27, this.maxZ - 0.65, 31, 1.3);

    for (let index = 0; index < 10; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const z = this.minZ + 8 + Math.floor(index / 2) * 13;
      const pylon = BABYLON.MeshBuilder.CreateCylinder(`floor-two-rail-pylon-${index}`, {
        height: 4.6,
        diameterTop: 0.7,
        diameterBottom: 1.05,
        tessellation: 8
      }, scene);
      pylon.position = new BABYLON.Vector3(side < 0 ? this.minX + 2.4 : this.maxX - 2.4, this.upperFloorY + 2.3, z);
      pylon.material = metal;
      const lamp = BABYLON.MeshBuilder.CreatePolyhedron(`floor-two-rail-lamp-${index}`, {
        type: 1,
        size: 0.38
      }, scene);
      lamp.position = pylon.position.add(new BABYLON.Vector3(0, 2.65, 0));
      lamp.material = glow;
    }
  }

  private createSurveyConsole(stone: any, metal: any, glow: any): void {
    const scene = this.world.scene;
    const plinth = BABYLON.MeshBuilder.CreateCylinder("floor-two-survey-plinth", {
      height: 1.1,
      diameterTop: 5.4,
      diameterBottom: 6.4,
      tessellation: 12
    }, scene);
    plinth.position = this.surveyConsolePosition.add(new BABYLON.Vector3(0, 0.55, 0));
    plinth.material = stone;
    const console = BABYLON.MeshBuilder.CreateBox("floor-two-survey-console", {
      width: 1.7,
      height: 2.4,
      depth: 1.25
    }, scene);
    console.position = this.surveyConsolePosition.add(new BABYLON.Vector3(0, 1.7, 0));
    console.rotation.z = -0.16;
    console.material = metal;
    const lens = BABYLON.MeshBuilder.CreateTorus("floor-two-survey-lens", {
      diameter: 1.05,
      thickness: 0.12,
      tessellation: 24
    }, scene);
    lens.position = this.surveyConsolePosition.add(new BABYLON.Vector3(0, 2.2, 0.68));
    lens.rotation.x = Math.PI / 2;
    lens.material = glow;
    this.upperCollisions.push({
      minX: this.surveyConsolePosition.x - 2.8,
      maxX: this.surveyConsolePosition.x + 2.8,
      minZ: this.surveyConsolePosition.z - 2.8,
      maxZ: this.surveyConsolePosition.z + 2.8
    });
  }

  private createFragmentAltar(stone: any, dark: any, glow: any): void {
    const scene = this.world.scene;
    const base = BABYLON.MeshBuilder.CreateCylinder("floor-two-fragment-altar", {
      height: 1.3,
      diameterTop: 4.6,
      diameterBottom: 6.2,
      tessellation: 10
    }, scene);
    base.position = this.fragmentPosition.add(new BABYLON.Vector3(0, 0.65, 0));
    base.material = stone;
    const inset = BABYLON.MeshBuilder.CreateCylinder("floor-two-fragment-inset", {
      height: 0.18,
      diameter: 3.9,
      tessellation: 20
    }, scene);
    inset.position = this.fragmentPosition.add(new BABYLON.Vector3(0, 1.36, 0));
    inset.material = dark;
    const fragment = BABYLON.MeshBuilder.CreatePolyhedron("floor-two-threshold-fragment", {
      type: 1,
      size: 0.78
    }, scene);
    fragment.position = this.fragmentPosition.add(new BABYLON.Vector3(0, 2.25, 0));
    fragment.scaling = new BABYLON.Vector3(0.58, 1.75, 0.58);
    fragment.material = glow;
    this.upperCollisions.push({
      minX: this.fragmentPosition.x - 2.5,
      maxX: this.fragmentPosition.x + 2.5,
      minZ: this.fragmentPosition.z - 2.5,
      maxZ: this.fragmentPosition.z + 2.5
    });
  }

  private createReturnConsole(metal: any, glow: any): void {
    const scene = this.world.scene;
    const console = BABYLON.MeshBuilder.CreateBox("floor-two-return-console", {
      width: 1.35,
      height: 2.15,
      depth: 1.15
    }, scene);
    console.position = this.returnConsolePosition.add(new BABYLON.Vector3(0, 1.08, 0));
    console.rotation.z = 0.14;
    console.material = metal;
    const rune = BABYLON.MeshBuilder.CreateTorus("floor-two-return-rune", {
      diameter: 0.72,
      thickness: 0.09,
      tessellation: 20
    }, scene);
    rune.position = this.returnConsolePosition.add(new BABYLON.Vector3(0, 1.42, 0.62));
    rune.rotation.x = Math.PI / 2;
    rune.material = glow;
  }

  private createSealGate(stone: any, metal: any, glow: any): void {
    const scene = this.world.scene;
    [-1, 1].forEach((side) => {
      const tower = BABYLON.MeshBuilder.CreateCylinder(`floor-two-seal-tower-${side}`, {
        height: 14,
        diameterTop: 4.6,
        diameterBottom: 6.4,
        tessellation: 10
      }, scene);
      tower.position = new BABYLON.Vector3(this.centerX + side * 11, this.upperFloorY + 7, this.sealPosition.z);
      tower.material = stone;
      const collar = BABYLON.MeshBuilder.CreateTorus(`floor-two-seal-collar-${side}`, {
        diameter: 5.2,
        thickness: 0.34,
        tessellation: 24
      }, scene);
      collar.position = tower.position.add(new BABYLON.Vector3(0, 2.2, 0));
      collar.rotation.x = Math.PI / 2;
      collar.material = glow;
      this.upperCollisions.push({
        minX: tower.position.x - 3,
        maxX: tower.position.x + 3,
        minZ: tower.position.z - 3,
        maxZ: tower.position.z + 3
      });
    });
    const lintel = BABYLON.MeshBuilder.CreateBox("floor-two-seal-lintel", {
      width: 26,
      height: 2.2,
      depth: 3.2
    }, scene);
    lintel.position = new BABYLON.Vector3(this.centerX, this.upperFloorY + 14, this.sealPosition.z);
    lintel.material = metal;
  }

  private createStructuralVista(stone: any, metal: any, glow: any): void {
    const scene = this.world.scene;
    for (let index = 0; index < 4; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const row = Math.floor(index / 2);
      const support = BABYLON.MeshBuilder.CreateCylinder(`floor-two-vista-support-${index}`, {
        height: 28 + row * 8,
        diameterTop: 3.4,
        diameterBottom: 5.6,
        tessellation: 10
      }, scene);
      support.position = new BABYLON.Vector3(
        this.centerX + side * (34 - row * 4),
        this.upperFloorY + 14 + row * 4,
        this.centerZ - 10 - row * 28
      );
      support.rotation.z = side * (0.08 + row * 0.04);
      support.material = row === 0 ? metal : stone;
      const rune = BABYLON.MeshBuilder.CreateTorus(`floor-two-vista-rune-${index}`, {
        diameter: 4.1,
        thickness: 0.22,
        tessellation: 22
      }, scene);
      rune.position = support.position.add(new BABYLON.Vector3(0, 6, 0));
      rune.rotation.x = Math.PI / 2;
      rune.material = glow;
    }
  }

  private installMovementSurface(): void {
    this.world.heightAt = (x: number, z: number): number => {
      if (this.upperActive && this.resolvingPlayer && this.isInsideUpperBounds(x, z)) return this.upperFloorY;
      return this.originalHeightAt(x, z);
    };

    this.world.resolvePlayerPosition = (position: any, previous: any): void => {
      if (!this.upperActive || !this.resolvingPlayer) {
        this.originalResolvePlayerPosition(position, previous);
        return;
      }
      const airborneHeight = Number(position.y);
      position.x = BABYLON.Scalar.Clamp(position.x, this.minX + 1.9, this.maxX - 1.9);
      position.z = BABYLON.Scalar.Clamp(position.z, this.minZ + 1.9, this.maxZ - 1.9);
      for (const box of this.upperCollisions) {
        if (
          position.x > box.minX
          && position.x < box.maxX
          && position.z > box.minZ
          && position.z < box.maxZ
        ) {
          position.x = previous.x;
          position.z = previous.z;
          break;
        }
      }
      position.y = airborneHeight > this.upperFloorY + 0.14 ? airborneHeight : this.upperFloorY;
    };

    this.player.update = (...args: any[]): void => {
      this.resolvingPlayer = true;
      try {
        this.originalPlayerUpdate(...args);
      } finally {
        this.resolvingPlayer = false;
      }
    };
  }

  private installProgressionHooks(): void {
    this.game.finishAscentCycle = (): void => this.enterUpperZone();
    this.game.updateInteraction = (input: any): void => {
      if (this.upperActive) {
        this.updateUpperInteraction(input);
        return;
      }
      this.originalUpdateInteraction(input);
    };
  }

  private enterUpperZone(): void {
    this.upperActive = true;
    this.expedition.liftRoot.position.y = this.expedition.liftTopY;
    this.player.root.position = new BABYLON.Vector3(this.centerX, this.upperFloorY, this.maxZ - 9);
    this.player.verticalVelocity = 0;
    this.player.grounded = true;
    this.player.lockTarget = null;
    this.hazardDamageCooldown = 0.8;
    this.refreshProgressVisuals();
    this.refreshObjective(true);
    this.zoneTitle.classList.remove("show");
    void this.zoneTitle.offsetWidth;
    this.zoneTitle.classList.add("show");
    window.setTimeout(() => this.zoneTitle.classList.remove("show"), 3900);
    this.hud.notify(
      "FLOOR TWO STAGING TERRACE",
      this.isSurveyed()
        ? "The recorded threshold remains accessible. The return lift is behind you."
        : "Survey the upper lattice before approaching the unstable threshold fragment."
    );
    this.game.canvas.focus();
    this.game.input.requestPointerLock();
  }

  private exitUpperZone(): void {
    this.upperActive = false;
    this.objective.classList.remove("visible");
    this.expedition.liftActive = false;
    this.expedition.liftAtTop = false;
    this.expedition.liftTime = 0;
    this.expedition.completionReported = false;
    this.expedition.liftRoot.position.y = this.expedition.liftBaseY;
    const x = this.world.labyrinthPosition.x;
    const z = this.world.labyrinthPosition.z - 118;
    this.player.root.position = new BABYLON.Vector3(x, this.originalHeightAt(x, z), z);
    this.player.verticalVelocity = 0;
    this.player.grounded = true;
    this.player.lockTarget = null;
    this.hud.notify("PILLAR DESCENT COMPLETE", "You returned to the Foundry lift chamber with the upper route intact.");
    this.game.canvas.focus();
    this.game.input.requestPointerLock();
  }

  private updateUpperInteraction(input: any): void {
    const position = this.player.position();
    if (planarDistance(position, this.returnConsolePosition) <= 3.4) {
      this.hud.setInteraction("Descend to the Foundry core");
      if (input.interactPressed) this.exitUpperZone();
      return;
    }

    if (!this.isSurveyed() && planarDistance(position, this.surveyConsolePosition) <= 4.2) {
      this.hud.setInteraction("Record the Floor Two lattice survey");
      if (input.interactPressed) this.completeSurvey();
      return;
    }

    if (
      this.isSurveyed()
      && !this.isFragmentRecovered()
      && planarDistance(position, this.fragmentPosition) <= 4.1
    ) {
      this.hud.setInteraction("Recover the unstable threshold fragment");
      if (input.interactPressed) this.recoverFragment();
      return;
    }

    if (planarDistance(position, this.sealPosition) <= 6.2) {
      this.hud.setInteraction("Inspect the sealed Aerial Scar gate");
      if (input.interactPressed) {
        this.hud.notify(
          "THE AERIAL SCAR",
          this.isFragmentRecovered()
            ? "The outer seal recognizes your fragment, but the far bridge remains severed."
            : "A fractured bridge and violent crosswinds wait beyond the locked threshold."
        );
        this.audio.quest();
      }
      return;
    }

    this.hud.setInteraction(null);
  }

  private completeSurvey(): void {
    const expeditionSave = this.game.quests.save.expedition as any;
    if (expeditionSave.floorTwoSurveyed) return;
    expeditionSave.floorTwoSurveyed = true;
    this.game.quests.updatePlayer(this.player.health, this.player.focus);
    this.hud.notify(
      "UPPER LATTICE SURVEY RECORDED",
      "A Riftglass fragment is suspended inside the rotating shear field on the eastern altar."
    );
    this.audio.quest();
    this.refreshProgressVisuals();
    this.refreshObjective(true);
  }

  private recoverFragment(): void {
    if (this.isFragmentRecovered()) return;
    if (this.game.quests.claimCache("floor-two-threshold-fragment")) {
      this.player.focus = Math.min(100, this.player.focus + 35);
      this.hazardRoot.setEnabled(false);
      this.hud.notify(
        "THRESHOLD KEY RECOVERED",
        "The Aerial Scar seal now recognizes your Riftglass signature. The far bridge remains the next expedition objective."
      );
      this.audio.quest();
      this.refreshProgressVisuals();
      this.refreshObjective(true);
    }
  }

  private update(): void {
    const delta = Math.min(0.05, Math.max(0.001, Number(this.game.engine.getDeltaTime?.() ?? 16.7) / 1000));
    if (!this.upperActive) return;

    if (!this.isInsideUpperBounds(this.player.root.position.x, this.player.root.position.z) || this.player.root.position.y < this.upperFloorY - 18) {
      this.upperActive = false;
      this.objective.classList.remove("visible");
      this.expedition.liftAtTop = false;
      this.expedition.liftRoot.position.y = this.expedition.liftBaseY;
      return;
    }

    this.refreshObjective(false);
    if (this.isFragmentRecovered()) return;
    this.hazardTime += delta;
    this.hazardDamageCooldown = Math.max(0, this.hazardDamageCooldown - delta);
    this.hazardRoot.rotation.y += delta * 0.58;
    this.hazardRoot.position.y = this.fragmentPosition.y + 1.3 + Math.sin(this.hazardTime * 1.8) * 0.14;

    for (const blade of this.hazardBlades) {
      blade.rig.rotation.y += delta * (1.15 + blade.phase * 0.08);
      blade.blade.rotation.y += delta * 1.9;
      blade.blade.computeWorldMatrix(true);
      const bladePosition = blade.blade.getAbsolutePosition();
      if (
        this.hazardDamageCooldown <= 0
        && !this.game.paused
        && planarDistance(bladePosition, this.player.position()) <= 1.35
        && Math.abs(bladePosition.y - this.player.position().y) <= 2.3
      ) {
        this.hazardDamageCooldown = 1.1;
        this.player.receiveDamage(14, this.fragmentPosition);
        this.hud.notify("RIFT SHEAR CONTACT", "The rotating fracture field cuts through ordinary guard angles.");
        if (this.player.root.position.y < this.upperFloorY - 10) this.upperActive = false;
        break;
      }
    }
  }

  private refreshObjective(force: boolean): void {
    const next = !this.isSurveyed()
      ? "Survey the upper lattice console"
      : !this.isFragmentRecovered()
        ? "Cross the Rift Shear and recover the threshold fragment"
        : "Inspect the sealed gate or return to the Foundry";
    if (!force && next === this.lastObjective) return;
    this.lastObjective = next;
    this.objective.innerHTML = `<small>FLOOR TWO ARRIVAL</small><strong>${next}</strong><span>No loading boundary · return lift online</span>`;
    this.objective.classList.add("visible");
  }

  private refreshProgressVisuals(): void {
    const fragment = this.world.scene.getMeshByName?.("floor-two-threshold-fragment");
    const recovered = this.isFragmentRecovered();
    fragment?.setEnabled(!recovered);
    this.hazardRoot.setEnabled(!recovered);
    const surveyLens = this.world.scene.getMeshByName?.("floor-two-survey-lens");
    if (surveyLens?.material) surveyLens.material.emissiveIntensity = this.isSurveyed() ? 2.5 : 0.55;
  }

  private isSurveyed(): boolean {
    return Boolean((this.game.quests.save.expedition as any).floorTwoSurveyed);
  }

  private isFragmentRecovered(): boolean {
    return this.game.quests.save.expedition.claimedCaches.includes("floor-two-threshold-fragment");
  }

  private isInsideUpperBounds(x: number, z: number): boolean {
    return x >= this.minX && x <= this.maxX && z >= this.minZ && z <= this.maxZ;
  }

  private installStyles(): void {
    if (document.getElementById("floor-two-arrival-styles")) return;
    const style = document.createElement("style");
    style.id = "floor-two-arrival-styles";
    style.textContent = `
      .floor-two-objective{position:fixed;z-index:39;top:142px;left:22px;display:grid;max-width:330px;padding:11px 14px;border:1px solid #8ee8d344;border-radius:12px;background:linear-gradient(115deg,#07161ce8,#13302fdc);box-shadow:0 15px 38px #0007;color:#eafff8;opacity:0;transform:translateX(-14px);transition:.22s;pointer-events:none}.floor-two-objective.visible{opacity:1;transform:none}.floor-two-objective small{color:#72dcbc;font-size:8px;font-weight:800;letter-spacing:.17em}.floor-two-objective strong{margin-top:4px;font-size:13px}.floor-two-objective span{margin-top:3px;color:#8da49e;font-size:9px}.floor-two-zone-title{position:fixed;z-index:70;left:50%;top:25%;display:grid;min-width:380px;padding:20px 28px;border-top:1px solid #9af0d577;border-bottom:1px solid #9af0d544;background:linear-gradient(90deg,transparent,#07181ee8 18%,#0d2828e8 82%,transparent);color:#edfff8;text-align:center;opacity:0;transform:translate(-50%,18px);pointer-events:none}.floor-two-zone-title.show{animation:floor-two-title 3.8s ease both}.floor-two-zone-title small{color:#7fe5c3;font-size:9px;font-weight:800;letter-spacing:.26em}.floor-two-zone-title strong{margin-top:5px;font:700 34px Georgia,serif}.floor-two-zone-title span{margin-top:5px;color:#9cb0aa;font-size:11px;letter-spacing:.08em}@keyframes floor-two-title{0%{opacity:0;transform:translate(-50%,18px)}13%,72%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-8px)}}@media(max-width:720px){.floor-two-objective{top:122px;left:12px;max-width:270px}.floor-two-zone-title{min-width:0;width:88vw}.floor-two-zone-title strong{font-size:27px}}`;
    document.head.appendChild(style);
  }
}
