# MVP State Review (Tasks 1–7)

## 1) Project structure review

### Current structure (observed)
- `src/` exists with:
  - `src/scenes/` ✅ (`MapScene`, `MenuScene`, `BattleScene`, `CastleScene`, scene helpers).
  - `src/state/` ✅ (`GameState`, scene sync, data loader).
  - `src/data/` ✅ (`maps`, `config`, `factions` JSON).
  - Loaders/helpers ✅ (`src/state/loadGameData.js`, `src/scenes/ui.js`, `src/SceneRouter.js`).
- `public/assets/` ❌ missing entirely.
  - `maps/` ❌ missing.
  - `ui/` ❌ missing.
  - `units/` optional — not present.
  - `portals/` optional — not present.
- `docs/` ❌ was missing before this diagnostic file; `docs/art_style_guide.md` is not present.

### Asset path consistency for Vite + GitHub Pages
- Vite is configured with `base: './'`, which is generally correct for project-page deployment.
- However, runtime asset loads in `MapScene.preload()` use absolute `/assets/...` paths, which will resolve to the domain root on GitHub Pages and can break under `/<repo>/` hosting.
- `index.html` also references `/styles.css` and `/src/main.js` in source form; Vite rewrites these in build output, but in dev/source these are absolute-root paths.

## 2) Systems implemented

### Implemented now
- **JSON data model**: present via `map01.json`, `mvp.json`, `faction01.json`; loaded into runtime state.
- **GameState runtime object**: central mutable session state exists (`currentNodeId`, `turnCounter`, discovered nodes, pending battle kind, etc.).
- **Map rendering**: map background draw + node marker rendering + hero marker rendering exist.
- **Node interaction**: nodes are clickable/tappable; selection info + move validation shown.
- **Hero movement between nodes**: tweened movement implemented for adjacent connected nodes only.
- **Turn counter**: increments after successful move and updates HUD.
- **Scene switching by node type**: arrival handler routes to Castle/Battle and stubs other node types.
- **Placeholder BattleScene**: exists; supports portal battle label based on `pendingBattleKind`.
- **Placeholder CastleScene**: exists with return-to-map action.
- **Overlay UI**: mode-aware HUD + bottom sheet + HUD chip updates present (`window.gameUi`).

### Partial systems
- **Hidden/fog behavior**: hidden nodes are filtered out from rendering, but there is no reveal progression logic.
- **Portal progression**: portal node routes to battle placeholder but no closure progression is performed.
- **Resource/event/beacon gameplay**: all are stubs (message overlays, one-use beacon flag only).

## 3) MVP game loop check

Target loop:
`Start run → view map → move between nodes → trigger node events → reach portal → portal battle placeholder → close portals → finish run`

### Status
- `Start run` ⚠️ partial: can enter map from menu, but there is no explicit run-init/reset flow.
- `View map` ✅ works.
- `Move between nodes` ✅ works for visible adjacent nodes.
- `Trigger node events` ⚠️ partial: triggers fire, but event/resource/beacon outcomes are placeholders.
- `Reach portal` ✅ possible via graph path.
- `Portal battle placeholder` ✅ works (`pendingBattleKind='portal'` + BattleScene label).
- `Close portals` ❌ missing (no state update on battle completion).
- `Finish run` ❌ missing (no win condition/end-state scene/summary/reset).

## 4) Map + data validation (`src/data/maps/map01.json`)

### Validation findings
- **Node schema**: each node has `id`, `type`, `region`, `x`, `y`, `connections`, `hidden`.
- **Connection graph validity**: references are valid and reciprocal (no broken links found).
- **Hidden/visible handling**: `hidden` exists in data and renderer currently skips hidden nodes entirely.
- **Biome field usage**: map-level `biome` is consumed for logging and node info display text.
- **Coordinate usability with map scaling**: coordinates are in a compact pixel-like range and transformed proportionally to rendered map bounds (`mapToScreen`), so scaling logic is coherent.

### Inconsistencies / risks
- Hidden nodes (`n3`, `n6`) are not rendered and currently have no reveal logic, reducing traversable/visible gameplay space.
- If `map01.png` dimensions differ significantly from coordinate assumptions, node positions may visually misalign (logic supports scaling but requires matching authored coordinate space).

## 5) Mobile UX check

### What is good
- Overlay uses safe-area variables (`env(safe-area-inset-*)`), dynamic viewport height syncing, and touch-sized controls (48px minimum targets).
- Node markers are interactive and should respond to touch (`pointerdown`).
- Hero movement is short tween duration (220ms), so perceived responsiveness is good.
- Bottom sheet has explicit open/close controls and large buttons.

### Issues observed
- Node hit targets are small circles (radius 7), which can be difficult for touch precision on phones.
- Game canvas is fixed at `480x320` in Phaser config (landscape), which is not ideal for modern portrait-first mobile layouts.
- Map scene includes large debug buttons/text overlays that occupy gameplay space and can crowd small screens.
- No gesture support (pan/zoom, drag, swipe-to-close sheet), so UX is functional but basic.

## 6) GitHub Pages deployment check

### Compatibility status
- **Vite build output**: builds successfully; generated HTML uses relative `./assets/...` module/CSS paths.
- **Module loading**: ESM bundling works under Vite build.
- **Potential breakage**:
  - Phaser preload uses absolute `/assets/maps/map01.png`; on GitHub Pages project path this can 404 unless assets are published at domain root.
  - Repository currently lacks expected `public/assets/...` files; map texture load likely fails, triggering fallback “Missing map01.png”.

### Conclusion
- Build pipeline is Pages-friendly, but runtime game assets/pathing are not fully Pages-safe yet.

## 7) Actual MVP blockers

1. No portal closure resolution after portal battle return (no increment/use of `closedPortals` in loop).
2. No win condition (e.g., all portals closed) and no run completion state/scene.
3. No run reset/new run flow (state reset for replay session).
4. Hidden-node reveal/fog progression not implemented, so map progression is incomplete.
5. Core event/resource outcomes are stubs only (no persistent economy/progression effect).
6. Asset pipeline incomplete (`public/assets/maps/map01.png` absent), causing map visual fallback and degraded UX.

## 8) Recommended next tasks (small, isolated)

1. **Implement portal-closure stub completion hook** in `BattleScene` return path (close one portal when `pendingBattleKind==='portal'`).
2. **Add win-condition check** (`closedPortals >= target`) and route to a minimal Run Complete scene/modal.
3. **Add “New Run” reset action** (clear `turnCounter`, node discovery, beacon usage, portal closure count, pending flags).
4. **Implement node reveal rule** (reveal adjacent hidden nodes after entering a node).
5. **Replace resource/event placeholders with minimal state effects** (e.g., +gold, +mana, one random event text + state flag).
6. **Add minimal party/unit summary chip in HUD** (read-only MVP display).
7. **Fix asset hosting paths for Pages** (`public/assets/...` + relative-safe loading strategy).
8. **Increase mobile node tap hitbox** (larger invisible interactive radius while keeping visual dot size).
