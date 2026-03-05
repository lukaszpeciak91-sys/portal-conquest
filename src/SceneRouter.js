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

  goTo(target) {
    const sceneKey = resolveSceneKey(target);
    if (!sceneKey) {
      return;
    }

    const host = this.sceneManagerOrScene;
    const sceneManager = host?.start ? host : host?.scene;

    if (!sceneManager?.start) {
      return;
    }

    const activeScene = typeof sceneManager.getScenes === 'function'
      ? sceneManager.getScenes(true)?.[0]
      : null;
    const activeKey = activeScene?.scene?.key ?? host?.scene?.key ?? host?.key;

    if (activeKey === sceneKey) {
      return;
    }

    sceneManager.start(sceneKey);
  }
}
