import Phaser from 'phaser';
import { SCENES, SceneRouter } from '../SceneRouter';
import { GameState } from '../state/GameState';
import { syncSceneState } from '../state/sceneState';
import assetManifest, { loadAssetsFromManifest } from '../assets/loadAssetsFromManifest';
import { addFallbackPlaceholder, textureExists } from '../assets/safeTexture';

export class BattleScene extends Phaser.Scene {
  constructor() {
    super(SCENES.BATTLE);
  }

  preload() {
    loadAssetsFromManifest(this, assetManifest.units);

    const units = GameState?.data?.faction?.units ?? [];
    const baseUrl = import.meta.env.BASE_URL ?? '/';

    units.forEach((unit) => {
      const key = `unit-${unit.id}`;
      const path = String(unit?.asset ?? '').replace(/^\//, '');
      if (!path) {
        return;
      }

      this.load.image(key, `${baseUrl}${path}`);
    });
  }

  create() {
    syncSceneState(this.scene.key);
    this.router = new SceneRouter(this);

    if (typeof window !== 'undefined' && window.gameUi?.setMode) {
      window.gameUi.setMode('battle');
    }

    if (GameState.pendingBattleKind === 'portal') {
      this.add.text(16, 88, 'Portal Guardian battle', {
        color: '#ffd166',
        fontFamily: 'Arial',
        fontSize: '20px',
        fontStyle: 'bold',
      });
    }

    this.renderUnitPreview();


    this.input.keyboard.on('keydown-M', () => {
      GameState.pendingBattleKind = null;
      this.router.goTo(SCENES.MAP);
    });
  }

  renderUnitPreview() {
    const units = GameState?.data?.faction?.units ?? [];
    const firstUnit = units[0];
    const textureKey = firstUnit ? `unit-${firstUnit.id}` : null;
    const x = 90;
    const y = 160;

    if (textureKey && textureExists(this, textureKey)) {
      this.add.image(x, y, textureKey).setDisplaySize(72, 72);
      this.add.text(x, y + 52, firstUnit.name, {
        color: '#ffffff',
        fontFamily: 'Arial',
        fontSize: '14px',
      }).setOrigin(0.5, 0);
      return;
    }

    addFallbackPlaceholder(this, {
      x,
      y,
      width: 80,
      height: 80,
      label: 'missing asset\nunit sprite',
      depth: 5,
    });
  }
}
