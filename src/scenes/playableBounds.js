import Phaser from 'phaser';

function toNumber(value) {
  const parsed = Number.parseFloat(value ?? '0');
  return Number.isFinite(parsed) ? parsed : 0;
}

function getElementHeight(element, fallbackValue = 0) {
  if (!element) {
    return fallbackValue;
  }

  const rectHeight = element.getBoundingClientRect?.().height;
  if (Number.isFinite(rectHeight) && rectHeight > 0) {
    return rectHeight;
  }

  if (typeof window !== 'undefined') {
    const computedHeight = toNumber(window.getComputedStyle(element).height);
    if (computedHeight > 0) {
      return computedHeight;
    }
  }

  return fallbackValue;
}

export function getPlayableBounds({
  viewportWidth,
  viewportHeight,
  minViewportSide = 64,
  minPlayableHeight = 1,
}) {
  const rootStyle = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement)
    : null;

  const topInset = toNumber(rootStyle?.getPropertyValue('--safe-top'));
  const bottomInset = toNumber(rootStyle?.getPropertyValue('--safe-bottom'));
  const topBarHeightVar = toNumber(rootStyle?.getPropertyValue('--top-bar-height'));
  const bottomBarHeightVar = toNumber(rootStyle?.getPropertyValue('--bottom-bar-height'));

  const topBarElement = typeof document !== 'undefined'
    ? document.querySelector('.top-bar')
    : null;
  const bottomBarElement = typeof document !== 'undefined'
    ? document.querySelector('.bottom-mode-bar')
    : null;
  const gameContainerRect = typeof document !== 'undefined'
    ? document.querySelector('#game-container')?.getBoundingClientRect?.() ?? null
    : null;

  const topBarRect = topBarElement?.getBoundingClientRect?.() ?? null;
  const bottomBarRect = bottomBarElement?.getBoundingClientRect?.() ?? null;

  const relativeTopBarBottom = topBarRect && gameContainerRect
    ? Math.max(0, topBarRect.bottom - gameContainerRect.top)
    : null;
  const relativeBottomBarTop = bottomBarRect && gameContainerRect
    ? Math.max(0, bottomBarRect.top - gameContainerRect.top)
    : null;

  const fallbackTopBarHeight = getElementHeight(topBarElement, topInset + topBarHeightVar);
  const fallbackBottomBarHeight = getElementHeight(bottomBarElement, bottomInset + bottomBarHeightVar);

  const fallbackTop = Phaser.Math.Clamp(fallbackTopBarHeight, 0, Math.max(0, viewportHeight - 1));
  const fallbackBottom = Phaser.Math.Clamp(viewportHeight - fallbackBottomBarHeight, fallbackTop + 1, viewportHeight);

  const topCandidate = Number.isFinite(relativeTopBarBottom) ? relativeTopBarBottom : fallbackTop;
  const bottomCandidate = Number.isFinite(relativeBottomBarTop) ? relativeBottomBarTop : fallbackBottom;

  const top = Phaser.Math.Clamp(topCandidate, 0, Math.max(0, viewportHeight - 1));
  const bottom = Phaser.Math.Clamp(bottomCandidate, top + 1, viewportHeight);
  const width = Math.max(minViewportSide, viewportWidth);
  const height = Math.max(minPlayableHeight, bottom - top);

  return {
    x: 0,
    y: top,
    width,
    height,
    centerX: width / 2,
    centerY: top + (height / 2),
    hasMeasuredBars: Number.isFinite(relativeTopBarBottom) && Number.isFinite(relativeBottomBarTop),
  };
}

