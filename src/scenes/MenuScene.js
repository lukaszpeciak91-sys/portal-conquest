import Phaser from 'phaser';
import { SCENES, SceneRouter } from '../SceneRouter';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SCENES.MENU);
  }

  create() {
    this.router = new SceneRouter(this);
    this.input.keyboard.on('keydown-M', () => this.router.goTo(SCENES.MAP));
  }
}
