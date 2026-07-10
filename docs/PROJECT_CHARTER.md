# Project Ascension — Governing Project Charter

Status: **Locked production backbone**

This document is the authoritative reference for all design, engineering, art, audio, UI/UX, networking, testing, content, and production decisions made for Project Ascension. Any implementation that falls below this standard must be revised rather than accepted.

## 1. Product Definition

Project Ascension is an original browser-based 3D action RPG built around conquering a colossal layered megastructure one floor at a time.

Each floor is a complete world containing a major settlement, wilderness regions, hidden routes, side content, rare discoveries, a concealed labyrinth, a floor boss, and a permanent route upward.

The governing gameplay loop is:

**Prepare in town → explore the floor → gather clues → discover the labyrinth → establish shortcuts → master the expedition → defeat the boss → transform the world → ascend.**

The first production objective is one exceptional, complete first floor. The project will not attempt one hundred floors before the reusable floor-conquering framework is proven.

## 2. Original-IP Requirement

Project Ascension may draw inspiration from layered-world adventure fiction, open-world RPGs, party-based RPGs, dungeon crawlers, and action combat games, but it must remain an original intellectual property.

The project must not copy protected names, characters, locations, story beats, UI designs, monsters, music, dialogue, or distinctive visual assets from Sword Art Online, Final Fantasy, Skyrim, Fallout, Dark Souls, Red Dead Redemption, Jumanji, or any other property.

Influence is allowed. Direct replication is not.

## 3. Technology Baseline

The primary delivery target is the desktop web browser.

Required foundation:

- HTML page shell.
- TypeScript game code.
- Babylon.js real-time 3D engine.
- WebGPU rendering with WebGL fallback.
- Vite build tooling.
- glTF/GLB production asset format.
- KTX2/Basis texture compression.
- IndexedDB for resilient local cache and save protection.
- Service-worker asset caching.
- Node.js services for multiplayer and backend systems.
- Colyseus-style authoritative room architecture for the initial co-op implementation.

The codebase must be modular and data-driven. Systems may not be concentrated in a single monolithic script.

## 4. Core Design Pillars

### 4.1 The Megastructure Must Be Unmistakable

The world must always communicate that the player exists inside an impossible artificial structure.

Major vistas must include structural walls, colossal pillars, artificial sky systems, the underside of higher floors, ventilation structures, suspended waterways, distant machinery, and controlled glimpses into the abyss below.

A generic fantasy field with a skybox does not satisfy this requirement.

### 4.2 Discovery Must Be Earned

The labyrinth is not revealed by a default waypoint.

Players locate it through environmental evidence, NPC testimony, rumors, expedition records, monster behavior, weather patterns, structural clues, ruins, hidden passages, and observation.

Every critical discovery must support multiple independent clue paths so the experience remains mysterious without becoming arbitrary.

### 4.3 The Labyrinth Is a Persistent Expedition

The labyrinth must feel like a dangerous place that is learned over time.

It requires:

- Looping routes.
- Persistent shortcuts.
- Locked mechanisms.
- Safe chambers.
- Traps.
- Vertical traversal.
- Elite enemies.
- Environmental puzzles.
- Expedition retreat decisions.
- Permanent frontier progress.

It must not feel like a disposable ten-minute instance.

### 4.4 Combat Must Be Deliberate, Responsive, and Readable

Combat must support:

- Light, heavy, charged, sprint, dodge, jump, guard-counter, and contextual attacks.
- Guarding, perfect guards, parries, guard pressure, guard breaks, poise, and stagger.
- Weapon reach, active frames, recovery, cancel windows, and input buffering.
- Material-aware impacts.
- Hit stop, camera impulse, animation response, audio, VFX, and controller feedback.
- Enemy weak points and breakable components where appropriate.
- First-person and third-person combat presentation.

Button-spam combat, unreliable hit detection, weightless animation, and unclear enemy telegraphs are unacceptable.

### 4.5 Victory Must Change the World

Defeating a floor boss must permanently alter the floor.

The city, NPC schedules, dialogue, merchants, music, lighting, public spaces, celebrations, travel behavior, and ascent infrastructure must acknowledge the victory.

A boss defeat may not resolve as only a reward screen and loading transition.

## 5. Camera and Movement Standard

The game must support complete first-person and third-person play using a shared underlying character simulation and view-specific presentation layers.

Required movement features:

- Walk, jog, sprint, crouch, combat strafe, jump, fall, land, vault, mantle, and slope handling.
- Acceleration and deceleration rather than instantaneous velocity changes.
- Reliable step climbing and ground detection.
- Controller dead-zone and sensitivity tuning.
- Mouse sensitivity and independent axis settings.
- Input buffering and forgiving edge handling where appropriate.
- Camera collision and contextual framing.

Third-person requirements:

- Soft and hard lock-on.
- Shoulder switching.
- Dynamic camera distance.
- Boss framing.
- Camera obstruction handling.
- Exploration and combat camera profiles.

First-person requirements:

- Camera-safe attack animations.
- Visible weapon presentation.
- Accurate traces.
- Weapon lowering near walls.
- Independent FOV.
- No forced camera spin during normal attacks.

Perspective switching must interpolate camera position, FOV, reticle, audio listener, weapon representation, and animation phase without visible snapping.

## 6. Solo and Cooperative Play

The game must support one, two, three, or four players.

The entire game must remain completable solo using AI companions.

Multiplayer must be server-authoritative for:

- Damage.
- Enemy state.
- Loot eligibility.
- Quest progression.
- Boss state.
- Inventory mutations.
- Permanent progression.

Local movement prediction and remote interpolation must preserve responsiveness.

Progression is divided into:

- Personal progression.
- Campaign progression.
- Session progression.

Guests retain personal progression while the host campaign controls major world state. Guests may not overwrite the host's campaign decisions or duplicate unique rewards.

## 7. Party AI and Tactics Matrix

Solo players may recruit AI companions. Human players replace companion slots when joining.

Companion combat AI must be deterministic, fast, and authored. Generative language models may not control real-time combat decisions.

The Tactics Matrix allows players to configure conditional priorities, including:

- Healing thresholds.
- Interrupt priorities.
- Target-selection rules.
- Weakness exploitation.
- Revive behavior.
- Formation behavior.
- Resource thresholds.
- Boss weak-point focus.
- Ranged-threat priority.

Companions must behave competently without constant babysitting.

## 8. NPC Intelligence

NPC intelligence is divided into two layers.

### 8.1 Simulation AI

Simulation AI controls schedules, work, sleep, travel, shopping, relationships, danger response, quest participation, memory flags, and world-state reactions.

This layer uses deterministic schedules, utility scoring, behavior trees, blackboards, and state machines.

### 8.2 Generative Dialogue

Selected NPCs may use optional generative dialogue.

Each NPC receives constrained identity, history, knowledge, relationships, emotional state, secrets, and allowed topics.

The model may return dialogue and structured action requests, but the game server validates every request against an allowlist and current world state.

Generative dialogue may never directly modify inventory, quests, progression, combat, or saves.

Every critical conversation requires authored fallback dialogue so game progression never depends on model availability.

## 9. First-Floor Vertical Slice

Working floor name: **The Verdant Foundation**.

Required content:

- One major seamless city.
- Three wilderness regions.
- Agricultural outskirts.
- Several hidden routes.
- Multiple quest chains.
- Hunts and rare discoveries.
- A concealed labyrinth.
- Persistent labyrinth shortcuts.
- A substantial floor boss.
- A permanent ascent sequence.
- Approximately four to six hours of first-playthrough content for the vertical slice target.

Working locations:

- Caelus Reach.
- Windscar Grasslands.
- Weeping Grove.
- Broken Aqueduct.
- Foundry Labyrinth.
- Floor Guardian chamber.
- Ascension gateway.

The labyrinth discovery must be supported by at least three clue routes, including monster migration, structural vibrations, and old infrastructure records.

## 10. Opening Sequence

The opening begins with the player controlling a highly advanced character on a later floor.

The prologue demonstrates advanced combat, party tactics, first-person and third-person play, major structural scale, and a future enemy.

The player is defeated by a mechanic they do not yet understand.

The camera reveals that the battle was occurring on a real-world screen. The protagonist is then pulled into the game world and awakens on Floor One without their former power.

The prologue should last approximately ten to fifteen minutes and must function as an exciting promise of future mastery rather than a long fake progression segment.

## 11. Quest and Progression Framework

Quest categories:

- Main floor quest.
- Character quests.
- Guild contracts.
- Hunts.
- Emergent incidents.

Quest discovery may occur through conversation, overheard dialogue, physical evidence, notes, monster behavior, entering locations, finding items, reputation, companion observations, and previous consequences.

The game must avoid filling the map with default exclamation marks and waypoint clutter.

Progression layers:

- Character level.
- Weapon mastery.
- Discipline grid.
- Equipment traits.
- Relationship progression.
- World knowledge.

Rare equipment should alter playstyle through mechanics, move sets, traits, interactions, or build synergy rather than only numerical increases.

## 12. Seamless-World Requirement

Normal travel between city, outskirts, wilderness, labyrinth entrance, labyrinth sectors, and boss route must not use visible loading screens.

The game may stream assets through:

- Gates.
- Narrow streets.
- Forest passes.
- Caves.
- Elevators.
- Stairways.
- Fog zones.
- Large doors.
- Cinematic transitions that preserve player continuity.

Streaming must use sector activation, LODs, animation throttling, simplified physics, distant impostors, compressed textures, and cached assets.

“No loading screens” means hidden and controlled streaming, not loading the entire floor at maximum detail simultaneously.

## 13. Asset Policy

Playable milestones may not contain visible placeholder content.

Forbidden in milestone builds:

- Default primitives presented as finished art.
- Untextured geometry.
- Default engine materials.
- Temporary icons.
- Generic gray panels.
- Unlicensed assets.
- “Replace later” visual content presented as complete.

Developer-only blockouts are allowed internally for measurements and testing but may not be represented as finished playable content.

External assets must have clear commercial-use licenses and be recorded in an asset manifest containing:

- Asset name.
- Creator.
- Source.
- License.
- Download date.
- Archive checksum.
- Modifications.
- In-game usage.
- Attribution requirement.
- Redistribution restrictions.

The initial visual direction is polished stylized fantasy with strong silhouettes, cohesive materials, atmospheric lighting, and custom identity-defining hero assets.

Major identity assets must receive custom treatment, including the protagonist, companions, signature enemies, bosses, giant structural pillars, city skyline, labyrinth mechanisms, ascent gateway, named weapons, and principal UI.

## 14. UI/UX Standard

Required interfaces include:

- Exploration HUD.
- Combat HUD.
- Inventory.
- Equipment.
- Weapon mastery.
- Discipline grid.
- Tactics Matrix.
- Quest journal.
- Bestiary.
- Cartography.
- Relationships.
- Crafting.
- Party management.
- Co-op lobby.
- Settings.
- Accessibility.

Every interactive control requires:

- Hover state.
- Press state.
- Controller-focus state.
- Keyboard-focus state.
- Audio feedback.
- Disabled explanation.
- Loading state.
- Error state.

Mouse, keyboard, controller, and Steam Deck-class layouts must all feel intentional.

## 15. Performance Standard

Target baseline:

- 60 FPS on recommended desktop hardware.
- 30 FPS fallback mode.
- Dynamic resolution option.
- WebGPU primary path.
- WebGL fallback path.
- Region memory budgets.
- Character triangle, bone, material, texture, and animation budgets.
- Active physics-body caps.
- Active enemy caps.
- Fully simulated NPC caps.
- Shadow-caster caps.
- GPU-particle budgets.
- Network bandwidth budgets.

Oversized assets, uncompressed textures, and budget violations must fail automated checks where practical.

## 16. Quality Gates

### Visual Gate

- No untextured geometry.
- No default materials.
- No mismatched asset-pack collage in key spaces.
- No obvious terrain repetition near main routes.
- No visibly unfinished skies or landmarks.

### Animation Gate

- No foot sliding.
- No weapon teleporting.
- No camera snapping.
- No missing transition animations.
- Attack contact must match active frames.

### Interaction Gate

- Every action has clear feedback.
- Denied actions explain why.
- Pickups, quest updates, status changes, and progression are readable.

### Multiplayer Gate

- Permanent progression is never client-authoritative.
- Reconnection restores valid state.
- Disconnects cannot duplicate items.
- Party scaling works for one through four players.
- Guests cannot corrupt host progression.

### Performance Gate

- No major traversal hitch.
- Region budgets pass.
- Texture and draw-call limits pass.
- AI and animation update budgets pass.
- Network snapshots remain within budget.

### Content Gate

- Main quests cannot deadlock.
- Alternate quest orders are tested.
- NPC knowledge matches world state.
- Rare-item eligibility is valid.
- Boss rewards cannot duplicate incorrectly.
- Every labyrinth clue path is independently viable.

## 17. Milestone Order

1. Production lock and architecture.
2. Engine and asset pipeline.
3. Movement laboratory.
4. Combat laboratory.
5. First enemy ecosystem.
6. City foundation.
7. Quest and progression foundation.
8. Prologue cinematic.
9. Open-world region and streaming.
10. AI companions and Tactics Matrix.
11. Generative NPC dialogue.
12. Labyrinth.
13. Floor boss and world transformation.
14. Multiplayer completion.
15. Identity-art and audio pass.
16. Polish and accessibility.
17. Release candidate.

No later milestone may be used to excuse a weak foundation in an earlier milestone.

## 18. First Playable Acceptance Test

The first playable release passes only when the player can:

- Load into a finished-looking licensed environment.
- Control a real animated character.
- Walk, jog, sprint, jump, land, dodge, and navigate slopes reliably.
- Use keyboard, mouse, and controller.
- Switch between first-person and third-person without snapping.
- Draw and use a longsword.
- Fight a real animated enemy.
- Deal and receive readable damage.
- Block and manage stamina.
- Hear appropriate movement and combat audio.
- Use a responsive, animated HUD.
- Save settings and basic progress.
- Reload without redownloading unchanged assets.
- Meet the target performance budget.
- Complete the experience without visible placeholder content.

## 19. Production Rule

The project is not considered improved merely because more systems or content were added.

Every addition must strengthen the core fantasy, remain technically maintainable, meet performance and accessibility requirements, and pass the applicable quality gates.

If a feature is generic, unfinished, unreliable, visually inconsistent, unlicensed, or below the established standard, it must be redesigned or removed.
