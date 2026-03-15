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

Initial architecture review of the castle building system.

Result of the diagnosis:
- The project already contains the core rendering foundation for layered castles (`baseLayer`, `buildingLayer`, `decorLayer` in `CastleScene`).
- Asset loading for castle graphics is handled through the shared manifest pipeline.
- A castle layout file with building anchors exists but is not yet connected to runtime rendering.
- The UI build action is currently a placeholder and building runtime state is not implemented yet.

Conclusion:
The castle system foundation is correct, but the data-driven building pipeline (layout anchors → building definitions → runtime state → renderer) still requires implementation.

Detailed diagnostic analysis was produced in the Codex session and is not stored in the repository to avoid bloating project documentation.

## 2026-03-11 — Castle building overlay load + build glow (implementation verification)
- Verified and corrected castle building overlay asset paths in manifest so human castle building keys now resolve to `public/assets/castles/faction01/buildings/{barracks,tavern,chapel}.png`.
- `CastleScene` now warns once per building id when a built overlay asset key is unresolved, using the required warning text format: `Missing castle building asset: [name].png`.
- Building overlays remain slot-driven from `castle_layout.json` anchors and render with bottom-center origin (`0.5, 1`) to sit naturally on the base courtyard without disproportionate scaling.
- Added a temporary build glow animation (golden radial texture, additive blend) that renders below the building sprite and self-destroys after ~720ms.
- Added debug slot marker rendering in castle scene (labels + marker rings) gated by current debug mode, enabling placement verification without changing gameplay behavior.

## 2026-03-11 — Castle overlay sizing contract mismatch (diagnostic)
- Building overlays are authored at full-canvas resolution (`1536x1024`, same as `castle_base.png`) while runtime treats them as slot-local sprites and applies anchor scale (`anchor.scale * baseScale`) at slot coordinates, causing oversized/full-frame placement.
- Final technical conclusion: current renderer lacks an explicit overlay sizing contract and currently conflates two incompatible asset authoring modes (full-canvas aligned overlays vs isolated building cutouts).
- Implementation direction: standardize on slot-local isolated overlays with a shared layout-level default building scale plus optional per-building scale override, while keeping anchors normalized to base dimensions for faction portability.

## 2026-03-15 — Castle transform/anchor/scale mismatch (diagnostic)
- Castle base is currently rendered with **cover** scaling (`Math.max(renderBounds.width / imageWidth, renderBounds.height / imageHeight)`), so the base is cropped whenever viewport/playable aspect ratio differs from the authored base aspect ratio.
- Slot anchors are mapped against the **rendered (possibly cropped) base dimensions** around center (`center + (anchor - 0.5) * renderedSize`), so normalized anchors themselves are working but are being applied to a cropped transform space instead of a fully visible contain-fit base.
- Building overlay scale currently uses only `layout.defaultBuildingScale * castleBaseScale`; per-level/asset scale overrides in building definitions are not applied, which can make overlays appear uniformly too large.
- Implementation direction: keep current architecture (layout slots + normalized anchors + layered containers), but align runtime math to the documented contract by using contain/full-frame base fit and honoring per-building level scale override in the existing scale-composition path.
