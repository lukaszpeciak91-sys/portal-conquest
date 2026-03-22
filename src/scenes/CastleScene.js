import Phaser from 'phaser';
import { SCENES, SceneRouter } from '../SceneRouter';
import { syncSceneState } from '../state/sceneState';
import assetManifest, { loadAssetsFromManifest } from '../assets/loadAssetsFromManifest';
import { addFallbackPlaceholder, textureExists } from '../assets/safeTexture';
import humanCastleLayout from '../data/factions/human/castle_layout.json';
import humanBuildingSet from '../data/buildings/human_buildings.json';
import { GameState } from '../state/GameState';
import { setBuildingLevel } from '../state/runtimeState';
import { getPlayableBounds } from './playableBounds';

const MIN_VALID_VIEWPORT_SIDE = 64;
const MIN_VALID_PLAYABLE_HEIGHT = 120;
const BUILD_GLOW_DURATION_MS = 720;
const BUILD_GLOW_TEXTURE_KEY = 'castle-build-glow';
const DEFAULT_COURTYARD_BOUNDARY_Y = 0.72;
const CASTLE_SAFE_BAND_TARGET_VIEWPORT_Y = 0.58;
const CASTLE_SAFE_BAND_FALLBACK_ANCHOR_Y = 0.6;
const DEFAULT_CASTLE_COVER_FOCUS_Y = 0.42;
const DEFAULT_BUILDING_FOOTPOINT_X = 0.5;
const DEFAULT_BUILDING_FOOTPOINT_Y = 0.95;
const HUMAN_CASTLE_FINAL_COVER_FOCUS_Y = 0.36;
const HUMAN_CASTLE_GLOBAL_FOOTPOINT_OFFSET_X = 0;
const HUMAN_CASTLE_GLOBAL_FOOTPOINT_OFFSET_Y = -8;
const HUMAN_BUILDING_GLOBAL_SCALE_MULTIPLIER = 1.08;
const FULL_CANVAS_OVERLAY_WARNING_RATIO = 0.85;
const OVERSIZED_OVERLAY_SIDE_RATIO = 0.55;
const OVERLAY_LOCAL_BOUNDS_WIDTH_MULTIPLIER = 1.75;
const OVERLAY_LOCAL_BOUNDS_HEIGHT_MULTIPLIER = 1.85;
const CASTLE_MEASUREMENT_LOG_PREFIX = '[CastleMeasurement]';
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
const CASTLE_CALIBRATION_PRESET = {
  enabled: false,
  showSlotLabels: true,
  showVisibleSourceCropBounds: true,
  backgroundFocusY: HUMAN_CASTLE_FINAL_COVER_FOCUS_Y,
  slotOffsets: {},
  buildingFootpointOffsetX: HUMAN_CASTLE_GLOBAL_FOOTPOINT_OFFSET_X,
  buildingFootpointOffsetY: HUMAN_CASTLE_GLOBAL_FOOTPOINT_OFFSET_Y,
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
    this.invalidOverlayAssetWarnings = new Set();
    this.pendingBuildGlowById = null;
    this.debugEnabled = Boolean(window.gameUi?.isDebugEnabled?.() ?? false);
    this.calibration = this.getCalibrationSettings();
    const measurementOverlayEnabled = this.debugEnabled || Boolean(window.__castleMeasureDebug);
    this.debugOptions = {
      showPlacementMarkers: measurementOverlayEnabled,
      showMeasurementOverlay: measurementOverlayEnabled,
    };
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
    this.debugSlotLayer = this.add.container(0, 0);
    this.buildingLayer = this.add.container(0, 0);
    this.decorLayer = this.add.container(0, 0);

    this.castleLayerRoot.add([this.baseLayer, this.debugSlotLayer, this.buildingLayer, this.decorLayer]);
  }

  setDebugEnabled(enabled) {
    this.debugEnabled = Boolean(enabled);
    this.calibration = this.getCalibrationSettings();
    const measurementOverlayEnabled = this.debugEnabled || Boolean(window.__castleMeasureDebug);
    this.debugOptions.showPlacementMarkers = measurementOverlayEnabled;
    this.debugOptions.showMeasurementOverlay = measurementOverlayEnabled;
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
    const { faction, layout, buildingSet, runtimeBuildings } = this.getCastleRenderContext();
    const definition = this.getBuildableBuildingDefinitions(buildingSet).find((entry) => entry.buildingId === buildingId);
    if (!definition) {
      return false;
    }

    if (Number.isFinite(runtimeBuildings?.[buildingId]) && runtimeBuildings[buildingId] > 0) {
      return false;
    }

    const didSetLevel = setBuildingLevel({
      factionId: faction?.id,
      buildingId,
      level: 1,
    });

    if (didSetLevel) {
      const targetSlot = this.getLayoutSlots(layout, buildingSet).find((slot) => slot.buildingId === buildingId);
      const updatedLevel = GameState.buildings?.[faction?.id]?.[buildingId] ?? null;

      if (buildingId === 'barracks' && targetSlot?.slotId === 'slot_1') {
        this.emitDiagnosticLog('[CastleOverlayDiagnostic] Building state after construction trigger', {
          buildingId,
          factionId: faction?.id ?? null,
          level: updatedLevel,
          built: Number.isFinite(updatedLevel) && updatedLevel > 0,
          slotId: targetSlot?.slotId ?? null,
        });
      }
    }

    return didSetLevel;
  }


  emitDiagnosticLog(label, payload) {
    console.info(label, payload);

    if (typeof window === 'undefined') {
      return;
    }

    if (!Array.isArray(window.__castleOverlayDiagnosticLogs)) {
      window.__castleOverlayDiagnosticLogs = [];
    }

    window.__castleOverlayDiagnosticLogs.push({ label, payload });
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

  getCastleSafeBandAnchorY(layout) {
    const slots = Array.isArray(layout?.slots) ? layout.slots : [];
    const buildAnchorYs = slots
      .map((slot) => slot?.buildAnchorY)
      .filter((value) => Number.isFinite(value));

    if (buildAnchorYs.length > 0) {
      const maxBaseHeight = Number.isFinite(layout?.baseHeight) && layout.baseHeight > 0
        ? layout.baseHeight
        : Number.isFinite(layout?.baseSize?.height) && layout.baseSize.height > 0
          ? layout.baseSize.height
          : null;
      if (maxBaseHeight) {
        const averageBuildAnchorY = buildAnchorYs.reduce((sum, value) => sum + value, 0) / buildAnchorYs.length;
        return Phaser.Math.Clamp(averageBuildAnchorY / maxBaseHeight, 0, 1);
      }
    }

    const normalizedAnchorYs = slots
      .map((slot) => slot?.anchorY)
      .filter((value) => Number.isFinite(value));
    if (normalizedAnchorYs.length > 0) {
      const averageNormalizedAnchorY = normalizedAnchorYs.reduce((sum, value) => sum + value, 0) / normalizedAnchorYs.length;
      return Phaser.Math.Clamp(averageNormalizedAnchorY, 0, 1);
    }

    return CASTLE_SAFE_BAND_FALLBACK_ANCHOR_Y;
  }

  getBuildingGlobalScaleMultiplier(castle) {
    if (castle?.layoutId === 'human_castle_layout') {
      return HUMAN_BUILDING_GLOBAL_SCALE_MULTIPLIER;
    }

    return 1;
  }

  getCalibrationSettings() {
    const runtimeOverride = (typeof window !== 'undefined' && window.__castleCalibration)
      ? window.__castleCalibration
      : {};

    const merged = {
      ...CASTLE_CALIBRATION_PRESET,
      ...runtimeOverride,
      slotOffsets: {
        ...CASTLE_CALIBRATION_PRESET.slotOffsets,
        ...(runtimeOverride?.slotOffsets ?? {}),
      },
    };
    const canEnable = this.debugEnabled || Boolean(import.meta.env?.DEV);
    const enabled = canEnable && Boolean(merged.enabled);

    return {
      enabled,
      showSlotLabels: merged.showSlotLabels !== false,
      showVisibleSourceCropBounds: merged.showVisibleSourceCropBounds !== false,
      backgroundFocusY: Number.isFinite(merged.backgroundFocusY)
        ? merged.backgroundFocusY
        : CASTLE_CALIBRATION_PRESET.backgroundFocusY,
      slotOffsets: merged.slotOffsets,
      buildingFootpointOffsetX: Number.isFinite(merged.buildingFootpointOffsetX)
        ? merged.buildingFootpointOffsetX
        : CASTLE_CALIBRATION_PRESET.buildingFootpointOffsetX,
      buildingFootpointOffsetY: Number.isFinite(merged.buildingFootpointOffsetY)
        ? merged.buildingFootpointOffsetY
        : CASTLE_CALIBRATION_PRESET.buildingFootpointOffsetY,
    };
  }

  getCastleCoverFocusY(layout) {
    if (this.calibration?.enabled && Number.isFinite(this.calibration?.backgroundFocusY)) {
      return Phaser.Math.Clamp(this.calibration.backgroundFocusY, 0, 1);
    }

    const layoutFocusY = layout?.coverFocusY;
    if (Number.isFinite(layoutFocusY)) {
      return Phaser.Math.Clamp(layoutFocusY, 0, 1);
    }

    return DEFAULT_CASTLE_COVER_FOCUS_Y;
  }

  renderBaseLayer(viewportWidth, viewportHeight, baseKey, layout, onClickCastle) {
    const renderBounds = this.getCastleRenderBounds(viewportWidth, viewportHeight);
    const hasBaseTexture = textureExists(this, baseKey);

    if (hasBaseTexture) {
      const source = this.textures.get(baseKey).getSourceImage();
      const imageWidth = source.width || viewportWidth;
      const imageHeight = source.height || viewportHeight;
      const scale = Math.max(renderBounds.width / imageWidth, renderBounds.height / imageHeight);
      const renderedWidth = imageWidth * scale;
      const visibleHeight = renderBounds.height / scale;
      const focusY = this.getCastleCoverFocusY(layout);
      const unclampedCropTop = (focusY * imageHeight) - (visibleHeight / 2);
      const maxCropTop = Math.max(0, imageHeight - visibleHeight);
      const cropTop = Phaser.Math.Clamp(unclampedCropTop, 0, maxCropTop);
      const renderedHeight = visibleHeight * scale;
      const originX = 0.5;
      const originY = 0;
      const centerX = renderBounds.centerX;
      const top = renderBounds.y;
      const centerY = top;
      const left = centerX - (originX * renderedWidth);
      const safeBandAnchorY = this.getCastleSafeBandAnchorY(layout);

      const baseImage = this.add.image(centerX, centerY, baseKey)
        .setOrigin(originX, originY)
        .setCrop(0, cropTop, imageWidth, visibleHeight)
        .setScale(scale)
        .setInteractive({ useHandCursor: true });

      if (onClickCastle) {
        baseImage.on('pointerdown', onClickCastle);
      }

      this.currentCastleTransform = {
        sourceWidth: imageWidth,
        sourceHeight: imageHeight,
        sourceCropTop: cropTop,
        sourceCropHeight: visibleHeight,
        renderedWidth,
        renderedHeight,
        scale: baseImage.scaleX,
        centerX: baseImage.x,
        centerY: baseImage.y,
        baseRectLeft: left,
        baseRectTop: top,
        baseRectWidth: renderedWidth,
        baseRectHeight: renderedHeight,
        safeBandAnchorY,
        safeBandViewportY: CASTLE_SAFE_BAND_TARGET_VIEWPORT_Y,
        originX,
        originY,
      };

      this.baseLayer.add(baseImage);
      this.publishCastleMeasurement({
        viewportWidth,
        viewportHeight,
        renderBounds,
        baseImage,
        cropTop,
        visibleHeight,
      });

      if (this.calibration?.enabled) {
        this.renderCalibrationOverlay({
          layout,
          cropTop,
          visibleHeight,
        });
      }
      return;
    }

    const fallbackBackground = this.add.rectangle(
      renderBounds.centerX,
      renderBounds.centerY,
      renderBounds.width,
      renderBounds.height,
      0x101828,
    );
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
    this.publishCastleMeasurement({
      viewportWidth,
      viewportHeight,
      renderBounds: this.getCastleRenderBounds(viewportWidth, viewportHeight),
      baseImage: null,
      cropTop: null,
      visibleHeight: null,
    });
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

    const topY = this.currentCastleTransform.baseRectTop;
    const localY = pointer.worldY - topY;
    const normalizedY = localY / this.currentCastleTransform.renderedHeight;
    return Phaser.Math.Clamp(normalizedY, 0, 1);
  }

  getSourceToRenderNormalizedY(sourceY) {
    const transform = this.currentCastleTransform;
    if (!transform || !Number.isFinite(sourceY)) {
      return 0;
    }

    const cropTop = Number.isFinite(transform.sourceCropTop) ? transform.sourceCropTop : 0;
    const cropHeight = Number.isFinite(transform.sourceCropHeight) && transform.sourceCropHeight > 0
      ? transform.sourceCropHeight
      : transform.sourceHeight;
    return Phaser.Math.Clamp((sourceY - cropTop) / cropHeight, 0, 1);
  }

  getLayoutSlots(layout, buildingSet) {
    const hasFinalizedSlots = Array.isArray(layout?.slots) && layout.slots.length > 0;
    if (hasFinalizedSlots) {
      const baseHeight = Number.isFinite(layout?.baseHeight)
        ? layout.baseHeight
        : Number.isFinite(layout?.baseSize?.height)
          ? layout.baseSize.height
          : 1;
      const baseWidth = Number.isFinite(layout?.baseWidth)
        ? layout.baseWidth
        : Number.isFinite(layout?.baseSize?.width)
          ? layout.baseSize.width
          : 1;
      return layout.slots.map((slot, index) => {
        const slotOffset = this.calibration?.enabled
          ? this.calibration.slotOffsets?.[slot.slotId] ?? {}
          : {};
        const slotCenterOffsetX = Number.isFinite(slotOffset?.slotCenterOffsetX) ? slotOffset.slotCenterOffsetX : 0;
        const slotCenterOffsetY = Number.isFinite(slotOffset?.slotCenterOffsetY) ? slotOffset.slotCenterOffsetY : 0;
        const buildAnchorOffsetX = Number.isFinite(slotOffset?.buildAnchorOffsetX) ? slotOffset.buildAnchorOffsetX : 0;
        const buildAnchorOffsetY = Number.isFinite(slotOffset?.buildAnchorOffsetY) ? slotOffset.buildAnchorOffsetY : 0;
        const slotCenterX = slot.slotCenterX + slotCenterOffsetX;
        const slotCenterY = slot.slotCenterY + slotCenterOffsetY;
        const buildAnchorX = slot.buildAnchorX + buildAnchorOffsetX;
        const buildAnchorY = slot.buildAnchorY + buildAnchorOffsetY;

        return ({
        slotId: slot.slotId,
        buildingId: slot.buildingId,
        slotCenter: {
          x: slotCenterX,
          y: slotCenterY,
        },
        buildAnchor: {
          x: buildAnchorX,
          y: buildAnchorY,
        },
        anchorX: Number.isFinite(slot.anchorX) ? slot.anchorX : Phaser.Math.Clamp(buildAnchorX / baseWidth, 0, 1),
        anchorY: Number.isFinite(slot.anchorY) ? slot.anchorY : Phaser.Math.Clamp(buildAnchorY / baseHeight, 0, 1),
        slotScale: Number.isFinite(slot.slotScale) ? slot.slotScale : 1,
        footpointOverride: slot.footpointOverride ?? null,
        offsetX: slot.offsetX,
        offsetY: slot.offsetY,
        z: Number.isFinite(slot?.z) ? slot.z : Math.round((slot?.anchorY ?? 0) * 100) + index,
      });
      });
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

  renderDebugSlotMarker({ x, y, slotId, z, color, labelColor }) {
    if (!this.debugOptions?.showPlacementMarkers) {
      return;
    }

    const marker = this.add.container(x, y).setDepth(z + 0.25);
    const radius = 10;
    const markerColor = Number.isFinite(color) ? color : 0xff0000;
    const horizontal = this.add.rectangle(0, 0, radius * 2, 2, markerColor, 0.95).setOrigin(0.5);
    const vertical = this.add.rectangle(0, 0, 2, radius * 2, markerColor, 0.95).setOrigin(0.5);
    const ring = this.add.circle(0, 0, radius, markerColor, 0).setStrokeStyle(1, markerColor, 0.85);
    const label = this.add.text(0, -(radius + 4), String(slotId), {
      color: labelColor ?? '#fecaca',
      fontFamily: 'Arial',
      fontSize: '11px',
    }).setOrigin(0.5, 1).setVisible(this.calibration?.showSlotLabels ?? true);

    marker.add([horizontal, vertical, ring, label]);
    this.debugSlotLayer.add(marker);
  }

  isOverlayValidationEnabled() {
    const devMode = Boolean(import.meta.env?.DEV);
    return this.debugEnabled || devMode;
  }

  renderDebugRect({ x, y, width, height, z, color = 0xffffff, alpha = 0.8, lineWidth = 1 }) {
    if (!this.debugOptions?.showPlacementMarkers) {
      return;
    }

    if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(width) && Number.isFinite(height))) {
      return;
    }

    const graphics = this.add.graphics();
    graphics.lineStyle(lineWidth, color, alpha);
    graphics.strokeRect(x, y, width, height);
    graphics.setDepth((Number.isFinite(z) ? z : 0) + 0.2);
    this.debugSlotLayer.add(graphics);
  }

  renderDebugLine({ x1, y1, x2, y2, z, color = 0xffffff, alpha = 0.9, lineWidth = 1 }) {
    if (!this.debugOptions?.showPlacementMarkers) {
      return;
    }

    if (!(Number.isFinite(x1) && Number.isFinite(y1) && Number.isFinite(x2) && Number.isFinite(y2))) {
      return;
    }

    const graphics = this.add.graphics();
    graphics.lineStyle(lineWidth, color, alpha);
    graphics.lineBetween(x1, y1, x2, y2);
    graphics.setDepth((Number.isFinite(z) ? z : 0) + 0.2);
    this.debugSlotLayer.add(graphics);
  }

  hasAncestorClipOrMask(displayObject) {
    let current = displayObject?.parentContainer ?? null;
    while (current) {
      if (current.mask || current.scrollRect) {
        return true;
      }
      current = current.parentContainer ?? null;
    }
    return false;
  }

  publishCastleMeasurement({
    viewportWidth,
    viewportHeight,
    renderBounds,
    baseImage = null,
    cropTop = null,
    visibleHeight = null,
  }) {
    if (!renderBounds) {
      return;
    }

    const topHudHeight = renderBounds.y;
    const bottomNavHeight = Math.max(0, viewportHeight - (renderBounds.y + renderBounds.height));
    const renderedCastleRect = this.currentCastleTransform
      ? {
        x: this.currentCastleTransform.baseRectLeft,
        y: this.currentCastleTransform.baseRectTop,
        width: this.currentCastleTransform.baseRectWidth,
        height: this.currentCastleTransform.baseRectHeight,
      }
      : null;
    const sourceCropRect = this.currentCastleTransform
      ? {
        x: 0,
        y: this.currentCastleTransform.sourceCropTop,
        width: this.currentCastleTransform.sourceWidth,
        height: this.currentCastleTransform.sourceCropHeight,
      }
      : null;
    const imageBounds = baseImage?.getBounds?.() ?? null;
    const hasAncestorClip = this.hasAncestorClipOrMask(baseImage);
    const hasImageCrop = Boolean(baseImage?.isCropped);
    const clippedByPlayableRect = Boolean(
      imageBounds
      && (imageBounds.left < renderBounds.x
        || imageBounds.right > (renderBounds.x + renderBounds.width)
        || imageBounds.top < renderBounds.y
        || imageBounds.bottom > (renderBounds.y + renderBounds.height)),
    );

    this.latestCastleMeasurement = {
      viewport: {
        width: viewportWidth,
        height: viewportHeight,
      },
      topHudHeight,
      bottomNavHeight,
      castlePlayableRect: {
        x: renderBounds.x,
        y: renderBounds.y,
        width: renderBounds.width,
        height: renderBounds.height,
      },
      renderedCastleImageRect: renderedCastleRect,
      sourceCropRect,
      clipping: {
        hasImageCrop,
        hasAncestorClipOrMask: hasAncestorClip,
        clippedByPlayableRect,
        secondContainerClipDetected: hasAncestorClip,
      },
      slotCoordinateSpaces: {
        slotCenters: 'source image space (layout base pixels), projected into rendered image rect',
        buildAnchors: 'source image space (layout base pixels), projected into rendered image rect',
      },
      diagnostics: {
        cropTop,
        visibleHeight,
      },
    };

    if (typeof window !== 'undefined') {
      window.__castleMeasurement = this.latestCastleMeasurement;
    }

    console.info(CASTLE_MEASUREMENT_LOG_PREFIX, this.latestCastleMeasurement);
  }

  renderMeasurementOverlay(layout) {
    if (!this.debugOptions?.showMeasurementOverlay) {
      return;
    }

    const measurement = this.latestCastleMeasurement;
    if (!measurement) {
      return;
    }

    const viewportRect = {
      x: 0,
      y: 0,
      width: measurement.viewport.width,
      height: measurement.viewport.height,
    };
    const playableRect = measurement.castlePlayableRect;
    const renderedRect = measurement.renderedCastleImageRect;

    this.renderDebugRect({
      ...viewportRect,
      z: 1000,
      color: 0x38bdf8,
      alpha: 0.95,
      lineWidth: 2,
    });
    this.renderDebugRect({
      ...playableRect,
      z: 1001,
      color: 0xf59e0b,
      alpha: 0.95,
      lineWidth: 2,
    });

    if (renderedRect) {
      this.renderDebugRect({
        ...renderedRect,
        z: 1002,
        color: 0x22c55e,
        alpha: 0.95,
        lineWidth: 2,
      });
    }

    if (renderedRect) {
      const slotBandY = this.getCourtyardBoundaryY(layout);
      if (Number.isFinite(slotBandY)) {
        const bandWorldY = renderedRect.y + (renderedRect.height * slotBandY);
        this.renderDebugLine({
          x1: renderedRect.x,
          y1: bandWorldY,
          x2: renderedRect.x + renderedRect.width,
          y2: bandWorldY,
          z: 1003,
          color: 0xe879f9,
          alpha: 0.95,
          lineWidth: 2,
        });
      }
    }

    const label = this.add.text(10, 10, [
      `viewport: ${Math.round(measurement.viewport.width)} x ${Math.round(measurement.viewport.height)}`,
      `top HUD: ${Math.round(measurement.topHudHeight)} px`,
      `bottom nav: ${Math.round(measurement.bottomNavHeight)} px`,
      `playable: x=${Math.round(playableRect.x)} y=${Math.round(playableRect.y)} w=${Math.round(playableRect.width)} h=${Math.round(playableRect.height)}`,
      renderedRect
        ? `rendered image: x=${Math.round(renderedRect.x)} y=${Math.round(renderedRect.y)} w=${Math.round(renderedRect.width)} h=${Math.round(renderedRect.height)}`
        : 'rendered image: n/a',
      measurement.sourceCropRect
        ? `source crop: x=${Math.round(measurement.sourceCropRect.x)} y=${Math.round(measurement.sourceCropRect.y)} w=${Math.round(measurement.sourceCropRect.width)} h=${Math.round(measurement.sourceCropRect.height)}`
        : 'source crop: n/a',
      `second clip: ${measurement.clipping.secondContainerClipDetected ? 'yes' : 'no'}`,
    ], {
      color: '#e2e8f0',
      fontFamily: 'monospace',
      fontSize: '12px',
      backgroundColor: '#020617cc',
      padding: { x: 8, y: 6 },
    }).setDepth(2100);
    this.debugSlotLayer.add(label);
  }

  renderCalibrationOverlay({ layout, cropTop, visibleHeight }) {
    const transform = this.currentCastleTransform;
    if (!transform) {
      return;
    }

    this.renderDebugRect({
      x: transform.baseRectLeft,
      y: transform.baseRectTop,
      width: transform.baseRectWidth,
      height: transform.baseRectHeight,
      z: 2,
      color: 0xf59e0b,
      alpha: 0.95,
      lineWidth: 2,
    });

    if (this.calibration?.showVisibleSourceCropBounds) {
      const sourceCropBottom = cropTop + visibleHeight;
      const label = this.add.text(
        transform.baseRectLeft + 10,
        transform.baseRectTop + 10,
        `cropY ${Math.round(cropTop)}-${Math.round(sourceCropBottom)} / ${Math.round(transform.sourceHeight)}`,
        {
          color: '#fde68a',
          fontFamily: 'Arial',
          fontSize: '12px',
          backgroundColor: '#111827cc',
          padding: { x: 6, y: 4 },
        },
      ).setDepth(2000);
      this.debugSlotLayer.add(label);
    }

    const layoutSlots = this.getLayoutSlots(layout, null);
    layoutSlots.forEach((slot) => {
      const slotCenter = this.getAnchorWorldPosition(slot.slotCenter, layout);
      const buildAnchor = this.getAnchorWorldPosition(slot.buildAnchor, layout);
      const buildingFootpoint = {
        x: buildAnchor.x + (this.calibration?.buildingFootpointOffsetX ?? 0),
        y: buildAnchor.y + (this.calibration?.buildingFootpointOffsetY ?? 0),
      };

      this.renderDebugSlotMarker({
        x: slotCenter.x,
        y: slotCenter.y,
        slotId: `${slot.slotId} center`,
        z: slot.z ?? 0,
        color: 0xef4444,
        labelColor: '#fecaca',
      });
      this.renderDebugSlotMarker({
        x: buildAnchor.x,
        y: buildAnchor.y,
        slotId: `${slot.slotId} anchor`,
        z: (slot.z ?? 0) + 0.1,
        color: 0x60a5fa,
        labelColor: '#bfdbfe',
      });
      this.renderDebugSlotMarker({
        x: buildingFootpoint.x,
        y: buildingFootpoint.y,
        slotId: `${slot.slotId} foot`,
        z: (slot.z ?? 0) + 0.2,
        color: 0x22c55e,
        labelColor: '#bbf7d0',
      });
    });
  }

  getAnchorWorldPosition(anchorLike, layout, options = {}) {
    const transform = this.currentCastleTransform;

    if (transform && Number.isFinite(anchorLike?.x) && Number.isFinite(anchorLike?.y)) {
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
      const sourceY = baseHeight > 0 ? anchorLike.y : 0;
      const normalizedY = this.getSourceToRenderNormalizedY(sourceY);

      return {
        x: transform.baseRectLeft + (normalizedX * transform.renderedWidth),
        y: transform.baseRectTop + (normalizedY * transform.renderedHeight),
      };
    }

    const hasNormalizedAnchor = Number.isFinite(anchorLike?.anchorX)
      && Number.isFinite(anchorLike?.anchorY);

    if (transform && hasNormalizedAnchor) {
      const sourceY = anchorLike.anchorY * transform.sourceHeight;
      const normalizedY = this.getSourceToRenderNormalizedY(sourceY);
      return {
        x: transform.baseRectLeft + (anchorLike.anchorX * transform.renderedWidth),
        y: transform.baseRectTop + (normalizedY * transform.renderedHeight),
      };
    }

    return {
      x: options.allowPixelFallback ? (anchorLike?.x ?? 0) : 0,
      y: options.allowPixelFallback ? (anchorLike?.y ?? 0) : 0,
    };
  }

  renderBuildingLayer({ castle, layout, buildingSet, runtimeBuildings, onClickBuilding }) {
    const layoutSlots = this.getLayoutSlots(layout, buildingSet);
    const slotByBuildingId = new Map(layoutSlots.map((slot) => [slot.buildingId, slot]));
    const layoutBaseWidth = Number.isFinite(layout?.baseWidth)
      ? layout.baseWidth
      : Number.isFinite(layout?.baseSize?.width)
        ? layout.baseSize.width
        : this.currentCastleTransform?.sourceWidth;
    const layoutBaseHeight = Number.isFinite(layout?.baseHeight)
      ? layout.baseHeight
      : Number.isFinite(layout?.baseSize?.height)
        ? layout.baseSize.height
        : this.currentCastleTransform?.sourceHeight;
    const defaultFootpointX = Number.isFinite(layout?.defaultFootpointX)
      ? layout.defaultFootpointX
      : DEFAULT_BUILDING_FOOTPOINT_X;
    const defaultFootpointY = Number.isFinite(layout?.defaultFootpointY)
      ? layout.defaultFootpointY
      : DEFAULT_BUILDING_FOOTPOINT_Y;
    const globalFootpointOffsetX = Number.isFinite(layout?.buildingFootpointOffsetX)
      ? layout.buildingFootpointOffsetX
      : 0;
    const globalFootpointOffsetY = Number.isFinite(layout?.buildingFootpointOffsetY)
      ? layout.buildingFootpointOffsetY
      : 0;
    const buildingGlobalScaleMultiplier = this.getBuildingGlobalScaleMultiplier(castle);

    const placedBuildings = this.getBuildableBuildingDefinitions(buildingSet)
      .map((buildingDefinition) => ({
        definition: buildingDefinition,
        level: runtimeBuildings?.[buildingDefinition.buildingId],
        anchor: slotByBuildingId.get(buildingDefinition.buildingId),
      }))
      .filter(({ level, anchor }) => Number.isFinite(level) && level > 0 && anchor)
      .map(({ definition, level, anchor }) => {
        const levelDefinition = definition.levels.find((entry) => entry.level === level) ?? definition.levels[0] ?? null;

        return {
          buildingId: definition.buildingId,
          anchorY: anchor.anchorY,
          slotId: anchor.slotId,
          buildAnchor: anchor.buildAnchor,
          z: anchor.z ?? 0,
          offsetX: Number.isFinite(anchor?.offsetX) ? anchor.offsetX : 0,
          offsetY: Number.isFinite(anchor?.offsetY) ? anchor.offsetY : 0,
          slotScale: Number.isFinite(anchor?.slotScale) ? anchor.slotScale : 1,
          slotTargetWidthPx: Number.isFinite(anchor?.targetWidthPx) ? anchor.targetWidthPx : null,
          defaultTargetWidthPx: Number.isFinite(layout?.defaultTargetWidthPx) ? layout.defaultTargetWidthPx : null,
          footpointOverride: anchor?.footpointOverride ?? null,
          assetKey: levelDefinition?.assetKey ?? null,
          targetWidthPx: Number.isFinite(levelDefinition?.targetWidthPx)
            ? levelDefinition.targetWidthPx
            : Number.isFinite(definition?.targetWidthPx)
              ? definition.targetWidthPx
              : null,
          legacyFullCanvasCompat: Boolean(
            levelDefinition?.legacyFullCanvasCompat ?? definition?.legacyFullCanvasCompat ?? false,
          ),
          scaleOverride: Number.isFinite(levelDefinition?.scale)
            ? levelDefinition.scale
            : Number.isFinite(definition?.scale)
              ? definition.scale
              : null,
          level,
        };
      })
      .sort((a, b) => a.z - b.z);

    placedBuildings.forEach((building) => {
      const baseScale = this.currentCastleTransform?.scale ?? 1;
      const baseRectLeft = this.currentCastleTransform?.baseRectLeft;
      const baseRectTop = this.currentCastleTransform?.baseRectTop;
      const baseRectWidth = this.currentCastleTransform?.baseRectWidth;
      const baseRectHeight = this.currentCastleTransform?.baseRectHeight;
      const buildAnchorWithOffset = {
        ...building.buildAnchor,
        x: (building.buildAnchor?.x ?? 0) + building.offsetX + globalFootpointOffsetX + (this.calibration?.buildingFootpointOffsetX ?? 0),
        y: (building.buildAnchor?.y ?? 0) + building.offsetY + globalFootpointOffsetY + (this.calibration?.buildingFootpointOffsetY ?? 0),
      };
      const buildAnchorPosition = this.getAnchorWorldPosition(buildAnchorWithOffset, layout);
      const x = buildAnchorPosition.x;
      const y = buildAnchorPosition.y;

      const isDiagnosticTarget = building.buildingId === 'barracks' && building.slotId === 'slot_1';

      if (isDiagnosticTarget) {
        this.emitDiagnosticLog('[CastleOverlayDiagnostic] Render path', {
          file: 'src/scenes/CastleScene.js',
          functionName: 'renderBuildingLayer',
          layerContainer: 'this.buildingLayer',
        });
        this.emitDiagnosticLog('[CastleOverlayDiagnostic] Castle base rect', {
          baseRectLeft: baseRectLeft ?? null,
          baseRectTop: baseRectTop ?? null,
          baseRectWidth: baseRectWidth ?? null,
          baseRectHeight: baseRectHeight ?? null,
          currentCastleTransformScale: this.currentCastleTransform?.scale ?? null,
          currentCastleTransformRenderedWidth: this.currentCastleTransform?.renderedWidth ?? null,
          currentCastleTransformRenderedHeight: this.currentCastleTransform?.renderedHeight ?? null,
        });
        this.emitDiagnosticLog('[CastleOverlayDiagnostic] Calibration inputs', {
          buildingId: building.buildingId,
          slotId: building.slotId,
          buildAnchor: building.buildAnchor,
          slotScale: building.slotScale,
          offsetX: building.offsetX,
          offsetY: building.offsetY,
        });
      }

      const hasTexture = building.assetKey ? textureExists(this, building.assetKey) : false;

      if (isDiagnosticTarget) {
        const textureSource = hasTexture ? this.textures.get(building.assetKey).getSourceImage() : null;
        this.emitDiagnosticLog('[CastleOverlayDiagnostic] Texture info', {
          textureKey: building.assetKey,
          textureExists: hasTexture,
          spriteSourceWidth: Number.isFinite(textureSource?.width) ? textureSource.width : null,
          spriteSourceHeight: Number.isFinite(textureSource?.height) ? textureSource.height : null,
        });
      }

      if (building.assetKey && hasTexture) {
        const interactiveBuilding = this.isInCourtyardByAnchor(building, layout);
        const textureSource = this.textures.get(building.assetKey).getSourceImage();
        const spriteSourceWidth = Number.isFinite(textureSource?.width) ? textureSource.width : null;
        const spriteSourceHeight = Number.isFinite(textureSource?.height) ? textureSource.height : null;
        const footpointX = Number.isFinite(building.footpointOverride?.x)
          ? building.footpointOverride.x
          : defaultFootpointX;
        const footpointY = Number.isFinite(building.footpointOverride?.y)
          ? building.footpointOverride.y
          : defaultFootpointY;
        const sprite = this.add.image(x, y, building.assetKey)
          .setOrigin(footpointX, footpointY)
          .setDepth(building.z);
        const renderedBaseWidth = this.currentCastleTransform?.renderedWidth;
        const renderedBaseHeight = this.currentCastleTransform?.renderedHeight;
        const baseSpaceToRenderedScaleX = Number.isFinite(renderedBaseWidth) && Number.isFinite(layoutBaseWidth) && layoutBaseWidth > 0
          ? renderedBaseWidth / layoutBaseWidth
          : baseScale;
        const baseSpaceToRenderedScaleY = Number.isFinite(renderedBaseHeight) && Number.isFinite(layoutBaseHeight) && layoutBaseHeight > 0
          ? renderedBaseHeight / layoutBaseHeight
          : baseScale;
        const explicitTargetWidthPx = Number.isFinite(building.targetWidthPx)
          ? building.targetWidthPx
          : Number.isFinite(building.slotTargetWidthPx)
            ? building.slotTargetWidthPx
            : Number.isFinite(building.defaultTargetWidthPx)
              ? building.defaultTargetWidthPx
              : null;
        const hasExplicitTargetWidth = Number.isFinite(explicitTargetWidthPx)
          && explicitTargetWidthPx > 0
          && Number.isFinite(spriteSourceWidth)
          && spriteSourceWidth > 0;
        const isLegacyCompatMode = Boolean(building.legacyFullCanvasCompat);
        const resolvedScale = hasExplicitTargetWidth
          ? (explicitTargetWidthPx * baseSpaceToRenderedScaleX) / spriteSourceWidth
          : isLegacyCompatMode
            ? Number.isFinite(building.scaleOverride)
              ? building.scaleOverride * baseScale
              : baseScale
            : Number.isFinite(building.scaleOverride)
              ? building.scaleOverride * baseScale
              : (building.slotScale ?? 1) * baseScale;
        const finalResolvedScale = resolvedScale * buildingGlobalScaleMultiplier;
        sprite.setScale(finalResolvedScale);

        const expectedRenderedTargetWidth = Number.isFinite(explicitTargetWidthPx) && explicitTargetWidthPx > 0
          ? explicitTargetWidthPx * baseSpaceToRenderedScaleX
          : null;

        if (isLegacyCompatMode && !hasExplicitTargetWidth) {
          const legacyCompatWarningKey = `${building.assetKey}:legacy-target-width-missing`;
          if (!this.invalidOverlayAssetWarnings.has(legacyCompatWarningKey)) {
            this.invalidOverlayAssetWarnings.add(legacyCompatWarningKey);
            console.warn(
              `[CastleOverlayValidation] Legacy full-canvas compatibility mode active for "${building.assetKey}" `
              + `without explicit targetWidthPx; slotScale/baseScale fallback is disabled for this asset.`,
            );
          }
        }

        const isSuspiciousFullCanvasOverlay = Number.isFinite(spriteSourceWidth)
          && Number.isFinite(spriteSourceHeight)
          && Number.isFinite(layoutBaseWidth)
          && Number.isFinite(layoutBaseHeight)
          && layoutBaseWidth > 0
          && layoutBaseHeight > 0
          && (spriteSourceWidth / layoutBaseWidth) >= FULL_CANVAS_OVERLAY_WARNING_RATIO
          && (spriteSourceHeight / layoutBaseHeight) >= FULL_CANVAS_OVERLAY_WARNING_RATIO;
        const isOversizedRelativeToBase = Number.isFinite(spriteSourceWidth)
          && Number.isFinite(spriteSourceHeight)
          && Number.isFinite(layoutBaseWidth)
          && Number.isFinite(layoutBaseHeight)
          && layoutBaseWidth > 0
          && layoutBaseHeight > 0
          && (spriteSourceWidth / layoutBaseWidth) >= OVERSIZED_OVERLAY_SIDE_RATIO
          && (spriteSourceHeight / layoutBaseHeight) >= OVERSIZED_OVERLAY_SIDE_RATIO;
        const isSuspiciousSlotContract = Number.isFinite(expectedRenderedTargetWidth)
          && expectedRenderedTargetWidth > 0
          && Number.isFinite(sprite.displayWidth)
          && sprite.displayWidth > (expectedRenderedTargetWidth * 1.75);
        const invalidAssetWarningKey = `${building.assetKey}:${building.slotId}`;
        if ((isSuspiciousFullCanvasOverlay || isOversizedRelativeToBase || isSuspiciousSlotContract)
          && !this.invalidOverlayAssetWarnings.has(invalidAssetWarningKey)) {
          const warningReasons = [];
          if (isSuspiciousFullCanvasOverlay) {
            warningReasons.push('near-full-canvas dimensions');
          }
          if (isOversizedRelativeToBase) {
            warningReasons.push('oversized base-relative dimensions');
          }
          if (isSuspiciousSlotContract) {
            warningReasons.push('rendered width exceeds slot-local target envelope');
          }
          this.invalidOverlayAssetWarnings.add(invalidAssetWarningKey);
          this.invalidOverlayAssetWarnings.add(building.assetKey);
          console.warn(
            `[CastleOverlayValidation] Invalid overlay asset contract for "${building.assetKey}": `
            + `texture is ${spriteSourceWidth}x${spriteSourceHeight}, near base ${layoutBaseWidth}x${layoutBaseHeight}. `
            + `SizingPath=${isLegacyCompatMode ? 'legacy-full-canvas-compat(targetWidthPx)' : 'native-slot-local'}. `
            + `Reasons: ${warningReasons.join(', ')}. `
            + 'Expected isolated slot-local transparent PNG overlay (not full-canvas).',
          );
        }

        if (this.isOverlayValidationEnabled()) {
          const spriteBounds = sprite.getBounds();
          const localBoundsWidth = Math.max(
            Number.isFinite(expectedRenderedTargetWidth) ? expectedRenderedTargetWidth * OVERLAY_LOCAL_BOUNDS_WIDTH_MULTIPLIER : 0,
            72 * baseScale,
          );
          const localBoundsHeight = Math.max(
            Number.isFinite(expectedRenderedTargetWidth) ? expectedRenderedTargetWidth * OVERLAY_LOCAL_BOUNDS_HEIGHT_MULTIPLIER : 0,
            96 * baseScale,
          );
          const expectedLocalRect = {
            left: x - (localBoundsWidth / 2),
            top: y - localBoundsHeight,
            width: localBoundsWidth,
            height: localBoundsHeight,
          };
          const exceedsLocalBounds = Number.isFinite(spriteBounds?.left)
            && Number.isFinite(spriteBounds?.right)
            && Number.isFinite(spriteBounds?.top)
            && Number.isFinite(spriteBounds?.bottom)
            && (
              spriteBounds.left < expectedLocalRect.left
              || spriteBounds.right > (expectedLocalRect.left + expectedLocalRect.width)
              || spriteBounds.top < expectedLocalRect.top
              || spriteBounds.bottom > (expectedLocalRect.top + expectedLocalRect.height)
            );

          this.renderDebugRect({
            x: expectedLocalRect.left,
            y: expectedLocalRect.top,
            width: expectedLocalRect.width,
            height: expectedLocalRect.height,
            z: building.z ?? 0,
            color: 0xa855f7,
            alpha: 0.8,
          });
          this.renderDebugRect({
            x: spriteBounds.left,
            y: spriteBounds.top,
            width: spriteBounds.width,
            height: spriteBounds.height,
            z: (building.z ?? 0) + 0.05,
            color: exceedsLocalBounds ? 0xef4444 : 0x22c55e,
            alpha: 0.92,
          });

          const boundsWarningKey = `${building.assetKey}:bounds:${building.slotId}`;
          if (exceedsLocalBounds && !this.invalidOverlayAssetWarnings.has(boundsWarningKey)) {
            this.invalidOverlayAssetWarnings.add(boundsWarningKey);
            console.warn(
              `[CastleOverlayValidation] Overlay bounds exceed expected local slot area for "${building.assetKey}" `
              + `(slot ${building.slotId}): overlay=${Math.round(spriteBounds.width)}x${Math.round(spriteBounds.height)} `
              + `at (${Math.round(spriteBounds.left)},${Math.round(spriteBounds.top)}), `
              + `expectedLocalRect=${Math.round(expectedLocalRect.width)}x${Math.round(expectedLocalRect.height)} `
              + `at (${Math.round(expectedLocalRect.left)},${Math.round(expectedLocalRect.top)}).`,
            );
          }
        }

        if (isDiagnosticTarget) {
          this.emitDiagnosticLog('[CastleOverlayDiagnostic] Final computed render values', {
            sceneX: x,
            sceneY: y,
            resolvedScale,
            buildingGlobalScaleMultiplier,
            finalResolvedScale,
            explicitTargetWidthPx,
            legacyFullCanvasCompat: isLegacyCompatMode,
            baseSpaceToRenderedScaleX,
            baseSpaceToRenderedScaleY,
            expectedRenderedTargetWidth,
            finalScaleX: sprite.scaleX,
            finalScaleY: sprite.scaleY,
            spriteOriginX: sprite.originX,
            spriteOriginY: sprite.originY,
            spriteVisible: sprite.visible,
            spriteAlpha: sprite.alpha,
            spriteDepth: sprite.depth,
            parentContainerName: this.buildingLayer?.name ?? '(unnamed container)',
          });
        }

        if (interactiveBuilding) {
          sprite.setInteractive({ useHandCursor: true });
        }

        if (this.pendingBuildGlowById === building.buildingId) {
          this.renderBuildGlow({
            x,
            y,
            z: building.z,
            scale: finalResolvedScale,
          });
        }

        if (interactiveBuilding && onClickBuilding) {
          sprite.on('pointerdown', () => onClickBuilding(building));
        }

        this.buildingLayer.add(sprite);
        this.renderDebugSlotMarker({
          x: sprite.x,
          y: sprite.y,
          slotId: `${building.slotId} F`,
          z: building.z ?? 0,
          color: 0x22c55e,
          labelColor: '#bbf7d0',
        });
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
    const playableBounds = getPlayableBounds({
      viewportWidth,
      viewportHeight,
      minViewportSide: MIN_VALID_VIEWPORT_SIDE,
      minPlayableHeight: MIN_VALID_PLAYABLE_HEIGHT,
    });

    const width = Math.max(MIN_VALID_VIEWPORT_SIDE, playableBounds.width);
    const bottom = Phaser.Math.Clamp(
      playableBounds.y + playableBounds.height,
      MIN_VALID_PLAYABLE_HEIGHT,
      viewportHeight,
    );
    const height = Math.max(MIN_VALID_PLAYABLE_HEIGHT, bottom);

    return {
      ...playableBounds,
      y: 0,
      width,
      height,
      centerX: width / 2,
      centerY: height / 2,
      hasMeasuredBars: false,
    };
  }

  renderCastleLayers(viewportWidth, viewportHeight) {
    this.clearLayer(this.baseLayer);
    this.clearLayer(this.debugSlotLayer);
    this.clearLayer(this.buildingLayer);
    this.clearLayer(this.decorLayer);

    const { castle, layout, buildingSet, runtimeBuildings } = this.getCastleRenderContext();
    const baseKey = castle?.baseKey ?? 'castle_faction01_base';

    this.renderBaseLayer(viewportWidth, viewportHeight, baseKey, layout, (pointer) => {
      const pointerCastleY = this.getPointerCastleNormalizedY(pointer);
      if (!Number.isFinite(pointerCastleY)) {
        return;
      }

      if (pointerCastleY < this.getCourtyardBoundaryY(layout)) {
        this.openBuildPanel();
      }
    });
    this.renderBuildingLayer({
      castle,
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
    this.renderMeasurementOverlay(layout);
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
