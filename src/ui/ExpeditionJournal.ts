import type { SaveData } from "../data/GameTypes.js";
import "./expedition-journal.css";

const STORAGE_KEY = "project-ascension-save-v1";

const fallbackSave = (): SaveData => ({
  version: 5,
  settings: {
    sensitivity: 0.8,
    fov: 75,
    cameraShake: true,
    invertY: false,
    cameraMode: "third",
    compactQuestTracker: false
  },
  quest: {
    accepted: false,
    boarsDefeated: 0,
    markerInvestigated: false,
    completed: false,
    rewardClaimed: false
  },
  labyrinth: {
    unlocked: false,
    entered: false,
    sigilsActivated: [false, false, false],
    guardianDefeated: false,
    coreRestored: false,
    shortcutOpened: false
  },
  expedition: {
    activeBeacon: "caelus-gate",
    activatedBeacons: ["caelus-gate"],
    claimedCaches: [],
    riftglassShards: 0,
    ascentCompleted: false
  },
  player: { health: 100, focus: 0, riftglassUnlocked: false }
});

const readSave = (): SaveData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...fallbackSave(), ...JSON.parse(raw) as SaveData } : fallbackSave();
  } catch {
    return fallbackSave();
  }
};

const status = (complete: boolean, active = false): string =>
  complete ? "<i class=\"journal-status complete\">✓</i>" : active
    ? "<i class=\"journal-status active\">◆</i>"
    : "<i class=\"journal-status locked\">◇</i>";

const beaconNames: Record<string, string> = {
  "caelus-gate": "Caelus Gate",
  "windscar-rise": "Windscar Rise",
  "aqueduct-watch": "Aqueduct Watch",
  "foundry-breach": "Foundry Breach"
};

export class ExpeditionJournal {
  private readonly settingsPanel: HTMLElement;
  private readonly journalPanel: HTMLElement;
  private readonly settingsTab: HTMLButtonElement;
  private readonly journalTab: HTMLButtonElement;
  private lastSnapshot = "";

  constructor() {
    const pauseLayout = document.querySelector<HTMLElement>(".pause-layout");
    const settingsPanel = document.querySelector<HTMLElement>(".settings-panel");
    const sidebar = document.querySelector<HTMLElement>(".pause-sidebar");
    if (!pauseLayout || !settingsPanel || !sidebar) throw new Error("Pause interface unavailable");
    this.settingsPanel = settingsPanel;

    const tabs = document.createElement("nav");
    tabs.className = "expedition-tabs";
    tabs.setAttribute("aria-label", "Expedition menu sections");
    this.settingsTab = this.makeTab("Field Settings", true);
    this.journalTab = this.makeTab("Expedition Journal", false);
    tabs.append(this.settingsTab, this.journalTab);
    sidebar.insertBefore(tabs, sidebar.querySelector(".pause-help"));

    this.journalPanel = document.createElement("section");
    this.journalPanel.className = "expedition-journal hidden";
    this.journalPanel.setAttribute("aria-label", "Expedition journal");
    pauseLayout.append(this.journalPanel);

    this.settingsTab.addEventListener("click", () => this.select("settings"));
    this.journalTab.addEventListener("click", () => this.select("journal"));
    window.addEventListener("storage", () => this.render());
    window.setInterval(() => this.render(), 750);
    this.render(true);
  }

  private makeTab(label: string, selected: boolean): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "expedition-tab";
    button.textContent = label;
    button.setAttribute("aria-pressed", String(selected));
    button.classList.toggle("selected", selected);
    return button;
  }

  private select(panel: "settings" | "journal"): void {
    const journal = panel === "journal";
    this.settingsPanel.classList.toggle("hidden", journal);
    this.journalPanel.classList.toggle("hidden", !journal);
    this.settingsTab.classList.toggle("selected", !journal);
    this.journalTab.classList.toggle("selected", journal);
    this.settingsTab.setAttribute("aria-pressed", String(!journal));
    this.journalTab.setAttribute("aria-pressed", String(journal));
    if (journal) this.render(true);
  }

  private render(force = false): void {
    const save = readSave();
    const snapshot = JSON.stringify({ quest: save.quest, labyrinth: save.labyrinth, expedition: save.expedition });
    if (!force && snapshot === this.lastSnapshot) return;
    this.lastSnapshot = snapshot;

    const relays = save.labyrinth.sigilsActivated.filter(Boolean).length;
    const beacon = beaconNames[save.expedition.activeBeacon] ?? "Unknown Foundation Node";
    const questStage = !save.quest.accepted ? "Unaccepted" : !save.quest.completed ? "Active" : "Resolved";
    const foundryStage = !save.labyrinth.unlocked ? "Undiscovered" : !save.labyrinth.entered ? "Route Open" : !save.labyrinth.coreRestored ? "Expedition Active" : "Restored";

    this.journalPanel.innerHTML = `
      <header class="journal-header">
        <div><small>FLOOR I RECORD</small><h2>The Verdant Foundation</h2></div>
        <div class="journal-sigil" aria-hidden="true"><span></span><i></i><b></b></div>
      </header>
      <div class="journal-summary">
        <article><small>ACTIVE REST POINT</small><strong>${beacon}</strong><span>${save.expedition.activatedBeacons.length}/4 beacons attuned</span></article>
        <article><small>RECOVERED RIFTGLASS</small><strong>${save.expedition.riftglassShards}</strong><span>${save.expedition.claimedCaches.length}/4 caches secured</span></article>
        <article><small>FOUNDATION FOCUS</small><strong>${save.player.focus}</strong><span>${save.player.riftglassUnlocked ? "Riftglass Edge attuned" : "Relic dormant"}</span></article>
      </div>
      <div class="journal-columns">
        <section class="journal-thread">
          <div class="journal-section-title"><span>01</span><div><small>MAIN THREAD · ${questStage}</small><h3>Echoes Under Stone</h3></div></div>
          <ul>
            <li>${status(save.quest.accepted, !save.quest.accepted)}<span><strong>Receive Mara Venn's field order</strong><small>Investigate abnormal rift-boar migration beyond Caelus Reach.</small></span></li>
            <li>${status(save.quest.boarsDefeated >= 3, save.quest.accepted)}<span><strong>Break the migrating herd</strong><small>${Math.min(3, save.quest.boarsDefeated)} of 3 rift boars confirmed.</small></span></li>
            <li>${status(save.quest.markerInvestigated, save.quest.accepted)}<span><strong>Read the resonant marker</strong><small>Trace structural vibration beneath the old aqueduct.</small></span></li>
            <li>${status(save.quest.completed, save.quest.boarsDefeated >= 3 && save.quest.markerInvestigated)}<span><strong>Report the buried route</strong><small>Return evidence to Mara and unseal the Foundry path.</small></span></li>
          </ul>
        </section>
        <section class="journal-thread">
          <div class="journal-section-title"><span>02</span><div><small>FRONTIER RECORD · ${foundryStage}</small><h3>The Foundry Below</h3></div></div>
          <ul>
            <li>${status(save.labyrinth.entered, save.labyrinth.unlocked)}<span><strong>Enter the concealed Foundry</strong><small>The breach lies beneath the eastern support pillar.</small></span></li>
            <li>${status(relays === 3, save.labyrinth.entered)}<span><strong>Synchronize relay chambers</strong><small>${relays} of 3 ancient relays attuned.</small></span></li>
            <li>${status(save.labyrinth.guardianDefeated, save.labyrinth.entered)}<span><strong>Dismantle the Foundry Sentinel</strong><small>Remove the construct defending the pillar core.</small></span></li>
            <li>${status(save.labyrinth.coreRestored, relays === 3 && save.labyrinth.guardianDefeated)}<span><strong>Restore the pillar core</strong><small>Power the permanent shortcut and ascent infrastructure.</small></span></li>
            <li>${status(save.expedition.ascentCompleted, save.labyrinth.coreRestored)}<span><strong>Reach the Floor Two threshold</strong><small>Verify the eastern lift's sealed staging route.</small></span></li>
          </ul>
        </section>
      </div>
      <footer class="journal-footer"><span>Progress is recorded automatically at every expedition milestone.</span><kbd>ESC</kbd></footer>`;
  }
}
