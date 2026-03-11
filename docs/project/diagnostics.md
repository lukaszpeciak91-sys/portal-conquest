# Project Diagnostics Summary

## 2026-03-10 — Castle Layer Rendering MVP (implementation)
- Added a concrete castle asset contract for faction01 by wiring manifest key `castle_faction01_base` to `assets/castles/faction01/castle_base.png`, and documented the baseline path as `public/assets/castles/faction01/castle_base.png` (asset file is expected to be placed manually by repository owner).
- Upgraded `CastleScene` from single-background rendering to a Phaser container-based layered stack (`baseLayer`, `buildingLayer`, `decorLayer`) with resize-safe re-rendering and shared transform-ready structure.
- Kept the existing manifest/loader pipeline and safe fallback behavior: if the castle base texture is unavailable, scene renders a non-crashing fallback background + placeholder.
- Prepared future expansion by creating `public/assets/castles/faction01/buildings/` as the overlay asset contract path; engine behavior remains safe when `castle_base.png` is temporarily missing.
- Intentionally postponed: building placement/render logic, economy/recruitment systems, unlock rules, and interactive building gameplay.

## 2026-03-10 — Castle Rendering Contract (diagnostic)
- `CastleScene` currently preloads `assetManifest.castles` and renders a single hardcoded key (`castle_faction01_bg`) using `this.add.image(...)`; there is no container-based castle layer stack yet.
- Current scaling is viewport-cover (`Math.max(viewportWidth / imageWidth, viewportHeight / imageHeight)`) with centered origin, and resize re-renders the background object.
- Manifest + loader already support multi-entry castle assets (`castles` array + per-entry `scene.load.image`), so layered castle assets are feasible without changing asset pipeline architecture.
- Feasibility classification: **Supported with small scene change** (scene must iterate/render multiple layer keys and manage ordering/visibility).
- Recommended contract: `public/assets/castles/<factionId>/castle_<layerId>.png` with keys `castle_<factionId>_<layerId>`, identical canvas dimensions/alignment across layers, and required `castle_base.png`.
- Recommended rendering strategy: **Option A (Phaser container with layered images)** for shared transform, deterministic stacking, and easy layer visibility toggling.
- First required generated asset: `public/assets/castles/faction01/castle_base.png` (baseline full illustration; future building layers aligned to same master resolution).

## Early Architecture Diagnostics (Initial Phase)

### Map Node System — Diagnostic Summary
- Early validation confirmed `map01.json` used a consistent node schema (`id`, `type`, `region`, `x`, `y`, `connections`, `hidden`) and reciprocal graph links, so graph integrity issues were not a primary blocker.
- Core risk identified at the time: hidden nodes existed in data but had no reveal progression logic, leaving exploration/fog progression incomplete despite functioning adjacency movement.
- Coordinate-to-screen scaling approach (`mapToScreen`) was structurally sound, but it depended on authored background dimensions staying aligned with map coordinate space.

### Scene Router and Run-Loop Gaps — Diagnostic Summary
- Early loop diagnostics verified that traversal and node-trigger routing worked, but run lifecycle architecture was incomplete: no explicit run init/reset path, no portal-closure completion hook after portal battles, and no run-complete/win-state transition.
- This established a key architectural constraint for subsequent tasks: preserve `SceneRouter` + shared runtime flow, while adding completion/reset transitions rather than introducing parallel state/transition paths.

### Asset and Deployment Diagnostics — Diagnostic Summary
- Build output was Pages-compatible, but runtime asset loading used absolute `/assets/...` paths during the early phase, creating risk under repository-path hosting.
- Another early blocker was content readiness: expected map assets were missing from `public/assets/...`, causing fallback rendering and masking gameplay validation quality.

### Mobile Interaction Constraints — Diagnostic Summary
- Touch and safe-area foundations were present early (safe-area-aware overlay + touch handlers), but node hit areas were too small for reliable mobile play.
- Diagnostic conclusion: interaction fidelity needed invisible hitbox enlargement and UI decluttering on small screens before mobile UX could be treated as stable.

## 2026-03-10 — Castle Building System Readiness (diagnostic)

### A. Files inspected
- Project docs (read first per workflow):
  - `docs/project/workflow.md`
  - `docs/project/progress.md`
  - `docs/project/decisions.md`
  - `docs/project/diagnostics.md`
  - `docs/project/generation-prompts.md`
- Castle scene and render flow:
  - `src/scenes/CastleScene.js`
  - `src/assets/loadAssetsFromManifest.js`
  - `src/data/assets/asset-manifest.json`
- Castle/faction data contracts:
  - `src/data/factions/index.json`
  - `src/data/factions/faction01.json`
  - `src/data/factions/human/faction.json`
  - `src/data/factions/human/castle_layout.json`
  - `src/data/factions/human/units.json`
  - `src/data/factions/human/enemies.json`
  - `src/data/factions/human/spells.json`
- Runtime state:
  - `src/state/GameState.js`
  - `src/state/runtimeState.js`
  - `src/state/loadGameData.js`
- UI / castle actions:
  - `ui-overlay.js`
  - `index.html`
- Asset directory verification:
  - `public/assets/castles/faction01/`
  - `public/assets/castles/faction01/buildings/`
  - `public/assets/factions/human/castle/`

### B. Existing reusable foundations
- `CastleScene` already has a layered container stack (`baseLayer`, `buildingLayer`, `decorLayer`) and a centralized `renderCastleLayers(...)` path; this is a good renderer foundation for future overlay rendering.
- Castle assets are already loaded through the shared manifest pipeline (`asset-manifest.json` + `loadAssetsFromManifest`), so future building overlays can reuse existing loader architecture.
- Runtime persistence is centralized in `GameState` plus `runtimeState` helpers; this provides a proper place for future building runtime data instead of scene-local persistence.
- UI already has castle mode routing and context-panel actions (`Build`, `Leave`) wired through shared overlay event handling.

### C. Existing partial logic or hooks
- Rendering hooks exist but are currently placeholders:
  - `buildingLayer` and `decorLayer` are created and cleared, but no building sprites are instantiated.
- Castle base rendering is currently hardcoded to a single key (`castle_faction01_base`) rather than faction/layout-driven selection.
- `castle_layout.json` exists (with `tavern`/`barracks` coordinates), but no runtime code imports or consumes it.
- `src/data/factions/human/faction.json` contains `assets.castleBase`, but active runtime loading uses `src/data/factions/faction01.json`; there is currently a split/parallel faction data path.
- UI Build action is a stub (`console.log('[UI] Castle Build')`) with no data/state linkage.

### D. Missing parts
- No building definition contract exists yet (costs, requirements, levels, output effects, art keys, etc.).
- No renderer bridge from layout anchors to overlay assets exists.
- No faction-to-castle-layout binding in active runtime state.
- No runtime building state model exists (built/unlocked/upgraded queues or timestamps).
- No save/load semantics for building progression.
- No asset manifest entries for building overlays (only base castle key exists).

### E. Recommended data-driven architecture
Keep implementation narrow and additive to existing systems:
1. **Faction definition (authoring entry point)**
   - One active faction contract should reference:
     - `castle.baseKey`
     - `castle.layoutId`
     - `castle.buildingSetId`
   - Remove/avoid parallel faction schemas for runtime-critical castle data.
2. **Castle layout anchors (pure placement contract)**
   - Layout file keyed by `layoutId` containing named anchors/slots:
     - `slotId`, `x`, `y`, optional `z`, optional per-slot scale/offset.
   - No gameplay stats in layout file; placement only.
3. **Building definitions (pure gameplay + art contract)**
   - Building-set file keyed by `buildingSetId` containing building defs:
     - `buildingId`, `displayName`, `slotId`, `levels[]`, each level mapping to overlay asset key and gameplay metadata.
   - Keep faction-specific art overrides in data, not in scene branching.
4. **Building runtime state (GameState-owned, serializable)**
   - Add run/persistent structure keyed by `factionId` and `buildingId`:
     - built flag, current level, unlock state (and later timers/queues if needed).
   - `CastleScene` should render by combining:
     - faction castle contract + layout anchors + building defs + runtime state.
   - Scene should only interpret data and draw layers; no faction-specific conditionals.

### F. Fast faction-addition rule
If architecture is implemented correctly, adding a faction should require only data/assets (no scene logic edits):
1. Faction entry (links `layoutId`, `buildingSetId`, base castle key).
2. Castle layout file (slot anchors).
3. Building-set definition file (buildings + level metadata + asset keys).
4. Overlay PNG assets + base castle PNG following manifest key/path conventions.
5. Manifest entries for new castle base and building overlay keys.

### G. Documentation update recommendation
After the future implementation task lands, update:
- `docs/project/progress.md` (move castle building system from stub to implemented scope).
- `docs/project/decisions.md` (record finalized data contracts: faction/layout/building/runtime schema decisions).
- `docs/project/diagnostics.md` (add implementation verification summary against this readiness diagnostic).
- `docs/project/workflow.md` only if workflow policy changes (not expected for feature-only implementation).

## 2026-03-11 — Castle building overlay load + build glow (implementation verification)
- Verified and corrected castle building overlay asset paths in manifest so human castle building keys now resolve to `public/assets/castles/faction01/buildings/{barracks,tavern,chapel}.png`.
- `CastleScene` now warns once per building id when a built overlay asset key is unresolved, using the required warning text format: `Missing castle building asset: [name].png`.
- Building overlays remain slot-driven from `castle_layout.json` anchors and render with bottom-center origin (`0.5, 1`) to sit naturally on the base courtyard without disproportionate scaling.
- Added a temporary build glow animation (golden radial texture, additive blend) that renders below the building sprite and self-destroys after ~720ms.
- Added debug slot marker rendering in castle scene (labels + marker rings) gated by current debug mode, enabling placement verification without changing gameplay behavior.
