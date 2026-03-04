import Phaser from 'phaser';
import { SCENES, SceneRouter } from '../SceneRouter';
import { addButton, addDebugHeader } from './ui';

export class MapScene extends Phaser.Scene {
  constructor() {
    super(SCENES.MAP);
  }

  create() {
    this.router = new SceneRouter(this);
    addDebugHeader(
      this,
      'Map Scene',
      'Tap Castle/Battle. Dev keys: M=Map C=Castle B=Battle',
    );

    addButton(this, 220, 140, 'Enter Castle', () => this.router.goTo(SCENES.CASTLE));
    addButton(this, 220, 210, 'Start Battle', () => this.router.goTo(SCENES.BATTLE));

    this.input.keyboard.on('keydown-M', () => this.router.goTo(SCENES.MAP));
    this.input.keyboard.on('keydown-C', () => this.router.goTo(SCENES.CASTLE));
    this.input.keyboard.on('keydown-B', () => this.router.goTo(SCENES.BATTLE));
  }
}
