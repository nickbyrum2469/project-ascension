import type { ExpeditionSave } from "../data/GameTypes.js";
import {
  createMara,
  createMaterial,
  type HumanoidVisual
} from "./ProceduralAssets.js";
import type { World } from "./World.js";

interface BeaconVisual {
  id: string;
  name: string;
  position: any;
  root: any;
  rings: any[];
  core: any;
}

interface CacheVisual {
  id: string;
  position: any;
  root: any;
  rune: any;
}

interface CitizenVisual {
  name: string;
  initials: string;
  role: string;
  line: string;
  visual: HumanoidVisual;
  route: any[];
  routeIndex: number;
  phase: number;
  speed: number;
}

export interface ExpeditionInteraction {
  kind: "beacon" | "cache" | "citizen" | "lift";
  id: string;
  label: string;
  citizenIndex?: number;
}

const distance2d = (a: any, b: any): number => Math.hypot(a.x - b.x, a.z - b.z);

export class ExpeditionLayer {
  private readonly beacons: BeaconVisual[] = [];
  private readonly caches: CacheVisual[] = [];
  private readonly citizens: CitizenVisual[] = [];
  private readonly liftRoot: any;
  private readonly liftPlatform: any;
  private readonly liftConsole: any;
  private readonly liftBaseY: number;
  private readonly liftTopY: number;
  private readonly liftConsolePosition: any;
  private elapsed = 0;
  private liftActive = false;
  private liftAtTop = false;
  private liftTime = 0;
  private completionReported = false;

  constructor(private readonly world: World) {
    this.createBeacons();
    this.createCaches();
    this.createCitizens();

    const lift = this.createLift();
    this.liftRoot = lift.root;
    this.liftPlatform = lift.platform;
    this.liftConsole = lift.console;
    this.liftBaseY = lift.baseY;
    this.liftTopY = lift.topY;
    this.liftConsolePosition = lift.consolePosition;
  }

  public setProgress(save: ExpeditionSave, coreRestored: boolean): void {
    this.beacons.forEach((beacon) => {
      const activated = save.activatedBeacons.includes(beacon.id);
      const active = save.activeBeacon === beacon.id;
      beacon.core.material.emissiveIntensity = active ? 2.7 : activated ? 1.55 : 0.28;
      beacon.rings.forEach((ring) => {
        ring.material.emissiveIntensity = active ? 2.1 : activated ? 1.05 : 0.18;
      });
      beacon.root.scaling.setAll(active ? 1.08 : 1);
    });

    this.caches.forEach((cache) => {
      cache.root.setEnabled(!save.claimedCaches.includes(cache.id));
    });

    this.liftConsole.material.emissiveIntensity = coreRestored ? 2.2 : 0.2;
    this.liftPlatform.material.emissiveIntensity = coreRestored ? 1.2 : 0.12;
  }

  public update(delta: number, playerPosition: any): void {
    this.elapsed += delta;

    this.beacons.forEach((beacon, beaconIndex) => {
      beacon.rings.forEach((ring, ringIndex) => {
        const direction = (beaconIndex + ringIndex) % 2 === 0 ? 1 : -1;
        ring.rotation.y += delta * (0.32 + ringIndex * 0.18) * direction;
        ring.rotation.z += delta * 0.08 * direction;
      });
      const pulse = 1 + Math.sin(this.elapsed * 2.4 + beaconIndex) * 0.045;
      beacon.core.scaling.setAll(pulse);
    });

    this.caches.forEach((cache, index) => {
      if (!cache.root.isEnabled()) return;
      cache.rune.rotation.y += delta * (index % 2 === 0 ? 0.55 : -0.55);
      cache.rune.position.y = 1.05 + Math.sin(this.elapsed * 2.2 + index) * 0.08;
    });

    this.citizens.forEach((citizen, index) => this.updateCitizen(citizen, index, delta, playerPosition));
  }

  public nearestInteraction(
    playerPosition: any,
    save: ExpeditionSave,
    coreRestored: boolean
  ): ExpeditionInteraction | null {
    if (coreRestored && !this.liftActive && distance2d(playerPosition, this.liftConsolePosition) <= 4.8) {
      return {
        kind: "lift",
        id: "eastern-pillar-lift",
        label: save.ascentCompleted
          ? "Ride the eastern pillar lift"
          : "Begin the first pillar ascent"
      };
    }

    for (let index = 0; index < this.citizens.length; index += 1) {
      const citizen = this.citizens[index];
      if (distance2d(playerPosition, citizen.visual.root.position) <= 2.8) {
        return {
          kind: "citizen",
          id: citizen.name,
          label: `Speak with ${citizen.name}`,
          citizenIndex: index
        };
      }
    }

    for (const cache of this.caches) {
      if (!cache.root.isEnabled()) continue;
      if (distance2d(playerPosition, cache.position) <= 3.4) {
        return {
          kind: "cache",
          id: cache.id,
          label: "Open sealed expedition cache"
        };
      }
    }

    for (const beacon of this.beacons) {
      if (distance2d(playerPosition, beacon.position) > 4.2) continue;
      const activated = save.activatedBeacons.includes(beacon.id);
      const active = save.activeBeacon === beacon.id;
      return {
        kind: "beacon",
        id: beacon.id,
        label: active
          ? `Rest at ${beacon.name}`
          : activated
            ? `Bind expedition to ${beacon.name}`
            : `Attune ${beacon.name}`
      };
    }

    return null;
  }

  public getBeaconName(id: string): string {
    return this.beacons.find((beacon) => beacon.id === id)?.name ?? "Foundation Beacon";
  }

  public getCitizen(index: number): CitizenVisual | null {
    return this.citizens[index] ?? null;
  }

  public isLiftActive(): boolean {
    return this.liftActive;
  }

  public startLift(): boolean {
    if (this.liftActive || this.liftAtTop) return false;
    this.liftActive = true;
    this.liftTime = 0;
    this.completionReported = false;
    return true;
  }

  public updateLift(delta: number, playerRoot: any): boolean {
    if (!this.liftActive) return false;
    this.liftTime = Math.min(8, this.liftTime + delta);
    const normalized = this.liftTime / 8;
    const eased = normalized * normalized * (3 - 2 * normalized);
    this.liftRoot.position.y = BABYLON.Scalar.Lerp(this.liftBaseY, this.liftTopY, eased);
    playerRoot.position.x = this.liftRoot.position.x;
    playerRoot.position.z = this.liftRoot.position.z;
    playerRoot.position.y = this.liftRoot.position.y + 0.48;

    if (normalized < 1) return false;
    this.liftActive = false;
    this.liftAtTop = true;
    if (this.completionReported) return false;
    this.completionReported = true;
    return true;
  }

  private createBeacons(): void {
    const definitions = [
      { id: "caelus-gate", name: "Caelus Gate Beacon", x: -24, z: -52 },
      { id: "western-watch", name: "Western Watch Beacon", x: -355, z: -318 },
      { id: "aqueduct-overlook", name: "Aqueduct Overlook Beacon", x: 205, z: -302 },
      { id: "foundry-threshold", name: "Foundry Threshold Beacon", x: 438, z: -448 }
    ];

    definitions.forEach((definition, index) => {
      const position = new BABYLON.Vector3(
        definition.x,
        this.world.heightAt(definition.x, definition.z),
        definition.z
      );
      const root = new BABYLON.TransformNode(`foundation-beacon-${definition.id}`, this.world.scene);
      root.position.copyFrom(position);

      const stone = createMaterial(
        this.world.scene,
        `foundation-beacon-stone-${index}`,
        index % 2 === 0 ? "#3d5558" : "#4b5650",
        0.82,
        0.18
      );
      const glow = createMaterial(
        this.world.scene,
        `foundation-beacon-glow-${index}`,
        "#83f7ee",
        0.12,
        0.18,
        "#39e2d9"
      );

      const plinth = BABYLON.MeshBuilder.CreateCylinder(`foundation-beacon-plinth-${index}`, {
        height: 0.65,
        diameterTop: 3.2,
        diameterBottom: 3.8,
        tessellation: 10
      }, this.world.scene);
      plinth.position.y = 0.28;
      plinth.material = stone;
      plinth.receiveShadows = true;
      plinth.parent = root;

      const column = BABYLON.MeshBuilder.CreateCylinder(`foundation-beacon-column-${index}`, {
        height: 2.8,
        diameterTop: 0.65,
        diameterBottom: 1.1,
        tessellation: 8
      }, this.world.scene);
      column.position.y = 1.65;
      column.material = stone;
      column.parent = root;

      const core = BABYLON.MeshBuilder.CreatePolyhedron(`foundation-beacon-core-${index}`, {
        type: 1,
        size: 0.7
      }, this.world.scene);
      core.position.y = 3.25;
      core.scaling.y = 1.45;
      core.material = glow;
      core.parent = root;

      const rings: any[] = [];
      [1.55, 2.15].forEach((diameter, ringIndex) => {
        const ring = BABYLON.MeshBuilder.CreateTorus(`foundation-beacon-ring-${index}-${ringIndex}`, {
          diameter,
          thickness: 0.08,
          tessellation: 24
        }, this.world.scene);
        ring.position.y = 3.25;
        ring.rotation.x = Math.PI / 2 + ringIndex * 0.5;
        ring.material = glow;
        ring.parent = root;
        rings.push(ring);
      });

      root.getChildMeshes().forEach((mesh: any) => this.world.shadowGenerator.addShadowCaster(mesh));
      this.beacons.push({
        id: definition.id,
        name: definition.name,
        position,
        root,
        rings,
        core
      });
    });
  }

  private createCaches(): void {
    const definitions = [
      { id: "western-grove-cache", x: -505, z: -258 },
      { id: "aqueduct-cache", x: 282, z: -382 },
      { id: "northern-ridge-cache", x: -132, z: -602 },
      { id: "foundry-cliff-cache", x: 565, z: -486 }
    ];

    definitions.forEach((definition, index) => {
      const position = new BABYLON.Vector3(
        definition.x,
        this.world.heightAt(definition.x, definition.z),
        definition.z
      );
      const root = new BABYLON.TransformNode(`expedition-cache-${definition.id}`, this.world.scene);
      root.position.copyFrom(position);
      root.rotation.y = index * 1.37;

      const metal = createMaterial(
        this.world.scene,
        `expedition-cache-metal-${index}`,
        "#45555d",
        0.38,
        0.7
      );
      const inset = createMaterial(
        this.world.scene,
        `expedition-cache-inset-${index}`,
        "#242d34",
        0.7,
        0.3
      );
      const glow = createMaterial(
        this.world.scene,
        `expedition-cache-glow-${index}`,
        "#c1fff4",
        0.12,
        0.12,
        "#48ead9"
      );

      const body = BABYLON.MeshBuilder.CreateBox(`expedition-cache-body-${index}`, {
        width: 1.8,
        height: 0.75,
        depth: 1.15
      }, this.world.scene);
      body.position.y = 0.45;
      body.material = metal;
      body.parent = root;

      const lid = BABYLON.MeshBuilder.CreateBox(`expedition-cache-lid-${index}`, {
        width: 1.95,
        height: 0.28,
        depth: 1.3
      }, this.world.scene);
      lid.position.y = 0.98;
      lid.material = inset;
      lid.parent = root;

      const rune = BABYLON.MeshBuilder.CreateTorus(`expedition-cache-rune-${index}`, {
        diameter: 0.58,
        thickness: 0.06,
        tessellation: 18
      }, this.world.scene);
      rune.position = new BABYLON.Vector3(0, 1.05, 0.67);
      rune.rotation.x = Math.PI / 2;
      rune.material = glow;
      rune.parent = root;

      root.getChildMeshes().forEach((mesh: any) => this.world.shadowGenerator.addShadowCaster(mesh));
      this.caches.push({ id: definition.id, position, root, rune });
    });
  }

  private createCitizens(): void {
    const definitions = [
      {
        name: "Ilya Sorn",
        initials: "IS",
        role: "Quartermaster",
        line: "The western watch is taking supplies again. Attune every beacon you find; the Foundation remembers stable routes.",
        color: "#45627b",
        route: [[-58, 70], [-22, 70], [-22, 116], [-58, 116]],
        speed: 1.05
      },
      {
        name: "Sen Tal",
        initials: "ST",
        role: "Cartographer",
        line: "The floor is circular, but the old roads were never radial. Every expedition carved a safer curve around something buried.",
        color: "#536a4d",
        route: [[26, 62], [68, 82], [54, 126], [18, 112]],
        speed: 0.9
      },
      {
        name: "Oran Pell",
        initials: "OP",
        role: "Riftglass Smith",
        line: "Bring every shard back intact. I cannot reforge the Edge yet, but I can already hear its next resonance.",
        color: "#765142",
        route: [[-78, 136], [-48, 146], [-30, 130]],
        speed: 0.75
      },
      {
        name: "Nessa Vey",
        initials: "NV",
        role: "Foundation Scout",
        line: "The eastern breach is quiet now, but quiet machinery is rarely dead machinery. Keep your guard high inside.",
        color: "#684f72",
        route: [[36, 146], [76, 142], [82, 104], [46, 112]],
        speed: 1.15
      },
      {
        name: "Tovan Rill",
        initials: "TR",
        role: "Gate Warden",
        line: "The frontier is open, but the city wall is still the last honest line between shelter and the Verge.",
        color: "#465c64",
        route: [[-28, 38], [-8, 32], [8, 32], [28, 38]],
        speed: 0.7
      },
      {
        name: "Mira Ko",
        initials: "MK",
        role: "Expedition Medic",
        line: "Rest at a lit beacon before you push deeper. Pride is not a substitute for returning alive.",
        color: "#5c6f67",
        route: [[-12, 88], [12, 88], [12, 104], [-12, 104]],
        speed: 0.82
      }
    ];

    definitions.forEach((definition, index) => {
      const visual = createMara(this.world.scene);
      visual.root.name = `caelus-citizen-${index}`;
      visual.root.scaling.setAll(0.87 + (index % 3) * 0.035);
      visual.cape.material = createMaterial(
        this.world.scene,
        `caelus-citizen-cape-${index}`,
        definition.color,
        0.92,
        0.02
      );
      visual.rune.material.emissiveIntensity = 0.42;
      const route = definition.route.map(([x, z]) => new BABYLON.Vector3(
        x,
        this.world.heightAt(x, z),
        z
      ));
      visual.root.position.copyFrom(route[0]);
      visual.root.getChildMeshes().forEach((mesh: any) => this.world.shadowGenerator.addShadowCaster(mesh));
      this.citizens.push({
        name: definition.name,
        initials: definition.initials,
        role: definition.role,
        line: definition.line,
        visual,
        route,
        routeIndex: 1,
        phase: index * 1.17,
        speed: definition.speed
      });
    });
  }

  private updateCitizen(
    citizen: CitizenVisual,
    index: number,
    delta: number,
    playerPosition: any
  ): void {
    const root = citizen.visual.root;
    const target = citizen.route[citizen.routeIndex];
    const toTarget = target.subtract(root.position);
    toTarget.y = 0;
    const distance = toTarget.length();
    if (distance < 0.45) {
      citizen.routeIndex = (citizen.routeIndex + 1) % citizen.route.length;
    } else {
      const direction = toTarget.scale(1 / Math.max(0.001, distance));
      root.position.addInPlace(direction.scale(citizen.speed * delta));
      root.position.y = this.world.heightAt(root.position.x, root.position.z);
      root.rotation.y = Math.atan2(direction.x, direction.z);
    }

    const cycle = this.elapsed * (4.2 + citizen.speed * 1.8) + citizen.phase;
    const stride = distance > 0.55 ? Math.sin(cycle) * 0.32 : 0;
    citizen.visual.leftThigh.rotation.x = stride;
    citizen.visual.rightThigh.rotation.x = -stride;
    citizen.visual.leftShin.rotation.x = Math.max(0, -stride) * 0.45;
    citizen.visual.rightShin.rotation.x = Math.max(0, stride) * 0.45;
    citizen.visual.leftUpperArm.rotation.x = -stride * 0.5;
    citizen.visual.rightUpperArm.rotation.x = stride * 0.5 - 0.12;
    citizen.visual.cape.rotation.x = 0.08 + Math.sin(cycle * 0.5) * 0.035;
    citizen.visual.hips.position.y = 1.25 + Math.abs(Math.sin(cycle)) * 0.018;

    const playerDistance = distance2d(root.position, playerPosition);
    citizen.visual.head.rotation.y = playerDistance < 4.5
      ? BABYLON.Scalar.Clamp(Math.atan2(playerPosition.x - root.position.x, playerPosition.z - root.position.z) - root.rotation.y, -0.55, 0.55)
      : Math.sin(this.elapsed * 0.35 + index) * 0.06;
  }

  private createLift(): {
    root: any;
    platform: any;
    console: any;
    baseY: number;
    topY: number;
    consolePosition: any;
  } {
    const x = this.world.labyrinthPosition.x;
    const z = this.world.labyrinthPosition.z - 126;
    const baseY = this.world.heightAt(x, z) + 0.35;
    const topY = baseY + 74;
    const root = new BABYLON.TransformNode("eastern-pillar-lift-root", this.world.scene);
    root.position = new BABYLON.Vector3(x, baseY, z);

    const metal = createMaterial(this.world.scene, "eastern-pillar-lift-metal", "#344c52", 0.3, 0.72);
    const stone = createMaterial(this.world.scene, "eastern-pillar-lift-stone", "#263b3f", 0.82, 0.2);
    const glow = createMaterial(
      this.world.scene,
      "eastern-pillar-lift-glow",
      "#a4fff3",
      0.1,
      0.14,
      "#44eee0"
    );

    const platform = BABYLON.MeshBuilder.CreateCylinder("eastern-pillar-lift-platform", {
      height: 0.7,
      diameter: 8.5,
      tessellation: 18
    }, this.world.scene);
    platform.material = glow;
    platform.parent = root;

    const deck = BABYLON.MeshBuilder.CreateCylinder("eastern-pillar-lift-deck", {
      height: 0.38,
      diameter: 7.5,
      tessellation: 18
    }, this.world.scene);
    deck.position.y = 0.45;
    deck.material = metal;
    deck.parent = root;

    const liftRing = BABYLON.MeshBuilder.CreateTorus("eastern-pillar-lift-ring", {
      diameter: 6.2,
      thickness: 0.14,
      tessellation: 32
    }, this.world.scene);
    liftRing.position.y = 0.7;
    liftRing.rotation.x = Math.PI / 2;
    liftRing.material = glow;
    liftRing.parent = root;

    for (let index = 0; index < 3; index += 1) {
      const angle = (index / 3) * Math.PI * 2;
      const column = BABYLON.MeshBuilder.CreateCylinder(`eastern-pillar-lift-column-${index}`, {
        height: 78,
        diameter: 0.65,
        tessellation: 8
      }, this.world.scene);
      column.position = new BABYLON.Vector3(
        x + Math.cos(angle) * 6.2,
        baseY + 39,
        z + Math.sin(angle) * 6.2
      );
      column.material = metal;
      this.world.shadowGenerator.addShadowCaster(column);
    }

    const topDeck = BABYLON.MeshBuilder.CreateCylinder("eastern-pillar-staging-deck", {
      height: 1.1,
      diameter: 18,
      tessellation: 20
    }, this.world.scene);
    topDeck.position = new BABYLON.Vector3(x, topY - 0.5, z);
    topDeck.material = stone;
    topDeck.receiveShadows = true;

    const threshold = BABYLON.MeshBuilder.CreateTorus("floor-two-sealed-threshold", {
      diameter: 11,
      thickness: 0.65,
      tessellation: 36
    }, this.world.scene);
    threshold.position = new BABYLON.Vector3(x, topY + 6.2, z - 6.5);
    threshold.rotation.x = Math.PI / 2;
    threshold.material = glow;

    const consolePosition = new BABYLON.Vector3(x + 5.2, baseY, z + 0.4);
    const console = BABYLON.MeshBuilder.CreateBox("eastern-pillar-lift-console", {
      width: 1.3,
      height: 2.1,
      depth: 1.1
    }, this.world.scene);
    console.position = new BABYLON.Vector3(consolePosition.x, baseY + 1.05, consolePosition.z);
    console.rotation.z = -0.12;
    console.material = glow;

    root.getChildMeshes().forEach((mesh: any) => this.world.shadowGenerator.addShadowCaster(mesh));
    this.world.shadowGenerator.addShadowCaster(topDeck);
    this.world.shadowGenerator.addShadowCaster(threshold);
    this.world.shadowGenerator.addShadowCaster(console);

    return { root, platform, console, baseY, topY, consolePosition };
  }
}
