export type CameraMode = "first" | "third";

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
}

export interface QuestSave {
  accepted: boolean;
  boarsDefeated: number;
  markerInvestigated: boolean;
  completed: boolean;
  rewardClaimed: boolean;
}

export interface SaveData {
  version: number;
  settings: GameSettings;
  quest: QuestSave;
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
  health: number;
  maxHealth: number;
  takeDamage(amount: number, impulse: any): void;
}
