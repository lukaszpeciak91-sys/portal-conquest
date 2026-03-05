import Phaser from 'phaser';
import { SCENES, SceneRouter } from '../SceneRouter';
import { syncSceneState } from '../state/sceneState';

export class CastleScene extends Phaser.Scene {
  constructor() {
    super(SCENES.CASTLE);
  }

  create() {
    syncSceneState(this.scene.key);
    this.router = new SceneRouter(this);

    if (typeof window !== 'undefined' && window.gameUi?.setMode) {
      window.gameUi.setMode('castle');
    }


    this.input.keyboard.on('keydown-M', () => this.router.goTo(SCENES.MAP));
  }
}
