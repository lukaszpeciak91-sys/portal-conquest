import Phaser from 'phaser';
import { SCENES, SceneRouter } from '../SceneRouter';
import { GameState } from '../state/GameState';
import { syncSceneState } from '../state/sceneState';
import map01FallbackUrl from '../data/maps/map01.png';

const NODE_TYPES = {
  CASTLE: 'castle',
  BATTLE: 'battle',
  PORTAL: 'portal',
  EVENT: 'event',
  RESOURCE: 'resource',
  BEACON: 'beacon',
};

const HERO_HP_STUB = 100;
const HERO_LEVEL_STUB = 1;

export class MapScene extends Phaser.Scene {
  constructor() {
    super(SCENES.MAP);
    this.nodeMarkers = new Map();
    this.selectedNodeId = null;
    this.isMoving = false;
  }

  preload() {
    const baseUrl = import.meta.env.BASE_URL ?? '/';
    this.load.image('map01-bg', `${baseUrl}assets/maps/map01.png`);
    this.load.image('map01-bg-fallback', map01FallbackUrl);
  }

  create() {
    syncSceneState(this.scene.key);
    console.log('[MapScene] create');

    this.router = new SceneRouter(this);

    const { map, config, faction } = GameState.data;
    this.mapById = new Map((map?.nodes ?? []).map((node) => [node.id, node]));

    if (!GameState.currentNodeId) {
      const castleNode = map?.nodes?.find((node) => node.type === 'castle');
      GameState.currentNodeId = castleNode?.id ?? map?.nodes?.[0]?.id ?? null;
      if (GameState.currentNodeId) {
        GameState.discoveredNodes.add(GameState.currentNodeId);
      }
    }

    console.log(`Data ready: map=${map?.id}, biome=${map?.biome}, regions=${config?.regions}, faction=${faction?.id}`);

    this.layoutMapBackground(this.scale.width, this.scale.height);
    this.renderNodes(map);
    this.renderHeroMarker();

    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);

    this.feedbackText = this.add.text(this.scale.width / 2, this.scale.height - 84, '', {
      color: '#f1f1f1',
      fontFamily: 'Arial',
      fontSize: '13px',
      backgroundColor: '#00000099',
      padding: { x: 8, y: 6 },
    }).setOrigin(0.5).setDepth(20).setAlpha(0);

    this.nodeInfoText = this.add.text(16, this.scale.height - 60, 'Tap a visible node to inspect or move.', {
      color: '#ffffff',
      fontFamily: 'Arial',
      fontSize: '12px',
      backgroundColor: '#00000088',
      padding: { x: 8, y: 6 },
    }).setDepth(20);

    this.updateHud();

    this.input.keyboard.on('keydown-M', () => this.router.goTo(SCENES.MAP));
    this.input.keyboard.on('keydown-C', () => this.router.goTo(SCENES.CASTLE));
    this.input.keyboard.on('keydown-B', () => this.router.goTo(SCENES.BATTLE));

    if (typeof window !== 'undefined' && window.gameUi?.setMode) {
      window.gameUi.setMode('map');
    }
  }

  layoutMapBackground(viewportWidth, viewportHeight) {
    this.mapBounds = this.drawMapBackground(viewportWidth, viewportHeight);

    if (this.feedbackText) {
      this.feedbackText.setPosition(viewportWidth / 2, viewportHeight - 84);
    }

    if (this.nodeInfoText) {
      this.nodeInfoText.setPosition(16, viewportHeight - 60);
    }
  }

  drawMapBackground(viewportWidth, viewportHeight) {
    const fallbackBounds = { x: 0, y: 0, width: viewportWidth, height: viewportHeight, scale: 1 };

    const textureKey = this.textures.exists('map01-bg')
      ? 'map01-bg'
      : (this.textures.exists('map01-bg-fallback') ? 'map01-bg-fallback' : null);

    if (!textureKey) {
      this.mapBackgroundImage?.destroy();
      this.mapBackgroundImage = this.add.rectangle(viewportWidth / 2, viewportHeight / 2, viewportWidth, viewportHeight, 0x1b2334).setDepth(0);
      this.add.text(viewportWidth / 2, viewportHeight / 2, 'Missing map01.png', {
        color: '#ffffff',
        fontFamily: 'Arial',
        fontSize: '24px',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(1);

      return fallbackBounds;
    }

    this.mapTextureKey = textureKey;

    const texture = this.textures.get(textureKey).getSourceImage();
    const imageWidth = texture.width;
    const imageHeight = texture.height;
    const scale = Math.max(viewportWidth / imageWidth, viewportHeight / imageHeight);
    const width = imageWidth * scale;
    const height = imageHeight * scale;
    const x = (viewportWidth - width) / 2;
    const y = (viewportHeight - height) / 2;

    if (this.mapBackgroundImage && (!this.mapBackgroundImage.scene || !this.mapBackgroundImage.active)) {
      console.log('[MapScene] recreate background (destroyed ref)');
      this.mapBackgroundImage = null;
    }

    if (!this.mapBackgroundImage) {
      this.mapBackgroundImage = this.add.image(viewportWidth / 2, viewportHeight / 2, textureKey)
        .setOrigin(0.5, 0.5)
        .setDepth(0);
    }

    this.mapBackgroundImage
      .setTexture(textureKey)
      .setPosition(viewportWidth / 2, viewportHeight / 2)
      .setScale(scale);

    if (this.mapBackgroundOverlay && (!this.mapBackgroundOverlay.scene || !this.mapBackgroundOverlay.active)) {
      this.mapBackgroundOverlay = null;
    }

    if (!this.mapBackgroundOverlay) {
      this.mapBackgroundOverlay = this.add.rectangle(viewportWidth / 2, viewportHeight / 2, viewportWidth, viewportHeight, 0x000000, 0.12)
        .setDepth(1);
    }

    this.mapBackgroundOverlay
      .setPosition(viewportWidth / 2, viewportHeight / 2)
      .setSize(viewportWidth, viewportHeight);

    return { x, y, width, height, scale };
  }

  mapToScreen(x, y) {
    const source = this.mapTextureKey
      ? this.textures.get(this.mapTextureKey).getSourceImage()
      : { width: this.mapBounds.width, height: this.mapBounds.height };

    return {
      x: this.mapBounds.x + ((x / source.width) * this.mapBounds.width),
      y: this.mapBounds.y + ((y / source.height) * this.mapBounds.height),
    };
  }

  renderNodes(map) {
    if (!map?.nodes?.length) {
      return;
    }

    map.nodes.forEach((node) => {
      if (node.hidden) {
        return;
      }

      const point = this.mapToScreen(node.x, node.y);
      const marker = this.add.circle(point.x, point.y, 7, 0xffd166, 0.95)
        .setStrokeStyle(2, 0x2b2b2b)
        .setDepth(10)
        .setInteractive({ useHandCursor: true });

      marker.on('pointerdown', () => this.onNodePressed(node));

      this.nodeMarkers.set(node.id, marker);
    });
  }

  renderHeroMarker() {
    const currentNode = this.mapById.get(GameState.currentNodeId);
    if (!currentNode) {
      return;
    }

    const point = this.mapToScreen(currentNode.x, currentNode.y);
    this.heroMarker = this.add.circle(point.x, point.y, 5, 0x4de3ff, 1)
      .setStrokeStyle(2, 0x0d2c36)
      .setDepth(15);
  }

  onNodePressed(node) {
    this.selectNode(node);

    if (this.isMoving) {
      this.showFeedback('Moving...');
      return;
    }

    if (node.id === GameState.currentNodeId) {
      this.showFeedback('Already here');
      return;
    }

    const currentNode = this.mapById.get(GameState.currentNodeId);
    const isNeighbor = Boolean(currentNode?.connections?.includes(node.id));

    if (!isNeighbor) {
      this.showFeedback('Not connected');
      console.log(`[MapScene] Invalid move ${GameState.currentNodeId} -> ${node.id}: not connected`);
      return;
    }

    this.moveHeroTo(node);
  }

  moveHeroTo(targetNode) {
    if (!this.heroMarker) {
      return;
    }

    const target = this.mapToScreen(targetNode.x, targetNode.y);
    this.isMoving = true;

    this.tweens.add({
      targets: this.heroMarker,
      x: target.x,
      y: target.y,
      duration: 220,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.isMoving = false;
        GameState.currentNodeId = targetNode.id;
        GameState.discoveredNodes.add(targetNode.id);
        GameState.turnCounter += 1;
        this.updateHud();

        this.showFeedback(`Moved to ${targetNode.id}`);
        console.log(`[MapScene] Move complete: currentNode=${GameState.currentNodeId}, turn=${GameState.turnCounter}`);
        this.handleNodeArrival(targetNode);
      },
    });
  }

  handleNodeArrival(node) {
    if (!node) {
      return;
    }

    switch (node.type) {
      case NODE_TYPES.CASTLE:
        this.router.goTo(SCENES.CASTLE);
        return;
      case NODE_TYPES.BATTLE:
        GameState.pendingBattleKind = null;
        this.router.goTo(SCENES.BATTLE);
        return;
      case NODE_TYPES.PORTAL:
        GameState.pendingBattleKind = 'portal';
        this.router.goTo(SCENES.BATTLE);
        return;
      case NODE_TYPES.EVENT:
        this.showStubOverlay('Event (stub)');
        return;
      case NODE_TYPES.RESOURCE:
        this.showStubOverlay('Resource gained (stub)');
        console.log(`[MapScene] Resource stub at ${node.id}: would grant rewards here.`);
        return;
      case NODE_TYPES.BEACON:
        if (GameState.usedBeacons.has(node.id)) {
          this.showStubOverlay('Beacon depleted');
          return;
        }

        GameState.usedBeacons.add(node.id);
        this.showStubOverlay('Beacon used — teleporting to castle (stub)', () => {
          this.router.goTo(SCENES.CASTLE);
        });
        return;
      default:
        return;
    }
  }

  clearTransientUi() {
    if (this.stubOverlayContainer) {
      this.stubOverlayContainer.destroy(true);
      this.stubOverlayContainer = null;
    }

    this.selectedNodeId = null;
    this.nodeMarkers?.forEach((marker) => {
      marker?.setScale(1).setStrokeStyle(2, 0x2b2b2b);
    });

    if (this.nodeInfoText) {
      this.nodeInfoText.setText('');
    }

    if (this.feedbackText) {
      this.feedbackText.setText('');
      this.feedbackText.setAlpha(0);
    }

    if (this.feedbackFadeTween) {
      this.feedbackFadeTween.remove();
      this.feedbackFadeTween = null;
    }
  }

  showStubOverlay(message, onClose) {
    if (this.stubOverlayContainer) {
      this.stubOverlayContainer.destroy(true);
      this.stubOverlayContainer = null;
    }

    const { width, height } = this.scale;
    const backdrop = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.45)
      .setDepth(30)
      .setInteractive();

    const panel = this.add.rectangle(width / 2, height / 2, 300, 120, 0x202a3f, 0.98)
      .setStrokeStyle(2, 0xffffff)
      .setDepth(31);

    const label = this.add.text(width / 2, height / 2 - 20, message, {
      color: '#ffffff',
      fontFamily: 'Arial',
      fontSize: '15px',
      align: 'center',
      wordWrap: { width: 260 },
    }).setOrigin(0.5).setDepth(32);

    const closeButton = this.add.rectangle(width / 2, height / 2 + 28, 120, 34, 0x2d8cff)
      .setStrokeStyle(2, 0xffffff)
      .setDepth(32)
      .setInteractive({ useHandCursor: true });

    const closeLabel = this.add.text(width / 2, height / 2 + 28, 'Close', {
      color: '#ffffff',
      fontFamily: 'Arial',
      fontSize: '16px',
    }).setOrigin(0.5).setDepth(33);

    const close = () => {
      this.stubOverlayContainer?.destroy(true);
      this.stubOverlayContainer = null;
      onClose?.();
    };

    closeButton.on('pointerover', () => closeButton.setFillStyle(0x4da0ff));
    closeButton.on('pointerout', () => closeButton.setFillStyle(0x2d8cff));
    closeButton.on('pointerdown', close);

    this.stubOverlayContainer = this.add.container(0, 0, [
      backdrop,
      panel,
      label,
      closeButton,
      closeLabel,
    ]).setDepth(30);
  }

  selectNode(node) {
    if (this.selectedNodeId) {
      const prev = this.nodeMarkers.get(this.selectedNodeId);
      prev?.setScale(1).setStrokeStyle(2, 0x2b2b2b);
    }

    const marker = this.nodeMarkers.get(node.id);
    marker?.setScale(1.25).setStrokeStyle(3, 0xffffff);
    this.selectedNodeId = node.id;

    const mapBiome = GameState.data.map?.biome ?? 'unknown';
    const visibility = node.hidden ? 'hidden' : 'visible';
    const connections = node.connections?.join(', ') ?? 'none';

    const message = [
      `id: ${node.id}`,
      `type: ${node.type}`,
      `region: ${node.region}`,
      `biome: ${mapBiome}`,
      `visibility: ${visibility}`,
      `connections: ${connections}`,
    ].join(' | ');

    this.nodeInfoText.setText(message);
    console.log(`[MapScene] ${message}`);
  }

  showFeedback(message) {
    if (!this.feedbackText) {
      return;
    }

    this.feedbackText.setText(message);
    this.feedbackText.setAlpha(1);

    if (this.feedbackFadeTween) {
      this.feedbackFadeTween.remove();
    }

    this.feedbackFadeTween = this.tweens.add({
      targets: this.feedbackText,
      alpha: 0,
      duration: 500,
      delay: 450,
      ease: 'Linear',
    });
  }

  handleShutdown() {
    this.scale.off('resize', this.handleResize, this);

    const destroyIfAlive = (obj) => {
      if (obj?.scene) {
        obj.destroy();
      }
    };

    destroyIfAlive(this.mapBackgroundImage);
    destroyIfAlive(this.mapBackgroundOverlay);

    this.mapBackgroundImage = null;
    this.mapBackgroundOverlay = null;
    this.mapBounds = null;
  }

  handleResize(gameSize) {
    const viewportWidth = gameSize?.width ?? this.scale.width;
    const viewportHeight = gameSize?.height ?? this.scale.height;

    this.mapBounds = this.drawMapBackground(viewportWidth, viewportHeight);

    const mapNodes = GameState.data?.map?.nodes ?? [];
    mapNodes.forEach((node) => {
      const marker = this.nodeMarkers.get(node.id);
      if (!marker) {
        return;
      }

      const point = this.mapToScreen(node.x, node.y);
      marker.setPosition(point.x, point.y);
    });

    const currentNode = this.mapById?.get(GameState.currentNodeId);
    if (this.heroMarker && currentNode) {
      const point = this.mapToScreen(currentNode.x, currentNode.y);
      this.heroMarker.setPosition(point.x, point.y);
    }

    this.feedbackText?.setPosition(viewportWidth / 2, viewportHeight - 84);
    this.nodeInfoText?.setPosition(16, viewportHeight - 60);
  }

  updateHud() {
    if (typeof window === 'undefined' || !window.gameUi?.updateMapHud) {
      return;
    }

    window.gameUi.updateMapHud({
      turn: GameState.turnCounter,
      hp: HERO_HP_STUB,
      level: HERO_LEVEL_STUB,
    });
  }
}
