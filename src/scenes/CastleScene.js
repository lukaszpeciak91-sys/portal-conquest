import Phaser from 'phaser';
import { SCENES, SceneRouter } from '../SceneRouter';
import { syncSceneState } from '../state/sceneState';
import assetManifest, { loadAssetsFromManifest } from '../assets/loadAssetsFromManifest';
import { addFallbackPlaceholder, textureExists } from '../assets/safeTexture';
import humanCastleLayout from '../data/factions/human/castle_layout.json';
import humanBuildingSet from '../data/buildings/human_buildings.json';
import { GameState } from '../state/GameState';

const MIN_VALID_VIEWPORT_SIDE = 64;
const MIN_VALID_PLAYABLE_HEIGHT = 120;
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
    this.renderCastleLayers(viewport.width, viewport.height);

    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this);
    });

    if (typeof window !== 'undefined') {
      window.gameUi?.resetMapUi?.();
      window.gameUi?.setMode?.('castle');
    }

    this.input.keyboard.on('keydown-M', () => this.router.goTo(SCENES.MAP));
  }

  initializeLayerStack() {
    this.castleLayerRoot = this.add.container(0, 0).setDepth(0);

    this.baseLayer = this.add.container(0, 0);
    this.buildingLayer = this.add.container(0, 0);
    this.decorLayer = this.add.container(0, 0);

    this.castleLayerRoot.add([this.baseLayer, this.buildingLayer, this.decorLayer]);
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


  openBuildPanel() {
    window.gameUi?.openCastlePanel?.('build', {
      title: 'Build Panel',
      body: `Available buildings:
- Tavern
- Barracks
- Mage Guild`,
    });
  }

  openBuildingPanel(buildingId, level) {
    const label = String(buildingId ?? 'building').replace(/[_-]/g, ' ').toUpperCase();

    window.gameUi?.openCastlePanel?.('building', {
      title: 'Building Panel',
      body: `${label} Level ${level}
Actions:
- Recruit units
- Upgrade building`,
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
      const scale = Math.min(renderBounds.width / imageWidth, renderBounds.height / imageHeight) * 0.98;
      const centerX = renderBounds.centerX;
      const centerY = renderBounds.centerY + (renderBounds.height * 0.04);

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

  renderBuildingLayer({ layout, buildingSet, runtimeBuildings, onClickBuilding }) {
    const anchorBySlotId = new Map((layout?.anchors ?? []).map((anchor) => [anchor.slotId, anchor]));
    const placedBuildings = [...(buildingSet?.buildings ?? [])]
      .map((buildingDefinition) => ({
        definition: buildingDefinition,
        level: runtimeBuildings?.[buildingDefinition.buildingId],
        anchor: anchorBySlotId.get(buildingDefinition.slotId),
      }))
      .filter(({ level, anchor }) => Number.isFinite(level) && level > 0 && anchor)
      .map(({ definition, level, anchor }) => {
        const levelDefinition = definition.levels.find((entry) => entry.level === level);
        if (!levelDefinition?.assetKey) {
          return null;
        }

        return {
          buildingId: definition.buildingId,
          x: anchor.x,
          y: anchor.y,
          z: anchor.z ?? 0,
          scale: anchor.scale ?? 1,
          assetKey: levelDefinition.assetKey,
          level,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.z - b.z);

    placedBuildings.forEach((building) => {
      const baseScale = this.currentCastleTransform?.scale ?? 1;
      const x = this.currentCastleTransform
        ? this.currentCastleTransform.topLeftX + (building.x * baseScale)
        : building.x;
      const y = this.currentCastleTransform
        ? this.currentCastleTransform.topLeftY + (building.y * baseScale)
        : building.y;

      if (textureExists(this, building.assetKey)) {
        const sprite = this.add.image(x, y, building.assetKey)
          .setOrigin(0.5, 1)
          .setScale(building.scale * baseScale)
          .setDepth(building.z)
          .setInteractive({ useHandCursor: true });

        if (onClickBuilding) {
          sprite.on('pointerdown', () => onClickBuilding(building));
        }

        this.buildingLayer.add(sprite);
        return;
      }

      const isDebugEnabled = typeof window !== 'undefined' && window.gameUi?.isDebugEnabled?.();
      if (isDebugEnabled) {
        const marker = this.add.circle(x, y - (12 * baseScale), Math.max(3, 4 * baseScale), 0x94a3b8, 0.18)
          .setStrokeStyle(1, 0xe2e8f0, 0.35)
          .setDepth(building.z);
        this.buildingLayer.add(marker);
      }
    });
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
    const margin = Phaser.Math.Clamp(Math.min(width, height) * 0.03, 10, 30);

    return {
      x: margin,
      y: top + margin,
      width: Math.max(1, width - (margin * 2)),
      height: Math.max(1, height - (margin * 2)),
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

    this.renderCastleLayers(viewport.width, viewport.height);
  }
}
