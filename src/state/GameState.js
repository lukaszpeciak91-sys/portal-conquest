/**
 * Central runtime state for the current app session.
 *
 * Note: discoveredNodes is a Set for fast membership checks.
 * Serialize with Array.from(GameState.discoveredNodes) when persisting.
 */
export const GameState = {
  currentScene: 'MenuScene',
  runSeed: null,
  turnCounter: 0,
  discoveredNodes: new Set(),
  closedPortals: 0,
  data: {
    map: null,
    config: null,
    faction: null,
  },
};
