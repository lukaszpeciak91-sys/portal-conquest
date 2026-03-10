# Project Progress Source of Truth

## Current Phase
- **Structural foundation phase** (core architecture exists; gameplay depth is still limited).

## Implemented Systems
- **Map traversal loop:** movement between connected nodes is implemented.
- **Node inspect flow:** inspect/confirm interaction loop exists for map nodes.
- **Scene architecture:** `SceneRouter` is established and used for scene transitions.
- **Runtime state layer:** `GameState` + runtime node state helpers are implemented as central run/session state.
- **Data-driven baseline:** map/config/faction JSON loading is in place.

## Partial / Stub Systems
- **CastleScene:** placeholder/stub-level scene; not full castle gameplay yet.
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

## Immediate Next Architectural Priority
- Preserve and extend the existing architecture foundation:
  1. Implement real battle flow on top of current SceneRouter/state patterns.
  2. Implement castle hub systems using shared runtime state (not scene-local persistence).
  3. Continue asset-driven content expansion through manifest/JSON pipelines.
