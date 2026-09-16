# SyncLink v0.1

Android prototype for mapping mixed-generation speaker setups and building honest Direct / Auracast / Relay routing plans.

Initial target setup:
- Sony HT-CT370 — legacy Bluetooth A2DP
- JBL Flip 6 — PartyBoost generation
- New-generation JBL PartyBox — exact model detected at runtime

v0.1 includes runtime Bluetooth permissions, paired/nearby discovery, A2DP and LE Audio profile detection, active Android output diagnostics, per-speaker saved delay offsets (-500 ms to +500 ms), party-plan calculation, and a sync test tone through the actual active media route.

Android does not expose arbitrary simultaneous A2DP routing to normal third-party apps, so SyncLink does not pretend the Flip 6 and HT-CT370 can already be driven simultaneously from one phone. The cross-brand design uses timestamped Wi-Fi Relay nodes for legacy speakers while Auracast/system routing handles compatible hardware. Wi-Fi audio relay is the next engine layer after this hardware-mapping prototype.
