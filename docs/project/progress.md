# Project Progress Source of Truth

## Current Phase
- **Structural foundation phase** (core architecture exists; gameplay depth is still limited).

## Implemented Systems
- **Castle screen architecture finalized:** rendering contract now uses contain/full-frame scaling (no crop), interaction zones are split by `courtyardBoundaryY`, and click routing is boundary-driven (construction above, building interaction below).
- **Map traversal loop:** movement between connected nodes is implemented.
- **Node inspect flow:** inspect/confirm interaction loop exists for map nodes.
- **Scene architecture:** `SceneRouter` is established and used for scene transitions.
- **Runtime state layer:** `GameState` + runtime node state helpers are implemented as central run/session state.
- **Data-driven baseline:** map/config/faction JSON loading is in place.
- **Castle layered rendering + visual polish:** `CastleScene` now renders faction01 `castle_base.png` as a fullscreen-style castle background within playable bounds (centered, aspect-preserving cover scaling) while keeping compact top-right controls and bottom mode navigation behavior.
- **Documentation governance hardening:** strict per-file documentation update policy is now defined in `docs/project/workflow.md` to keep project knowledge centralized and reduce cross-file drift.

### Castle Building Placement System
- Layout anchors connect to building overlay assets with responsive scaling behavior in `CastleScene`.
- Finalized human-faction slot/building contract is now clearly documented as the active template reference for future castle generation.

## Partial / Stub Systems
- **CastleScene:** Build Panel now exposes and constructs all finalized MVP buildings (Barracks, Archery Range, Chapel, Tavern, Forge, Command Hall) via the existing runtime/state flow and 6-anchor layout contract (TOP_CENTER, LEFT/RIGHT_MID, LEFT/RIGHT_FOREGROUND, CENTER_FOREGROUND).
- **BattleScene:** placeholder/stub-level scene; battle loop is not yet implemented.
- **MenuScene:** minimal placeholder entry scene.
- **Node outcomes:** several node types still rely on minimal placeholder effects.

## Missing / Not Yet Implemented
- Full battle mechanics and resolution loop.
- Additional art polish/iteration for human faction overlays and non-placeholder visuals.
- Complete run progression/win-state loop.
- Rich faction differentiation gameplay systems.
- Economy costs/checks for construction and building progression rules.
- Recruitment and upgrade gameplay logic for constructed buildings.
- Gameplay logic for Tavern/Forge/Command Hall progression, hero progression interactions, and elite promotion is not yet implemented.

## Asset Architecture Status
- Asset manifest and shared loader architecture exist (`asset-manifest.json` + manifest loader utilities).
- Manifest categories are present but currently sparse, with many content lists still mostly empty.
- Castle asset contract now includes the expected base path `public/assets/castles/faction01/castle_base.png` and a prepared `public/assets/castles/faction01/buildings/` folder for future overlay assets (PNG is intentionally added manually, not committed by Codex).

## Immediate Next Architectural Priority
- Preserve and extend the existing architecture foundation:
  1. Implement real battle flow on top of current SceneRouter/state patterns.
  2. Implement castle hub systems using shared runtime state (not scene-local persistence).
  3. Continue asset-driven content expansion through manifest/JSON pipelines.

## 2026-03-11 Update
- **Castle building overlays currently implemented in runtime:** all finalized MVP overlays (Barracks, Archery Range, Chapel, Tavern, Forge, Command Hall) render from `public/assets/castles/faction01/buildings/` via manifest-backed keys with bottom-centered anchors and slot-based placement.
- **Castle build menu source constrained to finalized MVP IDs:** `CastleScene` now derives buildable entries through a finalized ordered id set (`barracks`, `archery_range`, `chapel`, `tavern`, `forge`, `command_hall`) while still resolving definitions from the existing `human_buildings` data and existing construction flow.
- **Build feedback effect added:** newly constructed buildings now trigger a temporary Heroes-style warm glow animation beneath the building sprite (fade-in/brighten/fade-out lifecycle).
- **Castle debug support:** when debug mode is enabled, castle slot markers are rendered to verify anchor alignment during scene tuning.
- **Normalized castle overlay contract implemented:** castle layout now uses normalized slot anchors (`anchorX`, `anchorY`) plus `defaultBuildingScale`, and renderer scale priority is `building level scale override -> layout default`.

## 2026-03-13 Update
- Castle screen architecture finalized.
- Rendering contract defined.
- Interaction zones implemented.
- Castle composition grid documented.
- Finalized `faction01` castle slot layout is now authored as explicit JSON `slots` data (`slotId`, `buildingId`, `anchorX`, `anchorY`, plus debug-only `pixelX`, `pixelY`) and consumed directly by runtime placement.

## 2026-03-15 Update
- Human `castle_base.png` is now treated as the canonical authored base reference at `1536x1024` for calibration work.
- Human slot calibration in `src/data/factions/human/castle_layout.json` was refreshed for the canonical base image, updating the six runtime `slotCenterX` / `slotCenterY` values while preserving existing slot/building IDs and sizing/offset metadata.
- Future castle visual generation/calibration should preserve the same stable gameplay-center approach: central castle read, readable open courtyard, six clearly separable build pads, and safe side-extension behavior when adapting to wider presentation ratios.
