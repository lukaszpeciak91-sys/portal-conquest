import Phaser from 'phaser';
import { SCENES, SceneRouter } from '../SceneRouter';
import { addButton, addDebugHeader } from './ui';
import { GameState } from '../state/GameState';
import { syncSceneState } from '../state/sceneState';

export class MapScene extends Phaser.Scene {
  constructor() {
    super(SCENES.MAP);
    this.nodeMarkers = new Map();
    this.selectedNodeId = null;
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
    console.log(`Data ready: map=${map?.id}, biome=${map?.biome}, regions=${config?.regions}, faction=${faction?.id}`);

    const viewportWidth = this.scale.width;
    const viewportHeight = this.scale.height;

    this.mapBounds = this.drawMapBackground(viewportWidth, viewportHeight);
    this.renderNodes(map);

    this.nodeInfoText = this.add.text(16, viewportHeight - 60, 'Tap a visible node to inspect.', {
      color: '#ffffff',
      fontFamily: 'Arial',
      fontSize: '12px',
      backgroundColor: '#00000088',
      padding: { x: 8, y: 6 },
    }).setDepth(20);

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

      marker.on('pointerdown', () => this.selectNode(node));

      this.nodeMarkers.set(node.id, marker);
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
}
