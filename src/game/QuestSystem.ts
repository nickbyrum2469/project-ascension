import type {
  ExpeditionSave,
  GameSettings,
  LabyrinthSave,
  QuestSave,
  SaveData
} from "../data/GameTypes.js";
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

const defaultLabyrinth = (): LabyrinthSave => ({
  unlocked: false,
  entered: false,
  sigilsActivated: [false, false, false],
  guardianDefeated: false,
  coreRestored: false,
  shortcutOpened: false
});

const defaultExpedition = (): ExpeditionSave => ({
  activeBeacon: "caelus-gate",
  activatedBeacons: ["caelus-gate"],
  claimedCaches: [],
  riftglassShards: 0,
  ascentCompleted: false
});

const defaultSettings = (): GameSettings => ({
  sensitivity: 0.8,
  fov: 75,
  cameraShake: true,
  invertY: false,
  cameraMode: "third",
  compactQuestTracker: false
});

const uniqueStrings = (values: string[]): string[] => [...new Set(values.filter(Boolean))];

export class QuestSystem {
  public readonly save: SaveData;

  constructor(
    private readonly hud: Hud,
    private readonly audio: AudioDirector
  ) {
    this.save = this.load();
    this.refreshHud();
  }

  public accept(): void {
    if (this.save.quest.accepted) return;
    this.save.quest.accepted = true;
    this.persistAndRefresh();
    this.hud.notify("NEW THREAD", "Echoes Under Stone");
    this.audio.quest();
  }

  public recordBoarDefeat(): void {
    if (!this.save.quest.accepted || this.save.quest.completed) return;
    this.save.quest.boarsDefeated = Math.min(3, this.save.quest.boarsDefeated + 1);
    this.persistAndRefresh();
    this.hud.notify("HUNT UPDATED", `${this.save.quest.boarsDefeated} of 3 rift boars defeated`);
    this.audio.quest();
  }

  public investigateMarker(): void {
    if (!this.save.quest.accepted || this.save.quest.markerInvestigated) return;
    this.save.quest.markerInvestigated = true;
    this.persistAndRefresh();
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
    this.save.labyrinth.unlocked = true;
    this.save.player.riftglassUnlocked = true;
    this.save.player.focus = Math.max(this.save.player.focus, 35);
    this.persistAndRefresh();
    this.hud.notify("FOUNDRY ROUTE UNSEALED", "Riftglass Edge can now open the breach beneath the eastern pillar.");
    this.audio.quest();
  }

  public enterLabyrinth(): void {
    if (!this.save.labyrinth.unlocked || this.save.labyrinth.entered) return;
    this.save.labyrinth.entered = true;
    this.persistAndRefresh();
    this.hud.notify("FOUNDRY LABYRINTH", "Three dormant sigils are feeding a sealed pillar core.");
    this.audio.quest();
  }

  public activateSigil(index: number): boolean {
    if (!this.save.labyrinth.unlocked || this.save.labyrinth.coreRestored) return false;
    if (index < 0 || index >= this.save.labyrinth.sigilsActivated.length) return false;
    if (this.save.labyrinth.sigilsActivated[index]) return false;
    this.save.labyrinth.sigilsActivated[index] = true;
    const activeCount = this.activeSigilCount();
    this.persistAndRefresh();
    this.hud.notify("SIGIL ATTUNED", `${activeCount} of 3 Foundry relays are now synchronized.`);
    this.audio.quest();
    return true;
  }

  public recordGuardianDefeat(): void {
    if (this.save.labyrinth.guardianDefeated) return;
    this.save.labyrinth.guardianDefeated = true;
    this.save.player.focus = Math.max(this.save.player.focus, 70);
    this.persistAndRefresh();
    this.hud.notify("SENTINEL DISMANTLED", "The Foundry pillar core is no longer defended.");
    this.audio.quest();
  }

  public activeSigilCount(): number {
    return this.save.labyrinth.sigilsActivated.filter(Boolean).length;
  }

  public canRestoreCore(): boolean {
    return this.save.labyrinth.unlocked
      && this.activeSigilCount() >= 3
      && this.save.labyrinth.guardianDefeated
      && !this.save.labyrinth.coreRestored;
  }

  public restoreCore(): boolean {
    if (!this.canRestoreCore()) return false;
    this.save.labyrinth.coreRestored = true;
    this.save.labyrinth.shortcutOpened = true;
    this.save.player.focus = 100;
    this.persistAndRefresh();
    this.hud.notify("PILLAR CORE RESTORED", "A permanent return route and the eastern ascent lift are now powered.");
    this.audio.quest();
    return true;
  }

  public activateBeacon(id: string, displayName: string): boolean {
    const activated = this.save.expedition.activatedBeacons.includes(id);
    if (!activated) this.save.expedition.activatedBeacons.push(id);
    const changed = this.save.expedition.activeBeacon !== id || !activated;
    this.save.expedition.activeBeacon = id;
    this.save.expedition.activatedBeacons = uniqueStrings(this.save.expedition.activatedBeacons);
    this.persist();
    this.hud.notify(
      activated ? "BEACON RESTORED" : "FOUNDATION BEACON ATTUNED",
      `${displayName} is now your active expedition rest point.`
    );
    this.audio.quest();
    return changed;
  }

  public claimCache(id: string): boolean {
    if (this.save.expedition.claimedCaches.includes(id)) return false;
    this.save.expedition.claimedCaches.push(id);
    this.save.expedition.claimedCaches = uniqueStrings(this.save.expedition.claimedCaches);
    this.save.expedition.riftglassShards += 1;
    this.persist();
    this.hud.notify(
      "RIFTGLASS CACHE RECOVERED",
      `${this.save.expedition.riftglassShards} expedition shard${this.save.expedition.riftglassShards === 1 ? "" : "s"} secured.`
    );
    this.audio.quest();
    return true;
  }

  public completeAscent(): boolean {
    if (this.save.expedition.ascentCompleted) return false;
    this.save.expedition.ascentCompleted = true;
    this.persist();
    this.hud.notify(
      "ASCENT STAGING REACHED",
      "The eastern pillar lift has carried you to the sealed threshold beneath Floor Two."
    );
    this.audio.quest();
    return true;
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
      const parsedSigils = parsed.labyrinth?.sigilsActivated ?? [];
      const migratedGuardianDefeat = parsed.labyrinth?.guardianDefeated
        ?? parsed.labyrinth?.coreRestored
        ?? false;
      const expedition = { ...defaultExpedition(), ...(parsed.expedition ?? {}) };
      expedition.activatedBeacons = uniqueStrings([
        "caelus-gate",
        ...(parsed.expedition?.activatedBeacons ?? [])
      ]);
      expedition.claimedCaches = uniqueStrings(parsed.expedition?.claimedCaches ?? []);
      if (!expedition.activatedBeacons.includes(expedition.activeBeacon)) {
        expedition.activeBeacon = "caelus-gate";
      }
      return {
        version: 5,
        settings: { ...defaultSettings(), ...(parsed.settings ?? {}) },
        quest: { ...defaultQuest(), ...(parsed.quest ?? {}) },
        labyrinth: {
          ...defaultLabyrinth(),
          ...(parsed.labyrinth ?? {}),
          sigilsActivated: [0, 1, 2].map((index) => parsedSigils[index] ?? false),
          guardianDefeated: migratedGuardianDefeat
        },
        expedition,
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
      version: 5,
      settings: defaultSettings(),
      quest: defaultQuest(),
      labyrinth: defaultLabyrinth(),
      expedition: defaultExpedition(),
      player: {
        health: 100,
        focus: 0,
        riftglassUnlocked: false
      }
    };
  }

  private refreshHud(): void {
    this.hud.updateQuest(this.save.quest, this.save.labyrinth);
  }

  private persistAndRefresh(): void {
    this.persist();
    this.refreshHud();
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.save));
  }
}
