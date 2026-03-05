import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene';
import { MapScene } from './scenes/MapScene';
import { CastleScene } from './scenes/CastleScene';
import { BattleScene } from './scenes/BattleScene';

import '../ui-overlay.js';

const RESIZE_DEBOUNCE_MS = 120;

const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#10131a',
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.NONE,
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

const root = document.documentElement;
const appShell = document.getElementById('app-shell');
const rotateOverlay = document.getElementById('rotate-overlay');

let resizeTimer = null;
let fullscreenRequested = false;

function getViewportSize() {
  return {
    width: Math.max(window.innerWidth, 1),
    height: Math.max(window.innerHeight, 1),
  };
}

function updateOrientationState(width, height) {
  const isLandscape = width > height;

  if (appShell) {
    appShell.classList.toggle('is-portrait', !isLandscape);
    appShell.classList.toggle('is-landscape', isLandscape);
  }

  if (rotateOverlay) {
    rotateOverlay.setAttribute('aria-hidden', String(isLandscape));
  }

  const gameInput = window.__PORTAL_GAME?.input;
  if (!gameInput) return;

  gameInput.enabled = isLandscape;
}

function syncViewport() {
  const { width, height } = getViewportSize();

  root.style.setProperty('--app-width', `${width}px`);
  root.style.setProperty('--app-height', `${height}px`);

  const game = window.__PORTAL_GAME;
  if (game?.scale) {
    game.scale.resize(width, height);
  }

  updateOrientationState(width, height);
}

function requestFullscreenFromInteraction() {
  if (fullscreenRequested) {
    return;
  }

  fullscreenRequested = true;

  if (!document.fullscreenEnabled || document.fullscreenElement) {
    return;
  }

  const request = document.documentElement.requestFullscreen;
  if (typeof request !== 'function') {
    return;
  }

  request.call(document.documentElement).catch(() => {
    // Ignore failures; fullscreen may be blocked or unsupported by the browser.
  });
}

function queueViewportSync() {
  if (resizeTimer) {
    window.clearTimeout(resizeTimer);
  }

  resizeTimer = window.setTimeout(() => {
    syncViewport();
  }, RESIZE_DEBOUNCE_MS);
}

window.addEventListener('resize', queueViewportSync, { passive: true });
window.addEventListener('orientationchange', queueViewportSync, { passive: true });
window.addEventListener('pointerdown', requestFullscreenFromInteraction, { passive: true });
window.addEventListener('touchend', requestFullscreenFromInteraction, { passive: true });
window.addEventListener('keydown', requestFullscreenFromInteraction, { passive: true });

syncViewport();
