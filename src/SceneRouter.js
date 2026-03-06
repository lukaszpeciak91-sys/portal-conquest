export const SCENES = {
  MENU: 'MenuScene',
  MAP: 'MapScene',
  CASTLE: 'CastleScene',
  BATTLE: 'BattleScene',
};

const MODE_TO_SCENE = {
  map: SCENES.MAP,
  castle: SCENES.CASTLE,
  battle: SCENES.BATTLE,
};

function resolveSceneKey(target) {
  if (!target) {
    return null;
  }

  return MODE_TO_SCENE[target] ?? target;
}

export class SceneRouter {
  constructor(sceneManagerOrScene) {
    this.sceneManagerOrScene = sceneManagerOrScene;
  }

  goTo(target, options = {}) {
    const sceneKey = resolveSceneKey(target);
    if (!sceneKey) {
      return;
    }

    const {
      force = false,
      forceRestart = false,
      beforeMapReturn = null,
      afterMapReturn = null,
    } = options;

    const host = this.sceneManagerOrScene;
    const sceneManager = host?.start ? host : host?.scene;

    if (!sceneManager?.start) {
      return;
    }

    const activeScene = typeof sceneManager.getScenes === 'function'
      ? sceneManager.getScenes(true)?.[0]
      : null;
    const activeKey = activeScene?.scene?.key ?? host?.scene?.key ?? host?.key;

    if (sceneKey === SCENES.MAP && (force || forceRestart)) {
      this.forceReturnToMap(sceneManager, { forceRestart, beforeMapReturn, afterMapReturn });
      return;
    }

    if (activeKey === sceneKey && !force) {
      return;
    }

    if (forceRestart && typeof sceneManager.stop === 'function') {
      sceneManager.stop(sceneKey);
    }

    sceneManager.start(sceneKey);
  }

  forceReturnToMap(sceneManager, {
    forceRestart = false,
    beforeMapReturn = null,
    afterMapReturn = null,
  } = {}) {
    const activeRouteKeys = [SCENES.CASTLE, SCENES.BATTLE, SCENES.MENU];

    activeRouteKeys.forEach((key) => {
      if (typeof sceneManager.isActive === 'function' && sceneManager.isActive(key)) {
        sceneManager.stop(key);
      }
    });

    if (typeof beforeMapReturn === 'function') {
      beforeMapReturn();
    }

    const shouldRestart = forceRestart
      || (typeof sceneManager.isActive === 'function' && sceneManager.isActive(SCENES.MAP));

    if (shouldRestart && typeof sceneManager.stop === 'function') {
      sceneManager.stop(SCENES.MAP);
    }

    sceneManager.start(SCENES.MAP);

    if (typeof afterMapReturn === 'function') {
      afterMapReturn();
    }
  }
}
