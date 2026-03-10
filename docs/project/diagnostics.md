# Project Diagnostics Summary

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
