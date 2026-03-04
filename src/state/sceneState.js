import { GameState } from './GameState';
import { loadGameData } from './loadGameData';

/**
 * Updates current scene and logs minimal data visibility info.
 * @param {string} sceneName
 */
export function syncSceneState(sceneName) {
  loadGameData();
  GameState.currentScene = sceneName;

  const { map } = GameState.data;
  console.log(`Scene: ${GameState.currentScene} | map: ${map?.id} (${map?.biome})`);
}
