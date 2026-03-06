import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene';
import { MapScene } from './scenes/MapScene';
import { CastleScene } from './scenes/CastleScene';
import { BattleScene } from './scenes/BattleScene';

import '../ui-overlay.js';

const RESIZE_DEBOUNCE_MS = 120;
const VIEWPORT_SETTLE_FRAMES = 2;
const MIN_VIEWPORT_SIDE = 64;

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
let viewportRefreshTimer = null;
let settleRafId = null;
let settleAttempt = 0;
let lastAppliedViewport = { width: 0, height: 0 };

function getViewportSize() {
  return {
    width: Math.max(window.innerWidth, 1),
    height: Math.max(window.innerHeight, 1),
  };
}

function isValidViewportSize(width, height) {
  return Number.isFinite(width)
    && Number.isFinite(height)
    && width >= MIN_VIEWPORT_SIDE
    && height >= MIN_VIEWPORT_SIDE;
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

function syncViewport(viewport = getViewportSize()) {
  const width = Math.floor(viewport.width);
  const height = Math.floor(viewport.height);

  if (!isValidViewportSize(width, height)) {
    return false;
  }

  if (width === lastAppliedViewport.width && height === lastAppliedViewport.height) {
    updateOrientationState(width, height);
    return true;
  }

  root.style.setProperty('--app-width', `${width}px`);
  root.style.setProperty('--app-height', `${height}px`);

  const game = window.__PORTAL_GAME;
  if (game?.scale) {
    game.scale.resize(width, height);
  }

  updateOrientationState(width, height);
  lastAppliedViewport = { width, height };
  return true;
}

function cancelViewportSettle() {
  if (settleRafId) {
    window.cancelAnimationFrame(settleRafId);
    settleRafId = null;
  }
}

function syncViewportWhenSettled(options = {}) {
  const {
    stableFrames = VIEWPORT_SETTLE_FRAMES,
    maxAttempts = 8,
  } = options;

  cancelViewportSettle();
  settleAttempt = 0;
  let stableCount = 0;
  let previous = null;

  const tick = () => {
    settleAttempt += 1;
    const current = getViewportSize();
    const isSameAsPrevious = previous
      && current.width === previous.width
      && current.height === previous.height;

    if (isValidViewportSize(current.width, current.height) && isSameAsPrevious) {
      stableCount += 1;
    } else {
      stableCount = 0;
    }

    previous = current;

    if (stableCount >= stableFrames || settleAttempt >= maxAttempts) {
      settleRafId = null;
      syncViewport(current);
      return;
    }

    settleRafId = window.requestAnimationFrame(tick);
  };

  settleRafId = window.requestAnimationFrame(tick);
}

function notifyFullscreenFallback() {
  window.gameUi?.showHint?.('Fullscreen unavailable on this device/browser.');
}

function refreshViewportAfterFullscreenChange() {
  if (viewportRefreshTimer) {
    window.clearTimeout(viewportRefreshTimer);
  }

  viewportRefreshTimer = window.setTimeout(() => {
    syncViewportWhenSettled({ maxAttempts: 12 });
  }, 80);
}

async function toggleFullscreen() {
  const target = appShell ?? document.documentElement;

  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    if (!document.fullscreenEnabled || typeof target?.requestFullscreen !== 'function') {
      notifyFullscreenFallback();
      return;
    }

    await target.requestFullscreen();
  } catch (_error) {
    notifyFullscreenFallback();
  }
}

function queueViewportSync() {
  if (resizeTimer) {
    window.clearTimeout(resizeTimer);
  }

  resizeTimer = window.setTimeout(() => {
    syncViewportWhenSettled();
  }, RESIZE_DEBOUNCE_MS);
}

window.addEventListener('resize', queueViewportSync, { passive: true });
window.addEventListener('orientationchange', queueViewportSync, { passive: true });
window.addEventListener('fullscreenchange', refreshViewportAfterFullscreenChange, { passive: true });

window.portalFullscreen = {
  toggle: () => toggleFullscreen(),
};

syncViewportWhenSettled({ maxAttempts: 2, stableFrames: 1 });
