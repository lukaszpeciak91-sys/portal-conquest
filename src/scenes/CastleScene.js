import Phaser from 'phaser';
import { SCENES, SceneRouter } from '../SceneRouter';
import { syncSceneState } from '../state/sceneState';
import assetManifest, { loadAssetsFromManifest } from '../assets/loadAssetsFromManifest';

const CASTLE_BG_KEY = 'castle_faction01_bg';

export class CastleScene extends Phaser.Scene {
  constructor() {
    super(SCENES.CASTLE);
  }

  preload() {
    loadAssetsFromManifest(this, assetManifest.castles);
  }

  create() {
    syncSceneState(this.scene.key);
    this.router = new SceneRouter(this.scene);

    this.renderBackground(this.scale.width, this.scale.height);

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

  renderBackground(viewportWidth, viewportHeight) {
    const hasTexture = this.textures.exists(CASTLE_BG_KEY);

    this.backgroundImage?.destroy();
    this.fallbackBackground?.destroy();
    this.fallbackText?.destroy();

    if (hasTexture) {
      const source = this.textures.get(CASTLE_BG_KEY).getSourceImage();
      const imageWidth = source.width || viewportWidth;
      const imageHeight = source.height || viewportHeight;
      const scale = Math.max(viewportWidth / imageWidth, viewportHeight / imageHeight);

      this.backgroundImage = this.add.image(viewportWidth / 2, viewportHeight / 2, CASTLE_BG_KEY)
        .setOrigin(0.5)
        .setScale(scale)
        .setDepth(0);

      return;
    }

    this.fallbackBackground = this.add.rectangle(viewportWidth / 2, viewportHeight / 2, viewportWidth, viewportHeight, 0x101828)
      .setDepth(0);

    const fallbackTitle = 'Castle View';
    const fallbackSubtitle = 'Background asset unavailable';

    this.fallbackText = this.add.text(viewportWidth / 2, viewportHeight / 2, `${fallbackTitle}\n${fallbackSubtitle}`, {
      color: '#e2e8f0',
      fontFamily: 'Arial',
      fontSize: '20px',
      fontStyle: 'bold',
      align: 'center',
      lineSpacing: 8,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(1);
  }

  handleResize(gameSize) {
    const viewportWidth = gameSize?.width ?? this.scale.width;
    const viewportHeight = gameSize?.height ?? this.scale.height;
    this.renderBackground(viewportWidth, viewportHeight);
  }
}
