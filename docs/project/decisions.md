# Project Decisions Source of Truth

## Game Identity / Scope
- Project target: **small mobile strategy game**.
- Inspiration: **Heroes III** and **Disciples II**, but this is **not a clone**.
- Presentation target: **landscape fullscreen (16:9)**.
- Delivery principle: architecture and foundation before feature volume.

## Architecture Principles
- Use `SceneRouter` for scene transitions.
- Keep persistent run state in `GameState` + runtime state helpers.
- Avoid parallel state/routing systems.
- Prefer asset/data-driven expansion over hardcoded faction-specific logic.

## Map Design
- Overworld progression is **node-based exploration**.
- Movement is **graph-based traversal**.
- More than one map is planned.
- Future world structure may evolve into multiple connected maps/worlds.
- Multiplayer/world-grid concept is exploratory only and **not an MVP commitment**.
- Node types are intended to remain mostly fixed for MVP stability.

## Castle Design
- Castle is a **faction hub** scene.
- Castle includes sections such as **Buildings** and **Recruitment**.
- Castle visual direction: **layered illustration** where buildings appear as added layers after construction.
- Layered castle architecture is preferred over replacing a full static background per upgrade.
- First-level buildings unlock unit recruitment.
- MVP target: **3 recruitable unit lines**.
- Long-term direction can include branching development inspired by Disciples.


### Castle Building Slot Architecture
The castle hub uses a fixed slot-based building system.

Rules:

- Maximum slots: **6**
- MVP buildings: **3**
- Barracks
- Tavern
- Chapel

Buildings are rendered as **transparent PNG overlays placed on top of the castle base illustration**.

The castle base must visually reserve space for all slots to prevent future redesign.

Future factions must follow the same slot architecture.

## Castle Interaction Flow
- Click castle keep/base to open **Build Panel**.
- Click a built building overlay to open **Building Panel**.
- Building slots are anchor-only and remain invisible until a building exists.
- Current faction MVP castle layout uses a maximum of **6 anchor slots** as a stable placement contract for both placeholders and future transparent PNG building overlays.
- Castle layout anchors are authored as normalized coordinates (`anchorX`, `anchorY`) relative to castle base dimensions and paired with a layout-level `defaultBuildingScale`; per-building level definitions may optionally override scale when needed.
- Build Panel is the construction entry point and immediately marks a selected building as built in runtime state (placeholder-only logic for now).
- Current human-faction MVP base building set exposed in Build Panel: **Barracks, Tavern, Chapel**.
- Built buildings may render with temporary in-scene placeholders until final transparent overlay PNGs are available.
- Castle/map top bar presentation uses a compact top-right control cluster (no full-width heavy strip in normal gameplay view).

## Battle Design
- Battle is a **separate scene**.
- Combat direction is closer to **Disciples-style** pacing than Heroes-style mass combat.
- Current repository battle implementation is still stub-level.

## Hero Design
- MVP target: **1 hero per faction**.
- Equipment system should remain very small/simple for MVP (**up to 3 items**).
- Hero/equipment architecture should stay easy to extend or remove.

## Economy
- MVP resources: **gold + corruption/chaos crystals**.
- Final naming is still open for polishing and localization.

## Factions / Content Pipeline
- Factions should differ in gameplay/units, not only visuals.
- Adding factions should be low-friction and as asset-driven as practical.
- PNG/JSON-driven content expansion is preferred.
- Architecture should avoid hardcoding faction-specific scene logic.

## Future Ideas (Not in MVP by Default)
- Multi-map world progression layers.
- Expanded hero progression and equipment depth.
- Advanced battle systems beyond MVP scope.
- Multiplayer/world-grid concepts remain exploratory and uncommitted.

## Rejected or Risky Directions
- Do not bypass `SceneRouter` with ad-hoc scene transition logic.
- Do not create parallel persistent state systems outside `GameState`/runtime state layer.
- Do not build castle purely as disconnected DOM-only UI separate from game architecture.
- Do not assume multiplayer is in MVP unless explicitly promoted later.
