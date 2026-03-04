import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene';
import { MapScene } from './scenes/MapScene';
import { CastleScene } from './scenes/CastleScene';
import { BattleScene } from './scenes/BattleScene';

const config = {
  type: Phaser.AUTO,
  width: 480,
  height: 320,
  backgroundColor: '#10131a',
  parent: 'game',
  scene: [MenuScene, MapScene, CastleScene, BattleScene],
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
