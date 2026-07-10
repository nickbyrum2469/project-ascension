const STORAGE_KEY = "project-ascension-save-v1";

type JournalTab = "overview" | "records" | "network";

interface JournalSave {
  quest?: {
    accepted?: boolean;
    boarsDefeated?: number;
    markerInvestigated?: boolean;
    completed?: boolean;
  };
  labyrinth?: {
    unlocked?: boolean;
    entered?: boolean;
    sigilsActivated?: boolean[];
    guardianDefeated?: boolean;
    coreRestored?: boolean;
    shortcutOpened?: boolean;
  };
  expedition?: {
    activeBeacon?: string;
    activatedBeacons?: string[];
    claimedCaches?: string[];
    riftglassShards?: number;
    ascentCompleted?: boolean;
  };
}

const beaconNames: Record<string, string> = {
  "caelus-gate": "Caelus Gate",
  "windscar-rise": "Windscar Rise",
  "aqueduct-watch": "Aqueduct Watch",
  "foundry-breach": "Foundry Breach"
};

const readSave = (): JournalSave => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as JournalSave;
  } catch {
    return {};
  }
};

const escapeHtml = (value: string): string => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const completion = (save: JournalSave): number => {
  const quest = save.quest ?? {};
  const labyrinth = save.labyrinth ?? {};
  const expedition = save.expedition ?? {};
  const sigils = labyrinth.sigilsActivated ?? [];
  const checks = [
    quest.accepted,
    (quest.boarsDefeated ?? 0) >= 3,
    quest.markerInvestigated,
    quest.completed,
    labyrinth.entered,
    sigils.filter(Boolean).length >= 3,
    labyrinth.guardianDefeated,
    labyrinth.coreRestored,
    (expedition.activatedBeacons?.length ?? 0) >= 4,
    (expedition.claimedCaches?.length ?? 0) >= 4,
    expedition.ascentCompleted
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
};

export class ExpeditionJournal {
  private readonly root: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly content: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly progressLabel: HTMLElement;
  private readonly tabs: HTMLButtonElement[];
  private open = false;
  private activeTab: JournalTab = "overview";

  constructor() {
    this.installStyles();
    this.root = document.createElement("section");
    this.root.id = "expedition-journal";
    this.root.className = "journal-shell";
    this.root.setAttribute("aria-hidden", "true");
    this.root.innerHTML = `
      <div class="journal-backdrop"></div>
      <article class="journal-panel" role="dialog" aria-modal="true" aria-labelledby="journal-title">
        <header class="journal-header">
          <div class="journal-sigil" aria-hidden="true"><span></span><i></i></div>
          <div>
            <p class="journal-kicker">FOUNDATION ARCHIVE</p>
            <h2 id="journal-title">Expedition Journal</h2>
            <p class="journal-subtitle">Field intelligence, route memory, and permanent floor progress.</p>
          </div>
          <button class="journal-close" type="button" aria-label="Close expedition journal">×</button>
        </header>
        <div class="journal-progress-wrap">
          <div class="journal-progress-copy"><span>Floor I completion</span><strong>0%</strong></div>
          <div class="journal-progress-track"><div class="journal-progress-fill"></div></div>
        </div>
        <nav class="journal-tabs" aria-label="Journal sections">
          <button type="button" data-tab="overview" class="active">Overview</button>
          <button type="button" data-tab="records">Field Records</button>
          <button type="button" data-tab="network">Beacon Network</button>
        </nav>
        <div class="journal-content" tabindex="0"></div>
        <footer class="journal-footer"><span><kbd>J</kbd> Journal</span><span><kbd>Esc</kbd> Close</span></footer>
      </article>`;
    document.body.append(this.root);
    this.panel = this.required(".journal-panel");
    this.content = this.required(".journal-content");
    this.progress = this.required(".journal-progress-fill");
    this.progressLabel = this.required(".journal-progress-copy strong");
    this.tabs = Array.from(this.root.querySelectorAll<HTMLButtonElement>("[data-tab]"));
    this.bind();
  }

  private required<T extends HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing journal element ${selector}`);
    return element;
  }

  private bind(): void {
    this.required<HTMLButtonElement>(".journal-close").addEventListener("click", () => this.hide());
    this.required<HTMLElement>(".journal-backdrop").addEventListener("click", () => this.hide());
    this.tabs.forEach((button) => button.addEventListener("click", () => {
      this.activeTab = button.dataset.tab as JournalTab;
      this.render();
    }));
    window.addEventListener("keydown", (event) => {
      if (event.code === "KeyJ" && !event.repeat) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.open ? this.hide() : this.show();
        return;
      }
      if (this.open && event.code === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.hide();
        return;
      }
      if (this.open && ["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ControlLeft", "ControlRight"].includes(event.code)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  private show(): void {
    this.open = true;
    document.exitPointerLock?.();
    this.render();
    this.root.classList.add("open");
    this.root.setAttribute("aria-hidden", "false");
    window.setTimeout(() => this.content.focus(), 80);
  }

  private hide(): void {
    this.open = false;
    this.root.classList.remove("open");
    this.root.setAttribute("aria-hidden", "true");
    const canvas = document.getElementById("render-canvas");
    if (canvas instanceof HTMLCanvasElement) canvas.focus();
  }

  private render(): void {
    const save = readSave();
    const percent = completion(save);
    this.progress.style.width = `${percent}%`;
    this.progressLabel.textContent = `${percent}%`;
    this.tabs.forEach((button) => button.classList.toggle("active", button.dataset.tab === this.activeTab));
    this.content.innerHTML = this.activeTab === "overview"
      ? this.renderOverview(save)
      : this.activeTab === "records"
        ? this.renderRecords(save)
        : this.renderNetwork(save);
  }

  private renderOverview(save: JournalSave): string {
    const quest = save.quest ?? {};
    const labyrinth = save.labyrinth ?? {};
    const expedition = save.expedition ?? {};
    const sigils = labyrinth.sigilsActivated?.filter(Boolean).length ?? 0;
    const chapter = !quest.accepted
      ? ["A Quiet Morning", "Locate Mara Venn beside the expedition lantern in Caelus Reach."]
      : !quest.completed
        ? ["Echoes Under Stone", `Cull rift boars (${Math.min(3, quest.boarsDefeated ?? 0)}/3) and investigate the resonant marker.`]
        : !labyrinth.coreRestored
          ? ["The Foundry Below", `Attune the buried relays (${sigils}/3), defeat the Sentinel, and restore the pillar core.`]
          : ["Pillar of Ash and Glass", expedition.ascentCompleted ? "The Floor Two threshold has been reached and recorded." : "Use the restored eastern lift to reach the sealed ascent threshold."];
    return `
      <section class="journal-hero-card">
        <p>ACTIVE THREAD</p><h3>${chapter[0]}</h3><span>${chapter[1]}</span>
      </section>
      <div class="journal-stat-grid">
        ${this.stat("Riftglass", `${expedition.riftglassShards ?? 0} shards`, "Recovered from sealed expedition caches")}
        ${this.stat("Relays", `${sigils} / 3`, labyrinth.coreRestored ? "Foundry core synchronized" : "Buried mechanism synchronization")}
        ${this.stat("Beacons", `${expedition.activatedBeacons?.length ?? 1} / 4`, "Permanent rest and return points")}
        ${this.stat("Ascent", expedition.ascentCompleted ? "Recorded" : "Sealed", expedition.ascentCompleted ? "Upper staging deck reached" : "Eastern threshold status")}
      </div>
      <section class="journal-note"><strong>Warden's assessment</strong><p>${this.assessment(save)}</p></section>`;
  }

  private stat(label: string, value: string, detail: string): string {
    return `<article class="journal-stat"><p>${label}</p><strong>${value}</strong><span>${detail}</span></article>`;
  }

  private assessment(save: JournalSave): string {
    if (!save.quest?.accepted) return "The city is secure enough to prepare, but the eastern frontier remains unexplained. Mara Venn is the strongest available lead.";
    if (!save.quest.completed) return "Rift activity is converging beneath Windscar Verge. Complete both clue paths before returning to Caelus Reach.";
    if (!save.labyrinth?.entered) return "The Foundry breach is now accessible beneath the eastern support pillar. Expect persistent mechanisms and a defended route.";
    if (!save.labyrinth.coreRestored) return "The labyrinth remains operational but unstable. Relay synchronization and Sentinel removal are both required before core restoration.";
    if (!save.expedition?.ascentCompleted) return "The pillar core is stable. The eastern lift is the only verified route toward Floor Two.";
    return "Floor One's permanent ascent route is established. Remaining work is exploration completion and preparation for the sealed upper threshold.";
  }

  private renderRecords(save: JournalSave): string {
    const records = [
      ["Rift Migration", save.quest?.boarsDefeated ? `${Math.min(3, save.quest.boarsDefeated)} hostile specimens culled.` : "No confirmed field observations.", (save.quest?.boarsDefeated ?? 0) > 0],
      ["Structural Resonance", save.quest?.markerInvestigated ? "Aqueduct stone confirms machinery beneath Windscar Verge." : "Resonant marker not yet examined.", save.quest?.markerInvestigated],
      ["Foundry Relays", `${save.labyrinth?.sigilsActivated?.filter(Boolean).length ?? 0} of 3 relay sigils synchronized.`, (save.labyrinth?.sigilsActivated?.filter(Boolean).length ?? 0) > 0],
      ["Sentinel Record", save.labyrinth?.guardianDefeated ? "Foundry Sentinel dismantled. Core chamber access secured." : "Guardian profile incomplete.", save.labyrinth?.guardianDefeated],
      ["Ascent Threshold", save.expedition?.ascentCompleted ? "Upper staging route verified; Floor Two seal remains closed." : "No verified ascent record.", save.expedition?.ascentCompleted]
    ];
    return `<div class="journal-record-list">${records.map(([title, text, known]) => `
      <article class="journal-record ${known ? "known" : "unknown"}"><i></i><div><h3>${title}</h3><p>${text}</p></div><span>${known ? "RECORDED" : "UNKNOWN"}</span></article>`).join("")}</div>`;
  }

  private renderNetwork(save: JournalSave): string {
    const expedition = save.expedition ?? {};
    const active = expedition.activeBeacon ?? "caelus-gate";
    const unlocked = new Set(expedition.activatedBeacons ?? ["caelus-gate"]);
    return `<section class="journal-network-intro"><h3>Foundation Beacon Network</h3><p>Attuned beacons preserve expedition continuity and designate the active recovery point.</p></section>
      <div class="journal-beacons">${Object.entries(beaconNames).map(([id, name]) => {
        const isUnlocked = unlocked.has(id);
        const isActive = active === id;
        return `<article class="journal-beacon ${isUnlocked ? "unlocked" : "locked"} ${isActive ? "active" : ""}">
          <div class="beacon-glyph"><span></span></div><div><h3>${escapeHtml(name)}</h3><p>${isActive ? "Active rest point" : isUnlocked ? "Attuned route anchor" : "Signal not yet synchronized"}</p></div><strong>${isActive ? "ACTIVE" : isUnlocked ? "ONLINE" : "LOCKED"}</strong>
        </article>`;
      }).join("")}</div>`;
  }

  private installStyles(): void {
    if (document.getElementById("expedition-journal-styles")) return;
    const style = document.createElement("style");
    style.id = "expedition-journal-styles";
    style.textContent = `
      .journal-shell{position:fixed;inset:0;z-index:80;display:grid;place-items:center;pointer-events:none;opacity:0;transition:opacity .22s ease;font-family:Inter,system-ui,sans-serif;color:#eef8f2}.journal-shell.open{pointer-events:auto;opacity:1}.journal-backdrop{position:absolute;inset:0;background:radial-gradient(circle at 50% 30%,rgba(16,45,39,.5),rgba(2,8,12,.92));backdrop-filter:blur(9px)}.journal-panel{position:relative;width:min(980px,92vw);height:min(720px,88vh);display:grid;grid-template-rows:auto auto auto 1fr auto;overflow:hidden;border:1px solid rgba(150,235,203,.34);border-radius:22px;background:linear-gradient(145deg,rgba(9,24,27,.98),rgba(5,13,18,.98));box-shadow:0 30px 90px #000b,inset 0 1px rgba(255,255,255,.08);transform:translateY(18px) scale(.985);transition:transform .25s ease}.journal-shell.open .journal-panel{transform:none}.journal-panel:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 0 40%,rgba(119,244,196,.035) 50%,transparent 60%)}.journal-header{display:grid;grid-template-columns:auto 1fr auto;gap:18px;align-items:center;padding:24px 28px 18px;border-bottom:1px solid rgba(157,224,204,.14)}.journal-kicker{margin:0;color:#7ee4bb;font-size:11px;font-weight:800;letter-spacing:.24em}.journal-header h2{margin:3px 0 2px;font:700 clamp(24px,3vw,36px) Georgia,serif;letter-spacing:.02em}.journal-subtitle{margin:0;color:#94aaa7;font-size:13px}.journal-sigil{width:56px;height:56px;display:grid;place-items:center;border:1px solid #71dcb48a;border-radius:50%;box-shadow:inset 0 0 22px #55d6aa20,0 0 25px #55d6aa18}.journal-sigil span{width:19px;height:32px;border:2px solid #91efc9;transform:rotate(45deg);box-shadow:0 0 12px #6ce0b8}.journal-sigil i{position:absolute;width:7px;height:7px;border-radius:50%;background:#dfffee;box-shadow:0 0 14px #8affd5}.journal-close{width:42px;height:42px;border:1px solid #8bd6bb3d;border-radius:12px;background:#ffffff08;color:#cdebe0;font-size:27px;cursor:pointer;transition:.16s}.journal-close:hover,.journal-close:focus-visible{background:#72d8b31f;border-color:#76dfb8;color:white;transform:scale(1.05)}.journal-progress-wrap{padding:15px 28px 13px;background:#071318}.journal-progress-copy{display:flex;justify-content:space-between;margin-bottom:8px;color:#9eb5b0;font-size:11px;text-transform:uppercase;letter-spacing:.12em}.journal-progress-copy strong{color:#b7f5d9}.journal-progress-track{height:5px;background:#ffffff0d;border-radius:9px;overflow:hidden}.journal-progress-fill{height:100%;width:0;background:linear-gradient(90deg,#3aa982,#9af1cc);box-shadow:0 0 15px #6ce2b7;transition:width .5s cubic-bezier(.2,.8,.2,1)}.journal-tabs{display:flex;gap:8px;padding:12px 28px;border-bottom:1px solid #ffffff0d}.journal-tabs button{padding:9px 14px;border:1px solid transparent;border-radius:9px;background:transparent;color:#899f9c;font-size:12px;font-weight:750;letter-spacing:.05em;cursor:pointer;transition:.16s}.journal-tabs button:hover{color:#dff8ef;background:#ffffff08}.journal-tabs button.active{color:#dffff1;border-color:#68d8ae55;background:#54c99e16;box-shadow:inset 0 -2px #65ddb2}.journal-content{overflow:auto;padding:24px 28px;outline:none}.journal-content::-webkit-scrollbar{width:8px}.journal-content::-webkit-scrollbar-thumb{background:#6bd6af40;border-radius:8px}.journal-hero-card{padding:24px;border:1px solid #7adeb74d;border-radius:16px;background:radial-gradient(circle at 90% 10%,#55cea52a,transparent 38%),linear-gradient(135deg,#102d2c,#0a1d22);box-shadow:inset 0 1px #ffffff0d}.journal-hero-card p,.journal-stat p{margin:0;color:#6ed8b0;font-size:10px;font-weight:800;letter-spacing:.18em}.journal-hero-card h3{margin:7px 0 8px;font:700 28px Georgia,serif}.journal-hero-card span,.journal-stat span,.journal-note p,.journal-record p,.journal-network-intro p,.journal-beacon p{color:#9fb2af;font-size:13px;line-height:1.55}.journal-stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:14px}.journal-stat{min-height:115px;padding:17px;border:1px solid #ffffff10;border-radius:13px;background:#ffffff05}.journal-stat strong{display:block;margin:10px 0 4px;font-size:20px;color:#e8fff6}.journal-stat span{font-size:11px}.journal-note{margin-top:14px;padding:16px 18px;border-left:3px solid #64d9ae;background:#64d9ae0b}.journal-note strong{color:#bdf4dc;font-size:12px;text-transform:uppercase;letter-spacing:.1em}.journal-note p{margin:6px 0 0}.journal-record-list{display:grid;gap:10px}.journal-record{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center;padding:16px 18px;border:1px solid #ffffff10;border-radius:13px;background:#ffffff04}.journal-record i{width:10px;height:10px;border:1px solid #596d69;border-radius:50%}.journal-record.known i{background:#75e0b7;border-color:#baffdf;box-shadow:0 0 14px #62dcb0}.journal-record h3,.journal-beacon h3,.journal-network-intro h3{margin:0 0 4px;font-size:15px}.journal-record p,.journal-beacon p{margin:0}.journal-record>span,.journal-beacon>strong{font-size:9px;letter-spacing:.14em;color:#70817e}.journal-record.known>span{color:#78ddb6}.journal-network-intro{margin-bottom:18px}.journal-network-intro p{margin:5px 0}.journal-beacons{display:grid;grid-template-columns:1fr 1fr;gap:12px}.journal-beacon{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;padding:17px;border:1px solid #ffffff0d;border-radius:14px;background:#ffffff04}.journal-beacon.locked{opacity:.5}.journal-beacon.active{border-color:#76dfb868;background:#62d6ad0d;box-shadow:inset 0 0 25px #5ed6aa0b}.beacon-glyph{width:38px;height:38px;display:grid;place-items:center;border:1px solid #699183;border-radius:50%}.beacon-glyph span{width:8px;height:18px;border:1px solid #82d7b7;transform:rotate(45deg)}.journal-beacon.active .beacon-glyph{box-shadow:0 0 18px #66dab04a}.journal-beacon.active>strong{color:#8ce8c4}.journal-footer{display:flex;justify-content:flex-end;gap:18px;padding:11px 24px;border-top:1px solid #ffffff0d;color:#748884;font-size:10px}.journal-footer kbd{padding:2px 6px;border:1px solid #ffffff18;border-radius:4px;background:#ffffff08;color:#b7cac5}@media(max-width:760px){.journal-panel{width:96vw;height:94vh}.journal-header{padding:18px}.journal-sigil{display:none}.journal-progress-wrap,.journal-tabs,.journal-content{padding-left:18px;padding-right:18px}.journal-stat-grid{grid-template-columns:1fr 1fr}.journal-beacons{grid-template-columns:1fr}.journal-subtitle{display:none}}`;
    document.head.append(style);
  }
}
