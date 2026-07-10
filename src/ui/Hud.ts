import type { CameraMode, GameSettings, QuestSave } from "../data/GameTypes.js";
import type { AudioDirector } from "../audio/AudioDirector.js";

interface DialogueChoice {
  label: string;
  action: () => void;
}

const required = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required UI element #${id}`);
  return element as T;
};

export class Hud {
  private readonly bootScreen = required<HTMLElement>("boot-screen");
  private readonly bootStatus = required<HTMLElement>("boot-status");
  private readonly hud = required<HTMLElement>("hud");
  private readonly healthBar = required<HTMLElement>("health-bar");
  private readonly staminaBar = required<HTMLElement>("stamina-bar");
  private readonly focusBar = required<HTMLElement>("focus-bar");
  private readonly healthValue = required<HTMLElement>("health-value");
  private readonly staminaValue = required<HTMLElement>("stamina-value");
  private readonly focusValue = required<HTMLElement>("focus-value");
  private readonly cameraMode = required<HTMLElement>("camera-mode");
  private readonly performanceChip = required<HTMLElement>("performance-chip");
  private readonly compassHeading = required<HTMLElement>("compass-heading");
  private readonly targetFrame = required<HTMLElement>("target-frame");
  private readonly targetName = required<HTMLElement>("target-name");
  private readonly targetHealth = required<HTMLElement>("target-health");
  private readonly interactionPrompt = required<HTMLElement>("interaction-prompt");
  private readonly interactionLabel = required<HTMLElement>("interaction-label");
  private readonly questCard = required<HTMLElement>("quest-card");
  private readonly questTitle = required<HTMLElement>("quest-title");
  private readonly questDescription = required<HTMLElement>("quest-description");
  private readonly questObjectives = required<HTMLUListElement>("quest-objectives");
  private readonly dialoguePanel = required<HTMLElement>("dialogue-panel");
  private readonly speakerName = required<HTMLElement>("speaker-name");
  private readonly speakerInitials = required<HTMLElement>("speaker-initials");
  private readonly dialogueText = required<HTMLElement>("dialogue-text");
  private readonly dialogueChoices = required<HTMLElement>("dialogue-choices");
  private readonly pausePanel = required<HTMLElement>("pause-panel");
  private readonly notificationStack = required<HTMLElement>("notification-stack");
  private readonly damageFlash = required<HTMLElement>("damage-flash");
  private readonly crosshair = required<HTMLElement>("crosshair");
  private readonly sensitivitySetting = required<HTMLInputElement>("sensitivity-setting");
  private readonly fovSetting = required<HTMLInputElement>("fov-setting");
  private readonly shakeSetting = required<HTMLInputElement>("shake-setting");
  private dialogueOpen = false;

  public readonly enterButton = required<HTMLButtonElement>("enter-world");
  public readonly resumeButton = required<HTMLButtonElement>("resume-game");

  constructor(private readonly audio: AudioDirector) {
    document.querySelectorAll("button").forEach((button) => {
      button.addEventListener("mouseenter", () => this.audio.uiHover());
    });
  }

  public setBootStatus(message: string): void {
    this.bootStatus.textContent = message;
  }

  public enterWorld(): void {
    this.bootScreen.classList.add("hidden");
    this.hud.classList.remove("hidden");
  }

  public setRenderer(name: string): void {
    this.performanceChip.innerHTML = `<span>◆</span> ${name.toUpperCase()}`;
  }

  public setVitals(health: number, maxHealth: number, stamina: number, focus: number): void {
    const healthPercent = Math.max(0, Math.min(100, (health / maxHealth) * 100));
    this.healthBar.style.width = `${healthPercent}%`;
    this.staminaBar.style.width = `${Math.max(0, Math.min(100, stamina))}%`;
    this.focusBar.style.width = `${Math.max(0, Math.min(100, focus))}%`;
    this.healthValue.textContent = Math.ceil(health).toString();
    this.staminaValue.textContent = Math.ceil(stamina).toString();
    this.focusValue.textContent = Math.floor(focus).toString();
  }

  public setCameraMode(mode: CameraMode): void {
    const label = mode === "first" ? "FIRST PERSON" : "THIRD PERSON";
    this.cameraMode.innerHTML = `<span>${mode === "first" ? "◎" : "◉"}</span> ${label}`;
    this.crosshair.classList.toggle("hidden", mode !== "first");
  }

  public setCompass(yaw: number): void {
    const degrees = ((yaw * 180) / Math.PI + 360) % 360;
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    this.compassHeading.textContent = directions[Math.round(degrees / 45) % 8];
  }

  public setTarget(name: string | null, health = 0, maxHealth = 1): void {
    if (!name) {
      this.targetFrame.classList.add("hidden");
      return;
    }
    this.targetFrame.classList.remove("hidden");
    this.targetName.textContent = name;
    this.targetHealth.style.width = `${Math.max(0, Math.min(100, (health / maxHealth) * 100))}%`;
  }

  public setInteraction(label: string | null): void {
    if (!label) {
      this.interactionPrompt.classList.add("hidden");
      return;
    }
    this.interactionLabel.textContent = label;
    this.interactionPrompt.classList.remove("hidden");
  }

  public updateQuest(quest: QuestSave): void {
    this.questObjectives.replaceChildren();

    if (!quest.accepted) {
      this.questTitle.textContent = "A Quiet Morning";
      this.questDescription.textContent = "Speak with Mara Venn near the expedition lantern.";
      this.appendObjective("Find Mara Venn", false);
    } else if (!quest.completed) {
      this.questTitle.textContent = "Echoes Under Stone";
      this.questDescription.textContent = "Track the creatures drawn to the buried mechanism beneath Windscar Verge.";
      this.appendObjective(`Cull rift boars (${Math.min(3, quest.boarsDefeated)}/3)`, quest.boarsDefeated >= 3);
      this.appendObjective("Investigate the resonant marker", quest.markerInvestigated);
      if (quest.boarsDefeated >= 3 && quest.markerInvestigated) {
        this.appendObjective("Return to Mara Venn", false);
      }
    } else {
      this.questTitle.textContent = "Echoes Under Stone — Complete";
      this.questDescription.textContent = "The first route toward the buried Foundry has been recorded.";
      this.appendObjective("Riftglass Edge attuned", true);
    }

    this.questCard.classList.remove("updated");
    void this.questCard.offsetWidth;
    this.questCard.classList.add("updated");
  }

  public showDialogue(name: string, initials: string, text: string, choices: DialogueChoice[]): void {
    this.dialogueOpen = true;
    this.speakerName.textContent = name;
    this.speakerInitials.textContent = initials;
    this.dialogueText.textContent = text;
    this.dialogueChoices.replaceChildren();
    choices.forEach((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = choice.label;
      button.addEventListener("mouseenter", () => this.audio.uiHover());
      button.addEventListener("click", () => {
        this.audio.uiConfirm();
        choice.action();
      });
      this.dialogueChoices.append(button);
    });
    this.dialoguePanel.classList.remove("hidden");
  }

  public hideDialogue(): void {
    this.dialogueOpen = false;
    this.dialoguePanel.classList.add("hidden");
  }

  public isDialogueOpen(): boolean {
    return this.dialogueOpen;
  }

  public setPause(open: boolean): void {
    this.pausePanel.classList.toggle("hidden", !open);
  }

  public bindSettings(settings: GameSettings, onChange: (settings: GameSettings) => void): void {
    this.sensitivitySetting.value = settings.sensitivity.toString();
    this.fovSetting.value = settings.fov.toString();
    this.shakeSetting.checked = settings.cameraShake;
    const emit = (): void => {
      onChange({
        sensitivity: Number(this.sensitivitySetting.value),
        fov: Number(this.fovSetting.value),
        cameraShake: this.shakeSetting.checked
      });
    };
    this.sensitivitySetting.addEventListener("input", emit);
    this.fovSetting.addEventListener("input", emit);
    this.shakeSetting.addEventListener("change", emit);
  }

  public notify(title: string, message: string): void {
    const notification = document.createElement("div");
    notification.className = "notification";
    const heading = document.createElement("strong");
    heading.textContent = title;
    const detail = document.createElement("span");
    detail.textContent = message;
    notification.append(heading, detail);
    this.notificationStack.append(notification);
    window.setTimeout(() => notification.remove(), 4200);
  }

  public flashDamage(): void {
    this.damageFlash.classList.add("active");
    window.setTimeout(() => this.damageFlash.classList.remove("active"), 170);
  }

  private appendObjective(label: string, complete: boolean): void {
    const item = document.createElement("li");
    item.textContent = label;
    item.classList.toggle("complete", complete);
    this.questObjectives.append(item);
  }
}
