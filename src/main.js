import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene';
import { MapScene } from './scenes/MapScene';
import { CastleScene } from './scenes/CastleScene';
import { BattleScene } from './scenes/BattleScene';

import '../ui-overlay.js';

const RESIZE_DEBOUNCE_MS = 120;
const VIEWPORT_SETTLE_FRAMES = 2;
const MIN_VIEWPORT_SIDE = 64;
const VIEWPORT_DEBUG = Boolean(import.meta.env.DEV);

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
let isFullscreenTransitioning = false;

function debugViewport(message, details = {}) {
  if (!VIEWPORT_DEBUG) {
    return;
  }

  const game = window.__PORTAL_GAME;
  const activeScene = game?.scene?.getScenes?.(true)?.[0]?.scene?.key ?? 'none';
  console.log(`[Viewport] ${message}`, {
    fullscreen: Boolean(document.fullscreenElement),
    activeScene,
    ...details,
  });
}

function getViewportSize(options = {}) {
  const { forceInner = false } = options;
  const visualViewport = window.visualViewport;
  const innerCandidate = { width: window.innerWidth, height: window.innerHeight, source: 'inner' };

  if (forceInner || document.fullscreenElement || isFullscreenTransitioning) {
    return innerCandidate;
  }

  const candidates = [
    innerCandidate,
    { width: visualViewport?.width, height: visualViewport?.height, source: 'visualViewport' },
  ].filter((candidate) => Number.isFinite(candidate.width) && Number.isFinite(candidate.height));

  const bestCandidate = candidates.reduce((best, candidate) => {
    if (!best) {
      return candidate;
    }

    const bestArea = best.width * best.height;
    const candidateArea = candidate.width * candidate.height;
    return candidateArea > bestArea ? candidate : best;
  }, null);

  return {
    width: Math.max(bestCandidate?.width ?? window.innerWidth, 1),
    height: Math.max(bestCandidate?.height ?? window.innerHeight, 1),
    source: bestCandidate?.source ?? 'inner',
  };
}

function isValidViewportSize(width, height) {
  return Number.isFinite(width)
    && Number.isFinite(height)
    && width >= MIN_VIEWPORT_SIDE
    && height >= MIN_VIEWPORT_SIDE;
}

function updateOrientationState(width, height, options = {}) {
  const { allowPortrait = true } = options;
  const isLandscape = width > height;

  if (!isLandscape && !allowPortrait) {
    return;
  }

  if (appShell) {
    appShell.classList.toggle('is-portrait', !isLandscape);
    appShell.classList.toggle('is-landscape', isLandscape);
  }

  if (rotateOverlay) {
    rotateOverlay.setAttribute('aria-hidden', String(isLandscape));
  }

  debugViewport('orientation state', {
    width,
    height,
    orientationClass: isLandscape ? 'is-landscape' : 'is-portrait',
    allowPortrait,
  });

  const gameInput = window.__PORTAL_GAME?.input;
  if (!gameInput) return;

  gameInput.enabled = isLandscape;
}

function syncViewport(viewport = getViewportSize(), options = {}) {
  const { reason = 'unspecified', allowPortrait = true } = options;
  const width = Math.floor(viewport.width);
  const height = Math.floor(viewport.height);

  if (!isValidViewportSize(width, height)) {
    debugViewport('skip invalid viewport', { reason, width, height, source: viewport.source ?? 'unknown' });
    return false;
  }

  if (width === lastAppliedViewport.width && height === lastAppliedViewport.height) {
    updateOrientationState(width, height, { allowPortrait });
    debugViewport('reuse viewport', { reason, width, height, source: viewport.source ?? 'unknown' });
    return true;
  }

  root.style.setProperty('--app-width', `${width}px`);
  root.style.setProperty('--app-height', `${height}px`);

  const game = window.__PORTAL_GAME;
  if (game?.scale) {
    game.scale.resize(width, height);
  }

  updateOrientationState(width, height, { allowPortrait });
  debugViewport('apply viewport', { reason, width, height, source: viewport.source ?? 'unknown', allowPortrait });
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
    reason = 'settle',
    allowPortrait = true,
  } = options;

  cancelViewportSettle();
  settleAttempt = 0;
  let stableCount = 0;
  let previous = null;

  const tick = () => {
    settleAttempt += 1;
    const current = getViewportSize({ forceInner: isFullscreenTransitioning });
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
      const applied = syncViewport(current, { reason, allowPortrait });
      if (!applied) {
        window.setTimeout(() => {
          syncViewportWhenSettled({ stableFrames: 1, maxAttempts: 10, reason: `${reason}:retry`, allowPortrait });
        }, 120);
      }
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
  isFullscreenTransitioning = true;
  const fullscreenActive = Boolean(document.fullscreenElement);
  debugViewport('fullscreen change', { fullscreenActive });

  syncViewport(getViewportSize({ forceInner: true }), {
    reason: 'fullscreen:immediate',
    allowPortrait: fullscreenActive,
  });

  if (viewportRefreshTimer) {
    window.clearTimeout(viewportRefreshTimer);
  }

  viewportRefreshTimer = window.setTimeout(() => {
    syncViewportWhenSettled({
      maxAttempts: 12,
      reason: 'fullscreen:settled',
      allowPortrait: true,
    });
    isFullscreenTransitioning = false;
  }, 80);
}

async function toggleFullscreen() {
  const target = appShell ?? document.documentElement;

  try {
    if (document.fullscreenElement) {
      isFullscreenTransitioning = true;
      await document.exitFullscreen();
      return;
    }

    if (!document.fullscreenEnabled || typeof target?.requestFullscreen !== 'function') {
      notifyFullscreenFallback();
      return;
    }

    isFullscreenTransitioning = true;
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
    syncViewportWhenSettled({ reason: 'window:resize' });
  }, RESIZE_DEBOUNCE_MS);
}

window.addEventListener('resize', queueViewportSync, { passive: true });
window.addEventListener('orientationchange', queueViewportSync, { passive: true });
window.addEventListener('fullscreenchange', refreshViewportAfterFullscreenChange, { passive: true });
window.addEventListener('webkitfullscreenchange', refreshViewportAfterFullscreenChange, { passive: true });

window.portalFullscreen = {
  toggle: () => toggleFullscreen(),
};

syncViewportWhenSettled({ maxAttempts: 2, stableFrames: 1 });
