# Project Diagnostics Summary

## 2026-03-10 — Castle Rendering Contract (diagnostic)
- `CastleScene` currently preloads `assetManifest.castles` and renders a single hardcoded key (`castle_faction01_bg`) using `this.add.image(...)`; there is no container-based castle layer stack yet.
- Current scaling is viewport-cover (`Math.max(viewportWidth / imageWidth, viewportHeight / imageHeight)`) with centered origin, and resize re-renders the background object.
- Manifest + loader already support multi-entry castle assets (`castles` array + per-entry `scene.load.image`), so layered castle assets are feasible without changing asset pipeline architecture.
- Feasibility classification: **Supported with small scene change** (scene must iterate/render multiple layer keys and manage ordering/visibility).
- Recommended contract: `public/assets/castles/<factionId>/castle_<layerId>.png` with keys `castle_<factionId>_<layerId>`, identical canvas dimensions/alignment across layers, and required `castle_base.png`.
- Recommended rendering strategy: **Option A (Phaser container with layered images)** for shared transform, deterministic stacking, and easy layer visibility toggling.
- First required generated asset: `public/assets/castles/faction01/castle_base.png` (baseline full illustration; future building layers aligned to same master resolution).
