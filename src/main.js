import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene';
import { MapScene } from './scenes/MapScene';
import { CastleScene } from './scenes/CastleScene';
import { BattleScene } from './scenes/BattleScene';

import '../ui-overlay.js';

const config = {
  type: Phaser.AUTO,
  width: 480,
  height: 320,
  backgroundColor: '#10131a',
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  callbacks: {
    postBoot: (game) => {
      console.log(`[Phaser] viewport ${game.scale.width}x${game.scale.height}`);
    },
  },
  scene: [MapScene, MenuScene, CastleScene, BattleScene],
};

window.__PORTAL_GAME = new Phaser.Game(config);


const appShell = document.getElementById('app-shell');
const rotateOverlay = document.getElementById('rotate-overlay');

function updateOrientationState() {
  const isLandscape = window.innerWidth > window.innerHeight;

  if (appShell) {
    appShell.classList.toggle('is-portrait', !isLandscape);
    appShell.classList.toggle('is-landscape', isLandscape);
  }

  if (rotateOverlay) {
    rotateOverlay.setAttribute('aria-hidden', String(isLandscape));
  }

  const gameInput = window.__PORTAL_GAME?.input;
  if (!gameInput) return;

  if (!isLandscape) {
    gameInput.enabled = false;
    return;
  }

  gameInput.enabled = true;
}

window.addEventListener('resize', updateOrientationState);
window.addEventListener('orientationchange', updateOrientationState);
updateOrientationState();
