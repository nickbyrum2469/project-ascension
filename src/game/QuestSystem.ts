import type {
  FrontierSave,
  GameSettings,
  LabyrinthSave,
  QuestSave,
  SaveData
} from "../data/GameTypes.js";
import type { Hud } from "../ui/Hud.js";
import type { AudioDirector } from "../audio/AudioDirector.js";

const STORAGE_KEY = "project-ascension-save-v1";

export interface CacheReward {
  shards: number;
  tonic: boolean;
  weaponLevel: number;
  levelIncreased: boolean;
}

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

const defaultFrontier = (): FrontierSave => ({
  activeBeacon: 0,
  activatedBeacons: [true, false, false, false],
  openedCaches: [false, false, false, false, false, false],
  riftglassShards: 0,
  tonics: 1,
  weaponLevel: 1,
  floorGuardianDefeated: false,
  ascensionUnlocked: false,
  ascentWitnessed: false
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
    this.hud.notify("PILLAR CORE RESTORED", "Foundation beacons across the first ring are waking up.");
    this.audio.quest();
    return true;
  }

  public activateBeacon(index: number): boolean {
    if (index < 0 || index >= this.save.frontier.activatedBeacons.length) return false;
    const newlyActivated = !this.save.frontier.activatedBeacons[index];
    this.save.frontier.activatedBeacons[index] = true;
    this.save.frontier.activeBeacon = index;
    this.persistAndRefresh();
    this.hud.notify(
      newlyActivated ? "FOUNDATION BEACON AWAKENED" : "CHECKPOINT UPDATED",
      `Respawn anchor synchronized to beacon ${index + 1}.`
    );
    this.audio.quest();
    return true;
  }

  public claimCache(index: number): CacheReward | null {
    if (index < 0 || index >= this.save.frontier.openedCaches.length) return null;
    if (this.save.frontier.openedCaches[index]) return null;

    const shards = index % 3 === 2 ? 2 : 1;
    const tonic = index % 2 === 1;
    const previousLevel = this.save.frontier.weaponLevel;
    this.save.frontier.openedCaches[index] = true;
    this.save.frontier.riftglassShards += shards;
    if (tonic) this.save.frontier.tonics += 1;
    this.save.frontier.weaponLevel = Math.min(4, 1 + Math.floor(this.save.frontier.riftglassShards / 3));
    this.persistAndRefresh();
    this.audio.quest();

    return {
      shards,
      tonic,
      weaponLevel: this.save.frontier.weaponLevel,
      levelIncreased: this.save.frontier.weaponLevel > previousLevel
    };
  }

  public consumeTonic(): boolean {
    if (this.save.frontier.tonics <= 0) return false;
    this.save.frontier.tonics -= 1;
    this.persistAndRefresh();
    return true;
  }

  public recordFloorGuardianDefeat(): void {
    if (this.save.frontier.floorGuardianDefeated) return;
    this.save.frontier.floorGuardianDefeated = true;
    this.save.frontier.ascensionUnlocked = true;
    this.save.player.focus = 100;
    this.persistAndRefresh();
    this.hud.notify("FIRST RING CONQUERED", "The northern ascent dais has opened.");
    this.audio.quest();
  }

  public witnessAscent(): void {
    if (!this.save.frontier.ascensionUnlocked || this.save.frontier.ascentWitnessed) return;
    this.save.frontier.ascentWitnessed = true;
    this.persistAndRefresh();
    this.hud.notify("ASCENSION ROUTE STABILIZED", "Floor Two now waits beyond the pillar crown.");
    this.audio.quest();
  }

  public weaponDamageMultiplier(): number {
    return 1 + (this.save.frontier.weaponLevel - 1) * 0.16;
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
      const parsedBeacons = parsed.frontier?.activatedBeacons ?? [];
      const parsedCaches = parsed.frontier?.openedCaches ?? [];
      const migratedGuardianDefeat = parsed.labyrinth?.guardianDefeated
        ?? parsed.labyrinth?.coreRestored
        ?? false;
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
        frontier: {
          ...defaultFrontier(),
          ...(parsed.frontier ?? {}),
          activatedBeacons: [0, 1, 2, 3].map((index) => parsedBeacons[index] ?? index === 0),
          openedCaches: [0, 1, 2, 3, 4, 5].map((index) => parsedCaches[index] ?? false)
        },
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
      frontier: defaultFrontier(),
      player: {
        health: 100,
        focus: 0,
        riftglassUnlocked: false
      }
    };
  }

  private refreshHud(): void {
    this.hud.updateQuest(this.save.quest, this.save.labyrinth, this.save.frontier);
  }

  private persistAndRefresh(): void {
    this.persist();
    this.refreshHud();
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.save));
  }
}
