# Portal Conquest — Generation Prompt Library

This document centralizes reusable prompt templates for AI-generated visual assets used in **Portal Conquest**.

The templates are designed to keep output stylistically consistent and technically compatible with the game pipeline. They are written to be copied directly into image generation workflows and adapted with project-specific variations.

---

## Map Background Prompt Template

Use this template for world map background generation.

```text
Create a 2D dark fantasy world map background for a node-based exploration strategy game.

Technical constraints:
- Landscape orientation
- 16:9 aspect ratio
- Final output intended for gameplay map backdrop
- Composition must support node placement and path readability

Composition and layout rules:
- Design broad open spaces where exploration nodes can be placed
- Favor natural terrain flow and readable region separation
- No visible roads dominating the composition
- Any implied paths should be subtle, organic, and non-intrusive
- Keep key map zones visually distinct for gameplay clarity

Art direction:
- Corrupted biome atmosphere (blighted forests, dead marshes, cursed plains, volcanic scars, ruined terrain)
- Dark fantasy mood, ominous but readable
- Semi-painterly style, medium detail, clean silhouettes in terrain masses
- Avoid photorealism, avoid noisy micro-detail that interferes with UI/game markers

Output requirements:
- High-quality 2D illustration
- No text labels, no UI, no logos, no watermarks
- Keep visual rhythm balanced across the full 16:9 frame
```

---

## Castle Background Prompt — Locked Asset Contract (v1.2)

Use this template to generate the foundational castle scene that later receives building overlays.

Target file in pipeline: `castle_base.png`

```text
Create a fantasy strategy game castle background.

STYLE
Dark fantasy semi-painterly illustration inspired by Heroes III and Disciples II.

FORMAT
- 16:9 landscape
- Designed for a strategy game town screen

ASSET ROLE
- Castle base image is the atmospheric background layer
- Buildings are separate gameplay elements placed later in courtyard slots
- Do not merge future building gameplay structures into the castle walls

COMPOSITION
- Top area: sky and upper castle towers
- Middle area: main castle mass as the epic faction identity
- Lower area (critical gameplay zone): open courtyard for building placement
- Position the main castle slightly higher in frame to preserve a clear foreground play zone
- The lower 25–35% of the image must stay readable as an open courtyard
- Courtyard surface should be neutral and buildable (stone courtyard, dirt yard, plaza)
- Courtyard must remain uncluttered and support readable placement of 6 building slots
- No foreground objects blocking build placement areas
- No characters, no UI, no text

ART DIRECTION
- Epic dark fantasy atmosphere, gameplay-readable first
- Semi-painterly rendering, medium detail, strong silhouettes
- Avoid photorealism and noisy micro-detail
- Keep visual hierarchy clear so castle identity and courtyard gameplay zone are both legible

OUTPUT
- Final image intended as `castle_base.png`
- No logos, no watermark, no embedded UI
```

---

## Castle Building Overlay Prompt Template

Use this template for structures placed on top of `castle_base.png`.

Expected faction01 MVP output names:
- `barracks.png`
- `archery_range.png`
- `chapel.png`
- `tavern.png`
- `forge.png`
- `command_hall.png`

```text
Create a strategy game building overlay asset.

STYLE
- Same visual style as the castle base

FORMAT
- Transparent background

CONTENT
- [INSERT BUILDING TYPE, e.g. Barracks Level 1 / Tavern Level 1 / Temple Level 1]
- Single building centered

ASSET ROLE
- Buildings are interactive gameplay objects placed in the castle courtyard
- Buildings are not part of the main castle structure
- The building must feel grounded on the courtyard after placement, without bringing its own environment


MVP INTEGRATION NOTE
- All six MVP castle building overlays (`barracks.png`, `archery_range.png`, `chapel.png`, `tavern.png`, `forge.png`, `command_hall.png`) must follow identical perspective, lighting, and integration rules so they align on the same `castle_base.png` scene.

INTEGRATION CONSTRAINTS
- Asset will be overlaid on top of an existing castle base illustration
- Use the same camera angle and perspective as the base scene
- Structure must be positioned and designed to sit naturally on a predefined base slot
- Keep silhouette clear and recognizable at gameplay viewing size
- Match the castle base perspective, lighting direction, and color palette

GROUND
- Only a very small base footprint is allowed

TECHNICAL OUTPUT REQUIREMENTS
- Transparent PNG background (alpha channel required)
- No sky, no full courtyard, no large terrain plate, no frame, no backdrop
- Isolated building only
- Clean edges for layering in-engine

NO
- Large terrain environment
- Full courtyard scene
- Environment background
- Sky
- No text, no labels, no logos, no watermark
- No additional characters unless explicitly requested
```

Background transparency is mandatory for all castle building overlays.

---

## Unit Illustration Prompt Template

**Placeholder**

This section will define standardized prompts for combat/unit illustrations (faction consistency, pose readability, upgrade tiers, and integration constraints) in a future update.

---

## Hero Portrait Prompt Template

**Placeholder**

This section will define standardized prompts for hero portraits (framing, expression range, faction identity, and UI crop compatibility) in a future update.

---

## Node Illustration Prompt Template

**Placeholder**

This section will define standardized prompts for map node illustrations (interactive readability, biome alignment, and icon-overlap safety) in a future update.

---

## Spell / Ability Icon Prompt Template

**Placeholder**

This section will define standardized prompts for spell and ability icons (symbol clarity, color coding, effect readability, and small-size legibility) in a future update.

---

## Global Art Style Rules

Apply these rules to every generated asset type unless a section explicitly overrides them:

- Dark fantasy tone and atmosphere
- Semi-painterly style
- Readable silhouettes
- Medium detail level
- No photorealism
- Must remain readable in real gameplay conditions (UI overlays, reduced size, quick player scanning)
