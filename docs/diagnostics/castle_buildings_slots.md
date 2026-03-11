# Castle Building Slot Rendering — Diagnostic

## 1) Where castle building slots are defined

- **Layout anchors (slot coordinates)** are defined in:
  - `src/data/factions/human/castle_layout.json`
- **Building-to-slot mapping** is defined in:
  - `src/data/buildings/human_buildings.json`
- The active faction points to both via:
  - `src/data/factions/faction01.json` (`layoutId`, `buildingSetId`)

### Slot structure

```json
{
  "layoutId": "human_castle_layout",
  "anchors": [
    { "slotId": "LEFT_FOREGROUND", "x": 404, "y": 760, "scale": 1, "z": 24 },
    { "slotId": "CENTER_FOREGROUND", "x": 768, "y": 804, "scale": 1.04, "z": 28 },
    { "slotId": "RIGHT_FOREGROUND", "x": 1132, "y": 758, "scale": 1, "z": 24 }
  ]
}
```

### Building-to-slot structure

```json
{
  "buildingId": "barracks",
  "slotId": "LEFT_FOREGROUND",
  "levels": [{ "level": 1, "assetKey": "castle_human_barracks_lvl1" }]
}
```

---

## 2) Slot coordinates used

From `castle_layout.json`, coordinates are absolute anchor points in the castle-layout coordinate space:

- `TOP_CENTER`: `(768, 520)`
- `LEFT_MID`: `(520, 620)`
- `RIGHT_MID`: `(1018, 610)`
- `LEFT_FOREGROUND`: `(404, 760)`
- `RIGHT_FOREGROUND`: `(1132, 758)`
- `CENTER_FOREGROUND`: `(768, 804)`

They are transformed at render time by `currentCastleTransform`:

- `screenX = topLeftX + (anchor.x * baseScale)`
- `screenY = topLeftY + (anchor.y * baseScale)`

---

## 3) File that renders building overlays in CastleScene

- `src/scenes/CastleScene.js`
- Method: `renderBuildingLayer(...)`

---

## 4) Does rendering reference slots or fixed coordinate?

It **does reference the slot system**. Buildings are joined to anchors via:

- `anchorBySlotId.get(buildingDefinition.slotId)`

This is not hardcoded to a single fixed coordinate.

---

## 5) Exact spawn code for buildings

```js
placedBuildings.forEach((building) => {
  const baseScale = this.currentCastleTransform?.scale ?? 1;
  const x = this.currentCastleTransform
    ? this.currentCastleTransform.topLeftX + (building.x * baseScale)
    : building.x;
  const y = this.currentCastleTransform
    ? this.currentCastleTransform.topLeftY + (building.y * baseScale)
    : building.y;

  if (building.assetKey && textureExists(this, building.assetKey)) {
    const sprite = this.add.image(x, y, building.assetKey)
      .setOrigin(0.5, 1)
      .setScale(building.scale * baseScale)
      .setDepth(building.z)
      .setInteractive({ useHandCursor: true });

    this.buildingLayer.add(sprite);
    return;
  }
  ...
});
```

---

## 6) How buildings are added

- Buildings are created with **`scene.add.image`** (`this.add.image(...)`).
- Then added to a **container layer** (`this.buildingLayer.add(sprite)`).
- They are **not** created with `scene.add.sprite`.

---

## 7) Origin used

- Explicit origin is set to: **`(0.5, 1)`** (bottom-center), not Phaser default center `(0.5, 0.5)`.

---

## 8) Scaling at create time

- Yes. Each building uses:
  - `.setScale(building.scale * baseScale)`
- Where:
  - `building.scale` comes from anchor scale in layout JSON.
  - `baseScale` comes from base castle image fit transform.

---

## 9) If slot coordinates exist, why not used?

They **are used** in the renderer.

### Root-cause hypothesis (most likely)

Given the code path, overlap is unlikely to be caused by missing slot usage. A more likely cause is **asset framing**:

- Building textures (`barracks.png`, `tavern.png`, `chapel.png`) are loaded as full standalone images.
- If those PNGs share a large/full-canvas frame (e.g., same 1536×1024 canvas) and each building graphic is positioned similarly inside that canvas, then placing each at different slot anchors with bottom-center origin can still make their visible content appear stacked/overlapping.

In short: **slot mapping is present and active; overlap likely comes from how building PNG content is authored/aligned inside each texture, not from slot lookup being ignored.**
