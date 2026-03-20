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


### Castle Building System — MVP Structure
The human faction castle MVP design is finalized as a fixed **6-building** system built on top of the existing layered castle rendering contract.

### Finalized Human Castle Template Contract (Authoritative)
- Human castle reference visual style remains dark fantasy semi-painterly, gameplay-readable first, and aligned to the same 16:9 layered-castle direction used by runtime.
- Canonical authored human base reference is `public/assets/castles/faction01/castle_base.png` in `2048x1152` base-space dimensions for finalized terrace slot calibration.
- The six-slot courtyard template is the stable composition contract for faction template generation and future faction adaptation.
- For faction reference template establishment, visible stone foundations/build pads in `castle_base.png` are accepted and recommended to preserve slot readability.
- Overlay-first castle expansion remains the preferred architecture: base scene first, isolated transparent building overlays layered afterward.
- Base building generation is done first for the finalized MVP set; upgraded building tiers are intentionally postponed until placement/scale validation is complete.

Final MVP building set:

- **Unit buildings (3)**
  - **Barracks** — melee line
  - **Archery Range** — ranged line
  - **Chapel** — support line
- **System buildings (3)**
  - **Tavern** — hero recruitment and hero progression interaction hub
  - **Forge** — army stat upgrade progression
  - **Command Hall** — morale/speed/elite promotion progression

System building design rules:

- **Tavern**
  - Level 1: recruit hero
  - Level 2: hero stat upgrade choice
  - Level 3: hero special ability/trait
  - Hero gains XP from battles, but hero level advancement requires Tavern interaction.
- **Forge**
  - Level 1: unlocks higher building upgrade tiers
  - Level 2: army attack bonus
  - Level 3: army defense bonus
  - Exact numeric values are intentionally TBD.
- **Command Hall**
  - Level 1: army morale bonus
  - Level 2: army speed/initiative bonus
  - Level 3: unlock Elite Promotion
  - Only one Elite unit is allowed per army.

Unit line progression rule:

- Unit lines evolve through the unit experience system, not through extra building dependency chains.

Fixed slot architecture:

- Slot 1 → Barracks
- Slot 2 → Archery Range
- Slot 3 → Chapel
- Slot 4 → Tavern
- Slot 5 → Forge
- Slot 6 → Command Hall

Asset contract for human faction castle overlays:

- Base: `public/assets/castles/faction01/castle_base.png`
- Overlay folder: `public/assets/castles/faction01/buildings/`
- Expected transparent PNG overlays:
  - `barracks.png`
  - `archery_range.png`
  - `chapel.png`
  - `tavern.png`
  - `forge.png`
  - `command_hall.png`

All overlays must align with the base castle perspective and remain isolated PNG layers for slot-based placement.
Runtime enforcement rule: overlay assets that are near full base-canvas dimensions are treated as contract violations and must trigger explicit warnings (no silent magic auto-scaling).

## Castle Interaction Flow
- Click castle keep/base to open **Build Panel**.
- Click a built building overlay to open **Building Panel**.
- Building slots are anchor-only and remain invisible until a building exists.
- Current faction MVP castle layout uses a maximum of **6 anchor slots** as a stable placement contract for both placeholders and future transparent PNG building overlays.
- Castle layout anchors are authored around terrace slot metadata (`slotCenterX/Y`, `buildAnchorX/Y`, slot-level scale), with normalized (`anchorX`, `anchorY`) retained for interaction zoning.
- Human layout uses build-anchor + sprite-footpoint placement as the active runtime contract (default footpoint origin `0.5, 0.95`).
- Build Panel is the construction entry point and immediately marks a selected building as built in runtime state (placeholder-only logic for now).
- Current human-faction Build Panel/runtime exposes the full finalized MVP building set: **Barracks, Archery Range, Chapel, Tavern, Forge, Command Hall**.
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


### Castle Screen Layout Contract

Rendering contract (permanent):

- Castle base rendering uses **contain/full-frame scaling** (`Math.min(...)`) to preserve original aspect ratio.
- Castle illustration is always centered within playable castle bounds.
- Castle artwork is never cropped; letterboxing is explicitly acceptable when viewport ratio differs.
- Contract goal: towers, walls, and courtyard always remain fully visible across screen sizes/factions.

Interaction zone split:

- Castle screen is split by a layout-defined boundary into two zones.
- **Above boundary (structure zone):** construction intent (open Build Panel / construct via empty slots).
- **Below boundary (courtyard zone):** interaction with existing buildings (upgrade/recruit/open building panel).

Courtyard boundary:

- Canonical source: `courtyardBoundaryY` in `src/data/factions/human/castle_layout.json`.
- Value is normalized (0..1) over castle base height and currently set to `0.72`.
- Renderer clamps boundary safely and uses it for click routing.

Castle composition grid (art contract):

- Target aspect ratio: **16:9 landscape**.
- Recommended base resolution: **1920×1080 or higher**.
- Zone guidance:
  - Top ~30%: sky + tower silhouettes.
  - Middle ~45%: castle mass + building slot region.
  - Bottom ~25%: open courtyard gameplay area.

Building slot zone and anchor mapping:

- Mid/lower castle space must preserve readable room for overlay anchors.
- Stable slot mapping remains:
  1. Barracks
  2. Archery Range
  3. Chapel
  4. Tavern
  5. Forge
  6. Command Hall
- Slot placement is driven by `castle_layout.json` anchors (`anchorX`, `anchorY`, `z`).

Art safe margins:

- Recommended framing margins for all future castle base artwork:
  - top 5%
  - left 5%
  - right 5%
  - bottom 8–10%
- Important structures must not touch frame edges.

AI generation rule for future castle base prompts:

- “The castle must be fully visible within the frame.
  Leave safe margins around all edges.
  The lower part of the image must contain an open courtyard area for gameplay interactions.
  The mid section must contain clear areas for building overlays.
  No important structures should touch the frame edges.”
