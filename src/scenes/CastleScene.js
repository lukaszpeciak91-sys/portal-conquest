import Phaser from 'phaser';
import { SCENES, SceneRouter } from '../SceneRouter';
import { syncSceneState } from '../state/sceneState';
import assetManifest, { loadAssetsFromManifest } from '../assets/loadAssetsFromManifest';
import { addFallbackPlaceholder, textureExists } from '../assets/safeTexture';
import humanCastleLayout from '../data/factions/human/castle_layout.json';
import humanBuildingSet from '../data/buildings/human_buildings.json';
import { GameState } from '../state/GameState';
import { setBuildingLevel } from '../state/runtimeState';

const MIN_VALID_VIEWPORT_SIDE = 64;
const MIN_VALID_PLAYABLE_HEIGHT = 120;
const BUILD_GLOW_DURATION_MS = 720;
const BUILD_GLOW_TEXTURE_KEY = 'castle-build-glow';
const DEFAULT_COURTYARD_BOUNDARY_Y = 0.72;
const FINALIZED_MVP_BUILDING_IDS = [
  'barracks',
  'archery_range',
  'chapel',
  'tavern',
  'forge',
  'command_hall',
];
const BUILDING_LAYOUTS = {
  human_castle_layout: humanCastleLayout,
};
const BUILDING_SETS = {
  human_buildings: humanBuildingSet,
};

export class CastleScene extends Phaser.Scene {
  constructor() {
    super(SCENES.CASTLE);
  }

  preload() {
    loadAssetsFromManifest(this, assetManifest.castles);
  }

  create() {
    syncSceneState(this.scene.key);
    this.router = new SceneRouter(this);

    const viewport = this.getSafeViewportSize({ width: this.scale.width, height: this.scale.height })
      ?? { width: 1280, height: 720 };

    this.initializeLayerStack();
    this.missingBuildingAssetWarnings = new Set();
    this.pendingBuildGlowById = null;
    this.debugEnabled = Boolean(window.gameUi?.isDebugEnabled?.() ?? false);
    this.renderCastleLayers(viewport.width, viewport.height);

    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this);
      window.removeEventListener('portal:castle-build', this.handleBuildSelection);
    });

    if (typeof window !== 'undefined') {
      window.gameUi?.resetMapUi?.();
      window.gameUi?.setMode?.('castle');
    }

    this.handleBuildSelection = (event) => {
      const buildingId = event?.detail?.buildingId;
      if (!buildingId) {
        return;
      }

      const didBuild = this.buildBuilding(buildingId);
      if (!didBuild) {
        return;
      }

      this.pendingBuildGlowById = buildingId;

      const currentViewport = this.getSafeViewportSize({ width: this.scale.width, height: this.scale.height })
        ?? { width: this.scale.width, height: this.scale.height };
      this.renderCastleLayers(currentViewport.width, currentViewport.height);
      this.openBuildPanel();
    };

    window.addEventListener('portal:castle-build', this.handleBuildSelection);

    this.input.keyboard.on('keydown-M', () => this.router.goTo(SCENES.MAP));
  }

  initializeLayerStack() {
    this.castleLayerRoot = this.add.container(0, 0).setDepth(0);

    this.baseLayer = this.add.container(0, 0);
    this.buildingLayer = this.add.container(0, 0);
    this.decorLayer = this.add.container(0, 0);

    this.castleLayerRoot.add([this.baseLayer, this.buildingLayer, this.decorLayer]);
  }

  setDebugEnabled(enabled) {
    this.debugEnabled = Boolean(enabled);
    const currentViewport = this.getSafeViewportSize({ width: this.scale.width, height: this.scale.height })
      ?? { width: this.scale.width, height: this.scale.height };
    this.renderCastleLayers(currentViewport.width, currentViewport.height);
  }

  getCastleRenderContext() {
    const faction = GameState.data.faction;
    const castle = faction?.castle;
    const layout = BUILDING_LAYOUTS[castle?.layoutId];
    const buildingSet = BUILDING_SETS[castle?.buildingSetId];
    const runtimeBuildings = GameState.buildings?.[faction?.id] ?? {};

    return {
      faction,
      castle,
      layout,
      buildingSet,
      runtimeBuildings,
    };
  }

  getSafeViewportSize(gameSize) {
    const widthCandidate = gameSize?.width ?? this.scale.width;
    const heightCandidate = gameSize?.height ?? this.scale.height;
    const width = Number.isFinite(widthCandidate) ? widthCandidate : this.scale.width;
    const height = Number.isFinite(heightCandidate) ? heightCandidate : this.scale.height;

    if (width < MIN_VALID_VIEWPORT_SIDE || height < MIN_VALID_VIEWPORT_SIDE) {
      if (this.lastGoodViewport?.width >= MIN_VALID_VIEWPORT_SIDE && this.lastGoodViewport?.height >= MIN_VALID_VIEWPORT_SIDE) {
        return this.lastGoodViewport;
      }

      return null;
    }

    this.lastGoodViewport = { width, height };
    return this.lastGoodViewport;
  }

  getBuildPanelEntries(buildingSet, runtimeBuildings) {
    return this.getBuildableBuildingDefinitions(buildingSet).map((buildingDefinition) => ({
      buildingId: buildingDefinition.buildingId,
      label: String(buildingDefinition.buildingId ?? 'building').replace(/[_-]/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
      built: Number.isFinite(runtimeBuildings?.[buildingDefinition.buildingId]) && runtimeBuildings[buildingDefinition.buildingId] > 0,
    }));
  }

  getBuildableBuildingDefinitions(buildingSet) {
    const definitionsById = new Map((buildingSet?.buildings ?? []).map((definition) => [definition.buildingId, definition]));

    return FINALIZED_MVP_BUILDING_IDS.flatMap((buildingId) => {
      const definition = definitionsById.get(buildingId);
      if (definition) {
        return [definition];
      }

      if (!this.missingBuildingAssetWarnings.has(`missing-definition:${buildingId}`)) {
        this.missingBuildingAssetWarnings.add(`missing-definition:${buildingId}`);
        console.warn(`Missing castle building definition: ${buildingId}`);
      }

      return [];
    });
  }

  openBuildPanel() {
    const { buildingSet, runtimeBuildings } = this.getCastleRenderContext();
    const entries = this.getBuildPanelEntries(buildingSet, runtimeBuildings);

    window.gameUi?.openCastlePanel?.('build', {
      title: 'Build Panel',
      body: 'Select a structure to place a placeholder build in its castle slot.',
      buildings: entries,
    });
  }

  buildBuilding(buildingId) {
    const { faction, buildingSet, runtimeBuildings } = this.getCastleRenderContext();
    const definition = this.getBuildableBuildingDefinitions(buildingSet).find((entry) => entry.buildingId === buildingId);
    if (!definition) {
      return false;
    }

    if (Number.isFinite(runtimeBuildings?.[buildingId]) && runtimeBuildings[buildingId] > 0) {
      return false;
    }

    return setBuildingLevel({
      factionId: faction?.id,
      buildingId,
      level: 1,
    });
  }

  openBuildingPanel(buildingId, level) {
    const label = String(buildingId ?? 'building').replace(/[_-]/g, ' ').toUpperCase();

    window.gameUi?.openCastlePanel?.('building', {
      title: 'Building Panel',
      body: `${label} Level ${level}`,
    });
  }

  clearLayer(layerContainer) {
    layerContainer?.removeAll(true);
  }

  renderBaseLayer(viewportWidth, viewportHeight, baseKey, onClickCastle) {
    const hasBaseTexture = textureExists(this, baseKey);

    if (hasBaseTexture) {
      const renderBounds = this.getCastleRenderBounds(viewportWidth, viewportHeight);
      const source = this.textures.get(baseKey).getSourceImage();
      const imageWidth = source.width || viewportWidth;
      const imageHeight = source.height || viewportHeight;
      const scale = Math.min(renderBounds.width / imageWidth, renderBounds.height / imageHeight);
      const centerX = renderBounds.centerX;
      const centerY = renderBounds.centerY;

      const baseImage = this.add.image(centerX, centerY, baseKey)
        .setOrigin(0.5)
        .setScale(scale)
        .setInteractive({ useHandCursor: true });

      if (onClickCastle) {
        baseImage.on('pointerdown', onClickCastle);
      }

      this.currentCastleTransform = {
        sourceWidth: imageWidth,
        sourceHeight: imageHeight,
        renderedWidth: baseImage.displayWidth,
        renderedHeight: baseImage.displayHeight,
        scale: baseImage.scaleX,
        centerX: baseImage.x,
        centerY: baseImage.y,
      };

      this.baseLayer.add(baseImage);
      return;
    }

    const fallbackBackground = this.add.rectangle(viewportWidth / 2, viewportHeight / 2, viewportWidth, viewportHeight, 0x101828);
    const fallbackPlaceholder = addFallbackPlaceholder(this, {
      x: viewportWidth / 2,
      y: viewportHeight / 2,
      width: Math.max(120, Math.min(320, viewportWidth - 48)),
      height: 140,
      label: `missing asset\n${baseKey}`,
      depth: 1,
    });

    this.baseLayer.add([fallbackBackground, fallbackPlaceholder]);
    this.currentCastleTransform = null;
  }

  getCourtyardBoundaryY(layout) {
    const boundary = Number.isFinite(layout?.courtyardBoundaryY)
      ? layout.courtyardBoundaryY
      : DEFAULT_COURTYARD_BOUNDARY_Y;

    return Phaser.Math.Clamp(boundary, 0, 1);
  }

  isInCourtyardByAnchor(anchorLike, layout) {
    if (!Number.isFinite(anchorLike?.anchorY)) {
      return true;
    }

    return anchorLike.anchorY >= this.getCourtyardBoundaryY(layout);
  }

  getPointerCastleNormalizedY(pointer) {
    if (!this.currentCastleTransform) {
      return null;
    }

    const topY = this.currentCastleTransform.centerY - (this.currentCastleTransform.renderedHeight / 2);
    const localY = pointer.worldY - topY;
    const normalizedY = localY / this.currentCastleTransform.renderedHeight;
    return Phaser.Math.Clamp(normalizedY, 0, 1);
  }

  getLayoutSlots(layout, buildingSet) {
    const hasFinalizedSlots = Array.isArray(layout?.slots) && layout.slots.length > 0;
    if (hasFinalizedSlots) {
      return layout.slots.map((slot, index) => ({
        slotId: slot.slotId,
        buildingId: slot.buildingId,
        anchorX: slot.anchorX,
        anchorY: slot.anchorY,
        pixelX: slot.pixelX,
        pixelY: slot.pixelY,
        z: Number.isFinite(slot?.z) ? slot.z : Math.round((slot?.anchorY ?? 0) * 100) + index,
      }));
    }

    const slotToBuilding = new Map((buildingSet?.buildings ?? []).map((building) => [building.slotId, building.buildingId]));
    return (layout?.anchors ?? []).map((anchor) => ({
      ...anchor,
      buildingId: slotToBuilding.get(anchor.slotId),
      z: Number.isFinite(anchor?.z) ? anchor.z : Math.round((anchor?.anchorY ?? 0) * 100),
    }));
  }

  createConstructionSlotHotspots({ layout, runtimeBuildings, buildingSet, onClickConstruct }) {
    const builtBuildingIds = new Set(
      this.getBuildableBuildingDefinitions(buildingSet)
        .filter((buildingDefinition) => Number.isFinite(runtimeBuildings?.[buildingDefinition.buildingId]) && runtimeBuildings[buildingDefinition.buildingId] > 0)
        .map((buildingDefinition) => buildingDefinition.buildingId),
    );
    const baseScale = this.currentCastleTransform?.scale ?? 1;

    this.getLayoutSlots(layout, buildingSet).forEach((slot) => {
      const isBuilt = slot.buildingId ? builtBuildingIds.has(slot.buildingId) : false;
      if (isBuilt || this.isInCourtyardByAnchor(slot, layout)) {
        return;
      }

      const { x, y } = this.getAnchorWorldPosition(slot, layout);
      const hotspotRadius = Math.max(24, 52 * baseScale);
      const hotspot = this.add.circle(x, y, hotspotRadius, 0xffffff, 0.001)
        .setDepth((slot.z ?? 0) + 0.1)
        .setInteractive({ useHandCursor: true });

      hotspot.on('pointerdown', onClickConstruct);
      this.decorLayer.add(hotspot);
    });
  }

  renderBuildingPlaceholder({ x, y, z, buildingId, level, baseScale }) {
    const markerWidth = Math.max(72, 96 * baseScale);
    const markerHeight = Math.max(34, 44 * baseScale);
    const marker = this.add.container(x, y).setDepth(z);

    const plate = this.add.rectangle(0, -(markerHeight * 0.55), markerWidth, markerHeight, 0x1e293b, 0.82)
      .setStrokeStyle(1, 0x93c5fd, 0.8)
      .setOrigin(0.5);
    const label = this.add.text(0, -(markerHeight * 0.55), `${buildingId.toUpperCase()} L${level}`, {
      color: '#dbeafe',
      fontFamily: 'Arial',
      fontSize: `${Math.max(10, 11 * baseScale)}px`,
      align: 'center',
    }).setOrigin(0.5);

    marker.add([plate, label]);
    this.buildingLayer.add(marker);
  }

  createBuildGlowTexture() {
    if (textureExists(this, BUILD_GLOW_TEXTURE_KEY)) {
      return;
    }

    const radius = 120;
    const diameter = radius * 2;
    const graphics = this.make.graphics({ x: 0, y: 0, add: false });

    for (let i = 12; i >= 1; i -= 1) {
      const normalized = i / 12;
      const alpha = 0.045 * normalized;
      const ringRadius = radius * normalized;
      graphics.fillStyle(0xffd56b, alpha);
      graphics.fillCircle(radius, radius, ringRadius);
    }

    graphics.generateTexture(BUILD_GLOW_TEXTURE_KEY, diameter, diameter);
    graphics.destroy();
  }

  renderBuildGlow({ x, y, z, scale }) {
    this.createBuildGlowTexture();

    if (!textureExists(this, BUILD_GLOW_TEXTURE_KEY)) {
      return;
    }

    const glow = this.add.image(x, y, BUILD_GLOW_TEXTURE_KEY)
      .setOrigin(0.5, 0.74)
      .setScale(Math.max(0.4, scale * 0.82))
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(z - 0.5);

    this.buildingLayer.add(glow);

    this.tweens.timeline({
      targets: glow,
      tweens: [
        {
          alpha: 0.35,
          scaleX: glow.scaleX * 0.92,
          scaleY: glow.scaleY * 0.92,
          duration: Math.round(BUILD_GLOW_DURATION_MS * 0.3),
          ease: 'Sine.Out',
        },
        {
          alpha: 0.82,
          scaleX: glow.scaleX * 1,
          scaleY: glow.scaleY * 1,
          duration: Math.round(BUILD_GLOW_DURATION_MS * 0.3),
          ease: 'Sine.InOut',
        },
        {
          alpha: 0,
          scaleX: glow.scaleX * 1.22,
          scaleY: glow.scaleY * 1.22,
          duration: Math.round(BUILD_GLOW_DURATION_MS * 0.4),
          ease: 'Sine.In',
        },
      ],
      onComplete: () => {
        glow.destroy();
      },
    });
  }

  renderDebugSlotMarker({ x, y, slotId, pixelX, pixelY, z, scale, layout }) {
    if (!this.debugEnabled) {
      return;
    }

    const size = Math.max(12, 18 * scale);
    const marker = this.add.container(x, y).setDepth(z + 0.25);
    const ring = this.add.circle(0, 0, size, 0x38bdf8, 0.22).setStrokeStyle(1, 0x7dd3fc, 0.9);
    const slotLabel = Number.isFinite(pixelX) && Number.isFinite(pixelY)
      ? `${slotId} (${pixelX}, ${pixelY})`
      : String(slotId);
    const label = this.add.text(0, -size - 8, slotLabel, {
      color: '#e0f2fe',
      fontFamily: 'Arial',
      fontSize: `${Math.max(10, 10 * scale)}px`,
    }).setOrigin(0.5, 1);

    marker.add([ring, label]);

    if (Number.isFinite(pixelX) && Number.isFinite(pixelY)) {
      const pixelReference = this.getAnchorWorldPosition({ x: pixelX, y: pixelY }, layout, { allowPixelFallback: true });
      const crosshair = this.add.rectangle(pixelReference.x, pixelReference.y, Math.max(4, 6 * scale), Math.max(4, 6 * scale), 0xf97316, 0.7)
        .setDepth(z + 0.24)
        .setOrigin(0.5);
      this.decorLayer.add(crosshair);
    }

    this.decorLayer.add(marker);
  }

  getAnchorWorldPosition(anchorLike, layout, options = {}) {
    const transform = this.currentCastleTransform;
    const hasNormalizedAnchor = Number.isFinite(anchorLike?.anchorX)
      && Number.isFinite(anchorLike?.anchorY);

    if (transform && hasNormalizedAnchor) {
      return {
        x: transform.centerX + ((anchorLike.anchorX - 0.5) * transform.renderedWidth),
        y: transform.centerY + ((anchorLike.anchorY - 0.5) * transform.renderedHeight),
      };
    }

    if (transform && options.allowPixelFallback && Number.isFinite(anchorLike?.x) && Number.isFinite(anchorLike?.y)) {
      const baseWidth = Number.isFinite(layout?.baseWidth)
        ? layout.baseWidth
        : Number.isFinite(layout?.baseSize?.width)
          ? layout.baseSize.width
          : transform.sourceWidth;
      const baseHeight = Number.isFinite(layout?.baseHeight)
        ? layout.baseHeight
        : Number.isFinite(layout?.baseSize?.height)
          ? layout.baseSize.height
          : transform.sourceHeight;
      const normalizedX = baseWidth > 0 ? anchorLike.x / baseWidth : 0;
      const normalizedY = baseHeight > 0 ? anchorLike.y / baseHeight : 0;

      return {
        x: transform.centerX + ((normalizedX - 0.5) * transform.renderedWidth),
        y: transform.centerY + ((normalizedY - 0.5) * transform.renderedHeight),
      };
    }

    return {
      x: options.allowPixelFallback ? (anchorLike?.x ?? 0) : 0,
      y: options.allowPixelFallback ? (anchorLike?.y ?? 0) : 0,
    };
  }

  renderBuildingLayer({ layout, buildingSet, runtimeBuildings, onClickBuilding }) {
    const layoutDefaultBuildingScale = Number.isFinite(layout?.defaultBuildingScale)
      ? layout.defaultBuildingScale
      : 1;
    const layoutSlots = this.getLayoutSlots(layout, buildingSet);
    const slotByBuildingId = new Map(layoutSlots.map((slot) => [slot.buildingId, slot]));

    layoutSlots.forEach((slot) => {
      const baseScale = this.currentCastleTransform?.scale ?? 1;
      const { x, y } = this.getAnchorWorldPosition(slot, layout);

      this.renderDebugSlotMarker({
        x,
        y,
        slotId: slot.slotId,
        pixelX: slot.pixelX,
        pixelY: slot.pixelY,
        z: slot.z ?? 0,
        scale: layoutDefaultBuildingScale * baseScale,
        layout,
      });
    });

    const placedBuildings = this.getBuildableBuildingDefinitions(buildingSet)
      .map((buildingDefinition) => ({
        definition: buildingDefinition,
        level: runtimeBuildings?.[buildingDefinition.buildingId],
        anchor: slotByBuildingId.get(buildingDefinition.buildingId),
      }))
      .filter(({ level, anchor }) => Number.isFinite(level) && level > 0 && anchor)
      .map(({ definition, level, anchor }) => {
        const levelDefinition = definition.levels.find((entry) => entry.level === level) ?? definition.levels[0] ?? null;
        const levelScaleOverride = Number.isFinite(levelDefinition?.scale)
          ? levelDefinition.scale
          : null;
        const buildingScale = levelScaleOverride ?? layoutDefaultBuildingScale;

        return {
          buildingId: definition.buildingId,
          anchorX: anchor.anchorX,
          anchorY: anchor.anchorY,
          x: anchor.x,
          y: anchor.y,
          z: anchor.z ?? 0,
          scale: buildingScale,
          assetKey: levelDefinition?.assetKey ?? null,
          level,
        };
      })
      .sort((a, b) => a.z - b.z);

    placedBuildings.forEach((building) => {
      const baseScale = this.currentCastleTransform?.scale ?? 1;
      const { x, y } = this.getAnchorWorldPosition(building, layout);

      if (building.assetKey && textureExists(this, building.assetKey)) {
        const interactiveBuilding = this.isInCourtyardByAnchor(building, layout);
        const sprite = this.add.image(x, y, building.assetKey)
          .setOrigin(0.5, 1)
          .setScale(building.scale * baseScale)
          .setDepth(building.z);

        if (interactiveBuilding) {
          sprite.setInteractive({ useHandCursor: true });
        }

        if (this.pendingBuildGlowById === building.buildingId) {
          this.renderBuildGlow({
            x,
            y,
            z: building.z,
            scale: building.scale * baseScale,
          });
        }

        if (interactiveBuilding && onClickBuilding) {
          sprite.on('pointerdown', () => onClickBuilding(building));
        }

        this.buildingLayer.add(sprite);
        return;
      }

      if (!this.missingBuildingAssetWarnings.has(building.buildingId)) {
        this.missingBuildingAssetWarnings.add(building.buildingId);
        console.warn(`Missing castle building asset: ${building.buildingId}.png`);
      }

      this.renderBuildingPlaceholder({
        x,
        y,
        z: building.z,
        buildingId: building.buildingId,
        level: building.level,
        baseScale,
      });
    });

    this.pendingBuildGlowById = null;
  }

  getCastleRenderBounds(viewportWidth, viewportHeight) {
    const rootStyle = typeof window !== 'undefined'
      ? getComputedStyle(document.documentElement)
      : null;

    const toNumber = (value) => {
      const parsed = Number.parseFloat(value ?? '0');
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const topInset = toNumber(rootStyle?.getPropertyValue('--safe-top'));
    const bottomInset = toNumber(rootStyle?.getPropertyValue('--safe-bottom'));
    const topBarHeightVar = toNumber(rootStyle?.getPropertyValue('--top-bar-height'));
    const bottomBarHeightVar = toNumber(rootStyle?.getPropertyValue('--bottom-bar-height'));

    const topBarRect = typeof document !== 'undefined'
      ? document.querySelector('.top-bar')?.getBoundingClientRect?.() ?? null
      : null;
    const bottomBarRect = typeof document !== 'undefined'
      ? document.querySelector('.bottom-mode-bar')?.getBoundingClientRect?.() ?? null
      : null;
    const gameContainerRect = typeof document !== 'undefined'
      ? document.querySelector('#game-container')?.getBoundingClientRect?.() ?? null
      : null;

    const relativeTopBarBottom = topBarRect && gameContainerRect
      ? Math.max(0, topBarRect.bottom - gameContainerRect.top)
      : null;
    const relativeBottomBarTop = bottomBarRect && gameContainerRect
      ? Math.max(0, bottomBarRect.top - gameContainerRect.top)
      : null;

    const fallbackTop = Phaser.Math.Clamp(topInset + topBarHeightVar, 0, Math.max(0, viewportHeight - 1));
    const fallbackBottom = Phaser.Math.Clamp(viewportHeight - (bottomInset + bottomBarHeightVar), fallbackTop + 1, viewportHeight);

    const topCandidate = Number.isFinite(relativeTopBarBottom) ? relativeTopBarBottom : fallbackTop;
    const bottomCandidate = Number.isFinite(relativeBottomBarTop) ? relativeBottomBarTop : fallbackBottom;

    const top = Phaser.Math.Clamp(topCandidate, 0, Math.max(0, viewportHeight - 1));
    const bottom = Phaser.Math.Clamp(bottomCandidate, top + 1, viewportHeight);
    const height = Math.max(MIN_VALID_PLAYABLE_HEIGHT, bottom - top);
    const width = Math.max(MIN_VALID_VIEWPORT_SIDE, viewportWidth);

    return {
      x: 0,
      y: top,
      width,
      height: Math.max(1, height),
      centerX: width / 2,
      centerY: top + (height / 2),
    };
  }

  renderCastleLayers(viewportWidth, viewportHeight) {
    this.clearLayer(this.baseLayer);
    this.clearLayer(this.buildingLayer);
    this.clearLayer(this.decorLayer);

    const { castle, layout, buildingSet, runtimeBuildings } = this.getCastleRenderContext();
    const baseKey = castle?.baseKey ?? 'castle_faction01_base';

    this.renderBaseLayer(viewportWidth, viewportHeight, baseKey, (pointer) => {
      const pointerCastleY = this.getPointerCastleNormalizedY(pointer);
      if (!Number.isFinite(pointerCastleY)) {
        return;
      }

      if (pointerCastleY < this.getCourtyardBoundaryY(layout)) {
        this.openBuildPanel();
      }
    });
    this.renderBuildingLayer({
      layout,
      buildingSet,
      runtimeBuildings,
      onClickBuilding: (building) => this.openBuildingPanel(building.buildingId, building.level),
    });
    this.createConstructionSlotHotspots({
      layout,
      runtimeBuildings,
      buildingSet,
      onClickConstruct: () => this.openBuildPanel(),
    });
  }

  handleResize(gameSize) {
    const viewport = this.getSafeViewportSize(gameSize);
    if (!viewport) {
      return;
    }

    const camera = this.cameras?.main;
    if (camera) {
      camera.setViewport(0, 0, viewport.width, viewport.height);
      camera.setSize(viewport.width, viewport.height);
      camera.setBounds(0, 0, viewport.width, viewport.height);
      camera.centerOn(viewport.width / 2, viewport.height / 2);
      camera.preRender();
    }

    this.renderCastleLayers(viewport.width, viewport.height);
    console.log(`[CastleScene] resize ${viewport.width}x${viewport.height}`);
  }
}
