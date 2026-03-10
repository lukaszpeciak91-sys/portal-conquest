import Phaser from 'phaser';
import { SCENES, SceneRouter } from '../SceneRouter';
import { syncSceneState } from '../state/sceneState';
import assetManifest, { loadAssetsFromManifest } from '../assets/loadAssetsFromManifest';
import { addFallbackPlaceholder, textureExists } from '../assets/safeTexture';
import humanCastleLayout from '../data/factions/human/castle_layout.json';
import humanBuildingSet from '../data/buildings/human_buildings.json';
import { GameState } from '../state/GameState';

const MIN_VALID_VIEWPORT_SIDE = 64;
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

  clearLayer(layerContainer) {
    layerContainer?.removeAll(true);
  }

  renderBaseLayer(viewportWidth, viewportHeight, baseKey) {
    const hasBaseTexture = textureExists(this, baseKey);

    if (hasBaseTexture) {
      const source = this.textures.get(baseKey).getSourceImage();
      const imageWidth = source.width || viewportWidth;
      const imageHeight = source.height || viewportHeight;
      const scale = Math.max(viewportWidth / imageWidth, viewportHeight / imageHeight);

      const baseImage = this.add.image(viewportWidth / 2, viewportHeight / 2, baseKey)
        .setOrigin(0.5)
        .setScale(scale);

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
  }

  renderBuildingLayer({ layout, buildingSet, runtimeBuildings }) {
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
      if (textureExists(this, building.assetKey)) {
        const sprite = this.add.image(building.x, building.y, building.assetKey)
          .setOrigin(0.5, 1)
          .setScale(building.scale)
          .setDepth(building.z);

        this.buildingLayer.add(sprite);
        return;
      }

      const placeholder = addFallbackPlaceholder(this, {
        x: building.x,
        y: building.y - 40,
        width: 100,
        height: 70,
        label: `${building.buildingId}\nlvl ${building.level}`,
        depth: building.z,
      });

      this.buildingLayer.add(placeholder);
    });
  }

  renderCastleLayers(viewportWidth, viewportHeight) {
    this.clearLayer(this.baseLayer);
    this.clearLayer(this.buildingLayer);
    this.clearLayer(this.decorLayer);

    const { castle, layout, buildingSet, runtimeBuildings } = this.getCastleRenderContext();
    const baseKey = castle?.baseKey ?? 'castle_faction01_base';

    this.renderBaseLayer(viewportWidth, viewportHeight, baseKey);
    this.renderBuildingLayer({ layout, buildingSet, runtimeBuildings });
  }

  handleResize(gameSize) {
    const viewport = this.getSafeViewportSize(gameSize);
    if (!viewport) {
      return;
    }

    this.renderCastleLayers(viewport.width, viewport.height);
  }
}
