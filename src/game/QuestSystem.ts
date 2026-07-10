import type { GameSettings, QuestSave, SaveData } from "../data/GameTypes.js";
import type { Hud } from "../ui/Hud.js";
import type { AudioDirector } from "../audio/AudioDirector.js";

const STORAGE_KEY = "project-ascension-save-v1";

const defaultQuest = (): QuestSave => ({
  accepted: false,
  boarsDefeated: 0,
  markerInvestigated: false,
  completed: false,
  rewardClaimed: false
});

const defaultSettings = (): GameSettings => ({
  sensitivity: 0.8,
  fov: 75,
  cameraShake: true,
  invertY: false,
  cameraMode: "third",
  compactQuestTracker: false
});

export class QuestSystem {
  public readonly save: SaveData;

  constructor(
    private readonly hud: Hud,
    private readonly audio: AudioDirector
  ) {
    this.save = this.load();
    this.hud.updateQuest(this.save.quest);
  }

  public accept(): void {
    if (this.save.quest.accepted) return;
    this.save.quest.accepted = true;
    this.persist();
    this.hud.updateQuest(this.save.quest);
    this.hud.notify("NEW THREAD", "Echoes Under Stone");
    this.audio.quest();
  }

  public recordBoarDefeat(): void {
    if (!this.save.quest.accepted || this.save.quest.completed) return;
    this.save.quest.boarsDefeated = Math.min(3, this.save.quest.boarsDefeated + 1);
    this.persist();
    this.hud.updateQuest(this.save.quest);
    this.hud.notify("HUNT UPDATED", `${this.save.quest.boarsDefeated} of 3 rift boars defeated`);
    this.audio.quest();
  }

  public investigateMarker(): void {
    if (!this.save.quest.accepted || this.save.quest.markerInvestigated) return;
    this.save.quest.markerInvestigated = true;
    this.persist();
    this.hud.updateQuest(this.save.quest);
    this.hud.notify("CLUE RECORDED", "The aqueduct stone is resonating with machinery below.");
    this.audio.quest();
  }

  public canComplete(): boolean {
    return this.save.quest.accepted
      && this.save.quest.boarsDefeated >= 3
      && this.save.quest.markerInvestigated
      && !this.save.quest.completed;
  }

  public complete(): void {
    if (!this.canComplete()) return;
    this.save.quest.completed = true;
    this.save.quest.rewardClaimed = true;
    this.save.player.riftglassUnlocked = true;
    this.save.player.focus = Math.max(this.save.player.focus, 35);
    this.persist();
    this.hud.updateQuest(this.save.quest);
    this.hud.notify("RELIC ATTUNED", "Riftglass Edge — attacks now leave a cyan fracture wake.");
    this.audio.quest();
  }

  public updateSettings(settings: GameSettings): void {
    this.save.settings = settings;
    this.persist();
  }

  public updatePlayer(health: number, focus: number): void {
    this.save.player.health = health;
    this.save.player.focus = focus;
    this.persist();
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return this.defaults();
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      return {
        version: 2,
        settings: { ...defaultSettings(), ...(parsed.settings ?? {}) },
        quest: { ...defaultQuest(), ...(parsed.quest ?? {}) },
        player: {
          health: parsed.player?.health ?? 100,
          focus: parsed.player?.focus ?? 0,
          riftglassUnlocked: parsed.player?.riftglassUnlocked ?? false
        }
      };
    } catch {
      return this.defaults();
    }
  }

  private defaults(): SaveData {
    return {
      version: 2,
      settings: defaultSettings(),
      quest: defaultQuest(),
      player: {
        health: 100,
        focus: 0,
        riftglassUnlocked: false
      }
    };
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.save));
  }
}
