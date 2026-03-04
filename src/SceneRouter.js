export const SCENES = {
  MENU: 'MenuScene',
  MAP: 'MapScene',
  CASTLE: 'CastleScene',
  BATTLE: 'BattleScene',
};

export class SceneRouter {
  constructor(scene) {
    this.scene = scene;
  }

  goTo(sceneKey) {
    if (!sceneKey || this.scene.scene.key === sceneKey) {
      return;
    }

    this.scene.scene.start(sceneKey);
  }
}
