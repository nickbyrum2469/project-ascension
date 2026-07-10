const STORAGE_KEY = "project-ascension-save-v1";

type JournalTab = "overview" | "records" | "network" | "loadout";
type Charm = "none" | "wayfinder" | "sentinel";

interface JournalSave {
  quest?: { accepted?: boolean; boarsDefeated?: number; markerInvestigated?: boolean; completed?: boolean };
  labyrinth?: { entered?: boolean; sigilsActivated?: boolean[]; guardianDefeated?: boolean; coreRestored?: boolean };
  expedition?: {
    activeBeacon?: string;
    activatedBeacons?: string[];
    claimedCaches?: string[];
    riftglassShards?: number;
    fractureDust?: number;
    wispDefeats?: number;
    ascentCompleted?: boolean;
  };
  equipment?: { weaponRank?: number; wardRank?: number; equippedCharm?: Charm };
}

const beaconNames: Record<string, string> = {
  "caelus-gate": "Caelus Gate",
  "western-watch": "Western Watch",
  "aqueduct-overlook": "Aqueduct Overlook",
  "foundry-threshold": "Foundry Threshold"
};

const readSave = (): JournalSave => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as JournalSave; }
  catch { return {}; }
};

const completion = (save: JournalSave): number => {
  const quest = save.quest ?? {};
  const labyrinth = save.labyrinth ?? {};
  const expedition = save.expedition ?? {};
  const equipment = save.equipment ?? {};
  const checks = [
    quest.accepted,
    (quest.boarsDefeated ?? 0) >= 3,
    quest.markerInvestigated,
    quest.completed,
    labyrinth.entered,
    (labyrinth.sigilsActivated?.filter(Boolean).length ?? 0) >= 3,
    labyrinth.guardianDefeated,
    labyrinth.coreRestored,
    (expedition.activatedBeacons?.length ?? 0) >= 4,
    (expedition.claimedCaches?.length ?? 0) >= 4,
    (expedition.wispDefeats ?? 0) >= 1,
    (equipment.weaponRank ?? 1) >= 2,
    expedition.ascentCompleted
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
};

export class ExpeditionJournal {
  private readonly root: HTMLElement;
  private readonly content: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly progressLabel: HTMLElement;
  private readonly tabs: HTMLButtonElement[];
  private open = false;
  private activeTab: JournalTab = "overview";

  constructor() {
    this.installStyles();
    this.root = document.createElement("section");
    this.root.className = "journal-shell";
    this.root.setAttribute("aria-hidden", "true");
    this.root.innerHTML = `
      <div class="journal-backdrop"></div>
      <article class="journal-panel" role="dialog" aria-modal="true" aria-labelledby="journal-title">
        <header class="journal-header">
          <div class="journal-sigil" aria-hidden="true"><span></span><i></i></div>
          <div><p>FOUNDATION ARCHIVE</p><h2 id="journal-title">Expedition Journal</h2><small>Field intelligence, route memory, permanent progress, and Warden loadout.</small></div>
          <button class="journal-close" type="button" aria-label="Close expedition journal">×</button>
        </header>
        <div class="journal-progress-wrap"><div><span>Floor I completion</span><strong>0%</strong></div><figure><i></i></figure></div>
        <nav class="journal-tabs" aria-label="Journal sections">
          <button type="button" data-tab="overview" class="active">Overview</button>
          <button type="button" data-tab="records">Field Records</button>
          <button type="button" data-tab="network">Beacon Network</button>
          <button type="button" data-tab="loadout">Loadout</button>
        </nav>
        <div class="journal-content" tabindex="0"></div>
        <footer><span><kbd>J</kbd> Journal</span><span><kbd>Esc</kbd> Close</span></footer>
      </article>`;
    document.body.append(this.root);
    this.content = this.required(".journal-content");
    this.progress = this.required(".journal-progress-wrap figure i");
    this.progressLabel = this.required(".journal-progress-wrap strong");
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
      } else if (this.open && event.code === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.hide();
      } else if (this.open && ["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ControlLeft", "ControlRight"].includes(event.code)) {
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
      ? this.overview(save)
      : this.activeTab === "records"
        ? this.records(save)
        : this.activeTab === "network"
          ? this.network(save)
          : this.loadout(save);
  }

  private overview(save: JournalSave): string {
    const quest = save.quest ?? {};
    const labyrinth = save.labyrinth ?? {};
    const expedition = save.expedition ?? {};
    const equipment = save.equipment ?? {};
    const sigils = labyrinth.sigilsActivated?.filter(Boolean).length ?? 0;
    const chapter = !quest.accepted
      ? ["A Quiet Morning", "Locate Mara Venn beside the expedition lantern in Caelus Reach."]
      : !quest.completed
        ? ["Echoes Under Stone", `Cull rift boars (${Math.min(3, quest.boarsDefeated ?? 0)}/3) and investigate the resonant marker.`]
        : !labyrinth.coreRestored
          ? ["The Foundry Below", `Attune the buried relays (${sigils}/3), defeat the Sentinel, and restore the pillar core.`]
          : ["Pillar of Ash and Glass", expedition.ascentCompleted ? "The Floor Two threshold has been reached and recorded." : "Use the restored eastern lift to reach the sealed ascent threshold."];
    return `<section class="journal-hero"><p>ACTIVE THREAD</p><h3>${chapter[0]}</h3><span>${chapter[1]}</span></section>
      <div class="journal-stats">${this.stat("Riftglass", `${expedition.riftglassShards ?? 0} shards`, "Recovered caches")}${this.stat("Fracture dust", `${expedition.fractureDust ?? 0}`, "Combat salvage")}${this.stat("Edge", `Rank ${equipment.weaponRank ?? 1}`, "Weapon resonance")}${this.stat("Ward", `Rank ${equipment.wardRank ?? 0}`, "Damage mitigation")}${this.stat("Beacons", `${expedition.activatedBeacons?.length ?? 1} / 4`, "Permanent rest points")}${this.stat("Ascent", expedition.ascentCompleted ? "Recorded" : "Sealed", "Eastern threshold")}</div>
      <section class="journal-note"><strong>WARDEN'S ASSESSMENT</strong><p>${this.assessment(save)}</p></section>`;
  }

  private stat(label: string, value: string, detail: string): string {
    return `<article><p>${label}</p><strong>${value}</strong><span>${detail}</span></article>`;
  }

  private assessment(save: JournalSave): string {
    if (!save.quest?.accepted) return "The city is secure enough to prepare, but the eastern frontier remains unexplained. Mara Venn is the strongest lead.";
    if (!save.quest.completed) return "Rift activity is converging beneath Windscar Verge. Complete both clue paths before returning to Caelus Reach.";
    if (!save.labyrinth?.entered) return "The Foundry breach is accessible beneath the eastern support pillar. Expect persistent mechanisms and a defended route.";
    if (!save.labyrinth.coreRestored) return "Relay synchronization and Sentinel removal are both required before core restoration.";
    if ((save.expedition?.wispDefeats ?? 0) === 0) return "A mobile Rift Wisp constellation has been observed along the outer route. Its ranged core attack should be guarded or avoided at the marked impact point.";
    if (!save.expedition?.ascentCompleted) return "The pillar core is stable. The eastern lift is the only verified route toward Floor Two.";
    return "Floor One's permanent ascent route is established. Continue strengthening the Warden frame and clearing unexplored outer-floor threats.";
  }

  private records(save: JournalSave): string {
    const records: Array<[string, string, boolean]> = [
      ["Rift Migration", save.quest?.boarsDefeated ? `${Math.min(3, save.quest.boarsDefeated)} hostile specimens culled.` : "No confirmed field observations.", (save.quest?.boarsDefeated ?? 0) > 0],
      ["Wisp Constellation", save.expedition?.wispDefeats ? `${save.expedition.wispDefeats} airborne core${save.expedition.wispDefeats === 1 ? "" : "s"} dispersed; ranged impact pattern recorded.` : "Airborne Rift signature remains unclassified.", (save.expedition?.wispDefeats ?? 0) > 0],
      ["Structural Resonance", save.quest?.markerInvestigated ? "Aqueduct stone confirms machinery beneath Windscar Verge." : "Resonant marker not yet examined.", Boolean(save.quest?.markerInvestigated)],
      ["Foundry Relays", `${save.labyrinth?.sigilsActivated?.filter(Boolean).length ?? 0} of 3 relay sigils synchronized.`, (save.labyrinth?.sigilsActivated?.filter(Boolean).length ?? 0) > 0],
      ["Sentinel Record", save.labyrinth?.guardianDefeated ? "Foundry Sentinel dismantled. Core chamber access secured." : "Guardian profile incomplete.", Boolean(save.labyrinth?.guardianDefeated)],
      ["Ascent Threshold", save.expedition?.ascentCompleted ? "Upper staging route verified; Floor Two seal remains closed." : "No verified ascent record.", Boolean(save.expedition?.ascentCompleted)]
    ];
    return `<div class="journal-records">${records.map(([title, text, known]) => `<article class="${known ? "known" : ""}"><i></i><div><h3>${title}</h3><p>${text}</p></div><strong>${known ? "RECORDED" : "UNKNOWN"}</strong></article>`).join("")}</div>`;
  }

  private network(save: JournalSave): string {
    const expedition = save.expedition ?? {};
    const active = expedition.activeBeacon ?? "caelus-gate";
    const unlocked = new Set(expedition.activatedBeacons ?? ["caelus-gate"]);
    return `<section class="journal-network"><h3>Foundation Beacon Network</h3><p>Attuned beacons preserve expedition continuity and designate the active recovery point.</p></section><div class="journal-beacons">${Object.entries(beaconNames).map(([id, name]) => {
      const online = unlocked.has(id);
      const selected = active === id;
      return `<article class="${online ? "online" : "locked"} ${selected ? "active" : ""}"><div class="beacon-glyph"><span></span></div><div><h3>${name}</h3><p>${selected ? "Active rest point" : online ? "Attuned route anchor" : "Signal not synchronized"}</p></div><strong>${selected ? "ACTIVE" : online ? "ONLINE" : "LOCKED"}</strong></article>`;
    }).join("")}</div>`;
  }

  private loadout(save: JournalSave): string {
    const equipment = save.equipment ?? {};
    const expedition = save.expedition ?? {};
    const weaponRank = equipment.weaponRank ?? 1;
    const wardRank = equipment.wardRank ?? 0;
    const charm = equipment.equippedCharm ?? "none";
    const charmLabel = charm === "sentinel" ? "Sentinel Remnant" : charm === "wayfinder" ? "Wayfinder Thread" : "Unattuned";
    const nextEdge = weaponRank >= 3 ? "Maximum Floor I resonance" : weaponRank === 2 ? "Requires 4 shards and 10 fracture dust" : "Requires 2 shards or 5 fracture dust";
    const nextWard = wardRank >= 2 ? "Maximum Floor I reinforcement" : wardRank === 1 ? "Requires 16 fracture dust" : "Requires 8 fracture dust";
    return `<section class="journal-network"><h3>Warden Frame Loadout</h3><p>Riftglass and recovered fracture dust automatically resonate through the frame. No material is consumed.</p></section>
      <div class="journal-loadout">
        <article><div class="loadout-glyph edge"><span></span></div><div><p>RIFTGLASS EDGE</p><h3>Temper Rank ${weaponRank}</h3><span>+${Math.max(0, weaponRank - 1) * 16}% base sword damage</span><small>${nextEdge}</small></div></article>
        <article><div class="loadout-glyph ward"><span></span></div><div><p>FOUNDATION WARD</p><h3>Reinforcement Rank ${wardRank}</h3><span>${wardRank === 0 ? "No mitigation bonus" : `-${wardRank * 12}% incoming damage`}</span><small>${nextWard}</small></div></article>
        <article><div class="loadout-glyph charm"><span></span></div><div><p>ATTUNED CHARM</p><h3>${charmLabel}</h3><span>${charm === "sentinel" ? "Improves guardian damage and global defense." : charm === "wayfinder" ? "Improves Rift Wisp offense and defense." : "Attune three beacons to awaken the Wayfinder Thread."}</span><small>${expedition.fractureDust ?? 0} fracture dust · ${expedition.riftglassShards ?? 0} Riftglass shards</small></div></article>
      </div>`;
  }

  private installStyles(): void {
    if (document.getElementById("expedition-journal-styles")) return;
    const style = document.createElement("style");
    style.id = "expedition-journal-styles";
    style.textContent = `
      .journal-shell{position:fixed;inset:0;z-index:80;display:grid;place-items:center;pointer-events:none;opacity:0;transition:.22s;color:#eef8f2;font-family:Inter,system-ui,sans-serif}.journal-shell.open{pointer-events:auto;opacity:1}.journal-backdrop{position:absolute;inset:0;background:radial-gradient(circle at 50% 30%,#102d277d,#02080ceb);backdrop-filter:blur(9px)}.journal-panel{position:relative;width:min(980px,92vw);height:min(720px,88vh);display:grid;grid-template-rows:auto auto auto 1fr auto;overflow:hidden;border:1px solid #96ebcb57;border-radius:22px;background:linear-gradient(145deg,#09181bfa,#050d12fc);box-shadow:0 30px 90px #000b,inset 0 1px #ffffff14;transform:translateY(18px) scale(.985);transition:.25s}.journal-shell.open .journal-panel{transform:none}.journal-header{display:grid;grid-template-columns:auto 1fr auto;gap:18px;align-items:center;padding:24px 28px 18px;border-bottom:1px solid #9de0cc24}.journal-header p,.journal-hero p,.journal-stats p,.journal-loadout p{margin:0;color:#7ee4bb;font-size:10px;font-weight:800;letter-spacing:.2em}.journal-header h2{margin:3px 0;font:700 34px Georgia,serif}.journal-header small{color:#94aaa7}.journal-sigil{position:relative;width:56px;height:56px;display:grid;place-items:center;border:1px solid #71dcb48a;border-radius:50%;box-shadow:inset 0 0 22px #55d6aa20}.journal-sigil span{width:19px;height:32px;border:2px solid #91efc9;transform:rotate(45deg);box-shadow:0 0 12px #6ce0b8}.journal-sigil i{position:absolute;width:7px;height:7px;border-radius:50%;background:#dfffee;box-shadow:0 0 14px #8affd5}.journal-close{width:42px;height:42px;border:1px solid #8bd6bb3d;border-radius:12px;background:#ffffff08;color:#cdebe0;font-size:27px;cursor:pointer}.journal-close:hover,.journal-close:focus-visible{background:#72d8b31f;border-color:#76dfb8;color:white}.journal-progress-wrap{padding:15px 28px;background:#071318}.journal-progress-wrap>div{display:flex;justify-content:space-between;color:#9eb5b0;font-size:11px;text-transform:uppercase;letter-spacing:.12em}.journal-progress-wrap strong{color:#b7f5d9}.journal-progress-wrap figure{height:5px;margin:8px 0 0;background:#ffffff0d;border-radius:9px;overflow:hidden}.journal-progress-wrap figure i{display:block;height:100%;width:0;background:linear-gradient(90deg,#3aa982,#9af1cc);box-shadow:0 0 15px #6ce2b7;transition:width .5s}.journal-tabs{display:flex;gap:8px;padding:12px 28px;border-bottom:1px solid #ffffff0d}.journal-tabs button{padding:9px 14px;border:1px solid transparent;border-radius:9px;background:transparent;color:#899f9c;font-weight:750;cursor:pointer}.journal-tabs button:hover{color:#dff8ef;background:#ffffff08}.journal-tabs button.active{color:#dffff1;border-color:#68d8ae55;background:#54c99e16;box-shadow:inset 0 -2px #65ddb2}.journal-content{overflow:auto;padding:24px 28px;outline:none}.journal-hero{padding:24px;border:1px solid #7adeb74d;border-radius:16px;background:radial-gradient(circle at 90% 10%,#55cea52a,transparent 38%),linear-gradient(135deg,#102d2c,#0a1d22)}.journal-hero h3{margin:7px 0 8px;font:700 28px Georgia,serif}.journal-hero span,.journal-stats span,.journal-note p,.journal-records p,.journal-network p,.journal-beacons p,.journal-loadout span,.journal-loadout small{color:#9fb2af;font-size:13px;line-height:1.55}.journal-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:14px}.journal-stats article{padding:17px;border:1px solid #ffffff10;border-radius:13px;background:#ffffff05}.journal-stats strong{display:block;margin:10px 0 4px;font-size:20px}.journal-note{margin-top:14px;padding:16px 18px;border-left:3px solid #64d9ae;background:#64d9ae0b}.journal-note strong{color:#bdf4dc;font-size:11px;letter-spacing:.1em}.journal-note p{margin:6px 0 0}.journal-records{display:grid;gap:10px}.journal-records article,.journal-beacons article{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center;padding:16px 18px;border:1px solid #ffffff10;border-radius:13px;background:#ffffff04}.journal-records i{width:10px;height:10px;border:1px solid #596d69;border-radius:50%}.journal-records .known i{background:#75e0b7;box-shadow:0 0 14px #62dcb0}.journal-records h3,.journal-beacons h3,.journal-loadout h3{margin:0 0 4px}.journal-records p,.journal-beacons p{margin:0}.journal-records article>strong,.journal-beacons article>strong{font-size:9px;letter-spacing:.14em;color:#70817e}.journal-records .known>strong,.journal-beacons .active>strong{color:#78ddb6}.journal-network p{margin-top:4px}.journal-beacons{display:grid;grid-template-columns:1fr 1fr;gap:12px}.journal-beacons .locked{opacity:.48}.journal-beacons .active{border-color:#76dfb868;background:#62d6ad0d}.beacon-glyph{width:38px;height:38px;display:grid;place-items:center;border:1px solid #699183;border-radius:50%}.beacon-glyph span{width:8px;height:18px;border:1px solid #82d7b7;transform:rotate(45deg)}.journal-loadout{display:grid;gap:12px}.journal-loadout article{display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:center;padding:20px;border:1px solid #ffffff12;border-radius:15px;background:linear-gradient(120deg,#ffffff05,#68d8ae08)}.journal-loadout small{display:block;margin-top:6px;color:#718983}.loadout-glyph{width:54px;height:54px;display:grid;place-items:center;border:1px solid #78dcb65c;border-radius:16px;background:#5bd0a80c}.loadout-glyph span{display:block;width:12px;height:34px;border:2px solid #93ebca;transform:rotate(40deg);box-shadow:0 0 12px #72d9b3}.loadout-glyph.ward span{width:27px;height:31px;border-radius:50% 50% 42% 42%;transform:none}.loadout-glyph.charm span{width:23px;height:23px;transform:rotate(45deg)}.journal-panel footer{display:flex;justify-content:flex-end;gap:18px;padding:11px 24px;border-top:1px solid #ffffff0d;color:#748884;font-size:10px}.journal-panel kbd{padding:2px 6px;border:1px solid #ffffff18;border-radius:4px;background:#ffffff08}@media(max-width:760px){.journal-panel{width:96vw;height:94vh}.journal-header{padding:18px}.journal-sigil{display:none}.journal-progress-wrap,.journal-tabs,.journal-content{padding-left:18px;padding-right:18px}.journal-tabs{overflow-x:auto}.journal-stats,.journal-beacons{grid-template-columns:1fr 1fr}.journal-header small{display:none}}`;
    document.head.append(style);
  }
}
