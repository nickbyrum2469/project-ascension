# SyncLink

Android prototype for mapping mixed-generation speaker setups and testing simultaneous output routing.

Current test hardware:
- Sony HT-CT370 — legacy Bluetooth A2DP
- JBL Flip 6 — PartyBoost generation
- JBL PartyBox Club 120 — Auracast-capable current generation

v0.3 adds a verified multi-output routing lab. SyncLink can generate synchronized PCM, request specific Android output devices per AudioTrack, and then inspect the actual routed device reported by Android so we can distinguish a successful route from a preferred-device request that the OS ignored.

The production architecture remains hybrid: Samsung Dual Audio/Auracast where the OS supports it, plus relay/bridge paths for legacy speakers that cannot be driven simultaneously through the phone's normal media route.

Build note: update-compatible test APKs are rebuilt from the original signing-key branch so they can install over v0.2.2 without removing the app.
