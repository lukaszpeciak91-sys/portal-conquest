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
  constructor(sceneController) {
    this.sceneController = sceneController;
  }

  getSceneController() {
    const controller = this.sceneController;
    if (controller?.start) {
      return controller;
    }

    if (controller?.scene?.start) {
      return controller.scene;
    }

    return null;
  }

  isSceneActive(sceneKey) {
    const sceneController = this.getSceneController();
    if (!sceneController || typeof sceneController.isActive !== 'function') {
      return false;
    }

    return sceneController.isActive(sceneKey);
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

    const sceneController = this.getSceneController();
    if (!sceneController) {
      return;
    }

    if (sceneKey === SCENES.MAP && (force || forceRestart)) {
      this.forceReturnToMap({ forceRestart, beforeMapReturn, afterMapReturn });
      return;
    }

    if (this.isSceneActive(sceneKey) && !force) {
      return;
    }

    if (forceRestart && this.isSceneActive(sceneKey) && typeof sceneController.stop === 'function') {
      sceneController.stop(sceneKey);
    }

    sceneController.start(sceneKey);
  }

  forceReturnToMap({
    forceRestart = false,
    beforeMapReturn = null,
    afterMapReturn = null,
  } = {}) {
    const sceneController = this.getSceneController();
    if (!sceneController) {
      return;
    }

    const activeRouteKeys = [SCENES.CASTLE, SCENES.BATTLE, SCENES.MENU];

    activeRouteKeys.forEach((key) => {
      if (this.isSceneActive(key) && typeof sceneController.stop === 'function') {
        sceneController.stop(key);
      }
    });

    if (typeof beforeMapReturn === 'function') {
      beforeMapReturn();
    }

    const shouldRestart = forceRestart || this.isSceneActive(SCENES.MAP);

    if (shouldRestart && typeof sceneController.stop === 'function') {
      sceneController.stop(SCENES.MAP);
    }

    sceneController.start(SCENES.MAP);

    if (typeof afterMapReturn === 'function') {
      afterMapReturn();
    }
  }
}
