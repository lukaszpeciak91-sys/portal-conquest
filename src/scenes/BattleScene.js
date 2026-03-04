import Phaser from 'phaser';
import { SCENES, SceneRouter } from '../SceneRouter';
import { addButton, addDebugHeader } from './ui';
import { GameState } from '../state/GameState';
import { syncSceneState } from '../state/sceneState';

export class BattleScene extends Phaser.Scene {
  constructor() {
    super(SCENES.BATTLE);
  }

  create() {
    syncSceneState(this.scene.key);
    this.router = new SceneRouter(this);
    addDebugHeader(this, 'Battle placeholder', 'No combat system yet');

    if (typeof window !== 'undefined' && window.gameUi?.setMode) {
      window.gameUi.setMode('map');
    }

    if (GameState.pendingBattleKind === 'portal') {
      this.add.text(16, 88, 'Portal Guardian battle', {
        color: '#ffd166',
        fontFamily: 'Arial',
        fontSize: '20px',
        fontStyle: 'bold',
      });
    }

    addButton(this, 220, 170, 'Back to Map', () => {
      GameState.pendingBattleKind = null;
      this.router.goTo(SCENES.MAP);
    });

    this.input.keyboard.on('keydown-M', () => {
      GameState.pendingBattleKind = null;
      this.router.goTo(SCENES.MAP);
    });
  }
}
