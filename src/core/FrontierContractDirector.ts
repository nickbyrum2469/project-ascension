import type { EnemyKind, InputFrame } from "../data/GameTypes.js";
import { createMaterial } from "../world/ProceduralAssets.js";

type ContractId = "boar-control" | "wisp-suppression" | "foundation-survey";

interface ContractRecord {
  active: boolean;
  progress: number;
  completions: number;
}

interface ContractState {
  "boar-control": ContractRecord;
  "wisp-suppression": ContractRecord;
  "foundation-survey": ContractRecord;
}

interface ContractDefinition {
  id: ContractId;
  title: string;
  summary: string;
  target: number;
  repeatable: boolean;
  reward: string;
}

const DEFINITIONS: ContractDefinition[] = [
  {
    id: "boar-control",
    title: "Rift Herd Control",
    summary: "Defeat three Rift Boars threatening the expedition roads.",
    target: 3,
    repeatable: true,
    reward: "4 fracture dust"
  },
  {
    id: "wisp-suppression",
    title: "Wisp Suppression",
    summary: "Disperse two Rift Wisp Constellations before they reform.",
    target: 2,
    repeatable: true,
    reward: "1 Riftglass shard and 6 fracture dust"
  },
  {
    id: "foundation-survey",
    title: "Foundation Survey",
    summary: "Attune three beacons and recover two expedition caches.",
    target: 5,
    repeatable: false,
    reward: "2 Riftglass shards and 4 fracture dust"
  }
];

const defaultRecord = (): ContractRecord => ({ active: false, progress: 0, completions: 0 });
const distance2d = (a: any, b: any): number => Math.hypot(a.x - b.x, a.z - b.z);

export class FrontierContractDirector {
  private readonly world: any;
  private readonly quests: any;
  private readonly player: any;
  private readonly hud: any;
  private readonly audio: any;
  private readonly boardPosition: any;
  private readonly tracker: HTMLDivElement;
  private readonly state: ContractState;
  private readonly originalInteraction: (input: InputFrame) => void;
  private lastTrackerSnapshot = "";

  constructor(private readonly game: any) {
    this.world = game.world;
    this.quests = game.quests;
    this.player = game.player;
    this.hud = game.hud;
    this.audio = game.audio;
    this.boardPosition = new BABYLON.Vector3(-48, this.world.heightAt(-48, 52), 52);
    this.state = this.loadState();

    this.createBoard();
    this.installStyles();
    this.tracker = document.createElement("div");
    this.tracker.className = "frontier-contract-tracker";
    document.body.appendChild(this.tracker);

    this.originalInteraction = this.game.updateInteraction.bind(this.game);
    this.installInteractionHook();
    this.installProgressHooks();
    this.updateSurveyProgress(false);
    this.persist();
    this.refreshTracker(true);
  }

  private loadState(): ContractState {
    const expedition = this.quests.save.expedition as any;
    const saved = expedition.contracts ?? {};
    const normalize = (id: ContractId): ContractRecord => {
      const value = saved[id] ?? {};
      return {
        active: Boolean(value.active),
        progress: Math.max(0, Number(value.progress ?? 0)),
        completions: Math.max(0, Number(value.completions ?? 0))
      };
    };
    const state: ContractState = {
      "boar-control": normalize("boar-control"),
      "wisp-suppression": normalize("wisp-suppression"),
      "foundation-survey": normalize("foundation-survey")
    };
    if (state["foundation-survey"].completions > 0) state["foundation-survey"].active = false;
    expedition.contracts = state;
    return state;
  }

  private createBoard(): void {
    const scene = this.world.scene;
    const timber = createMaterial(scene, "frontier-contract-board-timber", "#4d3b30", 0.93, 0.04);
    const metal = createMaterial(scene, "frontier-contract-board-metal", "#56666c", 0.38, 0.68);
    const parchment = createMaterial(scene, "frontier-contract-board-parchment", "#b7aa83", 0.98, 0);
    const glow = createMaterial(scene, "frontier-contract-board-glow", "#9ffff0", 0.1, 0.12, "#48e4ce");
    glow.emissiveIntensity = 1.45;

    const root = new BABYLON.TransformNode("caelus-frontier-contract-board", scene);
    root.position.copyFrom(this.boardPosition);
    root.rotation.y = 0.08;

    [-1, 1].forEach((side) => {
      const post = BABYLON.MeshBuilder.CreateCylinder(`contract-board-post-${side}`, {
        height: 4.6,
        diameterTop: 0.28,
        diameterBottom: 0.42,
        tessellation: 6
      }, scene);
      post.position = new BABYLON.Vector3(side * 2.35, 2.3, 0);
      post.material = timber;
      post.parent = root;
      const foot = BABYLON.MeshBuilder.CreateBox(`contract-board-foot-${side}`, {
        width: 0.95,
        height: 0.35,
        depth: 1.2
      }, scene);
      foot.position = new BABYLON.Vector3(side * 2.35, 0.16, 0);
      foot.material = metal;
      foot.parent = root;
    });

    const board = BABYLON.MeshBuilder.CreateBox("contract-board-face", {
      width: 5.5,
      height: 3.25,
      depth: 0.42
    }, scene);
    board.position.y = 3.1;
    board.material = timber;
    board.parent = root;
    board.metadata = { cameraCollision: true };
    board.isPickable = true;
    board.receiveShadows = true;

    const header = BABYLON.MeshBuilder.CreateBox("contract-board-header", {
      width: 5.9,
      height: 0.55,
      depth: 0.58
    }, scene);
    header.position.y = 4.85;
    header.material = metal;
    header.parent = root;

    for (let index = 0; index < 6; index += 1) {
      const notice = BABYLON.MeshBuilder.CreateBox(`contract-board-notice-${index}`, {
        width: index % 2 === 0 ? 1.45 : 1.2,
        height: 1.05,
        depth: 0.045
      }, scene);
      notice.position = new BABYLON.Vector3(
        -1.75 + (index % 3) * 1.75,
        2.45 + Math.floor(index / 3) * 1.16,
        -0.235
      );
      notice.rotation.z = ((index % 3) - 1) * 0.035;
      notice.material = parchment;
      notice.parent = root;
      const pin = BABYLON.MeshBuilder.CreateSphere(`contract-board-pin-${index}`, {
        diameter: 0.12,
        segments: 5
      }, scene);
      pin.position = notice.position.add(new BABYLON.Vector3(0, 0.39, -0.05));
      pin.material = index % 2 === 0 ? glow : metal;
      pin.parent = root;
    }

    const crest = BABYLON.MeshBuilder.CreateTorus("contract-board-guild-crest", {
      diameter: 1.1,
      thickness: 0.12,
      tessellation: 22
    }, scene);
    crest.position = new BABYLON.Vector3(0, 5.35, -0.42);
    crest.rotation.x = Math.PI / 2;
    crest.material = glow;
    crest.parent = root;

    root.getChildMeshes().forEach((mesh: any) => {
      mesh.computeWorldMatrix(true);
      mesh.freezeWorldMatrix();
    });

    const collisionBoxes = (this.world as any).collisionBoxes as Array<{
      minX: number;
      maxX: number;
      minZ: number;
      maxZ: number;
    }>;
    collisionBoxes?.push({
      minX: this.boardPosition.x - 3.05,
      maxX: this.boardPosition.x + 3.05,
      minZ: this.boardPosition.z - 0.9,
      maxZ: this.boardPosition.z + 0.9
    });
  }

  private installInteractionHook(): void {
    this.game.updateInteraction = (input: InputFrame): void => {
      const playerPosition = this.player.position();
      if (distance2d(playerPosition, this.boardPosition) <= 4.2) {
        this.hud.setInteraction("Review Caelus frontier contracts");
        if (input.interactPressed) this.openBoard();
        return;
      }
      this.originalInteraction(input);
    };
  }

  private installProgressHooks(): void {
    const recordEnemyDefeat = this.quests.recordEnemyDefeat.bind(this.quests);
    this.quests.recordEnemyDefeat = (kind: EnemyKind): void => {
      recordEnemyDefeat(kind);
      this.recordEnemyProgress(kind);
    };

    const activateBeacon = this.quests.activateBeacon.bind(this.quests);
    this.quests.activateBeacon = (id: string, displayName: string): boolean => {
      const changed = activateBeacon(id, displayName);
      this.updateSurveyProgress(true);
      return changed;
    };

    const claimCache = this.quests.claimCache.bind(this.quests);
    this.quests.claimCache = (id: string): boolean => {
      const claimed = claimCache(id);
      if (claimed && !id.startsWith("contract-reward-")) this.updateSurveyProgress(true);
      return claimed;
    };
  }

  private recordEnemyProgress(kind: EnemyKind): void {
    const id: ContractId | null = kind === "rift-boar"
      ? "boar-control"
      : kind === "rift-wisp"
        ? "wisp-suppression"
        : null;
    if (!id) return;
    const record = this.state[id];
    if (!record.active || this.isComplete(id)) return;
    const target = this.definition(id).target;
    record.progress = Math.min(target, record.progress + 1);
    this.persist();
    this.refreshTracker(true);
    this.hud.notify(
      this.isComplete(id) ? "CONTRACT COMPLETE" : "CONTRACT UPDATED",
      `${this.definition(id).title}: ${record.progress} of ${target}.`
    );
    if (this.isComplete(id)) this.audio.quest();
  }

  private updateSurveyProgress(announce: boolean): void {
    const record = this.state["foundation-survey"];
    if (!record.active || record.completions > 0) return;
    const beacons = Math.min(3, this.quests.save.expedition.activatedBeacons.length);
    const caches = Math.min(
      2,
      this.quests.save.expedition.claimedCaches.filter((id: string) => !id.startsWith("contract-reward-")).length
    );
    const previous = record.progress;
    record.progress = beacons + caches;
    if (record.progress === previous) return;
    this.persist();
    this.refreshTracker(true);
    if (announce) {
      this.hud.notify(
        this.isComplete("foundation-survey") ? "CONTRACT COMPLETE" : "SURVEY CONTRACT UPDATED",
        `Foundation Survey: ${record.progress} of ${this.definition("foundation-survey").target}.`
      );
      if (this.isComplete("foundation-survey")) this.audio.quest();
    }
  }

  private openBoard(): void {
    this.game.input.releasePointerLock();
    const active = DEFINITIONS.filter((definition) => this.state[definition.id].active).length;
    const completed = DEFINITIONS.reduce((sum, definition) => sum + this.state[definition.id].completions, 0);
    const choices = DEFINITIONS.map((definition) => this.choiceFor(definition));
    choices.push({ label: "Leave the board", action: () => this.closeBoard() });
    this.hud.showDialogue(
      "Caelus Guild Board",
      "CG",
      `The frontier office has ${active} active assignment${active === 1 ? "" : "s"} under your name and ${completed} recorded completion${completed === 1 ? "" : "s"}. Contract rewards are attuned directly into your expedition materials.`,
      choices
    );
  }

  private choiceFor(definition: ContractDefinition): { label: string; action: () => void } {
    const record = this.state[definition.id];
    if (this.isComplete(definition.id)) {
      return {
        label: `Claim ${definition.title} — ${definition.reward}`,
        action: () => {
          this.claim(definition.id);
          this.openBoard();
        }
      };
    }
    if (record.active) {
      return {
        label: `${definition.title} · ${record.progress}/${definition.target}`,
        action: () => this.showDetail(definition)
      };
    }
    if (!definition.repeatable && record.completions > 0) {
      return {
        label: `${definition.title} · Completed`,
        action: () => this.showDetail(definition)
      };
    }
    return {
      label: `Accept ${definition.title}`,
      action: () => {
        this.accept(definition.id);
        this.openBoard();
      }
    };
  }

  private showDetail(definition: ContractDefinition): void {
    const record = this.state[definition.id];
    this.hud.showDialogue(
      "Caelus Guild Board",
      "CG",
      `${definition.summary} Progress: ${record.progress} of ${definition.target}. Reward: ${definition.reward}.${definition.repeatable ? " This contract can be renewed after collection." : " This survey commission is issued once."}`,
      [
        { label: "Return to contracts", action: () => this.openBoard() },
        { label: "Leave the board", action: () => this.closeBoard() }
      ]
    );
  }

  private accept(id: ContractId): void {
    const definition = this.definition(id);
    const record = this.state[id];
    if (record.active || !definition.repeatable && record.completions > 0) return;
    record.active = true;
    record.progress = 0;
    if (id === "foundation-survey") this.updateSurveyProgress(false);
    this.persist();
    this.refreshTracker(true);
    this.hud.notify("FRONTIER CONTRACT ACCEPTED", definition.title);
    this.audio.quest();
  }

  private claim(id: ContractId): void {
    if (!this.isComplete(id)) return;
    const definition = this.definition(id);
    const record = this.state[id];
    if (id === "boar-control") {
      this.quests.save.expedition.fractureDust += 4;
      this.player.focus = Math.min(100, this.player.focus + 15);
    } else if (id === "wisp-suppression") {
      this.quests.save.expedition.fractureDust += 6;
      this.quests.save.expedition.riftglassShards += 1;
      this.player.focus = Math.min(100, this.player.focus + 25);
    } else {
      this.quests.save.expedition.fractureDust += 4;
      this.quests.save.expedition.riftglassShards += 2;
      this.player.focus = Math.min(100, this.player.focus + 35);
    }

    record.completions += 1;
    record.progress = 0;
    record.active = false;
    this.quests.recalculateEquipment?.(true);
    this.persist();
    this.refreshTracker(true);
    this.hud.notify("CONTRACT REWARD ATTUNED", `${definition.title}: ${definition.reward}.`);
    this.audio.quest();
  }

  private isComplete(id: ContractId): boolean {
    const definition = this.definition(id);
    const record = this.state[id];
    return record.active && record.progress >= definition.target;
  }

  private definition(id: ContractId): ContractDefinition {
    const definition = DEFINITIONS.find((entry) => entry.id === id);
    if (!definition) throw new Error(`Unknown contract ${id}`);
    return definition;
  }

  private persist(): void {
    (this.quests.save.expedition as any).contracts = this.state;
    this.quests.updatePlayer(this.player.health, this.player.focus);
  }

  private refreshTracker(force: boolean): void {
    const active = DEFINITIONS.filter((definition) => this.state[definition.id].active);
    const snapshot = JSON.stringify(active.map((definition) => ({
      id: definition.id,
      progress: this.state[definition.id].progress,
      target: definition.target
    })));
    if (!force && snapshot === this.lastTrackerSnapshot) return;
    this.lastTrackerSnapshot = snapshot;
    this.tracker.classList.toggle("visible", active.length > 0);
    this.tracker.innerHTML = active.length === 0
      ? ""
      : `<small>FRONTIER CONTRACTS</small>${active.map((definition) => {
        const record = this.state[definition.id];
        return `<div class="${record.progress >= definition.target ? "complete" : ""}"><span>${definition.title}</span><b>${record.progress}/${definition.target}</b><i><em style="transform:scaleX(${Math.min(1, record.progress / definition.target)})"></em></i></div>`;
      }).join("")}`;
  }

  private closeBoard(): void {
    this.hud.hideDialogue();
    this.game.canvas.focus();
    this.game.input.requestPointerLock();
  }

  private installStyles(): void {
    if (document.getElementById("frontier-contract-styles")) return;
    const style = document.createElement("style");
    style.id = "frontier-contract-styles";
    style.textContent = `
      .frontier-contract-tracker{position:fixed;z-index:38;right:22px;top:126px;display:grid;gap:7px;width:255px;padding:12px 13px;border:1px solid #e2c98a38;border-radius:12px;background:linear-gradient(125deg,#17130fe8,#252015dc);box-shadow:0 14px 36px #0007;color:#f7efd8;opacity:0;transform:translateX(15px);transition:.22s;pointer-events:none}.frontier-contract-tracker.visible{opacity:1;transform:none}.frontier-contract-tracker>small{color:#d8bd7b;font-size:8px;font-weight:800;letter-spacing:.18em}.frontier-contract-tracker>div{display:grid;grid-template-columns:1fr auto;gap:4px 8px}.frontier-contract-tracker span{font-size:10px;font-weight:700}.frontier-contract-tracker b{color:#d8c99e;font-size:9px}.frontier-contract-tracker i{grid-column:1/-1;height:3px;overflow:hidden;border-radius:3px;background:#ffffff10}.frontier-contract-tracker em{display:block;height:100%;transform-origin:left center;background:linear-gradient(90deg,#a98043,#f1d996);box-shadow:0 0 9px #d9b665}.frontier-contract-tracker .complete span,.frontier-contract-tracker .complete b{color:#9cf4d5}@media(max-width:720px){.frontier-contract-tracker{right:10px;top:110px;width:220px;transform:translateX(15px) scale(.9);transform-origin:right top}.frontier-contract-tracker.visible{transform:scale(.9)}}`;
    document.head.appendChild(style);
  }
}
