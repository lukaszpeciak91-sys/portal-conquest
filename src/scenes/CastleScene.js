import Phaser from 'phaser';
import { SCENES, SceneRouter } from '../SceneRouter';
import { addButton, addDebugHeader } from './ui';
import { syncSceneState } from '../state/sceneState';

export class CastleScene extends Phaser.Scene {
  constructor() {
    super(SCENES.CASTLE);
  }

  create() {
    syncSceneState(this.scene.key);
    this.router = new SceneRouter(this);
    addDebugHeader(this, 'Castle placeholder', 'No castle systems yet');

    if (typeof window !== 'undefined' && window.gameUi?.setMode) {
      window.gameUi.setMode('map');
    }

    addButton(this, 220, 170, 'Back to Map', () => this.router.goTo(SCENES.MAP));

    this.input.keyboard.on('keydown-M', () => this.router.goTo(SCENES.MAP));
  }
}
