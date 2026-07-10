# Iteration 07 — Expedition Journal

## Completed

- Added a polished in-game expedition journal opened with `J`.
- Added three responsive sections: current floor overview, field records, and the persistent beacon network.
- Connected the journal to the existing local save so quest, labyrinth, cache, beacon, and ascent progress render from real player state.
- Added keyboard capture while the journal is open so movement and combat input do not bleed through the overlay.
- Added pointer-lock release, backdrop/escape closing, focus handling, responsive desktop and narrow-screen layouts, animated progress, hover/focus feedback, and semantic dialog attributes.

## Remaining imperfections

- The journal currently reads the save when opened or when switching sections; it does not live-refresh while left open during an external save mutation.
- It is keyboard and mouse complete, but dedicated controller tab navigation is still a future UI-input integration task.
- The journal summarizes existing content; broader bestiary, equipment, cartography, and relationship data require their underlying gameplay systems first.

## Next priority

Deepen combat readability and mastery: perfect-guard timing, guard pressure, guard counters, stronger enemy telegraph feedback, and automated combat-state smoke coverage.