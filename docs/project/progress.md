# Project Progress Source of Truth

## Current Phase
- **Structural foundation phase** (core architecture exists; gameplay depth is still limited).

## Implemented Systems
- **Map traversal loop:** movement between connected nodes is implemented.
- **Node inspect flow:** inspect/confirm interaction loop exists for map nodes.
- **Scene architecture:** `SceneRouter` is established and used for scene transitions.
- **Runtime state layer:** `GameState` + runtime node state helpers are implemented as central run/session state.
- **Data-driven baseline:** map/config/faction JSON loading is in place.
- **Castle layered rendering + visual polish:** `CastleScene` now renders faction01 `castle_base.png` via manifest loading and a Phaser container layer stack (base/buildings/decor hooks), with follow-up presentation polish applied (improved framing/scale, no normal-view debug placeholders for missing overlays, compact top-right top bar behavior matching map/castle hub presentation).
- **Documentation governance hardening:** strict per-file documentation update policy is now defined in `docs/project/workflow.md` to keep project knowledge centralized and reduce cross-file drift.

## Partial / Stub Systems
- **CastleScene:** layered visual foundation is implemented, but building gameplay/recruitment systems are not implemented yet.
- **BattleScene:** placeholder/stub-level scene; battle loop is not yet implemented.
- **MenuScene:** minimal placeholder entry scene.
- **Node outcomes:** several node types still rely on minimal placeholder effects.

## Missing / Not Yet Implemented
- Full battle mechanics and resolution loop.
- Castle management loop (buildings/recruitment progression).
- Complete run progression/win-state loop.
- Rich faction differentiation gameplay systems.

## Asset Architecture Status
- Asset manifest and shared loader architecture exist (`asset-manifest.json` + manifest loader utilities).
- Manifest categories are present but currently sparse, with many content lists still mostly empty.
- Castle asset contract now includes the expected base path `public/assets/castles/faction01/castle_base.png` and a prepared `public/assets/castles/faction01/buildings/` folder for future overlay assets (PNG is intentionally added manually, not committed by Codex).

## Immediate Next Architectural Priority
- Preserve and extend the existing architecture foundation:
  1. Implement real battle flow on top of current SceneRouter/state patterns.
  2. Implement castle hub systems using shared runtime state (not scene-local persistence).
  3. Continue asset-driven content expansion through manifest/JSON pipelines.
