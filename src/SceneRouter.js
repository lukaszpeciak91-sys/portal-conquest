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

const ROUTABLE_SCENE_KEYS = [SCENES.MENU, SCENES.MAP, SCENES.CASTLE, SCENES.BATTLE];
const GAMEPLAY_SCENE_KEYS = [SCENES.MAP, SCENES.CASTLE, SCENES.BATTLE];

function resolveSceneKey(target) {
  if (!target) {
    return null;
  }

  return MODE_TO_SCENE[target] ?? target;
}

export class SceneRouter {
  constructor(sceneController) {
    this.sceneController = sceneController;
    this._reportedControllerError = false;
  }

  getSceneController() {
    const controller = this.sceneController;

    // Phaser.Game -> Phaser.SceneManager
    if (controller?.scene?.start && controller?.scene?.isActive && controller?.scene?.stop) {
      return controller.scene;
    }

    // Phaser.Scene -> Phaser.ScenePlugin
    if (controller?.scene?.manager?.start && controller?.scene?.isActive && controller?.scene?.stop) {
      return controller.scene;
    }

    // Phaser.ScenePlugin -> Phaser.SceneManager
    if (controller?.manager?.start) {
      return controller.manager;
    }

    // Phaser.SceneManager
    if (controller?.start) {
      return controller;
    }

    if (!this._reportedControllerError) {
      this._reportedControllerError = true;
      console.error('[SceneRouter] Unable to resolve scene controller from input.', controller);
    }

    return null;
  }

  getActiveSceneKeys(sceneKeys = ROUTABLE_SCENE_KEYS) {
    return sceneKeys.filter((sceneKey) => this.isSceneActive(sceneKey));
  }

  stopScene(sceneKey) {
    const sceneController = this.getSceneController();
    if (!sceneController || typeof sceneController.stop !== 'function') {
      return;
    }

    if (this.isSceneActive(sceneKey)) {
      sceneController.stop(sceneKey);
    }
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
      diagnostics = true,
    } = options;

    const sceneController = this.getSceneController();
    if (!sceneController) {
      return;
    }

    const activeGameplayBefore = this.getActiveSceneKeys(GAMEPLAY_SCENE_KEYS);

    if (diagnostics) {
      console.log(`[SceneRouter] goTo(${sceneKey}) gameplay before: ${activeGameplayBefore.join(', ') || 'none'}`);
    }

    if (sceneKey === SCENES.MAP && typeof beforeMapReturn === 'function') {
      beforeMapReturn();
    }

    if (GAMEPLAY_SCENE_KEYS.includes(sceneKey)) {
      GAMEPLAY_SCENE_KEYS
        .filter((key) => key !== sceneKey)
        .forEach((key) => this.stopScene(key));
    }

    if (forceRestart) {
      this.stopScene(sceneKey);
    }

    if (!this.isSceneActive(sceneKey) || force || forceRestart) {
      sceneController.start(sceneKey);
    }

    if (sceneKey === SCENES.MAP && typeof afterMapReturn === 'function') {
      afterMapReturn();
    }

    if (diagnostics) {
      const activeGameplayAfter = this.getActiveSceneKeys(GAMEPLAY_SCENE_KEYS);
      console.log(`[SceneRouter] goTo(${sceneKey}) gameplay after: ${activeGameplayAfter.join(', ') || 'none'}`);
    }
  }
}
