import Phaser from 'phaser';
import { SCENES, SceneRouter } from '../SceneRouter';
import { addButton, addDebugHeader } from './ui';

export class BattleScene extends Phaser.Scene {
  constructor() {
    super(SCENES.BATTLE);
  }

  create() {
    this.router = new SceneRouter(this);
    addDebugHeader(this, 'Battle Scene', 'Tap Back or press M to return to Map');

    addButton(this, 220, 140, 'Back → Map', () => this.router.goTo(SCENES.MAP));

    this.input.keyboard.on('keydown-M', () => this.router.goTo(SCENES.MAP));
  }
}
