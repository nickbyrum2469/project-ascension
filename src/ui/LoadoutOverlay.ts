const STORAGE_KEY = "project-ascension-save-v1";
const EQUIP_CHARM_EVENT = "project-ascension-equip-charm";

type Charm = "none" | "wayfinder" | "sentinel";

interface LoadoutSave {
  labyrinth?: { guardianDefeated?: boolean };
  expedition?: {
    activatedBeacons?: string[];
    riftglassShards?: number;
    fractureDust?: number;
  };
  equipment?: {
    weaponRank?: number;
    wardRank?: number;
    equippedCharm?: Charm;
  };
}

const charmName = (charm: Charm): string => charm === "sentinel"
  ? "Sentinel Remnant"
  : charm === "wayfinder"
    ? "Wayfinder Thread"
    : "Unattuned";

export class LoadoutOverlay {
  private readonly strip: HTMLButtonElement;
  private readonly panel: HTMLElement;
  private readonly content: HTMLElement;
  private open = false;
  private lastSnapshot = "";

  constructor() {
    this.installStyles();
    this.strip = document.createElement("button");
    this.strip.type = "button";
    this.strip.className = "loadout-strip";
    this.strip.setAttribute("aria-label", "Open Warden loadout");
    this.strip.innerHTML = `<kbd>L</kbd><span><small>WARDEN LOADOUT</small><strong>EDGE I · WARD 0</strong></span><i>UNATTUNED</i>`;

    this.panel = document.createElement("section");
    this.panel.className = "loadout-overlay";
    this.panel.setAttribute("aria-hidden", "true");
    this.panel.innerHTML = `
      <div class="loadout-backdrop"></div>
      <article class="loadout-panel" role="dialog" aria-modal="true" aria-labelledby="loadout-title">
        <header>
          <div class="loadout-mark"><span></span><i></i></div>
          <div><p>ORAN PELL · RIFTGLASS ATTUNEMENT</p><h2 id="loadout-title">Warden Loadout</h2><small>Recovered material resonates automatically. Choose which unlocked charm governs the frame.</small></div>
          <button class="loadout-close" type="button" aria-label="Close Warden loadout">×</button>
        </header>
        <div class="loadout-content" tabindex="0"></div>
        <footer><span><kbd>L</kbd> Loadout</span><span><kbd>Esc</kbd> Close</span></footer>
      </article>`;
    this.content = this.required<HTMLElement>(".loadout-content");
    document.body.append(this.strip, this.panel);
    this.bind();
    this.refresh();
    window.setInterval(() => this.refresh(), 350);
  }

  private required<T extends HTMLElement>(selector: string): T {
    const element = this.panel.querySelector<T>(selector);
    if (!element) throw new Error(`Missing loadout element ${selector}`);
    return element;
  }

  private bind(): void {
    this.strip.addEventListener("click", () => this.show());
    this.required<HTMLButtonElement>(".loadout-close").addEventListener("click", () => this.hide());
    this.required<HTMLElement>(".loadout-backdrop").addEventListener("click", () => this.hide());
    window.addEventListener("keydown", (event) => {
      if (event.code === "KeyL" && !event.repeat) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.open ? this.hide() : this.show();
      } else if (this.open && event.code === "KeyJ") {
        this.hide();
      } else if (this.open && event.code === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.hide();
      } else if (this.open && [
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "Space",
        "ControlLeft",
        "ControlRight",
        "ShiftLeft",
        "ShiftRight"
      ].includes(event.code)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  private readSave(): LoadoutSave {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as LoadoutSave;
    } catch {
      return {};
    }
  }

  private show(): void {
    const hud = document.getElementById("hud");
    const conflictingInterface = document.querySelector(
      ".journal-shell.open, .pause-panel:not(.hidden), .dialogue-panel:not(.hidden)"
    );
    if (!hud || hud.classList.contains("hidden") || conflictingInterface) return;
    this.open = true;
    document.exitPointerLock?.();
    window.dispatchEvent(new Event("blur"));
    this.render(this.readSave());
    this.panel.classList.add("open");
    this.panel.setAttribute("aria-hidden", "false");
    window.setTimeout(() => this.content.focus(), 60);
  }

  private hide(): void {
    this.open = false;
    this.panel.classList.remove("open");
    this.panel.setAttribute("aria-hidden", "true");
    const canvas = document.getElementById("render-canvas");
    if (canvas instanceof HTMLCanvasElement) canvas.focus();
  }

  private refresh(): void {
    const hudVisible = !document.getElementById("hud")?.classList.contains("hidden");
    this.strip.classList.toggle("visible", hudVisible);
    const save = this.readSave();
    const snapshot = JSON.stringify({
      equipment: save.equipment,
      beacons: save.expedition?.activatedBeacons?.length,
      shards: save.expedition?.riftglassShards,
      dust: save.expedition?.fractureDust,
      guardian: save.labyrinth?.guardianDefeated
    });
    if (snapshot === this.lastSnapshot) return;
    this.lastSnapshot = snapshot;
    const weaponRank = save.equipment?.weaponRank ?? 1;
    const wardRank = save.equipment?.wardRank ?? 0;
    const charm = save.equipment?.equippedCharm ?? "none";
    const strong = this.strip.querySelector("strong");
    const charmLabel = this.strip.querySelector("i");
    if (strong) strong.textContent = `EDGE ${"I".repeat(Math.max(1, weaponRank))} · WARD ${wardRank}`;
    if (charmLabel) charmLabel.textContent = charmName(charm).toUpperCase();
    if (this.open) this.render(save);
  }

  private render(save: LoadoutSave): void {
    const weaponRank = save.equipment?.weaponRank ?? 1;
    const wardRank = save.equipment?.wardRank ?? 0;
    const selected = save.equipment?.equippedCharm ?? "none";
    const shards = save.expedition?.riftglassShards ?? 0;
    const dust = save.expedition?.fractureDust ?? 0;
    const beacons = save.expedition?.activatedBeacons?.length ?? 1;
    const guardian = Boolean(save.labyrinth?.guardianDefeated);
    const edgeProgress = weaponRank >= 3 ? 100 : weaponRank === 2 ? Math.min(100, ((shards / 4) + (dust / 10)) * 50) : Math.min(100, Math.max(shards / 2, dust / 5) * 100);
    const wardProgress = wardRank >= 2 ? 100 : Math.min(100, (dust / (wardRank === 1 ? 16 : 8)) * 100);

    this.content.innerHTML = `
      <section class="loadout-summary">
        <article><small>RIFTGLASS EDGE</small><strong>Temper Rank ${weaponRank}</strong><p>+${Math.max(0, weaponRank - 1) * 16}% base sword damage</p><div><i style="width:${edgeProgress}%"></i></div></article>
        <article><small>FOUNDATION WARD</small><strong>Reinforcement Rank ${wardRank}</strong><p>${wardRank > 0 ? `-${wardRank * 12}% incoming damage` : "No passive mitigation yet"}</p><div><i style="width:${wardProgress}%"></i></div></article>
        <aside><span>${shards}</span><small>RIFTGLASS SHARDS</small><span>${dust}</span><small>FRACTURE DUST</small></aside>
      </section>
      <section class="charm-section">
        <div><p>CHARM SOCKET</p><h3>Select an attunement</h3><span>Only one charm can resonate at a time. Changing it does not consume materials.</span></div>
        <div class="charm-grid">
          ${this.charmCard("none", "Open Socket", "No specialized bonus. Edge and Ward ranks remain active.", true, selected)}
          ${this.charmCard("wayfinder", "Wayfinder Thread", "+10% damage and -10% incoming damage against Rift Wisps.", beacons >= 3, selected)}
          ${this.charmCard("sentinel", "Sentinel Remnant", "+12% guardian damage and 6% global incoming-damage reduction.", guardian, selected)}
        </div>
      </section>`;

    this.content.querySelectorAll<HTMLButtonElement>("[data-charm]").forEach((button) => {
      button.addEventListener("click", () => {
        const charm = button.dataset.charm as Charm;
        window.dispatchEvent(new CustomEvent(EQUIP_CHARM_EVENT, { detail: { charm } }));
        window.setTimeout(() => {
          this.lastSnapshot = "";
          this.refresh();
        }, 40);
      });
    });
  }

  private charmCard(
    id: Charm,
    title: string,
    description: string,
    unlocked: boolean,
    selected: Charm
  ): string {
    const active = id === selected;
    return `<button type="button" data-charm="${id}" class="charm-card ${active ? "active" : ""}" ${unlocked ? "" : "disabled"}>
      <i><span></span></i><div><small>${unlocked ? active ? "ATTUNED" : "AVAILABLE" : "LOCKED"}</small><strong>${title}</strong><p>${unlocked ? description : id === "wayfinder" ? "Attune three Foundation beacons." : "Dismantle the Foundry Sentinel."}</p></div>
    </button>`;
  }

  private installStyles(): void {
    if (document.getElementById("warden-loadout-styles")) return;
    const style = document.createElement("style");
    style.id = "warden-loadout-styles";
    style.textContent = `
      .loadout-strip{position:fixed;z-index:32;top:86px;left:22px;display:flex;align-items:center;gap:10px;min-width:260px;padding:9px 12px;border:1px solid #8de4c83b;border-radius:12px;background:linear-gradient(100deg,#071419e8,#0c2425d9);color:#dff9ef;box-shadow:0 12px 32px #0007;opacity:0;pointer-events:none;transform:translateX(-12px);transition:.25s;backdrop-filter:blur(8px);text-align:left}.loadout-strip.visible{opacity:1;pointer-events:auto;transform:none}.loadout-strip:hover{border-color:#83e5c47a;background:linear-gradient(100deg,#0a1d22f2,#12302fec)}.loadout-strip kbd{display:grid;place-items:center;width:30px;height:30px;border:1px solid #91e7c558;border-radius:8px;background:#68d8ae12;color:#aef1d5}.loadout-strip span{display:grid;flex:1}.loadout-strip small{font-size:8px;letter-spacing:.14em;color:#6fcaa9}.loadout-strip strong{margin-top:2px;font-size:12px;letter-spacing:.04em}.loadout-strip>i{font-style:normal;font-size:8px;color:#9aafa9;max-width:72px;text-align:right}.loadout-overlay{position:fixed;inset:0;z-index:90;display:grid;place-items:center;opacity:0;pointer-events:none;transition:.2s;color:#effbf5;font-family:Inter,system-ui,sans-serif}.loadout-overlay.open{opacity:1;pointer-events:auto}.loadout-backdrop{position:absolute;inset:0;background:radial-gradient(circle at 50% 35%,#163d357a,#02070bec);backdrop-filter:blur(10px)}.loadout-panel{position:relative;width:min(900px,92vw);max-height:88vh;display:grid;grid-template-rows:auto 1fr auto;overflow:hidden;border:1px solid #8ee8c759;border-radius:22px;background:linear-gradient(145deg,#0a191dfa,#050d11fd);box-shadow:0 32px 100px #000c,inset 0 1px #fff1;transform:translateY(18px) scale(.985);transition:.24s}.loadout-overlay.open .loadout-panel{transform:none}.loadout-panel header{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:18px;padding:24px 28px 19px;border-bottom:1px solid #a1e6cf1c}.loadout-panel header p,.charm-section>div>p{margin:0;color:#79dfbc;font-size:9px;font-weight:800;letter-spacing:.19em}.loadout-panel h2{margin:4px 0;font:700 32px Georgia,serif}.loadout-panel header small{color:#8da7a0}.loadout-mark{position:relative;width:54px;height:54px;display:grid;place-items:center;border:1px solid #77dfbb69;border-radius:16px;background:#65d3ad0b}.loadout-mark span{width:10px;height:35px;border:2px solid #9aefd0;transform:rotate(40deg);box-shadow:0 0 14px #6cdab4}.loadout-mark i{position:absolute;width:38px;height:38px;border:1px solid #75dbb740;border-radius:50%}.loadout-close{width:42px;height:42px;border:1px solid #8bd6bb3d;border-radius:12px;background:#ffffff08;color:#cdebe0;font-size:27px;cursor:pointer}.loadout-content{overflow:auto;padding:24px 28px;outline:none}.loadout-summary{display:grid;grid-template-columns:1fr 1fr auto;gap:12px}.loadout-summary article,.loadout-summary aside{padding:18px;border:1px solid #ffffff11;border-radius:14px;background:#ffffff05}.loadout-summary small{color:#76dcb9;font-size:9px;font-weight:800;letter-spacing:.13em}.loadout-summary strong{display:block;margin:8px 0 5px;font-size:19px}.loadout-summary p{margin:0;color:#9dafaa;font-size:12px}.loadout-summary article>div{height:4px;margin-top:14px;overflow:hidden;border-radius:8px;background:#ffffff0b}.loadout-summary article>div i{display:block;height:100%;background:linear-gradient(90deg,#38a77e,#9af0cf);box-shadow:0 0 13px #64d5ae}.loadout-summary aside{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:4px 10px;min-width:170px}.loadout-summary aside span{font-size:24px;font-weight:800;color:#dffff0}.loadout-summary aside small{font-size:8px;color:#839a94}.charm-section{margin-top:16px;padding:20px;border:1px solid #78dbb83d;border-radius:16px;background:radial-gradient(circle at 90% 0,#4fc39d19,transparent 42%),#071518}.charm-section h3{margin:5px 0;font:700 24px Georgia,serif}.charm-section>div>span{color:#91aaa3;font-size:12px}.charm-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:17px}.charm-card{display:grid;grid-template-columns:auto 1fr;gap:13px;align-items:center;padding:16px;border:1px solid #ffffff12;border-radius:13px;background:#ffffff04;color:#e9f8f2;text-align:left;cursor:pointer}.charm-card:hover:not(:disabled){border-color:#78ddb960;background:#58cba314}.charm-card.active{border-color:#94edcc87;background:#67d4ac18;box-shadow:inset 0 0 22px #57cda812}.charm-card:disabled{opacity:.38;cursor:not-allowed}.charm-card>i{width:38px;height:38px;display:grid;place-items:center;border:1px solid #72cbaa59;border-radius:12px}.charm-card>i span{width:15px;height:15px;border:1px solid #8de3c1;transform:rotate(45deg)}.charm-card small{color:#6ed2ad;font-size:8px;letter-spacing:.13em}.charm-card strong{display:block;margin:4px 0;font-size:14px}.charm-card p{margin:0;color:#91a7a1;font-size:10px;line-height:1.4}.loadout-panel footer{display:flex;justify-content:flex-end;gap:18px;padding:11px 24px;border-top:1px solid #ffffff0d;color:#748884;font-size:10px}.loadout-panel footer kbd{padding:2px 6px;border:1px solid #ffffff18;border-radius:4px;background:#ffffff08}@media(max-width:760px){.loadout-strip{top:76px;left:10px;min-width:210px}.loadout-panel{width:96vw;max-height:94vh}.loadout-panel header,.loadout-content{padding-left:17px;padding-right:17px}.loadout-mark{display:none}.loadout-summary{grid-template-columns:1fr 1fr}.loadout-summary aside{grid-column:1/-1}.charm-grid{grid-template-columns:1fr}}`;
    document.head.append(style);
  }
}
