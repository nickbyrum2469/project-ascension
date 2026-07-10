# Project Ascension

Project Ascension is an original browser-based 3D action RPG about conquering a colossal layered megastructure one floor at a time.

The active foundation build contains an authored section of **Floor I: The Verdant Foundation**, supporting first-person and third-person traversal, seamless camera switching, controller and keyboard/mouse input, action combat, enemy behavior, an NPC-led quest thread, local save persistence, original runtime-generated art and audio, and a high-polish responsive HUD.

The governing production requirements live in [`docs/PROJECT_CHARTER.md`](docs/PROJECT_CHARTER.md). A feature is not accepted merely because it functions; it must also satisfy the project's visual, animation, interaction, performance, content, and future multiplayer standards.

## Run locally

Requirements: Node.js 22 or newer.

```bash
npm install
npm run dev
```

Then open the local address shown by Vite. Hardware acceleration is strongly recommended. The client uses WebGPU when available and falls back to WebGL 2.

## Controls

| Action | Keyboard and mouse | Controller |
|---|---|---|
| Move | WASD | Left stick |
| Look | Mouse | Right stick |
| Light strike | Left mouse | Right trigger |
| Heavy strike | Q / middle mouse | Right bumper |
| Guard | Right mouse | Left trigger |
| Dodge | Ctrl | South face button |
| Jump | Space | East face button |
| Interact | E | West face button |
| Switch perspective | V | North face button |
| Lock target | Tab | Right stick click |
| Switch shoulder | C | Left bumper |
| Pause | Escape | Menu button |

## Quality checks

```bash
npm run check
npm run test:smoke
npm run build
```

## Asset policy

No unlicensed art or audio may enter the project. The current foundation uses original runtime-generated art, VFX, materials, UI, and procedural audio. Every asset is recorded in [`public/assets/asset-manifest.json`](public/assets/asset-manifest.json).

## Current milestone

**Milestone 1–3 foundation:** engine, world presentation, movement, dual-perspective camera, combat loop, enemy ecosystem seed, quest interaction, persistence, and production pipeline.

This is the beginning of the complete first-floor production—not a claim that the full game is finished.
