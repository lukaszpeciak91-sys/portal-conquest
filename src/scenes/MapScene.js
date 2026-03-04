import Phaser from 'phaser';
import { SCENES, SceneRouter } from '../SceneRouter';
import { addButton, addDebugHeader } from './ui';
import { GameState } from '../state/GameState';
import { syncSceneState } from '../state/sceneState';

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
    this.load.image('map01-bg', '/assets/maps/map01.png');
  }

  create() {
    syncSceneState(this.scene.key);

    this.router = new SceneRouter(this);
    addDebugHeader(
      this,
      'Map Scene',
      'Tap Castle/Battle. Dev keys: M=Map C=Castle B=Battle',
    );

    addButton(this, 220, 140, 'Enter Castle', () => this.router.goTo(SCENES.CASTLE));
    addButton(this, 220, 210, 'Start Battle', () => this.router.goTo(SCENES.BATTLE));

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

    const viewportWidth = this.scale.width;
    const viewportHeight = this.scale.height;

    this.mapBounds = this.drawMapBackground(viewportWidth, viewportHeight);
    this.renderNodes(map);
    this.renderHeroMarker();

    this.feedbackText = this.add.text(viewportWidth / 2, viewportHeight - 84, '', {
      color: '#f1f1f1',
      fontFamily: 'Arial',
      fontSize: '13px',
      backgroundColor: '#00000099',
      padding: { x: 8, y: 6 },
    }).setOrigin(0.5).setDepth(20).setAlpha(0);

    this.nodeInfoText = this.add.text(16, viewportHeight - 60, 'Tap a visible node to inspect or move.', {
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
  }

  drawMapBackground(viewportWidth, viewportHeight) {
    const fallbackBounds = { x: 0, y: 0, width: viewportWidth, height: viewportHeight, scale: 1 };

    if (!this.textures.exists('map01-bg')) {
      this.add.rectangle(viewportWidth / 2, viewportHeight / 2, viewportWidth, viewportHeight, 0x1b2334).setDepth(0);
      this.add.text(viewportWidth / 2, viewportHeight / 2, 'Missing map01.png', {
        color: '#ffffff',
        fontFamily: 'Arial',
        fontSize: '24px',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(1);

      return fallbackBounds;
    }

    const texture = this.textures.get('map01-bg').getSourceImage();
    const imageWidth = texture.width;
    const imageHeight = texture.height;
    const scale = Math.min(viewportWidth / imageWidth, viewportHeight / imageHeight);
    const width = imageWidth * scale;
    const height = imageHeight * scale;
    const x = (viewportWidth - width) / 2;
    const y = (viewportHeight - height) / 2;

    this.add.image(viewportWidth / 2, viewportHeight / 2, 'map01-bg')
      .setDisplaySize(width, height)
      .setDepth(0);

    return { x, y, width, height, scale };
  }

  mapToScreen(x, y) {
    const source = this.textures.exists('map01-bg')
      ? this.textures.get('map01-bg').getSourceImage()
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
      },
    });
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
