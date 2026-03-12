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
    return (buildingSet?.buildings ?? []).map((buildingDefinition) => ({
      buildingId: buildingDefinition.buildingId,
      label: String(buildingDefinition.buildingId ?? 'building').replace(/[_-]/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
      built: Number.isFinite(runtimeBuildings?.[buildingDefinition.buildingId]) && runtimeBuildings[buildingDefinition.buildingId] > 0,
    }));
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
    const definition = (buildingSet?.buildings ?? []).find((entry) => entry.buildingId === buildingId);
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
        imageWidth,
        imageHeight,
        scale,
        topLeftX: centerX - ((imageWidth * scale) / 2),
        topLeftY: centerY - ((imageHeight * scale) / 2),
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

  renderDebugSlotMarker({ x, y, slotId, z, scale }) {
    if (!this.debugEnabled) {
      return;
    }

    const size = Math.max(12, 18 * scale);
    const marker = this.add.container(x, y).setDepth(z + 0.25);
    const ring = this.add.circle(0, 0, size, 0x38bdf8, 0.22).setStrokeStyle(1, 0x7dd3fc, 0.9);
    const label = this.add.text(0, -size - 8, slotId, {
      color: '#e0f2fe',
      fontFamily: 'Arial',
      fontSize: `${Math.max(10, 10 * scale)}px`,
    }).setOrigin(0.5, 1);

    marker.add([ring, label]);
    this.decorLayer.add(marker);
  }

  getAnchorWorldPosition(anchorLike, layout) {
    const baseWidth = Number.isFinite(layout?.baseSize?.width)
      ? layout.baseSize.width
      : this.currentCastleTransform?.imageWidth;
    const baseHeight = Number.isFinite(layout?.baseSize?.height)
      ? layout.baseSize.height
      : this.currentCastleTransform?.imageHeight;
    const hasNormalizedAnchor = Number.isFinite(anchorLike?.anchorX)
      && Number.isFinite(anchorLike?.anchorY)
      && Number.isFinite(baseWidth)
      && Number.isFinite(baseHeight);

    const localX = hasNormalizedAnchor ? anchorLike.anchorX * baseWidth : anchorLike?.x;
    const localY = hasNormalizedAnchor ? anchorLike.anchorY * baseHeight : anchorLike?.y;
    const baseScale = this.currentCastleTransform?.scale ?? 1;

    if (this.currentCastleTransform) {
      return {
        x: this.currentCastleTransform.topLeftX + ((localX ?? 0) * baseScale),
        y: this.currentCastleTransform.topLeftY + ((localY ?? 0) * baseScale),
      };
    }

    return {
      x: localX ?? 0,
      y: localY ?? 0,
    };
  }

  renderBuildingLayer({ layout, buildingSet, runtimeBuildings, onClickBuilding }) {
    const layoutDefaultBuildingScale = Number.isFinite(layout?.defaultBuildingScale)
      ? layout.defaultBuildingScale
      : 1;
    const anchorBySlotId = new Map((layout?.anchors ?? []).map((anchor) => [anchor.slotId, anchor]));

    (layout?.anchors ?? []).forEach((anchor) => {
      const baseScale = this.currentCastleTransform?.scale ?? 1;
      const { x, y } = this.getAnchorWorldPosition(anchor, layout);

      this.renderDebugSlotMarker({
        x,
        y,
        slotId: anchor.slotId,
        z: anchor.z ?? 0,
        scale: layoutDefaultBuildingScale * baseScale,
      });
    });

    const placedBuildings = [...(buildingSet?.buildings ?? [])]
      .map((buildingDefinition) => ({
        definition: buildingDefinition,
        level: runtimeBuildings?.[buildingDefinition.buildingId],
        anchor: anchorBySlotId.get(buildingDefinition.slotId),
      }))
      .filter(({ level, anchor }) => Number.isFinite(level) && level > 0 && anchor)
      .map(({ definition, level, anchor }) => {
        const levelDefinition = definition.levels.find((entry) => entry.level === level) ?? definition.levels[0] ?? null;

        return {
          buildingId: definition.buildingId,
          anchorX: anchor.anchorX,
          anchorY: anchor.anchorY,
          x: anchor.x,
          y: anchor.y,
          z: anchor.z ?? 0,
          scale: Number.isFinite(levelDefinition?.scale)
            ? levelDefinition.scale
            : layoutDefaultBuildingScale,
          assetKey: levelDefinition?.assetKey ?? null,
          level,
        };
      })
      .sort((a, b) => a.z - b.z);

    placedBuildings.forEach((building) => {
      const baseScale = this.currentCastleTransform?.scale ?? 1;
      const { x, y } = this.getAnchorWorldPosition(building, layout);

      if (building.assetKey && textureExists(this, building.assetKey)) {
        const sprite = this.add.image(x, y, building.assetKey)
          .setOrigin(0.5, 1)
          .setScale(building.scale * baseScale)
          .setDepth(building.z)
          .setInteractive({ useHandCursor: true });

        if (this.pendingBuildGlowById === building.buildingId) {
          this.renderBuildGlow({
            x,
            y,
            z: building.z,
            scale: building.scale * baseScale,
          });
        }

        if (onClickBuilding) {
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

    this.renderBaseLayer(viewportWidth, viewportHeight, baseKey, () => this.openBuildPanel());
    this.renderBuildingLayer({
      layout,
      buildingSet,
      runtimeBuildings,
      onClickBuilding: (building) => this.openBuildingPanel(building.buildingId, building.level),
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
