import Phaser from 'phaser';

class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#0b1020');
    this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'Portal Conquest\nSkeleton Ready', {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        fontSize: '24px',
        color: '#f8fafc',
        align: 'center'
      })
      .setOrigin(0.5);
  }
}

const gameConfig = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#0b1020',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1080,
    height: 1920
  },
  scene: [BootScene]
};

new Phaser.Game(gameConfig);
