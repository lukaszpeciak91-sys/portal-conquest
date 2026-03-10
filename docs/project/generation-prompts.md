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

## Castle Base Prompt Template

Use this template to generate the foundational castle scene that later receives building overlays.

Target file in pipeline: `castle_base.png`

```text
Create a 2D dark fantasy castle settlement base illustration for a strategy game town screen.

Purpose:
- This image is the base layer only
- Individual buildings will be added later as separate overlay assets

Technical constraints:
- Landscape-oriented composition optimized for game UI readability
- Maintain a stable perspective that can be reused by future building overlays
- Reserve clear visual space and construction slots for future structures

Composition rules:
- Show terrain, walls, cliffs, courtyards, foundations, and environmental storytelling elements
- Leave intentional empty build areas where structures can appear later
- Do not overfill the scene with permanent architecture
- Keep focal balance so UI can sit on top without obscuring critical scene readability

Art direction:
- Dark fantasy tone inspired by classic strategy aesthetics (Heroes III / Disciples II spirit)
- Semi-painterly rendering, medium detail
- Strong silhouette readability, atmospheric but gameplay-friendly
- No photorealism, no excessive visual noise

Output requirements:
- Final image intended as `castle_base.png`
- No text, no icons, no logos, no watermark, no embedded UI
- Keep lighting and color mood consistent with a corrupted dark fantasy world
```

---

## Castle Building Overlay Prompt Template

Use this template for structures placed on top of `castle_base.png`.

Example output names:
- `barracks_lv1.png`
- `tavern_lv1.png`
- `temple_lv1.png`
- `mage_tower_lv1.png`

```text
Create a single isolated 2D dark fantasy building asset for a castle-town interface in a strategy game.

Building target:
- [INSERT BUILDING TYPE, e.g. Barracks Level 1 / Tavern Level 1 / Temple Level 1]

Integration constraints:
- Asset will be overlaid on top of an existing castle base illustration
- Use the same camera angle and perspective as the base scene
- Structure must be positioned and designed to sit naturally on a predefined base slot
- Keep silhouette clear and recognizable at gameplay viewing size

Technical output requirements:
- Transparent PNG background (alpha channel required)
- No sky, no terrain plate, no frame, no backdrop
- Isolated building only
- Clean edges for layering in-engine

Art direction:
- Dark fantasy architecture consistent with the castle base
- Semi-painterly style, medium detail, readable forms
- Avoid photorealistic rendering and over-textured noise
- Color and lighting should match a moody corrupted fantasy world

Negative constraints:
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
