export type CameraMode = "first" | "third";
export type EnemyKind = "rift-boar" | "rift-wisp" | "foundry-sentinel";
export type EquippedCharm = "none" | "wayfinder" | "sentinel";

export interface InputFrame {
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  sprint: boolean;
  block: boolean;
  lightPressed: boolean;
  heavyPressed: boolean;
  dodgePressed: boolean;
  jumpPressed: boolean;
  interactPressed: boolean;
  toggleViewPressed: boolean;
  lockOnPressed: boolean;
  pausePressed: boolean;
  shoulderPressed: boolean;
}

export interface GameSettings {
  sensitivity: number;
  fov: number;
  cameraShake: boolean;
  invertY: boolean;
  cameraMode: CameraMode;
  compactQuestTracker: boolean;
}

export interface QuestSave {
  accepted: boolean;
  boarsDefeated: number;
  markerInvestigated: boolean;
  completed: boolean;
  rewardClaimed: boolean;
}

export interface LabyrinthSave {
  unlocked: boolean;
  entered: boolean;
  sigilsActivated: boolean[];
  guardianDefeated: boolean;
  coreRestored: boolean;
  shortcutOpened: boolean;
}

export interface ExpeditionSave {
  activeBeacon: string;
  activatedBeacons: string[];
  claimedCaches: string[];
  riftglassShards: number;
  fractureDust: number;
  wispDefeats: number;
  ascentCompleted: boolean;
}

export interface EquipmentSave {
  weaponRank: number;
  wardRank: number;
  equippedCharm: EquippedCharm;
}

export interface SaveData {
  version: number;
  settings: GameSettings;
  quest: QuestSave;
  labyrinth: LabyrinthSave;
  expedition: ExpeditionSave;
  equipment: EquipmentSave;
  player: {
    health: number;
    focus: number;
    riftglassUnlocked: boolean;
  };
}

export interface Damageable {
  readonly root: any;
  readonly name: string;
  readonly alive: boolean;
  readonly kind?: EnemyKind;
  health: number;
  maxHealth: number;
  takeDamage(amount: number, impulse: any): void;
}
