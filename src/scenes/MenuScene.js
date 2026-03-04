import Phaser from 'phaser';
import { SCENES, SceneRouter } from '../SceneRouter';
import { addButton, addDebugHeader } from './ui';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super(SCENES.MENU);
  }

  create() {
    this.router = new SceneRouter(this);
    addDebugHeader(this, 'Menu Scene', 'Tap Start or press M to open Map');

    addButton(this, 220, 140, 'Start → Map', () => this.router.goTo(SCENES.MAP));

    this.input.keyboard.on('keydown-M', () => this.router.goTo(SCENES.MAP));
  }
}
