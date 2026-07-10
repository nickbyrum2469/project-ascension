import { AudioDirector, type AmbienceRegion } from "../audio/AudioDirector.js";
import { InputManager } from "../core/InputManager.js";
import type { InputFrame } from "../data/GameTypes.js";
import { Hud } from "../ui/Hud.js";
import {
  ExpeditionLayer,
  type ExpeditionInteraction
} from "../world/ExpeditionLayer.js";
import { FoundryLabyrinth } from "../world/FoundryLabyrinth.js";
import { World } from "../world/World.js";
import { Player } from "./Player.js";
import { QuestSystem } from "./QuestSystem.js";
import { RiftBoar } from "./RiftBoar.js";

interface TransientEffect {
  root: any;
  age: number;
  duration: number;
  heavy: boolean;
}

const emptyInput = (): InputFrame => ({
  moveX: 0,
  moveY: 0,
  lookX: 0,
  lookY: 0,
  sprint: false,
  block: false,
  lightPressed: false,
  heavyPressed: false,
  dodgePressed: false,
  jumpPressed: false,
  interactPressed: false,
  toggleViewPressed: false,
  lockOnPressed: false,
  pausePressed: false,
  shoulderPressed: false
});

export class Game {
  public readonly world: World;
  private readonly audio = new AudioDirector();
  private readonly hud = new Hud(this.audio);
  private readonly input: InputManager;
  private readonly quests: QuestSystem;
  private readonly player: Player;
  private readonly enemies: RiftBoar[];
  private readonly labyrinth: FoundryLabyrinth;
  private readonly expedition: ExpeditionLayer;
  private readonly effects: TransientEffect[] = [];
  private started = false;
  private paused = false;
  private lastFrame = performance.now();
  private elapsed = 0;
  private ambienceRegion: AmbienceRegion = "windscar";

  constructor(
    private readonly engine: any,
    private readonly canvas: HTMLCanvasElement,
    rendererName: string
  ) {
    this.input = new InputManager(canvas);
    this.world = new World(engine);
    this.quests = new QuestSystem(this.hud, this.audio);
    this.labyrinth = new FoundryLabyrinth(this.world);
    this.labyrinth.setProgress(this.quests.save.labyrinth);
    this.expedition = new ExpeditionLayer(this.world);
    this.expedition.setProgress(
      this.quests.save.expedition,
      this.quests.save.labyrinth.coreRestored
    );
    this.player = new Player(
      this.world,
      this.hud,
      this.audio,
      this.quests,
      (position, heavy) => this.spawnImpact(position, heavy)
    );
    this.enemies = this.world.spawnPoints.map((_, index) => this.createEnemy(index));

    this.hud.setRenderer(rendererName);
    this.hud.setBootStatus("Foundation lattice synchronized. Field entry ready.");
    this.hud.bindSettings(this.quests.save.settings, (settings) => {
      this.quests.updateSettings(settings);
      this.player.applySettings(settings);
    });
    this.player.applySettings(this.quests.save.settings);
    this.bindUi();
    this.registerServiceWorker();
  }

  public run(): void {
    this.engine.runRenderLoop(() => {
      const now = performance.now();
      const delta = Math.min(0.05, Math.max(0.001, (now - this.lastFrame) / 1000));
      this.lastFrame = now;
      this.update(delta);
      this.world.scene.render();
    });
    window.addEventListener("resize", () => this.engine.resize());
  }

  private bindUi(): void {
    this.hud.enterButton.addEventListener("click", async () => {
      await this.audio.unlock();
      this.audio.uiConfirm();
      this.started = true;
      this.input.setEnabled(true);
      this.hud.enterWorld();
      this.canvas.focus();
      this.input.requestPointerLock();
      this.hud.notify("THREAD AWAKENED", "Windscar Verge is now under live expedition control.");
    });

    this.hud.resumeButton.addEventListener("click", () => this.setPaused(false));
    this.canvas.addEventListener("click", () => {
      if (
        this.started
        && !this.paused
        && !this.hud.isDialogueOpen()
        && !this.expedition.isLiftActive()
      ) {
        this.input.requestPointerLock();
      }
    });
  }

  private update(delta: number): void {
    this.elapsed += delta;
    const sampled = this.started ? this.input.sample() : emptyInput();
    if (sampled.pausePressed && this.started && !this.hud.isDialogueOpen()) {
      this.setPaused(!this.paused);
    }

    const liftLocked = this.expedition.isLiftActive();
    const controlsEnabled = this.started
      && !this.paused
      && !this.hud.isDialogueOpen()
      && !liftLocked;
    this.player.update(delta, sampled, this.enemies, controlsEnabled);

    if (controlsEnabled) {
      this.enemies.forEach((enemy) => enemy.update(delta, this.player.position(), this.player.blocking));
      this.updateInteraction(sampled);
    } else {
      this.hud.setInteraction(null);
    }

    if (this.expedition.updateLift(delta, this.player.root)) {
      this.quests.completeAscent();
      this.expedition.setProgress(
        this.quests.save.expedition,
        this.quests.save.labyrinth.coreRestored
      );
      this.spawnImpact(this.player.position().add(new BABYLON.Vector3(0, 1.5, 0)), true);
      this.spawnImpact(this.player.position().add(new BABYLON.Vector3(0, 4.5, -4)), true);
      this.input.requestPointerLock();
    }

    this.expedition.update(delta, this.player.position());
    this.updateAmbience();
    this.animateWorld(delta);
    this.updateEffects(delta);
  }

  private updateInteraction(input: InputFrame): void {
    const playerPosition = this.player.position();
    const maraPosition = this.world.mara.root.position;
    const maraDistance = BABYLON.Vector3.Distance(playerPosition, maraPosition);
    const markerDistance = BABYLON.Vector3.Distance(playerPosition, this.world.markerPosition);
    const entryDistance = BABYLON.Vector3.Distance(playerPosition, this.labyrinth.entryPosition);
    const labyrinthSave = this.quests.save.labyrinth;

    if (maraDistance <= 3.25) {
      this.hud.setInteraction("Speak with Mara Venn");
      if (input.interactPressed) this.openMaraDialogue();
      return;
    }

    if (markerDistance <= 3.5 && this.quests.save.quest.accepted && !this.quests.save.quest.markerInvestigated) {
      this.hud.setInteraction("Inspect the resonant marker");
      if (input.interactPressed) {
        this.quests.investigateMarker();
        this.spawnMarkerPulse();
      }
      return;
    }

    if (entryDistance <= 5.2) {
      if (!labyrinthSave.unlocked) {
        this.hud.setInteraction("The Foundry breach is sealed");
      } else if (!labyrinthSave.entered) {
        this.hud.setInteraction("Open the Foundry Labyrinth");
        if (input.interactPressed) {
          this.quests.enterLabyrinth();
          this.labyrinth.setProgress(this.quests.save.labyrinth);
          this.spawnImpact(this.labyrinth.entryPosition.add(new BABYLON.Vector3(0, 2.3, 0)), true);
        }
      } else {
        this.hud.setInteraction("Foundry relay chambers ahead");
      }
      return;
    }

    if (labyrinthSave.entered && !labyrinthSave.coreRestored) {
      for (let index = 0; index < this.labyrinth.sigilPositions.length; index += 1) {
        const sigilPosition = this.labyrinth.sigilPositions[index];
        const distance = BABYLON.Vector3.Distance(playerPosition, sigilPosition);
        if (distance <= 4 && !labyrinthSave.sigilsActivated[index]) {
          this.hud.setInteraction(`Attune Foundry relay ${index + 1}`);
          if (input.interactPressed && this.quests.activateSigil(index)) {
            this.labyrinth.setProgress(this.quests.save.labyrinth);
            this.spawnImpact(sigilPosition.add(new BABYLON.Vector3(0, 1.4, 0)), false);
          }
          return;
        }
      }

      const coreDistance = BABYLON.Vector3.Distance(playerPosition, this.labyrinth.corePosition);
      if (coreDistance <= 5.2) {
        if (this.quests.canRestoreCore()) {
          this.hud.setInteraction("Restore the buried pillar core");
          if (input.interactPressed && this.quests.restoreCore()) {
            this.labyrinth.setProgress(this.quests.save.labyrinth);
            this.expedition.setProgress(
              this.quests.save.expedition,
              this.quests.save.labyrinth.coreRestored
            );
            this.spawnImpact(this.labyrinth.corePosition.add(new BABYLON.Vector3(0, 3.2, 0)), true);
            this.spawnImpact(this.labyrinth.corePosition.add(new BABYLON.Vector3(0, 5.2, 0)), true);
          }
        } else {
          const guardianStatus = labyrinthSave.guardianDefeated
            ? "guardian defeated"
            : "Sentinel still active";
          this.hud.setInteraction(
            `Pillar core sealed — ${this.quests.activeSigilCount()}/3 relays, ${guardianStatus}`
          );
        }
        return;
      }
    }

    if (labyrinthSave.shortcutOpened) {
      const shortcutDistance = BABYLON.Vector3.Distance(playerPosition, this.labyrinth.shortcutPosition);
      if (shortcutDistance <= 4.5) {
        this.hud.setInteraction("Return to Caelus Reach");
        if (input.interactPressed) this.useFoundryShortcut();
        return;
      }
    }

    const expeditionInteraction = this.expedition.nearestInteraction(
      playerPosition,
      this.quests.save.expedition,
      labyrinthSave.coreRestored
    );
    if (expeditionInteraction) {
      this.handleExpeditionInteraction(expeditionInteraction, input);
      return;
    }

    this.hud.setInteraction(null);
  }

  private handleExpeditionInteraction(
    interaction: ExpeditionInteraction,
    input: InputFrame
  ): void {
    this.hud.setInteraction(interaction.label);
    if (!input.interactPressed) return;

    if (interaction.kind === "beacon") {
      const displayName = this.expedition.getBeaconName(interaction.id);
      this.quests.activateBeacon(interaction.id, displayName);
      this.player.health = this.player.maxHealth;
      this.player.stamina = 100;
      this.player.focus = Math.max(this.player.focus, 55);
      this.quests.updatePlayer(this.player.health, this.player.focus);
      this.respawnOutdoorEnemies();
      this.expedition.setProgress(
        this.quests.save.expedition,
        this.quests.save.labyrinth.coreRestored
      );
      this.spawnImpact(this.player.position().add(new BABYLON.Vector3(0, 1.35, 0)), true);
      return;
    }

    if (interaction.kind === "cache") {
      if (this.quests.claimCache(interaction.id)) {
        this.expedition.setProgress(
          this.quests.save.expedition,
          this.quests.save.labyrinth.coreRestored
        );
        this.spawnImpact(this.player.position().add(new BABYLON.Vector3(0, 1.05, 0)), false);
      }
      return;
    }

    if (interaction.kind === "citizen" && interaction.citizenIndex !== undefined) {
      this.openCitizenDialogue(interaction.citizenIndex);
      return;
    }

    if (interaction.kind === "lift" && this.expedition.startLift()) {
      this.input.releasePointerLock();
      this.audio.quest();
      this.hud.notify(
        "EASTERN PILLAR LIFT",
        "Foundation clamps engaged. Ascending toward the sealed Floor Two threshold."
      );
    }
  }

  private openCitizenDialogue(index: number): void {
    const citizen = this.expedition.getCitizen(index);
    if (!citizen) return;
    this.input.releasePointerLock();
    this.hud.showDialogue(
      citizen.name,
      citizen.initials,
      `${citizen.role} — ${citizen.line}`,
      [{ label: "Safe roads.", action: () => this.closeDialogue() }]
    );
  }

  private openMaraDialogue(): void {
    this.input.releasePointerLock();
    const quest = this.quests.save.quest;
    const labyrinth = this.quests.save.labyrinth;
    const expedition = this.quests.save.expedition;
    if (!quest.accepted) {
      this.hud.showDialogue(
        "Mara Venn",
        "MV",
        "The boars are not feeding. They are circling the old aqueduct whenever the ground begins to hum. Cull the worst of the herd, then inspect the cyan marker beyond the red grass. I need proof before the guild seals the western road.",
        [
          {
            label: "I’ll trace the disturbance.",
            action: () => {
              this.quests.accept();
              this.closeDialogue();
            }
          },
          {
            label: "Tell me about the marker.",
            action: () => this.hud.showDialogue(
              "Mara Venn",
              "MV",
              "It predates Caelus Reach. The ring pattern matches the support pillars, but the pulse is coming from below us—not above. Whatever is buried there has started waking up.",
              [{ label: "Understood.", action: () => this.closeDialogue() }]
            )
          }
        ]
      );
      return;
    }

    if (this.quests.canComplete()) {
      this.hud.showDialogue(
        "Mara Venn",
        "MV",
        "Three carcasses carried the same fracture dust, and your marker reading confirms a hollow chamber beneath the aqueduct. This is no animal migration. You found the first thread toward the buried Foundry.",
        [{
          label: "Record the route and attune the relic.",
          action: () => {
            this.quests.complete();
            this.labyrinth.setProgress(this.quests.save.labyrinth);
            this.player.visual.rune.material.emissiveIntensity = 1.7;
            this.spawnImpact(this.player.position().add(new BABYLON.Vector3(0, 1.2, 0)), true);
            this.closeDialogue();
          }
        }]
      );
      return;
    }

    if (expedition.ascentCompleted) {
      this.hud.showDialogue(
        "Mara Venn",
        "MV",
        `You reached the sealed threshold beneath Floor Two. The city counted eight full lift cycles before your signal returned. We have ${expedition.riftglassShards} recovered Riftglass shard${expedition.riftglassShards === 1 ? "" : "s"} and a stable route for the next expedition phase.`,
        [{ label: "We prepare for the next floor.", action: () => this.closeDialogue() }]
      );
      return;
    }

    if (labyrinth.coreRestored) {
      this.hud.showDialogue(
        "Mara Venn",
        "MV",
        "The eastern pillar is carrying power again. Its lift is active beyond the restored core. Ride it to the staging threshold and confirm whether the route toward Floor Two can hold a living expedition.",
        [{ label: "I’ll test the ascent.", action: () => this.closeDialogue() }]
      );
      return;
    }

    if (quest.completed) {
      const status = labyrinth.entered
        ? `${this.quests.activeSigilCount()} of the 3 relay sigils are synchronized.`
        : "The breach is open beneath the eastern support pillar.";
      this.hud.showDialogue(
        "Mara Venn",
        "MV",
        `The buried Foundry is responding to your Riftglass Edge. ${status} Restore the pillar core and it should create a stable return route to the city.`,
        [{ label: "I’ll finish the restoration.", action: () => this.closeDialogue() }]
      );
      return;
    }

    const hunt = Math.min(3, quest.boarsDefeated);
    const marker = quest.markerInvestigated
      ? "The marker’s signal is logged."
      : "The marker still needs a direct reading.";
    this.hud.showDialogue(
      "Mara Venn",
      "MV",
      `The road remains unstable. You have confirmed ${hunt} of 3 rift boars. ${marker}`,
      [{ label: "I’ll continue the sweep.", action: () => this.closeDialogue() }]
    );
  }

  private useFoundryShortcut(): void {
    const destination = new BABYLON.Vector3(0, this.world.heightAt(0, -18), -18);
    this.player.root.position.copyFrom(destination);
    this.player.lockTarget = null;
    this.audio.setAmbience("caelus");
    this.ambienceRegion = "caelus";
    this.spawnImpact(destination.add(new BABYLON.Vector3(0, 1.2, 0)), true);
    this.hud.notify("FOUNDATION SHORTCUT", "The restored pillar returned you to the Caelus Reach gate.");
  }

  private respawnOutdoorEnemies(): void {
    let restored = 0;
    for (let index = 0; index < Math.min(4, this.enemies.length); index += 1) {
      if (this.enemies[index].alive) continue;
      this.enemies[index].root.dispose(false, true);
      this.enemies[index] = this.createEnemy(index);
      restored += 1;
    }
    if (restored > 0) {
      this.hud.notify(
        "FRONTIER REPOPULATED",
        `${restored} Rift Boar${restored === 1 ? "" : "s"} returned to the outer routes while you rested.`
      );
    }
  }

  private createEnemy(index: number): RiftBoar {
    return new RiftBoar(
      this.world,
      this.world.spawnPoints[index].clone(),
      index,
      this.audio,
      this.quests,
      (amount, source) => this.player.receiveDamage(amount, source),
      (position, heavy) => this.spawnImpact(position, heavy)
    );
  }

  private updateAmbience(): void {
    const position = this.player.position();
    const next: AmbienceRegion = Math.abs(position.x) < 130 && position.z > 0 && position.z < 205
      ? "caelus"
      : "windscar";
    if (next === this.ambienceRegion) return;
    this.ambienceRegion = next;
    this.audio.setAmbience(next);
  }

  private closeDialogue(): void {
    this.hud.hideDialogue();
    if (!this.paused && !this.expedition.isLiftActive()) this.input.requestPointerLock();
  }

  private setPaused(paused: boolean): void {
    this.paused = paused;
    this.hud.setPause(paused);
    this.input.setEnabled(!paused);
    if (paused) {
      this.input.releasePointerLock();
      this.audio.uiConfirm();
    } else {
      this.canvas.focus();
      if (!this.expedition.isLiftActive()) this.input.requestPointerLock();
      this.audio.uiConfirm();
    }
  }

  private animateWorld(delta: number): void {
    const mara = this.world.mara;
    mara.hips.position.y = 0.92 + Math.sin(this.elapsed * 1.8) * 0.012;
    mara.cape.rotation.x = 0.08 + Math.sin(this.elapsed * 1.2) * 0.025;
    mara.head.rotation.y = Math.sin(this.elapsed * 0.42) * 0.09;
    mara.rune.scaling.setAll(1 + Math.sin(this.elapsed * 2.6) * 0.05);

    this.world.marker.rotation.y += delta * 0.18;
    const rings = this.world.marker.getChildMeshes?.() ?? [];
    rings.forEach((mesh: any, index: number) => {
      if (!mesh.name.includes("marker-ring")) return;
      const pulse = 1 + Math.sin(this.elapsed * 3 + index * 0.8) * 0.08;
      mesh.scaling.setAll(pulse);
      mesh.rotation.y += delta * (index % 2 ? -0.45 : 0.55);
    });
    this.labyrinth.update(delta);
  }

  private spawnImpact(position: any, heavy: boolean): void {
    const root = new BABYLON.TransformNode(`impact-${performance.now()}`, this.world.scene);
    root.position.copyFrom(position);
    const material = new BABYLON.PBRMaterial(`impact-material-${performance.now()}`, this.world.scene);
    material.albedoColor = BABYLON.Color3.FromHexString(heavy ? "#e9fbff" : "#71e8ff");
    material.emissiveColor = BABYLON.Color3.FromHexString(heavy ? "#9bf5ff" : "#22cbe7");
    material.emissiveIntensity = heavy ? 2.8 : 1.9;
    material.metallic = 0.1;
    material.roughness = 0.18;

    const ring = BABYLON.MeshBuilder.CreateTorus(`impact-ring-${performance.now()}`, {
      diameter: heavy ? 1.5 : 0.9,
      thickness: heavy ? 0.055 : 0.035,
      tessellation: 28
    }, this.world.scene);
    ring.material = material;
    ring.rotation.x = Math.PI / 2;
    ring.parent = root;

    const shardCount = heavy ? 12 : 7;
    for (let index = 0; index < shardCount; index += 1) {
      const shard = BABYLON.MeshBuilder.CreatePolyhedron(`impact-shard-${index}-${performance.now()}`, {
        type: 1,
        size: heavy ? 0.13 : 0.085
      }, this.world.scene);
      shard.material = material;
      const angle = (index / shardCount) * Math.PI * 2;
      shard.position = new BABYLON.Vector3(
        Math.cos(angle) * 0.36,
        Math.sin(index * 2.3) * 0.18,
        Math.sin(angle) * 0.36
      );
      shard.rotation = new BABYLON.Vector3(angle, angle * 0.7, angle * 1.3);
      shard.metadata = {
        direction: new BABYLON.Vector3(
          Math.cos(angle),
          0.3 + (index % 3) * 0.12,
          Math.sin(angle)
        )
      };
      shard.parent = root;
    }

    this.effects.push({ root, age: 0, duration: heavy ? 0.55 : 0.38, heavy });
  }

  private spawnMarkerPulse(): void {
    const point = this.world.markerPosition.add(new BABYLON.Vector3(0, 1.4, 0));
    this.spawnImpact(point, true);
    this.spawnImpact(point.add(new BABYLON.Vector3(0, 0.8, 0)), false);
  }

  private updateEffects(delta: number): void {
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index];
      effect.age += delta;
      const progress = effect.age / effect.duration;
      const scale = 0.2 + progress * (effect.heavy ? 2.3 : 1.6);
      effect.root.scaling.setAll(scale);
      effect.root.rotation.y += delta * 5.5;
      effect.root.getChildMeshes().forEach((mesh: any) => {
        if (mesh.metadata?.direction) {
          mesh.position.addInPlace(
            mesh.metadata.direction.scale(delta * (effect.heavy ? 2.4 : 1.7))
          );
        }
        if (mesh.material) mesh.material.alpha = Math.max(0, 1 - progress);
      });
      if (progress >= 1) {
        effect.root.getChildMeshes().forEach((mesh: any) => mesh.dispose(false, true));
        effect.root.dispose();
        this.effects.splice(index, 1);
      }
    }
  }

  private registerServiceWorker(): void {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    window.addEventListener("load", () => {
      void navigator.serviceWorker.register("./sw.js").catch(() => undefined);
    });
  }
}
